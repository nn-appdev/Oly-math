import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/features/auth/AuthContext';
import { authValue, bankRow, OTHER } from '@/test/fixtures';
import { ReviewQueuePage } from './ReviewQueuePage';

const rows = [
  bankRow({ id: 'r1', code: 'BIL-1-0001', status: 'review', created_by: OTHER, statement: 'Dari guru lain' }),
  bankRow({ id: 'r2', code: 'BIL-1-0002', status: 'review', statement: 'Milik saya' }),
  bankRow({ id: 'r3', code: 'BIL-1-0003', status: 'review', validated: true, created_by: OTHER, reviewer_name: 'Rina', statement: 'Siap terbit' }),
  bankRow({ id: 'r4', code: 'BIL-1-0004', status: 'draft' }),
];
vi.mock('@/features/questions/hooks', () => ({ useBank: () => [{ status: 'ready', data: rows }, () => undefined] }));

function renderAs(role: 'teacher' | 'admin') {
  render(<AuthContext.Provider value={authValue(role)}><MemoryRouter><ReviewQueuePage /></MemoryRouter></AuthContext.Provider>);
}

describe('ReviewQueuePage', () => {
  it('guru hanya melihat soal orang lain untuk ditelaah dan soalnya sendiri secara terpisah', () => {
    renderAs('teacher');
    const mine = screen.getByRole('region', { name: 'Menunggu telaah Anda' });
    expect(mine).toHaveTextContent('BIL-1-0001');
    expect(mine).not.toHaveTextContent('BIL-1-0002');
    expect(screen.getByRole('region', { name: 'Soal Anda yang sedang ditelaah' })).toHaveTextContent('BIL-1-0002');
    expect(screen.queryByRole('region', { name: /Siap diterbitkan/ })).not.toBeInTheDocument();
  });
  it('admin melihat daftar siap terbit', () => {
    renderAs('admin');
    expect(screen.getByRole('region', { name: /Siap diterbitkan/ })).toHaveTextContent('BIL-1-0003');
  });
  it('soal draf tidak masuk antrean mana pun', () => {
    renderAs('admin');
    expect(screen.queryByText('BIL-1-0004')).not.toBeInTheDocument();
  });
});
