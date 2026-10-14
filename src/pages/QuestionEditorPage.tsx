import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Field, Notice, PageHeader, StatusBadge, btnDanger, btnPrimary, btnSecondary, inputCls } from '@/components/ui';
import {
  archiveQuestion, listReviewEvents, loadQuestionPayload, publishQuestion, reviewQuestion, saveQuestion, submitForReview,
  type BankRow, type ReviewEvent,
} from '@/features/questions/api';
import { useBank, useNodes } from '@/features/questions/hooks';
import {
  ANSWER_TYPES, ANSWER_TYPE_LABEL, COGNITIVE_LEVELS, COGNITIVE_LEVEL_LABEL, DOMAIN_LABEL,
  type AnswerType, type Option, type QuestionPayload,
} from '@/features/questions/model';
import { AnswerEditor } from '@/features/questions/ui/AnswerEditor';
import { defaultsFor, emptyPayload } from '@/features/questions/ui/defaults';
import { questionProblems } from '@/features/questions/validate';

const EVENT_LABEL: Record<string, string> = {
  submitted: 'Diajukan untuk telaah', approved: 'Disetujui', returned: 'Dikembalikan ke penulis', published: 'Diterbitkan', archived: 'Diarsipkan',
};

function Preview({ q }: { q: QuestionPayload }) {
  const opts = Array.isArray(q.options) ? (q.options as Option[]) : [];
  return (
    <section aria-label="Pratinjau soal" className="rounded-card border border-line bg-white p-6">
      <h2 className="font-display text-2xl font-extrabold">Pratinjau (tampilan siswa, tanpa kunci)</h2>
      <p className="mt-3 whitespace-pre-line text-lg">{q.statement || '(pernyataan belum diisi)'}</p>
      {q.instructions && <p className="mt-2 font-bold text-ink-soft">{q.instructions}</p>}
      {(q.answer_type === 'single_choice' || q.answer_type === 'multi_choice' || q.answer_type === 'possibilities') && (
        <ul className="mt-3 grid gap-2">{opts.map((o) => <li key={o.id} className="rounded-xl border-2 border-line px-4 py-2"><b>{o.id.toUpperCase()}.</b> {o.text}</li>)}</ul>
      )}
      {q.answer_type === 'ordering' && <p className="mt-3 text-ink-soft">Butir diacak: {[...opts].reverse().map((o) => o.text).join(' · ')}</p>}
      {q.answer_type === 'matching' && <p className="mt-3 text-ink-soft">Siswa memasangkan butir kiri dan kanan (kolom kanan diacak).</p>}
      {q.answer_type === 'numeric' && <p className="mt-3 text-ink-soft">Siswa mengetik sebuah angka.</p>}
      {q.answer_type === 'true_false' && <p className="mt-3 text-ink-soft">Siswa memilih Benar atau Salah.</p>}
    </section>
  );
}

