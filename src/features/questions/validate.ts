import { gridMeasures, logicSolutions } from './solver';
import {
  OPTION_ID_PATTERN,
  type LogicClue,
  type Misconception,
  type Option,
  type QuestionPayload,
} from './model';

/**
 * Pemeriksaan kelengkapan di sisi klien. Aturan dan urutan pesan dibuat sejajar dengan
 * app.question_problems di database. Server tetap menjadi penentu: hasil di sini hanya
 * membantu penulis memperbaiki soal sebelum diajukan.
 */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const norm = (s: string) => s.trim().toLowerCase();

export function optionsProblems(options: unknown, min: number, max: number, label: string): string[] {
  if (!Array.isArray(options)) return [`${label} harus berupa daftar.`];
  const p: string[] = [];
  const n = options.length;
  if (n < min || n > max) p.push(`${label} harus berjumlah ${min} sampai ${max} (saat ini ${n}).`);
  const valid = options.every(
    (o) =>
      isObj(o) &&
      typeof o.id === 'string' &&
      OPTION_ID_PATTERN.test(o.id) &&
      typeof o.text === 'string' &&
      o.text.trim() !== '' &&
      o.text.length <= 200,
  );
  if (!valid) return [...p, `${label} tidak valid: setiap butir wajib memiliki id dan teks (maksimal 200 karakter).`];
  const list = options as Option[];
  if (new Set(list.map((o) => o.id)).size !== n) p.push(`${label} memiliki id ganda.`);
  if (new Set(list.map((o) => norm(o.text))).size !== n) p.push(`${label} memiliki teks ganda.`);
  return p;
}

export function misconceptionsProblems(
  miscs: unknown,
  optionIds: readonly string[],
  correct: readonly string[],
  requireForWrong: boolean,
): string[] {
  if (!Array.isArray(miscs)) return ['Miskonsepsi harus berupa daftar.'];
  const bad = miscs.some(
    (m) =>
      !isObj(m) ||
      typeof m.label !== 'string' ||
      m.label.trim() === '' ||
      m.label.length > 200 ||
      ('option_id' in m && typeof m.option_id !== 'string') ||
      ('value' in m && typeof m.value !== 'number'),
  );
  if (bad) {
    return ['Setiap miskonsepsi wajib berlabel (maksimal 200 karakter); option_id harus teks dan value harus angka.'];
  }
  const list = miscs as Misconception[];
  const p: string[] = [];
  if (list.some((m) => m.option_id !== undefined && !optionIds.includes(m.option_id))) {
    p.push('Miskonsepsi merujuk opsi yang tidak ada.');
  }
  if (list.some((m) => m.option_id !== undefined && correct.includes(m.option_id))) {
    p.push('Opsi yang benar tidak boleh diberi miskonsepsi.');
  }
  if (requireForWrong) {
    for (const id of optionIds) {
      if (!correct.includes(id) && !list.some((m) => m.option_id === id)) {
        p.push(`Opsi "${id.toUpperCase()}" yang salah belum diberi miskonsepsi yang ditargetkan.`);
      }
    }
  }
  return p;
}

export function cellsProblems(cells: unknown, rows: number, cols: number, min: number, label: string): string[] {
  if (!Array.isArray(cells)) return [`${label} harus berupa daftar petak.`];
  const seen = new Set<string>();
  for (const e of cells) {
    if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== 'number' || typeof e[1] !== 'number') {
      return [`${label} memuat petak yang tidak valid.`];
    }
    const [r, c] = e as [number, number];
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || c < 0 || r >= rows || c >= cols) {
      return [`${label} memuat petak di luar kisi.`];
    }
    const k = `${r},${c}`;
    if (seen.has(k)) return [`${label} memuat petak ganda.`];
    seen.add(k);
  }
  if (seen.size < min) return [`${label} minimal ${min} petak.`];
  return [];
}

