# Row Level Security

Prinsip: tolak bawaan; setiap tabel memakai RLS; fungsi pembantu `app.*` bersifat `SECURITY DEFINER` dengan `search_path=''`.

| Tabel / objek | Siswa | Guru | Admin |
| --- | --- | --- | --- |
| `profiles` | diri sendiri | diri, siswa kelas binaan, semua staf | semua |
| `curriculum_nodes`, `curriculum_prerequisites` | baca | baca | baca/tulis |
| `questions`, `question_versions` | **tidak ada akses langsung** sejak Fase 3; butir diterima lewat RPC `next_practice_item` (diacak, tanpa kunci). RPC asesmen untuk siswa menyusul di Fase 6 | soal sendiri; soal berstatus review/terbit | semua |
| `question_keys` (kunci, pembahasan, petunjuk, miskonsepsi) | **tidak pernah** | kunci soal sendiri, atau soal review/terbit | semua |
| Menulis soal | — | hanya lewat RPC | hanya lewat RPC (+ RPC terbit) |
| `question_review_events` | — | baca | baca |
| `audit_logs` | — | — | baca; tidak dapat diubah/dihapus oleh siapa pun |
| `learning_sessions` | baca milik sendiri; tulis hanya lewat RPC | baca siswa binaan | baca |
| `attempts`, `mastery_records`, `xp_ledger`, `student_achievements` | baca milik sendiri | baca siswa binaan | baca |

Hal yang sengaja **tidak** dipercaya dari klien: `is_correct`, skor, XP, status penerbitan, `validated`, `reviewer_id`.

Uji: `supabase/tests/rls.test.sql`, `questions.test.sql`, `practice.test.sql` (lihat [tes.md](tes.md)).
