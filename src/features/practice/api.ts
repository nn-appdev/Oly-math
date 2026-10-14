import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { toQuestionMessage, type ApiResult } from '@/features/questions/api';
import {
  hintSchema, historyRowSchema, mapSchema, nextItemSchema, reviewSchema, startSchema, submitResultSchema, summarySchema,
} from './types';

const NOT_CONFIGURED = { ok: false, message: 'Aplikasi belum dikonfigurasi.' } as const;

/** Galat jaringan (bukan galat bisnis dari server): aman dicoba ulang dengan kunci idempotensi yang sama. */
export type PracticeResult<T> = ApiResult<T> & { retryable?: boolean };

async function rpc<T>(name: string, args: Record<string, unknown>, schema: z.ZodType<T>): Promise<PracticeResult<T>> {
  if (!supabase) return NOT_CONFIGURED;
  let res;
  try {
    res = await supabase.rpc(name, args);
  } catch {
    return { ok: false, message: 'Koneksi terputus. Periksa jaringanmu, lalu coba lagi.', retryable: true };
  }
  const { data, error } = res;
  if (error) {
    const code = (error as { code?: unknown }).code;
    const network = typeof code !== 'string' || code === '' || /fetch|network/i.test(error.message);
    return {
      ok: false,
      message: network ? 'Koneksi terputus. Periksa jaringanmu, lalu coba lagi.' : toQuestionMessage(error),
      retryable: network,
    };
  }
  const parsed = schema.safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, message: 'Jawaban server tidak dikenali.' };
}

export const startPractice = (nodeId: string, clientToken: string) =>
  rpc('start_practice', { p_node: nodeId, p_client_token: clientToken }, startSchema);
export const nextItem = (sessionId: string) => rpc('next_practice_item', { p_session: sessionId }, nextItemSchema);
export const requestHint = (sessionId: string, versionId: string) =>
  rpc('request_hint', { p_session: sessionId, p_version: versionId }, hintSchema);
export const submitAnswer = (sessionId: string, versionId: string, response: Record<string, unknown>, key: string) =>
  rpc('submit_answer', { p_session: sessionId, p_version: versionId, p_response: response, p_idempotency_key: key }, submitResultSchema);
export const saveDraft = (sessionId: string, versionId: string, response: Record<string, unknown>) =>
  rpc('save_draft', { p_session: sessionId, p_version: versionId, p_draft: { response } }, z.unknown().nullable());
export const endPractice = (sessionId: string) => rpc('end_practice', { p_session: sessionId }, summarySchema);
export const myLearningMap = () => rpc('my_learning_map', {}, mapSchema);
export const myHistory = (limit = 50) => rpc('my_history', { p_limit: limit }, z.array(historyRowSchema));
export const myReview = (attemptId: string) => rpc('my_review_item', { p_attempt: attemptId }, reviewSchema);

export const materialSchema = z.object({
  id: z.string().uuid(), code: z.string(), title: z.string(), objectives: z.string(), concept_text: z.string(),
  grade_min: z.number(), grade_max: z.number(),
});
export type Material = z.infer<typeof materialSchema>;

/** Materi dibaca langsung dari kurikulum (dapat dibaca semua pengguna masuk; tidak memuat soal atau kunci). */
export async function getMaterial(nodeId: string): Promise<PracticeResult<Material>> {
  if (!supabase) return NOT_CONFIGURED;
  const { data, error } = await supabase
    .from('curriculum_nodes').select('id, code, title, objectives, concept_text, grade_min, grade_max').eq('id', nodeId).maybeSingle();
  if (error) return { ok: false, message: toQuestionMessage(error) };
  if (!data) return { ok: false, message: 'Materi tidak ditemukan.' };
  const parsed = materialSchema.safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, message: 'Jawaban server tidak dikenali.' };
}
