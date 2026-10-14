-- Uji Fase 3: latihan siswa, penilaian di server, kebocoran kunci, idempotensi, akses lintas siswa.
-- Dijalankan setelah rls.test.sql dan questions.test.sql pada sesi yang sama (memakai pembantu t.*).

select t.logout();

-- ------------------------------------------------ data
insert into auth.users (id, email, raw_user_meta_data) values
  (t.u('f'), 'siswa-latihan@uji.test', '{"full_name":"Siswa Latihan"}');
update public.profiles set grade = 2 where id = t.u('f');
insert into public.curriculum_nodes (id, code, domain, title, grade_min, grade_max, concept_text)
values (t.u('9'), 'BIL-2-92', 'bilangan', 'Uji latihan', 2, 3, 'Penjelasan uji.');

-- guru 1 menulis, guru 2 menelaah, admin menerbitkan
create function t.publish(over jsonb) returns uuid language plpgsql as $$
declare qid uuid;
begin
  perform t.login(t.u('2'));
  qid := (public.save_question(null, t.pl(over || jsonb_build_object('node_id', t.u('9')))) ->> 'question_id')::uuid;
  perform public.submit_question_for_review(qid);
  perform t.login(t.u('3'));
  perform public.review_question(qid, 'approve', 'Uji: disetujui.');
  perform t.login(t.u('1'));
  perform public.publish_question(qid);
  perform t.logout();
  return qid;
end $$;

select t.publish($j${"answer_type":"numeric","options":[],"difficulty":1,"statement":"Soal A: berapa hasil 2 + 3?",
  "answer_key":{"value":5},"misconceptions":[{"label":"Menambah satu lebih","value":6}]}$j$);
select t.publish($j${"difficulty":2,"statement":"Soal B: pilihan tunggal uji."}$j$);
select t.publish($j${"answer_type":"true_false","options":[],"difficulty":3,"statement":"Soal C: 4 + 4 = 8, benarkah?",
  "answer_key":{"value":true},"misconceptions":[]}$j$);

-- pembantu yang berjalan dengan hak pemilik agar uji dapat membuat jawaban benar/salah tanpa kunci di klien
create function t.answer_for(v uuid, good boolean) returns jsonb language plpgsql security definer as $$
declare ver public.question_versions; k public.question_keys; other text;
begin
  select * into ver from public.question_versions where id = v;
  select * into k from public.question_keys where question_version_id = v;
  if ver.answer_type = 'single_choice' then
    if good then return jsonb_build_object('choice', k.answer_key ->> 'correct'); end if;
    select o ->> 'id' into other from jsonb_array_elements(ver.options) o where o ->> 'id' <> k.answer_key ->> 'correct' limit 1;
    return jsonb_build_object('choice', other);
  elsif ver.answer_type = 'numeric' then
    return jsonb_build_object('value', (k.answer_key ->> 'value')::numeric + case when good then 0 else 1 end);
  else
    return jsonb_build_object('value', (k.answer_key ->> 'value')::boolean = good);
  end if;
end $$;
create function t.key_of(v uuid) returns jsonb language sql security definer as $$ select answer_key from public.question_keys where question_version_id = v $$;
grant execute on function t.answer_for(uuid, boolean), t.key_of(uuid) to authenticated;

-- ------------------------------------------------ akses dan batasan
select t.login(t.u('f'));
select t.eq(t.count($$select 1 from public.questions$$), 0, 'siswa tidak membaca tabel soal');
select t.eq(t.count($$select 1 from public.question_versions$$), 0, 'siswa tidak membaca versi soal');
select t.eq(t.count($$select 1 from public.question_keys$$), 0, 'siswa tidak membaca kunci');
select t.fails($$insert into public.attempts (session_id, student_id, question_version_id, response, is_correct, idempotency_key)
  values (gen_random_uuid(), t.u('f'), gen_random_uuid(), '{}', true, 'curang-0001')$$, 'siswa tidak dapat menulis percobaan langsung');
