import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/features/auth/AuthContext';
import type { BankRow } from '@/features/questions/api';
import { authValue, bankRow, OTHER } from '@/test/fixtures';
import { QuestionBankPage } from './QuestionBankPage';

const state: { current: { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: BankRow[] } } = { current: { status: 'loading' } };
vi.mock('@/features/questions/hooks', () => ({ useBank: () => [state.current, () => undefined] }));

function renderPage() {
  render(
    <AuthContext.Provider value={authValue()}>
      <MemoryRouter><QuestionBankPage /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('QuestionBankPage', () => {
  it('menampilkan status memuat', () => {
    state.current = { status: 'loading' };
    renderPage();
    expect(screen.getByText('Memuat bank soal…')).toBeInTheDocument();
  });
  it('menampilkan galat dari server', () => {
    state.current = { status: 'error', message: 'Koneksi bermasalah.' };
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('Koneksi bermasalah.');
  });
  it('menampilkan keadaan kosong yang menjelaskan langkah berikutnya', () => {
    state.current = { status: 'ready', data: [] };
    renderPage();
    expect(screen.getByText(/Bank soal masih kosong/)).toBeInTheDocument();
  });
  it('menyaring berdasarkan status dan pencarian, serta soal saya', async () => {
    state.current = {
      status: 'ready',
      data: [
        bankRow({ id: 'a1', code: 'BIL-1-0001', statement: 'Soal tentang apel' }),
        bankRow({ id: 'a2', code: 'BIL-1-0002', status: 'review', statement: 'Soal tentang jeruk', created_by: OTHER }),
        bankRow({ id: 'a3', code: 'BIL-1-0003', status: 'published', statement: 'Soal tentang mangga', created_by: OTHER }),
      ],
    };
    renderPage();
    const body = () => screen.getAllByRole('row').slice(1);
    expect(body()).toHaveLength(3);

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'review');
    expect(body()).toHaveLength(1);
    expect(within(body()[0] as HTMLElement).getByText('BIL-1-0002')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Status'), '');
    await userEvent.type(screen.getByLabelText('Cari kode atau kata'), 'MANGGA');
    expect(body()).toHaveLength(1);
    expect(screen.getByText('2 dari 3 soal'.replace('2', '1'))).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Cari kode atau kata'));
    await userEvent.click(screen.getByLabelText('Hanya soal saya'));
    expect(body()).toHaveLength(1);
    expect(screen.getByText('BIL-1-0001')).toBeInTheDocument();
  });
  it('menandai soal bantuan AI dan menautkan ke editor', () => {
    state.current = { status: 'ready', data: [bankRow({ id: 'zz', ai_assisted: true })] };
    renderPage();
    expect(screen.getByText('[dibantu AI]')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'BIL-1-0001' })).toHaveAttribute('href', '/guru/soal/zz');
  });
});
