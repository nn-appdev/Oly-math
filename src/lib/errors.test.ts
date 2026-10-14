import { describe, expect, it } from 'vitest';
import { toAuthMessage, toDataMessage } from './errors';

describe('toAuthMessage', () => {
  it('memetakan kredensial salah tanpa membocorkan mana yang keliru', () => {
    const msg = toAuthMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' });
    expect(msg).toContain('belum tepat');
    expect(msg.toLowerCase()).not.toContain('password');
  });
  it('memetakan pembatasan laju', () => {
    expect(toAuthMessage({ status: 429 })).toContain('Terlalu banyak');
  });
  it('memetakan galat jaringan', () => {
    expect(toAuthMessage(new TypeError('Failed to fetch'))).toContain('Koneksi');
  });
  it('memakai pesan umum untuk galat tak dikenal dan nilai bukan objek', () => {
    expect(toAuthMessage('aneh')).toContain('Terjadi kesalahan');
    expect(toAuthMessage(null)).toContain('Terjadi kesalahan');
  });
});

describe('toDataMessage', () => {
  it('memetakan penolakan izin', () => {
    expect(toDataMessage({ code: '42501' })).toContain('tidak memiliki izin');
  });
  it('tidak menampilkan pesan teknis mentah', () => {
    expect(toDataMessage({ message: 'relation "x" does not exist' })).not.toContain('relation');
  });
});
