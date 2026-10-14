import { z } from 'zod';

export const USER_ROLES = ['student', 'teacher', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABEL: Record<UserRole, string> = {
  student: 'Siswa',
  teacher: 'Guru',
  admin: 'Admin',
};

export const ROLE_HOME: Record<UserRole, string> = {
  student: '/siswa',
  teacher: '/guru',
  admin: '/admin',
};

export function homePathFor(role: UserRole): string {
  return ROLE_HOME[role];
}

/**
 * Pemeriksaan di klien hanya untuk pengalaman pengguna (menyembunyikan halaman).
 * Penegakan akses yang sebenarnya dilakukan oleh RLS di database.
 */
export function canAccess(role: UserRole | null, allowed: readonly UserRole[]): boolean {
  return role !== null && allowed.includes(role);
}

export const profileSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  role: z.enum(USER_ROLES),
  grade: z.number().int().min(1).max(3).nullable(),
  is_active: z.boolean(),
});

export type Profile = z.infer<typeof profileSchema>;
