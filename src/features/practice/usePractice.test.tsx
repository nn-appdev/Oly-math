import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PracticeItem } from './types';

const api = vi.hoisted(() => ({
  startPractice: vi.fn(), nextItem: vi.fn(), requestHint: vi.fn(), submitAnswer: vi.fn(), saveDraft: vi.fn(), endPractice: vi.fn(),
  myLearningMap: vi.fn(), myHistory: vi.fn(), myReview: vi.fn(), getMaterial: vi.fn(),
}));
vi.mock('./api', () => api);
import { usePractice } from './hooks';

const SID = '11111111-1111-4111-8111-111111111111';
const item: PracticeItem = {
  version_id: SID, answer_type: 'single_choice', statement: 'S', instructions: '', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
  visual_data: null, recommended_seconds: null, grade: 1, difficulty: 1, cognitive_level: 'L2', hints_total: 1,
};
const next = (over: Record<string, unknown> = {}) => ({
  ok: true, data: { done: false, item, attempts_used: 0, max_attempts: 2, hints_used: 0, hints_shown: [], draft: null, progress: { finished: 0, target: 10 }, ...over },
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.startPractice.mockResolvedValue({ ok: true, data: { session_id: SID, resumed: false } });
  api.nextItem.mockResolvedValue(next());
  api.saveDraft.mockResolvedValue({ ok: true, data: null });
});

async function ready() {
  const h = renderHook(() => usePractice('node-1'));
  await waitFor(() => expect(h.result.current.state.phase).toBe('item'));
  return h;
}

describe('usePractice', () => {
  it('memulihkan draf dari server', async () => {
    api.nextItem.mockResolvedValue(next({ draft: { response: { choice: 'b' } } }));
    const h = await ready();
    expect(h.result.current.answer).toEqual({ type: 'single_choice', choice: 'b' });
  });
  it('mengirim ulang dengan kunci idempotensi yang sama setelah galat jaringan', async () => {
    const h = await ready();
    act(() => h.result.current.setAnswer({ type: 'single_choice', choice: 'a' }));
    api.submitAnswer.mockResolvedValueOnce({ ok: false, message: 'Koneksi terputus.', retryable: true });
    await act(async () => { await h.result.current.submit(); });
    expect(h.result.current.notice).toBe('Koneksi terputus.');
    api.submitAnswer.mockResolvedValueOnce({ ok: true, data: { correct: true, attempt_no: 1, finished: true, can_retry: false, hints_used: 0 } });
    await act(async () => { await h.result.current.submit(); });
    const [k1, k2] = api.submitAnswer.mock.calls.map((c) => c[3] as string);
    expect(k1).toBeTruthy();
    expect(k2).toBe(k1);
    expect(h.result.current.feedback?.correct).toBe(true);
  });
  it('mengubah jawaban membuat kunci idempotensi baru', async () => {
    const h = await ready();
    api.submitAnswer.mockResolvedValue({ ok: false, message: 'x', retryable: true });
    act(() => h.result.current.setAnswer({ type: 'single_choice', choice: 'a' }));
    await act(async () => { await h.result.current.submit(); });
    act(() => h.result.current.setAnswer({ type: 'single_choice', choice: 'b' }));
    await act(async () => { await h.result.current.submit(); });
    expect(api.submitAnswer.mock.calls[0]?.[3]).not.toBe(api.submitAnswer.mock.calls[1]?.[3]);
  });
  it('mencegah pengiriman ganda saat permintaan masih berjalan', async () => {
    const h = await ready();
    act(() => h.result.current.setAnswer({ type: 'single_choice', choice: 'a' }));
    let release: (v: unknown) => void = () => undefined;
    api.submitAnswer.mockReturnValue(new Promise((r) => { release = r; }));
    let p1: Promise<unknown> | undefined;
    act(() => { p1 = h.result.current.submit(); });
    await act(async () => { await h.result.current.submit(); });
    expect(api.submitAnswer).toHaveBeenCalledTimes(1);
    await act(async () => { release({ ok: true, data: { correct: false, attempt_no: 1, finished: false, can_retry: true, hints_used: 0 } }); await p1; });
    expect(h.result.current.feedback).toMatchObject({ correct: false, canRetry: true });
  });
  it('tidak mengirim jawaban yang belum lengkap', async () => {
    const h = await ready();
    await act(async () => { await h.result.current.submit(); });
    expect(api.submitAnswer).not.toHaveBeenCalled();
  });
  it('menyimpan draf setelah jeda, bukan pada setiap perubahan', async () => {
    vi.useFakeTimers();
    try {
      const h = renderHook(() => usePractice('node-1'));
      await vi.waitFor(() => expect(h.result.current.state.phase).toBe('item'));
      act(() => h.result.current.setAnswer({ type: 'single_choice', choice: 'a' }));
      act(() => h.result.current.setAnswer({ type: 'single_choice', choice: 'b' }));
      expect(api.saveDraft).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
      expect(api.saveDraft).toHaveBeenCalledTimes(1);
      expect(api.saveDraft).toHaveBeenCalledWith(SID, SID, { choice: 'b' });
    } finally {
      vi.useRealTimers();
    }
  });
  it('menampilkan ringkasan saat server menyatakan latihan selesai', async () => {
    api.nextItem.mockResolvedValue({ ok: true, data: { done: true, reason: 'target_reached' } });
    api.endPractice.mockResolvedValue({ ok: true, data: { items: 10, first_try_correct: 5, correct_items: 7, hints_used: 2, attempts: 15 } });
    const h = renderHook(() => usePractice('node-1'));
    await waitFor(() => expect(h.result.current.state.phase).toBe('done'));
    expect(h.result.current.state).toMatchObject({ reason: 'target_reached', summary: { items: 10 } });
  });
});
