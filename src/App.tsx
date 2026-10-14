import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell, type NavItem } from '@/components/AppShell';
import { FullPageStatus } from '@/components/FullPageStatus';
import { useAuth } from '@/features/auth/AuthContext';
import { homePathFor } from '@/features/auth/roles';
import { RequireRole } from '@/features/auth/RequireRole';
import { AdminUsers } from '@/pages/AdminUsers';
import { AuditPage } from '@/pages/AuditPage';
import { CurriculumPage } from '@/pages/CurriculumPage';
import { ImportExportPage } from '@/pages/ImportExportPage';
import { QuestionBankPage } from '@/pages/QuestionBankPage';
import { QuestionEditorPage } from '@/pages/QuestionEditorPage';
import { ReviewQueuePage } from '@/pages/ReviewQueuePage';
import { ErrorPage } from '@/pages/ErrorPage';
import { LoginPage } from '@/pages/LoginPage';
import { ForbiddenPage, NotFoundPage } from '@/pages/SimplePages';
import { StudentHome } from '@/pages/StudentHome';
import { LearningMapPage } from '@/pages/student/LearningMapPage';
import { MaterialPage } from '@/pages/student/MaterialPage';
import { PracticePage } from '@/pages/student/PracticePage';
import { HistoryPage, ReviewPage } from '@/pages/student/HistoryPage';
import { TeacherHome } from '@/pages/TeacherHome';

const STUDENT_NAV: readonly NavItem[] = [
  { to: '/siswa', label: 'Beranda', end: true },
  { to: '/siswa/peta', label: 'Peta Belajar' },
  { to: '/siswa/riwayat', label: 'Riwayat' },
];
const TEACHER_NAV: readonly NavItem[] = [
  { to: '/guru', label: 'Dashboard', end: true },
  { to: '/guru/kurikulum', label: 'Kurikulum' },
  { to: '/guru/soal', label: 'Bank soal' },
  { to: '/guru/telaah', label: 'Antrean telaah' },
];
const ADMIN_NAV: readonly NavItem[] = [
  { to: '/admin', label: 'Akun dan peran', end: true },
  { to: '/guru', label: 'Dashboard guru', end: true },
  { to: '/guru/kurikulum', label: 'Kurikulum' },
  { to: '/guru/soal', label: 'Bank soal' },
  { to: '/guru/telaah', label: 'Antrean telaah' },
  { to: '/admin/audit', label: 'Log audit' },
];

function RootRedirect() {
  const { status, profile, error } = useAuth();
  if (status === 'loading') return <FullPageStatus message="Sebentar ya…" />;
  if (status === 'error') return <ErrorPage message={error ?? undefined} />;
  if (status === 'ready' && profile) return <Navigate to={homePathFor(profile.role)} replace />;
  return <Navigate to="/masuk" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/masuk" element={<LoginPage />} />
      <Route path="/akses-ditolak" element={<ForbiddenPage />} />

      <Route element={<RequireRole allow={['student']} />}>
        <Route path="/siswa" element={<AppShell items={STUDENT_NAV} />}>
          <Route index element={<StudentHome />} />
          <Route path="peta" element={<LearningMapPage />} />
          <Route path="materi/:nodeId" element={<MaterialPage />} />
          <Route path="latihan/:nodeId" element={<PracticePage />} />
          <Route path="riwayat" element={<HistoryPage />} />
          <Route path="riwayat/:attemptId" element={<ReviewPage />} />
        </Route>
      </Route>

      <Route element={<RequireRole allow={['teacher', 'admin']} />}>
        <Route path="/guru" element={<AppShell items={TEACHER_NAV} />}>
          <Route index element={<TeacherHome />} />
          <Route path="kurikulum" element={<CurriculumPage />} />
          <Route path="soal" element={<QuestionBankPage />} />
          <Route path="soal/baru" element={<QuestionEditorPage />} />
          <Route path="soal/impor" element={<ImportExportPage />} />
          <Route path="soal/:id" element={<QuestionEditorPage />} />
          <Route path="telaah" element={<ReviewQueuePage />} />
        </Route>
      </Route>

      <Route element={<RequireRole allow={['admin']} />}>
        <Route path="/admin" element={<AppShell items={ADMIN_NAV} />}>
          <Route index element={<AdminUsers />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
