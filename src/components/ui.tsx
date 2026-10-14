import type { ReactNode } from 'react';
import { STATUS_LABEL, type QuestionStatus } from '@/features/questions/model';

export const inputCls =
  'min-h-[44px] w-full rounded-xl border-2 border-[#CFDCD7] bg-white px-3 py-2 focus:border-teal-600 focus:outline-none focus:ring-4 focus:ring-teal-100';
export const btnPrimary =
  'min-h-[44px] rounded-xl bg-teal-600 px-5 font-extrabold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-[#DCE5E2] disabled:text-[#51665F]';
export const btnSecondary =
  'min-h-[44px] rounded-xl border-2 border-teal-600 bg-white px-5 font-bold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50';
export const btnDanger =
  'min-h-[44px] rounded-xl border-2 border-coral-500 bg-white px-5 font-bold text-coral-800 hover:bg-coral-100 disabled:cursor-not-allowed disabled:opacity-50';

export function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-extrabold text-ink-soft">{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="text-sm text-ink-soft">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm font-semibold text-coral-800">{error}</p>}
    </div>
  );
}

export function Notice({ kind, children }: { kind: 'ok' | 'error' | 'warn'; children: ReactNode }) {
  const cls = kind === 'error' ? 'bg-sky-100 text-sky-800' : kind === 'warn' ? 'bg-sun-100 text-sun-900' : 'bg-teal-50 text-teal-800';
  return (
    <div role={kind === 'ok' ? 'status' : 'alert'} className={`rounded-2xl px-4 py-3 font-semibold ${cls}`}>
      {children}
    </div>
  );
}

const STATUS_CLS: Record<QuestionStatus, string> = {
  draft: 'bg-line text-ink',
  review: 'bg-sun-100 text-sun-900',
  published: 'bg-teal-100 text-teal-900',
  archived: 'bg-coral-100 text-coral-800',
};
export function StatusBadge({ status, validated }: { status: QuestionStatus; validated?: boolean }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${STATUS_CLS[status]}`}>
      {STATUS_LABEL[status]}
      {status === 'review' && validated ? ' · disetujui' : ''}
    </span>
  );
}

export function PageHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">{title}</h1>
        {children && <p className="mt-2 max-w-3xl text-lg text-ink-soft">{children}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
