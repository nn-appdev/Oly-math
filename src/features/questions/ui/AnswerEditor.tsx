import { useMemo } from 'react';
import { btnDanger, btnSecondary, inputCls } from '@/components/ui';
import { gridMeasures, logicSolutions } from '../solver';
import type { LogicClue, MatchingOptions, Misconception, Option, QuestionPayload, VisualData } from '../model';
import { CellGrid, cellKey } from '@/components/CellGrid';
import { nextId } from './defaults';

type Patch = Partial<Pick<QuestionPayload, 'options' | 'visual_data' | 'answer_key' | 'misconceptions'>>;
interface Props {
  q: QuestionPayload;
  onChange: (patch: Patch) => void;
  disabled?: boolean;
}

const asOptions = (o: QuestionPayload['options']): Option[] => (Array.isArray(o) ? (o as Option[]) : []);

function MisconceptionList({ q, onChange, disabled, withValue }: Props & { withValue: boolean }) {
  const list = q.misconceptions;
  const set = (next: Misconception[]) => onChange({ misconceptions: next });
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-extrabold text-ink-soft">Miskonsepsi yang ditargetkan (opsional)</legend>
      {list.map((m, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[220px] flex-1 flex-col text-sm font-bold">Label {i + 1}
            <input className={inputCls} disabled={disabled} value={m.label} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          </label>
          {withValue && (
            <label className="flex w-40 flex-col text-sm font-bold">Jawaban keliru khas
              <input type="number" className={inputCls} disabled={disabled} value={m.value ?? ''}
                onChange={(e) => set(list.map((x, j) => {
                  if (j !== i) return x;
                  const rest: Misconception = { label: x.label, ...(x.option_id !== undefined ? { option_id: x.option_id } : {}) };
                  return e.target.value === '' ? rest : { ...rest, value: Number(e.target.value) };
                }))} />
            </label>
          )}
          <button type="button" className={btnDanger} disabled={disabled} onClick={() => set(list.filter((_, j) => j !== i))}>Hapus</button>
        </div>
      ))}
      {list.length < 20 && <div><button type="button" className={btnSecondary} disabled={disabled} onClick={() => set([...list, { label: '' }])}>Tambah miskonsepsi</button></div>}
    </fieldset>
  );
}

function ChoiceEditor({ q, onChange, disabled }: Props) {
  const options = asOptions(q.options);
  const single = q.answer_type === 'single_choice';
  const correct: string[] = single
    ? typeof q.answer_key.correct === 'string' ? [q.answer_key.correct] : []
    : Array.isArray(q.answer_key.correct) ? (q.answer_key.correct as string[]) : [];
  const miscFor = (id: string) => q.misconceptions.find((m) => m.option_id === id)?.label ?? '';

  function setCorrect(id: string, on: boolean) {
    if (single) { onChange({ answer_key: { correct: id }, misconceptions: q.misconceptions.filter((m) => m.option_id !== id) }); return; }
    const next = on ? [...correct, id] : correct.filter((c) => c !== id);
    onChange({ answer_key: { correct: next }, misconceptions: on ? q.misconceptions.filter((m) => m.option_id !== id) : q.misconceptions });
  }
  function setMisc(id: string, label: string) {
    const others = q.misconceptions.filter((m) => m.option_id !== id);
    onChange({ misconceptions: label.trim() === '' && label === '' ? others : [...others, { label, option_id: id }] });
  }
  function remove(id: string) {
    const nextCorrect = single ? (correct[0] === id ? (options.find((o) => o.id !== id)?.id ?? '') : correct[0] ?? '') : correct.filter((c) => c !== id);
    onChange({
      options: options.filter((o) => o.id !== id),
      answer_key: { correct: single ? nextCorrect : nextCorrect },
      misconceptions: q.misconceptions.filter((m) => m.option_id !== id),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">
        {single ? 'Pilih satu jawaban benar.' : 'Centang semua jawaban yang benar (minimal satu opsi harus salah sebagai pengecoh).'} Setiap opsi yang salah wajib diberi miskonsepsi yang ditargetkan.
      </p>
      {options.map((o, i) => {
        const isCorrect = correct.includes(o.id);
        return (
          <div key={o.id} className="grid gap-2 rounded-2xl bg-ground p-3 md:grid-cols-[auto_1fr_1fr_auto] md:items-end">
            <label className="flex min-h-[44px] items-center gap-2 font-bold">
              <input type={single ? 'radio' : 'checkbox'} name="kunci" checked={isCorrect} disabled={disabled} className="h-5 w-5"
                onChange={(e) => setCorrect(o.id, single ? true : e.target.checked)} />
              Benar
            </label>
            <label className="flex flex-col text-sm font-bold">Opsi {o.id.toUpperCase()}
              <input className={inputCls} disabled={disabled} value={o.text} maxLength={200}
                onChange={(e) => onChange({ options: options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)) })} />
            </label>
            {isCorrect ? <p className="min-h-[44px] self-center text-sm text-ink-soft">Jawaban benar tidak diberi miskonsepsi.</p> : (
              <label className="flex flex-col text-sm font-bold">Miskonsepsi pada opsi {o.id.toUpperCase()}
                <input className={inputCls} disabled={disabled} value={miscFor(o.id)} onChange={(e) => setMisc(o.id, e.target.value)} />
              </label>
            )}
            <button type="button" className={btnDanger} disabled={disabled || options.length <= 2} aria-label={`Hapus opsi ${i + 1}`} onClick={() => remove(o.id)}>Hapus</button>
          </div>
        );
      })}
      {options.length < 6 && (
        <div><button type="button" className={btnSecondary} disabled={disabled} onClick={() => onChange({ options: [...options, { id: nextId(options.map((o) => o.id)), text: '' }] })}>Tambah opsi</button></div>
      )}
    </div>
  );
}

