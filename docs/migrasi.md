# Migrasi

Jalankan berurutan; semuanya idempoten (aman diulang).

1. `20261012000001_schema.sql` — tabel, enum, indeks.
2. `20261012000002_functions_triggers.sql` — pembuatan profil otomatis, penjaga peran, audit.
3. `20261012000003_rls.sql` — RLS dan kebijakan dasar.
4. `20261013000004_questions_workflow.sql` — **Fase 2**: kunci terpisah dilengkapi (petunjuk, miskonsepsi), pembekuan versi,
   kode soal otomatis, validasi server 10 jenis soal, RPC alur soal, hak akses, tampilan `question_bank_v` dan `question_review_events_v`,
   penjaga kurikulum (siklus/kelas prasyarat), dan log audit permanen.

5. `20261014000005_student_practice.sql` — **Fase 3**: siswa tidak lagi membaca `questions`/`question_versions` secara langsung;
   `INSERT/UPDATE` langsung pada `learning_sessions` dicabut. Menambah pembantu `app.*` (normalisasi dan penilaian jawaban 10 jenis soal,
   pengacakan butir, pemilihan butir berikutnya) dan RPC `start_practice`, `next_practice_item`, `request_hint`, `submit_answer`,
   `save_draft`, `end_practice`, `my_learning_map`, `my_history`, `my_review_item`.

Migrasi 4 mencabut `INSERT/UPDATE` langsung pada `questions`, `question_versions`, `question_keys`, dan mencabut hak eksekusi fungsi `app.*`
dari `anon`/`authenticated` kecuali pembantu RLS. Fungsi RPC publik berada di skema `public`.

## Uji asap manual pada Supabase (belum dijalankan oleh pembuat)

1. Masuk sebagai guru: buat soal lewat editor → status *Draf*, kode terisi otomatis.
2. Sebagai siswa (kueri langsung ke `question_keys`): hasil harus kosong.
3. Sebagai guru: `select` ke `questions` dengan `insert` langsung harus ditolak.
4. Guru kedua menelaah, admin menerbitkan; versi terbit tidak dapat diubah (`update question_versions` ditolak).
5. Panggil `rpc('save_question', …)` tanpa masuk (anon) → ditolak.