select t.fails($$select public.start_practice(t.u('7'), 'token-kosong-01')$$, 'materi tanpa soal terbit ditolak');
select t.fails($$select public.start_practice(t.u('8'), 'token-kelas-03')$$, 'materi kelas lebih tinggi ditolak');
select t.fails($$select public.start_practice(gen_random_uuid(), 'token-acak-001')$$, 'materi yang tidak ada ditolak');
select t.fails($$select public.start_practice(t.u('9'), 'pendek')$$, 'token sesi terlalu pendek ditolak');

select t.login(t.u('2'));
select t.fails($$select public.start_practice(t.u('9'), 'token-guru-0001')$$, 'guru tidak dapat memakai fungsi latihan siswa');
select t.fails($$select public.my_learning_map()$$, 'guru tidak dapat memanggil peta belajar siswa');
select t.anon();
select t.fails($$select public.start_practice(t.u('9'), 'token-anon-0001')$$, 'pengguna anonim tidak dapat memulai latihan');
select t.logout();

-- ------------------------------------------------ alur latihan
select t.login(t.u('f'));
select jsonb_build_object('id', public.start_practice(t.u('9'), 'token-latihan-1') ->> 'session_id') as v \gset sess_
select (:'sess_v'::jsonb ->> 'id') as sid \gset
select t.eq((public.start_practice(t.u('9'), 'token-latihan-1') ->> 'session_id' = :'sid')::int::bigint, 1, 'token sama mengembalikan sesi yang sama (idempoten)');
select t.eq((public.start_practice(t.u('9'), 'token-latihan-2') ->> 'session_id' = :'sid')::int::bigint, 1, 'sesi yang masih berjalan dilanjutkan, bukan digandakan');
select t.eq(t.count($$select 1 from public.learning_sessions where student_id = t.u('f')$$), 1, 'hanya satu sesi tercatat');

do $$
declare
  sid uuid := (select id from public.learning_sessions where student_id = t.u('f') limit 1);
  r jsonb; item jsonb; ver uuid; res jsonb; h jsonb; i int := 0; seen uuid[] := '{}';
  key text;
