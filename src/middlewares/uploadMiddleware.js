import multer from 'multer';
import path from 'path';

// Almacenamiento en memoria para subir directamente a Supabase Storage
const storage = multer.memoryStorage();

// Filtro estricto para archivos PNG
const fileFilter = (req, file, cb) => {
  const isMimePng = file.mimetype === 'image/png';
  const isExtPng = path.extname(file.originalname).toLowerCase() === '.png';

  if (isMimePng && isExtPng) {
    return cb(null, true);
  }

  const error = new Error('Formato de imagen inválido. Solo se admiten archivos PNG (.png).');
  error.code = 'INVALID_FILE_TYPE';
  return cb(error, false);
};

// Límite de 5 MB
const limits = {
  fileSize: 5 * 1024 * 1024 // 5 Megabytes
};

export const uploadSingleImage = multer({
  storage,
  fileFilter,
  limits
}).single('image');

// Validador de Magic Bytes para verificación profunda de integridad de archivo PNG
export const validatePngMagicBytes = (buffer) => {
  if (!buffer || buffer.length < 8) return false;
  // Encabezado estándar PNG: 89 50 4E 47 0D 0A 1A 0A
  const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== pngHeader[i]) {
      return false;
    }
  }
  return true;
};
