import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { toDataMessage } from '@/lib/errors';
import { profileSchema, ROLE_LABEL, USER_ROLES, type Profile, type UserRole } from '@/features/auth/roles';

type Draft = { role: UserRole; grade: number | null; is_active: boolean };

export function AdminUsers() {
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setMessage({ kind: 'error', text: 'Aplikasi belum dikonfigurasi.' });
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, grade, is_active')
      .order('full_name');
    if (error) {
      setMessage({ kind: 'error', text: toDataMessage(error) });
      return;
    }
    const parsed = z.array(profileSchema).safeParse(data);
    if (!parsed.success) {
      setMessage({ kind: 'error', text: 'Data akun tidak dikenali.' });
      return;
    }
    setRows(parsed.data);
    setDrafts({});
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function draftFor(p: Profile): Draft {
    return drafts[p.id] ?? { role: p.role, grade: p.grade, is_active: p.is_active };
  }

  function patch(p: Profile, change: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [p.id]: { ...draftFor(p), ...change } }));
  }

  async function save(p: Profile) {
    if (!supabase || savingId) return;
    const d = draftFor(p);
    setSavingId(p.id);
    setMessage(null);
    const { error, data } = await supabase
      .from('profiles')
      .update({ role: d.role, grade: d.grade, is_active: d.is_active })
      .eq('id', p.id)
      .select('id');
    setSavingId(null);
    if (error) {
      // pesan dari trigger basis data kami berbahasa Indonesia dan aman ditampilkan
      const own = error.code === '23514' || error.code === '42501' ? error.message : toDataMessage(error);
      setMessage({ kind: 'error', text: own });
      return;
    }
    if (!data || data.length === 0) {
      setMessage({ kind: 'error', text: 'Perubahan tidak tersimpan. Kamu tidak memiliki izin.' });
      return;
    }
    setMessage({ kind: 'ok', text: `Perubahan untuk ${p.full_name || 'akun ini'} tersimpan.` });
    await load();
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">Akun dan peran</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-soft">
          Akun baru selalu berperan siswa. Hanya admin yang dapat mengubah peran, kelas tingkat, dan status akun.
          Setiap perubahan peran tercatat pada log audit.
        </p>
      </header>

      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-2xl px-4 py-3 font-semibold ${
            message.kind === 'error' ? 'bg-sky-100 text-sky-800' : 'bg-teal-50 text-teal-800'
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="overflow-x-auto rounded-card border border-line bg-white">
        <table className="w-full min-w-[720px] text-left">
          <caption className="sr-only">Daftar akun pengguna</caption>
          <thead>
            <tr className="border-b border-line text-sm text-ink-soft">
              <th scope="col" className="px-5 py-4 font-extrabold">Nama</th>
              <th scope="col" className="px-5 py-4 font-extrabold">Peran</th>
              <th scope="col" className="px-5 py-4 font-extrabold">Kelas tingkat</th>
              <th scope="col" className="px-5 py-4 font-extrabold">Aktif</th>
              <th scope="col" className="px-5 py-4"><span className="sr-only">Aksi</span></th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr><td colSpan={5} className="px-5 py-6 text-ink-soft">Memuat akun…</td></tr>
            )}
            {rows?.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-ink-soft">Belum ada akun.</td></tr>
            )}
            {rows?.map((p) => {
              const d = draftFor(p);
              const dirty = d.role !== p.role || d.grade !== p.grade || d.is_active !== p.is_active;
              const label = p.full_name || 'Tanpa nama';
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-bold">{label}</td>
                  <td className="px-5 py-3">
                    <select
                      aria-label={`Peran ${label}`}
                      value={d.role}
                      onChange={(e) => patch(p, { role: e.target.value as UserRole })}
                      className="min-h-[44px] rounded-xl border-2 border-[#CFDCD7] bg-white px-3"
                    >
                      {USER_ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      aria-label={`Kelas tingkat ${label}`}
                      value={d.grade ?? ''}
                      onChange={(e) => patch(p, { grade: e.target.value === '' ? null : Number(e.target.value) })}
                      className="min-h-[44px] rounded-xl border-2 border-[#CFDCD7] bg-white px-3"
                    >
                      <option value="">—</option>
                      <option value="1">Kelas 1</option>
                      <option value="2">Kelas 2</option>
                      <option value="3">Kelas 3</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <label className="flex min-h-[44px] items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={d.is_active}
                        onChange={(e) => patch(p, { is_active: e.target.checked })}
                        className="h-5 w-5 accent-teal-600"
                      />
                      <span>Aktif<span className="sr-only">: {label}</span></span>
                    </label>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      disabled={!dirty || savingId !== null}
                      onClick={() => void save(p)}
                      className="min-h-[44px] rounded-xl bg-teal-600 px-5 font-extrabold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-[#DCE5E2] disabled:text-[#51665F]"
                    >
                      {savingId === p.id ? 'Menyimpan…' : 'Simpan'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