begin
  -- butir pertama: tangga kesulitan mulai dari target 2, tetapi tidak ada kunci yang bocor
  r := public.next_practice_item(sid);
  perform t.eq((r ->> 'done' = 'false')::int::bigint, 1, 'butir pertama tersedia');
  item := r -> 'item';
  perform t.eq((item ? 'answer_key' or item ? 'hints' or item ? 'explanation' or r ? 'answer_key')::int::bigint, 0, 'butir tidak memuat kunci, petunjuk, atau pembahasan');
  perform t.eq((r ->> 'max_attempts')::bigint, 2, 'maksimal dua percobaan per butir');
  ver := (item ->> 'version_id')::uuid;

  -- jawaban tidak sah tidak tersimpan
  begin
    perform public.submit_answer(sid, ver, '{"nonsense":1}'::jsonb, 'idem-rusak-0001');
    raise exception 'GAGAL: bentuk jawaban salah seharusnya ditolak';
  exception when sqlstate 'MQ422' then null; end;
  perform t.eq((select count(*) from public.attempts where student_id = t.u('f')), 0, 'jawaban berbentuk salah tidak tersimpan sebagai percobaan');

  -- bukan butir yang aktif
  begin
    perform public.submit_answer(sid, gen_random_uuid(), '{"value":1}'::jsonb, 'idem-lain-00001');
    raise exception 'GAGAL: butir lain seharusnya ditolak';
  exception when sqlstate 'MQ409' then null; end;

  -- petunjuk bertahap
  h := public.request_hint(sid, ver);
  perform t.eq((h ->> 'index')::bigint, 1, 'petunjuk pertama diberikan');
  perform t.eq((public.next_practice_item(sid) ->> 'hints_used')::bigint, 1, 'jumlah petunjuk terpakai tercatat di sesi');
  perform t.eq(jsonb_array_length(public.next_practice_item(sid) -> 'hints_shown')::bigint, 1, 'petunjuk yang sudah dilihat dapat dipulihkan saat sesi dibuka kembali');
  perform public.request_hint(sid, ver);
  begin
    perform public.request_hint(sid, ver);
    raise exception 'GAGAL: petunjuk ke-3 seharusnya ditolak (soal uji hanya punya 2)';
  exception when sqlstate 'MQ409' then null; end;

  -- autosave draf
  perform public.save_draft(sid, ver, '{"response":{"choice":"a"}}'::jsonb);
  perform t.eq((public.next_practice_item(sid) -> 'draft' -> 'response' ->> 'choice' = 'a')::int::bigint, 1, 'draf jawaban dipulihkan setelah sesi dibuka ulang');

  -- percobaan pertama salah: belum ada kunci/pembahasan, boleh mencoba lagi
  res := public.submit_answer(sid, ver, t.answer_for(ver, false), 'idem-salah-0001', 4200);
  perform t.eq((res ->> 'correct' = 'false')::int::bigint, 1, 'jawaban salah dinilai salah oleh server');
  perform t.eq((res ->> 'can_retry' = 'true')::int::bigint, 1, 'kesempatan kedua diberikan');
  perform t.eq((res ? 'reveal')::int::bigint, 0, 'kunci dan pembahasan belum dikirim setelah percobaan pertama yang salah');
  perform t.eq((public.next_practice_item(sid) -> 'draft' = 'null'::jsonb or not (public.next_practice_item(sid) ? 'draft') or (public.next_practice_item(sid) ->> 'draft') is null)::int::bigint, 1, 'draf dibersihkan setelah pengiriman');

  -- pengiriman ganda dengan kunci yang sama
  res := public.submit_answer(sid, ver, t.answer_for(ver, false), 'idem-salah-0001', 4200);
  perform t.eq((res ->> 'duplicate' = 'true')::int::bigint, 1, 'pengiriman ulang dengan kunci sama ditandai duplikat');
  perform t.eq((select count(*) from public.attempts where student_id = t.u('f')), 1, 'duplikasi submit tidak menambah percobaan');

  -- percobaan kedua benar: butir selesai, pembahasan dikirim
  res := public.submit_answer(sid, ver, t.answer_for(ver, true), 'idem-benar-0001', 3000);
  perform t.eq((res ->> 'correct' = 'true')::int::bigint, 1, 'jawaban benar dinilai benar');
  perform t.eq((res ->> 'finished' = 'true' and res ? 'reveal' and res -> 'reveal' ? 'explanation')::int::bigint, 1, 'butir selesai: pembahasan dan kunci dikirim');
  perform t.eq((select hints_used from public.attempts where idempotency_key = 'idem-benar-0001')::bigint, 2, 'jumlah petunjuk tercatat pada percobaan');
  perform t.eq((select attempt_no from public.attempts where idempotency_key = 'idem-benar-0001')::bigint, 2, 'nomor percobaan bertambah');
  begin
    perform public.submit_answer(sid, ver, t.answer_for(ver, true), 'idem-benar-0002');
    raise exception 'GAGAL: butir selesai seharusnya menolak jawaban baru';
  exception when sqlstate 'MQ409' then null; end;
end $$;

-- ------------------------------------------------ butir kedua: dua kali salah menyelesaikan butir; lalu habis
do $$
declare
  sid uuid := (select id from public.learning_sessions where student_id = t.u('f') limit 1);
  r jsonb; ver uuid; res jsonb; prev uuid; n int := 0;
begin
  select (select (a.question_version_id) from public.attempts a where a.idempotency_key = 'idem-benar-0001') into prev;
  r := public.next_practice_item(sid);
  ver := (r -> 'item' ->> 'version_id')::uuid;
  perform t.eq((ver is distinct from prev)::int::bigint, 1, 'butir berikutnya berbeda dari yang sudah selesai');
  res := public.submit_answer(sid, ver, t.answer_for(ver, false), 'idem-dua-salah-1');
  perform t.eq((res ->> 'can_retry' = 'true')::int::bigint, 1, 'salah pertama masih dapat mencoba lagi');
  res := public.submit_answer(sid, ver, t.answer_for(ver, false), 'idem-dua-salah-2');
  perform t.eq((res ->> 'finished' = 'true' and res ->> 'correct' = 'false' and res ? 'reveal')::int::bigint, 1, 'dua kali salah: butir selesai dan pembahasan dibuka');

  -- butir ketiga: dijawab benar langsung
  r := public.next_practice_item(sid);
  ver := (r -> 'item' ->> 'version_id')::uuid;
  res := public.submit_answer(sid, ver, t.answer_for(ver, true), 'idem-tiga-benar1');
  perform t.eq((res ->> 'finished' = 'true' and res ->> 'attempt_no' = '1')::int::bigint, 1, 'benar pada percobaan pertama selesai langsung');

  -- soal habis
  r := public.next_practice_item(sid);
  perform t.eq((r ->> 'done' = 'true' and r ->> 'reason' = 'soal_habis')::int::bigint, 1, 'saat soal habis sesi menyatakan selesai');
