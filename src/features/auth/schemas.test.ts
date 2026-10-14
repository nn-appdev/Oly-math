import { describe, expect, it } from 'vitest';
import { validateLogin } from './schemas';

describe('validateLogin', () => {
  it('menerima masukan benar dan memangkas spasi email', () => {
    const r = validateLogin({ email: '  budi@sekolah.id ', password: 'rahasia' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.email).toBe('budi@sekolah.id');
  });
  it('menolak email kosong dan kata sandi kosong', () => {
    const r = validateLogin({ email: '', password: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.email).toBe('Email wajib diisi.');
      expect(r.errors.password).toBe('Kata sandi wajib diisi.');
    }
  });
  it('menolak penulisan email yang salah', () => {
    const r = validateLogin({ email: 'budi', password: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.email).toBe('Penulisan email belum benar.');
  });
  it('menangani nilai null dari formulir', () => {
    expect(validateLogin({ email: null, password: null }).ok).toBe(false);
  });
});