function OrderingEditor({ q, onChange, disabled }: Props) {
  const options = asOptions(q.options);
  const sync = (next: Option[]) => onChange({ options: next, answer_key: { order: next.map((o) => o.id) } });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j] as Option, next[i] as Option];
    sync(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">Tulis butir dengan urutan yang BENAR. Siswa akan melihat butir dalam urutan acak.</p>
      <ol className="flex flex-col gap-2">
        {options.map((o, i) => (
          <li key={o.id} className="flex flex-wrap items-end gap-2 rounded-2xl bg-ground p-3">
            <span className="min-h-[44px] w-8 self-center font-extrabold">{i + 1}.</span>
            <label className="flex min-w-[200px] flex-1 flex-col text-sm font-bold">Butir {i + 1}
              <input className={inputCls} disabled={disabled} value={o.text} maxLength={200} onChange={(e) => sync(options.map((x) => (x.id === o.id ? { ...x, text: e.target.value } : x)))} />
            </label>
            <button type="button" className={btnSecondary} disabled={disabled || i === 0} aria-label={`Naikkan butir ${i + 1}`} onClick={() => move(i, -1)}>Naik</button>
            <button type="button" className={btnSecondary} disabled={disabled || i === options.length - 1} aria-label={`Turunkan butir ${i + 1}`} onClick={() => move(i, 1)}>Turun</button>
            <button type="button" className={btnDanger} disabled={disabled || options.length <= 2} aria-label={`Hapus butir ${i + 1}`} onClick={() => sync(options.filter((x) => x.id !== o.id))}>Hapus</button>
          </li>
        ))}
      </ol>
      {options.length < 6 && <div><button type="button" className={btnSecondary} disabled={disabled} onClick={() => sync([...options, { id: nextId(options.map((o) => o.id)), text: '' }])}>Tambah butir</button></div>}
    </div>
  );
}

