import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { getInitialSeedUsers } from '../config/seedData.js';
import { verifyPassword, signToken, AUTH_COOKIE_NAME } from '../utils/security.js';
import { recordFailedLoginAttempt, clearLoginAttempts } from '../middlewares/authMiddleware.js';

// Almacén de usuarios en memoria (incluye hashes scrypt de admin y consulta)
const inMemoryUsers = getInitialSeedUsers();

export const isValidUsername = (username) => {
  const usernameRegex = /^[a-z0-9._-]{3,50}$/;
  return typeof username === 'string' && usernameRegex.test(username);
};

/**
 * POST /api/auth/login
 * Autentica al usuario y emite token firmado + cookie HttpOnly
 */
export const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Debes ingresar tu nombre de usuario y contraseña.'
      });
    }

    const normalizedUsername = String(username).trim().toLowerCase();
    const rawPassword = String(password);

    if (!isValidUsername(normalizedUsername) || rawPassword.length < 4 || rawPassword.length > 128) {
      recordFailedLoginAttempt(req);
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas. Verifica tu usuario y contraseña.'
      });
    }

    let userRecord = null;

    // 1. Buscar en Supabase si está configurado
    if (isSupabaseConfigured && supabase) {
      const { data: dbUser, error: dbError } = await supabase
        .from('app_users')
        .select('*')
        .eq('username', normalizedUsername)
        .maybeSingle();

      if (!dbError && dbUser) {
        userRecord = dbUser;
      }
    }

    // 2. Respaldo en memoria local si no se encontró en Supabase o está en modo Demo
    if (!userRecord) {
      userRecord = inMemoryUsers.find((u) => u.username === normalizedUsername) || null;
    }

    if (!userRecord || !verifyPassword(rawPassword, userRecord.password_hash)) {
      recordFailedLoginAttempt(req);
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas. Verifica tu usuario y contraseña.'
      });
    }

    if (userRecord.is_active === false) {
      return res.status(403).json({
        success: false,
        error: 'Esta cuenta de usuario se encuentra deshabilitada.'
      });
    }

    // Limpiar contador de intentos fallidos tras éxito
    clearLoginAttempts(req);

    const maxAgeSeconds = 8 * 3600; // 8 horas
    const token = signToken(
      {
        sub: userRecord.id,
        username: userRecord.username,
        role: userRecord.role,
        full_name: userRecord.full_name
      },
      maxAgeSeconds
    );

    // Configurar Cookie HttpOnly con protección SameSite=Strict
    res.setHeader(
      'Set-Cookie',
      `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Strict`
    );

    return res.status(200).json({
      success: true,
      message: `Bienvenido, ${userRecord.full_name}.`,
      token,
      user: {
        id: userRecord.id,
        username: userRecord.username,
        role: userRecord.role,
        full_name: userRecord.full_name
      }
    });
  } catch (error) {
    console.error('Error en loginUser:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al procesar el inicio de sesión.'
    });
  }
};

/**
 * POST /api/auth/logout
 * Cierra la sesión limpiando la cookie HttpOnly
 */
export const logoutUser = (req, res) => {
  res.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`
  );

  return res.status(200).json({
    success: true,
    message: 'Sesión cerrada correctamente.'
  });
};

/**
 * GET /api/auth/me
 * Retorna los datos del usuario autenticado actualmente
 */
export const getCurrentUser = (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
};
