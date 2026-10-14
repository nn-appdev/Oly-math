import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpcMock(...a) } }));
import { saveDraft, submitAnswer } from './api';

const SID = '11111111-1111-4111-8111-111111111111';
beforeEach(() => rpcMock.mockClear());

describe('api latihan', () => {
  it('menandai galat jaringan (fetch gagal) sebagai dapat dicoba ulang', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } });
    const r = await submitAnswer(SID, SID, { choice: 'a' }, 'kunci-12345');
    expect(r).toMatchObject({ ok: false, retryable: true });
  });
  it('menampilkan pesan MQ dari server dan tidak menandainya dapat dicoba ulang', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'MQ429', message: 'terlalu cepat, tunggu sebentar' } });
    const r = await submitAnswer(SID, SID, { choice: 'a' }, 'kunci-12345');
    expect(r).toMatchObject({ ok: false, message: 'Terlalu cepat, tunggu sebentar.', retryable: false });
  });
  it('tidak membocorkan galat internal basis data', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42P01', message: 'relation "secret" does not exist' } });
    const r = await submitAnswer(SID, SID, { choice: 'a' }, 'kunci-12345');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).not.toContain('secret');
  });
  it('menolak jawaban server yang bentuknya tidak dikenal', async () => {
    rpcMock.mockResolvedValue({ data: { aneh: 1 }, error: null });
    expect(await submitAnswer(SID, SID, { choice: 'a' }, 'kunci-12345')).toMatchObject({ ok: false });
  });
  it('mengirim draf sebagai objek berisi response; hasil null dari fungsi void diterima', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null });
    const r = await saveDraft(SID, SID, { value: 4 });
    expect(r.ok).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('save_draft', { p_session: SID, p_version: SID, p_draft: { response: { value: 4 } } });
  });
});
