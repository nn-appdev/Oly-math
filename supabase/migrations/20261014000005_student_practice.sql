-- Fase 3: latihan siswa dengan penilaian di server.
-- Prinsip: siswa TIDAK membaca tabel soal/kunci/sesi secara langsung. Semua lewat fungsi di bawah yang
--   (1) tidak pernah mengirim kunci sebelum item selesai,
--   (2) mengacak butir urutan/pencocokan (urutan opsi di database sama dengan kuncinya),
--   (3) menilai jawaban di server (is_correct tidak pernah dipercaya dari klien),
--   (4) idempoten pada idempotency_key.
-- Migrasi ini idempoten dan harus dijalankan setelah migrasi 4.

create schema if not exists app;

-- ============================================================ A. pembatasan akses langsung siswa
drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions for select to authenticated
  using (
    app.is_admin()
    or (app.is_staff() and (created_by = auth.uid() or reviewer_id = auth.uid() or status in ('published', 'review')))
  );

drop policy if exists versions_select on public.question_versions;
create policy versions_select on public.question_versions for select to authenticated
  using (app.is_staff() and exists (select 1 from public.questions q where q.id = question_id));

-- Sesi hanya dibuat dan diubah lewat fungsi server (state dapat dimanipulasi bila dibuka untuk klien).
revoke insert, update on public.learning_sessions from authenticated;
drop policy if exists sessions_insert on public.learning_sessions;
drop policy if exists sessions_update on public.learning_sessions;

-- ============================================================ B. pembantu
create or replace function app.require_student() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not app.is_student() then
    raise exception 'fitur ini hanya untuk siswa' using errcode = 'MQ403';
  end if;
  return auth.uid();
end $$;

create or replace function app.jsonb_sorted(p_arr jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(x order by x::text), '[]'::jsonb) from jsonb_array_elements(p_arr) x;
$$;

