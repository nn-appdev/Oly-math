import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { ROLE_LABEL } from '@/features/auth/roles';
import { Logo } from './Logo';

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

export function AppShell({ items }: { items: readonly NavItem[] }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/masuk', { replace: true });
  }

  const initial = (profile?.full_name.trim()[0] ?? '?').toUpperCase();

  return (
    <div className="min-h-screen bg-ground font-body text-ink">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:px-4 focus:py-3 focus:font-bold"
      >
        Lewati ke konten
      </a>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3">
          <Logo />
          <nav aria-label="Navigasi utama" className="flex flex-1 flex-wrap gap-1">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-[44px] items-center rounded-xl px-4 font-semibold ${
                    isActive ? 'bg-teal-50 font-bold text-teal-800' : 'text-ink-soft hover:bg-teal-50/60'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-semibold text-ink-soft sm:inline">
              {profile ? ROLE_LABEL[profile.role] : ''}
            </span>
            <span
              aria-hidden="true"
              className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-teal-600 bg-teal-50 font-display text-base font-extrabold text-teal-800"
            >
              {initial}
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="min-h-[44px] rounded-xl border-2 border-teal-600 bg-white px-4 font-bold text-teal-800 hover:bg-teal-50"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>
      <main id="konten" className="mx-auto max-w-[1200px] px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
