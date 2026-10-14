import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { toDataMessage } from '@/lib/errors';
import type { ImportItem } from './importExport';
import {
  ANSWER_TYPES, COGNITIVE_LEVELS, DOMAINS, QUESTION_STATUSES, type QuestionPayload,
} from './model';

/** Pesan galat RPC. Hanya SQLSTATE berawalan MQ (ditulis server dalam bahasa Indonesia) yang boleh tampil. */
export function toQuestionMessage(error: unknown): string {
  const e = typeof error === 'object' && error !== null ? (error as { code?: unknown; message?: unknown }) : {};
  if (typeof e.code === 'string' && e.code.startsWith('MQ') && typeof e.message === 'string') {
    const m = e.message.trim();
    return m.charAt(0).toUpperCase() + m.slice(1) + (m.endsWith('.') ? '' : '.');
  }
  return toDataMessage(error);
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };
const NOT_CONFIGURED = { ok: false, message: 'Aplikasi belum dikonfigurasi.' } as const;

export const bankRowSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  status: z.enum(QUESTION_STATUSES),
  validated: z.boolean(),
  ai_assisted: z.boolean(),
  validation_notes: z.string().nullable(),
  created_by: z.string().uuid(),
  created_by_name: z.string().nullable(),
  reviewer_id: z.string().uuid().nullable(),
  reviewer_name: z.string().nullable(),
  node_id: z.string().uuid(),
  node_code: z.string(),
  node_title: z.string(),
  domain: z.enum(DOMAINS),
  version_id: z.string().uuid().nullable(),
  version_no: z.number().nullable(),
  statement: z.string().nullable(),
  grade: z.number().nullable(),
  cognitive_level: z.enum(COGNITIVE_LEVELS).nullable(),
  difficulty: z.number().nullable(),
  answer_type: z.enum(ANSWER_TYPES).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type BankRow = z.infer<typeof bankRowSchema>;

export const nodeSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  domain: z.enum(DOMAINS),
  title: z.string(),
  grade_min: z.number(),
  grade_max: z.number(),
  objectives: z.string(),
  concept_text: z.string(),
  source_note: z.string(),
  validation_status: z.enum(['belum_divalidasi', 'dalam_telaah', 'tervalidasi']),
  sort_order: z.number(),
});
export type CurriculumNode = z.infer<typeof nodeSchema>;

export const reviewEventSchema = z.object({
  id: z.string(),
  question_id: z.string().uuid(),
  actor_name: z.string().nullable(),
  event: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
});
export type ReviewEvent = z.infer<typeof reviewEventSchema>;

async function rpc<T>(name: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<ApiResult<T>> {
  if (!supabase) return NOT_CONFIGURED;
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { ok: false, message: toQuestionMessage(error) };
  const parsed = schema.safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, message: 'Jawaban server tidak dikenali.' };
}

const saveResult = z.object({ question_id: z.string().uuid(), version_id: z.string().uuid(), code: z.string(), status: z.enum(QUESTION_STATUSES) });
export const saveQuestion = (id: string | null, payload: QuestionPayload) =>
  rpc('save_question', { p_question_id: id, p_payload: payload }, saveResult);
const anyObj = z.record(z.unknown());
export const submitForReview = (id: string) => rpc('submit_question_for_review', { p_question_id: id }, anyObj);
export const reviewQuestion = (id: string, decision: 'approve' | 'return', notes: string) =>
  rpc('review_question', { p_question_id: id, p_decision: decision, p_notes: notes }, anyObj);
export const publishQuestion = (id: string) => rpc('publish_question', { p_question_id: id }, anyObj);
export const archiveQuestion = (id: string, notes: string) => rpc('archive_question', { p_question_id: id, p_notes: notes }, anyObj);

export const importResultSchema = z.array(z.object({
  index: z.number(), ok: z.boolean(), duplicate: z.boolean().optional(), error: z.string().optional(), code: z.string().optional(),
}));
export type ImportResult = z.infer<typeof importResultSchema>;
export const importQuestions = (items: readonly ImportItem[]) => rpc('import_questions', { p_items: items }, importResultSchema);

export async function listBank(): Promise<ApiResult<BankRow[]>> {
  if (!supabase) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('question_bank_v').select('*').order('code').limit(1000);
  if (error) return { ok: false, message: toDataMessage(error) };
  const parsed = z.array(bankRowSchema).safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, message: 'Data bank soal tidak dikenali.' };
}

export async function listNodes(): Promise<ApiResult<CurriculumNode[]>> {
  if (!supabase) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('curriculum_nodes').select('*').order('sort_order').order('code');
  if (error) return { ok: false, message: toDataMessage(error) };
  const parsed = z.array(nodeSchema).safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, message: 'Data kurikulum tidak dikenali.' };
}

export async function listPrerequisites(): Promise<ApiResult<{ node_id: string; prerequisite_id: string }[]>> {
  if (!supabase) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('curriculum_prerequisites').select('node_id, prerequisite_id');
  if (error) return { ok: false, message: toDataMessage(error) };
  const parsed = z.array(z.object({ node_id: z.string(), prerequisite_id: z.string() })).safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, message: 'Data prasyarat tidak dikenali.' };
}

