import { Router } from 'express';
import { loginUser, logoutUser, getCurrentUser } from '../controllers/authController.js';
import { loginRateLimiter, authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

// POST /api/auth/login - Autenticación con protección contra fuerza bruta
router.post('/login', loginRateLimiter, loginUser);

// POST /api/auth/logout - Cerrar sesión
router.post('/logout', logoutUser);

// GET /api/auth/me - Verificar sesión activa y rol actual
router.get('/me', authenticateToken, getCurrentUser);

export default router;
