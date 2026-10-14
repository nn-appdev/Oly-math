import type { PracticeItem, Visual } from './types';

/** Keadaan jawaban di antarmuka (sebelum dikirim). Bentuk kiriman ke server dibuat oleh toResponse(). */
export type AnswerState =
  | { type: 'single_choice'; choice: string | null }
  | { type: 'multi_choice' | 'possibilities'; choices: string[] }
  | { type: 'numeric'; text: string }
  | { type: 'true_false'; value: boolean | null }
  | { type: 'ordering'; order: string[] }
  | { type: 'matching'; pairs: Record<string, string> }
  | { type: 'grid'; cells: [number, number][] }
  | { type: 'number_line'; value: number | null }
  | { type: 'geometry'; text: string }
  | { type: 'logic'; slots: (string | null)[] };

export type ItemView = Pick<PracticeItem, 'answer_type' | 'options' | 'visual_data'>;
type Opt = { id: string; text: string };
const list = (o: PracticeItem['options']): Opt[] => (Array.isArray(o) ? o : []);

export function emptyAnswer(item: ItemView): AnswerState {
  switch (item.answer_type) {
    case 'single_choice': return { type: 'single_choice', choice: null };
    case 'multi_choice':
    case 'possibilities': return { type: item.answer_type, choices: [] };
    case 'numeric': return { type: 'numeric', text: '' };
    case 'true_false': return { type: 'true_false', value: null };
    case 'ordering': return { type: 'ordering', order: list(item.options).map((o) => o.id) };
    case 'matching': return { type: 'matching', pairs: {} };
    case 'visual': return item.visual_data?.kind === 'number_line' ? { type: 'number_line', value: null } : { type: 'grid', cells: [] };
    case 'geometry_puzzle': return { type: 'geometry', text: '' };
    case 'logic_puzzle': {
      const n = item.visual_data?.kind === 'position_clues' ? item.visual_data.slots : 0;
      return { type: 'logic', slots: Array.from({ length: n }, () => null) };
    }
  }
}

/** Apakah jawaban sudah cukup lengkap untuk dikirim? (Server tetap memeriksa ulang.) */
export function isComplete(a: AnswerState, item: ItemView): boolean {
  switch (a.type) {
    case 'single_choice': return a.choice !== null;
    case 'multi_choice':
    case 'possibilities': return a.choices.length > 0;
    case 'numeric':
    case 'geometry': return parseNumber(a.text) !== null;
    case 'true_false': return a.value !== null;
    case 'ordering': return true;
    case 'matching': {
      const left = Array.isArray(item.options) ? [] : item.options.left;
      return left.length > 0 && left.every((l) => a.pairs[l.id] !== undefined) && new Set(Object.values(a.pairs)).size === left.length;
    }
    case 'grid': return true;
    case 'number_line': return a.value !== null;
    case 'logic': return a.slots.length > 0 && a.slots.every((s) => s !== null) && new Set(a.slots).size === a.slots.length;
  }
}

/** Mengubah teks angka (boleh berkoma desimal) menjadi angka; null bila bukan angka. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && Math.abs(n) <= 1_000_000_000 ? n : null;
}

export function toResponse(a: AnswerState): Record<string, unknown> {
  switch (a.type) {
    case 'single_choice': return { choice: a.choice };
    case 'multi_choice':
    case 'possibilities': return { choices: a.choices };
    case 'numeric':
    case 'geometry': return { value: parseNumber(a.text) };
    case 'true_false': return { value: a.value };
    case 'ordering': return { order: a.order };
    case 'matching': return { pairs: Object.entries(a.pairs).map(([left, right]) => ({ left, right })) };
    case 'grid': return { cells: a.cells };
    case 'number_line': return { value: a.value };
    case 'logic': return { arrangement: a.slots };
  }
}

/** Memulihkan keadaan jawaban dari draf tersimpan; hasilnya null bila draf tidak cocok dengan butir. */
export function fromResponse(item: ItemView, resp: Record<string, unknown> | undefined): AnswerState | null {
  if (!resp) return null;
  const base = emptyAnswer(item);
  const strs = (v: unknown): string[] | null => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null);
  switch (base.type) {
    case 'single_choice': return typeof resp.choice === 'string' ? { ...base, choice: resp.choice } : null;
    case 'multi_choice':
    case 'possibilities': { const c = strs(resp.choices); return c ? { ...base, choices: c } : null; }
    case 'numeric':
    case 'geometry': return typeof resp.value === 'number' ? { ...base, text: String(resp.value) } : null;
    case 'true_false': return typeof resp.value === 'boolean' ? { ...base, value: resp.value } : null;
    case 'number_line': return typeof resp.value === 'number' ? { ...base, value: resp.value } : null;
    case 'ordering': {
      const o = strs(resp.order);
      return o && o.length === base.order.length && [...o].sort().join() === [...base.order].sort().join() ? { ...base, order: o } : null;
    }
    case 'matching': {
      if (!Array.isArray(resp.pairs)) return null;
      const pairs: Record<string, string> = {};
      for (const p of resp.pairs as { left?: unknown; right?: unknown }[]) {
        if (typeof p.left !== 'string' || typeof p.right !== 'string') return null;
        pairs[p.left] = p.right;
      }
      return { ...base, pairs };
    }
    case 'grid': {
      const c = resp.cells;
      return Array.isArray(c) && c.every((x) => Array.isArray(x) && x.length === 2 && x.every((n) => typeof n === 'number')) ? { ...base, cells: c as [number, number][] } : null;
    }
    case 'logic': {
      const a = strs(resp.arrangement);
      return a && a.length === base.slots.length ? { ...base, slots: a } : null;
    }
  }
}

const textOf = (opts: Opt[], id: string) => opts.find((o) => o.id === id)?.text ?? id;

/** Kalimat ringkas jawaban yang benar, untuk umpan balik setelah butir selesai. */
export function describeKey(item: Pick<PracticeItem, 'answer_type' | 'options' | 'visual_data'>, key: Record<string, unknown>): string {
  const opts = list(item.options);
  const names = (ids: unknown) => (Array.isArray(ids) ? (ids as string[]).map((i) => textOf(opts, i)).join(', ') : '');
  switch (item.answer_type) {
    case 'single_choice': return typeof key.correct === 'string' ? textOf(opts, key.correct) : '';
    case 'multi_choice':
    case 'possibilities': return names(key.correct);
    case 'numeric':
    case 'geometry_puzzle': return String(key.value);
    case 'true_false': return key.value === true ? 'Benar' : 'Salah';
    case 'ordering': return names(key.order);
    case 'matching': {
      if (Array.isArray(item.options) || !Array.isArray(key.pairs)) return '';
      const { left, right } = item.options;
      return (key.pairs as { left: string; right: string }[]).map((p) => `${textOf(left, p.left)} → ${textOf(right, p.right)}`).join('; ');
    }
    case 'visual': return item.visual_data?.kind === 'number_line' ? String(key.value) : `${Array.isArray(key.cells) ? key.cells.length : 0} petak terpilih`;
    case 'logic_puzzle': {
      const v: Visual | null = item.visual_data;
      const ents = v && v.kind === 'position_clues' ? v.entities : [];
      return Array.isArray(key.arrangement) ? (key.arrangement as string[]).map((i, n) => `${n + 1}. ${textOf(ents, i)}`).join('  ') : '';
    }
  }
}

/** Kunci pengiriman unik; dipertahankan selama satu pengiriman agar percobaan ulang tidak menggandakan data. */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
