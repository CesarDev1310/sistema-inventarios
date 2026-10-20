import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import inventoryRoutes from './routes/inventoryRoutes.js';
import { isSupabaseConfigured } from './config/supabase.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsear JSON y formularios URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend desde la carpeta public
app.use(express.static(path.join(__dirname, '../public')));

// Ruta de comprobación de salud y estado del sistema
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    timestamp: new Date().toISOString(),
    supabaseConnected: isSupabaseConfigured,
    storageBucket: process.env.SUPABASE_BUCKET || 'inventory-images'
  });
});

// Rutas de la API de Inventario
app.use('/api/inventory', inventoryRoutes);

// Manejo centralizado de errores de Multer y del sistema
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'El archivo excede el tamaño máximo permitido de 5 MB.'
      });
    }
    return res.status(400).json({
      success: false,
      error: `Error al procesar el archivo: ${err.message}`
    });
  }

  if (err && err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  if (err) {
    console.error('Error no capturado:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error interno del servidor.'
    });
  }

  next();
});

// Iniciar servidor únicamente si el archivo se ejecuta directamente
const isDirectRun = process.argv[1] && path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1]);

if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
    console.log(`📦 Estado de Supabase: ${isSupabaseConfigured ? '🟢 Conectado' : '🟡 Modo Local / Demo (Revisar .env)'}`);
    console.log(`====================================================`);
  });
}

export default app;
