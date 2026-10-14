import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AnswerState } from '@/features/practice/answers';
import type { PracticeItem } from '@/features/practice/types';
import { PracticePage } from './PracticePage';

const item: PracticeItem = {
  version_id: '11111111-1111-4111-8111-111111111111', answer_type: 'single_choice', statement: 'Berapa 2 + 3?', instructions: 'Pilih satu.',
  options: [{ id: 'a', text: '4' }, { id: 'b', text: '5' }], visual_data: null, recommended_seconds: null, grade: 1, difficulty: 1,
  cognitive_level: 'L2', hints_total: 2,
};
const fns = { submit: vi.fn(), hint: vi.fn(), retry: vi.fn(), next: vi.fn(), finish: vi.fn(), setAnswer: vi.fn(), reload: vi.fn() };
let hook: Record<string, unknown>;
vi.mock('@/features/practice/hooks', () => ({ usePractice: () => hook }));

function base(over: Record<string, unknown> = {}) {
  const answer: AnswerState = { type: 'single_choice', choice: null };
  hook = {
    state: { phase: 'item', item }, answer, attemptsUsed: 0, maxAttempts: 2, hintsShown: [], progress: { finished: 3, target: 10 },
    feedback: null, busy: false, notice: null, ...fns, ...over,
  };
}
const renderPage = () => render(
  <MemoryRouter initialEntries={['/siswa/latihan/n1']}>
    <Routes><Route path="/siswa/latihan/:nodeId" element={<PracticePage />} /></Routes>
  </MemoryRouter>,
);
beforeEach(() => Object.values(fns).forEach((f) => f.mockClear()));

describe('PracticePage', () => {
  it('menampilkan soal, kemajuan, dan tombol petunjuk', async () => {
    base();
    renderPage();
    expect(screen.getByRole('heading', { name: 'Berapa 2 + 3?' })).toBeInTheDocument();
    expect(screen.getByText('Soal selesai: 3 dari 10')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Minta petunjuk' }));
    expect(fns.hint).toHaveBeenCalled();
  });
  it('menyembunyikan tombol petunjuk bila petunjuk habis', () => {
    base({ hintsShown: ['a', 'b'] });
    renderPage();
    expect(screen.queryByRole('button', { name: 'Minta petunjuk' })).toBeNull();
  });
  it('salah pada percobaan pertama: bahasa suportif, tanpa pembahasan, dapat mencoba lagi', async () => {
    base({ attemptsUsed: 1, feedback: { correct: false, finished: false, canRetry: true } });
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Belum tepat. Kamu masih punya satu kesempatan lagi.');
    expect(screen.queryByText(/Jawaban yang tepat/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Coba lagi/ }));
    expect(fns.retry).toHaveBeenCalled();
  });
  it('butir selesai dan salah: pembahasan tampil, tanpa kata yang mempermalukan', async () => {
    base({ attemptsUsed: 2, feedback: { correct: false, finished: true, canRetry: false, reveal: { answer_key: { correct: 'b' }, explanation: 'Dua ditambah tiga sama dengan lima.' } } });
    renderPage();
    expect(screen.getByText(/Jawaban yang tepat:/).parentElement).toHaveTextContent('5');
    expect(screen.getByText(/Dua ditambah tiga/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/salah besar|bodoh|gagal total|miskonsepsi/i);
    await userEvent.click(screen.getByRole('button', { name: 'Soal berikutnya' }));
    expect(fns.next).toHaveBeenCalled();
  });
  it('benar: tombol periksa hilang dan opsi terkunci', () => {
    base({ feedback: { correct: true, finished: true, canRetry: false, reveal: { answer_key: { correct: 'b' }, explanation: '' } } });
    renderPage();
    expect(screen.getByText('Tepat sekali!')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Periksa jawaban' })).toBeNull();
  });
  it('menampilkan galat jaringan dengan jawaban tetap utuh', () => {
    base({ notice: 'Koneksi terputus. Periksa jaringanmu, lalu coba lagi.' });
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Koneksi terputus');
    expect(screen.getByRole('button', { name: 'Periksa jawaban' })).toBeEnabled();
  });
  it('selesai: ringkasan tidak menilai kemampuan siswa', () => {
    base({ state: { phase: 'done', reason: 'target_reached', summary: { items: 10, first_try_correct: 6, correct_items: 8, hints_used: 3, attempts: 14 } } });
    renderPage();
    expect(screen.getByText(/bukan penilaian atas kemampuanmu/)).toBeInTheDocument();
    expect(screen.getByText('Benar pada percobaan pertama: 6')).toBeInTheDocument();
  });
  it('galat memuat menyediakan tombol coba lagi', async () => {
    base({ state: { phase: 'error', message: 'Materi ini untuk kelas yang lebih tinggi.' } });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(fns.reload).toHaveBeenCalled();
  });
});
