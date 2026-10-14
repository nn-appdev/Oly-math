-- Seed kurikulum MathQuest Junior (32 submateri, kelas 1–3).
-- Berkas ini TERPISAH dari migrasi. Aman dijalankan berulang (idempoten). Status validasi awal: belum_divalidasi.
-- Isi (judul, tujuan, prasyarat) adalah usulan awal dan wajib ditelaah guru/pakar kurikulum sebelum dipakai di produksi.

insert into public.curriculum_nodes (code, domain, title, grade_min, grade_max, objectives, source_note, validation_status, sort_order) values
  ('BIL-1-01', 'bilangan', 'Mengenal bilangan dan nilai tempat', 1, 2, 'Siswa dapat membaca, menulis, membandingkan, dan mengurutkan bilangan sampai 100 serta menjelaskan nilai tempat puluhan dan satuan.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 10),
  ('BIL-1-02', 'bilangan', 'Penjumlahan dan pengurangan', 1, 3, 'Siswa dapat menyelesaikan masalah penjumlahan dan pengurangan, serta memeriksa hasilnya dengan operasi kebalikannya.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 20),
  ('BIL-1-03', 'bilangan', 'Bilangan ganjil dan genap', 1, 2, 'Siswa dapat membedakan bilangan ganjil dan genap serta menjelaskan sifat jumlah dua bilangan.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 30),
  ('BIL-1-04', 'bilangan', 'Pola bilangan', 1, 3, 'Siswa dapat menemukan aturan pola bilangan, termasuk pola dengan selisih yang berubah, lalu memperkirakan suku berikutnya.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 40),
  ('BIL-1-05', 'bilangan', 'Bilangan yang hilang', 1, 3, 'Siswa dapat menentukan bilangan yang hilang pada kalimat matematika dengan penalaran operasi kebalikan.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 50),
  ('BIL-2-01', 'bilangan', 'Perkalian dan pembagian dasar', 2, 3, 'Siswa dapat menyelesaikan masalah perkalian dan pembagian sebagai penjumlahan berulang dan pembagian merata.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 60),
  ('BIL-2-02', 'bilangan', 'Strategi menghitung dan estimasi', 2, 3, 'Siswa dapat memilih strategi menghitung yang efisien dan memperkirakan hasil dengan pembulatan secara bernalar.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 70),
  ('BIL-2-03', 'bilangan', 'Sifat operasi hitung sederhana', 2, 3, 'Siswa dapat menggunakan sifat pertukaran, pengelompokan, dan penyebaran, serta menjelaskan operasi yang tidak memiliki sifat tersebut.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 80),
  ('BIL-2-04', 'bilangan', 'Teka-teki angka dan cryptarithm', 2, 3, 'Siswa dapat menentukan angka yang diwakili huruf pada penjumlahan dengan penalaran sistematis.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 90),
  ('BIL-2-05', 'bilangan', 'Masalah aritmetika nonrutin', 2, 3, 'Siswa dapat merancang dan menjelaskan strategi untuk masalah aritmetika yang tidak memiliki prosedur baku.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 100),
  ('GEO-1-01', 'geometri', 'Bentuk dan posisi', 1, 2, 'Siswa dapat menggunakan istilah posisi (kiri, kanan, antara, atas, bawah) untuk menggambarkan letak benda.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 110),
  ('GEO-1-02', 'geometri', 'Segitiga, persegi, persegi panjang, dan lingkaran', 1, 2, 'Siswa dapat mengenali sifat sisi dan sudut bangun datar dasar.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 120),
  ('GEO-1-03', 'geometri', 'Pengukuran dan satuan', 1, 3, 'Siswa dapat membandingkan dan mengurutkan panjang dengan satuan baku serta memilih satuan yang sesuai.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 130),
  ('GEO-2-01', 'geometri', 'Keliling dan luas berbasis petak satuan', 2, 3, 'Siswa dapat menentukan luas dan keliling bangun pada kisi petak satuan serta membedakan kedua konsep itu.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 140),
  ('GEO-2-02', 'geometri', 'Komposisi dan dekomposisi bangun', 2, 3, 'Siswa dapat menyusun dan membagi bangun datar, lalu menalar perubahan keliling dan luasnya.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 150),
  ('GEO-2-03', 'geometri', 'Kubus satuan dan visualisasi spasial', 2, 3, 'Siswa dapat menghitung kubus satuan penyusun balok dan membayangkan bangun ruang dari berbagai sisi.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 160),
  ('GEO-2-04', 'geometri', 'Pencacahan bangun dalam gambar', 2, 3, 'Siswa dapat mencacah bangun datar secara sistematis, termasuk bangun yang tersusun dari bangun lain.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 170),
  ('GEO-3-01', 'geometri', 'Sudut jam (pengayaan)', 3, 3, 'Siswa dapat menentukan jenis sudut yang dibentuk jarum jam pada pukul tertentu. Materi ini bersifat pengayaan.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 180),
  ('KOM-1-01', 'kombinatorik', 'Klasifikasi dan pola', 1, 3, 'Siswa dapat mengelompokkan benda atau bilangan berdasarkan sifat bersama dan menemukan anggota yang tidak sesuai.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 190),
  ('KOM-1-02', 'kombinatorik', 'Urutan dan relasi', 1, 3, 'Siswa dapat menyusun urutan dari beberapa pernyataan perbandingan.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 200),
  ('KOM-2-01', 'kombinatorik', 'Menentukan posisi berdasarkan petunjuk', 2, 3, 'Siswa dapat menentukan susunan yang memenuhi beberapa petunjuk dan memastikan bahwa solusinya tunggal.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 210),
  ('KOM-2-02', 'kombinatorik', 'Kombinasi sederhana', 2, 3, 'Siswa dapat menentukan banyak pasangan atau pilihan dengan mempertimbangkan syarat tambahan.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 220),
  ('KOM-2-03', 'kombinatorik', 'Diagram pohon dan tabel kemungkinan', 2, 3, 'Siswa dapat mendaftar seluruh kemungkinan hasil dengan diagram pohon atau tabel tanpa pengulangan.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 230),
  ('KOM-2-04', 'kombinatorik', 'Pencacahan sistematis', 2, 3, 'Siswa dapat mencacah kemungkinan susunan secara berurutan agar tidak ada yang terlewat atau terhitung ganda.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 240),
  ('KOM-3-01', 'kombinatorik', 'Prinsip sarang merpati dengan benda konkret', 3, 3, 'Siswa dapat menalar jumlah minimum pengambilan benda agar pasti ada dua benda yang sama jenisnya.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 250),
  ('DAT-1-01', 'data', 'Tabel', 1, 3, 'Siswa dapat membaca dan membandingkan data pada tabel.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 260),
  ('DAT-1-02', 'data', 'Piktogram', 1, 3, 'Siswa dapat membaca piktogram dengan memperhatikan nilai yang diwakili setiap gambar.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 270),
  ('DAT-2-01', 'data', 'Diagram sederhana', 2, 3, 'Siswa dapat membaca dan menggambar diagram batang sederhana.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 280),
  ('DAT-2-02', 'data', 'Membandingkan data', 2, 3, 'Siswa dapat membandingkan dua kelompok data secara adil dengan memperhatikan banyak anggota tiap kelompok.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 290),
  ('DAT-2-03', 'data', 'Pembagian merata', 2, 3, 'Siswa dapat menentukan perpindahan benda agar setiap kelompok memperoleh jumlah yang sama.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 300),
  ('DAT-3-01', 'data', 'Rata-rata secara visual', 3, 3, 'Siswa dapat menafsirkan rata-rata sebagai hasil pemerataan beberapa nilai.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 310),
  ('DAT-3-02', 'data', 'Menarik kesimpulan dari informasi', 3, 3, 'Siswa dapat menilai apakah suatu kesimpulan didukung oleh data yang tersedia.', 'Usulan awal MathQuest; belum ditelaah pakar.', 'belum_divalidasi', 320)
on conflict (code) do nothing;

insert into public.curriculum_prerequisites (node_id, prerequisite_id)
select n.id, p.id from (values
  ('BIL-1-02', 'BIL-1-01'),
  ('BIL-1-03', 'BIL-1-01'),
  ('BIL-1-04', 'BIL-1-01'),
  ('BIL-1-05', 'BIL-1-02'),
  ('BIL-2-01', 'BIL-1-02'),
  ('BIL-2-02', 'BIL-1-02'),
  ('BIL-2-03', 'BIL-1-02'),
  ('BIL-2-04', 'BIL-1-05'),
  ('BIL-2-04', 'BIL-2-03'),
  ('BIL-2-05', 'BIL-2-01'),
  ('BIL-2-05', 'BIL-2-02'),
  ('GEO-1-02', 'GEO-1-01'),
  ('GEO-1-03', 'GEO-1-02'),
  ('GEO-2-01', 'GEO-1-03'),
  ('GEO-2-01', 'BIL-1-02'),
  ('GEO-2-02', 'GEO-1-02'),
  ('GEO-2-03', 'GEO-1-01'),
  ('GEO-2-04', 'GEO-1-02'),
  ('GEO-3-01', 'GEO-1-03'),
  ('KOM-1-02', 'KOM-1-01'),
  ('KOM-2-01', 'KOM-1-02'),
  ('KOM-2-02', 'KOM-1-01'),
  ('KOM-2-03', 'KOM-2-02'),
  ('KOM-2-04', 'KOM-2-03'),
  ('KOM-3-01', 'KOM-2-04'),
  ('DAT-1-02', 'DAT-1-01'),
  ('DAT-2-01', 'DAT-1-02'),
  ('DAT-2-02', 'DAT-2-01'),
  ('DAT-2-03', 'BIL-2-01'),
  ('DAT-3-01', 'DAT-2-02'),
  ('DAT-3-01', 'DAT-2-03'),
  ('DAT-3-02', 'DAT-2-02')
) as v (node_code, pre_code)
join public.curriculum_nodes n on n.code = v.node_code
join public.curriculum_nodes p on p.code = v.pre_code
on conflict do nothing;
