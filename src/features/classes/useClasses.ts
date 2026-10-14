import { useEffect, useState } from 'react';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { toDataMessage } from '@/lib/errors';

const classRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  grade: z.number().int().min(1).max(3),
  class_members: z.array(z.object({ count: z.number() })),
});

export interface ClassSummary {
  id: string;
  name: string;
  grade: number;
  memberCount: number;
}

export type ClassesState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; classes: ClassSummary[] };

/** Daftar kelas yang boleh dilihat pengguna saat ini (dibatasi oleh RLS, bukan oleh filter klien). */
export function useClasses(): ClassesState {
  const [state, setState] = useState<ClassesState>({ status: 'loading' });

  useEffect(() => {
    if (!supabase) {
      setState({ status: 'error', message: 'Aplikasi belum dikonfigurasi.' });
      return;
    }
    let active = true;
    void supabase
      .from('classes')
      .select('id, name, grade, class_members(count)')
      .order('name')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setState({ status: 'error', message: toDataMessage(error) });
          return;
        }
        const parsed = z.array(classRowSchema).safeParse(data);
        if (!parsed.success) {
          setState({ status: 'error', message: 'Data kelas tidak dikenali.' });
          return;
        }
        setState({
          status: 'ready',
          classes: parsed.data.map((c) => ({
            id: c.id,
            name: c.name,
            grade: c.grade,
            memberCount: c.class_members[0]?.count ?? 0,
          })),
        });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