export function QuestionEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [nodes] = useNodes();
  const [bank, reloadBank] = useBank();
  const isNew = id === undefined;
  const [q, setQ] = useState<QuestionPayload>(emptyPayload());
  const [loaded, setLoaded] = useState<'idle' | 'loading' | 'ready' | 'error'>(isNew ? 'ready' : 'loading');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error' | 'warn'; text: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const row: BankRow | undefined = bank.status === 'ready' ? bank.data.find((r) => r.id === id) : undefined;
  const nodeList = nodes.status === 'ready' ? nodes.data : [];
  const node = nodeList.find((n) => n.id === q.node_id) ?? null;
  const isAdmin = profile?.role === 'admin';
  const isOwner = isNew || row?.created_by === profile?.id;
  const status = row?.status ?? 'draft';
  const canEdit = (isNew || isOwner || isAdmin) && status !== 'archived';
  const problems = useMemo(() => questionProblems(q, node), [q, node]);

  // muat isi soal setelah baris bank tersedia
  useEffect(() => {
    if (isNew) return;
    if (bank.status === 'error') { setLoaded('error'); setMsg({ kind: 'error', text: bank.message }); return; }
    if (!row) { if (bank.status === 'ready') { setLoaded('error'); setMsg({ kind: 'error', text: 'Soal tidak ditemukan atau Anda tidak berhak melihatnya.' }); } return; }
    let active = true;
    void loadQuestionPayload(row).then((r) => {
      if (!active) return;
      if (r.ok) { setQ(r.data); setLoaded('ready'); setDirty(false); } else { setLoaded('error'); setMsg({ kind: 'error', text: r.message }); }
    });
    void listReviewEvents(row.id).then((r) => { if (active && r.ok) setEvents(r.data); });
    return () => { active = false; };
    // row.version_id berubah bila versi baru dibuat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, id, bank.status, row?.version_id]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const patch = useCallback((p: Partial<QuestionPayload>) => { setQ((cur) => ({ ...cur, ...p })); setDirty(true); }, []);

  function changeType(t: AnswerType) {
    if (t === q.answer_type) return;
    if (dirty && !window.confirm('Mengganti jenis soal akan mengatur ulang opsi dan kunci jawaban. Lanjutkan?')) return;
    patch({ answer_type: t, ...defaultsFor(t) });
  }

  async function save(): Promise<string | null> {
    const r = await saveQuestion(isNew ? null : (id as string), { ...q, hints: q.hints.map((h) => h.trim()).filter((h) => h !== '') });
    if (!r.ok) { setMsg({ kind: 'error', text: r.message }); return null; }
    setDirty(false);
    reloadBank();
    return r.data.question_id;
  }

  async function onSave() {
    if (busy) return;
    if (!q.node_id) { setMsg({ kind: 'error', text: 'Pilih submateri terlebih dahulu.' }); return; }
    setBusy(true); setMsg(null);
    const qid = await save();
    setBusy(false);
    if (!qid) return;
    setMsg({ kind: 'ok', text: 'Draf tersimpan.' });
    if (isNew) navigate(`/guru/soal/${qid}`, { replace: true });
  }

  async function onSubmit() {
    if (busy) return;
    if (problems.length > 0) { setMsg({ kind: 'error', text: 'Lengkapi soal terlebih dahulu (lihat daftar kekurangan).' }); return; }
    setBusy(true); setMsg(null);
    const qid = await save();
    if (qid) {
      const r = await submitForReview(qid);
      if (!r.ok) setMsg({ kind: 'error', text: r.message });
      else { setMsg({ kind: 'ok', text: 'Soal diajukan untuk telaah.' }); reloadBank(); if (isNew) navigate(`/guru/soal/${qid}`, { replace: true }); }
    }
    setBusy(false);
  }

  async function run(fn: () => Promise<{ ok: boolean; message?: string }>, okText: string) {
    if (busy) return;
    setBusy(true); setMsg(null);
    const r = await fn();
    setBusy(false);
    if (!r.ok) { setMsg({ kind: 'error', text: r.message ?? 'Gagal.' }); return; }
    setMsg({ kind: 'ok', text: okText });
    setNotes(''); setConfirmArchive(false);
    reloadBank();
    if (id) void listReviewEvents(id).then((e) => { if (e.ok) setEvents(e.data); });
  }

  if (loaded === 'loading') return <p role="status" className="text-ink-soft">Memuat soal…</p>;
  if (loaded === 'error') return <div className="flex flex-col gap-4">{msg && <Notice kind={msg.kind}>{msg.text}</Notice>}<Link to="/guru/soal" className="font-bold text-teal-800 underline">Kembali ke bank soal</Link></div>;

  const canReview = !isNew && status === 'review' && !row?.validated && row?.created_by !== profile?.id;
  const canPublish = !isNew && isAdmin && status === 'review' && row?.validated === true;
  const canArchive = !isNew && status !== 'archived' && (isAdmin || (isOwner && status === 'draft'));
  const locked = !canEdit || busy;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={isNew ? 'Soal baru' : (row?.code ?? 'Soal')}
        actions={<Link to="/guru/soal" className={`${btnSecondary} inline-flex items-center`}>Kembali ke bank soal</Link>}
      >
        {!isNew && row && <span className="inline-flex items-center gap-3"><StatusBadge status={row.status} validated={row.validated} /> Versi {row.version_no ?? '–'} · oleh {row.created_by_name ?? 'tanpa nama'}</span>}
      </PageHeader>

      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {status === 'published' && canEdit && <Notice kind="warn">Soal ini sudah terbit. Menyimpan perubahan membuat versi baru yang kembali berstatus draf; versi terbit yang dipakai siswa tidak berubah sampai versi baru terbit.</Notice>}
      {status === 'review' && canEdit && <Notice kind="warn">Soal sedang ditelaah. Menyimpan perubahan mengembalikan soal ke draf dan mencabut persetujuan.</Notice>}
      {status === 'archived' && <Notice kind="warn">Soal ini diarsipkan dan tidak dapat diubah.</Notice>}
      {!canEdit && status !== 'archived' && <Notice kind="warn">Hanya pembuat soal atau admin yang dapat mengubah soal ini. Anda dapat menelaahnya.</Notice>}
      {row?.validation_notes && <Notice kind="warn">Catatan telaah: {row.validation_notes}</Notice>}

      <form noValidate onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-6">
        <section aria-labelledby="identitas" className="grid gap-4 rounded-card border border-line bg-white p-6 sm:grid-cols-2 lg:grid-cols-3">
          <h2 id="identitas" className="font-display text-2xl font-extrabold sm:col-span-2 lg:col-span-3">Identitas soal</h2>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field id="e-node" label="Submateri">
              <select id="e-node" className={inputCls} disabled={locked} value={q.node_id} onChange={(e) => {
                const n = nodeList.find((x) => x.id === e.target.value);
                patch({ node_id: e.target.value, ...(n && (q.grade < n.grade_min || q.grade > n.grade_max) ? { grade: n.grade_min } : {}) });
              }}>
                <option value="">Pilih submateri…</option>
                {nodeList.map((n) => <option key={n.id} value={n.id}>{n.code} — {n.title} ({DOMAIN_LABEL[n.domain]})</option>)}
              </select>
            </Field>
          </div>
          <Field id="e-grade" label="Kelas sasaran" hint={node ? `Rentang submateri: kelas ${node.grade_min}–${node.grade_max}` : undefined}>
            <select id="e-grade" className={inputCls} disabled={locked} value={q.grade} onChange={(e) => patch({ grade: Number(e.target.value) })}>
              {[1, 2, 3].map((g) => <option key={g} value={g}>Kelas {g}</option>)}
            </select>
          </Field>
          <Field id="e-level" label="Tingkat kognitif">
            <select id="e-level" className={inputCls} disabled={locked} value={q.cognitive_level} onChange={(e) => patch({ cognitive_level: e.target.value as QuestionPayload['cognitive_level'] })}>
              {COGNITIVE_LEVELS.map((l) => <option key={l} value={l}>{COGNITIVE_LEVEL_LABEL[l]}</option>)}
            </select>
          </Field>
          <Field id="e-diff" label="Kesulitan (1 mudah – 5 sulit)">
            <select id="e-diff" className={inputCls} disabled={locked} value={q.difficulty} onChange={(e) => patch({ difficulty: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </Field>
          <Field id="e-type" label="Jenis soal">
            <select id="e-type" className={inputCls} disabled={locked} value={q.answer_type} onChange={(e) => changeType(e.target.value as AnswerType)}>
              {ANSWER_TYPES.map((t) => <option key={t} value={t}>{ANSWER_TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field id="e-secs" label="Waktu rekomendasi (detik)" hint="10 sampai 3600; boleh kosong.">
            <input id="e-secs" type="number" className={inputCls} disabled={locked} value={q.recommended_seconds ?? ''} onChange={(e) => patch({ recommended_seconds: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <label className="flex min-h-[44px] items-end gap-2 pb-2 font-bold">
            <input type="checkbox" className="h-5 w-5" disabled={locked} checked={q.ai_assisted} onChange={(e) => patch({ ai_assisted: e.target.checked })} />
            Dibuat dengan bantuan AI
          </label>
        </section>

        <section aria-labelledby="isi" className="flex flex-col gap-4 rounded-card border border-line bg-white p-6">
          <h2 id="isi" className="font-display text-2xl font-extrabold">Isi soal</h2>
          <Field id="e-stmt" label="Pernyataan soal" hint={`${q.statement.length}/4000 karakter`}>
            <textarea id="e-stmt" rows={4} maxLength={4000} className={inputCls} disabled={locked} value={q.statement} onChange={(e) => patch({ statement: e.target.value })} />
          </Field>
          <Field id="e-instr" label="Instruksi pengerjaan" hint="Contoh: Pilih satu jawaban yang paling tepat.">
            <input id="e-instr" maxLength={500} className={inputCls} disabled={locked} value={q.instructions} onChange={(e) => patch({ instructions: e.target.value })} />
          </Field>
        </section>

        <section aria-labelledby="jawaban" className="flex flex-col gap-4 rounded-card border border-line bg-white p-6">
          <h2 id="jawaban" className="font-display text-2xl font-extrabold">Jawaban dan kunci</h2>
          <AnswerEditor q={q} disabled={locked} onChange={(p) => patch(p)} />
        </section>

        <section aria-labelledby="pembahasan" className="flex flex-col gap-4 rounded-card border border-line bg-white p-6">
          <h2 id="pembahasan" className="font-display text-2xl font-extrabold">Pembahasan, petunjuk, dan sumber</h2>
          <Field id="e-expl" label="Pembahasan">
            <textarea id="e-expl" rows={4} maxLength={4000} className={inputCls} disabled={locked} value={q.explanation} onChange={(e) => patch({ explanation: e.target.value })} />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-extrabold text-ink-soft">Petunjuk bertahap (2 sampai 3 butir, dari yang paling halus)</legend>
            {q.hints.map((h, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <label className="flex min-w-[240px] flex-1 flex-col text-sm font-bold">Petunjuk {i + 1}
                  <input className={inputCls} maxLength={300} disabled={locked} value={h} onChange={(e) => patch({ hints: q.hints.map((x, j) => (j === i ? e.target.value : x)) })} />
                </label>
                <button type="button" className={btnDanger} disabled={locked || q.hints.length <= 2} onClick={() => patch({ hints: q.hints.filter((_, j) => j !== i) })}>Hapus</button>
              </div>
            ))}
            {q.hints.length < 3 && <div><button type="button" className={btnSecondary} disabled={locked} onClick={() => patch({ hints: [...q.hints, ''] })}>Tambah petunjuk</button></div>}
          </fieldset>
          <Field id="e-src" label="Sumber soal" hint="Wajib. Contoh: Karya guru, atau sebutkan buku/lomba rujukan.">
            <input id="e-src" maxLength={300} className={inputCls} disabled={locked} value={q.source} onChange={(e) => patch({ source: e.target.value })} />
          </Field>
        </section>
      </form>

      <section aria-labelledby="cek" className="rounded-card border border-line bg-white p-6">
        <h2 id="cek" className="font-display text-2xl font-extrabold">Kelengkapan</h2>
        {problems.length === 0
          ? <p role="status" className="mt-2 font-bold text-teal-800">Soal sudah lengkap dan layak diajukan untuk telaah. (Server akan memeriksa ulang.)</p>
          : <ul className="mt-2 list-disc pl-6 text-coral-800">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
      </section>

      <Preview q={q} />

      {canEdit && (
        <div className="flex flex-wrap gap-3">
          <button type="button" className={btnSecondary} disabled={busy} onClick={() => void onSave()}>{busy ? 'Memproses…' : 'Simpan draf'}</button>
          <button type="button" className={btnPrimary} disabled={busy || problems.length > 0 || (status === 'review' && !dirty)} onClick={() => void onSubmit()}>Simpan dan ajukan telaah</button>
        </div>
      )}

      {(canReview || canPublish || canArchive) && id && (
        <section aria-labelledby="alur" className="flex flex-col gap-4 rounded-card border border-line bg-white p-6">
          <h2 id="alur" className="font-display text-2xl font-extrabold">Telaah dan penerbitan</h2>
          {canReview && (
            <>
              <Field id="r-notes" label="Catatan telaah" hint="Wajib diisi (minimal 5 karakter) saat mengembalikan soal.">
                <textarea id="r-notes" rows={3} maxLength={2000} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-3">
                <button type="button" className={btnPrimary} disabled={busy} onClick={() => void run(() => reviewQuestion(id, 'approve', notes), 'Soal disetujui. Admin dapat menerbitkannya.')}>Setujui</button>
                <button type="button" className={btnDanger} disabled={busy || notes.trim().length < 5} onClick={() => void run(() => reviewQuestion(id, 'return', notes), 'Soal dikembalikan ke penulis.')}>Kembalikan ke penulis</button>
              </div>
            </>
          )}
          {canPublish && <div><button type="button" className={btnPrimary} disabled={busy} onClick={() => void run(() => publishQuestion(id), 'Soal diterbitkan.')}>Terbitkan soal</button></div>}
          {canArchive && (
            confirmArchive ? (
              <div className="flex flex-wrap items-center gap-3" role="alertdialog" aria-label="Konfirmasi pengarsipan">
                <p className="font-bold">Arsipkan soal ini? Soal tidak dapat diubah lagi.</p>
                <button type="button" className={btnDanger} disabled={busy} onClick={() => void run(() => archiveQuestion(id, notes), 'Soal diarsipkan.')}>Ya, arsipkan</button>
                <button type="button" className={btnSecondary} onClick={() => setConfirmArchive(false)}>Batal</button>
              </div>
            ) : <div><button type="button" className={btnDanger} onClick={() => setConfirmArchive(true)}>Arsipkan soal</button></div>
          )}
        </section>
      )}

      {!isNew && (
        <section aria-labelledby="riwayat" className="rounded-card border border-line bg-white p-6">
          <h2 id="riwayat" className="font-display text-2xl font-extrabold">Riwayat telaah</h2>
          {events.length === 0 ? <p className="mt-2 text-ink-soft">Belum ada riwayat.</p> : (
            <ol className="mt-3 flex flex-col gap-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-xl bg-ground px-4 py-2">
                  <b>{EVENT_LABEL[e.event] ?? e.event}</b> oleh {e.actor_name ?? 'tanpa nama'} · {new Date(e.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
                  {e.notes && <p className="text-ink-soft">{e.notes}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
