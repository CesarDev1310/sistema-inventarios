import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, isSupabaseConfigured, SUPABASE_BUCKET } from './config/supabase.js';
import {
  SEED_ITEMS_DEFINITION,
  SEED_USERS_DEFINITION,
  createColoredPngBuffer,
  getInitialSeedItems,
  getInitialSeedUsers
} from './config/seedData.js';
import { isValidSku, isValidStock } from './controllers/inventoryController.js';
import { isValidUsername } from './controllers/authController.js';
import { validatePngMagicBytes } from './middlewares/uploadMiddleware.js';
import { hashPassword, verifyPassword } from './utils/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Construye el archivo seed.sql idempotente sincronizado con SEED_USERS_DEFINITION y SEED_ITEMS_DEFINITION
 */
const generateSeedSqlFile = () => {
  const userRows = SEED_USERS_DEFINITION.map((u) => {
    const passwordHash = hashPassword(u.plainPasswordForDemo, u.saltHex);
    return `  ('${u.username}', '${passwordHash}', '${u.role}', '${u.full_name}', ${u.is_active}, NOW(), NOW())`;
  }).join(',\n');

  const valueRows = SEED_ITEMS_DEFINITION.map((item) => {
    const pngBuffer = createColoredPngBuffer(...item.color);
    const dataUri = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    return `  ('${item.sku}', ${item.stock}, '${dataUri}', NOW() - INTERVAL '${item.hoursAgo} hours', NOW() - INTERVAL '${item.hoursAgo} hours')`;
  }).join(',\n');

  const sqlContent = `-- ==============================================================================
-- SEED DATA: Módulo de Registro de Inventario y Control de Acceso (RBAC)
-- Tablas objetivo: public.app_users y public.inventory_items (definidas en schema.sql)
-- ==============================================================================
-- Nota: Operación idempotente (ON CONFLICT DO UPDATE). Segura para re-ejecución.
--
-- 1. USUARIOS SEMILLA (public.app_users):
--    * admin    (Rol: 'admin'  | Contraseña: Admin123!)    -> Lectura, Creación y Edición
--    * consulta (Rol: 'viewer' | Contraseña: Consulta123!) -> Solo Lectura
--
-- 2. ARTÍCULOS SEMILLA (public.inventory_items):
--    * 10 productos cubriendo estados Disponible (>5), Stock Bajo (1..5) y Agotado (0).
-- ==============================================================================

-- 1. Sembrado de Usuarios y Roles (public.app_users)
INSERT INTO public.app_users (username, password_hash, role, full_name, is_active, created_at, updated_at)
VALUES
${userRows}
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Sembrado de Catálogo de Inventario (public.inventory_items)
INSERT INTO public.inventory_items (sku, stock, image_url, created_at, updated_at)
VALUES
${valueRows}
ON CONFLICT (sku) DO UPDATE SET
  stock = EXCLUDED.stock,
  image_url = EXCLUDED.image_url,
  updated_at = NOW();
`;

  const sqlFilePath = path.resolve(__dirname, '../seed.sql');
  fs.writeFileSync(sqlFilePath, sqlContent, 'utf8');
  return sqlFilePath;
};

