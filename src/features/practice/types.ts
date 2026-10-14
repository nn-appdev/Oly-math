import { z } from 'zod';
import { ANSWER_TYPES, COGNITIVE_LEVELS, DOMAINS } from '@/features/questions/model';

const optionSchema = z.object({ id: z.string(), text: z.string() });
const logicClueSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('at'), entity: z.string(), slot: z.number() }),
  z.object({ type: z.literal('not_at'), entity: z.string(), slot: z.number() }),
  z.object({ type: z.literal('left_of'), a: z.string(), b: z.string() }),
  z.object({ type: z.literal('next_to'), a: z.string(), b: z.string() }),
]);
export const visualSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('grid_select'), rows: z.number(), cols: z.number() }),
  z.object({ kind: z.literal('number_line'), min: z.number(), max: z.number(), step: z.number() }),
  z.object({
    kind: z.literal('unit_grid'), rows: z.number(), cols: z.number(),
    cells: z.array(z.tuple([z.number(), z.number()])), measure: z.enum(['area', 'perimeter']),
  }),
  z.object({ kind: z.literal('position_clues'), slots: z.number(), entities: z.array(optionSchema), clues: z.array(logicClueSchema) }),
]);
export type Visual = z.infer<typeof visualSchema>;

/** Butir yang disajikan ke siswa: tidak memuat kunci, pembahasan, atau teks petunjuk. */
export const practiceItemSchema = z.object({
  version_id: z.string().uuid(),
  answer_type: z.enum(ANSWER_TYPES),
  statement: z.string(),
  instructions: z.string(),
  options: z.union([z.array(optionSchema), z.object({ left: z.array(optionSchema), right: z.array(optionSchema) })]),
  visual_data: visualSchema.nullable(),
  recommended_seconds: z.number().nullable(),
  grade: z.number(),
  difficulty: z.number(),
  cognitive_level: z.enum(COGNITIVE_LEVELS),
  hints_total: z.number(),
});
export type PracticeItem = z.infer<typeof practiceItemSchema>;

export const nextItemSchema = z.discriminatedUnion('done', [
  z.object({ done: z.literal(true), reason: z.string() }),
  z.object({
    done: z.literal(false),
    item: practiceItemSchema,
    attempts_used: z.number(),
    max_attempts: z.number(),
    hints_used: z.number(),
    hints_shown: z.array(z.string()),
    draft: z.object({ response: z.record(z.unknown()).optional() }).nullable().optional(),
    progress: z.object({ finished: z.number(), target: z.number() }),
  }),
]);
export type NextItem = z.infer<typeof nextItemSchema>;

export const revealSchema = z.object({ answer_key: z.record(z.unknown()), explanation: z.string() });
export type Reveal = z.infer<typeof revealSchema>;

export const submitResultSchema = z.object({
  correct: z.boolean(),
  attempt_no: z.number(),
  finished: z.boolean(),
  can_retry: z.boolean(),
  hints_used: z.number(),
  duplicate: z.boolean().optional(),
  reveal: revealSchema.optional(),
});
export type SubmitResult = z.infer<typeof submitResultSchema>;

export const hintSchema = z.object({ hint: z.string(), index: z.number(), total: z.number() });
export const startSchema = z.object({ session_id: z.string().uuid(), resumed: z.boolean() });
export const summarySchema = z.object({
  items: z.number(), first_try_correct: z.number(), correct_items: z.number(), hints_used: z.number(), attempts: z.number(),
});
export type Summary = z.infer<typeof summarySchema>;

export const mapNodeSchema = z.object({
  id: z.string().uuid(), code: z.string(), domain: z.enum(DOMAINS), title: z.string(),
  grade_min: z.number(), grade_max: z.number(), objectives: z.string(), available: z.boolean(),
  question_count: z.number(), attempted_items: z.number(), correct_items: z.number(),
  last_practiced_at: z.string().nullable(), prerequisites: z.array(z.string()),
});
export type MapNode = z.infer<typeof mapNodeSchema>;
export const mapSchema = z.object({ grade: z.number().nullable(), nodes: z.array(mapNodeSchema) });

export const historyRowSchema = z.object({
  attempt_id: z.string().uuid(), created_at: z.string(), correct: z.boolean(), attempt_no: z.number(), hints_used: z.number(),
  statement: z.string(), answer_type: z.enum(ANSWER_TYPES), node_code: z.string(), node_title: z.string(), reviewable: z.boolean(),
});
export type HistoryRow = z.infer<typeof historyRowSchema>;

export const reviewSchema = z.object({
  item: z.object({
    version_id: z.string(), answer_type: z.enum(ANSWER_TYPES), statement: z.string(), instructions: z.string(),
    options: z.union([z.array(optionSchema), z.object({ left: z.array(optionSchema), right: z.array(optionSchema) })]),
    visual_data: visualSchema.nullable(),
  }),
  my_response: z.record(z.unknown()),
  correct: z.boolean(),
  reveal: revealSchema,
});
export type Review = z.infer<typeof reviewSchema>;
