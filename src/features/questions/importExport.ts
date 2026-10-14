import { z } from 'zod';
import {
  ANSWER_TYPES,
  COGNITIVE_LEVELS,
  MAX_IMPORT_ITEMS,
  type QuestionPayload,
} from './model';

/** Butir impor: sama dengan payload soal, tetapi submateri dirujuk lewat kode, bukan id. */
export type ImportItem = Omit<QuestionPayload, 'node_id'> & { node_code: string };

const itemSchema = z.object({
  node_code: z.string().trim().min(1, 'kode submateri wajib diisi'),
  grade: z.number().int().min(1).max(3),
  cognitive_level: z.enum(COGNITIVE_LEVELS),
  difficulty: z.number().int().min(1).max(5),
  answer_type: z.enum(ANSWER_TYPES),
  statement: z.string(),
  instructions: z.string().default(''),
  options: z.union([z.array(z.unknown()), z.record(z.unknown())]).default([]),
  visual_data: z.record(z.unknown()).nullable().default(null),
  recommended_seconds: z.number().int().nullable().default(null),
  source: z.string().default(''),
  ai_assisted: z.boolean().default(false),
  answer_key: z.record(z.unknown()),
  explanation: z.string().default(''),
  hints: z.array(z.string()).default([]),
  misconceptions: z.array(z.record(z.unknown())).default([]),
});

export type ParseResult =
  | { ok: true; items: ImportItem[]; errors: { index: number; message: string }[] }
  | { ok: false; message: string };

function validateItems(raw: unknown[]): ParseResult {
  if (raw.length === 0) return { ok: false, message: 'Berkas tidak berisi soal.' };
  if (raw.length > MAX_IMPORT_ITEMS) {
    return { ok: false, message: `Impor dibatasi ${MAX_IMPORT_ITEMS} soal per berkas (berkas ini berisi ${raw.length}).` };
  }
  const items: ImportItem[] = [];
  const errors: { index: number; message: string }[] = [];
  raw.forEach((r, index) => {
    const res = itemSchema.safeParse(r);
    if (res.success) {
      items.push(res.data as unknown as ImportItem);
    } else {
      const first = res.error.issues[0];
      errors.push({ index, message: `${first?.path.join('.') || 'butir'}: ${first?.message ?? 'tidak valid'}` });
    }
  });
  return { ok: true, items, errors };
}

export function parseImportJson(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: 'Berkas bukan JSON yang valid.' };
  }
  if (!Array.isArray(data)) return { ok: false, message: 'JSON harus berupa daftar soal.' };
  return validateItems(data);
}

// ---------------------------------------------------------------- CSV
export const CSV_COLUMNS = [
  'node_code', 'grade', 'cognitive_level', 'difficulty', 'answer_type', 'statement', 'instructions',
  'options', 'visual_data', 'recommended_seconds', 'source', 'ai_assisted', 'answer_key',
  'explanation', 'hints', 'misconceptions',
] as const;
const JSON_COLUMNS = new Set(['options', 'visual_data', 'answer_key', 'hints', 'misconceptions']);

/** Pengurai CSV RFC 4180 (kutip ganda, koma, dan baris baru di dalam sel). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const BOM = String.fromCharCode(0xfeff);
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i += 1; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Sel yang diawali = + - @ dinetralkan agar tidak dibaca sebagai rumus oleh aplikasi lembar kerja. */
function safeCell(v: string): string {
  return /^[=+\-@]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v) && !v.startsWith('{') && !v.startsWith('[') ? `'${v}` : v;
}

export function toCsv(items: readonly ImportItem[]): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const it of items) {
    const rec = it as unknown as Record<string, unknown>;
    lines.push(
      CSV_COLUMNS.map((c) => {
        const v = rec[c];
        const s = JSON_COLUMNS.has(c) ? JSON.stringify(v ?? null) : v === null || v === undefined ? '' : String(v);
        return csvCell(c === 'statement' || c === 'explanation' || c === 'instructions' || c === 'source' ? safeCell(s) : s);
      }).join(','),
    );
  }
  return `${String.fromCharCode(0xfeff)}${lines.join('\r\n')}\r\n`;
}

export function parseImportCsv(text: string): ParseResult {
  const rows = parseCsv(text);
  const header = rows[0];
  if (!header) return { ok: false, message: 'Berkas CSV kosong.' };
  const missing = CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) return { ok: false, message: `Kolom CSV belum lengkap: ${missing.join(', ')}.` };
  const idx = new Map(header.map((h, i) => [h, i] as const));
  const raw: unknown[] = [];
  const pre: { index: number; message: string }[] = [];
  rows.slice(1).forEach((r, index) => {
    const obj: Record<string, unknown> = {};
    try {
      for (const c of CSV_COLUMNS) {
        const v = (r[idx.get(c) ?? -1] ?? '').trim();
        if (JSON_COLUMNS.has(c)) obj[c] = v === '' ? undefined : JSON.parse(v);
        else if (c === 'grade' || c === 'difficulty') obj[c] = Number(v);
        else if (c === 'recommended_seconds') obj[c] = v === '' ? null : Number(v);
        else if (c === 'ai_assisted') obj[c] = v.toLowerCase() === 'true';
        else obj[c] = (r[idx.get(c) ?? -1] ?? '').replace(/^'(?=[=+\-@])/, '');
      }
      raw.push(obj);
    } catch {
      pre.push({ index, message: 'kolom JSON tidak dapat dibaca' });
      raw.push(null);
    }
  });
  const res = validateItems(raw);
  if (!res.ok) return res;
  const bad = new Set(pre.map((p) => p.index));
  const errors = [...pre, ...res.errors.filter((e) => !bad.has(e.index))];
  return { ok: true, items: res.items, errors };
}