const runSeed = async () => {
  console.log(`\n========================================================`);
  console.log(`🌱 EJECUTANDO GENERADOR DE DATA DE PRUEBA (SEED)`);
  console.log(`========================================================\n`);

  // 1. Validación estricta de reglas de negocio sobre los datos semilla de inventario
  for (const item of SEED_ITEMS_DEFINITION) {
    const pngBuffer = createColoredPngBuffer(...item.color);

    if (!isValidSku(item.sku)) {
      throw new Error(`SKU inválido en data semilla: ${item.sku}`);
    }
    if (!isValidStock(item.stock)) {
      throw new Error(`Stock inválido en data semilla para ${item.sku}: ${item.stock}`);
    }
    if (!validatePngMagicBytes(pngBuffer)) {
      throw new Error(`Magic Bytes PNG inválidos generados para ${item.sku}`);
    }
  }

  // 2. Validación de usuarios semilla y hashes scrypt
  for (const u of SEED_USERS_DEFINITION) {
    if (!isValidUsername(u.username)) {
      throw new Error(`Username inválido en data semilla: ${u.username}`);
    }
    if (!['admin', 'viewer'].includes(u.role)) {
      throw new Error(`Rol inválido para ${u.username}: ${u.role}`);
    }
    const generatedHash = hashPassword(u.plainPasswordForDemo, u.saltHex);
    if (!verifyPassword(u.plainPasswordForDemo, generatedHash)) {
      throw new Error(`Fallo en verificación criptográfica scrypt para ${u.username}`);
    }
  }

  console.log(
    `✅ Validación de integridad superada: ${SEED_USERS_DEFINITION.length} usuarios RBAC y ${SEED_ITEMS_DEFINITION.length} productos (SKU, Stock >= 0, Magic Bytes PNG).`
  );

  // 3. Generar/sincronizar seed.sql para Supabase SQL Editor
  const sqlPath = generateSeedSqlFile();
  console.log(`📄 Script SQL idempotente sincronizado en: ${sqlPath}`);

  // 4. Si Supabase está configurado, poblar Usuarios + Storage + Inventario
  if (isSupabaseConfigured && supabase) {
    console.log(`📡 Conectado a Supabase. Sincronizando usuarios, Storage (${SUPABASE_BUCKET}) e inventario...\n`);

    const seedUsers = getInitialSeedUsers();
    for (const u of seedUsers) {
      const { error: userErr } = await supabase
        .from('app_users')
        .upsert(
          {
            username: u.username,
            password_hash: u.password_hash,
            role: u.role,
            full_name: u.full_name,
            is_active: u.is_active,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'username' }
        );

      if (userErr) {
        console.warn(`   ⚠️ Aviso al sincronizar usuario [${u.username}] en Supabase: ${userErr.message} (Ejecuta schema.sql en Supabase si aún no existe la tabla app_users).`);
      } else {
        console.log(`   👤 Usuario [${u.username}] sincronizado (Rol: ${u.role})`);
      }
    }

    let insertedCount = 0;

    for (const item of SEED_ITEMS_DEFINITION) {
      const pngBuffer = createColoredPngBuffer(...item.color);
      const storagePath = `products/${item.sku}-seed.png`;

      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(storagePath, pngBuffer, {
          contentType: 'image/png',
          upsert: true
        });

      if (uploadError) {
        console.error(`❌ Error al subir imagen para ${item.sku}:`, uploadError.message);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(storagePath);

      const timestamp = new Date(Date.now() - item.hoursAgo * 3600 * 1000).toISOString();

      const { error: upsertError } = await supabase
        .from('inventory_items')
        .upsert(
          {
            sku: item.sku,
            stock: item.stock,
            image_url: urlData.publicUrl,
            created_at: timestamp,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'sku' }
        );

      if (upsertError) {
        console.error(`❌ Error al insertar SKU ${item.sku} en BD:`, upsertError.message);
      } else {
        insertedCount++;
        console.log(`   ✔ [${item.sku}] sincronizado (Stock: ${item.stock})`);
      }
    }

    console.log(`\n🎉 Seeding en Supabase completado: ${insertedCount}/${SEED_ITEMS_DEFINITION.length} productos registrados.`);
    return;
  }

  // 5. Modo Local / Demo
  const localItems = getInitialSeedItems();
  const totalStock = localItems.reduce((acc, item) => acc + item.stock, 0);

  console.log(`🟡 Modo Local / Demo activo: Usuarios y productos están precargados en memoria.\n`);

  console.table(
    SEED_USERS_DEFINITION.map(({ username, role, full_name, plainPasswordForDemo }) => ({
      username,
      password_demo: plainPasswordForDemo,
      role,
      permisos: role === 'admin' ? 'Lectura + Crear + Editar' : 'Solo Lectura (Consulta)',
      full_name
    }))
  );

  console.table(
    localItems.map(({ id, sku, stock, created_at }) => ({
      id,
      sku,
      stock,
      estado_ui: stock === 0 ? 'Agotado (0)' : stock <= 5 ? `Bajo (${stock})` : `Disponible (${stock})`,
      created_at
    }))
  );

  console.log(`📊 Resumen de Catálogo Semilla: ${localItems.length} SKUs | ${totalStock} Unidades totales en Stock.\n`);
};

runSeed().catch((err) => {
  console.error('❌ Error crítico durante el proceso de seed:', err.message);
  process.exitCode = 1;
});
