import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { toAuthMessage, toDataMessage } from '@/lib/errors';
import { AuthContext, type AuthState, type AuthStatus } from './AuthContext';
import { profileSchema, type Profile } from './roles';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pemulihan sesi saat halaman dibuka kembali + pantau perubahan sesi.
  useEffect(() => {
    if (!supabase) {
      setSessionChecked(true);
      return;
    }
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      // Hanya menyimpan sesi di sini; pemanggilan Supabase lain dilakukan di efek terpisah
      // supaya tidak terjadi kebuntuan pada klien auth.
      setSession(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  // Muat profil (peran) dari database setiap kali pengguna berganti.
  useEffect(() => {
    if (!supabase || !userId) {
      setProfile(null);
      return;
    }
    let active = true;
    setProfileLoading(true);
    void supabase
      .from('profiles')
      .select('id, full_name, role, grade, is_active')
      .eq('id', userId)
      .single()
      .then(async ({ data, error: dbError }) => {
        if (!active) return;
        setProfileLoading(false);
        if (dbError || !data) {
          setProfile(null);
          setError(toDataMessage(dbError));
          return;
        }
        const parsed = profileSchema.safeParse(data);
        if (!parsed.success) {
          setProfile(null);
          setError('Data profil tidak dikenali. Hubungi admin.');
          return;
        }
        if (!parsed.data.is_active) {
          setProfile(null);
          setError('Akunmu sedang dinonaktifkan. Hubungi gurumu atau admin.');
          await supabase?.auth.signOut();
          return;
        }
        setError(null);
        setProfile(parsed.data);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const signIn = useCallback<AuthState['signIn']>(async (email, password) => {
    if (!supabase) return { ok: false, message: 'Aplikasi belum dikonfigurasi.' };
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) return { ok: false, message: toAuthMessage(authError) };
    setError(null);
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
  }, []);

  const status: AuthStatus = useMemo(() => {
    if (!sessionChecked || profileLoading) return 'loading';
    if (!session) return 'signed_out';
    if (profile) return 'ready';
    return error ? 'error' : 'loading';
  }, [sessionChecked, profileLoading, session, profile, error]);

  const value = useMemo<AuthState>(
    () => ({ status, profile, error, signIn, signOut }),
    [status, profile, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
