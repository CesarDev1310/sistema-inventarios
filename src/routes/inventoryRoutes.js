import { Router } from 'express';
import { uploadSingleImage } from '../middlewares/uploadMiddleware.js';
import {
  registerInventoryItem,
  getInventoryItems,
  updateInventoryItem
} from '../controllers/inventoryController.js';

const router = Router();

// GET /api/inventory - Obtener lista de inventario
router.get('/', getInventoryItems);

// POST /api/inventory - Registrar nuevo artículo (procesa SKU, Stock e Imagen PNG)
router.post('/', uploadSingleImage, registerInventoryItem);

// PUT /api/inventory/:id - Editar un artículo existente (SKU, Stock e Imagen PNG opcional)
router.put('/:id', uploadSingleImage, updateInventoryItem);

export default router;
