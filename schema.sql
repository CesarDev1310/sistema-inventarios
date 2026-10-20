-- ==============================================================================
-- SCHEMA DDL: Módulo de Registro de Inventario
-- Base de datos: Supabase (PostgreSQL)
-- ==============================================================================

-- 1. Tabla de Inventario
CREATE TABLE IF NOT EXISTS public.inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(50) NOT NULL UNIQUE,
    stock INTEGER NOT NULL CHECK (stock >= 0),
    image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Índices de Rendimiento
CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON public.inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_created_at ON public.inventory_items(created_at DESC);

-- 3. Trigger para actualización automática de updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER trigger_update_inventory_items_updated_at
BEFORE UPDATE ON public.inventory_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4. Seguridad de Datos: Row Level Security (RLS)
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública (cualquier usuario/cliente puede consultar el inventario)
DROP POLICY IF EXISTS "Permitir lectura publica de inventario" ON public.inventory_items;
CREATE POLICY "Permitir lectura publica de inventario"
ON public.inventory_items
FOR SELECT
TO public
USING (true);

-- Política de inserción (para el backend o clientes autorizados)
DROP POLICY IF EXISTS "Permitir insercion de inventario" ON public.inventory_items;
CREATE POLICY "Permitir insercion de inventario"
ON public.inventory_items
FOR INSERT
TO public
WITH CHECK (true);

-- Política de actualización de inventario (edición de SKU, stock e imagen)
DROP POLICY IF EXISTS "Permitir actualizacion de inventario" ON public.inventory_items;
CREATE POLICY "Permitir actualizacion de inventario"
ON public.inventory_items
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);

-- ==============================================================================
-- 5. Configuración de Supabase Storage para Imágenes (Bucket: inventory-images)
-- ==============================================================================

-- Crear el bucket de almacenamiento si no existe (público para visualización directa)
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory-images', 'inventory-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Política de lectura pública de imágenes del bucket
DROP POLICY IF EXISTS "Permitir acceso publico a imagenes de inventario" ON storage.objects;
CREATE POLICY "Permitir acceso publico a imagenes de inventario"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'inventory-images');

-- Política de subida de imágenes al bucket
DROP POLICY IF EXISTS "Permitir subida de imagenes a inventario" ON storage.objects;
CREATE POLICY "Permitir subida de imagenes a inventario"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'inventory-images');
