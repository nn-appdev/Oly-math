import { Link } from 'react-router-dom';
import { DOMAINS, DOMAIN_LABEL } from '@/features/questions/model';
import { useLearningMap } from '@/features/practice/hooks';
import type { MapNode } from '@/features/practice/types';
import { Async } from './common';

/** Keterangan netral tentang aktivitas; bukan penilaian atas siswa dan bukan penetapan penguasaan. */
export function activityLabel(n: MapNode): string {
  if (!n.available) return 'Soal belum tersedia';
  if (n.attempted_items === 0) return `${n.question_count} soal tersedia`;
  return `Kamu sudah mencoba ${n.attempted_items} soal`;
}

export function LearningMapPage() {
  const [state, reload] = useLearningMap();
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Peta Belajar</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-soft">Pilih materi yang ingin kamu pelajari. Baca penjelasannya dahulu, lalu berlatih.</p>
      </header>
      <Async state={state} reload={reload}>
        {(map) => (
          <>
            {map.grade === null && <p className="rounded-xl bg-amber-50 p-4 text-lg">Kelasmu belum ditetapkan, sehingga semua materi ditampilkan.</p>}
            {DOMAINS.map((d) => {
              const nodes = map.nodes.filter((n) => n.domain === d);
              if (nodes.length === 0) return null;
              return (
                <section key={d} aria-labelledby={`dom-${d}`} className="flex flex-col gap-3">
                  <h2 id={`dom-${d}`} className="font-display text-2xl font-extrabold">{DOMAIN_LABEL[d]}</h2>
                  <ul className="grid gap-3 md:grid-cols-2">
                    {nodes.map((n) => (
                      <li key={n.id} className="rounded-card border border-line bg-white p-5">
                        <p className="text-sm font-bold text-ink-soft">{n.code} · Kelas {n.grade_min === n.grade_max ? n.grade_min : `${n.grade_min}–${n.grade_max}`}</p>
                        <h3 className="mt-1 text-xl font-extrabold">{n.title}</h3>
                        <p className="mt-1 text-ink-soft">{activityLabel(n)}</p>
                        <Link to={`/siswa/materi/${n.id}`} className="mt-3 inline-flex min-h-[44px] items-center rounded-xl border-2 border-teal-600 px-4 font-bold text-teal-800 hover:bg-teal-50">
                          Buka materi<span className="sr-only">: {n.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </>
        )}
      </Async>
    </div>
  );
}
