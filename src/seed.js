import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, isSupabaseConfigured, SUPABASE_BUCKET } from './config/supabase.js';
import { SEED_ITEMS_DEFINITION, createColoredPngBuffer, getInitialSeedItems } from './config/seedData.js';
import { isValidSku, isValidStock } from './controllers/inventoryController.js';
import { validatePngMagicBytes } from './middlewares/uploadMiddleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Construye el archivo seed.sql idempotente sincronizado con SEED_ITEMS_DEFINITION
 */
const generateSeedSqlFile = () => {
  const valueRows = SEED_ITEMS_DEFINITION.map((item) => {
    const pngBuffer = createColoredPngBuffer(...item.color);
    const dataUri = `data:image/png;base64,${pngBuffer.toString('base64')}`;
    return `  ('${item.sku}', ${item.stock}, '${dataUri}', NOW() - INTERVAL '${item.hoursAgo} hours', NOW() - INTERVAL '${item.hoursAgo} hours')`;
  }).join(',\n');

  const sqlContent = `-- ==============================================================================
-- SEED DATA: Módulo de Registro de Inventario
-- Tabla objetivo: public.inventory_items (definida en schema.sql)
-- ==============================================================================
-- Nota: Operación idempotente (ON CONFLICT DO UPDATE). Segura para re-ejecución.
-- Incluye 10 artículos de prueba cubriendo los 3 estados de inventario:
--   * Disponible (stock > 5)
--   * Stock Bajo (1 <= stock <= 5)
--   * Agotado    (stock = 0)
-- Las imágenes son archivos PNG reales (Magic Bytes 89 50 4E 47 0D 0A 1A 0A)
-- codificados en Data URI Base64 para visualización inmediata en la interfaz.
-- ==============================================================================

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

  // 1. Validación estricta de reglas de negocio sobre los datos semilla
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

  console.log(`✅ Validación de integridad superada para ${SEED_ITEMS_DEFINITION.length} registros (SKU, Stock >= 0, Magic Bytes PNG).`);

  // 2. Generar/sincronizar seed.sql para Supabase SQL Editor
  const sqlPath = generateSeedSqlFile();
  console.log(`📄 Script SQL idempotente sincronizado en: ${sqlPath}`);

  // 3. Si Supabase está configurado, poblar Storage + tabla public.inventory_items
  if (isSupabaseConfigured && supabase) {
    console.log(`📡 Conectado a Supabase. Sincronizando Storage (${SUPABASE_BUCKET}) y tabla public.inventory_items...\n`);

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

  // 4. Modo Local / Demo
  const localItems = getInitialSeedItems();
  const totalStock = localItems.reduce((acc, item) => acc + item.stock, 0);

  console.log(`🟡 Modo Local / Demo activo: Los ${localItems.length} registros están precargados automáticamente en memoria.\n`);

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
