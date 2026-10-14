-- Uji validasi soal (10 jenis), alur impor, dan aturan kurikulum.
-- Dijalankan setelah rls.test.sql pada sesi yang sama (memakai pembantu t.* dan t.pl).

select t.logout();

-- simpan lalu ajukan; berhasil bila tidak ada galat
create function t.sub_ok(over jsonb, label text) returns void language plpgsql as $$
declare r jsonb;
begin
  r := public.save_question(null, t.pl(over));
  perform public.submit_question_for_review((r ->> 'question_id')::uuid);
  raise notice 'LULUS: %', label;
exception when others then
  raise exception 'GAGAL (seharusnya diterima): % [%]', label, sqlerrm;
end $$;

-- simpan lalu ajukan; harus ditolak pada salah satu tahap
create function t.sub_bad(over jsonb, label text) returns void language plpgsql as $$
declare r jsonb; ok boolean := false;
begin
  begin
    r := public.save_question(null, t.pl(over));
    perform public.submit_question_for_review((r ->> 'question_id')::uuid);
  exception when others then
    ok := true;
  end;
  if not ok then raise exception 'GAGAL (seharusnya ditolak): %', label; end if;
  raise notice 'LULUS: %', label;
end $$;

select t.login(t.u('2'));

-- ------------------------------------------------ pilihan tunggal
select t.sub_ok('{}', 'single_choice lengkap diterima');
select t.sub_bad('{"options":[{"id":"a","text":"5"}]}', 'single_choice dengan satu opsi ditolak');
select t.sub_bad('{"options":[{"id":"a","text":"5"},{"id":"a","text":"7"}],"answer_key":{"correct":"a"}}', 'id opsi ganda ditolak');
select t.sub_bad('{"options":[{"id":"a","text":"5"},{"id":"b","text":" 5 "}],"answer_key":{"correct":"a"},"misconceptions":[{"label":"x","option_id":"b"}]}', 'teks opsi ganda ditolak');
select t.sub_bad('{"misconceptions":[{"label":"x","option_id":"a"}]}', 'opsi salah tanpa miskonsepsi ditolak');
select t.sub_bad('{"misconceptions":[{"label":"x","option_id":"a"},{"label":"y","option_id":"c"},{"label":"z","option_id":"d"},{"label":"salah","option_id":"b"}]}', 'miskonsepsi pada opsi benar ditolak');
select t.sub_bad('{"answer_key":{"correct":["b"]}}', 'kunci single_choice berbentuk daftar ditolak');
select t.sub_bad('{"hints":["hanya satu"]}', 'petunjuk kurang dari dua ditolak');
select t.sub_bad('{"explanation":""}', 'pembahasan kosong ditolak');
select t.sub_bad('{"source":""}', 'sumber kosong ditolak');

-- ------------------------------------------------ pilihan majemuk dan kemungkinan
select t.sub_ok('{"answer_type":"multi_choice","answer_key":{"correct":["b","c"]},"misconceptions":[{"label":"x","option_id":"a"},{"label":"y","option_id":"d"}]}', 'multi_choice diterima');
select t.sub_bad('{"answer_type":"multi_choice","answer_key":{"correct":["a","b","c","d"]},"misconceptions":[]}', 'multi_choice tanpa pengecoh ditolak');
select t.sub_ok('{"answer_type":"possibilities","answer_key":{"correct":["a"]},"misconceptions":[{"label":"x","option_id":"b"},{"label":"y","option_id":"c"},{"label":"z","option_id":"d"}]}', 'possibilities diterima');

-- ------------------------------------------------ isian angka dan benar/salah
select t.sub_ok('{"answer_type":"numeric","options":[],"answer_key":{"value":7},"misconceptions":[{"label":"Lupa mengurangi","value":12}]}', 'numeric diterima');
select t.sub_bad('{"answer_type":"numeric","options":[],"answer_key":{"value":"tujuh"}}', 'numeric dengan kunci teks ditolak');
select t.sub_bad('{"answer_type":"numeric","answer_key":{"value":7}}', 'numeric dengan opsi ditolak');
select t.sub_ok('{"answer_type":"true_false","options":[],"answer_key":{"value":true},"misconceptions":[]}', 'true_false diterima');
select t.sub_bad('{"answer_type":"true_false","options":[],"answer_key":{"value":"ya"}}', 'true_false dengan kunci bukan boolean ditolak');

-- ------------------------------------------------ mengurutkan dan mencocokkan
select t.sub_ok('{"answer_type":"ordering","answer_key":{"order":["d","a","b","c"]},"misconceptions":[]}', 'ordering diterima');
select t.sub_bad('{"answer_type":"ordering","answer_key":{"order":["a","b"]},"misconceptions":[]}', 'ordering dengan urutan tak lengkap ditolak');
select t.sub_ok($j${"answer_type":"matching","misconceptions":[],
  "options":{"left":[{"id":"l1","text":"2 + 3"},{"id":"l2","text":"4 + 4"}],"right":[{"id":"r1","text":"5"},{"id":"r2","text":"8"}]},
  "answer_key":{"pairs":[{"left":"l1","right":"r1"},{"left":"l2","right":"r2"}]}}$j$, 'matching diterima');
select t.sub_bad($j${"answer_type":"matching","misconceptions":[],
  "options":{"left":[{"id":"l1","text":"2 + 3"},{"id":"l2","text":"4 + 4"}],"right":[{"id":"r1","text":"5"},{"id":"r2","text":"8"}]},
  "answer_key":{"pairs":[{"left":"l1","right":"r1"},{"left":"l2","right":"r1"}]}}$j$, 'matching dengan pasangan ganda ditolak');

