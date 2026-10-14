import { describe, expect, it } from 'vitest';
import { toQuestionMessage } from './api';

describe('toQuestionMessage', () => {
  it('menampilkan pesan server berkode MQ dengan huruf awal kapital dan titik', () => {
    expect(toQuestionMessage({ code: 'MQ422', message: 'submateri wajib dipilih' })).toBe('Submateri wajib dipilih.');
    expect(toQuestionMessage({ code: 'MQ409', message: 'Sudah ada.' })).toBe('Sudah ada.');
  });
  it('tidak menampilkan pesan teknis dari kode lain', () => {
    const m = toQuestionMessage({ code: '23505', message: 'duplicate key value violates unique constraint "x"' });
    expect(m).not.toMatch(/duplicate|constraint/);
    expect(m).toBe('Data belum dapat dimuat atau disimpan. Coba lagi.');
  });
  it('mengenali masalah izin dan jaringan', () => {
    expect(toQuestionMessage({ code: '42501', message: 'x' })).toBe('Kamu tidak memiliki izin untuk melakukan ini.');
    expect(toQuestionMessage(new Error('Failed to fetch'))).toMatch(/Koneksi internet/);
  });
});
