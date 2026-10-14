import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/features/auth/AuthContext';
import type { BankRow } from '@/features/questions/api';
import type { QuestionPayload } from '@/features/questions/model';
import { authValue, bankRow, NODE_ID, OTHER } from '@/test/fixtures';
import { QuestionEditorPage } from './QuestionEditorPage';

const api = vi.hoisted(() => ({
  saveQuestion: vi.fn(), submitForReview: vi.fn(), reviewQuestion: vi.fn(), publishQuestion: vi.fn(), archiveQuestion: vi.fn(),
  loadQuestionPayload: vi.fn(), listReviewEvents: vi.fn(),
}));
vi.mock('@/features/questions/api', () => api);
const bank = vi.hoisted(() => ({ rows: [] as BankRow[] }));
vi.mock('@/features/questions/hooks', async () => {
  const { node: n } = await import('@/test/fixtures');
  return { useNodes: () => [{ status: 'ready', data: [n] }, () => undefined], useBank: () => [{ status: 'ready', data: bank.rows }, () => undefined] };
});

const complete: QuestionPayload = {
  node_id: NODE_ID, grade: 1, cognitive_level: 'L2', difficulty: 2, answer_type: 'numeric', statement: 'Berapa 2 + 3?', instructions: '',
  options: [], visual_data: null, recommended_seconds: 60, source: 'Karya guru', ai_assisted: false, answer_key: { value: 5 },
  explanation: 'Dua ditambah tiga sama dengan lima.', hints: ['Hitung maju dari 2.', 'Tambahkan 3.'], misconceptions: [],
};

