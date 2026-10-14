/**
 * Penanganan galat terpusat. Pesan untuk pengguna ditulis dalam bahasa Indonesia
 * yang ramah anak dan tidak membocorkan detail teknis atau data sensitif.
 */

export type ErrorLike = { message?: unknown; code?: unknown; status?: unknown; name?: unknown };

function asErrorLike(e: unknown): ErrorLike {
  return typeof e === 'object' && e !== null ? (e as ErrorLike) : {};
}

export function toAuthMessage(error: unknown): string {
  const e = asErrorLike(error);
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  const code = typeof e.code === 'string' ? e.code : '';

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'Email atau kata sandi belum tepat. Coba periksa lagi, ya.';
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Emailmu belum dikonfirmasi. Minta bantuan gurumu.';
  }
  if (code === 'over_request_rate_limit' || e.status === 429 || message.includes('rate limit')) {
    return 'Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.';
  }
  if (message.includes('failed to fetch') || message.includes('network') || e.name === 'AuthRetryableFetchError') {
    return 'Koneksi internet sedang bermasalah. Periksa koneksimu, lalu coba lagi.';
  }
  return 'Terjadi kesalahan saat masuk. Coba lagi beberapa saat lagi.';
}

export function toDataMessage(error: unknown): string {
  const e = asErrorLike(error);
  const code = typeof e.code === 'string' ? e.code : '';
  if (code === '42501' || e.status === 403) {
    return 'Kamu tidak memiliki izin untuk melakukan ini.';
  }
  const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Koneksi internet sedang bermasalah. Perubahan belum tersimpan.';
  }
  return 'Data belum dapat dimuat atau disimpan. Coba lagi.';
}