-- ------------------------------------------------ visual
select t.sub_ok('{"answer_type":"visual","options":[],"visual_data":{"kind":"grid_select","rows":3,"cols":3},"answer_key":{"cells":[[0,0],[1,1]]},"misconceptions":[]}', 'grid_select diterima');
select t.sub_bad('{"answer_type":"visual","options":[],"visual_data":{"kind":"grid_select","rows":3,"cols":3},"answer_key":{"cells":[[5,5]]},"misconceptions":[]}', 'grid_select dengan petak di luar kisi ditolak');
select t.sub_ok('{"answer_type":"visual","options":[],"visual_data":{"kind":"number_line","min":0,"max":20,"step":2},"answer_key":{"value":12},"misconceptions":[]}', 'number_line diterima');
select t.sub_bad('{"answer_type":"visual","options":[],"visual_data":{"kind":"number_line","min":0,"max":20,"step":2},"answer_key":{"value":13},"misconceptions":[]}', 'number_line dengan kunci di luar langkah ditolak');

-- ------------------------------------------------ puzzle geometri
select t.sub_ok('{"answer_type":"geometry_puzzle","options":[],"visual_data":{"kind":"unit_grid","rows":4,"cols":4,"cells":[[0,0],[0,1],[1,0],[1,1]],"measure":"area"},"answer_key":{"value":4},"misconceptions":[]}', 'geometry area diterima');
select t.sub_ok('{"answer_type":"geometry_puzzle","options":[],"visual_data":{"kind":"unit_grid","rows":4,"cols":4,"cells":[[0,0],[0,1],[1,0],[1,1]],"measure":"perimeter"},"answer_key":{"value":8},"misconceptions":[]}', 'geometry perimeter diterima');
select t.sub_bad('{"answer_type":"geometry_puzzle","options":[],"visual_data":{"kind":"unit_grid","rows":4,"cols":4,"cells":[[0,0],[0,1],[1,0],[1,1]],"measure":"perimeter"},"answer_key":{"value":4},"misconceptions":[]}', 'geometry dengan kunci keliru ditolak');

-- ------------------------------------------------ puzzle logika
select t.sub_ok($j${"answer_type":"logic_puzzle","options":[],"misconceptions":[],
  "visual_data":{"kind":"position_clues","slots":3,"entities":[{"id":"x","text":"Ani"},{"id":"y","text":"Budi"},{"id":"z","text":"Cici"}],
    "clues":[{"type":"at","entity":"x","slot":1},{"type":"left_of","a":"y","b":"z"}]},
  "answer_key":{"arrangement":["x","y","z"]}}$j$, 'logic_puzzle bersolusi tunggal diterima');
select t.sub_bad($j${"answer_type":"logic_puzzle","options":[],"misconceptions":[],
  "visual_data":{"kind":"position_clues","slots":3,"entities":[{"id":"x","text":"Ani"},{"id":"y","text":"Budi"},{"id":"z","text":"Cici"}],
    "clues":[{"type":"at","entity":"x","slot":1}]},
  "answer_key":{"arrangement":["x","y","z"]}}$j$, 'logic_puzzle bersolusi ganda ditolak');

-- ------------------------------------------------ impor
select t.logout();
select t.login(t.u('2'));
select t.eq(t.count($$select 1 from jsonb_array_elements(public.import_questions(jsonb_build_array(
  (t.pl() - 'node_id') || jsonb_build_object('node_code','BIL-2-91','statement','Soal impor pertama untuk uji pengecekan.'),
  (t.pl() - 'node_id') || jsonb_build_object('node_code','BIL-2-91','statement','Soal impor pertama untuk uji pengecekan.'),
  (t.pl() - 'node_id') || jsonb_build_object('node_code','TIDAK-ADA','statement','Soal dengan kode salah.')
))) r where (r ->> 'ok')::boolean$$), 1, 'impor: satu butir berhasil, duplikat dan kode salah ditolak per butir');
select t.fails($$select public.import_questions('[]'::jsonb)$$, 'impor kosong ditolak');
select t.logout();
select t.login(t.u('4'));
select t.fails($$select public.import_questions('[{}]'::jsonb)$$, 'siswa tidak dapat mengimpor soal');

-- ------------------------------------------------ kurikulum
select t.logout();
insert into public.curriculum_nodes (id, code, domain, title, grade_min, grade_max) values
  (t.u('7'), 'BIL-1-91', 'bilangan', 'Bilangan sampai 20', 1, 1),
  (t.u('8'), 'BIL-3-91', 'bilangan', 'Bilangan sampai 1000', 3, 3);
select t.login(t.u('1'));
select t.eq(t.rows_affected($$insert into public.curriculum_prerequisites (node_id, prerequisite_id) values (t.u('c'), t.u('7'))$$), 1, 'prasyarat dari kelas lebih rendah diterima');
select t.fails($$insert into public.curriculum_prerequisites (node_id, prerequisite_id) values (t.u('7'), t.u('c'))$$, 'siklus prasyarat ditolak');
select t.fails($$insert into public.curriculum_prerequisites (node_id, prerequisite_id) values (t.u('7'), t.u('8'))$$, 'prasyarat kelas lebih tinggi ditolak');
select t.fails($$update public.curriculum_nodes set domain = 'geometri' where id = t.u('c')$$, 'domain submateri bersoal tidak dapat diubah');
select t.eq((t.count($$select 1 from public.audit_logs where action like 'curriculum.%'$$) > 0)::int::bigint, 1, 'perubahan kurikulum tercatat pada log audit');
select t.logout();