end $$;

-- indikasi miskonsepsi tersimpan sebagai data bukti (bukan ditampilkan sebagai fakta)
select t.eq((t.count($$select 1 from public.attempts where student_id = t.u('f') and misconception_flag is not null$$) > 0)::int::bigint, 1,
  'pola jawaban keliru khas dicatat sebagai indikasi miskonsepsi pada percobaan');
select t.eq(t.count($$select 1 from public.attempts where student_id = t.u('f') and is_correct and misconception_flag is not null$$), 0,
  'jawaban benar tidak pernah diberi indikasi miskonsepsi');

-- ------------------------------------------------ pembahasan dan riwayat
do $$
declare
  rev jsonb; hist jsonb; a uuid; sid uuid := (select id from public.learning_sessions where student_id = t.u('f') limit 1);
begin
  hist := public.my_history(50);
  perform t.eq(jsonb_array_length(hist)::bigint, (select count(*) from public.attempts where student_id = t.u('f')), 'riwayat memuat semua percobaan siswa');
  perform t.eq((hist::text like '%answer_key%')::int::bigint, 0, 'riwayat tidak memuat kunci');
  a := (select (x ->> 'attempt_id')::uuid from jsonb_array_elements(hist) x where (x ->> 'reviewable')::boolean limit 1);
  rev := public.my_review_item(a);
  perform t.eq((rev -> 'reveal' ? 'explanation')::int::bigint, 1, 'pembahasan butir yang selesai dapat dibuka');
  perform t.eq(jsonb_array_length(public.my_history(1))::bigint, 1, 'batas jumlah riwayat dihormati');
  begin
    perform public.my_review_item(gen_random_uuid());
    raise exception 'GAGAL: percobaan yang tidak ada seharusnya ditolak';
  exception when sqlstate 'MQ404' then null; end;
end $$;

-- ------------------------------------------------ peta belajar
do $$
declare m jsonb; n jsonb;
begin
  m := public.my_learning_map();
  select x into n from jsonb_array_elements(m -> 'nodes') x where x ->> 'code' = 'BIL-2-92';
  perform t.eq((n ->> 'question_count')::bigint, 3, 'peta belajar menghitung soal terbit pada submateri');
  perform t.eq((n ->> 'attempted_items')::bigint, 3, 'peta belajar menghitung butir yang dicoba siswa');
  perform t.eq((n ->> 'correct_items')::bigint, 2, 'peta belajar menghitung butir yang pernah dijawab benar');
  select x into n from jsonb_array_elements(m -> 'nodes') x where x ->> 'code' = 'BIL-3-91';
  perform t.eq((n ->> 'available' = 'false')::int::bigint, 1, 'submateri kelas lebih tinggi ditandai belum tersedia');
end $$;

-- ------------------------------------------------ akhiri sesi
do $$
declare s jsonb; sid uuid := (select id from public.learning_sessions where student_id = t.u('f') limit 1);
begin
  s := public.end_practice(sid);
  perform t.eq((s ->> 'items')::bigint, 3, 'ringkasan sesi: tiga butir');
  perform t.eq((s ->> 'first_try_correct')::bigint, 1, 'ringkasan sesi: satu benar pada percobaan pertama');
  perform t.eq((s ->> 'attempts')::bigint, 5, 'ringkasan sesi: lima percobaan');
  begin
    perform public.submit_answer(sid, gen_random_uuid(), '{"value":1}'::jsonb, 'idem-setelah-akhir');
    raise exception 'GAGAL: sesi yang sudah selesai seharusnya menolak jawaban';
  exception when sqlstate 'MQ409' then null; end;
