import { useCallback, useEffect, useRef, useState } from 'react';
import { useLoader } from '@/features/questions/hooks';
import {
  endPractice, getMaterial, myHistory, myLearningMap, myReview, nextItem, requestHint, saveDraft, startPractice, submitAnswer,
  type PracticeResult,
} from './api';
import { emptyAnswer, fromResponse, isComplete, newIdempotencyKey, toResponse, type AnswerState } from './answers';
import type { PracticeItem, Reveal, Summary } from './types';

export const useLearningMap = () => useLoader(myLearningMap);
export const useHistory = () => useLoader(() => myHistory(50));
export const useReview = (attemptId: string) => useLoader(() => myReview(attemptId));
export const useMaterial = (id: string) => useLoader(() => getMaterial(id));

export type Feedback = { correct: boolean; finished: boolean; canRetry: boolean; reveal?: Reveal };

export type PracticeState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'item'; item: PracticeItem }
  | { phase: 'done'; reason: string; summary: Summary | null };

const DRAFT_DELAY_MS = 1500;

/** Mengelola satu sesi latihan. Semua penilaian terjadi di server; hook ini hanya menyajikan dan mengirim. */
export function usePractice(nodeId: string) {
  const [state, setState] = useState<PracticeState>({ phase: 'loading' });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answer, setAnswerState] = useState<AnswerState | null>(null);
  const [attemptsUsed, setAttemptsUsed] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [hintsShown, setHintsShown] = useState<string[]>([]);
  const [progress, setProgress] = useState({ finished: 0, target: 10 });
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const busyRef = useRef(false);
  const keyRef = useRef<string | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef(newIdempotencyKey());

  const clearDraftTimer = () => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = null;
  };

  const loadNext = useCallback(async (sid: string) => {
    const r = await nextItem(sid);
    if (!r.ok) return setState({ phase: 'error', message: r.message });
    if (r.data.done) {
      const s = await endPractice(sid);
      return setState({ phase: 'done', reason: r.data.reason, summary: s.ok ? s.data : null });
    }
    const d = r.data;
    setAttemptsUsed(d.attempts_used);
    setMaxAttempts(d.max_attempts);
    setHintsShown(d.hints_shown);
    setProgress(d.progress);
    setFeedback(null);
    keyRef.current = null;
    setAnswerState(fromResponse(d.item, d.draft?.response) ?? emptyAnswer(d.item));
    setState({ phase: 'item', item: d.item });
  }, []);

  const start = useCallback(async () => {
    setState({ phase: 'loading' });
    const r = await startPractice(nodeId, tokenRef.current);
    if (!r.ok) return setState({ phase: 'error', message: r.message });
    setSessionId(r.data.session_id);
    await loadNext(r.data.session_id);
  }, [nodeId, loadNext]);

  useEffect(() => {
    void start();
    return clearDraftTimer;
  }, [start]);

  const setAnswer = useCallback((a: AnswerState) => {
    setAnswerState(a);
    keyRef.current = null; // jawaban berubah: kunci idempotensi baru untuk pengiriman berikutnya
    if (!sessionId || state.phase !== 'item') return;
    const versionId = state.item.version_id;
    clearDraftTimer();
    draftTimer.current = setTimeout(() => {
      void saveDraft(sessionId, versionId, toResponse(a));
    }, DRAFT_DELAY_MS);
  }, [sessionId, state]);

  const submit = useCallback(async (): Promise<PracticeResult<unknown> | null> => {
    if (busyRef.current || !sessionId || state.phase !== 'item' || !answer || !isComplete(answer, state.item)) return null;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    clearDraftTimer();
    keyRef.current ??= newIdempotencyKey();
    const r = await submitAnswer(sessionId, state.item.version_id, toResponse(answer), keyRef.current);
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) {
      // kunci tetap dipertahankan agar percobaan ulang tidak dihitung ganda
      setNotice(r.message);
      return r;
    }
    keyRef.current = null;
    setAttemptsUsed(r.data.attempt_no);
    setFeedback({ correct: r.data.correct, finished: r.data.finished, canRetry: r.data.can_retry, reveal: r.data.reveal });
    if (r.data.finished) setProgress((p) => ({ ...p, finished: r.data.duplicate ? p.finished : p.finished + 1 }));
    return r;
  }, [sessionId, state, answer]);

  const hint = useCallback(async () => {
    if (busyRef.current || !sessionId || state.phase !== 'item') return;
    busyRef.current = true;
    setBusy(true);
    const r = await requestHint(sessionId, state.item.version_id);
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) return setNotice(r.message);
    setHintsShown((h) => (h.length < r.data.index ? [...h, r.data.hint] : h));
  }, [sessionId, state]);

  const retry = useCallback(() => {
    if (state.phase !== 'item') return;
    setFeedback(null);
    keyRef.current = null;
    setAnswerState(emptyAnswer(state.item));
  }, [state]);

  const next = useCallback(async () => {
    if (!sessionId) return;
    setState({ phase: 'loading' });
    await loadNext(sessionId);
  }, [sessionId, loadNext]);

  const finish = useCallback(async () => {
    if (!sessionId) return;
    clearDraftTimer();
    const s = await endPractice(sessionId);
    setState({ phase: 'done', reason: 'stopped', summary: s.ok ? s.data : null });
  }, [sessionId]);

  return { state, answer, setAnswer, attemptsUsed, maxAttempts, hintsShown, progress, feedback, busy, notice, submit, hint, retry, next, finish, reload: start };
}
