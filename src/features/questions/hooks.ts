import { useCallback, useEffect, useState } from 'react';
import { listBank, listNodes, listPrerequisites, type ApiResult, type BankRow, type CurriculumNode } from './api';

export type Loaded<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

export function useLoader<T>(fn: () => Promise<ApiResult<T>>): [Loaded<T>, () => void] {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    void fn().then((r) => {
      if (active) setState(r.ok ? { status: 'ready', data: r.data } : { status: 'error', message: r.message });
    });
    return () => {
      active = false;
    };
    // fn sengaja stabil (diberikan sebagai referensi modul)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return [state, reload];
}

export const useBank = (): [Loaded<BankRow[]>, () => void] => useLoader(listBank);
export const useNodes = (): [Loaded<CurriculumNode[]>, () => void] => useLoader(listNodes);
export const usePrerequisites = () => useLoader(listPrerequisites);
