import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useAuth } from '@/features/auth/AuthContext';
import { Field, Notice, PageHeader, btnPrimary, btnSecondary, btnDanger, inputCls } from '@/components/ui';
import { toQuestionMessage, type CurriculumNode } from '@/features/questions/api';
import { useNodes, usePrerequisites } from '@/features/questions/hooks';
import { DOMAINS, DOMAIN_LABEL, DOMAIN_PREFIX, type Domain } from '@/features/questions/model';
import { supabase } from '@/lib/supabase';

const VALIDATION_LABEL = { belum_divalidasi: 'Belum divalidasi', dalam_telaah: 'Dalam telaah', tervalidasi: 'Tervalidasi' } as const;

const nodeForm = z
  .object({
    code: z.string().trim().regex(/^[A-Z]{3}-[0-9]{1,2}-[0-9]{2,3}$/, 'Kode harus berbentuk BIL-1-01 (tiga huruf kapital, kelas, nomor).'),
    domain: z.enum(DOMAINS),
    title: z.string().trim().min(1, 'Judul wajib diisi.').max(160, 'Judul maksimal 160 karakter.'),
    grade_min: z.number().int().min(1).max(3),
    grade_max: z.number().int().min(1).max(3),
    objectives: z.string().trim().max(2000, 'Tujuan pembelajaran maksimal 2000 karakter.'),
    validation_status: z.enum(['belum_divalidasi', 'dalam_telaah', 'tervalidasi']),
  })
  .superRefine((v, ctx) => {
    if (v.grade_max < v.grade_min) ctx.addIssue({ code: 'custom', path: ['grade_max'], message: 'Kelas akhir tidak boleh lebih rendah daripada kelas awal.' });
    if (v.code.slice(0, 3) !== DOMAIN_PREFIX[v.domain]) ctx.addIssue({ code: 'custom', path: ['code'], message: `Kode untuk domain ini harus diawali ${DOMAIN_PREFIX[v.domain]}.` });
    if (v.code.split('-')[1] !== String(v.grade_min)) ctx.addIssue({ code: 'custom', path: ['code'], message: 'Angka kelas pada kode harus sama dengan kelas awal.' });
  });

interface FormState {
  code: string; domain: Domain; title: string; grade_min: number; grade_max: number; objectives: string;
  validation_status: CurriculumNode['validation_status'];
}
const EMPTY: FormState = { code: '', domain: 'bilangan', title: '', grade_min: 1, grade_max: 1, objectives: '', validation_status: 'belum_divalidasi' };

