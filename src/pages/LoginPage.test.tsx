import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/AuthContext';
import { LoginPage } from './LoginPage';

function setup(overrides: Partial<AuthState> = {}) {
  const signIn = vi.fn<AuthState['signIn']>();
  const value: AuthState = {
    status: 'signed_out',
    profile: null,
    error: null,
    signIn,
    signOut: async () => undefined,
    ...overrides,
  };
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={['/masuk']}>
        <Routes>
          <Route path="/masuk" element={<LoginPage />} />
          <Route path="/siswa" element={<p>Beranda siswa</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { signIn };
}

describe('LoginPage', () => {
  it('menampilkan galat bidang tanpa memanggil signIn', async () => {
    const { signIn } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByText('Email wajib diisi.')).toBeInTheDocument();
    expect(screen.getByText('Kata sandi wajib diisi.')).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('menampilkan pesan ramah saat kredensial salah', async () => {
    const { signIn } = setup();
    signIn.mockResolvedValue({ ok: false, message: 'Email atau kata sandi belum tepat. Coba periksa lagi, ya.' });
    await userEvent.type(screen.getByLabelText('Email'), 'budi@sekolah.id');
    await userEvent.type(screen.getByLabelText('Kata sandi'), 'salah');
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('belum tepat');
  });

  it('mencegah pengiriman ganda saat permintaan masih berjalan', async () => {
    const { signIn } = setup();
    let release: (v: { ok: true }) => void = () => undefined;
    signIn.mockReturnValue(new Promise((resolve) => { release = resolve; }));
    await userEvent.type(screen.getByLabelText('Email'), 'budi@sekolah.id');
    await userEvent.type(screen.getByLabelText('Kata sandi'), 'rahasia');
    const button = screen.getByRole('button', { name: 'Masuk' });
    await userEvent.click(button);
    await userEvent.click(screen.getByRole('button', { name: /Sedang masuk/ }));
    expect(signIn).toHaveBeenCalledTimes(1);
    release({ ok: true });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Masuk' })).toBeEnabled());
  });

  it('mengarahkan pengguna yang sudah masuk ke beranda sesuai perannya', () => {
    setup({
      status: 'ready',
      profile: { id: '11111111-1111-4111-8111-111111111111', full_name: 'Budi', role: 'student', grade: 2, is_active: true },
    });
    expect(screen.getByText('Beranda siswa')).toBeInTheDocument();
  });
});