function singleKey(key: Record<string, unknown>, optionIds: string[], miscs: unknown): string[] {
  const c = key.correct;
  if (typeof c !== 'string') return ['Kunci jawaban harus memilih tepat satu opsi.'];
  if (!optionIds.includes(c)) return ['Kunci jawaban merujuk opsi yang tidak ada.'];
  return misconceptionsProblems(miscs, optionIds, [c], true);
}

function multiKey(key: Record<string, unknown>, optionIds: string[], miscs: unknown): string[] {
  const c = key.correct;
  if (!Array.isArray(c)) return ['Kunci jawaban harus berupa daftar opsi yang benar.'];
  if (c.some((x) => typeof x !== 'string')) return ['Kunci jawaban harus berupa daftar id opsi.'];
  const correct = c as string[];
  if (new Set(correct).size !== correct.length) return ['Kunci jawaban memuat opsi ganda.'];
  if (correct.some((x) => !optionIds.includes(x))) return ['Kunci jawaban merujuk opsi yang tidak ada.'];
  if (correct.length < 1 || correct.length > optionIds.length - 1) {
    return ['Pilihan majemuk harus memiliki minimal satu jawaban benar dan minimal satu pengecoh.'];
  }
  return misconceptionsProblems(miscs, optionIds, correct, true);
}

function logicProblems(visual: Record<string, unknown>, key: Record<string, unknown>): string[] {
  const slots = visual.slots;
  if (typeof slots !== 'number') return ['Puzzle logika harus memiliki jumlah posisi.'];
  if (!Number.isInteger(slots) || slots < 3 || slots > 5) return ['Jumlah posisi harus 3 sampai 5.'];
  const ep = optionsProblems(visual.entities, slots, slots, 'Tokoh');
  if (ep.length > 0) return ep;
  const ids = (visual.entities as Option[]).map((o) => o.id);
  const clues = visual.clues;
  if (!Array.isArray(clues) || clues.length < 1 || clues.length > 12) {
    return ['Puzzle logika harus memiliki 1 sampai 12 petunjuk.'];
  }
  for (const c of clues) {
    if (!isObj(c)) return ['Petunjuk tidak valid.'];
    if (c.type === 'at' || c.type === 'not_at') {
      if (typeof c.entity !== 'string' || !ids.includes(c.entity) || typeof c.slot !== 'number') {
        return ['Petunjuk posisi harus merujuk tokoh yang ada dan nomor posisi.'];
      }
      if (!Number.isInteger(c.slot) || c.slot < 1 || c.slot > slots) return ['Nomor posisi pada petunjuk di luar rentang.'];
    } else if (c.type === 'left_of' || c.type === 'next_to') {
      if (
        typeof c.a !== 'string' || typeof c.b !== 'string' ||
        !ids.includes(c.a) || !ids.includes(c.b) || c.a === c.b
      ) {
        return ['Petunjuk hubungan harus merujuk dua tokoh berbeda yang ada.'];
      }
    } else {
      return ['Jenis petunjuk tidak dikenal.'];
    }
  }
  const sols = logicSolutions(ids, clues as LogicClue[]);
  if (sols.length !== 1) return [`Puzzle harus memiliki tepat satu solusi (saat ini ${sols.length}).`];
  const arr = key.arrangement;
  if (!Array.isArray(arr) || arr.some((x) => typeof x !== 'string')) {
    return ['Kunci susunan harus berupa daftar id tokoh per posisi.'];
  }
  const solved = sols[0] ?? [];
  if (arr.length !== solved.length || arr.some((x, i) => x !== solved[i])) {
    return ['Kunci susunan tidak sama dengan solusi puzzle.'];
  }
  return [];
}