const versionDetail = z.object({
  id: z.string().uuid(), question_id: z.string().uuid(), version_no: z.number(), statement: z.string(), instructions: z.string(),
  grade: z.number(), cognitive_level: z.enum(COGNITIVE_LEVELS), difficulty: z.number(), answer_type: z.enum(ANSWER_TYPES),
  options: z.unknown(), visual_data: z.unknown(), recommended_seconds: z.number().nullable(), source: z.string(), frozen_at: z.string().nullable(),
});
const keyDetail = z.object({ answer_key: z.record(z.unknown()), explanation: z.string(), hints: z.array(z.string()), misconceptions: z.array(z.record(z.unknown())) });

/** Isi lengkap versi aktif (termasuk kunci; hanya terbaca oleh staf yang berhak lewat RLS). */
export async function loadQuestionPayload(row: BankRow): Promise<ApiResult<QuestionPayload>> {
  if (!supabase) return NOT_CONFIGURED;
  if (!row.version_id) return { ok: false, message: 'Soal belum memiliki isi.' };
  const [v, k] = await Promise.all([
    supabase.from('question_versions').select('*').eq('id', row.version_id).single(),
    supabase.from('question_keys').select('answer_key, explanation, hints, misconceptions').eq('question_version_id', row.version_id).maybeSingle(),
  ]);
  if (v.error) return { ok: false, message: toDataMessage(v.error) };
  if (k.error) return { ok: false, message: toDataMessage(k.error) };
  const pv = versionDetail.safeParse(v.data);
  const pk = keyDetail.safeParse(k.data);
  if (!pv.success) return { ok: false, message: 'Isi soal tidak dikenali.' };
  if (!pk.success) return { ok: false, message: 'Kunci jawaban tidak dapat dibaca (mungkin Anda tidak berhak melihatnya).' };
  return {
    ok: true,
    data: {
      node_id: row.node_id, grade: pv.data.grade, cognitive_level: pv.data.cognitive_level, difficulty: pv.data.difficulty,
      answer_type: pv.data.answer_type, statement: pv.data.statement, instructions: pv.data.instructions,
      options: pv.data.options as QuestionPayload['options'], visual_data: (pv.data.visual_data ?? null) as QuestionPayload['visual_data'],
      recommended_seconds: pv.data.recommended_seconds, source: pv.data.source, ai_assisted: row.ai_assisted,
      answer_key: pk.data.answer_key, explanation: pk.data.explanation, hints: pk.data.hints,
      misconceptions: pk.data.misconceptions as unknown as QuestionPayload['misconceptions'],
    },
  };
}

export async function listReviewEvents(questionId: string): Promise<ApiResult<ReviewEvent[]>> {
  if (!supabase) return NOT_CONFIGURED;
  const { data, error } = await supabase.from('question_review_events_v').select('*').eq('question_id', questionId).order('created_at');
  if (error) return { ok: false, message: toDataMessage(error) };
  const parsed = z.array(reviewEventSchema).safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, message: 'Riwayat telaah tidak dikenali.' };
}

/** Memuat isi banyak soal sekaligus (untuk ekspor). Soal yang kuncinya tidak dapat dibaca dilewati dan dihitung. */
export async function loadPayloads(rows: readonly BankRow[]): Promise<ApiResult<{ items: (QuestionPayload & { node_code: string })[]; skipped: number }>> {
  if (!supabase) return NOT_CONFIGURED;
  const withVersion = rows.filter((r) => r.version_id);
  const items: (QuestionPayload & { node_code: string })[] = [];
  let skipped = rows.length - withVersion.length;
  for (let i = 0; i < withVersion.length; i += 100) {
    const chunk = withVersion.slice(i, i + 100);
    const ids = chunk.map((r) => r.version_id as string);
    const [v, k] = await Promise.all([
      supabase.from('question_versions').select('*').in('id', ids),
      supabase.from('question_keys').select('question_version_id, answer_key, explanation, hints, misconceptions').in('question_version_id', ids),
    ]);
    if (v.error) return { ok: false, message: toDataMessage(v.error) };
    if (k.error) return { ok: false, message: toDataMessage(k.error) };
    const vs = z.array(versionDetail).safeParse(v.data);
    const ks = z.array(keyDetail.extend({ question_version_id: z.string() })).safeParse(k.data);
    if (!vs.success || !ks.success) return { ok: false, message: 'Isi soal tidak dikenali.' };
    for (const row of chunk) {
      const ver = vs.data.find((x) => x.id === row.version_id);
      const key = ks.data.find((x) => x.question_version_id === row.version_id);
      if (!ver || !key) { skipped += 1; continue; }
      items.push({
        node_id: row.node_id, node_code: row.node_code, grade: ver.grade, cognitive_level: ver.cognitive_level, difficulty: ver.difficulty,
        answer_type: ver.answer_type, statement: ver.statement, instructions: ver.instructions,
        options: ver.options as QuestionPayload['options'], visual_data: (ver.visual_data ?? null) as QuestionPayload['visual_data'],
        recommended_seconds: ver.recommended_seconds, source: ver.source, ai_assisted: row.ai_assisted,
        answer_key: key.answer_key, explanation: key.explanation, hints: key.hints,
        misconceptions: key.misconceptions as unknown as QuestionPayload['misconceptions'],
      });
    }
  }
  return { ok: true, data: { items, skipped } };
}
