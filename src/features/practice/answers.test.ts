import { describe, expect, it } from 'vitest';
import { describeKey, emptyAnswer, fromResponse, isComplete, newIdempotencyKey, parseNumber, toResponse } from './answers';
import type { PracticeItem } from './types';

const item = (over: Partial<PracticeItem>): PracticeItem => ({
  version_id: '00000000-0000-4000-8000-000000000000', answer_type: 'single_choice', statement: 's', instructions: '',
  options: [{ id: 'a', text: 'Satu' }, { id: 'b', text: 'Dua' }], visual_data: null, recommended_seconds: null,
  grade: 2, difficulty: 2, cognitive_level: 'L2', hints_total: 2, ...over,
});

describe('parseNumber', () => {
  it('menerima bilangan bulat, negatif, dan desimal berkoma atau titik', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber(' -3 ')).toBe(-3);
    expect(parseNumber('2,5')).toBe(2.5);
    expect(parseNumber('2.5')).toBe(2.5);
  });
  it('menolak teks, kosong, dan angka terlalu besar', () => {
    for (const t of ['', 'abc', '1e5', '1.', '--1', '12 3', '99999999999']) expect(parseNumber(t)).toBeNull();
  });
});

describe('emptyAnswer, isComplete, toResponse', () => {
  it('pilihan tunggal belum lengkap sampai memilih', () => {
    const it1 = item({});
    const a = emptyAnswer(it1);
    expect(isComplete(a, it1)).toBe(false);
    expect(isComplete({ type: 'single_choice', choice: 'a' }, it1)).toBe(true);
    expect(toResponse({ type: 'single_choice', choice: 'a' })).toEqual({ choice: 'a' });
  });
  it('isian angka: respons berupa angka', () => {
    const it1 = item({ answer_type: 'numeric', options: [] });
    expect(isComplete({ type: 'numeric', text: 'x' }, it1)).toBe(false);
    expect(toResponse({ type: 'numeric', text: '7,5' })).toEqual({ value: 7.5 });
  });
  it('mengurutkan: keadaan awal mengikuti urutan penyajian dan selalu lengkap', () => {
    const it1 = item({ answer_type: 'ordering', options: [{ id: 'c', text: 'x' }, { id: 'a', text: 'y' }] });
    expect(emptyAnswer(it1)).toEqual({ type: 'ordering', order: ['c', 'a'] });
    expect(isComplete(emptyAnswer(it1), it1)).toBe(true);
  });
  it('mencocokkan: lengkap hanya bila semua butir kiri dipasangkan satu-satu', () => {
    const it1 = item({ answer_type: 'matching', options: { left: [{ id: 'l1', text: 'a' }, { id: 'l2', text: 'b' }], right: [{ id: 'r1', text: 'c' }, { id: 'r2', text: 'd' }] } });
    expect(isComplete({ type: 'matching', pairs: { l1: 'r1' } }, it1)).toBe(false);
    expect(isComplete({ type: 'matching', pairs: { l1: 'r1', l2: 'r1' } }, it1)).toBe(false);
    expect(isComplete({ type: 'matching', pairs: { l1: 'r2', l2: 'r1' } }, it1)).toBe(true);
    expect(toResponse({ type: 'matching', pairs: { l1: 'r2' } })).toEqual({ pairs: [{ left: 'l1', right: 'r2' }] });
  });
  it('puzzle logika: lengkap bila semua posisi terisi tokoh berbeda', () => {
    const it1 = item({ answer_type: 'logic_puzzle', options: [], visual_data: { kind: 'position_clues', slots: 3, entities: [{ id: 'x', text: 'A' }, { id: 'y', text: 'B' }, { id: 'z', text: 'C' }], clues: [] } });
    expect(emptyAnswer(it1)).toEqual({ type: 'logic', slots: [null, null, null] });
    expect(isComplete({ type: 'logic', slots: ['x', 'y', null] }, it1)).toBe(false);
    expect(isComplete({ type: 'logic', slots: ['x', 'x', 'z'] }, it1)).toBe(false);
    expect(isComplete({ type: 'logic', slots: ['x', 'y', 'z'] }, it1)).toBe(true);
  });
  it('visual memilih jenis jawaban dari bentuk interaksi', () => {
    expect(emptyAnswer(item({ answer_type: 'visual', options: [], visual_data: { kind: 'number_line', min: 0, max: 10, step: 1 } })).type).toBe('number_line');
    expect(emptyAnswer(item({ answer_type: 'visual', options: [], visual_data: { kind: 'grid_select', rows: 2, cols: 2 } })).type).toBe('grid');
  });
});

describe('fromResponse (pemulihan draf)', () => {
  it('memulihkan draf yang cocok dan menolak yang tidak cocok', () => {
    const it1 = item({ answer_type: 'ordering', options: [{ id: 'a', text: 'x' }, { id: 'b', text: 'y' }] });
    expect(fromResponse(it1, { order: ['b', 'a'] })).toEqual({ type: 'ordering', order: ['b', 'a'] });
    expect(fromResponse(it1, { order: ['b', 'zzz'] })).toBeNull();
    expect(fromResponse(it1, undefined)).toBeNull();
    expect(fromResponse(item({}), { choice: 5 })).toBeNull();
  });
});

describe('describeKey', () => {
  it('menyebut teks opsi, bukan id', () => {
    expect(describeKey(item({}), { correct: 'b' })).toBe('Dua');
    expect(describeKey(item({ answer_type: 'multi_choice' }), { correct: ['a', 'b'] })).toBe('Satu, Dua');
    expect(describeKey(item({ answer_type: 'true_false', options: [] }), { value: false })).toBe('Salah');
    expect(describeKey(item({ answer_type: 'numeric', options: [] }), { value: 12 })).toBe('12');
  });
});

describe('newIdempotencyKey', () => {
  it('menghasilkan kunci unik dengan panjang 8–80', () => {
    const a = newIdempotencyKey();
    expect(a).not.toBe(newIdempotencyKey());
    expect(a.length).toBeGreaterThanOrEqual(8);
    expect(a.length).toBeLessThanOrEqual(80);
  });
});
