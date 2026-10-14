# Seed data

Seed **terpisah dari migrasi** dan tidak dijalankan otomatis.

| Berkas | Isi | Cara memakai |
| --- | --- | --- |
| `supabase/seed/01_curriculum.sql` | 32 submateri (10 bilangan, 8 geometri, 7 kombinatorik, 7 data) dan 32 prasyarat | Jalankan di SQL Editor sebagai `postgres`. Idempoten (`on conflict do nothing`). |
| `supabase/seed/questions_draft.json` | 40 soal draf awal, mencakup 4 domain dan 10 jenis soal | Masuk sebagai guru/admin → *Bank soal → Impor dan ekspor* → pilih berkas → Impor. |

| `supabase/seed/02_concepts.sql` | Teks materi (`concept_text`) untuk 32 submateri | Jalankan setelah `01_curriculum.sql`. Hanya mengisi materi yang masih kosong; idempoten. |

## Status yang harus dipahami

- Kurikulum seed berstatus `belum_divalidasi`. Judul, tujuan, dan prasyarat adalah **usulan awal** yang perlu ditelaah guru/pakar kurikulum.
- Soal seed **berstatus draf, bertanda `ai_assisted`, dan bersumber "Draf awal MathQuest (dibantu AI); belum ditelaah guru"**.
  Semuanya lolos validasi server (kunci benar, puzzle bersolusi tunggal), tetapi **belum ditelaah manusia** sehingga tidak boleh
  disebut tervalidasi. Penelaahan dan penerbitan dilakukan lewat alur di [bank-soal.md](bank-soal.md).
- Teks materi adalah **usulan awal dibantu AI** dan wajib ditelaah guru sebelum dipakai siswa sungguhan.
- Tidak ada data siswa, kelas, atau hasil belajar palsu pada seed.
- Menjalankan impor dua kali tidak menggandakan soal (duplikat pernyataan ditolak).
