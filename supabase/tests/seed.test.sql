-- Uji seed: kurikulum dan soal draf awal harus lolos validasi server.
-- Memerlukan variabel lingkungan MQ_ROOT (diatur oleh run-rls-tests.sh).
\set ON_ERROR_STOP on
select t.logout();
\ir ../seed/01_curriculum.sql
\ir ../seed/01_curriculum.sql
\ir ../seed/02_concepts.sql
\ir ../seed/02_concepts.sql

select t.eq(t.count($$select 1 from public.curriculum_nodes where code ~ '^(BIL|GEO|KOM|DAT)-[123]-0[0-9]$'$$), 32, 'seed memuat 32 submateri');
select t.eq(t.count($$select 1 from public.curriculum_prerequisites p join public.curriculum_nodes n on n.id = p.node_id where n.code ~ '^(BIL|GEO|KOM|DAT)-[123]-0[0-9]$'$$), 32, 'seed memuat prasyarat dan aman dijalankan ulang (tanpa ganda)');
select t.eq(t.count($$select 1 from public.curriculum_nodes where validation_status <> 'belum_divalidasi' and code ~ '^(BIL|GEO|KOM|DAT)-[123]-0[0-9]$'$$), 0, 'seed tidak menandai kurikulum sebagai tervalidasi');

select t.eq(t.count($$select 1 from public.curriculum_nodes where code ~ '^(BIL|GEO|KOM|DAT)-[123]-0[0-9]$' and char_length(concept_text) > 100$$), 32, 'seed materi mengisi penjelasan konsep 32 submateri');

\set seedq `cat "$MQ_ROOT/supabase/seed/questions_draft.json"`
select t.login(t.u('2'));
create temp table seed_result as select public.import_questions(:'seedq'::jsonb) as r;
grant all on seed_result to public;
select t.eq((select count(*) from jsonb_array_elements(r) x where not (x ->> 'ok')::boolean), 0, 'semua soal draf awal lolos impor tanpa galat') from seed_result;
select t.eq((select count(*) from jsonb_array_elements(r) x where (x ->> 'ok')::boolean), 40, '40 soal draf awal terimpor') from seed_result;
select t.logout();
select t.eq(t.count($$select 1 from public.questions q join public.curriculum_nodes n on n.id = q.node_id where n.code ~ '^(BIL|GEO|KOM|DAT)-[123]-0[0-9]$' and q.status = 'draft' and not q.validated and q.ai_assisted$$), 40, 'soal awal berstatus draf, belum tervalidasi, dan bertanda bantuan AI');

-- setiap soal awal harus lolos pemeriksaan kelengkapan server
select t.eq((select count(*) from public.questions q join public.curriculum_nodes n on n.id = q.node_id
  where n.code ~ '^(BIL|GEO|KOM|DAT)-[123]-0[0-9]$' and cardinality(app.question_problems(q.current_version_id)) > 0), 0, 'tidak ada soal awal yang memiliki masalah kelengkapan');
select t.eq(t.count($$select 1 from public.questions q join public.curriculum_nodes n on n.id = q.node_id where n.code ~ '^(BIL|GEO|KOM|DAT)-[123]-0[0-9]$' group by n.domain$$), 4, 'soal awal mencakup empat domain');
select t.eq((select count(distinct v.answer_type) from public.questions q join public.question_versions v on v.id = q.current_version_id join public.curriculum_nodes n on n.id = q.node_id where n.code ~ '^(BIL|GEO|KOM|DAT)-[123]-0[0-9]$'), 10, 'soal awal mencakup 10 jenis jawaban');
