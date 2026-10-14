import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { canAccess, type UserRole } from './roles';
import { FullPageStatus } from '@/components/FullPageStatus';
import { ErrorPage } from '@/pages/ErrorPage';

/**
 * Pelindung rute berbasis peran. Ini hanya lapisan pengalaman pengguna;
 * keamanan data sesungguhnya ditegakkan oleh RLS di database.
 */
export function RequireRole({ allow }: { allow: readonly UserRole[] }) {
  const { status, profile, error } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullPageStatus message="Sebentar ya, kami menyiapkan halamanmu…" />;
  if (status === 'signed_out') return <Navigate to="/masuk" replace state={{ from: location.pathname }} />;
  if (status === 'error') {
    return <ErrorPage message={error ?? 'Terjadi kesalahan saat memuat akunmu.'} />;
  }
  if (!canAccess(profile?.role ?? null, allow)) return <Navigate to="/akses-ditolak" replace />;
  return <Outlet />;
}
