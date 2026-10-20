-- ==============================================================================
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
  ('admin', 'a1b2c3d4e5f60718293a4b5c6d7e8f90:8d491b23e19cb0e3c3efbbdf81953dd00ef2f829680dec911861e808a0c5eb6cbbe27c8cbd5cae9a20b97fc21978ba0238779901fc96534f4cdc0ad0e4238b10', 'admin', 'Administrador de Inventario', true, NOW(), NOW()),
  ('consulta', 'f0e9d8c7b6a594837261504f3e2d1c0b:702b5d850113c186b4135d0331bd1d0ab96d7c2a444d2618e888b8894a07b04ee61e3654322adfdd4e79752f3650c875e371a76668575f2b280ecedd47df27b5', 'viewer', 'Usuario de Consulta', true, NOW(), NOW())
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 2. Sembrado de Catálogo de Inventario (public.inventory_items)
INSERT INTO public.inventory_items (sku, stock, image_url, created_at, updated_at)
VALUES
  ('LAP-PRO-16X', 24, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAIElEQVR42mOQiL9MEmKQiL9s3fSNSDSqYVTDQGsgCQEA1e2adMcmiWkAAAAASUVORK5CYII=', NOW() - INTERVAL '10 hours', NOW() - INTERVAL '10 hours'),
  ('MON-4K-27U', 15, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAH0lEQVR42mNgmBZHGmKYFiews5FINKphVMNAayAJAQAlCjXoMZz50AAAAABJRU5ErkJggg==', NOW() - INTERVAL '9 hours', NOW() - INTERVAL '9 hours'),
  ('KEY-MECH-RGB', 42, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAIElEQVR42mPIsLxMEmLIsLzcHfONSDSqYVTDQGsgCQEAebzEdARr/4cAAAAASUVORK5CYII=', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours'),
  ('MOU-ERG-WL1', 4, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHUlEQVR42mO4VM1AEgLhr/O4iUSjGkY1DLQGkhAA6QOLFPNtdNUAAAAASUVORK5CYII=', NOW() - INTERVAL '7 hours', NOW() - INTERVAL '7 hours'),
  ('SSD-NVME-2TB', 0, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAIElEQVR42mM4o6hIEmI4o6j43sWFSDSqYVTDQGsgCQEAVqdedN+wcoIAAAAASUVORK5CYII=', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),
  ('RAM-DDR5-32G', 18, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAH0lEQVR42mNgmLyRNMQweSPbtitEolENoxoGWgNJCACXlH5ANngNuwAAAABJRU5ErkJggg==', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours'),
  ('GPU-RTX-4080S', 2, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAIElEQVR42mM4qVpGEmI4qVr2xmMmkWhUw6iGgdZAEgIAtlS0dIW96QIAAAAASUVORK5CYII=', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
  ('DOC-USB4-12P', 9, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAIElEQVR42mNwcD5HEmJwcD6XnPaRSDSqYVTDQGsgCQEAu5KhdMWVncQAAAAASUVORK5CYII=', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '3 hours'),
  ('CAM-STR-1080P', 0, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAH0lEQVR42mNwDMwgCTE4BmaklHQTiUY1jGoYaA0kIQDix0p0a1XPRAAAAABJRU5ErkJggg==', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'),
  ('UPS-SMT-1500W', 5, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAH0lEQVR42mNgmNpMGmKY2iyyYxmRaFTDqIaB1kASAgDXD1z4O6bg/AAAAABJRU5ErkJggg==', NOW() - INTERVAL '1 hours', NOW() - INTERVAL '1 hours')
ON CONFLICT (sku) DO UPDATE SET
  stock = EXCLUDED.stock,
  image_url = EXCLUDED.image_url,
  updated_at = NOW();
