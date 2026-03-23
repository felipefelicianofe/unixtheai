// Supabase client — uses the real anon key (JWT) from environment
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '🚨 [Supabase Client] ERRO CRÍTICO: Variáveis de ambiente não configuradas!\n' +
    `   VITE_SUPABASE_URL: ${SUPABASE_URL ? '✅' : '❌ AUSENTE'}\n` +
    `   VITE_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY ? '✅' : '❌ AUSENTE'}\n` +
    '   → Configure em: Vercel Dashboard > Settings > Environment Variables'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});