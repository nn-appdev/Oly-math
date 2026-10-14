# Alur belajar siswa (Fase 3)

Rute: `/siswa` (beranda) → `/siswa/peta` → `/siswa/materi/:id` → `/siswa/latihan/:id` → `/siswa/riwayat` dan `/siswa/riwayat/:attemptId`.

## Prinsip

- **Penilaian hanya di server.** Klien mengirim jawaban dalam format kanonik; server menormalkan, menilai, dan mengembalikan benar/salah.
  Klien tidak pernah mengirim `is_correct`, skor, atau XP.
- **Kunci tidak dikirim saat soal disajikan.** Kunci, pembahasan, dan teks petunjuk baru diterima setelah butir selesai
  (benar, atau percobaan ke-2 habis) atau saat petunjuk diminta satu per satu.
- **Urutan opsi diacak di server** (urutan dan kolom kanan pencocokan) agar urutan tidak membocorkan kunci.
- **Maksimal 2 percobaan per butir.** Percobaan pertama yang salah tidak membuka pembahasan.
- **Pengiriman idempoten.** Setiap pengiriman membawa kunci idempotensi; percobaan ulang karena jaringan tidak dihitung ganda.
- **Draf jawaban** disimpan ke server (jeda ±1,5 detik) sehingga sesi dapat dilanjutkan di perangkat lain.
- **Pembatas laju** pada pengiriman dan petunjuk.

## Umpan balik

Bahasa suportif dan tidak mempermalukan. Miskonsepsi tidak ditampilkan kepada siswa sebagai fakta (hanya berstatus "indikasi" dan untuk guru pada fase berikutnya).
Ringkasan sesi tidak menetapkan penguasaan; penguasaan tidak ditetapkan dari satu soal (mesin penguasaan ada di Fase 4–5).

## Format jawaban kanonik

| Jenis | Bentuk |
| --- | --- |
| pilihan ganda | `{choice}` |
| pilihan ganda kompleks, kemungkinan | `{choices[]}` |
| isian angka, puzzle geometri, garis bilangan | `{value}` |
| benar/salah | `{value: bool}` |
| urutan | `{order[]}` |
| pencocokan | `{pairs: [{left, right}]}` |
| pilih petak | `{cells: [[r, c]]}` |
| puzzle logika | `{arrangement[]}` |

Bentuk ini harus sama di SQL (`app.normalize_response`) dan TypeScript (`src/features/practice/answers.ts`).

## Belum ada

Buku kesalahan, mesin adaptif, penguasaan, XP dan lencana, asesmen untuk siswa, dan dashboard guru atas data siswa.
