import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'inventory-images';

const isTestEnv = process.env.NODE_ENV === 'test';

export const isSupabaseConfigured = Boolean(
  !isTestEnv &&
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('tu-proyecto')
);

let supabaseClient = null;

if (isSupabaseConfigured) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
    console.log('✅ Cliente Supabase inicializado correctamente.');
  } catch (error) {
    console.error('❌ Error al inicializar cliente Supabase:', error.message);
  }
} else {
  console.warn(
    '⚠️ ADVERTENCIA: Supabase no está configurado o tiene valores por defecto en .env.\n' +
    '   La aplicación se ejecutará en modo demostración/memoria hasta que agregues tus credenciales en el archivo .env.'
  );
}

export const supabase = supabaseClient;
