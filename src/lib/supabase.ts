import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { envResult } from './env';

/**
 * Klien Supabase untuk browser. Hanya memakai kunci anon; seluruh pembatasan akses
 * ditegakkan oleh Row Level Security di database (lihat supabase/migrations).
 * Bernilai null jika konfigurasi lingkungan belum lengkap.
 */
export const supabase: SupabaseClient | null = envResult.ok
  ? createClient(envResult.env.VITE_SUPABASE_URL, envResult.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null;
