import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { homePathFor } from '@/features/auth/roles';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ground p-6 font-body text-ink">
      <div className="max-w-md rounded-card border border-line bg-white p-8 text-center">
        <h1 className="font-display text-3xl font-extrabold">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function HomeLink() {
  const { profile } = useAuth();
  const to = profile ? homePathFor(profile.role) : '/masuk';
  return (
    <Link
      to={to}
      className="mt-6 inline-flex min-h-[52px] items-center rounded-2xl bg-teal-600 px-6 font-extrabold text-white hover:bg-teal-800"
    >
      {profile ? 'Kembali ke beranda' : 'Ke halaman masuk'}
    </Link>
  );
}

export function ForbiddenPage() {
  return (
    <Card title="Halaman ini bukan untukmu">
      <p className="mt-3 text-lg text-ink-soft">Kamu tidak memiliki izin untuk membuka halaman tersebut.</p>
      <HomeLink />
    </Card>
  );
}

export function NotFoundPage() {
  return (
    <Card title="Halaman tidak ditemukan">
      <p className="mt-3 text-lg text-ink-soft">Alamat yang kamu tuju tidak ada atau sudah dipindahkan.</p>
      <HomeLink />
    </Card>
  );
}

export function ConfigErrorPage({ issues }: { issues: string[] }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ground p-6 font-body text-ink">
      <div className="max-w-xl rounded-card border border-line bg-white p-8">
        <h1 className="font-display text-3xl font-extrabold">Aplikasi belum dikonfigurasi</h1>
        <p className="mt-3 text-lg text-ink-soft">
          Salin <code className="rounded bg-teal-50 px-1">.env.example</code> menjadi{' '}
          <code className="rounded bg-teal-50 px-1">.env.local</code>, lalu isi nilai dari proyek Supabase Anda. Pada hosting
          (mis. GitHub Pages), isi variabel yang sama di pengaturan hosting, lalu bangun ulang aplikasi.
        </p>
        <ul className="mt-4 list-disc pl-6 text-ink-soft">
          {issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