/** Masalah pada pasangan (jenis jawaban, opsi, data visual, kunci, miskonsepsi). */
export function answerProblems(
  type: QuestionPayload['answer_type'],
  options: unknown,
  visual: unknown,
  key: unknown,
  miscs: unknown,
): string[] {
  if (!isObj(key)) return ['Kunci jawaban belum diisi.'];
  const noMisc = () => misconceptionsProblems(miscs, [], [], false);
  const emptyOptions = Array.isArray(options) && options.length === 0;

  switch (type) {
    case 'single_choice':
    case 'multi_choice':
    case 'possibilities': {
      const p = optionsProblems(options, 2, 6, 'Opsi jawaban');
      if (p.length > 0) return p;
      const ids = (options as Option[]).map((o) => o.id);
      return type === 'single_choice' ? singleKey(key, ids, miscs) : multiKey(key, ids, miscs);
    }
    case 'numeric':
      return [
        ...(emptyOptions ? [] : ['Soal isian angka tidak memakai opsi.']),
        ...(typeof key.value === 'number' ? [] : ['Kunci jawaban harus berupa satu angka.']),
        ...noMisc(),
      ];
    case 'true_false':
      return [
        ...(emptyOptions ? [] : ['Soal benar/salah tidak memakai opsi.']),
        ...(typeof key.value === 'boolean' ? [] : ['Kunci jawaban harus benar atau salah.']),
        ...noMisc(),
      ];
    case 'ordering': {
      const p = optionsProblems(options, 2, 6, 'Butir urutan');
      if (p.length === 0) {
        const ids = (options as Option[]).map((o) => o.id);
        const order = key.order;
        if (!Array.isArray(order) || order.some((x) => typeof x !== 'string')) {
          p.push('Kunci urutan harus berupa daftar id butir.');
        } else if (
          order.length !== ids.length ||
          new Set(order).size !== ids.length ||
          order.some((x) => !ids.includes(x as string))
        ) {
          p.push('Kunci urutan harus memuat semua butir tepat satu kali.');
        }
      }
      return [...p, ...noMisc()];
    }
    case 'matching': {
      if (!isObj(options)) return ['Soal mencocokkan membutuhkan kolom kiri dan kolom kanan.'];
      const p = [...optionsProblems(options.left, 2, 6, 'Kolom kiri'), ...optionsProblems(options.right, 2, 6, 'Kolom kanan')];
      if (p.length === 0) {
        const left = (options.left as Option[]).map((o) => o.id);
        const right = (options.right as Option[]).map((o) => o.id);
        const pairs = key.pairs;
        if (left.length !== right.length) {
          p.push('Jumlah butir kolom kiri dan kanan harus sama.');
        } else if (
          !Array.isArray(pairs) ||
          pairs.length !== left.length ||
          pairs.some((x) => !isObj(x) || typeof x.left !== 'string' || typeof x.right !== 'string')
        ) {
          p.push('Kunci pasangan harus memasangkan setiap butir kiri dengan tepat satu butir kanan.');
        } else {
          const pr = pairs as { left: string; right: string }[];
          if (
            new Set(pr.map((x) => x.left)).size !== left.length ||
            new Set(pr.map((x) => x.right)).size !== right.length ||
            pr.some((x) => !left.includes(x.left) || !right.includes(x.right))
          ) {
            p.push('Kunci pasangan harus satu-satu dan memakai id yang ada.');
          }
        }
      }
      return [...p, ...noMisc()];
    }
    case 'visual': {
      let p: string[];
      if (!isObj(visual)) {
        p = ['Data visual belum diisi.'];
      } else if (visual.kind === 'grid_select') {
        const { rows, cols } = visual;
        if (typeof rows !== 'number' || typeof cols !== 'number') {
          p = ['Kisi harus memiliki jumlah baris dan kolom.'];
        } else if (!isInt(rows) || !isInt(cols) || rows < 1 || rows > 10 || cols < 1 || cols > 10) {
          p = ['Kisi harus berukuran 1 sampai 10 baris dan kolom.'];
        } else {
          p = cellsProblems(key.cells, rows, cols, 1, 'Kunci petak');
        }
      } else if (visual.kind === 'number_line') {
        const { min, max, step } = visual;
        const v = key.value;
        if (typeof min !== 'number' || typeof max !== 'number' || typeof step !== 'number' || typeof v !== 'number') {
          p = ['Garis bilangan harus memiliki min, max, step, dan kunci berupa angka.'];
        } else if (max <= min || step <= 0 || (max - min) % step !== 0 || (max - min) / step > 100) {
          p = ['Garis bilangan tidak valid: max harus lebih besar dari min, step positif membagi rentang, dan maksimal 100 langkah.'];
        } else if (v < min || v > max || (v - min) % step !== 0) {
          p = ['Kunci harus berada pada garis bilangan dan tepat pada kelipatan langkah.'];
        } else {
          p = [];
        }
      } else {
        p = ['Jenis visual tidak dikenal.'];
      }
      return [...p, ...noMisc()];
    }
    case 'geometry_puzzle': {
      let p: string[];
      if (!isObj(visual) || visual.kind !== 'unit_grid') {
        p = ['Puzzle geometri membutuhkan data visual berjenis unit_grid.'];
      } else if (
        typeof visual.rows !== 'number' || typeof visual.cols !== 'number' ||
        (visual.measure !== 'area' && visual.measure !== 'perimeter') || typeof key.value !== 'number'
      ) {
        p = ['Kisi harus memiliki baris, kolom, ukuran (area atau perimeter), dan kunci berupa angka.'];
      } else if (!isInt(visual.rows) || !isInt(visual.cols) || visual.rows < 1 || visual.rows > 12 || visual.cols < 1 || visual.cols > 12) {
        p = ['Kisi harus berukuran 1 sampai 12 baris dan kolom.'];
      } else {
        p = cellsProblems(visual.cells, visual.rows, visual.cols, 1, 'Bangun');
        if (p.length === 0) {
          const m = gridMeasures(visual.cells as [number, number][]);
          if (visual.measure === 'area' && key.value !== m.area) p.push(`Kunci tidak sesuai bangun: luasnya ${m.area} petak.`);
          if (visual.measure === 'perimeter' && key.value !== m.perimeter) p.push(`Kunci tidak sesuai bangun: kelilingnya ${m.perimeter} satuan.`);
        }
      }
      return [...p, ...noMisc()];
    }
    case 'logic_puzzle': {
      const p = !isObj(visual) || visual.kind !== 'position_clues'
        ? ['Puzzle logika membutuhkan data visual berjenis position_clues.']
        : logicProblems(visual, key);
      return [...p, ...noMisc()];
    }
  }
}

export interface NodeRange {
  grade_min: number;
  grade_max: number;
}

/** Masalah kelengkapan satu soal; larik kosong berarti layak diajukan untuk telaah. */
export function questionProblems(q: QuestionPayload, node: NodeRange | null): string[] {
  const p: string[] = [];
  if (q.statement.trim() === '') p.push('Pernyataan soal wajib diisi.');
  if (q.source.trim() === '') p.push('Sumber soal wajib diisi.');
  if (node && (q.grade < node.grade_min || q.grade > node.grade_max)) {
    p.push(`Kelas sasaran soal (${q.grade}) di luar rentang kelas submateri (${node.grade_min} sampai ${node.grade_max}).`);
  }
  if (q.explanation.trim() === '') p.push('Pembahasan wajib diisi.');
  if (q.hints.length < 2 || q.hints.length > 3) {
    p.push('Petunjuk bertahap wajib berjumlah 2 sampai 3 butir.');
  } else if (q.hints.some((h) => h.trim() === '')) {
    p.push('Setiap petunjuk wajib berisi teks.');
  }
  return [...p, ...answerProblems(q.answer_type, q.options, q.visual_data, q.answer_key, q.misconceptions)];
}
