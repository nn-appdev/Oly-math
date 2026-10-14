import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthContext, type AuthState } from './AuthContext';
import { RequireRole } from './RequireRole';
import type { UserRole } from './roles';

function renderAt(path: string, auth: Partial<AuthState>, allow: readonly UserRole[]) {
  const value: AuthState = {
    status: 'signed_out',
    profile: null,
    error: null,
    signIn: async () => ({ ok: true }),
    signOut: async () => undefined,
    ...auth,
  };
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RequireRole allow={allow} />}>
            <Route path="/guru" element={<p>Area guru</p>} />
          </Route>
          <Route path="/masuk" element={<p>Halaman masuk</p>} />
          <Route path="/akses-ditolak" element={<p>Akses ditolak</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

const profile = (role: UserRole) => ({
  id: '11111111-1111-4111-8111-111111111111',
  full_name: 'Uji',
  role,
  grade: null,
  is_active: true,
});

describe('RequireRole', () => {
  it('menampilkan status memuat selama sesi diperiksa', () => {
    renderAt('/guru', { status: 'loading' }, ['teacher']);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Area guru')).not.toBeInTheDocument();
  });

  it('mengarahkan pengguna yang belum masuk ke halaman masuk', () => {
    renderAt('/guru', { status: 'signed_out' }, ['teacher']);
    expect(screen.getByText('Halaman masuk')).toBeInTheDocument();
  });

  it('mengizinkan peran yang sesuai', () => {
    renderAt('/guru', { status: 'ready', profile: profile('teacher') }, ['teacher', 'admin']);
    expect(screen.getByText('Area guru')).toBeInTheDocument();
  });

  it('menolak siswa pada area guru', () => {
    renderAt('/guru', { status: 'ready', profile: profile('student') }, ['teacher', 'admin']);
    expect(screen.getByText('Akses ditolak')).toBeInTheDocument();
    expect(screen.queryByText('Area guru')).not.toBeInTheDocument();
  });

  it('menampilkan halaman galat bila profil gagal dimuat', () => {
    renderAt('/guru', { status: 'error', error: 'Data belum dapat dimuat.' }, ['teacher']);
    expect(screen.getByText('Data belum dapat dimuat.')).toBeInTheDocument();
  });
});
