import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { QuestionPayload } from './model';
import { answerProblems, questionProblems } from './validate';

const base = (over: Partial<QuestionPayload> = {}): QuestionPayload => ({
  node_id: '00000000-0000-4000-8000-000000000000', grade: 2, cognitive_level: 'L3', difficulty: 3,
  answer_type: 'single_choice', statement: 'Berapa 3 + 4?', instructions: '',
  options: [{ id: 'a', text: '6' }, { id: 'b', text: '7' }, { id: 'c', text: '8' }],
  visual_data: null, recommended_seconds: 60, source: 'Karya guru', ai_assisted: false,
  answer_key: { correct: 'b' }, explanation: 'Tiga ditambah empat sama dengan tujuh.',
  hints: ['Hitung maju dari 3.', 'Tambahkan 4 satu per satu.'],
  misconceptions: [{ label: 'Kurang satu', option_id: 'a' }, { label: 'Lebih satu', option_id: 'c' }],
  ...over,
});
const node = { grade_min: 1, grade_max: 3 };

describe('questionProblems', () => {
  it('menerima soal lengkap', () => expect(questionProblems(base(), node)).toEqual([]));
  it('menolak pernyataan, sumber, dan pembahasan kosong', () => {
    const p = questionProblems(base({ statement: ' ', source: '', explanation: '' }), node);
    expect(p).toEqual(expect.arrayContaining(['Pernyataan soal wajib diisi.', 'Sumber soal wajib diisi.', 'Pembahasan wajib diisi.']));
  });
  it('menolak kelas di luar rentang submateri', () => {
    expect(questionProblems(base({ grade: 3 }), { grade_min: 1, grade_max: 2 })[0]).toMatch(/di luar rentang/);
  });
  it('mewajibkan 2 sampai 3 petunjuk', () => {
    expect(questionProblems(base({ hints: ['satu'] }), node)).toContain('Petunjuk bertahap wajib berjumlah 2 sampai 3 butir.');
    expect(questionProblems(base({ hints: ['a', 'b', 'c', 'd'] }), node)).toContain('Petunjuk bertahap wajib berjumlah 2 sampai 3 butir.');
  });
  it('mewajibkan miskonsepsi pada setiap opsi salah', () => {
    const p = questionProblems(base({ misconceptions: [{ label: 'x', option_id: 'a' }] }), node);
    expect(p).toContain('Opsi "C" yang salah belum diberi miskonsepsi yang ditargetkan.');
  });
  it('menolak miskonsepsi pada opsi benar', () => {
    const p = questionProblems(base({ misconceptions: [{ label: 'x', option_id: 'a' }, { label: 'y', option_id: 'b' }, { label: 'z', option_id: 'c' }] }), node);
    expect(p).toContain('Opsi yang benar tidak boleh diberi miskonsepsi.');
  });
  it('menolak id dan teks opsi ganda', () => {
    expect(answerProblems('single_choice', [{ id: 'a', text: '1' }, { id: 'a', text: '2' }], null, { correct: 'a' }, [])).toContain('Opsi jawaban memiliki id ganda.');
    expect(answerProblems('single_choice', [{ id: 'a', text: '1' }, { id: 'b', text: ' 1 ' }], null, { correct: 'a' }, [])).toContain('Opsi jawaban memiliki teks ganda.');
  });
});

