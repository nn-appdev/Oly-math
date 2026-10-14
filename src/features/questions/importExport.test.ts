import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsv, parseImportCsv, parseImportJson, toCsv, type ImportItem } from './importExport';

const seed = readFileSync(resolve(process.cwd(), 'supabase/seed/questions_draft.json'), 'utf8');

describe('parseImportJson', () => {
  it('menerima seed 40 soal tanpa galat', () => {
    const r = parseImportJson(seed);
    expect(r.ok && r.items.length).toBe(40);
    expect(r.ok && r.errors).toEqual([]);
  });
  it('menolak JSON rusak, bukan daftar, kosong, dan melebihi batas', () => {
    expect(parseImportJson('{').ok).toBe(false);
    expect(parseImportJson('{}').ok).toBe(false);
    expect(parseImportJson('[]').ok).toBe(false);
    expect(parseImportJson(JSON.stringify(Array.from({ length: 201 }, () => ({})))).ok).toBe(false);
  });
  it('melaporkan butir yang salah dengan nomor indeksnya', () => {
    const r = parseImportJson(JSON.stringify([{ node_code: 'X', grade: 9 }]));
    expect(r.ok && r.errors[0]?.index).toBe(0);
  });
});

describe('CSV', () => {
  it('menguraikan kutip ganda, koma, dan baris baru dalam sel', () => {
    expect(parseCsv('a,b\r\n"x, y","baris1\nbaris2 ""kutip"""\r\n')).toEqual([['a', 'b'], ['x, y', 'baris1\nbaris2 "kutip"']]);
  });
  it('bolak-balik ekspor lalu impor mempertahankan seluruh soal', () => {
    const items = JSON.parse(seed) as ImportItem[];
    const csv = toCsv(items);
    const back = parseImportCsv(csv);
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.errors).toEqual([]);
      expect(back.items).toHaveLength(40);
      expect(back.items[0]?.statement).toBe(items[0]?.statement);
      expect(back.items[39]?.answer_key).toEqual(items[39]?.answer_key);
    }
  });
  it('menetralkan sel berawalan rumus saat ekspor dan memulihkannya saat impor', () => {
    const it0 = { ...(JSON.parse(seed) as ImportItem[])[0]!, statement: '=1+1 adalah dua' };
    const csv = toCsv([it0]);
    expect(csv).toContain("'=1+1 adalah dua");
    const back = parseImportCsv(csv);
    expect(back.ok && back.items[0]?.statement).toBe('=1+1 adalah dua');
  });
  it('menolak CSV tanpa kolom wajib', () => {
    const r = parseImportCsv('a,b\n1,2\n');
    expect(r.ok).toBe(false);
  });
});
