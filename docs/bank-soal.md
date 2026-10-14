# Bank soal

## Alur status

```
draf ──ajukan──▶ review ──setujui (penelaah ≠ pembuat)──▶ review·disetujui ──terbitkan (admin)──▶ terbit
  ▲                 │                                                                              │
  └──kembalikan─────┘                                           arsipkan (admin; pembuat untuk draf) ▼ diarsipkan
```

- Semua perubahan status berjalan lewat fungsi server (RPC): `save_question`, `submit_question_for_review`, `review_question`,
  `publish_question`, `archive_question`, `import_questions`. Klien tidak dapat `INSERT`/`UPDATE` tabel soal langsung.
- Soal baru dan soal impor **selalu draf**. Soal AI tidak pernah otomatis terbit.
- Mengubah soal yang sedang *review* mengembalikannya ke draf dan mencabut persetujuan.
- Mengubah soal **terbit** membuat versi baru (draf). Versi yang terbit dibekukan (`frozen_at`) dan tetap dipakai sampai versi baru terbit.
- Kode soal dibuat otomatis: `<DOM>-<kelas>-<nomor 4 digit>` (mis. `BIL-2-0007`), per domain dan kelas.
- Setiap perubahan status dan peristiwa telaah tercatat (`question_review_events`, `audit_logs`) dan tidak dapat diubah.

## Aturan kelengkapan (ditegakkan server saat diajukan, disetujui, dan diterbitkan)

Pernyataan, sumber, pembahasan, 2–3 petunjuk, kelas dalam rentang submateri, dan kunci sesuai jenis:

| Jenis | Opsi | Kunci | Catatan |
| --- | --- | --- | --- |
| `single_choice` | 2–6 `{id,text}` | `{"correct":"b"}` | setiap opsi salah wajib punya miskonsepsi |
| `multi_choice`, `possibilities` | 2–6 | `{"correct":["a","c"]}` | minimal 1 benar dan 1 pengecoh |
| `numeric` | tanpa | `{"value":7}` | miskonsepsi opsional `{label,value}` |
| `true_false` | tanpa | `{"value":true}` | |
| `ordering` | 2–6 butir | `{"order":[ids]}` | urutan benar; siswa melihat acak |
| `matching` | `{left[],right[]}` 2–6 | `{"pairs":[{left,right}]}` | satu-satu |
| `visual` | tanpa | `grid_select`: `{"cells":[[r,c]]}`; `number_line`: `{"value":n}` | |
| `geometry_puzzle` | tanpa | `{"value":n}` | `visual_data` `unit_grid`; kunci harus sama dengan luas/keliling bangun |
| `logic_puzzle` | tanpa | `{"arrangement":[ids]}` | `position_clues`; **solusi harus tunggal** dan sama dengan kunci |

Id opsi: `^[a-z][a-z0-9]{0,7}$`. Validasi klien (`src/features/questions/validate.ts`) mencerminkan aturan server, tetapi **server yang menentukan**.

## Impor dan ekspor

- JSON (daftar objek) atau CSV (kolom: lihat `CSV_COLUMNS` pada `importExport.ts`; kolom kompleks berisi JSON). Maksimal 200 soal dan 5 MB per berkas.
- Submateri dirujuk dengan `node_code`. Duplikat pernyataan pada submateri yang sama ditolak per butir; satu butir gagal tidak membatalkan yang lain.
- CSV: sel berawalan `= + - @` dinetralkan saat ekspor (perlindungan injeksi rumus) dan dipulihkan saat impor.
- **Berkas ekspor memuat kunci jawaban.** Simpan dengan aman.
