-- ==============================================================================
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
