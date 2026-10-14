import type { AuthState } from '@/features/auth/AuthContext';
import type { BankRow, CurriculumNode } from '@/features/questions/api';

export const ME = '11111111-1111-4111-8111-111111111111';
export const OTHER = '22222222-2222-4222-8222-222222222222';
export const NODE_ID = '33333333-3333-4333-8333-333333333333';

export const node: CurriculumNode = {
  id: NODE_ID, code: 'BIL-1-01', domain: 'bilangan', title: 'Mengenal bilangan', grade_min: 1, grade_max: 2,
  objectives: '', concept_text: '', source_note: '', validation_status: 'belum_divalidasi', sort_order: 10,
};

export function bankRow(over: Partial<BankRow> = {}): BankRow {
  return {
    id: '44444444-4444-4444-8444-444444444444', code: 'BIL-1-0001', status: 'draft', validated: false, ai_assisted: false,
    validation_notes: null, created_by: ME, created_by_name: 'Guru Satu', reviewer_id: null, reviewer_name: null,
    node_id: NODE_ID, node_code: 'BIL-1-01', node_title: 'Mengenal bilangan', domain: 'bilangan',
    version_id: '55555555-5555-4555-8555-555555555555', version_no: 1, statement: 'Berapa 2 + 3?', grade: 1,
    cognitive_level: 'L2', difficulty: 2, answer_type: 'numeric', created_at: '2026-10-13T00:00:00Z', updated_at: '2026-10-13T00:00:00Z',
    ...over,
  };
}

export function authValue(role: 'teacher' | 'admin' = 'teacher', id = ME): AuthState {
  return {
    status: 'ready', error: null,
    profile: { id, full_name: 'Guru Satu', role, grade: null, is_active: true },
    signIn: async () => ({ ok: true }), signOut: async () => undefined,
  };
}
