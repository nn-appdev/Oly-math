# Publikasi (GitHub Pages)

Aplikasi ini adalah situs statis hasil `npm run build` (folder `dist/`). **Jangan** menyajikan `index.html` di akar repositori:
berkas itu memuat `/src/main.tsx` (kode sumber) dan hasilnya halaman kosong. Yang disajikan harus isi `dist/`, dan itu dibuat oleh alur kerja
`.github/workflows/pages.yml`.

## Langkah satu kali

1. Dorong kode ke cabang `main` (termasuk folder `.github/`).
2. GitHub → repositori → **Settings → Pages → Build and deployment → Source: GitHub Actions** (bukan "Deploy from a branch").
3. GitHub → **Settings → Secrets and variables → Actions → tab Variables → New repository variable**:
   - `VITE_SUPABASE_URL` = URL proyek Supabase
   - `VITE_SUPABASE_ANON_KEY` = kunci **anon/publishable** (bukan `service_role`)
4. Tab **Actions** → jalankan "Publikasi ke GitHub Pages" (atau dorong commit baru). Tunggu hijau.
5. Buka `https://USERNAME.github.io/NAMA-REPO/`.
6. Supabase → **Authentication → URL Configuration**: isi *Site URL* dengan alamat di langkah 5.

Catatan: Pages pada repositori privat memerlukan paket GitHub berbayar. Kunci anon memang publik di sisi klien; keamanan data ditegakkan oleh RLS.

## Pemecahan masalah

| Gejala | Penyebab | Perbaikan |
| --- | --- | --- |
| Halaman kosong, konsol: gagal memuat `/src/main.tsx` | Source Pages = "Deploy from a branch" | Ubah ke GitHub Actions |
| Halaman kosong, konsol: 404 pada `/assets/…` | Build tanpa `VITE_BASE` | Gunakan alur kerja yang disediakan (mengisi `VITE_BASE=/NAMA-REPO/`) |
| "Aplikasi belum dikonfigurasi" | Variabel Actions belum diisi | Isi langkah 3, jalankan ulang alur kerja |
| Tautan langsung seperti `/siswa/peta` 404 | — | Ditangani `404.html` hasil build (salinan `index.html`) |
