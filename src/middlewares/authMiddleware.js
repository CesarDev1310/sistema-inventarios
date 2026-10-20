import { verifyToken, parseCookies, AUTH_COOKIE_NAME } from '../utils/security.js';

// Almacén en memoria para protección contra ataques de fuerza bruta en login
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Obtiene la clave de rastreo de intentos de login por IP + usuario
 */
const getAttemptKey = (req) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown-ip';
  const username = String(req.body?.username || '').trim().toLowerCase();
  return `${ip}:${username}`;
};

/**
 * Middleware de cabeceras de seguridad HTTP (Defensa en profundidad)
 */
export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https:;"
  );
  next();
};

/**
 * Middleware Rate Limiter para proteger el endpoint de Login contra fuerza bruta
 */
export const loginRateLimiter = (req, res, next) => {
  const key = getAttemptKey(req);
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (record) {
    if (now - record.firstAttemptAt > LOCKOUT_WINDOW_MS) {
      loginAttempts.delete(key);
    } else if (record.count >= MAX_LOGIN_ATTEMPTS) {
      const retryAfterSeconds = Math.ceil((LOCKOUT_WINDOW_MS - (now - record.firstAttemptAt)) / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: `Demasiados intentos fallidos de inicio de sesión. Intenta nuevamente en ${Math.ceil(retryAfterSeconds / 60)} minutos.`
      });
    }
  }

  next();
};

/**
 * Registra un intento fallido de autenticación
 */
export const recordFailedLoginAttempt = (req) => {
  const key = getAttemptKey(req);
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record || now - record.firstAttemptAt > LOCKOUT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: now });
  } else {
    record.count += 1;
    loginAttempts.set(key, record);
  }
};

/**
 * Limpia el historial de intentos fallidos tras un login exitoso
 */
export const clearLoginAttempts = (req) => {
  const key = getAttemptKey(req);
  loginAttempts.delete(key);
};

/**
 * Middleware para verificar que la petición tenga una sesión autenticada válida
 * Extrae el token desde Authorization: Bearer <token> o Cookie HttpOnly
 */
export const authenticateToken = (req, res, next) => {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token && req.headers.cookie) {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies[AUTH_COOKIE_NAME] || null;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No autenticado. Debes iniciar sesión para acceder a este recurso.'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({
      success: false,
      error: 'Tu sesión ha expirado o el token es inválido. Inicia sesión nuevamente.'
    });
  }

  req.user = {
    id: decoded.sub,
    username: decoded.username,
    role: decoded.role,
    full_name: decoded.full_name
  };

  next();
};

/**
 * Middleware RBAC para autorizar únicamente a roles específicos (ej. 'admin')
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Acceso denegado. Tu perfil (${req.user.role === 'viewer' ? 'Usuario de Consulta' : req.user.role}) solo tiene permisos de visualización.`
      });
    }

    next();
  };
};