end $$;

-- ------------------------------------------------ siswa lain tidak dapat menyentuh sesi dan riwayat siswa ini
select t.login(t.u('6'));
select t.eq(t.count($$select 1 from public.attempts where student_id = t.u('f')$$), 0, 'siswa lain tidak melihat percobaan siswa ini');
do $$
declare sid uuid; a uuid;
begin
  perform t.logout();
  sid := (select id from public.learning_sessions where student_id = t.u('f') limit 1);
  a := (select id from public.attempts where student_id = t.u('f') limit 1);
  perform t.login(t.u('6'));
  begin perform public.next_practice_item(sid); raise exception 'GAGAL: IDOR sesi'; exception when sqlstate 'MQ404' then null; end;
  begin perform public.submit_answer(sid, gen_random_uuid(), '{"value":1}'::jsonb, 'idem-idor-00001'); raise exception 'GAGAL: IDOR submit'; exception when sqlstate 'MQ404' then null; end;
  begin perform public.request_hint(sid, gen_random_uuid()); raise exception 'GAGAL: IDOR petunjuk'; exception when sqlstate 'MQ404' then null; end;
  begin perform public.end_practice(sid); raise exception 'GAGAL: IDOR akhiri'; exception when sqlstate 'MQ404' then null; end;
  begin perform public.save_draft(sid, gen_random_uuid(), '{}'::jsonb); raise exception 'GAGAL: IDOR draf'; exception when sqlstate 'MQ404' then null; end;
  begin perform public.my_review_item(a); raise exception 'GAGAL: IDOR pembahasan'; exception when sqlstate 'MQ404' then null; end;
  raise notice 'LULUS: siswa lain ditolak pada semua fungsi sesi dan pembahasan siswa ini (IDOR)';
end $$;
select t.logout();

-- guru melihat percobaan siswa binaan hanya bila mengampu kelasnya (siswa uji ini belum masuk kelas)
select t.login(t.u('2'));
select t.eq(t.count($$select 1 from public.attempts where student_id = t.u('f')$$), 0, 'guru yang tidak mengampu siswa tidak melihat percobaannya');
select t.login(t.u('1'));
select t.eq((t.count($$select 1 from public.attempts where student_id = t.u('f')$$) > 0)::int::bigint, 1, 'admin dapat melihat percobaan siswa');
select t.logout();

-- ------------------------------------------------ pembatas laju
insert into public.learning_sessions (id, student_id, node_id, kind, client_token, state)
values (t.u('0'), t.u('f'), t.u('9'), 'practice', 'token-laju-0001', jsonb_build_object('current', jsonb_build_object('version_id', (select question_version_id from public.attempts where student_id = t.u('f') limit 1), 'hints_used', 0)));
insert into public.attempts (session_id, student_id, question_version_id, response, is_correct, attempt_no, idempotency_key)
select t.u('0'), t.u('f'), (select question_version_id from public.attempts where student_id = t.u('f') limit 1), '{}', false, 1, 'laju-' || g || '-0000'
from generate_series(1, 20) g;
select t.login(t.u('f'));
select t.fails($$select public.submit_answer(t.u('0'), (select question_version_id from public.attempts where idempotency_key = 'laju-1-0000'), '{"value":1}'::jsonb, 'idem-laju-baru-1')$$, 'terlalu banyak pengiriman dalam waktu singkat ditolak');
select t.logout();
delete from public.attempts where idempotency_key like 'laju-%';
delete from public.learning_sessions where id = t.u('0');

-- ------------------------------------------------ penilaian 10 jenis soal (fungsi internal, dipanggil sebagai pemilik)
create function t.chk(typ public.answer_type, opts jsonb, vis jsonb, key jsonb, miscs jsonb, good jsonb, bad jsonb, label text)
returns void language plpgsql as $$
declare g jsonb; b jsonb;
begin
  g := app.evaluate_answer(typ, vis, key, miscs, app.normalize_response(typ, opts, vis, good));
  b := app.evaluate_answer(typ, vis, key, miscs, app.normalize_response(typ, opts, vis, bad));
  if not (g ->> 'correct')::boolean then raise exception 'GAGAL: % (jawaban benar dinilai salah)', label; end if;
  if (b ->> 'correct')::boolean then raise exception 'GAGAL: % (jawaban salah dinilai benar)', label; end if;
  raise notice 'LULUS: %', label;