function MatchingEditor({ q, onChange, disabled }: Props) {
  const m = q.options as MatchingOptions;
  const left = m.left ?? [];
  const right = m.right ?? [];
  const sync = (l: Option[], r: Option[]) => onChange({
    options: { left: l, right: r },
    answer_key: { pairs: l.map((x, i) => ({ left: x.id, right: (r[i] as Option).id })) },
  });
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">Setiap baris adalah satu pasangan yang BENAR (kiri dengan kanan). Siswa akan melihat kolom kanan diacak.</p>
      {left.map((l, i) => (
        <div key={l.id} className="flex flex-wrap items-end gap-2 rounded-2xl bg-ground p-3">
          <label className="flex min-w-[180px] flex-1 flex-col text-sm font-bold">Kiri {i + 1}
            <input className={inputCls} disabled={disabled} value={l.text} maxLength={200} onChange={(e) => sync(left.map((x) => (x.id === l.id ? { ...x, text: e.target.value } : x)), right)} />
          </label>
          <label className="flex min-w-[180px] flex-1 flex-col text-sm font-bold">Pasangan kanan {i + 1}
            <input className={inputCls} disabled={disabled} value={(right[i] as Option).text} maxLength={200} onChange={(e) => sync(left, right.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          </label>
          <button type="button" className={btnDanger} disabled={disabled || left.length <= 2} aria-label={`Hapus pasangan ${i + 1}`} onClick={() => sync(left.filter((_, j) => j !== i), right.filter((_, j) => j !== i))}>Hapus</button>
        </div>
      ))}
      {left.length < 6 && (
        <div><button type="button" className={btnSecondary} disabled={disabled} onClick={() => sync([...left, { id: nextId(left.map((o) => o.id), 'l'), text: '' }], [...right, { id: nextId(right.map((o) => o.id), 'r'), text: '' }])}>Tambah pasangan</button></div>
      )}
    </div>
  );
}

function VisualEditor({ q, onChange, disabled }: Props) {
  const v = q.visual_data;
  const num = (id: string, label: string, value: number, apply: (n: number) => void) => (
    <label className="flex w-32 flex-col text-sm font-bold">{label}
      <input id={id} type="number" className={inputCls} disabled={disabled} value={Number.isFinite(value) ? value : ''} onChange={(e) => apply(Number(e.target.value))} />
    </label>
  );
  if (!v || (v.kind !== 'grid_select' && v.kind !== 'number_line')) return null;
  if (v.kind === 'grid_select') {
    const cells = Array.isArray(q.answer_key.cells) ? (q.answer_key.cells as [number, number][]) : [];
    const set = new Set(cells.map(([r, c]) => cellKey(r, c)));
    const resize = (rows: number, cols: number) => {
      const r = Math.min(Math.max(Math.trunc(rows) || 1, 1), 10);
      const c = Math.min(Math.max(Math.trunc(cols) || 1, 1), 10);
      onChange({ visual_data: { kind: 'grid_select', rows: r, cols: c }, answer_key: { cells: cells.filter(([a, b]) => a < r && b < c) } });
    };
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          {num('g-rows', 'Baris (1–10)', v.rows, (n) => resize(n, v.cols))}
          {num('g-cols', 'Kolom (1–10)', v.cols, (n) => resize(v.rows, n))}
        </div>
        <p className="text-sm text-ink-soft">Ketuk petak yang menjadi kunci jawaban.</p>
        <CellGrid rows={v.rows} cols={v.cols} selected={set} label="Kunci petak" disabled={disabled}
          onToggle={(r, c) => {
            const k = cellKey(r, c);
            onChange({ answer_key: { cells: set.has(k) ? cells.filter(([a, b]) => cellKey(a, b) !== k) : [...cells, [r, c]] } });
          }} />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      {num('nl-min', 'Nilai terkecil', v.min, (n) => onChange({ visual_data: { ...v, min: n } }))}
      {num('nl-max', 'Nilai terbesar', v.max, (n) => onChange({ visual_data: { ...v, max: n } }))}
      {num('nl-step', 'Langkah', v.step, (n) => onChange({ visual_data: { ...v, step: n } }))}
      {num('nl-key', 'Kunci', typeof q.answer_key.value === 'number' ? q.answer_key.value : 0, (n) => onChange({ answer_key: { value: n } }))}
    </div>
  );
}

function GeometryEditor({ q, onChange, disabled }: Props) {
  const v = q.visual_data;
  if (!v || v.kind !== 'unit_grid') return null;
  const set = new Set(v.cells.map(([r, c]) => cellKey(r, c)));
  const apply = (next: Extract<VisualData, { kind: 'unit_grid' }>) => {
    const m = gridMeasures(next.cells);
    onChange({ visual_data: next, answer_key: { value: next.measure === 'area' ? m.area : m.perimeter } });
  };
  const resize = (rows: number, cols: number) => {
    const r = Math.min(Math.max(Math.trunc(rows) || 1, 1), 12);
    const c = Math.min(Math.max(Math.trunc(cols) || 1, 1), 12);
    apply({ ...v, rows: r, cols: c, cells: v.cells.filter(([a, b]) => a < r && b < c) });
  };
  const value = typeof q.answer_key.value === 'number' ? q.answer_key.value : 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <label className="flex w-32 flex-col text-sm font-bold">Baris (1–12)
          <input type="number" className={inputCls} disabled={disabled} value={v.rows} onChange={(e) => resize(Number(e.target.value), v.cols)} />
        </label>
        <label className="flex w-32 flex-col text-sm font-bold">Kolom (1–12)
          <input type="number" className={inputCls} disabled={disabled} value={v.cols} onChange={(e) => resize(v.rows, Number(e.target.value))} />
        </label>
        <label className="flex w-48 flex-col text-sm font-bold">Yang ditanyakan
          <select className={inputCls} disabled={disabled} value={v.measure} onChange={(e) => apply({ ...v, measure: e.target.value as 'area' | 'perimeter' })}>
            <option value="area">Luas (banyak petak)</option>
            <option value="perimeter">Keliling</option>
          </select>
        </label>
      </div>
      <p className="text-sm text-ink-soft">Ketuk petak untuk membentuk bangun. Kunci dihitung otomatis dari bangun.</p>
      <CellGrid rows={v.rows} cols={v.cols} selected={set} label="Bangun" disabled={disabled}
        onToggle={(r, c) => {
          const k = cellKey(r, c);
          apply({ ...v, cells: set.has(k) ? v.cells.filter(([a, b]) => cellKey(a, b) !== k) : [...v.cells, [r, c]] });
        }} />
      <p role="status" className="font-bold">Kunci otomatis: {value} {v.measure === 'area' ? 'petak' : 'satuan'}</p>
    </div>
  );
}

