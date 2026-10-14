import { describe, expect, it } from 'vitest';
import { canAccess, homePathFor, profileSchema } from './roles';

describe('canAccess', () => {
  it('mengizinkan peran yang terdaftar', () => {
    expect(canAccess('teacher', ['teacher', 'admin'])).toBe(true);
  });
  it('menolak peran yang tidak terdaftar', () => {
    expect(canAccess('student', ['teacher', 'admin'])).toBe(false);
  });
  it('menolak pengguna tanpa peran', () => {
    expect(canAccess(null, ['student', 'teacher', 'admin'])).toBe(false);
  });
});

describe('homePathFor', () => {
  it('memberi beranda per peran', () => {
    expect(homePathFor('student')).toBe('/siswa');
    expect(homePathFor('teacher')).toBe('/guru');
    expect(homePathFor('admin')).toBe('/admin');
  });
});

describe('profileSchema', () => {
  const base = { id: '11111111-1111-4111-8111-111111111111', full_name: 'A', role: 'student', grade: 2, is_active: true };
  it('menerima profil yang benar', () => {
    expect(profileSchema.safeParse(base).success).toBe(true);
  });
  it('menolak peran yang tidak dikenal', () => {
    expect(profileSchema.safeParse({ ...base, role: 'superuser' }).success).toBe(false);
  });
  it('menolak kelas di luar 1–3', () => {
    expect(profileSchema.safeParse({ ...base, grade: 4 }).success).toBe(false);
  });
});