end $$;
create function t.bad_shape(typ public.answer_type, opts jsonb, vis jsonb, resp jsonb, label text) returns void language plpgsql as $$
begin
  begin
    perform app.normalize_response(typ, opts, vis, resp);
  exception when sqlstate 'MQ422' then
    raise notice 'LULUS: %', label; return;
  end;
  raise exception 'GAGAL (seharusnya ditolak): %', label;
end $$;

select t.chk('single_choice', '[{"id":"a","text":"1"},{"id":"b","text":"2"}]', null, '{"correct":"b"}', '[]', '{"choice":"b"}', '{"choice":"a"}', 'penilaian pilihan tunggal');
select t.chk('multi_choice', '[{"id":"a","text":"1"},{"id":"b","text":"2"},{"id":"c","text":"3"}]', null, '{"correct":["a","c"]}', '[]', '{"choices":["c","a"]}', '{"choices":["a"]}', 'penilaian pilihan majemuk (urutan pilihan tidak berpengaruh)');
select t.chk('possibilities', '[{"id":"a","text":"1"},{"id":"b","text":"2"}]', null, '{"correct":["b"]}', '[]', '{"choices":["b"]}', '{"choices":["a","b"]}', 'penilaian kemungkinan');
select t.chk('numeric', '[]', null, '{"value":7}', '[]', '{"value":"7"}', '{"value":8}', 'penilaian isian angka (angka dalam teks diterima)');
select t.chk('numeric', '[]', null, '{"value":2.5}', '[]', '{"value":"2,5"}', '{"value":25}', 'penilaian isian angka dengan koma desimal');
select t.chk('true_false', '[]', null, '{"value":false}', '[]', '{"value":false}', '{"value":true}', 'penilaian benar/salah');
select t.chk('ordering', '[{"id":"a","text":"x"},{"id":"b","text":"y"},{"id":"c","text":"z"}]', null, '{"order":["b","c","a"]}', '[]', '{"order":["b","c","a"]}', '{"order":["a","b","c"]}', 'penilaian mengurutkan');
select t.chk('matching', '{"left":[{"id":"l1","text":"a"},{"id":"l2","text":"b"}],"right":[{"id":"r1","text":"c"},{"id":"r2","text":"d"}]}', null,
  '{"pairs":[{"left":"l1","right":"r2"},{"left":"l2","right":"r1"}]}', '[]',
  '{"pairs":[{"left":"l2","right":"r1"},{"left":"l1","right":"r2"}]}', '{"pairs":[{"left":"l1","right":"r1"},{"left":"l2","right":"r2"}]}', 'penilaian mencocokkan (urutan pasangan tidak berpengaruh)');
select t.chk('visual', '[]', '{"kind":"grid_select","rows":3,"cols":3}', '{"cells":[[0,0],[1,1]]}', '[]', '{"cells":[[1,1],[0,0]]}', '{"cells":[[0,0]]}', 'penilaian pemilihan petak');
select t.chk('visual', '[]', '{"kind":"number_line","min":0,"max":20,"step":2}', '{"value":12}', '[]', '{"value":12}', '{"value":10}', 'penilaian garis bilangan');
select t.chk('geometry_puzzle', '[]', '{"kind":"unit_grid","rows":2,"cols":2,"cells":[[0,0]],"measure":"area"}', '{"value":1}', '[]', '{"value":1}', '{"value":4}', 'penilaian puzzle geometri');
select t.chk('logic_puzzle', '[]', '{"kind":"position_clues","slots":3,"entities":[{"id":"x","text":"A"},{"id":"y","text":"B"},{"id":"z","text":"C"}],"clues":[]}',
  '{"arrangement":["x","y","z"]}', '[]', '{"arrangement":["x","y","z"]}', '{"arrangement":["y","x","z"]}', 'penilaian puzzle logika');

