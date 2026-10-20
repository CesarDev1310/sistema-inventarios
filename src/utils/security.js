import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Secreto criptográfico para firma HMAC-SHA256 de tokens de sesión
const JWT_SECRET =
  process.env.JWT_SECRET ||
  crypto.createHash('sha256').update(`proy02-inventory-secret-${process.env.SUPABASE_KEY || 'local-dev-key'}`).digest('hex');

export const AUTH_COOKIE_NAME = 'inventory_token';

/**
 * Codifica un Buffer o string en Base64URL
 */
const toBase64Url = (input) => {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(String(input), 'utf8');
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

/**
 * Decodifica un string Base64URL a UTF-8
 */
const fromBase64Url = (base64Url) => {
  let base64 = String(base64Url).replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
};

/**
 * Genera un hash seguro de contraseña usando scrypt nativo de Node.js
 * Formato almacenado: <salt_hex>:<derived_key_hex>
 */
export const hashPassword = (password, customSaltHex = null) => {
  const salt = customSaltHex
    ? Buffer.from(customSaltHex, 'hex')
    : crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(String(password), salt, 64);
  return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
};

/**
 * Verifica una contraseña contra su hash almacenado en tiempo constante (previene timing attacks)
 */
export const verifyPassword = (password, storedHash) => {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;

  const [saltHex, keyHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const storedKeyBuffer = Buffer.from(keyHex, 'hex');
  const derivedKeyBuffer = crypto.scryptSync(String(password), salt, 64);

  if (storedKeyBuffer.length !== derivedKeyBuffer.length) return false;
  return crypto.timingSafeEqual(storedKeyBuffer, derivedKeyBuffer);
};

/**
 * Firma un token estilo JWT (HS256) sin librerías externas
 */
export const signToken = (payload, expiresInSeconds = 8 * 3600) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signingInput)
    .digest();

  return `${signingInput}.${toBase64Url(signature)}`;
};

/**
 * Verifica la firma criptográfica y vigencia de un token HS256
 */
export const verifyToken = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = toBase64Url(
    crypto.createHmac('sha256', JWT_SECRET).update(signingInput).digest()
  );

  const sigBuffer = Buffer.from(encodedSignature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < nowSeconds) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

/**
 * Parsea la cabecera Cookie de una petición HTTP
 */
export const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;

  cookieHeader.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx > -1) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  return cookies;
};
