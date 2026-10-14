import { CellGrid, cellKey } from '@/components/CellGrid';
import { inputCls } from '@/components/ui';
import { parseNumber, type AnswerState, type ItemView } from './answers';

interface Props {
  item: ItemView;
  value: AnswerState;
  onChange: (a: AnswerState) => void;
  disabled?: boolean;
}

const optionsOf = (o: ItemView['options']) => (Array.isArray(o) ? o : []);
const optCls = (on: boolean) =>
  `flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-2 text-lg ${on ? 'border-teal-600 bg-teal-50' : 'border-[#CFDCD7] bg-white'}`;

/** Satu komponen masukan untuk semua jenis soal. Tidak pernah menerima kunci; hanya keadaan jawaban siswa. */
export function AnswerInput({ item, value, onChange, disabled }: Props) {
  const opts = optionsOf(item.options);
  const v = item.visual_data;

  switch (value.type) {
    case 'single_choice':
      return (
        <fieldset className="flex flex-col gap-2" disabled={disabled}>
          <legend className="mb-2 text-sm font-extrabold text-ink-soft">Pilih satu jawaban</legend>
          {opts.map((o) => (
            <label key={o.id} className={optCls(value.choice === o.id)}>
              <input type="radio" name="jawaban" className="h-5 w-5" checked={value.choice === o.id} onChange={() => onChange({ ...value, choice: o.id })} />
              {o.text}
            </label>
          ))}
        </fieldset>
      );
    case 'multi_choice':
    case 'possibilities':
      return (
        <fieldset className="flex flex-col gap-2" disabled={disabled}>
          <legend className="mb-2 text-sm font-extrabold text-ink-soft">Pilih semua jawaban yang tepat</legend>
          {opts.map((o) => {
            const on = value.choices.includes(o.id);
            return (
              <label key={o.id} className={optCls(on)}>
                <input type="checkbox" className="h-5 w-5" checked={on}
                  onChange={() => onChange({ ...value, choices: on ? value.choices.filter((c) => c !== o.id) : [...value.choices, o.id] })} />
                {o.text}
              </label>
            );
          })}
        </fieldset>
      );
    case 'true_false':
      return (
        <fieldset className="flex gap-3" disabled={disabled}>
          <legend className="mb-2 text-sm font-extrabold text-ink-soft">Pernyataan ini…</legend>
          {([[true, 'Benar'], [false, 'Salah']] as const).map(([b, t]) => (
            <label key={t} className={`${optCls(value.value === b)} flex-1 justify-center`}>
              <input type="radio" name="jawaban" className="h-5 w-5" checked={value.value === b} onChange={() => onChange({ ...value, value: b })} />
              {t}
            </label>
          ))}
        </fieldset>
      );
    case 'numeric':
    case 'geometry': {
      const bad = value.text.trim() !== '' && parseNumber(value.text) === null;
      return (
        <div className="flex flex-col gap-3">
          {value.type === 'geometry' && v?.kind === 'unit_grid' && (
            <CellGrid rows={v.rows} cols={v.cols} selected={new Set(v.cells.map(([r, c]) => cellKey(r, c)))} onToggle={() => undefined} label="Bangun pada kisi" disabled />
          )}
          <label className="flex max-w-xs flex-col text-sm font-extrabold text-ink-soft">
            Jawabanmu (angka)
            <input inputMode="decimal" autoComplete="off" className={`${inputCls} mt-1 text-xl`} disabled={disabled} value={value.text}
              aria-invalid={bad} aria-describedby={bad ? 'angka-galat' : undefined} onChange={(e) => onChange({ ...value, text: e.target.value })} />
          </label>
          {bad && <p id="angka-galat" role="alert" className="text-sm font-bold text-coral-800">Tulis angka saja, misalnya 12 atau 3,5.</p>}
        </div>
      );
    }
    case 'ordering':
      return (
        <ol className="flex flex-col gap-2" aria-label="Urutan jawabanmu">
          {value.order.map((id, i) => {
            const move = (d: -1 | 1) => {
              const next = [...value.order];
              const j = i + d;
              const a = next[i];
              const b = next[j];
              if (a === undefined || b === undefined) return;
              next[i] = b;
              next[j] = a;
              onChange({ ...value, order: next });
            };
            const text = opts.find((o) => o.id === id)?.text ?? id;
            return (
              <li key={id} className="flex items-center gap-2 rounded-xl border-2 border-[#CFDCD7] bg-white px-3 py-2 text-lg">
                <span className="w-7 font-extrabold text-teal-800">{i + 1}.</span>
                <span className="flex-1">{text}</span>
                <button type="button" disabled={disabled || i === 0} aria-label={`Naikkan: ${text}`} onClick={() => move(-1)} className="min-h-[44px] min-w-[44px] rounded-lg border-2 border-teal-600 font-extrabold disabled:opacity-40">↑</button>
                <button type="button" disabled={disabled || i === value.order.length - 1} aria-label={`Turunkan: ${text}`} onClick={() => move(1)} className="min-h-[44px] min-w-[44px] rounded-lg border-2 border-teal-600 font-extrabold disabled:opacity-40">↓</button>
              </li>
            );
          })}
        </ol>
      );
    case 'matching': {
      if (Array.isArray(item.options)) return null;
      const { left, right } = item.options;
      return (
        <div className="flex flex-col gap-3">
          {left.map((l) => (
            <label key={l.id} className="flex flex-wrap items-center gap-3 text-lg">
              <span className="min-w-[8rem] flex-1 font-bold">{l.text}</span>
              <select className={`${inputCls} max-w-xs flex-1`} disabled={disabled} value={value.pairs[l.id] ?? ''}
                onChange={(e) => {
                  const pairs = { ...value.pairs };
                  if (e.target.value === '') delete pairs[l.id];
                  else pairs[l.id] = e.target.value;
                  onChange({ ...value, pairs });
                }}>
                <option value="">Pilih pasangan…</option>
                {right.map((r) => <option key={r.id} value={r.id}>{r.text}</option>)}
              </select>
            </label>
          ))}
          <p className="text-sm text-ink-soft">Setiap pasangan hanya boleh dipakai satu kali.</p>
        </div>
      );
    }
    case 'grid': {
      if (v?.kind !== 'grid_select') return null;
      const set = new Set(value.cells.map(([r, c]) => cellKey(r, c)));
      return (
        <CellGrid rows={v.rows} cols={v.cols} selected={set} label="Pilih petak" disabled={disabled}
          onToggle={(r, c) => onChange({ ...value, cells: set.has(cellKey(r, c)) ? value.cells.filter(([a, b]) => !(a === r && b === c)) : [...value.cells, [r, c]] })} />
      );
    }
    case 'number_line': {
      if (v?.kind !== 'number_line') return null;
      const cur = value.value ?? v.min;
      return (
        <div className="flex max-w-xl flex-col gap-2">
          <label className="text-sm font-extrabold text-ink-soft" htmlFor="garis-bilangan">Geser untuk memilih titik pada garis bilangan</label>
          <input id="garis-bilangan" type="range" min={v.min} max={v.max} step={v.step} value={cur} disabled={disabled}
            aria-valuetext={`${cur}`} className="h-11 w-full accent-teal-600" onChange={(e) => onChange({ ...value, value: Number(e.target.value) })} />
          <div className="flex justify-between text-sm font-bold"><span>{v.min}</span><span>{v.max}</span></div>
          <p className="text-lg font-extrabold" aria-live="polite">{value.value === null ? 'Belum ada titik dipilih.' : `Titikmu: ${value.value}`}</p>
        </div>
      );
    }
    case 'logic': {
      if (v?.kind !== 'position_clues') return null;
      return (
        <div className="flex flex-col gap-3">
          <ul className="list-disc pl-6 text-lg">{v.clues.map((c, i) => <li key={i}>{clueText(c, v.entities)}</li>)}</ul>
          {value.slots.map((s, i) => (
            <label key={i} className="flex items-center gap-3 text-lg">
              <span className="w-24 font-extrabold">Posisi {i + 1}</span>
              <select className={`${inputCls} max-w-xs`} disabled={disabled} value={s ?? ''}
                onChange={(e) => onChange({ ...value, slots: value.slots.map((x, j) => (j === i ? (e.target.value || null) : x)) })}>
                <option value="">Pilih…</option>
                {v.entities.map((e) => <option key={e.id} value={e.id}>{e.text}</option>)}
              </select>
            </label>
          ))}
        </div>
      );
    }
  }
}

type Ent = { id: string; text: string }[];
type Clue = { type: 'at'; entity: string; slot: number } | { type: 'not_at'; entity: string; slot: number } | { type: 'left_of'; a: string; b: string } | { type: 'next_to'; a: string; b: string };
function clueText(c: Clue, ents: Ent): string {
  const n = (id: string) => ents.find((e) => e.id === id)?.text ?? id;
  switch (c.type) {
    case 'at': return `${n(c.entity)} berada di posisi ${c.slot}.`;
    case 'not_at': return `${n(c.entity)} tidak berada di posisi ${c.slot}.`;
    case 'left_of': return `${n(c.a)} berada di sebelah kiri ${n(c.b)} (tidak harus bersebelahan).`;
    case 'next_to': return `${n(c.a)} bersebelahan dengan ${n(c.b)}.`;
  }
}
