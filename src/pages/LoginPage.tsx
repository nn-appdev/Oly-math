import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { homePathFor } from '@/features/auth/roles';
import { validateLogin, type LoginFieldErrors } from '@/features/auth/schemas';
import { Logo } from '@/components/Logo';

export function LoginPage() {
  const { status, profile, signIn, error: authError } = useAuth();
  const location = useLocation();
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false); // mencegah submit ganda sebelum state sempat diperbarui

  if (status === 'ready' && profile) {
    const from = (location.state as { from?: string } | null)?.from;
    const target = from && from.startsWith(homePathFor(profile.role)) ? from : homePathFor(profile.role);
    return <Navigate to={target} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;

    const form = new FormData(event.currentTarget);
    const result = validateLogin({ email: form.get('email'), password: form.get('password') });
    if (!result.ok) {
      setFieldErrors(result.errors);
      setFormError(null);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    submittingRef.current = true;
    setSubmitting(true);
    const outcome = await signIn(result.data.email, result.data.password);
    submittingRef.current = false;
    setSubmitting(false);
    if (!outcome.ok) setFormError(outcome.message);
  }

  const shownError = formError ?? authError;

  return (
    <div className="flex min-h-screen flex-col bg-ground font-body text-ink lg:flex-row">
      <section
        aria-hidden="true"
        className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-teal-800 p-12 text-white lg:flex"
      >
        <Logo light />
        <div className="max-w-md">
          <p className="font-display text-5xl font-extrabold leading-[1.08] tracking-tight">
            Berpikir hebat dimulai dari soal yang menantang.
          </p>
          <p className="mt-5 text-lg leading-relaxed text-teal-100">
            Akademi penalaran matematika untuk siswa kelas 1, 2, dan 3 SD.
          </p>
        </div>
        <svg width="320" height="320" viewBox="0 0 260 260" className="absolute -bottom-16 -right-16 opacity-90">
          <circle cx="130" cy="130" r="120" fill="#0B6B63" />
          <g fill="#F2B134">
            <circle cx="95" cy="105" r="11" />
            <circle cx="130" cy="105" r="11" />
            <circle cx="165" cy="105" r="11" />
            <circle cx="95" cy="140" r="11" />
            <circle cx="130" cy="140" r="11" />
          </g>
        </svg>
      </section>

      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-ink">Selamat datang</h1>
          <p className="mt-2 text-lg text-ink-soft">Masuk untuk melanjutkan petualangan belajarmu.</p>

          <form noValidate onSubmit={(e) => void onSubmit(e)} className="mt-8 flex flex-col gap-5">
            {shownError && (
              <div role="alert" className="rounded-2xl bg-sky-100 px-4 py-3 font-semibold text-sky-800">
                {shownError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-extrabold text-ink-soft">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                inputMode="email"
                aria-invalid={fieldErrors.email ? true : undefined}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                className="min-h-[52px] rounded-2xl border-2 border-[#CFDCD7] bg-white px-4 text-lg focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-100"
              />
              {fieldErrors.email && (
                <p id="email-error" className="text-sm font-semibold text-coral-800">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="text-sm font-extrabold text-ink-soft">
                Kata sandi
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                className="min-h-[52px] rounded-2xl border-2 border-[#CFDCD7] bg-white px-4 text-lg focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-100"
              />
              {fieldErrors.password && (
                <p id="password-error" className="text-sm font-semibold text-coral-800">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="min-h-[56px] rounded-2xl bg-teal-600 px-6 text-lg font-extrabold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-[#DCE5E2] disabled:text-[#51665F]"
            >
              {submitting ? 'Sedang masuk…' : 'Masuk'}
            </button>
          </form>

          <p className="mt-6 text-sm text-ink-soft">
            Belum punya akun? Akun dibuat oleh gurumu atau admin sekolah.
          </p>
        </div>
      </main>
    </div>
  );
}
