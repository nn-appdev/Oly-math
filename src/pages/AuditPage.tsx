import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Notice, PageHeader } from '@/components/ui';
import { toDataMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

const rowSchema = z.object({
  id: z.union([z.string(), z.number()]),
  actor_id: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string().nullable(),
  details: z.unknown(),
  created_at: z.string(),
});

export function AuditPage() {
  const [rows, setRows] = useState<z.infer<typeof rowSchema>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!supabase) { setError('Aplikasi belum dikonfigurasi.'); return; }
    let active = true;
    void supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(300).then(({ data, error: e }) => {
      if (!active) return;
      if (e) { setError(toDataMessage(e)); return; }
      const p = z.array(rowSchema).safeParse(data);
      if (p.success) setRows(p.data); else setError('Data log audit tidak dikenali.');
    });
    return () => { active = false; };
  }, []);

  const shown = (rows ?? []).filter((r) => !filter.trim() || r.action.includes(filter.trim()) || r.entity.includes(filter.trim()));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Log audit">300 kejadian terbaru. Log bersifat permanen dan tidak dapat diubah atau dihapus.</PageHeader>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="max-w-sm">
        <label htmlFor="a-f" className="text-sm font-extrabold text-ink-soft">Saring aksi atau entitas</label>
        <input id="a-f" value={filter} onChange={(e) => setFilter(e.target.value)} className="mt-1.5 min-h-[44px] w-full rounded-xl border-2 border-[#CFDCD7] bg-white px-3" placeholder="mis. question atau curriculum" />
      </div>
      <div className="overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[720px] text-left">
          <caption className="sr-only">Log audit</caption>
          <thead><tr className="border-b border-line text-sm text-ink-soft">
            <th scope="col" className="px-4 py-3 font-extrabold">Waktu</th>
            <th scope="col" className="px-4 py-3 font-extrabold">Aksi</th>
            <th scope="col" className="px-4 py-3 font-extrabold">Entitas</th>
            <th scope="col" className="px-4 py-3 font-extrabold">Rincian</th>
          </tr></thead>
          <tbody>
            {rows === null && !error && <tr><td colSpan={4} className="px-4 py-6 text-ink-soft">Memuat log…</td></tr>}
            {rows !== null && shown.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-ink-soft">Tidak ada kejadian yang cocok.</td></tr>}
            {shown.map((r) => (
              <tr key={String(r.id)} className="border-b border-line last:border-0 align-top">
                <td className="whitespace-nowrap px-4 py-3">{new Date(r.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</td>
                <td className="px-4 py-3 font-bold">{r.action}</td>
                <td className="px-4 py-3">{r.entity}</td>
                <td className="px-4 py-3 text-sm text-ink-soft"><code className="break-all">{JSON.stringify(r.details)}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
