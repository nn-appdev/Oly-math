# Pengujian

| Perintah | Cakupan | Hasil terakhir yang dijalankan |
| --- | --- | --- |
| `npm run typecheck` | TypeScript strict | lulus |
| `npm run lint` | ESLint | lulus |
| `npm test` | 21 berkas, 142 tes: validasi soal, solver, impor/ekspor, editor jawaban, halaman guru, auth, **Fase 3**: format jawaban siswa, masukan 10 jenis soal, API latihan, hook latihan (kunci idempotensi, cegah kirim ganda, autosave draf), halaman latihan dan peta | 142 lulus |
| `npm run build` | build produksi | berhasil (peringatan ukuran chunk > 500 kB) |
| `npm run test:rls` | 253 pemeriksaan SQL pada PostgreSQL 16 sementara: RLS, alur review, validasi soal, impor, kurikulum, seed (termasuk materi), **Fase 3**: penilaian server 10 jenis soal, jawaban tak dikenal ditolak, idempotensi kirim, batas percobaan, petunjuk, draf, pembatas laju, kunci tak bocor, urutan butir diacak, IDOR; migrasi dijalankan dua kali | 253 lulus |

## Batasan yang jujur

- Uji database memakai **skema `auth` tiruan** (`auth.uid()` dari pengaturan sesi). Perilaku nyata Supabase Auth, JWT, dan PostgREST
  (termasuk sintaks `select` pada view, `rpc`, dan pemetaan kode galat) **belum diuji** pada proyek Supabase sungguhan.
  Lakukan uji asap manual setelah migrasi (lihat langkah di [migrasi.md](migrasi.md)).
- Tes komponen memakai modul API tiruan; tidak ada uji end-to-end browser (Playwright dijadwalkan Fase 7).
- Uji peningkatan dari skema Fase 1 dengan data soal yang sudah ada hanya dilakukan dengan menjalankan migrasi berurutan pada basis kosong, lalu ulang.
- Aksesibilitas diperiksa lewat peran/label pada tes komponen, belum dengan pembaca layar atau audit otomatis.

- Jalur galat jaringan berupa pengecualian (bukan galat yang dikembalikan) pada `api.ts` hanya diperiksa secara manual sekali, belum sebagai tes tetap (tes tetap memakai galat yang dikembalikan).
- Tidak ada uji E2E pada browser; alur latihan diuji dengan hook dan API tiruan.
