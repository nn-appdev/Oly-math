import { Link, useParams } from 'react-router-dom';
import { btnPrimary } from '@/components/ui';
import { useLearningMap, useMaterial } from '@/features/practice/hooks';
import { Async, BackLink } from './common';

export function MaterialPage() {
  const { nodeId = '' } = useParams();
  const [state, reload] = useMaterial(nodeId);
  const [map] = useLearningMap();
  const available = map.status === 'ready' ? map.data.nodes.find((n) => n.id === nodeId)?.available === true : false;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink to="/siswa/peta">Peta Belajar</BackLink>
      <Async state={state} reload={reload}>
        {(m) => (
          <>
            <header>
              <p className="text-sm font-bold text-ink-soft">{m.code}</p>
              <h1 className="font-display text-4xl font-extrabold tracking-tight">{m.title}</h1>
            </header>
            {m.objectives && (
              <section aria-labelledby="tujuan" className="rounded-card bg-teal-50 p-5">
                <h2 id="tujuan" className="text-lg font-extrabold">Yang akan kamu pelajari</h2>
                <p className="mt-1 text-lg">{m.objectives}</p>
              </section>
            )}
            <section aria-labelledby="penjelasan" className="flex flex-col gap-3">
              <h2 id="penjelasan" className="font-display text-2xl font-extrabold">Penjelasan</h2>
              {m.concept_text.trim() === ''
                ? <p className="text-lg text-ink-soft">Penjelasan materi ini belum tersedia.</p>
                : m.concept_text.split(/\n{2,}/).map((p, i) => <p key={i} className="text-lg leading-relaxed">{p}</p>)}
            </section>
            {available
              ? <Link to={`/siswa/latihan/${m.id}`} className={`${btnPrimary} inline-flex w-fit items-center`}>Mulai latihan</Link>
              : <p className="text-lg text-ink-soft">Soal latihan untuk materi ini belum tersedia.</p>}
          </>
        )}
      </Async>
    </div>
  );
}
