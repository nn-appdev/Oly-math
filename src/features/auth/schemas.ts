import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email wajib diisi.')
    .email('Penulisan email belum benar.')
    .max(254, 'Email terlalu panjang.'),
  password: z.string().min(1, 'Kata sandi wajib diisi.').max(200, 'Kata sandi terlalu panjang.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export type LoginFieldErrors = Partial<Record<keyof LoginInput, string>>;

export function validateLogin(
  raw: unknown,
): { ok: true; data: LoginInput } | { ok: false; errors: LoginFieldErrors } {
  const parsed = loginSchema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const errors: LoginFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if ((key === 'email' || key === 'password') && !errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}
