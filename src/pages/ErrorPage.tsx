import { useContext } from 'react';
import { AuthContext } from '@/features/auth/AuthContext';

export function ErrorPage({ message }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ground p-6 font-body text-ink">
      <div className="max-w-md rounded-card border border-line bg-white p-8 text-center">
        <h1 className="font-display text-3xl font-extrabold">Ups, ada yang tidak berjalan</h1>
        <p className="mt-3 text-lg text-ink-soft">
          {message ?? 'Halaman ini belum bisa dibuka. Coba muat ulang, ya.'}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[52px] rounded-2xl bg-teal-600 px-6 font-extrabold text-white hover:bg-teal-800"
          >
            Muat ulang
          </button>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

function SignOutButton() {
  const auth = useOptionalAuth();
  if (!auth) return null;
  return (
    <button
      type="button"
      onClick={() => void auth.signOut().then(() => window.location.assign('/masuk'))}
      className="min-h-[52px] rounded-2xl border-2 border-teal-600 bg-white px-6 font-bold text-teal-800 hover:bg-teal-50"
    >
      Keluar
    </button>
  );
}

function useOptionalAuth() {
  // null bila dirender di luar AuthProvider (mis. oleh ErrorBoundary)
  return useContext(AuthContext);
}
