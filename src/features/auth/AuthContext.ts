import { createContext, useContext } from 'react';
import type { Profile } from './roles';

export type AuthStatus = 'loading' | 'signed_out' | 'ready' | 'error';

export interface AuthState {
  status: AuthStatus;
  profile: Profile | null;
  /** Pesan galat yang aman ditampilkan kepada pengguna. */
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  return ctx;
}
