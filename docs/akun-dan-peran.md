# Akun dan peran

- Peran: `student`, `teacher`, `admin`. Akun baru **selalu** `student`; metadata peran dari pendaftaran diabaikan (diuji).
- Pendaftaran mandiri harus dinonaktifkan di Supabase (lihat README). Akun dibuat admin lewat dashboard Supabase.
- Admin pertama ditetapkan lewat SQL Editor (README). Selanjutnya admin mengubah peran, kelas tingkat, dan status akun di `/admin`.
- Admin terakhir tidak dapat diturunkan atau dinonaktifkan. Perubahan peran tercatat di log audit.
- Hak per peran pada Fase 2:
  - Siswa: belum ada fitur belajar (Fase 3).
  - Guru: kurikulum (baca), bank soal (buat/ubah soal sendiri, impor/ekspor), telaah soal guru lain.
  - Admin: semua hak guru, ubah kurikulum, terbitkan/arsipkan soal, log audit, kelola akun.
- Pemisahan tugas: pembuat soal tidak dapat menelaahnya, dan penelaah harus berbeda dari pembuat agar soal dapat terbit.
