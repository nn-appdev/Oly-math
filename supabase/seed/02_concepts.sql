-- Seed materi: penjelasan konsep ramah anak untuk 32 submateri (kolom concept_text).
-- Terpisah dari migrasi dan dari seed kurikulum. Idempoten: hanya mengisi submateri yang concept_text-nya masih kosong.
-- Teks ini adalah USULAN AWAL (dibantu AI) dan wajib ditelaah guru sebelum dipakai di produksi.

update public.curriculum_nodes n set concept_text = v.txt
from (values
  ('BIL-1-01', 'Setiap angka pada sebuah bilangan punya tempat. Pada bilangan 47, angka 4 berada di tempat puluhan, jadi nilainya 40. Angka 7 berada di tempat satuan, jadi nilainya 7. Karena itu 47 sama dengan 40 + 7.

Contoh: bilangan 83 dan 38 memakai angka yang sama, tetapi nilainya berbeda. Pada 83 ada 8 puluhan, pada 38 hanya ada 3 puluhan. Jadi 83 lebih besar daripada 38.

Tips: untuk membandingkan dua bilangan, lihat dahulu angka puluhannya.'),
  ('BIL-1-02', 'Penjumlahan menggabungkan, pengurangan mengambil atau mencari selisih. Keduanya saling berkebalikan.

Contoh: 52 − 17 = 35. Untuk memeriksa, hitung 35 + 17. Jika hasilnya kembali menjadi 52, hitunganmu benar.

Tips: pada soal cerita, tulis dahulu apa yang diketahui, lalu kerjakan satu langkah demi satu langkah. Tanyakan pada dirimu: apakah jumlahnya bertambah atau berkurang?'),
  ('BIL-1-03', 'Bilangan genap dapat dibagi menjadi pasangan tanpa sisa, misalnya 6 = 2 + 2 + 2. Bilangan ganjil selalu bersisa satu, misalnya 7 = 2 + 2 + 2 + 1. Angka satuan bilangan genap adalah 0, 2, 4, 6, atau 8.

Contoh: 7 + 9 = 16. Dua sisa satu dari bilangan ganjil bergabung menjadi satu pasangan, jadi hasilnya genap.

Tips: satu contoh belum cukup untuk membuktikan sebuah aturan. Carilah alasan yang berlaku untuk semua bilangan.'),
  ('BIL-1-04', 'Pola bilangan adalah deretan bilangan yang mengikuti aturan. Cara menemukan aturannya: hitung selisih antara dua bilangan yang berdekatan.

Contoh: 2, 5, 8, 11, ... selisihnya selalu 3, jadi bilangan berikutnya 14. Pada 1, 2, 4, 7, ... selisihnya 1, 2, 3, jadi selisih berikutnya 4 dan bilangan berikutnya 11.

Tips: periksa dahulu apakah selisihnya tetap atau ikut berubah mengikuti pola.'),
  ('BIL-1-05', 'Kalimat matematika seperti □ + 18 = 36 punya bilangan yang hilang. Gunakan operasi kebalikan: □ = 36 − 18 = 18.

Contoh: □ + 18 = 45 − 9. Hitung dahulu sisi yang lengkap: 45 − 9 = 36. Lalu 36 − 18 = 18.

Tips: setelah menemukan jawaban, masukkan kembali ke kalimatnya untuk memeriksa.'),
  ('BIL-2-01', 'Perkalian adalah penjumlahan yang berulang. 4 × 6 berarti 4 kelompok yang masing-masing berisi 6, yaitu 6 + 6 + 6 + 6 = 24. Pembagian adalah membagi sama banyak: 24 ÷ 4 = 6.

Contoh: 7 kotak berisi 6 pensil dibagikan sama banyak kepada 14 anak. Pensil seluruhnya 7 × 6 = 42. Setiap anak menerima 42 ÷ 14 = 3 pensil.

Tips: 4 × 6 sama dengan 6 × 4. Urutan faktor tidak mengubah hasil kali.'),
  ('BIL-2-02', 'Estimasi adalah perkiraan yang dibuat dengan membulatkan bilangan. Perkiraan membantu kita memeriksa apakah sebuah hasil masuk akal, tetapi perkiraan bukan hasil yang pasti.

Contoh: 19.800 + 31.200 + 48.900 dibulatkan menjadi 20.000 + 31.000 + 49.000 = 100.000. Jumlah sebenarnya 99.900, sedikit lebih kecil.

Tips: gunakan estimasi untuk memeriksa hasil, lalu hitung dengan teliti bila perlu kepastian.'),
  ('BIL-2-03', 'Beberapa sifat operasi membantu kita menghitung dengan cerdas. Pada penjumlahan dan perkalian, urutan boleh ditukar dan pengelompokan boleh diubah: (8 + 5) + 2 = 8 + (5 + 2). Perkalian dapat disebar: 8 × (5 + 2) = 8 × 5 + 8 × 2.

Hati-hati: pengurangan dan pembagian tidak boleh dikelompokkan ulang. (8 − 5) − 2 = 1, tetapi 8 − (5 − 2) = 5.

Tips: bila ragu, hitung kedua sisi dan bandingkan.'),
  ('BIL-2-04', 'Pada teka-teki angka, huruf mewakili angka. Huruf yang sama mewakili angka yang sama.

Contoh: P4 + 3P = 67. Mulailah dari angka satuan: 4 + P harus berakhir pada 7, jadi P = 3. Periksa: 34 + 33 = 67.

Tips: tebak dengan sistematis, lalu periksa jawabanmu pada seluruh soal.'),
  ('BIL-2-05', 'Masalah nonrutin tidak punya rumus yang siap pakai. Kamu perlu memilih strategi: membuat gambar, membuat tabel, atau mencoba dan memeriksa.

Contoh: sebuah rak berisi 5 buku pada tingkat teratas, dan setiap tingkat di bawahnya 4 buku lebih banyak. Tulis tingkat demi tingkat: 5, 9, 13. Jumlahnya 27.

Tips: baca soal dua kali dan jelaskan dengan kata-katamu sendiri sebelum menghitung.'),
  ('GEO-1-01', 'Kata kiri, kanan, atas, bawah, dan antara menunjukkan posisi benda. Membuat sketsa membantu kita membayangkan letak benda.

Contoh: buku merah di sebelah kiri buku biru, dan buku kuning di antara keduanya. Susunannya: merah, kuning, biru.

Tips: gambar kotak-kotak kecil dan isi satu per satu sesuai petunjuk.'),
  ('GEO-1-02', 'Persegi punya empat sisi sama panjang dan empat sudut siku-siku. Persegi panjang punya empat sudut siku-siku, sedangkan sisinya yang berhadapan sama panjang. Segitiga punya tiga sisi dan tiga sudut. Lingkaran tidak punya sisi lurus dan tidak punya sudut.

Tips: hitung sisi dan sudut untuk mengenali sebuah bangun.'),
  ('GEO-1-03', 'Panjang dapat diukur dengan satuan seperti sentimeter dan meter. 1 meter sama dengan 100 sentimeter. Untuk membandingkan, samakan dahulu satuannya.

Contoh: 30 sentimeter lebih pendek daripada 1 meter, karena 1 meter sama dengan 100 sentimeter.

Tips: angka yang besar belum tentu berarti panjang yang besar bila satuannya berbeda.'),
  ('GEO-2-01', 'Luas adalah banyak petak yang tertutup bangun. Keliling adalah panjang garis di tepi bangun. Keduanya berbeda.

Contoh: bangun persegi 2 × 2 petak punya luas 4 petak dan keliling 8 satuan.

Tips: pada keliling, jangan hitung sisi petak yang berimpit dengan petak lain di dalam bangun.'),
  ('GEO-2-02', 'Sebuah bangun dapat dipotong menjadi bagian lebih kecil atau disusun dari bangun lain. Luas seluruhnya sama dengan jumlah luas bagiannya, tetapi keliling bagian tidak selalu setengah dari keliling bangun semula.

Contoh: persegi panjang 6 × 4 dipotong menjadi dua persegi panjang 3 × 4. Keliling masing-masing 2 × (3 + 4) = 14, padahal keliling semula 20.

Tips: gambar potongannya, lalu hitung kelilingnya satu per satu.'),
  ('GEO-2-03', 'Balok dapat tersusun dari kubus satuan. Hitung kubus pada satu lapisan, lalu kalikan dengan banyak lapisan.

Contoh: balok dengan panjang 3 kubus, lebar 2 kubus, dan tinggi 2 kubus. Satu lapisan berisi 3 × 2 = 6 kubus. Dengan 2 lapisan, ada 12 kubus.

Tips: bayangkan juga kubus yang tidak terlihat di bagian dalam.'),
  ('GEO-2-04', 'Saat mencacah bangun dalam gambar, hitunglah secara teratur: mulai dari bangun terkecil, lalu bangun yang tersusun dari beberapa bangun kecil.

Contoh: persegi besar yang dibagi menjadi 4 persegi kecil mengandung 4 persegi kecil dan 1 persegi besar, jadi seluruhnya 5 persegi.

Tips: beri tanda atau catat agar tidak ada bangun yang terlewat atau terhitung dua kali.'),
  ('GEO-3-01', 'Jam punya 12 angka. Satu putaran penuh dibagi 12 bagian sama besar. Jarak 3 angka sama dengan seperempat putaran, yaitu sudut siku-siku. Jarak 6 angka membentuk garis lurus.

Contoh: pada pukul 9.00, jarum panjang menunjuk angka 12 dan jarum pendek menunjuk angka 9. Jaraknya 3 angka, jadi membentuk sudut siku-siku.

Catatan: materi ini bersifat pengayaan.'),
  ('KOM-1-01', 'Mengklasifikasi berarti mengelompokkan berdasarkan sifat yang sama. Sebuah kelompok punya aturan, dan anggota yang tidak sesuai aturan itu tidak termasuk.

Contoh: 4, 9, 16, 25 adalah hasil kali bilangan yang sama (2 × 2, 3 × 3, 4 × 4, 5 × 5). Bilangan 20 tidak termasuk kelompok itu.

Tips: tulis sifat tiap anggota, lalu cari sifat yang dimiliki bersama.'),
  ('KOM-1-02', 'Beberapa pernyataan perbandingan dapat disusun menjadi satu urutan. Gabungkan pernyataan yang memuat nama yang sama.

Contoh: Ani lebih tinggi daripada Budi, dan Cici lebih pendek daripada Budi. Urutan dari pendek: Cici, Budi, Ani.

Tips: gambar garis, lalu letakkan nama di atasnya.'),
  ('KOM-2-01', 'Petunjuk posisi dapat dipakai untuk menentukan susunan. Mulailah dari petunjuk yang pasti, lalu uji petunjuk yang lain. Soal yang baik punya tepat satu susunan yang memenuhi semua petunjuk.

Tips: bila ada dua susunan yang cocok, petunjukmu belum cukup.'),
  ('KOM-2-02', 'Untuk menghitung banyak pasangan, kalikan banyak pilihan pertama dengan banyak pilihan kedua. 3 baju dan 2 rok memberi 3 × 2 = 6 pasangan.

Jika ada syarat, kurangi pasangan yang tidak diinginkan. Bila satu pasangan dilarang, tersisa 6 − 1 = 5.

Tips: baca syarat tambahan dengan teliti.'),
  ('KOM-2-03', 'Diagram pohon membantu mendaftar semua kemungkinan. Dari satu titik, buat cabang untuk setiap pilihan, lalu lanjutkan ke pilihan berikutnya.

Contoh: melempar koin dua kali. Hasilnya AA, AG, GA, GG. AG dan GA berbeda karena urutannya berbeda.

Tips: periksa bahwa tidak ada kemungkinan yang terlewat atau terulang.'),
  ('KOM-2-04', 'Pencacahan sistematis berarti mendaftar kemungkinan secara berurutan. Tetapkan satu pilihan, lalu daftar semua pilihan lainnya sebelum pindah ke pilihan berikutnya.

Contoh: bilangan dua angka dari 1, 2, 3 (tiap angka sekali): 12, 13, 21, 23, 31, 32, jadi ada 6 bilangan.

Tips: 12 dan 21 adalah bilangan yang berbeda.'),
  ('KOM-3-01', 'Prinsip sarang merpati: jika benda lebih banyak daripada tempat, minimal satu tempat berisi dua benda atau lebih.

Contoh: ada kaus kaki merah, biru, dan putih. Jika kamu mengambil 4, pasti ada dua yang sewarna, karena hanya ada 3 warna.

Tips: bayangkan keadaan yang paling tidak beruntung, lalu tambahkan satu.'),
  ('DAT-1-01', 'Tabel menyusun data dalam baris dan kolom. Baca judul baris dan kolomnya terlebih dahulu, lalu cari angka yang ditanyakan.

Contoh: bila mangga 12 buah dan jeruk 5 buah, selisihnya 12 − 5 = 7 buah.

Tips: tulis kembali angka penting sebelum menghitung.'),
  ('DAT-1-02', 'Piktogram memakai gambar untuk mewakili jumlah. Perhatikan keterangan: satu gambar mewakili berapa. Gambar setengah mewakili setengah dari nilai itu.

Contoh: satu gambar mewakili 4 buku. Enam gambar utuh dan satu gambar setengah mewakili 24 + 2 = 26 buku.

Tips: jangan hanya menghitung banyak gambar.'),
  ('DAT-2-01', 'Diagram batang memakai batang yang tingginya menunjukkan jumlah. Batang yang lebih tinggi berarti jumlahnya lebih besar. Baca angka pada sumbu dengan teliti.

Tips: bila menggambar diagram batang, mulailah semua batang dari garis dasar yang sama.'),
  ('DAT-2-02', 'Membandingkan dua kelompok harus adil. Jumlah yang lebih besar belum tentu berarti lebih baik bila banyak anggota kelompoknya berbeda.

Contoh: Kelas A punya 20 siswa dan 10 gemar membaca. Kelas B punya 30 siswa dan 15 gemar membaca. Pada kedua kelas, tepat setengahnya gemar membaca.

Tips: bandingkan dengan jumlah seluruh anggota kelompok.'),
  ('DAT-2-03', 'Membagi merata berarti setiap kelompok mendapat jumlah yang sama. Jumlahkan semua benda, lalu bagi dengan banyak kelompok.

Contoh: kantong berisi 14, 9, dan 7 kelereng. Jumlahnya 30, jadi setiap kantong berisi 10 kelereng. Kantong pertama harus mengeluarkan 14 − 10 = 4 kelereng.'),
  ('DAT-3-01', 'Rata-rata dapat dibayangkan sebagai tinggi tumpukan setelah semua tumpukan diratakan. Jumlahkan semua nilai, lalu bagi dengan banyak tumpukan.

Contoh: tumpukan setinggi 2, 6, 3, dan 9. Jumlahnya 20. Setelah diratakan, tiap tumpukan setinggi 20 ÷ 4 = 5.'),
  ('DAT-3-02', 'Kesimpulan yang baik didukung oleh data. Dua hal yang terjadi bersamaan belum tentu saling menyebabkan, dan sedikit contoh belum cukup untuk meramalkan hal yang pasti.

Contoh: membawa payung tidak membuat hujan turun, dan tiga kejadian tidak cukup untuk memastikan cuaca besok.

Tips: tanyakan, “Apakah data ini benar-benar mendukung kesimpulanku?”')
) as v (code, txt)
where n.code = v.code and n.concept_text = '';