const CLUE_LABEL: Record<LogicClue['type'], string> = {
  at: 'berada di posisi', not_at: 'tidak berada di posisi', left_of: 'berada di depan (kiri)', next_to: 'berdampingan dengan',
};

function LogicEditor({ q, onChange, disabled }: Props) {
  const v = q.visual_data;
  const solutions = useMemo(
    () => (v && v.kind === 'position_clues' && v.clues.length > 0 ? logicSolutions(v.entities.map((e) => e.id), v.clues) : []),
    [v],
  );
  if (!v || v.kind !== 'position_clues') return null;
  const apply = (next: Extract<VisualData, { kind: 'position_clues' }>) => {
    const sols = next.clues.length > 0 ? logicSolutions(next.entities.map((e) => e.id), next.clues) : [];
    onChange({ visual_data: next, answer_key: { arrangement: sols.length === 1 ? (sols[0] as string[]) : [] } });
  };
  const setSlots = (n: number) => {
    const slots = Math.min(Math.max(n, 3), 5);
    const entities = Array.from({ length: slots }, (_, i) => v.entities[i] ?? { id: `e${i + 1}`, text: '' });
    const ids = entities.map((e) => e.id);
    apply({ ...v, slots, entities, clues: v.clues.filter((c) => ('entity' in c ? ids.includes(c.entity) && (!('slot' in c) || c.slot <= slots) : ids.includes(c.a) && ids.includes(c.b))) });
  };
  const nameOf = (id: string) => v.entities.find((e) => e.id === id)?.text || id;
  const setClue = (i: number, c: LogicClue) => apply({ ...v, clues: v.clues.map((x, j) => (j === i ? c : x)) });
  const first = v.entities[0]?.id ?? 'e1';
  const second = v.entities[1]?.id ?? 'e2';
  const arrangement = Array.isArray(q.answer_key.arrangement) ? (q.answer_key.arrangement as string[]) : [];

  return (
    <div className="flex flex-col gap-3">
      <label className="flex w-48 flex-col text-sm font-bold">Banyak posisi (3–5)
        <select className={inputCls} disabled={disabled} value={v.slots} onChange={(e) => setSlots(Number(e.target.value))}>
          {[3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="text-sm font-extrabold text-ink-soft">Tokoh</legend>
        {v.entities.map((e, i) => (
          <label key={e.id} className="flex flex-col text-sm font-bold">Tokoh {i + 1}
            <input className={inputCls} disabled={disabled} value={e.text} maxLength={200} onChange={(ev) => apply({ ...v, entities: v.entities.map((x) => (x.id === e.id ? { ...x, text: ev.target.value } : x)) })} />
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-extrabold text-ink-soft">Petunjuk (posisi dihitung mulai 1 dari depan)</legend>
        {v.clues.map((c, i) => {
          const isPos = c.type === 'at' || c.type === 'not_at';
          return (
            <div key={i} className="flex flex-wrap items-end gap-2 rounded-2xl bg-ground p-3">
              <label className="flex flex-col text-sm font-bold">Tokoh
                <select className={inputCls} disabled={disabled} value={isPos ? c.entity : c.a}
                  onChange={(e) => setClue(i, isPos ? { ...c, entity: e.target.value } : { ...c, a: e.target.value })}>
                  {v.entities.map((e) => <option key={e.id} value={e.id}>{nameOf(e.id)}</option>)}
                </select>
              </label>
              <label className="flex flex-col text-sm font-bold">Hubungan
                <select className={inputCls} disabled={disabled} value={c.type}
                  onChange={(e) => {
                    const t = e.target.value as LogicClue['type'];
                    const a = isPos ? c.entity : c.a;
                    setClue(i, t === 'at' || t === 'not_at' ? { type: t, entity: a, slot: 1 } : { type: t, a, b: a === second ? first : second });
                  }}>
                  {(Object.keys(CLUE_LABEL) as LogicClue['type'][]).map((t) => <option key={t} value={t}>{CLUE_LABEL[t]}</option>)}
                </select>
              </label>
              {isPos ? (
                <label className="flex w-28 flex-col text-sm font-bold">Posisi
                  <select className={inputCls} disabled={disabled} value={c.slot} onChange={(e) => setClue(i, { ...c, slot: Number(e.target.value) })}>
                    {Array.from({ length: v.slots }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              ) : (
                <label className="flex flex-col text-sm font-bold">Tokoh lain
                  <select className={inputCls} disabled={disabled} value={c.b} onChange={(e) => setClue(i, { ...c, b: e.target.value })}>
                    {v.entities.map((e) => <option key={e.id} value={e.id}>{nameOf(e.id)}</option>)}
                  </select>
                </label>
              )}
              <button type="button" className={btnDanger} disabled={disabled} onClick={() => apply({ ...v, clues: v.clues.filter((_, j) => j !== i) })}>Hapus</button>
            </div>
          );
        })}
        {v.clues.length < 12 && <div><button type="button" className={btnSecondary} disabled={disabled} onClick={() => apply({ ...v, clues: [...v.clues, { type: 'at', entity: first, slot: 1 }] })}>Tambah petunjuk</button></div>}
      </fieldset>
      <p role="status" className="font-bold">
        {v.clues.length === 0 ? 'Tambahkan petunjuk.' : solutions.length === 1 ? `Solusi tunggal: ${arrangement.map(nameOf).join(' → ')}` : solutions.length === 0 ? 'Petunjuk saling bertentangan: tidak ada solusi.' : `Ada ${solutions.length} solusi; tambahkan petunjuk sampai tepat satu.`}
      </p>
    </div>
  );
}

export function AnswerEditor(props: Props) {
  const { q, onChange, disabled } = props;
  switch (q.answer_type) {
    case 'single_choice':
    case 'multi_choice':
    case 'possibilities':
      return <ChoiceEditor {...props} />;
    case 'ordering':
      return <OrderingEditor {...props} />;
    case 'matching':
      return <MatchingEditor {...props} />;
    case 'numeric':
      return (
        <div className="flex flex-col gap-4">
          <label className="flex w-56 flex-col text-sm font-bold">Kunci jawaban (angka)
            <input type="number" className={inputCls} disabled={disabled} value={typeof q.answer_key.value === 'number' ? q.answer_key.value : ''}
              onChange={(e) => onChange({ answer_key: { value: e.target.value === '' ? ('' as unknown as number) : Number(e.target.value) } })} />
          </label>
          <MisconceptionList {...props} withValue />
        </div>
      );
    case 'true_false':
      return (
        <fieldset className="flex gap-6">
          <legend className="text-sm font-extrabold text-ink-soft">Kunci jawaban</legend>
          {[true, false].map((b) => (
            <label key={String(b)} className="flex min-h-[44px] items-center gap-2 font-bold">
              <input type="radio" name="tf" className="h-5 w-5" disabled={disabled} checked={q.answer_key.value === b} onChange={() => onChange({ answer_key: { value: b } })} />
              {b ? 'Benar' : 'Salah'}
            </label>
          ))}
        </fieldset>
      );
    case 'visual':
      return (
        <div className="flex flex-col gap-4">
          <label className="flex w-64 flex-col text-sm font-bold">Bentuk interaksi
            <select className={inputCls} disabled={disabled} value={q.visual_data?.kind ?? 'grid_select'}
              onChange={(e) => onChange(e.target.value === 'number_line'
                ? { visual_data: { kind: 'number_line', min: 0, max: 20, step: 1 }, answer_key: { value: 0 } }
                : { visual_data: { kind: 'grid_select', rows: 3, cols: 3 }, answer_key: { cells: [] } })}>
              <option value="grid_select">Memilih petak pada kisi</option>
              <option value="number_line">Menandai titik pada garis bilangan</option>
            </select>
          </label>
          <VisualEditor {...props} />
        </div>
      );
    case 'geometry_puzzle':
      return <GeometryEditor {...props} />;
    case 'logic_puzzle':
      return <LogicEditor {...props} />;
  }
}
