import { Link, useParams } from 'react-router-dom';
import { AnswerInput } from '@/features/practice/AnswerInput';
import { fromResponse } from '@/features/practice/answers';
import { useHistory, useReview } from '@/features/practice/hooks';
import { Async, BackLink, formatDate } from './common';
import { RevealBlock } from './PracticePage';

export function HistoryPage() {
  const [state, reload] = useHistory();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Riwayat Latihan</h1>
      <Async state={state} reload={reload}>
        {(rows) => rows.length === 0
          ? <p className="text-lg text-ink-soft">Belum ada latihan. Mulailah dari Peta Belajar.</p>
          : (
            <ul className="flex flex-col gap-3">
              {rows.map((r) => (
                <li key={r.attempt_id} className="rounded-card border border-line bg-white p-5">
                  <p className="text-sm font-bold text-ink-soft">{formatDate(r.created_at)} · {r.node_code} {r.node_title}</p>
                  <p className="mt-1 text-lg">{r.statement}</p>
                  <p className="mt-1 font-bold">
                    {r.correct ? 'Jawabanmu tepat' : 'Belum tepat'} · percobaan ke-{r.attempt_no}{r.hints_used > 0 ? ` · ${r.hints_used} petunjuk` : ''}
                  </p>
                  {r.reviewable && (
                    <Link to={`/siswa/riwayat/${r.attempt_id}`} className="mt-2 inline-flex min-h-[44px] items-center font-bold text-teal-800 underline">Lihat pembahasan</Link>
                  )}
                </li>
              ))}
            </ul>
          )}
      </Async>
    </div>
  );
}

export function ReviewPage() {
  const { attemptId = '' } = useParams();
  const [state, reload] = useReview(attemptId);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <BackLink to="/siswa/riwayat">Riwayat</BackLink>
      <Async state={state} reload={reload}>
        {(r) => {
          const mine = fromResponse(r.item, r.my_response);
          return (
            <>
              <h1 className="text-2xl font-extrabold leading-snug">{r.item.statement}</h1>
              {mine && <div><p className="mb-2 font-bold">Jawabanmu</p><AnswerInput item={r.item} value={mine} onChange={() => undefined} disabled /></div>}
              <p className="text-xl font-extrabold">{r.correct ? 'Jawabanmu tepat.' : 'Jawabanmu belum tepat.'}</p>
              <RevealBlock item={r.item} reveal={r.reveal} />
            </>
          );
        }}
      </Async>
    </div>
  );
}
