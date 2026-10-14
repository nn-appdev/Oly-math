import { Link, useParams } from 'react-router-dom';
import { btnPrimary, btnSecondary, Notice } from '@/components/ui';
import { describeKey, type ItemView } from '@/features/practice/answers';
import { AnswerInput } from '@/features/practice/AnswerInput';
import { usePractice } from '@/features/practice/hooks';
import type { Reveal } from '@/features/practice/types';
import { BackLink } from './common';

const DONE_TEXT: Record<string, string> = {
  target_reached: 'Kamu sudah menyelesaikan satu putaran latihan. Kerja bagus!',
  no_more_items: 'Soal yang tersedia untuk materi ini sudah kamu kerjakan semua.',
  stopped: 'Latihan dihentikan. Kamu bisa melanjutkannya kapan saja.',
};

export function RevealBlock({ item, reveal }: { item: ItemView; reveal: Reveal }) {
  const key = describeKey(item, reveal.answer_key);
  return (
    <section aria-label="Pembahasan" className="flex flex-col gap-2 rounded-card bg-teal-50 p-5">
      {key && <p className="text-lg"><strong>Jawaban yang tepat:</strong> {key}</p>}
      {reveal.explanation && <p className="text-lg leading-relaxed"><strong>Pembahasan:</strong> {reveal.explanation}</p>}
    </section>
  );
}

export function PracticePage() {
  const { nodeId = '' } = useParams();
  const p = usePractice(nodeId);
  const { state } = p;

  if (state.phase === 'loading') return <p role="status" className="text-lg text-ink-soft">Menyiapkan soal…</p>;
  if (state.phase === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <Notice kind="error">{state.message}</Notice>
        <button type="button" className={btnSecondary} onClick={() => void p.reload()}>Coba lagi</button>
        <BackLink to="/siswa/peta">Peta Belajar</BackLink>
      </div>
    );
  }
  if (state.phase === 'done') {
    const s = state.summary;
    return (
      <div className="flex max-w-2xl flex-col gap-5">
        <h1 className="font-display text-4xl font-extrabold">Latihan selesai</h1>
        <p className="text-lg">{DONE_TEXT[state.reason] ?? DONE_TEXT.stopped}</p>
        {s && (
          <ul className="list-disc pl-6 text-lg">
            <li>Soal yang kamu kerjakan: {s.items}</li>
            <li>Benar pada percobaan pertama: {s.first_try_correct}</li>
            <li>Petunjuk yang kamu pakai: {s.hints_used}</li>
          </ul>
        )}
        <p className="text-ink-soft">Ringkasan ini menggambarkan satu sesi latihan, bukan penilaian atas kemampuanmu.</p>
        <div className="flex flex-wrap gap-3">
          <Link to="/siswa/peta" className={`${btnPrimary} inline-flex items-center`}>Kembali ke Peta Belajar</Link>
          <Link to="/siswa/riwayat" className={`${btnSecondary} inline-flex items-center`}>Lihat riwayat</Link>
        </div>
      </div>
    );
  }

  const { item } = state;
  const fb = p.feedback;
  const locked = fb !== null || p.busy;
  const left = p.maxAttempts - p.attemptsUsed;
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <BackLink to="/siswa/peta">Peta Belajar</BackLink>
      <p aria-live="polite" className="font-bold text-ink-soft">Soal selesai: {p.progress.finished} dari {p.progress.target}</p>
      <h1 className="text-2xl font-extrabold leading-snug">{item.statement}</h1>
      {item.instructions && <p className="text-lg text-ink-soft">{item.instructions}</p>}
      {p.answer && <AnswerInput item={item} value={p.answer} onChange={p.setAnswer} disabled={locked} />}

      {p.hintsShown.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label="Petunjuk">
          {p.hintsShown.map((h, i) => <li key={i} className="rounded-xl bg-amber-50 p-3 text-lg"><strong>Petunjuk {i + 1}:</strong> {h}</li>)}
        </ol>
      )}
      {p.notice && <Notice kind="error">{p.notice}</Notice>}

      {fb && (
        <div role="status" className="flex flex-col gap-3">
          <p className={`text-xl font-extrabold ${fb.correct ? 'text-teal-800' : 'text-ink'}`}>
            {fb.correct ? 'Tepat sekali!' : fb.canRetry ? 'Belum tepat. Kamu masih punya satu kesempatan lagi.' : 'Belum berhasil kali ini. Mari belajar dari pembahasannya.'}
          </p>
          {fb.reveal && <RevealBlock item={item} reveal={fb.reveal} />}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {!fb && <button type="button" className={btnPrimary} disabled={p.busy} onClick={() => void p.submit()}>Periksa jawaban</button>}
        {!fb && item.hints_total > p.hintsShown.length && (
          <button type="button" className={btnSecondary} disabled={p.busy} onClick={() => void p.hint()}>Minta petunjuk</button>
        )}
        {fb?.canRetry && <button type="button" className={btnPrimary} onClick={p.retry}>Coba lagi ({left} kesempatan)</button>}
        {fb?.finished && <button type="button" className={btnPrimary} onClick={() => void p.next()}>Soal berikutnya</button>}
        <button type="button" className={btnSecondary} onClick={() => void p.finish()}>Selesai berlatih</button>
      </div>
    </div>
  );
}
