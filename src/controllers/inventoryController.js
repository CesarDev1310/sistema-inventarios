import { supabase, isSupabaseConfigured, SUPABASE_BUCKET } from '../config/supabase.js';
import { validatePngMagicBytes } from '../middlewares/uploadMiddleware.js';
import { getInitialSeedItems } from '../config/seedData.js';

// Almacén en memoria como respaldo cuando no se han configurado credenciales de Supabase
const inMemoryInventory = getInitialSeedItems();

/**
 * Validador de formato SKU (Alfanumérico con guiones permitidos, entre 3 y 50 caracteres)
 */
export const isValidSku = (sku) => {
  const skuRegex = /^[A-Za-z0-9\-_]{3,50}$/;
  return typeof sku === 'string' && skuRegex.test(sku);
};

/**
 * Validador de Stock (Entero no negativo)
 */
export const isValidStock = (stock) => {
  if (stock === null || stock === undefined || stock === '') return false;
  const num = Number(stock);
  return Number.isInteger(num) && num >= 0;
};

/**
 * Controlador para Registrar un nuevo artículo en el inventario
 * POST /api/inventory
 */
export const registerInventoryItem = async (req, res) => {
  try {
    const { sku, stock } = req.body;
    const file = req.file;

    // 1. Validación de presencia de campos obligatorios
    if (!sku || stock === undefined || stock === null || stock === '') {
      return res.status(400).json({
        success: false,
        error: 'Los campos SKU y stock son requeridos.'
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'La imagen del producto es obligatoria en formato PNG (.png).'
      });
    }

    // 2. Normalización y validación del SKU
    const normalizedSku = sku.trim().toUpperCase();
    if (!isValidSku(normalizedSku)) {
      return res.status(400).json({
        success: false,
        error: 'El código SKU debe ser alfanumérico (letras, números o guiones) entre 3 y 50 caracteres.'
      });
    }

    // 3. Validación del Stock
    if (!isValidStock(stock)) {
      return res.status(400).json({
        success: false,
        error: 'El stock debe ser un número entero positivo o cero (sin decimales ni signos negativos).'
      });
    }
    const parsedStock = parseInt(stock, 10);

    // 4. Verificación de seguridad profunda de archivo (Magic Bytes PNG)
    if (!validatePngMagicBytes(file.buffer)) {
      return res.status(400).json({
        success: false,
        error: 'El archivo subido no es una imagen PNG válida (encabezado binario corrupto o formato no permitido).'
      });
    }

    // ==============================================================================
    // PERSISTENCIA: VÍA SUPABASE (SI ESTÁ CONFIGURADO)
    // ==============================================================================
    if (isSupabaseConfigured && supabase) {
      // 5. Verificar unicidad de SKU en la base de datos
      const { data: existingItem, error: checkError } = await supabase
        .from('inventory_items')
        .select('id, sku')
        .eq('sku', normalizedSku)
        .maybeSingle();

      if (checkError) {
        console.error('Error al verificar SKU en Supabase:', checkError);
        return res.status(500).json({
          success: false,
          error: 'Error interno al consultar la base de datos.'
        });
      }

      if (existingItem) {
        return res.status(409).json({
          success: false,
          error: `El código SKU "${normalizedSku}" ya se encuentra registrado en el inventario.`
        });
      }

      // 6. Subir imagen a Supabase Storage Bucket
      const sanitizedFileName = `${normalizedSku}-${Date.now()}.png`;
      const storagePath = `products/${sanitizedFileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(storagePath, file.buffer, {
          contentType: 'image/png',
          upsert: false
        });

      if (uploadError) {
        console.error('Error al subir imagen a Supabase Storage:', uploadError);
        return res.status(500).json({
          success: false,
          error: `Error al almacenar la imagen en el bucket "${SUPABASE_BUCKET}": ${uploadError.message}`
        });
      }

      // Obtener URL pública de la imagen
      const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(storagePath);

      const publicImageUrl = urlData.publicUrl;

      // 7. Insertar registro en tabla inventory_items
      const { data: insertedItem, error: insertError } = await supabase
        .from('inventory_items')
        .insert([
          {
            sku: normalizedSku,
            stock: parsedStock,
            image_url: publicImageUrl
          }
        ])
        .select()
        .single();

      // Control de fallo transaccional (Rollback de imagen huérfana)
      if (insertError) {
        console.error('Error al registrar en BD. Reversando imagen de Storage:', insertError);
        await supabase.storage.from(SUPABASE_BUCKET).remove([storagePath]);

        if (insertError.code === '23505') {
          return res.status(409).json({
            success: false,
            error: `El código SKU "${normalizedSku}" ya existe.`
          });
        }

        return res.status(500).json({
          success: false,
          error: 'Error al registrar el producto en la base de datos.'
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Artículo registrado exitosamente en Supabase.',
        data: insertedItem,
        source: 'supabase'
      });
    }

    // ==============================================================================
    // PERSISTENCIA: MODO RESPALDO / DEMO (SIN SUPABASE CONFIGURADO)
    // ==============================================================================
    const skuExistsInMemory = inMemoryInventory.some((item) => item.sku === normalizedSku);
    if (skuExistsInMemory) {
      return res.status(409).json({
        success: false,
        error: `El código SKU "${normalizedSku}" ya se encuentra registrado en el inventario.`
      });
    }

    // Convertir el buffer a Base64 Data URI para previsualización inmediata en demo
    const base64Image = `data:image/png;base64,${file.buffer.toString('base64')}`;

    const newItem = {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sku: normalizedSku,
      stock: parsedStock,
      image_url: base64Image,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    inMemoryInventory.unshift(newItem);

    return res.status(201).json({
      success: true,
      message: 'Artículo registrado en memoria local (Configure .env con Supabase para persistencia en nube).',
      data: newItem,
      source: 'memory_demo'
    });
  } catch (error) {
    console.error('Error no controlado en registerInventoryItem:', error);
    return res.status(500).json({
      success: false,
      error: 'Ocurrió un error inesperado al procesar la solicitud.'
    });
  }
};

/**
 * Controlador para Obtener la lista de artículos en el inventario
 * GET /api/inventory
 */
export const getInventoryItems = async (req, res) => {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al consultar inventario en Supabase:', error);
        return res.status(500).json({
          success: false,
          error: 'Error al consultar el inventario en Supabase.'
        });
      }

      return res.status(200).json({
        success: true,
        data: data || [],
        source: 'supabase'
      });
    }

    // Retorno desde memoria
    return res.status(200).json({
      success: true,
      data: inMemoryInventory,
      source: 'memory_demo'
    });
  } catch (error) {
    console.error('Error al obtener inventario:', error);
    return res.status(500).json({
      success: false,
      error: 'Error al consultar la lista de inventario.'
    });
  }
};

/**
 * Controlador para Editar un artículo existente en el inventario
 * PUT /api/inventory/:id
 */
export const updateInventoryItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { sku, stock } = req.body;
    const file = req.file;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'El identificador (ID) del producto es obligatorio.'
      });
    }

    // 1. Validación de presencia de campos obligatorios (sku y stock)
    if (!sku || stock === undefined || stock === null || stock === '') {
      return res.status(400).json({
        success: false,
        error: 'Los campos SKU y stock son requeridos para actualizar el producto.'
      });
    }

    // 2. Normalización y validación del SKU
    const normalizedSku = sku.trim().toUpperCase();
    if (!isValidSku(normalizedSku)) {
      return res.status(400).json({
        success: false,
        error: 'El código SKU debe ser alfanumérico (letras, números o guiones) entre 3 y 50 caracteres.'
      });
    }

    // 3. Validación del Stock
    if (!isValidStock(stock)) {
      return res.status(400).json({
        success: false,
        error: 'El stock debe ser un número entero positivo o cero (sin decimales ni signos negativos).'
      });
    }
    const parsedStock = parseInt(stock, 10);

    // 4. Si se adjuntó una nueva imagen, validar Magic Bytes PNG
    if (file && !validatePngMagicBytes(file.buffer)) {
      return res.status(400).json({
        success: false,
        error: 'El archivo subido no es una imagen PNG válida (encabezado binario corrupto o formato no permitido).'
      });
    }

    // ==============================================================================
    // PERSISTENCIA: VÍA SUPABASE (SI ESTÁ CONFIGURADO)
    // ==============================================================================
    if (isSupabaseConfigured && supabase) {
      // 5. Verificar que el producto exista
      const { data: currentItem, error: findError } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (findError) {
        if (findError.code === '22P02') {
          return res.status(404).json({
            success: false,
            error: 'Artículo no encontrado en el inventario.'
          });
        }
        console.error('Error al buscar producto por ID en Supabase:', findError);
        return res.status(500).json({
          success: false,
          error: 'Error interno al consultar el producto en la base de datos.'
        });
      }

      if (!currentItem) {
        return res.status(404).json({
          success: false,
          error: 'Artículo no encontrado en el inventario.'
        });
      }

      // 6. Verificar que el SKU no colisione con otro artículo distinto
      if (normalizedSku !== currentItem.sku) {
        const { data: conflictingItem, error: conflictError } = await supabase
          .from('inventory_items')
          .select('id, sku')
          .eq('sku', normalizedSku)
          .neq('id', id)
          .maybeSingle();

        if (conflictError) {
          console.error('Error al verificar unicidad de SKU en Supabase:', conflictError);
          return res.status(500).json({
            success: false,
            error: 'Error interno al validar unicidad del SKU.'
          });
        }

        if (conflictingItem) {
          return res.status(409).json({
            success: false,
            error: `El código SKU "${normalizedSku}" ya pertenece a otro artículo del inventario.`
          });
        }
      }

      let nextImageUrl = currentItem.image_url;
      let uploadedStoragePath = null;

      // 7. Si se subió una nueva imagen PNG, guardarla en Supabase Storage
      if (file) {
        const sanitizedFileName = `${normalizedSku}-${Date.now()}.png`;
        uploadedStoragePath = `products/${sanitizedFileName}`;

        const { error: uploadError } = await supabase.storage
          .from(SUPABASE_BUCKET)
          .upload(uploadedStoragePath, file.buffer, {
            contentType: 'image/png',
            upsert: false
          });

        if (uploadError) {
          console.error('Error al subir nueva imagen a Supabase Storage:', uploadError);
          return res.status(500).json({
            success: false,
            error: `Error al almacenar la nueva imagen en el bucket "${SUPABASE_BUCKET}": ${uploadError.message}`
          });
        }

        const { data: urlData } = supabase.storage
          .from(SUPABASE_BUCKET)
          .getPublicUrl(uploadedStoragePath);

        nextImageUrl = urlData.publicUrl;
      }

      // 8. Actualizar registro en inventory_items
      const { data: updatedItem, error: updateError } = await supabase
        .from('inventory_items')
        .update({
          sku: normalizedSku,
          stock: parsedStock,
          image_url: nextImageUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        console.error('Error al actualizar en BD:', updateError);
        if (uploadedStoragePath) {
          await supabase.storage.from(SUPABASE_BUCKET).remove([uploadedStoragePath]);
        }

        if (updateError.code === '23505') {
          return res.status(409).json({
            success: false,
            error: `El código SKU "${normalizedSku}" ya existe en otro producto.`
          });
        }

        return res.status(500).json({
          success: false,
          error: 'Error al actualizar el producto en la base de datos.'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Artículo actualizado exitosamente en Supabase.',
        data: updatedItem,
        source: 'supabase'
      });
    }

    // ==============================================================================
    // PERSISTENCIA: MODO RESPALDO / DEMO (SIN SUPABASE CONFIGURADO)
    // ==============================================================================
    const itemIndex = inMemoryInventory.findIndex((item) => item.id === id);
    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Artículo no encontrado en el inventario.'
      });
    }

    const skuConflict = inMemoryInventory.some(
      (item, idx) => idx !== itemIndex && item.sku === normalizedSku
    );
    if (skuConflict) {
      return res.status(409).json({
        success: false,
        error: `El código SKU "${normalizedSku}" ya pertenece a otro artículo del inventario.`
      });
    }

    const currentItem = inMemoryInventory[itemIndex];
    const updatedImageUrl = file
      ? `data:image/png;base64,${file.buffer.toString('base64')}`
      : currentItem.image_url;

    const updatedItem = {
      ...currentItem,
      sku: normalizedSku,
      stock: parsedStock,
      image_url: updatedImageUrl,
      updated_at: new Date().toISOString()
    };

    inMemoryInventory[itemIndex] = updatedItem;

    return res.status(200).json({
      success: true,
      message: 'Artículo actualizado exitosamente.',
      data: updatedItem,
      source: 'memory_demo'
    });
  } catch (error) {
    console.error('Error no controlado en updateInventoryItem:', error);
    return res.status(500).json({
      success: false,
      error: 'Ocurrió un error inesperado al actualizar el producto.'
    });
  }
};
