# Privasi dan keamanan

- Hanya kunci anon di klien; aplikasi menolak kunci `service_role`/`sb_secret_`.
- Data siswa dibatasi per kelas binaan lewat RLS; guru tidak melihat siswa kelas guru lain (diuji).
- Kunci jawaban tidak pernah dikirim ke siswa (tabel terpisah + RLS). Berkas ekspor soal memuat kunci: perlakukan sebagai rahasia.
- Pesan galat ke pengguna berbahasa Indonesia dan tidak membocorkan detail teknis; hanya pesan server berkode `MQ*` (ditulis sendiri) yang ditampilkan apa adanya.
- Log audit permanen untuk perubahan peran, status soal, dan kurikulum.
- Impor: batas 200 butir dan 5 MB; validasi ulang di server; CSV dilindungi dari injeksi rumus.
- Belum dikerjakan (fase berikutnya): kebijakan retensi data, ekspor/penghapusan data siswa, pembatasan laju, pencadangan, audit keamanan menyeluruh.