create or replace function app.is_finite_number(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select jsonb_typeof(p) = 'number' and abs((p #>> '{}')::numeric) <= 1000000000;
$$;

-- ---------------------------------------------------------- normalizeResponse
-- Mengubah jawaban mentah menjadi bentuk kanonik atau melempar MQ422 bila bentuknya tidak valid.
create or replace function app.normalize_response(
  p_type public.answer_type, p_options jsonb, p_visual jsonb, p_resp jsonb
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  t text := p_type::text;
  ids text[];
  rids text[];
  n int;
  v jsonb;
  num numeric;
  rows_n int;
  cols_n int;
begin
  if jsonb_typeof(p_resp) is distinct from 'object' or octet_length(p_resp::text) > 10000 then
    raise exception 'jawabanmu belum dapat dibaca' using errcode = 'MQ422';
  end if;

  if t = 'single_choice' then
    ids := array(select o ->> 'id' from jsonb_array_elements(p_options) o);
    if jsonb_typeof(p_resp -> 'choice') is distinct from 'string' or not ((p_resp ->> 'choice') = any (ids)) then
      raise exception 'pilih salah satu jawaban yang tersedia' using errcode = 'MQ422';
    end if;
    return jsonb_build_object('choice', p_resp ->> 'choice');

  elsif t in ('multi_choice', 'possibilities') then
    ids := array(select o ->> 'id' from jsonb_array_elements(p_options) o);
    if jsonb_typeof(p_resp -> 'choices') is distinct from 'array'
       or exists (select 1 from jsonb_array_elements(p_resp -> 'choices') c where jsonb_typeof(c) is distinct from 'string' or not ((c #>> '{}') = any (ids))) then
      raise exception 'pilih jawaban dari daftar yang tersedia' using errcode = 'MQ422';
    end if;
    n := jsonb_array_length(p_resp -> 'choices');
    if n < 1 or (select count(distinct c) from jsonb_array_elements_text(p_resp -> 'choices') c) <> n then
      raise exception 'pilih minimal satu jawaban, tanpa pilihan ganda' using errcode = 'MQ422';
    end if;
    return jsonb_build_object('choices', app.jsonb_sorted(p_resp -> 'choices'));

  elsif t in ('numeric', 'geometry_puzzle') or (t = 'visual' and p_visual ->> 'kind' = 'number_line') then
    v := p_resp -> 'value';
    if jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^\s*-?[0-9]+([.,][0-9]+)?\s*$' then
      num := replace(btrim(v #>> '{}'), ',', '.')::numeric;
    elsif jsonb_typeof(v) = 'number' and app.is_finite_number(v) then
      num := (v #>> '{}')::numeric;
    else
      raise exception 'tulis jawabanmu berupa angka' using errcode = 'MQ422';
    end if;
    if abs(num) > 1000000000 then
      raise exception 'angkanya terlalu besar' using errcode = 'MQ422';
    end if;
    if t = 'visual' and (num < (p_visual ->> 'min')::numeric or num > (p_visual ->> 'max')::numeric) then
      raise exception 'pilih titik pada garis bilangan' using errcode = 'MQ422';
    end if;
    return jsonb_build_object('value', num);

  elsif t = 'true_false' then
    if jsonb_typeof(p_resp -> 'value') is distinct from 'boolean' then
      raise exception 'pilih Benar atau Salah' using errcode = 'MQ422';
    end if;
    return jsonb_build_object('value', p_resp -> 'value');

  elsif t = 'ordering' then
    ids := array(select o ->> 'id' from jsonb_array_elements(p_options) o);
    if jsonb_typeof(p_resp -> 'order') is distinct from 'array'
       or jsonb_array_length(p_resp -> 'order') <> cardinality(ids)
       or exists (select 1 from jsonb_array_elements(p_resp -> 'order') c where jsonb_typeof(c) is distinct from 'string' or not ((c #>> '{}') = any (ids)))
       or (select count(distinct c) from jsonb_array_elements_text(p_resp -> 'order') c) <> cardinality(ids) then
      raise exception 'susun semua butir tepat satu kali' using errcode = 'MQ422';
    end if;
    return jsonb_build_object('order', p_resp -> 'order');

  elsif t = 'matching' then
    ids := array(select o ->> 'id' from jsonb_array_elements(p_options -> 'left') o);
    rids := array(select o ->> 'id' from jsonb_array_elements(p_options -> 'right') o);
    n := cardinality(ids);
    if jsonb_typeof(p_resp -> 'pairs') is distinct from 'array'
       or jsonb_array_length(p_resp -> 'pairs') <> n
       or exists (select 1 from jsonb_array_elements(p_resp -> 'pairs') x
                  where jsonb_typeof(x) is distinct from 'object'
                     or jsonb_typeof(x -> 'left') is distinct from 'string' or jsonb_typeof(x -> 'right') is distinct from 'string'
                     or not ((x ->> 'left') = any (ids)) or not ((x ->> 'right') = any (rids)))
       or (select count(distinct x ->> 'left') from jsonb_array_elements(p_resp -> 'pairs') x) <> n
       or (select count(distinct x ->> 'right') from jsonb_array_elements(p_resp -> 'pairs') x) <> n then
      raise exception 'pasangkan setiap butir kiri dengan satu butir kanan' using errcode = 'MQ422';
    end if;
    return jsonb_build_object('pairs', (
      select jsonb_agg(jsonb_build_object('left', x ->> 'left', 'right', x ->> 'right') order by x ->> 'left')
      from jsonb_array_elements(p_resp -> 'pairs') x));

  elsif t = 'visual' and p_visual ->> 'kind' = 'grid_select' then
    rows_n := (p_visual ->> 'rows')::int;
    cols_n := (p_visual ->> 'cols')::int;
    if cardinality(app.cells_problems(p_resp -> 'cells', rows_n, cols_n, 0, 'Jawaban')) > 0 then
      raise exception 'pilih petak yang ada pada kisi' using errcode = 'MQ422';
    end if;
    return jsonb_build_object('cells', app.jsonb_sorted(p_resp -> 'cells'));

  elsif t = 'logic_puzzle' then
    ids := array(select o ->> 'id' from jsonb_array_elements(p_visual -> 'entities') o);
    n := cardinality(ids);
    if jsonb_typeof(p_resp -> 'arrangement') is distinct from 'array'
       or jsonb_array_length(p_resp -> 'arrangement') <> n
       or exists (select 1 from jsonb_array_elements(p_resp -> 'arrangement') c where jsonb_typeof(c) is distinct from 'string' or not ((c #>> '{}') = any (ids)))
       or (select count(distinct c) from jsonb_array_elements_text(p_resp -> 'arrangement') c) <> n then
      raise exception 'tempatkan setiap tokoh tepat satu kali' using errcode = 'MQ422';
    end if;
    return jsonb_build_object('arrangement', p_resp -> 'arrangement');
  end if;

  raise exception 'jenis soal tidak dikenal' using errcode = 'MQ422';
end $$;

-- ---------------------------------------------------------- evaluateAnswer + indikasi miskonsepsi
-- Mengembalikan {correct: bool, misconception: teks|null}. Miskonsepsi hanya INDIKASI dari pola jawaban.
create or replace function app.evaluate_answer(
  p_type public.answer_type, p_visual jsonb, p_key jsonb, p_miscs jsonb, p_norm jsonb
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  t text := p_type::text;
  ok boolean := false;
  misc text;
begin
  if t = 'single_choice' then
    ok := (p_norm ->> 'choice') = (p_key ->> 'correct');
    if not ok then
      select m ->> 'label' into misc from jsonb_array_elements(p_miscs) m where m ->> 'option_id' = p_norm ->> 'choice' limit 1;
    end if;

  elsif t in ('multi_choice', 'possibilities') then
    ok := (p_norm -> 'choices') = app.jsonb_sorted(p_key -> 'correct');
    if not ok then
      select m ->> 'label' into misc
        from jsonb_array_elements(p_miscs) m
       where (p_norm -> 'choices') @> to_jsonb(m ->> 'option_id')
         and not ((p_key -> 'correct') @> to_jsonb(m ->> 'option_id'))
       limit 1;
    end if;

  elsif t in ('numeric', 'geometry_puzzle') or (t = 'visual' and p_visual ->> 'kind' = 'number_line') then
    ok := (p_norm ->> 'value')::numeric = (p_key ->> 'value')::numeric;
    if not ok then
      select m ->> 'label' into misc from jsonb_array_elements(p_miscs) m
       where m ? 'value' and (m ->> 'value')::numeric = (p_norm ->> 'value')::numeric limit 1;
    end if;

  elsif t = 'true_false' then
    ok := (p_norm -> 'value') = (p_key -> 'value');

  elsif t = 'ordering' then
    ok := (p_norm -> 'order') = (p_key -> 'order');

  elsif t = 'matching' then
    ok := (p_norm -> 'pairs') = (
      select jsonb_agg(jsonb_build_object('left', x ->> 'left', 'right', x ->> 'right') order by x ->> 'left')
      from jsonb_array_elements(p_key -> 'pairs') x);

  elsif t = 'visual' and p_visual ->> 'kind' = 'grid_select' then
    ok := (p_norm -> 'cells') = app.jsonb_sorted(p_key -> 'cells');

  elsif t = 'logic_puzzle' then
    ok := (p_norm -> 'arrangement') = (p_key -> 'arrangement');
  end if;

  return jsonb_build_object('correct', ok, 'misconception', misc);
end $$;

-- ---------------------------------------------------------- penyajian butir (tanpa kunci, diacak)
create or replace function app.present_item(p_session uuid, p_version uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v public.question_versions;
  k public.question_keys;
  opts jsonb;
  shuffled jsonb;
begin
  select * into v from public.question_versions where id = p_version;
  select * into k from public.question_keys where question_version_id = p_version;
  opts := v.options;

  if v.answer_type = 'ordering' then
    select jsonb_agg(o order by md5(p_session::text || p_version::text || (o ->> 'id'))) into shuffled
      from jsonb_array_elements(v.options) o;
    -- jangan sampai urutan acak kebetulan sama dengan kunci
    if (select jsonb_agg(o ->> 'id') from jsonb_array_elements(shuffled) o) = (k.answer_key -> 'order') then
      shuffled := (shuffled -> 1) || (shuffled -> 0) || coalesce((select jsonb_agg(x) from jsonb_array_elements(shuffled) with ordinality t (x, i) where i > 2), '[]'::jsonb);
    end if;
    opts := shuffled;
  elsif v.answer_type = 'matching' then
    select jsonb_agg(o order by md5(p_session::text || p_version::text || (o ->> 'id'))) into shuffled
      from jsonb_array_elements(v.options -> 'right') o;
    opts := jsonb_build_object('left', v.options -> 'left', 'right', shuffled);
  end if;

  return jsonb_build_object(
    'version_id', v.id,
    'answer_type', v.answer_type,
    'statement', v.statement,
    'instructions', v.instructions,
    'options', opts,
    'visual_data', v.visual_data,
    'recommended_seconds', v.recommended_seconds,
    'grade', v.grade,
    'difficulty', v.difficulty,
    'cognitive_level', v.cognitive_level,
    'hints_total', jsonb_array_length(k.hints)
  );
end $$;

-- ---------------------------------------------------------- status item pada sesi
create or replace function app.item_attempts(p_session uuid, p_version uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.attempts a where a.session_id = p_session and a.question_version_id = p_version;
$$;

create or replace function app.item_finished(p_session uuid, p_version uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.attempts a
    where a.session_id = p_session and a.question_version_id = p_version and (a.is_correct or a.attempt_no >= 2)
  );
$$;

create or replace function app.own_session(p_session uuid, p_kind public.session_kind default 'practice')
returns public.learning_sessions language plpgsql security definer set search_path = '' as $$
declare s public.learning_sessions;
begin
  select * into s from public.learning_sessions
   where id = p_session and student_id = auth.uid() for update;
  if not found or s.kind <> p_kind then
    raise exception 'sesi latihan tidak ditemukan' using errcode = 'MQ404';
  end if;
  return s;
end $$;

-- ---------------------------------------------------------- pemilihan butir berikutnya (aturan tangga sederhana)
-- Catatan: ini BUKAN mesin adaptif lengkap (Fase 4). Target kesulitan naik 1 tiap jawaban benar pada percobaan pertama,
-- turun 1 tiap butir yang berakhir salah; butir yang belum pernah dikerjakan siswa didahulukan.
create or replace function app.pick_next_version(p_session uuid, p_student uuid, p_node uuid, p_grade smallint)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare
  good int;
  bad int;
  target int;
  picked uuid;
begin
  select count(*) filter (where a.is_correct and a.attempt_no = 1),
         count(*) filter (where not a.is_correct and a.attempt_no >= 2)
    into good, bad
    from public.attempts a where a.session_id = p_session;
  target := least(5, greatest(1, 2 + good - bad));

  select q.current_version_id into picked
    from public.questions q
    join public.question_versions v on v.id = q.current_version_id
   where q.node_id = p_node and q.status = 'published' and q.validated
     and (p_grade is null or v.grade <= p_grade)
     and not exists (select 1 from public.attempts a where a.session_id = p_session and a.question_version_id = v.id)
   order by
     exists (select 1 from public.attempts a2 where a2.student_id = p_student and a2.question_version_id = v.id) asc,
     abs(v.difficulty - target) asc,
     v.cognitive_level desc,
     q.code asc
   limit 1;
  return picked;
end $$;

-- ============================================================ C. RPC publik untuk siswa
create or replace function public.start_practice(p_node uuid, p_client_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := app.require_student();
  prof public.profiles;
  nd public.curriculum_nodes;
  s public.learning_sessions;
begin
  if p_client_token is null or char_length(p_client_token) not between 8 and 80 then
    raise exception 'token sesi tidak valid' using errcode = 'MQ422';
  end if;
  select * into prof from public.profiles where id = uid;
  select * into nd from public.curriculum_nodes where id = p_node;
  if not found then
    raise exception 'materi tidak ditemukan' using errcode = 'MQ404';
  end if;
  if prof.grade is not null and nd.grade_min > prof.grade then
    raise exception 'materi ini untuk kelas yang lebih tinggi' using errcode = 'MQ403';
  end if;

  -- idempoten pada token
  select * into s from public.learning_sessions where student_id = uid and client_token = p_client_token;
  if found then
    if s.node_id is distinct from p_node or s.kind <> 'practice' then
      raise exception 'token sesi sudah dipakai' using errcode = 'MQ409';
    end if;
    return jsonb_build_object('session_id', s.id, 'resumed', true);
  end if;

  -- lanjutkan sesi berjalan pada materi yang sama
  select * into s from public.learning_sessions
   where student_id = uid and node_id = p_node and kind = 'practice' and status = 'in_progress'
     and last_active_at > now() - interval '12 hours'
   order by last_active_at desc limit 1;
  if found then
    return jsonb_build_object('session_id', s.id, 'resumed', true);
  end if;

  if app.pick_next_version(gen_random_uuid(), uid, p_node, prof.grade) is null then
    raise exception 'belum ada soal yang siap untuk materi ini' using errcode = 'MQ404';
  end if;

  insert into public.learning_sessions (student_id, node_id, kind, client_token, state)
  values (uid, p_node, 'practice', p_client_token, '{"done":0}'::jsonb)
  returning * into s;
  return jsonb_build_object('session_id', s.id, 'resumed', false);
end $$;

create or replace function public.next_practice_item(p_session uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := app.require_student();
  s public.learning_sessions;
  prof public.profiles;
  cur uuid;
  picked uuid;
  hints_used int;
  item jsonb;
  k public.question_keys;
  total_done int;
  max_items constant int := 10;
begin
  s := app.own_session(p_session);
  if s.status <> 'in_progress' then
    return jsonb_build_object('done', true, 'reason', 'selesai');
  end if;
  select * into prof from public.profiles where id = uid;

  cur := nullif(s.state #>> '{current,version_id}', '')::uuid;
  if cur is not null and not app.item_finished(s.id, cur) then
    picked := cur;
  else
    select count(distinct a.question_version_id)::int into total_done
      from public.attempts a where a.session_id = s.id and app.item_finished(s.id, a.question_version_id);
    if total_done >= max_items then
      return jsonb_build_object('done', true, 'reason', 'target_tercapai');
    end if;
    picked := app.pick_next_version(s.id, uid, s.node_id, prof.grade);
    if picked is null then
      return jsonb_build_object('done', true, 'reason', 'soal_habis');
    end if;
    update public.learning_sessions
       set state = jsonb_set(coalesce(state, '{}'::jsonb) - 'draft', '{current}',
             jsonb_build_object('version_id', picked, 'hints_used', 0, 'shown_at', now()), true),
           last_active_at = now()
     where id = s.id;
  end if;

  select * into k from public.question_keys where question_version_id = picked;
  hints_used := coalesce(nullif((select state #>> '{current,hints_used}' from public.learning_sessions where id = s.id), '')::int, 0);
  item := app.present_item(s.id, picked);
  return jsonb_build_object(
    'done', false,
    'item', item,
    'attempts_used', app.item_attempts(s.id, picked),
    'max_attempts', 2,
    'hints_used', hints_used,
    'hints_shown', coalesce((select jsonb_agg(h order by i) from jsonb_array_elements(k.hints) with ordinality t (h, i) where i <= hints_used), '[]'::jsonb),
    'draft', (select state -> 'draft' from public.learning_sessions where id = s.id),
    'progress', jsonb_build_object(
      'finished', (select count(distinct a.question_version_id) from public.attempts a where a.session_id = s.id and app.item_finished(s.id, a.question_version_id)),
      'target', max_items)
  );
end $$;

create or replace function public.request_hint(p_session uuid, p_version uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.learning_sessions;
  k public.question_keys;
  used int;
  total int;
begin
  perform app.require_student();
  s := app.own_session(p_session);
  if s.status <> 'in_progress' or (s.state #>> '{current,version_id}') is distinct from p_version::text
     or app.item_finished(s.id, p_version) then
    raise exception 'petunjuk hanya tersedia untuk soal yang sedang dikerjakan' using errcode = 'MQ409';
  end if;
  select * into k from public.question_keys where question_version_id = p_version;
  total := jsonb_array_length(k.hints);
  used := coalesce(nullif(s.state #>> '{current,hints_used}', '')::int, 0);
  if used >= total then
    raise exception 'semua petunjuk sudah kamu pakai' using errcode = 'MQ409';
  end if;
  update public.learning_sessions
     set state = jsonb_set(state, '{current,hints_used}', to_jsonb(used + 1), true), last_active_at = now()
   where id = s.id;
  return jsonb_build_object('hint', k.hints ->> used, 'index', used + 1, 'total', total);
end $$;

-- Hasil sebuah percobaan; kunci dan pembahasan hanya dikirim bila butir sudah selesai.
create or replace function app.attempt_result(p_attempt public.attempts)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  finished boolean := p_attempt.is_correct or p_attempt.attempt_no >= 2;
  k public.question_keys;
  res jsonb;
begin
  res := jsonb_build_object(
    'correct', p_attempt.is_correct,
    'attempt_no', p_attempt.attempt_no,
    'finished', finished,
    'can_retry', not finished,
    'hints_used', p_attempt.hints_used
  );
  if finished then
    select * into k from public.question_keys where question_version_id = p_attempt.question_version_id;
    res := res || jsonb_build_object('reveal', jsonb_build_object('answer_key', k.answer_key, 'explanation', k.explanation));
  end if;
  return res;
end $$;

create or replace function public.submit_answer(
  p_session uuid, p_version uuid, p_response jsonb, p_idempotency_key text, p_time_ms integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := app.require_student();
  s public.learning_sessions;
  v public.question_versions;
  k public.question_keys;
  prev public.attempts;
  norm jsonb;
  ev jsonb;
  no int;
  hints int;
  a public.attempts;
  fin boolean;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 8 and 80 then
    raise exception 'kode pengiriman tidak valid' using errcode = 'MQ422';
  end if;

  -- pengiriman ulang dengan kunci yang sama mengembalikan hasil yang sama
  select * into prev from public.attempts where student_id = uid and idempotency_key = p_idempotency_key;
  if found then
    if prev.session_id <> p_session or prev.question_version_id <> p_version then
      raise exception 'kode pengiriman sudah dipakai' using errcode = 'MQ409';
    end if;
    return app.attempt_result(prev) || jsonb_build_object('duplicate', true);
  end if;

  s := app.own_session(p_session);
  if s.status <> 'in_progress' then
    raise exception 'sesi latihan sudah selesai' using errcode = 'MQ409';
  end if;
  if (s.state #>> '{current,version_id}') is distinct from p_version::text then
    raise exception 'soal ini bukan soal yang sedang dikerjakan' using errcode = 'MQ409';
  end if;
  if app.item_finished(s.id, p_version) then
    raise exception 'soal ini sudah selesai dikerjakan' using errcode = 'MQ409';
  end if;
  if (select count(*) from public.attempts a2 where a2.student_id = uid and a2.created_at > now() - interval '10 seconds') >= 20 then
    raise exception 'terlalu cepat, tunggu sebentar lalu coba lagi' using errcode = 'MQ429';
  end if;

  select * into v from public.question_versions where id = p_version;
  select * into k from public.question_keys where question_version_id = p_version;
  norm := app.normalize_response(v.answer_type, v.options, v.visual_data, p_response);
  ev := app.evaluate_answer(v.answer_type, v.visual_data, k.answer_key, k.misconceptions, norm);

  no := app.item_attempts(s.id, p_version) + 1;
  hints := coalesce(nullif(s.state #>> '{current,hints_used}', '')::int, 0);

  insert into public.attempts (session_id, student_id, question_version_id, response, is_correct, attempt_no, hints_used, time_ms,
                               misconception_flag, idempotency_key)
  values (s.id, uid, p_version, norm, (ev ->> 'correct')::boolean, no, hints,
          case when p_time_ms between 0 and 3600000 then p_time_ms end,
          ev ->> 'misconception', p_idempotency_key)
  returning * into a;

  fin := a.is_correct or a.attempt_no >= 2;
  update public.learning_sessions
     set last_active_at = now(),
         state = (state - 'draft') || case when fin then jsonb_build_object('done', coalesce(nullif(state ->> 'done', '')::int, 0) + 1) else '{}'::jsonb end
   where id = s.id;
  if fin then
    update public.learning_sessions set state = state #- '{current}' where id = s.id;
  end if;
  return app.attempt_result(a);
end $$;

create or replace function public.save_draft(p_session uuid, p_version uuid, p_draft jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.learning_sessions;
begin
  perform app.require_student();
  s := app.own_session(p_session);
  if s.status <> 'in_progress' or (s.state #>> '{current,version_id}') is distinct from p_version::text then
    return;
  end if;
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' or octet_length(p_draft::text) > 10000 then
    raise exception 'draf jawaban tidak valid' using errcode = 'MQ422';
  end if;
  update public.learning_sessions
     set state = jsonb_set(state, '{draft}', p_draft, true), last_active_at = now()
   where id = s.id;
end $$;

create or replace function public.end_practice(p_session uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  s public.learning_sessions;
  res jsonb;
begin
  perform app.require_student();
  s := app.own_session(p_session);
  if s.status = 'in_progress' then
    update public.learning_sessions set status = 'completed', completed_at = now(), last_active_at = now(), state = state - 'draft' - 'current'
     where id = s.id;
  end if;
  select jsonb_build_object(
    'items', count(distinct a.question_version_id),
    'first_try_correct', count(*) filter (where a.is_correct and a.attempt_no = 1),
    'correct_items', count(distinct a.question_version_id) filter (where a.is_correct),
    'hints_used', coalesce(sum(a.hints_used) filter (where a.attempt_no = 1), 0),
    'attempts', count(*))
    into res from public.attempts a where a.session_id = s.id;
  return res;
end $$;

-- ---------------------------------------------------------- peta belajar
create or replace function public.my_learning_map()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := app.require_student();
  g smallint;
begin
  select grade into g from public.profiles where id = uid;
  return jsonb_build_object(
    'grade', g,
    'nodes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'code', n.code, 'domain', n.domain, 'title', n.title,
        'grade_min', n.grade_min, 'grade_max', n.grade_max, 'objectives', n.objectives,
        'available', (g is null or n.grade_min <= g),
        'question_count', (select count(*) from public.questions q join public.question_versions v on v.id = q.current_version_id
                            where q.node_id = n.id and q.status = 'published' and q.validated and (g is null or v.grade <= g)),
        'attempted_items', (select count(distinct a.question_version_id) from public.attempts a
                             join public.question_versions v on v.id = a.question_version_id
                             join public.questions q on q.id = v.question_id
                            where a.student_id = uid and q.node_id = n.id),
        'correct_items', (select count(distinct a.question_version_id) from public.attempts a
                           join public.question_versions v on v.id = a.question_version_id
                           join public.questions q on q.id = v.question_id
                          where a.student_id = uid and q.node_id = n.id and a.is_correct),
        'last_practiced_at', (select max(s.last_active_at) from public.learning_sessions s where s.student_id = uid and s.node_id = n.id),
        'prerequisites', coalesce((select jsonb_agg(p.prerequisite_id) from public.curriculum_prerequisites p where p.node_id = n.id), '[]'::jsonb)
      ) order by n.sort_order, n.code)
      from public.curriculum_nodes n), '[]'::jsonb)
  );
end $$;

-- ---------------------------------------------------------- riwayat dan pembahasan
create or replace function public.my_history(p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := app.require_student();
  lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  return coalesce((
    select jsonb_agg(r order by r ->> 'created_at' desc) from (
      select jsonb_build_object(
        'attempt_id', a.id, 'created_at', a.created_at, 'correct', a.is_correct, 'attempt_no', a.attempt_no,
        'hints_used', a.hints_used, 'statement', v.statement, 'answer_type', v.answer_type,
        'node_code', n.code, 'node_title', n.title,
        'reviewable', app.item_finished(a.session_id, a.question_version_id)) as r
      from public.attempts a
      join public.question_versions v on v.id = a.question_version_id
      join public.questions q on q.id = v.question_id
      join public.curriculum_nodes n on n.id = q.node_id
      where a.student_id = uid
      order by a.created_at desc
      limit lim) x), '[]'::jsonb);
end $$;

create or replace function public.my_review_item(p_attempt uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := app.require_student();
  a public.attempts;
  v public.question_versions;
  k public.question_keys;
begin
  select * into a from public.attempts where id = p_attempt and student_id = uid;
  if not found then
    raise exception 'riwayat tidak ditemukan' using errcode = 'MQ404';
  end if;
  if not app.item_finished(a.session_id, a.question_version_id) then
    raise exception 'pembahasan terbuka setelah soal selesai dikerjakan' using errcode = 'MQ403';
  end if;
  select * into v from public.question_versions where id = a.question_version_id;
  select * into k from public.question_keys where question_version_id = a.question_version_id;
  return jsonb_build_object(
    'item', jsonb_build_object(
      'version_id', v.id, 'answer_type', v.answer_type, 'statement', v.statement, 'instructions', v.instructions,
      'options', v.options, 'visual_data', v.visual_data),
    'my_response', a.response,
    'correct', a.is_correct,
    'reveal', jsonb_build_object('answer_key', k.answer_key, 'explanation', k.explanation));
end $$;

-- ============================================================ D. hak akses
revoke all on function app.require_student(), app.jsonb_sorted(jsonb), app.is_finite_number(jsonb),
  app.normalize_response(public.answer_type, jsonb, jsonb, jsonb),
  app.evaluate_answer(public.answer_type, jsonb, jsonb, jsonb, jsonb),
  app.present_item(uuid, uuid), app.item_attempts(uuid, uuid), app.item_finished(uuid, uuid),
  app.own_session(uuid, public.session_kind), app.pick_next_version(uuid, uuid, uuid, smallint),
  app.attempt_result(public.attempts)
  from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.start_practice(uuid, text)',
    'public.next_practice_item(uuid)',
    'public.request_hint(uuid, uuid)',
    'public.submit_answer(uuid, uuid, jsonb, text, integer)',
    'public.save_draft(uuid, uuid, jsonb)',
    'public.end_practice(uuid)',
    'public.my_learning_map()',
    'public.my_history(integer)',
    'public.my_review_item(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
