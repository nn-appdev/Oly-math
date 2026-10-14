import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Notice, PageHeader, StatusBadge } from '@/components/ui';
import { useBank } from '@/features/questions/hooks';

export function ReviewQueuePage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [bank] = useBank();
  const inReview = bank.status === 'ready' ? bank.data.filter((r) => r.status === 'review') : [];
  const toReview = inReview.filter((r) => !r.validated && r.created_by !== profile?.id);
  const toPublish = inReview.filter((r) => r.validated);
  const mineWaiting = inReview.filter((r) => !r.validated && r.created_by === profile?.id);

  function List({ title, rows, empty }: { title: string; rows: typeof inReview; empty: string }) {
    return (
      <section className="rounded-card border border-line bg-white p-6" aria-label={title}>
        <h2 className="font-display text-2xl font-extrabold">{title}</h2>
        {rows.length === 0 ? <p className="mt-3 text-ink-soft">{empty}</p> : (
          <ul className="mt-3 flex flex-col gap-3">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ground px-4 py-3">
                <div className="min-w-0">
                  <Link to={`/guru/soal/${r.id}`} className="font-extrabold text-teal-800 underline">{r.code}</Link>
                  <span className="ml-2 text-sm text-ink-soft">{r.node_code} · oleh {r.created_by_name ?? 'tanpa nama'}{r.validated ? ` · disetujui ${r.reviewer_name ?? ''}` : ''}</span>
                  <p className="line-clamp-2">{r.statement}</p>
                </div>
                <StatusBadge status={r.status} validated={r.validated} />
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Antrean telaah">
        Telaah dilakukan oleh guru atau admin selain pembuat soal. Penerbitan dilakukan admin setelah soal disetujui.
      </PageHeader>
      {bank.status === 'error' && <Notice kind="error">{bank.message}</Notice>}
      {bank.status === 'loading' && <p role="status" className="text-ink-soft">Memuat antrean…</p>}
      {bank.status === 'ready' && (
        <>
          <List title="Menunggu telaah Anda" rows={toReview} empty="Tidak ada soal yang perlu Anda telaah." />
          {isAdmin && <List title="Siap diterbitkan (sudah disetujui)" rows={toPublish} empty="Belum ada soal yang menunggu penerbitan." />}
          <List title="Soal Anda yang sedang ditelaah" rows={mineWaiting} empty="Tidak ada soal Anda yang sedang ditelaah." />
        </>
      )}
    </div>
  );
}
