import { describe, expect, it } from 'vitest';
import { isSecretKey, parseEnv } from './env';

function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma-palsu-untuk-uji`;
}

describe('parseEnv', () => {
  const anon = fakeJwt({ role: 'anon' });

  it('menerima konfigurasi yang benar', () => {
    const r = parseEnv({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: anon });
    expect(r.ok).toBe(true);
  });

  it('menolak variabel yang hilang dengan pesan berbahasa Indonesia', () => {
    const r = parseEnv({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.join(' ')).toContain('belum diisi');
  });

  it('menolak URL yang tidak valid', () => {
    const r = parseEnv({ VITE_SUPABASE_URL: 'bukan-url', VITE_SUPABASE_ANON_KEY: anon });
    expect(r.ok).toBe(false);
  });

  it('menolak kunci service_role pada klien', () => {
    const r = parseEnv({
      VITE_SUPABASE_URL: 'https://abc.supabase.co',
      VITE_SUPABASE_ANON_KEY: fakeJwt({ role: 'service_role' }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]).toContain('service_role');
  });
});

describe('isSecretKey', () => {
  it('mengenali kunci rahasia format baru', () => {
    expect(isSecretKey('sb_secret_abcdefghijklmnopqrstuvwxyz')).toBe(true);
  });
  it('tidak menganggap kunci anon sebagai rahasia', () => {
    expect(isSecretKey(fakeJwt({ role: 'anon' }))).toBe(false);
    expect(isSecretKey('sb_publishable_abcdefghijklmnop')).toBe(false);
  });
  it('tidak gagal pada masukan yang bukan JWT', () => {
    expect(isSecretKey('bukan.jwt')).toBe(false);
    expect(isSecretKey('a.%%%.c')).toBe(false);
  });
});
