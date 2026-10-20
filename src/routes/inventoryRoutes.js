import { Router } from 'express';
import { uploadSingleImage } from '../middlewares/uploadMiddleware.js';
import { registerInventoryItem, getInventoryItems } from '../controllers/inventoryController.js';

const router = Router();

// GET /api/inventory - Obtener lista de inventario
router.get('/', getInventoryItems);

// POST /api/inventory - Registrar nuevo artículo (procesa SKU, Stock e Imagen PNG)
router.post('/', uploadSingleImage, registerInventoryItem);

export default router;