describe('answerProblems per jenis', () => {
  it('multi_choice wajib memiliki pengecoh', () => {
    const o = [{ id: 'a', text: '1' }, { id: 'b', text: '2' }];
    expect(answerProblems('multi_choice', o, null, { correct: ['a', 'b'] }, [])).toContain(
      'Pilihan majemuk harus memiliki minimal satu jawaban benar dan minimal satu pengecoh.');
  });
  it('numeric dan true_false memeriksa tipe kunci', () => {
    expect(answerProblems('numeric', [], null, { value: 'tujuh' }, [])).toContain('Kunci jawaban harus berupa satu angka.');
    expect(answerProblems('numeric', [], null, { value: 7 }, [])).toEqual([]);
    expect(answerProblems('true_false', [], null, { value: 'ya' }, [])).toContain('Kunci jawaban harus benar atau salah.');
  });
  it('ordering wajib memuat semua butir', () => {
    const o = [{ id: 'a', text: '1' }, { id: 'b', text: '2' }];
    expect(answerProblems('ordering', o, null, { order: ['a'] }, [])).toContain('Kunci urutan harus memuat semua butir tepat satu kali.');
    expect(answerProblems('ordering', o, null, { order: ['b', 'a'] }, [])).toEqual([]);
  });
  it('matching wajib satu-satu', () => {
    const o = { left: [{ id: 'l1', text: 'a' }, { id: 'l2', text: 'b' }], right: [{ id: 'r1', text: 'c' }, { id: 'r2', text: 'd' }] };
    expect(answerProblems('matching', o, null, { pairs: [{ left: 'l1', right: 'r1' }, { left: 'l2', right: 'r1' }] }, [])).toContain('Kunci pasangan harus satu-satu dan memakai id yang ada.');
    expect(answerProblems('matching', o, null, { pairs: [{ left: 'l1', right: 'r1' }, { left: 'l2', right: 'r2' }] }, [])).toEqual([]);
  });
  it('visual: petak di luar kisi dan garis bilangan di luar langkah ditolak', () => {
    expect(answerProblems('visual', [], { kind: 'grid_select', rows: 3, cols: 3 }, { cells: [[5, 5]] }, [])).toContain('Kunci petak memuat petak di luar kisi.');
    expect(answerProblems('visual', [], { kind: 'number_line', min: 0, max: 20, step: 2 }, { value: 13 }, [])).toContain('Kunci harus berada pada garis bilangan dan tepat pada kelipatan langkah.');
  });
  it('geometry_puzzle memeriksa kunci terhadap bangun', () => {
    const v = { kind: 'unit_grid', rows: 4, cols: 4, cells: [[0, 0], [0, 1], [1, 0], [1, 1]], measure: 'perimeter' };
    expect(answerProblems('geometry_puzzle', [], v, { value: 4 }, [])).toContain('Kunci tidak sesuai bangun: kelilingnya 8 satuan.');
    expect(answerProblems('geometry_puzzle', [], v, { value: 8 }, [])).toEqual([]);
  });
  it('logic_puzzle wajib bersolusi tunggal dan kunci sesuai', () => {
    const ents = [{ id: 'x', text: 'Ani' }, { id: 'y', text: 'Budi' }, { id: 'z', text: 'Cici' }];
    const v = (clues: unknown[]) => ({ kind: 'position_clues', slots: 3, entities: ents, clues });
    expect(answerProblems('logic_puzzle', [], v([{ type: 'at', entity: 'x', slot: 1 }]), { arrangement: ['x', 'y', 'z'] }, []))
      .toContain('Puzzle harus memiliki tepat satu solusi (saat ini 2).');
    const ok = v([{ type: 'at', entity: 'x', slot: 1 }, { type: 'left_of', a: 'y', b: 'z' }]);
    expect(answerProblems('logic_puzzle', [], ok, { arrangement: ['x', 'y', 'z'] }, [])).toEqual([]);
    expect(answerProblems('logic_puzzle', [], ok, { arrangement: ['x', 'z', 'y'] }, [])).toContain('Kunci susunan tidak sama dengan solusi puzzle.');
  });
});

describe('seed soal awal', () => {
  const seed = JSON.parse(readFileSync(resolve(process.cwd(), 'supabase/seed/questions_draft.json'), 'utf8')) as (QuestionPayload & { node_code: string })[];
  it('berisi 40 soal dan semuanya lolos validasi klien', () => {
    expect(seed).toHaveLength(40);
    for (const q of seed) expect(questionProblems(q, null), q.statement.slice(0, 40)).toEqual([]);
  });
  it('tidak ada pernyataan ganda dalam satu submateri', () => {
    const keys = seed.map((q) => `${q.node_code}|${q.statement.trim().toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('semua soal awal bertanda bantuan AI dan bersumber jelas', () => {
    expect(seed.every((q) => q.ai_assisted && q.source.includes('belum ditelaah'))).toBe(true);
  });
});