export function CurriculumPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [nodes, reloadNodes] = useNodes();
  const [pre, reloadPre] = usePrerequisites();
  const [domain, setDomain] = useState<Domain | ''>('');
  const [grade, setGrade] = useState<number | ''>('');
  const [editing, setEditing] = useState<{ id: string | null; form: FormState } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [prereqPick, setPrereqPick] = useState('');

  const all = useMemo(() => (nodes.status === 'ready' ? nodes.data : []), [nodes]);
  const byId = useMemo(() => new Map(all.map((n) => [n.id, n] as const)), [all]);
  const prereqs = useMemo(() => (pre.status === 'ready' ? pre.data : []), [pre]);
  const shown = all.filter((n) => (!domain || n.domain === domain) && (!grade || (n.grade_min <= grade && n.grade_max >= grade)));

  function open(n?: CurriculumNode) {
    setErrors({});
    setMsg(null);
    setPrereqPick('');
    setEditing(n
      ? { id: n.id, form: { code: n.code, domain: n.domain, title: n.title, grade_min: n.grade_min, grade_max: n.grade_max, objectives: n.objectives, validation_status: n.validation_status } }
      : { id: null, form: EMPTY });
  }

  async function save() {
    if (!editing || !supabase || busy) return;
    const parsed = nodeForm.safeParse(editing.form);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[String(i.path[0])] ??= i.message;
      setErrors(e);
      return;
    }
    setErrors({});
    setBusy(true);
    const res = editing.id
      ? await supabase.from('curriculum_nodes').update(parsed.data).eq('id', editing.id).select('id')
      : await supabase.from('curriculum_nodes').insert(parsed.data).select('id');
    setBusy(false);
    if (res.error) {
      setMsg({ kind: 'error', text: res.error.code === '23505' ? 'Kode submateri sudah dipakai.' : toQuestionMessage(res.error) });
      return;
    }
    if (!res.data || res.data.length === 0) {
      setMsg({ kind: 'error', text: 'Perubahan tidak tersimpan. Anda tidak memiliki izin.' });
      return;
    }
    setMsg({ kind: 'ok', text: `Submateri ${parsed.data.code} tersimpan.` });
    setEditing(null);
    reloadNodes();
  }

  async function addPrereq(nodeId: string) {
    if (!supabase || !prereqPick || busy) return;
    setBusy(true);
    const { error } = await supabase.from('curriculum_prerequisites').insert({ node_id: nodeId, prerequisite_id: prereqPick });
    setBusy(false);
    if (error) {
      setMsg({ kind: 'error', text: error.code === '23505' ? 'Prasyarat itu sudah terdaftar.' : toQuestionMessage(error) });
      return;
    }
    setPrereqPick('');
    setMsg({ kind: 'ok', text: 'Prasyarat ditambahkan.' });
    reloadPre();
  }

  async function removePrereq(nodeId: string, preId: string) {
    if (!supabase || busy) return;
    setBusy(true);
    const { error } = await supabase.from('curriculum_prerequisites').delete().eq('node_id', nodeId).eq('prerequisite_id', preId);
    setBusy(false);
    if (error) {
      setMsg({ kind: 'error', text: toQuestionMessage(error) });
      return;
    }
    setMsg({ kind: 'ok', text: 'Prasyarat dihapus.' });
    reloadPre();
  }

  const f = editing?.form;
  const set = (patch: Partial<FormState>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));
  const editingPrereqs = editing?.id ? prereqs.filter((p) => p.node_id === editing.id) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Kurikulum" actions={isAdmin ? <button type="button" className={btnPrimary} onClick={() => open()}>Tambah submateri</button> : undefined}>
        Submateri kelas 1–3 beserta prasyaratnya. {isAdmin ? 'Admin dapat menambah dan mengubah submateri.' : 'Perubahan kurikulum dilakukan oleh admin.'}
      </PageHeader>

      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {nodes.status === 'error' && <Notice kind="error">{nodes.message}</Notice>}

      <div className="flex flex-wrap gap-4">
        <Field id="f-domain" label="Domain">
          <select id="f-domain" className={inputCls} value={domain} onChange={(e) => setDomain(e.target.value as Domain | '')}>
            <option value="">Semua domain</option>
            {DOMAINS.map((d) => <option key={d} value={d}>{DOMAIN_LABEL[d]}</option>)}
          </select>
        </Field>
        <Field id="f-grade" label="Kelas">
          <select id="f-grade" className={inputCls} value={grade} onChange={(e) => setGrade(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">Semua kelas</option>
            {[1, 2, 3].map((g) => <option key={g} value={g}>Kelas {g}</option>)}
          </select>
        </Field>
      </div>

      {editing && f && (
        <section aria-labelledby="form-judul" className="rounded-card border border-line bg-white p-6">
          <h2 id="form-judul" className="font-display text-2xl font-extrabold">{editing.id ? 'Ubah submateri' : 'Submateri baru'}</h2>
          <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="n-code" label="Kode" hint="Contoh: BIL-1-01" error={errors.code}>
              <input id="n-code" className={inputCls} value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} aria-invalid={errors.code ? true : undefined} />
            </Field>
            <Field id="n-domain" label="Domain">
              <select id="n-domain" className={inputCls} value={f.domain} onChange={(e) => set({ domain: e.target.value as Domain })}>
                {DOMAINS.map((d) => <option key={d} value={d}>{DOMAIN_LABEL[d]}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field id="n-title" label="Judul submateri" error={errors.title}>
                <input id="n-title" className={inputCls} value={f.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={errors.title ? true : undefined} />
              </Field>
            </div>
            <Field id="n-gmin" label="Kelas awal">
              <select id="n-gmin" className={inputCls} value={f.grade_min} onChange={(e) => set({ grade_min: Number(e.target.value) })}>
                {[1, 2, 3].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <Field id="n-gmax" label="Kelas akhir" error={errors.grade_max}>
              <select id="n-gmax" className={inputCls} value={f.grade_max} onChange={(e) => set({ grade_max: Number(e.target.value) })}>
                {[1, 2, 3].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field id="n-obj" label="Tujuan pembelajaran" error={errors.objectives}>
                <textarea id="n-obj" rows={3} className={inputCls} value={f.objectives} onChange={(e) => set({ objectives: e.target.value })} />
              </Field>
            </div>
            <Field id="n-status" label="Status validasi" hint="Tandai “Tervalidasi” hanya setelah ditelaah pakar kurikulum.">
              <select id="n-status" className={inputCls} value={f.validation_status} onChange={(e) => set({ validation_status: e.target.value as FormState['validation_status'] })}>
                {Object.entries(VALIDATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <div className="flex items-end gap-3 sm:col-span-2">
              <button type="submit" disabled={busy} className={btnPrimary}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
              <button type="button" className={btnSecondary} onClick={() => setEditing(null)}>Batal</button>
            </div>
          </form>

          {editing.id && (
            <div className="mt-6 border-t border-line pt-4">
              <h3 className="font-display text-xl font-extrabold">Prasyarat</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {editingPrereqs.length === 0 && <li className="text-ink-soft">Belum ada prasyarat.</li>}
                {editingPrereqs.map((p) => (
                  <li key={p.prerequisite_id} className="flex items-center justify-between gap-3 rounded-xl bg-ground px-4 py-2">
                    <span>{byId.get(p.prerequisite_id)?.code} — {byId.get(p.prerequisite_id)?.title}</span>
                    <button type="button" className={btnDanger} disabled={busy} onClick={() => void removePrereq(editing.id as string, p.prerequisite_id)}>Hapus</button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Field id="n-pre" label="Tambah prasyarat">
                  <select id="n-pre" className={inputCls} value={prereqPick} onChange={(e) => setPrereqPick(e.target.value)}>
                    <option value="">Pilih submateri…</option>
                    {all.filter((n) => n.id !== editing.id).map((n) => <option key={n.id} value={n.id}>{n.code} — {n.title}</option>)}
                  </select>
                </Field>
                <button type="button" className={btnSecondary} disabled={!prereqPick || busy} onClick={() => void addPrereq(editing.id as string)}>Tambah</button>
              </div>
            </div>
          )}
        </section>
      )}

      {nodes.status === 'loading' && <p role="status" className="text-ink-soft">Memuat kurikulum…</p>}
      {nodes.status === 'ready' && shown.length === 0 && (
        <p className="rounded-card border border-line bg-white p-6 text-ink-soft">
          Belum ada submateri yang cocok. {all.length === 0 && 'Kurikulum awal dimuat dengan berkas seed (lihat docs/seed.md).'}
        </p>
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {shown.map((n) => {
          const needs = prereqs.filter((p) => p.node_id === n.id).map((p) => byId.get(p.prerequisite_id)?.code).filter(Boolean);
          return (
            <li key={n.id} className="flex flex-col gap-2 rounded-card border border-line bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-extrabold text-teal-800">{n.code} · Kelas {n.grade_min === n.grade_max ? n.grade_min : `${n.grade_min}–${n.grade_max}`}</p>
                  <h2 className="font-display text-xl font-extrabold">{n.title}</h2>
                </div>
                <span className="shrink-0 rounded-full bg-ground px-3 py-1 text-xs font-bold text-ink-soft">{VALIDATION_LABEL[n.validation_status]}</span>
              </div>
              <p className="text-ink-soft">{DOMAIN_LABEL[n.domain]}</p>
              {n.objectives && <p>{n.objectives}</p>}
              <p className="text-sm text-ink-soft">Prasyarat: {needs.length > 0 ? needs.join(', ') : 'tidak ada'}</p>
              {isAdmin && <div><button type="button" className={btnSecondary} onClick={() => open(n)}>Ubah</button></div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
