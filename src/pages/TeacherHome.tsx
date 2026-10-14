import { useAuth } from '@/features/auth/AuthContext';
import { useClasses } from '@/features/classes/useClasses';

export function TeacherHome() {
  const { profile } = useAuth();
  const state = useClasses();

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Dashboard Pembinaan</h1>
        <p className="mt-2 text-lg text-ink-soft">
          {profile?.full_name ? `Selamat datang, ${profile.full_name}.` : 'Selamat datang.'} Ringkasan kelas binaan
          Anda.
        </p>
      </header>

      <section aria-labelledby="kelas" className="rounded-card border border-line bg-white p-8">
        <h2 id="kelas" className="font-display text-2xl font-extrabold">
          Kelas binaan
        </h2>

        {state.status === 'loading' && (
          <p role="status" className="mt-4 text-ink-soft">
            Memuat kelas…
          </p>
        )}
        {state.status === 'error' && (
          <p role="alert" className="mt-4 rounded-2xl bg-sky-100 px-4 py-3 font-semibold text-sky-800">
            {state.message}
          </p>
        )}
        {state.status === 'ready' && state.classes.length === 0 && (
          <p className="mt-4 max-w-2xl text-lg text-ink-soft">
            Belum ada kelas binaan. Kelas dan keanggotaan siswa diatur bersama admin sekolah. Setelah ada siswa,
            perkembangan mereka tampil di sini.
          </p>
        )}
        {state.status === 'ready' && state.classes.length > 0 && (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.classes.map((c) => (
              <li key={c.id} className="rounded-2xl bg-ground p-5">
                <p className="font-display text-xl font-extrabold">{c.name}</p>
                <p className="mt-1 text-ink-soft">
                  Kelas {c.grade} · {c.memberCount} siswa
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
