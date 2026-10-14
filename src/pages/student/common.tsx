import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { btnSecondary, Notice } from '@/components/ui';
import type { Loaded } from '@/features/questions/hooks';

/** Menampilkan keadaan muat/galat secara seragam; isi hanya dirender saat data siap. */
export function Async<T>({ state, reload, children }: { state: Loaded<T>; reload?: () => void; children: (d: T) => ReactNode }) {
  if (state.status === 'loading') return <p role="status" className="text-lg text-ink-soft">Memuat…</p>;
  if (state.status === 'error') {
    return (
      <div className="flex flex-col items-start gap-3">
        <Notice kind="error">{state.message}</Notice>
        {reload && <button type="button" className={btnSecondary} onClick={reload}>Coba lagi</button>}
      </div>
    );
  }
  return <>{children(state.data)}</>;
}

export const BackLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <Link to={to} className="inline-flex min-h-[44px] items-center font-bold text-teal-800 underline">← {children}</Link>
);

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
