-- Uji RLS dan aturan integritas MathQuest Junior.
-- Dijalankan oleh supabase/tests/run-rls-tests.sh. Setiap pemeriksaan yang gagal menghentikan skrip.

create schema t;
grant usage on schema t to anon, authenticated;

create table t.ctx (k text primary key, v uuid);
grant select, insert on t.ctx to authenticated;

-- UUID deterministik: t.u('4') -> 44444444-4444-4444-4444-444444444444
create function t.u(c text) returns uuid language sql immutable as $$
  select (repeat(c, 8) || '-' || repeat(c, 4) || '-' || repeat(c, 4) || '-' || repeat(c, 4) || '-' || repeat(c, 12))::uuid
$$;

create function t.login(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, false);
  execute 'set role authenticated';
end $$;

create function t.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  execute 'set role anon';
end $$;

create function t.logout() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
end $$;

create function t.count(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || q || ') x' into n;
  return n;
end $$;

create function t.rows_affected(q text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end $$;

create function t.eq(actual bigint, expected bigint, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'GAGAL: % (didapat %, seharusnya %)', label, actual, expected;
  end if;
  raise notice 'LULUS: %', label;
end $$;

create function t.fails(q text, label text) returns void language plpgsql as $$
declare ok boolean := false;
begin
  begin
    execute q;
  exception when others then
    ok := true;
  end;
  if not ok then
    raise exception 'GAGAL (seharusnya ditolak): %', label;
  end if;
  raise notice 'LULUS: %', label;
end $$;

-- ================================================================ SIAPAN DATA
-- Metadata meminta peran "admin" untuk membuktikan bahwa metadata diabaikan.
insert into auth.users (id, email, raw_user_meta_data) values
  (t.u('1'), 'admin@uji.test', '{"full_name":"Admin","role":"admin"}'),
  (t.u('2'), 'guru1@uji.test',  '{"full_name":"Guru Satu","role":"admin"}'),
  (t.u('3'), 'guru2@uji.test',  '{"full_name":"Guru Dua"}'),
  (t.u('4'), 'siswa1@uji.test', '{"full_name":"Siswa Satu","role":"teacher"}'),
  (t.u('5'), 'siswa2@uji.test', '{"full_name":"Siswa Dua"}'),
  (t.u('6'), 'siswa3@uji.test', '{"full_name":"Siswa Tiga"}');

select t.eq(t.count($$select 1 from public.profiles where role <> 'student'$$), 0,
  'akun baru selalu berperan siswa, metadata peran diabaikan');

update public.profiles set role = 'admin' where id = t.u('1');
update public.profiles set role = 'teacher' where id in (t.u('2'), t.u('3'));
update public.profiles set grade = 2 where role = 'student';

insert into public.classes (id, name, grade, created_by) values (t.u('a'), 'Kelas 2A', 2, t.u('2'));
insert into public.classes (id, name, grade, created_by) values (t.u('b'), 'Kelas 2B', 2, t.u('3'));
insert into public.class_members (class_id, student_id) values
  (t.u('a'), t.u('4')), (t.u('a'), t.u('5')), (t.u('b'), t.u('6'));

select t.eq(t.count($$select 1 from public.teacher_class_assignments$$), 2,
  'guru pembuat otomatis menjadi pengampu kelasnya');

insert into public.curriculum_nodes (id, code, domain, title, grade_min, grade_max)
values (t.u('c'), 'BIL-2-91', 'bilangan', 'Soal cerita dua langkah', 2, 3);

-- ================================================================ PROFIL
select t.login(t.u('4'));
select t.eq(t.count($$select 1 from public.profiles$$), 1, 'siswa hanya melihat profilnya sendiri');
select t.fails($$update public.profiles set role = 'admin' where id = t.u('4')$$, 'siswa tidak dapat menaikkan perannya sendiri');
select t.fails($$update public.profiles set grade = 3 where id = t.u('4')$$, 'siswa tidak dapat mengubah kelas tingkatnya');
select t.fails($$update public.profiles set is_active = false where id = t.u('4')$$, 'siswa tidak dapat mengubah status akunnya');
select t.eq(t.rows_affected($$update public.profiles set full_name = 'Budi' where id = t.u('4')$$), 1, 'siswa dapat mengubah namanya sendiri');
select t.eq(t.rows_affected($$update public.profiles set full_name = 'X' where id = t.u('5')$$), 0, 'siswa tidak dapat mengubah profil siswa lain');
select t.fails($$insert into public.profiles (id, role) values (gen_random_uuid(), 'admin')$$, 'klien tidak dapat membuat profil langsung');
select t.fails($$delete from public.profiles where id = t.u('4')$$, 'klien tidak dapat menghapus profil');

select t.login(t.u('2'));
select t.eq(t.count($$select 1 from public.profiles$$), 5, 'guru 1 melihat semua staf dan 2 siswa kelasnya');
select t.eq(t.count($$select 1 from public.profiles where id = t.u('6')$$), 0, 'guru 1 tidak melihat siswa kelas guru lain');
select t.eq(t.count($$select 1 from public.classes$$), 1, 'guru 1 hanya melihat kelasnya');
select t.fails($$update public.profiles set role = 'admin' where id = t.u('2')$$, 'guru tidak dapat menaikkan perannya menjadi admin');
select t.fails($$insert into public.class_members (class_id, student_id) values (t.u('a'), t.u('6'))$$, 'guru tidak dapat menarik siswa lain ke kelasnya');
select t.fails($$insert into public.teacher_class_assignments (class_id, teacher_id) values (t.u('b'), t.u('2'))$$, 'guru tidak dapat menugaskan diri ke kelas guru lain');
select t.eq(t.rows_affected($$update public.classes set name = 'Curang' where id = t.u('b')$$), 0, 'guru tidak dapat mengubah kelas guru lain');
select t.fails($$insert into public.classes (name, grade, created_by) values ('Palsu', 2, t.u('3'))$$, 'guru tidak dapat membuat kelas atas nama guru lain');

select t.login(t.u('1'));
select t.eq(t.count($$select 1 from public.profiles$$), 6, 'admin melihat semua profil');

-- ================================================================ KURIKULUM
select t.login(t.u('4'));
select t.eq(t.count($$select 1 from public.curriculum_nodes$$), 1, 'siswa dapat membaca kurikulum');
select t.fails($$insert into public.curriculum_nodes (code, domain, title, grade_min, grade_max) values ('BIL-2-02', 'bilangan', 'x', 2, 2)$$, 'siswa tidak dapat menulis kurikulum');
select t.login(t.u('2'));
select t.fails($$insert into public.curriculum_nodes (code, domain, title, grade_min, grade_max) values ('BIL-2-02', 'bilangan', 'x', 2, 2)$$, 'guru tidak dapat menulis kurikulum');

-- ================================================================ BANK SOAL (hanya lewat RPC)
select t.logout();
create function t.pl(over jsonb default '{}'::jsonb) returns jsonb language sql stable as $$
  select jsonb_build_object(
    'node_id', t.u('c'), 'grade', 2, 'cognitive_level', 'L3', 'difficulty', 3,
    'answer_type', 'single_choice',
    'statement', 'Rina memiliki 3 kotak kelereng. Setiap kotak berisi 4 kelereng. Ia memberikan 5 kelereng kepada Dito. Berapa kelereng Rina sekarang?',
    'instructions', 'Pilih satu jawaban yang paling tepat.',
    'options', jsonb_build_array(
      jsonb_build_object('id','a','text','5'), jsonb_build_object('id','b','text','7'),
      jsonb_build_object('id','c','text','12'), jsonb_build_object('id','d','text','17')),
    'recommended_seconds', 90, 'source', 'Karya guru', 'ai_assisted', false,
    'answer_key', jsonb_build_object('correct','b'),
    'explanation', 'Jumlah kelereng awal 3 x 4 = 12. Setelah diberikan 5, sisanya 12 - 5 = 7.',
    'hints', jsonb_build_array('Hitung dahulu jumlah seluruh kelereng.', 'Kurangi dengan kelereng yang diberikan.'),
    'misconceptions', jsonb_build_array(
      jsonb_build_object('label','Hanya mengambil bilangan terakhir','option_id','a'),
      jsonb_build_object('label','Berhenti sebelum mengurangi','option_id','c'),
      jsonb_build_object('label','Menambah, bukan mengurangi','option_id','d'))
  ) || over
$$;

select t.login(t.u('4'));
select t.fails($$select public.save_question(null, t.pl())$$, 'siswa tidak dapat menyimpan soal lewat RPC');
select t.fails($$insert into public.questions (code, node_id, created_by) values ('BIL-2-9999', t.u('c'), t.u('4'))$$, 'siswa tidak dapat menyisipkan soal langsung');

select t.login(t.u('2'));
select t.fails($$insert into public.questions (code, node_id, created_by) values ('BIL-2-9998', t.u('c'), t.u('2'))$$, 'guru tidak dapat menyisipkan soal langsung (wajib lewat RPC)');
select t.fails($$select public.save_question(null, t.pl('{"grade":5}'))$$, 'RPC menolak kelas di luar 1-3');
select t.fails($$select public.save_question(null, t.pl('{"statement":"  "}'))$$, 'RPC menolak pernyataan kosong');
select t.fails($$select public.save_question(null, t.pl('{"answer_type":"hack"}'))$$, 'RPC menolak jenis jawaban tak dikenal');

with r as (select public.save_question(null, t.pl()) j)
insert into t.ctx select 'q1', (j ->> 'question_id')::uuid from r;
insert into t.ctx select 'v1', current_version_id from public.questions where id = (select v from t.ctx where k = 'q1');

select t.eq(t.count($$select 1 from public.questions where status = 'draft' and not validated and code like 'BIL-2-%'$$), 1, 'soal baru berstatus draf dengan kode otomatis');
select t.eq(t.count($$select 1 from public.question_keys$$), 1, 'pembuat soal dapat membaca kunci soalnya');

select t.login(t.u('4'));
select t.eq(t.count($$select 1 from public.questions$$), 0, 'siswa tidak melihat soal draf');
select t.eq(t.count($$select 1 from public.question_versions$$), 0, 'siswa tidak melihat versi soal draf');
select t.eq(t.count($$select 1 from public.question_keys$$), 0, 'siswa tidak melihat kunci jawaban');

select t.login(t.u('3'));
select t.eq(t.count($$select 1 from public.questions$$), 0, 'guru lain tidak melihat draf guru 1');
select t.eq(t.count($$select 1 from public.question_keys$$), 0, 'guru lain tidak melihat kunci soal draf');
select t.fails($$select public.save_question((select v from t.ctx where k = 'q1'), t.pl('{"difficulty":4}'))$$, 'guru lain tidak dapat mengubah soal guru 1');
select t.fails($$select public.submit_question_for_review((select v from t.ctx where k = 'q1'))$$, 'guru lain tidak dapat mengajukan soal guru 1');

select t.login(t.u('2'));
select t.fails($$update public.questions set status = 'published' where code like 'BIL-2-%'$$, 'guru tidak dapat menerbitkan soal lewat update langsung');
select t.fails($$select public.publish_question((select v from t.ctx where k = 'q1'))$$, 'guru tidak dapat memakai RPC penerbitan');
select t.fails($$select public.review_question((select v from t.ctx where k = 'q1'), 'approve')$$, 'soal draf belum dapat ditelaah');
-- soal tidak lengkap tidak dapat diajukan
with r as (select public.save_question(null, t.pl('{"hints":[], "explanation":""}')) j)
insert into t.ctx select 'q_incomplete', (j ->> 'question_id')::uuid from r;
select t.fails($$select public.submit_question_for_review((select v from t.ctx where k = 'q_incomplete'))$$, 'soal tanpa pembahasan dan petunjuk tidak dapat diajukan');
with r as (select public.save_question(null, t.pl('{"answer_key":{"correct":"z"}}')) j)
insert into t.ctx select 'q_badkey', (j ->> 'question_id')::uuid from r;
select t.fails($$select public.submit_question_for_review((select v from t.ctx where k = 'q_badkey'))$$, 'kunci yang tidak ada di opsi ditolak saat pengajuan');
select t.eq(t.count($$select 1 from public.questions where code like 'BIL-2-%'$$), 3, 'tiga soal draf milik guru 1');

select t.eq(t.count($$select 1 from (select public.submit_question_for_review((select v from t.ctx where k = 'q1'))) x$$), 1, 'guru dapat mengajukan soal lengkap untuk review');
select t.fails($$select public.review_question((select v from t.ctx where k = 'q1'), 'approve')$$, 'pembuat tidak dapat menelaah soalnya sendiri');

select t.login(t.u('3'));
select t.eq(t.count($$select 1 from public.questions$$), 1, 'soal berstatus review terlihat oleh guru lain');
select t.eq(t.count($$select 1 from public.question_keys$$), 1, 'peninjau melihat kunci soal berstatus review');
select t.fails($$select public.publish_question((select v from t.ctx where k = 'q1'))$$, 'guru tidak dapat menerbitkan soal');
select t.fails($$select public.review_question((select v from t.ctx where k = 'q1'), 'return', 'x')$$, 'pengembalian wajib beralasan (minimal 5 karakter)');
select t.eq(t.count($$select 1 from (select public.review_question((select v from t.ctx where k = 'q1'), 'approve', 'Penalaran dua langkah sudah tepat.')) x$$), 1, 'guru lain dapat menyetujui soal');
select t.fails($$select public.review_question((select v from t.ctx where k = 'q1'), 'approve')$$, 'soal yang sudah disetujui tidak dapat disetujui ulang');

select t.login(t.u('2'));
select t.fails($$select public.publish_question((select v from t.ctx where k = 'q1'))$$, 'pembuat yang bukan admin tidak dapat menerbitkan');

select t.login(t.u('1'));
select t.eq(t.count($$select 1 from (select public.publish_question((select v from t.ctx where k = 'q1'))) x$$), 1, 'admin dapat menerbitkan soal yang tervalidasi dan ditinjau');
select t.fails($$select public.publish_question((select v from t.ctx where k = 'q1'))$$, 'soal terbit tidak dapat diterbitkan ulang');

select t.login(t.u('4'));
select t.eq(t.count($$select 1 from public.questions$$), 0, 'siswa tidak membaca tabel soal langsung (hanya lewat fungsi latihan)');
select t.eq(t.count($$select 1 from public.question_versions$$), 0, 'siswa tidak membaca versi soal langsung (urutan opsi dapat membocorkan kunci)');
select t.eq(t.count($$select 1 from public.question_keys$$), 0, 'siswa tetap tidak melihat kunci jawaban soal terbit');
select t.fails($$update public.questions set status = 'draft' where true$$, 'siswa tidak dapat mengubah soal');

select t.login(t.u('3'));
select t.eq(t.count($$select 1 from public.question_keys$$), 1, 'guru dapat melihat kunci soal terbit');

select t.logout();
select t.fails($$update public.question_versions set statement = 'diubah' where frozen_at is not null$$, 'versi terbit beku: tidak dapat diubah');
select t.fails($$delete from public.question_keys where true$$, 'kunci soal tidak dapat dihapus');
select t.eq(t.count($$select 1 from public.question_review_events where event = 'published'$$), 1, 'riwayat review mencatat penerbitan');
select t.fails($$update public.question_review_events set notes = 'x'$$, 'riwayat review tidak dapat diubah');

-- menyunting soal terbit membuat versi baru dan mengembalikan soal ke draf
select t.login(t.u('2'));
select t.eq(t.count($$select 1 from (select public.save_question((select v from t.ctx where k = 'q1'), t.pl('{"statement":"Rina memiliki 3 kotak kelereng. Setiap kotak berisi 4 kelereng. Ia memberikan 5 kelereng kepada Dito. Berapa kelereng yang masih dimiliki Rina?"}'))) x$$), 1, 'penyuntingan soal terbit menghasilkan versi baru');
insert into t.ctx select 'v2', current_version_id from public.questions where id = (select v from t.ctx where k = 'q1');

select t.logout();
select t.eq(t.count($$select 1 from public.questions where code like 'BIL-2-%' and status = 'draft' and not validated and id = (select v from t.ctx where k = 'q1')$$), 1,
  'versi baru mengembalikan soal terbit ke draf dan mencabut validasi');
select t.eq(t.count($$select 1 from public.question_versions where version_no = 2$$), 1, 'nomor versi bertambah berurutan');

select t.login(t.u('4'));
select t.eq(t.count($$select 1 from public.questions$$), 0, 'siswa tidak lagi melihat soal yang kembali ke draf');
select t.eq(t.count($$select 1 from public.question_versions$$), 0, 'siswa tidak melihat versi soal yang kembali ke draf');

-- ajukan, telaah, terbitkan versi 2
select t.login(t.u('2'));
select public.submit_question_for_review((select v from t.ctx where k = 'q1'));
select t.login(t.u('3'));
select public.review_question((select v from t.ctx where k = 'q1'), 'approve', 'Versi revisi sudah jelas.');
select t.login(t.u('1'));
select public.publish_question((select v from t.ctx where k = 'q1'));

-- ================================================================ ASESMEN
select t.login(t.u('2'));
with ins as (
  insert into public.assessments (title, grade, created_by) values ('Asesmen pola', 2, t.u('2')) returning id
) insert into t.ctx select 'a1', id from ins;

select t.fails($$insert into public.assessments (title, grade, created_by, is_published) values ('Palsu', 2, t.u('2'), true)$$, 'asesmen baru tidak dapat langsung terbit');
select t.fails($$update public.assessments set is_published = true where title = 'Asesmen pola'$$, 'asesmen tanpa butir tidak dapat terbit');

-- soal draf kedua tidak boleh dipakai
with r as (select public.save_question(null, t.pl('{"difficulty":2}')) j)
insert into t.ctx select 'v_draft', (select current_version_id from public.questions where id = (j ->> 'question_id')::uuid) from r;

select t.fails($$insert into public.assessment_items (assessment_id, question_version_id, position)
  select a.v, d.v, 1 from t.ctx a, t.ctx d where a.k = 'a1' and d.k = 'v_draft'$$, 'soal draf tidak dapat masuk asesmen');
select t.fails($$insert into public.assessment_items (assessment_id, question_version_id, position)
  select a.v, o.v, 1 from t.ctx a, t.ctx o where a.k = 'a1' and o.k = 'v1'$$, 'versi lama (bukan versi aktif) tidak dapat masuk asesmen');

select t.eq(t.rows_affected($$insert into public.assessment_items (assessment_id, question_version_id, position)
  select a.v, o.v, 1 from t.ctx a, t.ctx o where a.k = 'a1' and o.k = 'v2'$$), 1, 'versi aktif soal terbit dapat masuk asesmen');
select t.eq(t.rows_affected($$update public.assessments set is_published = true where title = 'Asesmen pola'$$), 1, 'asesmen berbutir dapat diterbitkan');
select t.fails($$update public.assessments set is_published = false where title = 'Asesmen pola'$$, 'asesmen terbit tidak dapat ditarik');
select t.fails($$delete from public.assessment_items where true$$, 'butir asesmen terbit tidak dapat dihapus');

select t.eq(t.rows_affected($$insert into public.assessment_assignments (assessment_id, class_id, assigned_by)
  select v, t.u('a'), t.u('2') from t.ctx where k = 'a1'$$), 1, 'guru menugaskan asesmen ke kelasnya');
select t.fails($$insert into public.assessment_assignments (assessment_id, class_id, assigned_by)
  select v, t.u('b'), t.u('2') from t.ctx where k = 'a1'$$, 'guru tidak dapat menugaskan ke kelas guru lain');

select t.login(t.u('4'));
select t.eq(t.count($$select 1 from public.assessments$$), 1, 'siswa kelas penerima melihat asesmen');
select t.eq(t.count($$select 1 from public.assessment_items$$), 1, 'siswa penerima melihat butir asesmen');
select t.eq(t.count($$select 1 from public.question_versions$$), 0, 'siswa penerima tidak membaca versi soal langsung (asesmen memakai fungsi server pada Fase 6)');
select t.eq(t.count($$select 1 from public.question_keys$$), 0, 'kunci jawaban asesmen aktif tidak terkirim ke siswa');

select t.login(t.u('6'));
select t.eq(t.count($$select 1 from public.assessments$$), 0, 'siswa kelas lain tidak melihat asesmen');
select t.eq(t.count($$select 1 from public.assessment_items$$), 0, 'siswa kelas lain tidak melihat butir');
select t.eq(t.count($$select 1 from public.question_versions$$), 0, 'siswa kelas lain juga tidak membaca versi soal langsung');

-- soal diarsipkan: siswa penerima tetap membaca versi yang disematkan, siswa lain tidak
select t.login(t.u('1'));
select public.archive_question((select v from t.ctx where k = 'q1'), 'Uji pengarsipan');
select t.login(t.u('4'));
select t.eq(t.count($$select 1 from public.question_versions$$), 0, 'siswa tidak membaca versi soal langsung setelah diarsipkan');
select t.login(t.u('6'));
select t.eq(t.count($$select 1 from public.question_versions$$), 0, 'siswa non-penerima tidak membaca soal yang diarsipkan');

-- ================================================================ HASIL BELAJAR
select t.logout();
insert into public.learning_sessions (id, student_id, node_id, kind, client_token) values
  (t.u('d'), t.u('4'), t.u('c'), 'practice', 'token-siswa-1'),
  (t.u('e'), t.u('6'), t.u('c'), 'practice', 'token-siswa-3');
insert into public.attempts (session_id, student_id, question_version_id, response, is_correct, idempotency_key)
select t.u('d'), t.u('4'), v, '"7"', true, 'idem-s1-0001' from t.ctx where k = 'v2';
insert into public.attempts (session_id, student_id, question_version_id, response, is_correct, idempotency_key)
select t.u('e'), t.u('6'), v, '"12"', false, 'idem-s3-0001' from t.ctx where k = 'v2';
insert into public.xp_ledger (student_id, amount, reason, idempotency_key) values (t.u('4'), 5, 'latihan', 'xp-key-0001');

select t.fails($$insert into public.xp_ledger (student_id, amount, reason, idempotency_key) values (t.u('4'), 5, 'latihan', 'xp-key-0001')$$, 'XP dengan idempotency key sama tidak dapat digandakan');
select t.fails($$insert into public.attempts (session_id, student_id, question_version_id, response, is_correct, idempotency_key)
  select t.u('d'), t.u('4'), question_version_id, '"7"', true, 'idem-s1-0001' from public.attempts where student_id = t.u('4')$$, 'percobaan dengan idempotency key sama tidak dapat digandakan');

select t.login(t.u('4'));
select t.eq(t.count($$select 1 from public.attempts$$), 1, 'siswa hanya melihat percobaannya sendiri');
select t.eq(t.count($$select 1 from public.xp_ledger$$), 1, 'siswa melihat XP-nya sendiri');
select t.fails($$insert into public.attempts (session_id, student_id, question_version_id, response, is_correct, idempotency_key)
  select t.u('d'), t.u('4'), question_version_id, '"7"', true, 'idem-s1-0002' from public.attempts$$, 'siswa tidak dapat menyisipkan percobaan (is_correct tidak dipercaya klien)');
select t.fails($$insert into public.xp_ledger (student_id, amount, reason, idempotency_key) values (t.u('4'), 9999, 'curang', 'xp-key-9999')$$, 'siswa tidak dapat memberi dirinya XP');
select t.fails($$insert into public.mastery_records (student_id, node_id, mastery) values (t.u('4'), t.u('c'), 1)$$, 'siswa tidak dapat menulis penguasaan');
select t.fails($$insert into public.student_achievements (student_id, achievement_id) values (t.u('4'), gen_random_uuid())$$, 'siswa tidak dapat memberi dirinya lencana');
select t.fails($$update public.xp_ledger set amount = 100000$$, 'siswa tidak dapat mengubah XP');

select t.fails($$insert into public.learning_sessions (student_id, node_id, kind, client_token) values (t.u('4'), t.u('c'), 'practice', 'token-baru-1')$$, 'siswa tidak dapat membuat sesi langsung (hanya lewat start_practice)');
select t.fails($$insert into public.learning_sessions (student_id, node_id, kind, client_token) values (t.u('5'), t.u('c'), 'practice', 'token-baru-2')$$, 'siswa tidak dapat memulai sesi atas nama siswa lain');
select t.fails($$insert into public.learning_sessions (student_id, node_id, kind, client_token) values (t.u('4'), t.u('c'), 'practice', 'token-baru-1')$$, 'sesi dengan client_token sama tidak dapat digandakan');
select t.fails($$update public.learning_sessions set state = '{"soal":3}'::jsonb where id = t.u('d')$$, 'siswa tidak dapat mengubah state sesi langsung (hanya lewat fungsi)');
select t.fails($$update public.learning_sessions set student_id = t.u('5') where id = t.u('d')$$, 'siswa tidak dapat memindahkan sesi ke siswa lain');

select t.login(t.u('5'));
select t.eq(t.count($$select 1 from public.attempts$$), 0, 'siswa sekelas tidak melihat percobaan teman');

select t.login(t.u('2'));
select t.eq(t.count($$select 1 from public.attempts$$), 1, 'guru 1 hanya melihat percobaan siswa binaannya');
select t.fails($$insert into public.xp_ledger (student_id, amount, reason, idempotency_key) values (t.u('4'), 50, 'hadiah', 'xp-guru-0001')$$, 'guru tidak dapat menulis XP langsung');

select t.login(t.u('3'));
select t.eq(t.count($$select 1 from public.attempts$$), 1, 'guru 2 hanya melihat percobaan siswanya sendiri');
select t.eq(t.count($$select 1 from public.learning_sessions where student_id = t.u('4')$$), 0, 'guru 2 tidak melihat sesi siswa guru 1');

-- ================================================================ KELAS: pengeluaran anggota
select t.login(t.u('3'));
select t.eq(t.rows_affected($$delete from public.class_members where class_id = t.u('a') and student_id = t.u('5')$$), 0, 'guru lain tidak dapat mengeluarkan anggota kelas yang bukan miliknya');
select t.login(t.u('2'));
select t.eq(t.rows_affected($$delete from public.class_members where class_id = t.u('a') and student_id = t.u('5')$$), 1, 'guru dapat mengeluarkan anggota kelasnya');
select t.eq(t.count($$select 1 from public.profiles where id = t.u('5')$$), 0, 'guru kehilangan akses data siswa yang sudah keluar kelas');

-- ================================================================ AUDIT & ADMIN
select t.login(t.u('4'));
select t.eq(t.count($$select 1 from public.audit_logs$$), 0, 'siswa tidak membaca log audit');
select t.fails($$insert into public.audit_logs (action, entity) values ('palsu', 'x')$$, 'siswa tidak dapat menulis log audit');
select t.login(t.u('2'));
select t.eq(t.count($$select 1 from public.audit_logs$$), 0, 'guru tidak membaca log audit');
select t.login(t.u('1'));
select t.eq(t.count($$select 1 from public.audit_logs where action = 'profile.role_changed'$$), 3, 'perubahan peran tercatat pada log audit');
select t.eq((t.count($$select 1 from public.audit_logs where action = 'question.status_changed'$$) > 0)::int::bigint, 1, 'perubahan status soal tercatat');
select t.fails($$update public.audit_logs set action = 'diubah'$$, 'log audit tidak dapat diubah, bahkan oleh admin');
select t.fails($$delete from public.audit_logs$$, 'log audit tidak dapat dihapus, bahkan oleh admin');
select t.fails($$update public.profiles set role = 'student' where id = t.u('1')$$, 'admin terakhir tidak dapat diturunkan');
select t.fails($$update public.profiles set is_active = false where id = t.u('1')$$, 'admin terakhir tidak dapat dinonaktifkan');

-- ================================================================ ANON
select t.anon();
select t.fails($$select 1 from public.profiles$$, 'pengguna anonim tidak dapat membaca profil');
select t.fails($$select 1 from public.questions$$, 'pengguna anonim tidak dapat membaca soal');
select t.fails($$select 1 from public.curriculum_nodes$$, 'pengguna anonim tidak dapat membaca kurikulum');

select t.logout();
