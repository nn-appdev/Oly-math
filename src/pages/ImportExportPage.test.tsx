import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportExportPage } from './ImportExportPage';

const api = vi.hoisted(() => ({ importQuestions: vi.fn(), loadPayloads: vi.fn() }));
vi.mock('@/features/questions/api', () => api);
vi.mock('@/features/questions/hooks', () => ({ useBank: () => [{ status: 'ready', data: [] }, () => undefined] }));

const item = {
  node_code: 'BIL-1-01', grade: 1, cognitive_level: 'L2', difficulty: 2, answer_type: 'numeric', statement: 'Berapa 2 + 3?',
  options: [], answer_key: { value: 5 }, explanation: 'Lima.', hints: ['a', 'b'], source: 'Guru',
};
const file = (name: string, body: string) => new File([body], name, { type: 'text/plain' });

beforeEach(() => { api.importQuestions.mockReset(); api.loadPayloads.mockReset(); });

function setup() {
  render(<MemoryRouter><ImportExportPage /></MemoryRouter>);
  return screen.getByLabelText('Pilih berkas impor');
}

describe('ImportExportPage', () => {
  it('menolak ekstensi yang tidak didukung', async () => {
    const input = setup();
    await userEvent.upload(input, file('soal.txt', '[]'), { applyAccept: false });
    expect(await screen.findByRole('alert')).toHaveTextContent('.json atau .csv');
  });
  it('menolak JSON rusak dengan pesan jelas', async () => {
    const input = setup();
    await userEvent.upload(input, file('soal.json', '{rusak'));
    expect(await screen.findByRole('alert')).toHaveTextContent('bukan JSON yang valid');
  });
  it('melaporkan butir bermasalah per nomor dan hanya mengimpor yang valid', async () => {
    api.importQuestions.mockResolvedValue({ ok: true, data: [{ index: 0, ok: true, code: 'BIL-1-0007' }] });
    const input = setup();
    await userEvent.upload(input, file('soal.json', JSON.stringify([item, { node_code: 'X', grade: 9 }])));
    expect(await screen.findByText(/1 soal siap diimpor, 1 butir bermasalah/)).toBeInTheDocument();
    expect(screen.getByText(/Butir 2:/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Impor 1 soal' }));
    await waitFor(() => expect(api.importQuestions).toHaveBeenCalledTimes(1));
    expect(api.importQuestions.mock.calls[0]?.[0]).toHaveLength(1);
    expect(await screen.findByText('Diimpor sebagai BIL-1-0007')).toBeInTheDocument();
    expect(screen.getByText(/tetap perlu diajukan, ditelaah, dan diterbitkan/)).toBeInTheDocument();
  });
  it('menampilkan alasan penolakan per butir (duplikat)', async () => {
    api.importQuestions.mockResolvedValue({ ok: true, data: [{ index: 0, ok: false, duplicate: true, error: 'Soal dengan pernyataan yang sama sudah ada (BIL-1-0001).' }] });
    const input = setup();
    await userEvent.upload(input, file('soal.json', JSON.stringify([item])));
    await userEvent.click(await screen.findByRole('button', { name: 'Impor 1 soal' }));
    expect(await screen.findByText(/sudah ada \(BIL-1-0001\)/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('0 dari 1 soal diimpor');
  });
});
