import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string({ required_error: 'VITE_SUPABASE_URL belum diisi' })
    .url('VITE_SUPABASE_URL harus berupa URL yang valid'),
  VITE_SUPABASE_ANON_KEY: z
    .string({ required_error: 'VITE_SUPABASE_ANON_KEY belum diisi' })
    .min(20, 'VITE_SUPABASE_ANON_KEY tampak tidak valid'),
});

export type Env = z.infer<typeof envSchema>;

export type EnvResult = { ok: true; env: Env } | { ok: false; issues: string[] };

/** Memeriksa apakah kunci adalah kunci rahasia/service_role yang tidak boleh ada di klien. */
export function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  const payload = parts[1];
  if (parts.length !== 3 || !payload) return false;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json: unknown = JSON.parse(atob(padded));
    return typeof json === 'object' && json !== null && (json as { role?: unknown }).role === 'service_role';
  } catch {
    return false;
  }
}

export function parseEnv(raw: Record<string, unknown>): EnvResult {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => i.message) };
  }
  if (isSecretKey(parsed.data.VITE_SUPABASE_ANON_KEY)) {
    return {
      ok: false,
      issues: [
        'Kunci yang diisi adalah kunci rahasia (service_role). Gunakan HANYA kunci anon/publik pada aplikasi klien.',
      ],
    };
  }
  return { ok: true, env: parsed.data };
}

export const envResult: EnvResult = parseEnv(import.meta.env as Record<string, unknown>);