select t.bad_shape('single_choice', '[{"id":"a","text":"1"}]', null, '{"choice":"zzz"}', 'pilihan di luar opsi ditolak');
select t.bad_shape('single_choice', '[{"id":"a","text":"1"}]', null, '[]', 'jawaban bukan objek ditolak');
select t.bad_shape('multi_choice', '[{"id":"a","text":"1"}]', null, '{"choices":[]}', 'pilihan majemuk kosong ditolak');
select t.bad_shape('multi_choice', '[{"id":"a","text":"1"},{"id":"b","text":"2"}]', null, '{"choices":["a","a"]}', 'pilihan ganda berulang ditolak');
select t.bad_shape('numeric', '[]', null, '{"value":"abc"}', 'teks bukan angka ditolak');
select t.bad_shape('numeric', '[]', null, '{"value":1e12}', 'angka terlalu besar ditolak');
select t.bad_shape('true_false', '[]', null, '{"value":"ya"}', 'benar/salah bukan boolean ditolak');
select t.bad_shape('ordering', '[{"id":"a","text":"x"},{"id":"b","text":"y"}]', null, '{"order":["a"]}', 'urutan tidak lengkap ditolak');
select t.bad_shape('matching', '{"left":[{"id":"l1","text":"a"},{"id":"l2","text":"b"}],"right":[{"id":"r1","text":"c"},{"id":"r2","text":"d"}]}', null,
  '{"pairs":[{"left":"l1","right":"r1"},{"left":"l2","right":"r1"}]}', 'pasangan ganda ditolak');
select t.bad_shape('visual', '[]', '{"kind":"grid_select","rows":2,"cols":2}', '{"cells":[[9,9]]}', 'petak di luar kisi ditolak');
select t.bad_shape('visual', '[]', '{"kind":"number_line","min":0,"max":10,"step":1}', '{"value":99}', 'titik di luar garis bilangan ditolak');
select t.bad_shape('logic_puzzle', '[]', '{"kind":"position_clues","slots":3,"entities":[{"id":"x","text":"A"},{"id":"y","text":"B"},{"id":"z","text":"C"}],"clues":[]}',
  '{"arrangement":["x","x","y"]}', 'tokoh ganda pada susunan ditolak');

-- indikasi miskonsepsi pada pilihan
select t.eq((app.evaluate_answer('single_choice', null, '{"correct":"b"}', '[{"label":"Salah hitung","option_id":"a"}]', '{"choice":"a"}') ->> 'misconception' = 'Salah hitung')::int::bigint, 1, 'pilihan keliru khas menghasilkan indikasi miskonsepsi');
select t.eq((app.evaluate_answer('single_choice', null, '{"correct":"b"}', '[{"label":"Salah hitung","option_id":"a"}]', '{"choice":"b"}') ->> 'misconception' is null)::int::bigint, 1, 'jawaban benar tidak menghasilkan miskonsepsi');

-- pengacakan butir urutan tidak pernah sama dengan kunci
do $$
declare qid uuid; ver uuid; k jsonb; pres jsonb; same int := 0; i int;
begin
  perform t.publish($j${"answer_type":"ordering","difficulty":2,"statement":"Soal D: urutkan uji acak.",
    "options":[{"id":"a","text":"satu"},{"id":"b","text":"dua"},{"id":"c","text":"tiga"},{"id":"d","text":"empat"}],
    "answer_key":{"order":["a","b","c","d"]},"misconceptions":[]}$j$);
  select q.current_version_id into ver from public.questions q join public.question_versions v on v.id = q.current_version_id where v.statement like 'Soal D:%';
  for i in 1..60 loop
    pres := app.present_item(gen_random_uuid(), ver);
    if (select jsonb_agg(o ->> 'id') from jsonb_array_elements(pres -> 'options') o) = '["a","b","c","d"]'::jsonb then same := same + 1; end if;
  end loop;
  perform t.eq(same::bigint, 0, 'butir urutan yang disajikan tidak pernah sama dengan urutan kunci (60 sesi acak)');
  perform t.eq((pres::text like '%answer_key%')::int::bigint, 0, 'penyajian butir tidak memuat kunci');
end $$;
