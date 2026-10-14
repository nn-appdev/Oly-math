import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Notice, PageHeader, btnPrimary, btnSecondary } from '@/components/ui';
import { importQuestions, loadPayloads, type ImportResult } from '@/features/questions/api';
import { useBank } from '@/features/questions/hooks';
import { parseImportCsv, parseImportJson, toCsv, type ImportItem, type ParseResult } from '@/features/questions/importExport';

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function download(name: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportExportPage() {
  const [bank] = useBank();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ name: string; result: ParseResult } | null>(null);
  const [results, setResults] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error' | 'warn'; text: string } | null>(null);

  async function onFile(file: File | undefined) {
    setResults(null);
    setMsg(null);
    if (!file) return;
    if (file.size > 5_000_000) {
      setParsed(null);
      setMsg({ kind: 'error', text: 'Berkas terlalu besar (maksimal 5 MB).' });
      return;
    }
    let text: string;
    try {
      text = await readText(file);
    } catch {
      setParsed(null);
      setMsg({ kind: 'error', text: 'Berkas tidak dapat dibaca.' });
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.json') && !lower.endsWith('.csv')) {
      setParsed(null);
      setMsg({ kind: 'error', text: 'Gunakan berkas berekstensi .json atau .csv.' });
      return;
    }
    setParsed({ name: file.name, result: lower.endsWith('.csv') ? parseImportCsv(text) : parseImportJson(text) });
  }

  const valid: ImportItem[] = parsed?.result.ok ? parsed.result.items : [];

  async function doImport() {
    if (busy || valid.length === 0) return;
    setBusy(true);
    setMsg(null);
    const r = await importQuestions(valid);
    setBusy(false);
    if (!r.ok) { setMsg({ kind: 'error', text: r.message }); return; }
    setResults(r.data);
    const okN = r.data.filter((x) => x.ok).length;
    setMsg({ kind: okN === r.data.length ? 'ok' : 'warn', text: `${okN} dari ${r.data.length} soal diimpor sebagai draf. Soal yang diimpor tetap perlu diajukan, ditelaah, dan diterbitkan.` });
  }

  async function doExport(format: 'json' | 'csv') {
    if (bank.status !== 'ready' || busy) return;
    setBusy(true);
    setMsg(null);
    const r = await loadPayloads(bank.data);
    setBusy(false);
    if (!r.ok) { setMsg({ kind: 'error', text: r.message }); return; }
    const items = r.data.items.map((it) => {
      const copy: Record<string, unknown> = { ...it };
      delete copy.node_id;
      return copy;
    }) as unknown as ImportItem[];
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'json') download(`bank-soal-${stamp}.json`, 'application/json', JSON.stringify(items, null, 2));
    else download(`bank-soal-${stamp}.csv`, 'text/csv', toCsv(items));
    setMsg({
      kind: r.data.skipped > 0 ? 'warn' : 'ok',
      text: `${items.length} soal diekspor.${r.data.skipped > 0 ? ` ${r.data.skipped} soal dilewati karena isi atau kuncinya tidak dapat Anda baca.` : ''} Berkas ekspor memuat kunci jawaban; simpan dengan aman.`,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Impor dan ekspor soal" actions={<Link to="/guru/soal" className={`${btnSecondary} inline-flex items-center`}>Kembali ke bank soal</Link>}>
        Impor JSON atau CSV (maksimal 200 soal per berkas). Semua soal impor masuk sebagai draf dan divalidasi ulang oleh server.
      </PageHeader>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <section aria-labelledby="impor" className="rounded-card border border-line bg-white p-6">
        <h2 id="impor" className="font-display text-2xl font-extrabold">Impor</h2>
        <p className="mt-2 text-ink-soft">Submateri dirujuk dengan kode (misalnya BIL-1-01). Soal dengan pernyataan yang sudah ada pada submateri yang sama ditolak sebagai duplikat.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label htmlFor="berkas" className="sr-only">Pilih berkas impor</label>
          <input id="berkas" ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" onChange={(e) => void onFile(e.target.files?.[0])} className="min-h-[44px]" />
        </div>

        {parsed && !parsed.result.ok && <div className="mt-4"><Notice kind="error">{parsed.result.message}</Notice></div>}
        {parsed?.result.ok && (
          <div className="mt-4 flex flex-col gap-3">
            <p role="status" className="font-bold">{parsed.name}: {parsed.result.items.length} soal siap diimpor, {parsed.result.errors.length} butir bermasalah.</p>
            {parsed.result.errors.length > 0 && (
              <ul className="list-disc pl-6 text-coral-800">
                {parsed.result.errors.slice(0, 20).map((e) => <li key={e.index}>Butir {e.index + 1}: {e.message}</li>)}
              </ul>
            )}
            <div>
              <button type="button" className={btnPrimary} disabled={busy || valid.length === 0} onClick={() => void doImport()}>
                {busy ? 'Mengimpor…' : `Impor ${valid.length} soal`}
              </button>
            </div>
          </div>
        )}

        {results && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left">
              <caption className="sr-only">Hasil impor</caption>
              <thead><tr className="border-b border-line text-sm text-ink-soft"><th scope="col" className="px-3 py-2">Butir</th><th scope="col" className="px-3 py-2">Hasil</th></tr></thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.index} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{r.index + 1}</td>
                    <td className="px-3 py-2">{r.ok ? `Diimpor sebagai ${r.code ?? 'draf'}` : r.error ?? 'Gagal'}{r.duplicate ? ' (duplikat)' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="ekspor" className="rounded-card border border-line bg-white p-6">
        <h2 id="ekspor" className="font-display text-2xl font-extrabold">Ekspor</h2>
        <p className="mt-2 text-ink-soft">Mengekspor semua soal yang dapat Anda baca, termasuk kunci jawaban dan pembahasan. Perlakukan berkas ini sebagai rahasia.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={btnSecondary} disabled={busy || bank.status !== 'ready'} onClick={() => void doExport('json')}>Unduh JSON</button>
          <button type="button" className={btnSecondary} disabled={busy || bank.status !== 'ready'} onClick={() => void doExport('csv')}>Unduh CSV</button>
        </div>
      </section>
    </div>
  );
}