function renderAt(path: string, role: 'teacher' | 'admin' = 'teacher') {
  render(
    <AuthContext.Provider value={authValue(role)}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/guru/soal/baru" element={<QuestionEditorPage />} />
          <Route path="/guru/soal/:id" element={<QuestionEditorPage />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.loadQuestionPayload.mockResolvedValue({ ok: true, data: complete });
  api.listReviewEvents.mockResolvedValue({ ok: true, data: [] });
  bank.rows = [];
});

describe('QuestionEditorPage — soal baru', () => {
  it('menampilkan kekurangan dan menonaktifkan pengajuan sampai lengkap', () => {
    renderAt('/guru/soal/baru');
    expect(screen.getByText('Pernyataan soal wajib diisi.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan dan ajukan telaah' })).toBeDisabled();
  });
  it('menolak simpan tanpa submateri dan tidak memanggil server', async () => {
    renderAt('/guru/soal/baru');
    await userEvent.click(screen.getByRole('button', { name: 'Simpan draf' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Pilih submateri');
    expect(api.saveQuestion).not.toHaveBeenCalled();
  });
  it('menyimpan draf dan menampilkan galat server apa adanya bila ditolak', async () => {
    api.saveQuestion.mockResolvedValue({ ok: false, message: 'Kelas sasaran harus 1, 2, atau 3.' });
    renderAt('/guru/soal/baru');
    await userEvent.selectOptions(screen.getByLabelText('Submateri'), NODE_ID);
    await userEvent.click(screen.getByRole('button', { name: 'Simpan draf' }));
    await waitFor(() => expect(api.saveQuestion).toHaveBeenCalledTimes(1));
    expect(api.saveQuestion.mock.calls[0]?.[0]).toBeNull();
    expect(api.saveQuestion.mock.calls[0]?.[1]).toMatchObject({ node_id: NODE_ID, answer_type: 'single_choice' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Kelas sasaran harus 1, 2, atau 3.');
  });
  it('menampilkan batas kelas submateri dan mengoreksi kelas saat submateri dipilih', async () => {
    renderAt('/guru/soal/baru');
    await userEvent.selectOptions(screen.getByLabelText('Submateri'), NODE_ID);
    expect(screen.getByText('Rentang submateri: kelas 1–2')).toBeInTheDocument();
  });
  it('pratinjau tidak membocorkan kunci jawaban', async () => {
    renderAt('/guru/soal/baru');
    await userEvent.type(screen.getByLabelText('Pernyataan soal'), 'Berapa 2 + 3?');
    const preview = screen.getByRole('region', { name: 'Pratinjau soal' });
    expect(preview).toHaveTextContent('Berapa 2 + 3?');
    expect(preview).not.toHaveTextContent('Kunci');
  });
});

describe('QuestionEditorPage — alur telaah', () => {
  const id = '44444444-4444-4444-8444-444444444444';
  it('penelaah (bukan pembuat) dapat menyetujui; pengembalian wajib beralasan', async () => {
    bank.rows = [bankRow({ id, status: 'review', created_by: OTHER, created_by_name: 'Guru Lain' })];
    api.reviewQuestion.mockResolvedValue({ ok: true, data: {} });
    renderAt(`/guru/soal/${id}`);
    const returnBtn = await screen.findByRole('button', { name: 'Kembalikan ke penulis' });
    expect(returnBtn).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Terbitkan soal' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Catatan telaah'), 'Sudah baik');
    await userEvent.click(screen.getByRole('button', { name: 'Setujui' }));
    await waitFor(() => expect(api.reviewQuestion).toHaveBeenCalledWith(id, 'approve', 'Sudah baik'));
    expect(await screen.findByText(/Soal disetujui/)).toBeInTheDocument();
  });
  it('pembuat tidak melihat tombol telaah untuk soalnya sendiri', async () => {
    bank.rows = [bankRow({ id, status: 'review' })];
    renderAt(`/guru/soal/${id}`);
    await screen.findByText('Riwayat telaah');
    expect(screen.queryByRole('button', { name: 'Setujui' })).not.toBeInTheDocument();
  });
  it('hanya admin yang melihat tombol terbit, dan hanya setelah disetujui', async () => {
    bank.rows = [bankRow({ id, status: 'review', validated: true, created_by: OTHER })];
    renderAt(`/guru/soal/${id}`, 'admin');
    expect(await screen.findByRole('button', { name: 'Terbitkan soal' })).toBeInTheDocument();
  });
  it('guru tidak melihat tombol terbit walau soal sudah disetujui', async () => {
    bank.rows = [bankRow({ id, status: 'review', validated: true, created_by: OTHER })];
    renderAt(`/guru/soal/${id}`);
    await screen.findByText('Riwayat telaah');
    expect(screen.queryByRole('button', { name: 'Terbitkan soal' })).not.toBeInTheDocument();
  });
  it('pengarsipan meminta konfirmasi lebih dulu', async () => {
    bank.rows = [bankRow({ id, status: 'draft' })];
    api.archiveQuestion.mockResolvedValue({ ok: true, data: {} });
    renderAt(`/guru/soal/${id}`);
    await userEvent.click(await screen.findByRole('button', { name: 'Arsipkan soal' }));
    expect(api.archiveQuestion).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Ya, arsipkan' }));
    await waitFor(() => expect(api.archiveQuestion).toHaveBeenCalledTimes(1));
  });
  it('soal diarsipkan tidak dapat diubah', async () => {
    bank.rows = [bankRow({ id, status: 'archived' })];
    renderAt(`/guru/soal/${id}`);
    expect(await screen.findByText(/diarsipkan dan tidak dapat diubah/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simpan draf' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Pernyataan soal')).toBeDisabled();
  });
  it('soal terbit memperingatkan bahwa penyuntingan membuat versi baru', async () => {
    bank.rows = [bankRow({ id, status: 'published', validated: true })];
    renderAt(`/guru/soal/${id}`);
    expect(await screen.findByText(/membuat versi baru/)).toBeInTheDocument();
  });
  it('menampilkan galat bila soal tidak ditemukan', async () => {
    bank.rows = [];
    renderAt(`/guru/soal/${id}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Soal tidak ditemukan');
  });
});
