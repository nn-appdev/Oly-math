import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Field, Notice, PageHeader, StatusBadge, btnPrimary, btnSecondary, inputCls } from '@/components/ui';
import { useBank } from '@/features/questions/hooks';
import {
  ANSWER_TYPES, ANSWER_TYPE_LABEL, DOMAINS, DOMAIN_LABEL, QUESTION_STATUSES, STATUS_LABEL,
  type AnswerType, type Domain, type QuestionStatus,
} from '@/features/questions/model';

export function QuestionBankPage() {
  const { profile } = useAuth();
  const [bank] = useBank();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<QuestionStatus | ''>('');
  const [domain, setDomain] = useState<Domain | ''>('');
  const [type, setType] = useState<AnswerType | ''>('');
  const [mine, setMine] = useState(false);

  const rows = useMemo(() => (bank.status === 'ready' ? bank.data : []), [bank]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!status || r.status === status) &&
        (!domain || r.domain === domain) &&
        (!type || r.answer_type === type) &&
        (!mine || r.created_by === profile?.id) &&
        (!needle || r.code.toLowerCase().includes(needle) || (r.statement ?? '').toLowerCase().includes(needle) || r.node_title.toLowerCase().includes(needle)),
    );
  }, [rows, q, status, domain, type, mine, profile?.id]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bank soal"
        actions={<>
          <Link to="/guru/soal/impor" className={`${btnSecondary} inline-flex items-center`}>Impor dan ekspor</Link>
          <Link to="/guru/soal/baru" className={`${btnPrimary} inline-flex items-center`}>Soal baru</Link>
        </>}
      >
        Soal baru selalu berstatus draf. Soal baru terbit setelah ditelaah guru lain dan disetujui admin.
      </PageHeader>

      {bank.status === 'error' && <Notice kind="error">{bank.message}</Notice>}

      <form role="search" aria-label="Saring bank soal" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(e) => e.preventDefault()}>
        <Field id="b-q" label="Cari kode atau kata">
          <input id="b-q" type="search" className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <Field id="b-status" label="Status">
          <select id="b-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as QuestionStatus | '')}>
            <option value="">Semua status</option>
            {QUESTION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
        <Field id="b-domain" label="Domain">
          <select id="b-domain" className={inputCls} value={domain} onChange={(e) => setDomain(e.target.value as Domain | '')}>
            <option value="">Semua domain</option>
            {DOMAINS.map((d) => <option key={d} value={d}>{DOMAIN_LABEL[d]}</option>)}
          </select>
        </Field>
        <Field id="b-type" label="Jenis soal">
          <select id="b-type" className={inputCls} value={type} onChange={(e) => setType(e.target.value as AnswerType | '')}>
            <option value="">Semua jenis</option>
            {ANSWER_TYPES.map((t) => <option key={t} value={t}>{ANSWER_TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <label className="flex min-h-[44px] items-end gap-2 pb-2 font-bold">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-5 w-5" />
          Hanya soal saya
        </label>
      </form>

      <p role="status" className="text-ink-soft">
        {bank.status === 'loading' ? 'Memuat bank soal…' : `${shown.length} dari ${rows.length} soal`}
      </p>

      <div className="overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[860px] text-left">
          <caption className="sr-only">Daftar soal</caption>
          <thead>
            <tr className="border-b border-line text-sm text-ink-soft">
              <th scope="col" className="px-4 py-3 font-extrabold">Kode</th>
              <th scope="col" className="px-4 py-3 font-extrabold">Soal</th>
              <th scope="col" className="px-4 py-3 font-extrabold">Submateri</th>
              <th scope="col" className="px-4 py-3 font-extrabold">Jenis</th>
              <th scope="col" className="px-4 py-3 font-extrabold">Tingkat</th>
              <th scope="col" className="px-4 py-3 font-extrabold">Status</th>
            </tr>
          </thead>
          <tbody>
            {bank.status === 'ready' && shown.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-ink-soft">
                {rows.length === 0 ? 'Bank soal masih kosong. Impor soal awal dari berkas seed atau buat soal baru.' : 'Tidak ada soal yang cocok dengan penyaring.'}
              </td></tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-bold"><Link className="text-teal-800 underline" to={`/guru/soal/${r.id}`}>{r.code}</Link></td>
                <td className="max-w-md px-4 py-3"><span className="line-clamp-2">{r.statement ?? '(belum ada isi)'}</span>{r.ai_assisted && <span className="ml-1 text-xs font-bold text-sky-800">[dibantu AI]</span>}</td>
                <td className="px-4 py-3">{r.node_code}</td>
                <td className="px-4 py-3">{r.answer_type ? ANSWER_TYPE_LABEL[r.answer_type] : '—'}</td>
                <td className="px-4 py-3">{r.cognitive_level ?? '—'} · K{r.difficulty ?? '–'}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} validated={r.validated} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
