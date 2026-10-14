/**
 * Model data soal. Format kanonik ini HARUS sama dengan yang divalidasi server
 * (supabase/migrations/20261013000004_questions_workflow.sql). Validasi klien hanya
 * membantu penulis; server tetap menjadi penentu terakhir.
 */

export const ANSWER_TYPES = [
  'single_choice',
  'multi_choice',
  'numeric',
  'true_false',
  'ordering',
  'matching',
  'possibilities',
  'visual',
  'geometry_puzzle',
  'logic_puzzle',
] as const;
export type AnswerType = (typeof ANSWER_TYPES)[number];

export const ANSWER_TYPE_LABEL: Record<AnswerType, string> = {
  single_choice: 'Pilihan tunggal',
  multi_choice: 'Pilihan majemuk',
  numeric: 'Isian angka',
  true_false: 'Benar atau salah',
  ordering: 'Mengurutkan',
  matching: 'Mencocokkan',
  possibilities: 'Kemungkinan',
  visual: 'Interaksi visual',
  geometry_puzzle: 'Puzzle geometri',
  logic_puzzle: 'Puzzle logika',
};

export const COGNITIVE_LEVELS = ['L1', 'L2', 'L3'] as const;
export type CognitiveLevel = (typeof COGNITIVE_LEVELS)[number];
export const COGNITIVE_LEVEL_LABEL: Record<CognitiveLevel, string> = {
  L1: 'L1 – Mengingat dan memahami',
  L2: 'L2 – Menerapkan',
  L3: 'L3 – Bernalar (HOTS)',
};

export const QUESTION_STATUSES = ['draft', 'review', 'published', 'archived'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];
export const STATUS_LABEL: Record<QuestionStatus, string> = {
  draft: 'Draf',
  review: 'Dalam telaah',
  published: 'Terbit',
  archived: 'Diarsipkan',
};

export const DOMAINS = ['bilangan', 'geometri', 'kombinatorik', 'data'] as const;
export type Domain = (typeof DOMAINS)[number];
export const DOMAIN_LABEL: Record<Domain, string> = {
  bilangan: 'Bilangan dan aritmetika',
  geometri: 'Geometri dan pengukuran',
  kombinatorik: 'Kombinatorik dan logika',
  data: 'Data dan pengukuran',
};

export interface Option {
  id: string;
  text: string;
}
export interface MatchingOptions {
  left: Option[];
  right: Option[];
}
export interface Misconception {
  label: string;
  option_id?: string;
  value?: number;
}

export type VisualData =
  | { kind: 'grid_select'; rows: number; cols: number }
  | { kind: 'number_line'; min: number; max: number; step: number }
  | { kind: 'unit_grid'; rows: number; cols: number; cells: [number, number][]; measure: 'area' | 'perimeter' }
  | { kind: 'position_clues'; slots: number; entities: Option[]; clues: LogicClue[] };

export type LogicClue =
  | { type: 'at'; entity: string; slot: number }
  | { type: 'not_at'; entity: string; slot: number }
  | { type: 'left_of'; a: string; b: string }
  | { type: 'next_to'; a: string; b: string };

/** Isi soal yang dikirim ke RPC save_question. */
export interface QuestionPayload {
  node_id: string;
  grade: number;
  cognitive_level: CognitiveLevel;
  difficulty: number;
  answer_type: AnswerType;
  statement: string;
  instructions: string;
  options: Option[] | MatchingOptions | [];
  visual_data: VisualData | null;
  recommended_seconds: number | null;
  source: string;
  ai_assisted: boolean;
  answer_key: Record<string, unknown>;
  explanation: string;
  hints: string[];
  misconceptions: Misconception[];
}

export const MAX_IMPORT_ITEMS = 200;
export const OPTION_ID_PATTERN = /^[a-z][a-z0-9]{0,7}$/;

/** Domain submateri → awalan kode soal (selaras dengan app.domain_prefix di database). */
export const DOMAIN_PREFIX: Record<Domain, string> = {
  bilangan: 'BIL',
  geometri: 'GEO',
  kombinatorik: 'KOM',
  data: 'DAT',
};
