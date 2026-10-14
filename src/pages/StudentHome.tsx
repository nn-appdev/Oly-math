import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { useLearningMap } from '@/features/practice/hooks';
import { Async } from './student/common';

export function StudentHome() {
  const { profile } = useAuth();
  const name = profile?.full_name.trim() || 'Teman Matematika';
  const [map, reload] = useLearningMap();

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="sapaan" className="rounded-[28px] bg-teal-800 p-8 text-white md:p-10">
        <p className="text-sm font-bold uppercase tracking-wider text-teal-100">Selamat datang</p>
        <h1 id="sapaan" className="mt-2 font-display text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">Halo, {name}!</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-teal-100">
          {profile?.grade ? `Kamu terdaftar di kelas ${profile.grade}. Yuk, belajar dan berlatih matematika.` : 'Kelasmu belum ditetapkan. Minta gurumu atau admin untuk mengaturnya, ya.'}
        </p>
        <Link to="/siswa/peta" className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-white px-5 font-extrabold text-teal-800">Buka Peta Belajar</Link>
      </section>

      <section aria-labelledby="lanjut" className="rounded-card border border-line bg-white p-8">
        <h2 id="lanjut" className="font-display text-2xl font-extrabold">Lanjutkan belajar</h2>
        <Async state={map} reload={reload}>
          {(m) => {
            const recent = m.nodes.filter((n) => n.last_practiced_at).sort((a, b) => (b.last_practiced_at ?? '').localeCompare(a.last_practiced_at ?? '')).slice(0, 3);
            if (recent.length === 0) return <p className="mt-2 text-lg text-ink-soft">Kamu belum berlatih. Pilih materi pertamamu di Peta Belajar.</p>;
            return (
              <ul className="mt-3 flex flex-col gap-2">
                {recent.map((n) => (
                  <li key={n.id}><Link to={`/siswa/materi/${n.id}`} className="inline-flex min-h-[44px] items-center text-lg font-bold text-teal-800 underline">{n.title}</Link></li>
                ))}
              </ul>
            );
          }}
        </Async>
      </section>
    </div>
  );
}
