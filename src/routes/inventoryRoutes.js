import { Router } from 'express';
import { uploadSingleImage } from '../middlewares/uploadMiddleware.js';
import { authenticateToken, authorizeRoles } from '../middlewares/authMiddleware.js';
import {
  registerInventoryItem,
  getInventoryItems,
  updateInventoryItem
} from '../controllers/inventoryController.js';

const router = Router();

// GET /api/inventory - Obtener lista de inventario (Accesible para 'admin' y 'viewer')
router.get('/', authenticateToken, getInventoryItems);

// POST /api/inventory - Registrar nuevo artículo (Exclusivo rol 'admin')
router.post('/', authenticateToken, authorizeRoles('admin'), uploadSingleImage, registerInventoryItem);

// PUT /api/inventory/:id - Editar un artículo existente (Exclusivo rol 'admin')
router.put('/:id', authenticateToken, authorizeRoles('admin'), uploadSingleImage, updateInventoryItem);

export default router;
