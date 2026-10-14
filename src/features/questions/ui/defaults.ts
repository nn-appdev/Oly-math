import type { AnswerType, Option, QuestionPayload } from '../model';

export const LETTERS = 'abcdefgh'.split('');
export const nextId = (used: readonly string[], prefix = ''): string => {
  for (let i = 1; i < 100; i += 1) {
    const id = prefix ? `${prefix}${i}` : (LETTERS[i - 1] ?? `o${i}`);
    if (!used.includes(id)) return id;
  }
  return `${prefix}x`;
};
const opts = (n: number, prefix = ''): Option[] =>
  Array.from({ length: n }, (_, i) => ({ id: prefix ? `${prefix}${i + 1}` : (LETTERS[i] ?? `o${i}`), text: '' }));

export type AnswerPart = Pick<QuestionPayload, 'options' | 'visual_data' | 'answer_key' | 'misconceptions'>;

/** Struktur jawaban awal setiap jenis soal (belum lengkap sehingga tidak lolos validasi sampai diisi). */
export function defaultsFor(type: AnswerType): AnswerPart {
  switch (type) {
    case 'single_choice':
    case 'possibilities':
    case 'multi_choice':
      return { options: opts(4), visual_data: null, answer_key: type === 'single_choice' ? { correct: 'a' } : { correct: ['a'] }, misconceptions: [] };
    case 'numeric':
      return { options: [], visual_data: null, answer_key: { value: 0 }, misconceptions: [] };
    case 'true_false':
      return { options: [], visual_data: null, answer_key: { value: true }, misconceptions: [] };
    case 'ordering':
      return { options: opts(3), visual_data: null, answer_key: { order: ['a', 'b', 'c'] }, misconceptions: [] };
    case 'matching':
      return {
        options: { left: opts(3, 'l'), right: opts(3, 'r') },
        visual_data: null,
        answer_key: { pairs: [1, 2, 3].map((i) => ({ left: `l${i}`, right: `r${i}` })) },
        misconceptions: [],
      };
    case 'visual':
      return { options: [], visual_data: { kind: 'grid_select', rows: 3, cols: 3 }, answer_key: { cells: [] }, misconceptions: [] };
    case 'geometry_puzzle':
      return { options: [], visual_data: { kind: 'unit_grid', rows: 4, cols: 4, cells: [], measure: 'area' }, answer_key: { value: 0 }, misconceptions: [] };
    case 'logic_puzzle':
      return {
        options: [],
        visual_data: { kind: 'position_clues', slots: 3, entities: opts(3, 'e'), clues: [] },
        answer_key: { arrangement: [] },
        misconceptions: [],
      };
  }
}

export function emptyPayload(nodeId = ''): QuestionPayload {
  return {
    node_id: nodeId, grade: 1, cognitive_level: 'L3', difficulty: 3, answer_type: 'single_choice',
    statement: '', instructions: '', recommended_seconds: 90, source: '', ai_assisted: false,
    explanation: '', hints: ['', ''], ...defaultsFor('single_choice'),
  };
}
