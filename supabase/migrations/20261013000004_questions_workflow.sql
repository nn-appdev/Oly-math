-- MathQuest Junior — Migrasi 4 (Fase 2): alur bank soal dan penguatan kurikulum.
-- Idempoten. Dijalankan setelah migrasi 1–3.
--
-- Ringkasan:
--  A. Hints dan miskonsepsi dipindah ke question_keys (hanya staf). Jika tetap di question_versions,
--     opsi yang tidak punya miskonsepsi otomatis membocorkan kunci jawaban kepada siswa.
--  B. Versi soal "beku" saat diterbitkan; versi draf boleh diedit di tempat.
--  C. Penulisan soal HANYA lewat fungsi RPC (kode otomatis, validasi di server, alur status, jejak telaah).
--  D. Validasi kelengkapan di server untuk 10 jenis soal (termasuk keunikan solusi puzzle logika).
--  E. Pencegah siklus prasyarat kurikulum, audit perubahan kurikulum, tampilan bank soal.

create schema if not exists app;

-- ============================================================ A. kolom
alter table public.question_keys add column if not exists hints jsonb not null default '[]'::jsonb;
alter table public.question_keys add column if not exists misconceptions jsonb not null default '[]'::jsonb;
alter table public.question_keys add column if not exists updated_at timestamptz not null default now();
alter table public.question_versions add column if not exists frozen_at timestamptz;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'question_versions' and column_name = 'hints'
  ) then
    -- Peningkatan dari skema Fase 1: salin data lama ke tabel kunci, lalu hapus kolom lama.
    alter table public.question_keys disable trigger trg_keys_immutable;
    update public.question_keys k
       set hints = v.hints, misconceptions = v.targeted_misconceptions
      from public.question_versions v
     where v.id = k.question_version_id;
    alter table public.question_keys enable trigger trg_keys_immutable;
    alter table public.question_versions drop column hints;
    alter table public.question_versions drop column targeted_misconceptions;
  end if;
end $$;

-- ============================================================ B. versi beku
drop trigger if exists trg_versions_immutable on public.question_versions;
drop trigger if exists trg_keys_immutable on public.question_keys;

create or replace function app.frozen_version_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.frozen_at is not null then
    raise exception 'versi soal yang sudah terbit atau diarsipkan bersifat permanen; buat versi baru'
      using errcode = 'MQ409';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if new.question_id <> old.question_id or new.version_no <> old.version_no or new.created_by <> old.created_by then
    raise exception 'identitas versi soal tidak boleh diubah' using errcode = 'MQ409';
  end if;
  return new;
end $$;

drop trigger if exists trg_versions_frozen on public.question_versions;
create trigger trg_versions_frozen before update or delete on public.question_versions
  for each row execute function app.frozen_version_guard();

create or replace function app.frozen_key_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_frozen timestamptz;
  v_found boolean;
begin
  select v.frozen_at, true into v_frozen, v_found
    from public.question_versions v where v.id = old.question_version_id;
  -- versi induk sudah tidak ada (hapus berantai): izinkan
  if coalesce(v_found, false) and v_frozen is not null then
    raise exception 'kunci dan pembahasan versi yang sudah terbit bersifat permanen; buat versi baru'
      using errcode = 'MQ409';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  if new.question_version_id <> old.question_version_id then
    raise exception 'versi kunci tidak boleh dipindahkan' using errcode = 'MQ409';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_keys_frozen on public.question_keys;
create trigger trg_keys_frozen before update or delete on public.question_keys
  for each row execute function app.frozen_key_guard();

-- Bekukan versi lama: soal terbit/arsip, versi yang bukan versi aktif, dan versi pada asesmen.
update public.question_versions v
   set frozen_at = now()
 where v.frozen_at is null
   and (
     exists (select 1 from public.questions q
             where q.id = v.question_id
               and (q.status in ('published', 'archived') or q.current_version_id is distinct from v.id))
     or exists (select 1 from public.assessment_items i where i.question_version_id = v.id)
   );

-- Versi baru: soal kembali ke DRAF (harus diajukan ulang dan lolos kelengkapan), validasi dicabut.
create or replace function app.versions_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.questions q
     set current_version_id = new.id,
         status = case when q.status in ('published', 'archived') then 'draft'::public.question_status else q.status end,
         validated = false,
         reviewer_id = null
   where q.id = new.question_id;
  return new;
end $$;

-- ============================================================ C. jejak telaah, penghitung kode
create table if not exists public.question_review_events (
  id          bigint generated always as identity primary key,
  question_id uuid not null references public.questions (id) on delete cascade,
  version_id  uuid references public.question_versions (id),
  actor_id    uuid not null references public.profiles (id),
  event       text not null check (event in ('submitted', 'approved', 'returned', 'published', 'archived')),
  notes       text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists review_events_question_idx on public.question_review_events (question_id, created_at);

drop trigger if exists trg_review_events_immutable on public.question_review_events;
create trigger trg_review_events_immutable before update or delete on public.question_review_events
  for each row execute function app.immutable_row();

create table if not exists public.question_code_counters (
  prefix   text not null check (prefix ~ '^[A-Z]{3}$'),
  grade    smallint not null check (grade between 1 and 3),
  last_no  integer not null default 0,
  primary key (prefix, grade)
);

alter table public.question_review_events enable row level security;
alter table public.question_code_counters enable row level security;
revoke all on public.question_review_events from anon, authenticated;
revoke all on public.question_code_counters from anon, authenticated;
grant select on public.question_review_events to authenticated;

drop policy if exists review_events_select on public.question_review_events;
create policy review_events_select on public.question_review_events for select to authenticated
  using (app.is_staff() and exists (select 1 from public.questions q where q.id = question_id));

create or replace function app.domain_prefix(p_domain public.curriculum_domain) returns text
language sql immutable set search_path = '' as $$
  select case p_domain
    when 'bilangan' then 'BIL'
    when 'geometri' then 'GEO'
    when 'kombinatorik' then 'KOM'
    else 'DAT'
  end;
$$;

create or replace function app.next_question_code(p_node uuid, p_grade smallint) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_domain public.curriculum_domain;
  v_prefix text;
  v_no integer;
  v_code text;
begin
  select n.domain into v_domain from public.curriculum_nodes n where n.id = p_node;
  if not found then
    raise exception 'submateri tidak ditemukan' using errcode = 'MQ422';
  end if;
  v_prefix := app.domain_prefix(v_domain);
  loop
    insert into public.question_code_counters (prefix, grade, last_no)
    values (v_prefix, p_grade, 1)
    on conflict (prefix, grade) do update set last_no = public.question_code_counters.last_no + 1
    returning last_no into v_no;
    if v_no > 9999 then
      raise exception 'nomor soal untuk % kelas % sudah habis', v_prefix, p_grade using errcode = 'MQ409';
    end if;
    v_code := format('%s-%s-%s', v_prefix, p_grade, lpad(v_no::text, 4, '0'));
    exit when not exists (select 1 from public.questions q where q.code = v_code);
  end loop;
  return v_code;
end $$;

-- ============================================================ D. validasi kelengkapan (server)
create or replace function app.options_problems(p_options jsonb, p_min int, p_max int, p_label text)
returns text[] language plpgsql immutable set search_path = '' as $$
declare
  p text[] := '{}';
  n int;
begin
  if coalesce(jsonb_typeof(p_options), '') <> 'array' then
    return array[p_label || ' harus berupa daftar.'];
  end if;
  n := jsonb_array_length(p_options);
  if n < p_min or n > p_max then
    p := p || format('%s harus berjumlah %s sampai %s (saat ini %s).', p_label, p_min, p_max, n);
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_options) o
    where jsonb_typeof(o) <> 'object'
       or coalesce(jsonb_typeof(o -> 'id'), '') <> 'string'
       or coalesce(o ->> 'id', '') !~ '^[a-z][a-z0-9]{0,7}$'
       or coalesce(jsonb_typeof(o -> 'text'), '') <> 'string'
       or btrim(coalesce(o ->> 'text', '')) = ''
       or char_length(coalesce(o ->> 'text', '')) > 200
  ) then
    return p || (p_label || ' tidak valid: setiap butir wajib memiliki id dan teks (maksimal 200 karakter).');
  end if;
  if (select count(distinct o ->> 'id') from jsonb_array_elements(p_options) o) <> n then
    p := p || (p_label || ' memiliki id ganda.');
  end if;
  if (select count(distinct lower(btrim(o ->> 'text'))) from jsonb_array_elements(p_options) o) <> n then
    p := p || (p_label || ' memiliki teks ganda.');
  end if;
  return p;
end $$;

create or replace function app.misconceptions_problems(
  p_miscs jsonb, p_option_ids text[], p_correct text[], p_require_for_wrong boolean
) returns text[] language plpgsql immutable set search_path = '' as $$
declare
  p text[] := '{}';
  wrong text;
  ids text[] := coalesce(p_option_ids, '{}');
  good text[] := coalesce(p_correct, '{}');
begin
  if coalesce(jsonb_typeof(p_miscs), '') <> 'array' then
    return array['Miskonsepsi harus berupa daftar.'];
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_miscs) m
    where jsonb_typeof(m) <> 'object'
       or coalesce(jsonb_typeof(m -> 'label'), '') <> 'string'
       or btrim(coalesce(m ->> 'label', '')) = ''
       or char_length(coalesce(m ->> 'label', '')) > 200
       or (m ? 'option_id' and coalesce(jsonb_typeof(m -> 'option_id'), '') <> 'string')
       or (m ? 'value' and coalesce(jsonb_typeof(m -> 'value'), '') <> 'number')
  ) then
    return array['Setiap miskonsepsi wajib berlabel (maksimal 200 karakter); option_id harus teks dan value harus angka.'];
  end if;
  if exists (select 1 from jsonb_array_elements(p_miscs) m
             where m ? 'option_id' and not ((m ->> 'option_id') = any (ids))) then
    p := p || 'Miskonsepsi merujuk opsi yang tidak ada.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_miscs) m where (m ->> 'option_id') = any (good)) then
    p := p || 'Opsi yang benar tidak boleh diberi miskonsepsi.';
  end if;
  if p_require_for_wrong then
    foreach wrong in array ids loop
      if not (wrong = any (good))
         and not exists (select 1 from jsonb_array_elements(p_miscs) m where m ->> 'option_id' = wrong) then
        p := p || format('Opsi "%s" yang salah belum diberi miskonsepsi yang ditargetkan.', upper(wrong));
      end if;
    end loop;
  end if;
  return p;
end $$;

create or replace function app.cells_problems(p_cells jsonb, p_rows int, p_cols int, p_min int, p_label text)
returns text[] language plpgsql immutable set search_path = '' as $$
declare
  e jsonb;
  r numeric;
  c numeric;
  k text;
  seen text[] := '{}';
begin
  if coalesce(jsonb_typeof(p_cells), '') <> 'array' then
    return array[p_label || ' harus berupa daftar petak.'];
  end if;
  for e in select * from jsonb_array_elements(p_cells) loop
    if jsonb_typeof(e) <> 'array' then
      return array[p_label || ' memuat petak yang tidak valid.'];
    end if;
    if jsonb_array_length(e) <> 2 then
      return array[p_label || ' memuat petak yang tidak valid.'];
    end if;
    if coalesce(jsonb_typeof(e -> 0), '') <> 'number' or coalesce(jsonb_typeof(e -> 1), '') <> 'number' then
      return array[p_label || ' memuat petak yang tidak valid.'];
    end if;
    r := (e ->> 0)::numeric;
    c := (e ->> 1)::numeric;
    if r <> trunc(r) or c <> trunc(c) or r < 0 or c < 0 or r >= p_rows or c >= p_cols then
      return array[p_label || ' memuat petak di luar kisi.'];
    end if;
    k := r::int || ',' || c::int;
    if k = any (seen) then
      return array[p_label || ' memuat petak ganda.'];
    end if;
    seen := seen || k;
  end loop;
  if cardinality(seen) < p_min then
    return array[format('%s minimal %s petak.', p_label, p_min)];
  end if;
  return '{}';
end $$;

-- Semua susunan (permutasi) yang memenuhi petunjuk. Dipakai untuk membuktikan solusi puzzle logika tunggal.
create or replace function app.logic_solutions(p_ids text[], p_clues jsonb) returns setof text[]
language sql immutable set search_path = '' as $$
  with recursive perm(arr, remaining) as (
    select '{}'::text[], p_ids
    union all
    select perm.arr || x, array_remove(perm.remaining, x)
    from perm, unnest(perm.remaining) as x
  )
  select perm.arr from perm
  where cardinality(perm.remaining) = 0
    and not exists (
      select 1 from jsonb_array_elements(p_clues) c
      where not (
        case c ->> 'type'
          when 'at' then array_position(perm.arr, c ->> 'entity') = (c ->> 'slot')::int
          when 'not_at' then array_position(perm.arr, c ->> 'entity') <> (c ->> 'slot')::int
          when 'left_of' then array_position(perm.arr, c ->> 'a') < array_position(perm.arr, c ->> 'b')
          when 'next_to' then abs(array_position(perm.arr, c ->> 'a') - array_position(perm.arr, c ->> 'b')) = 1
          else false
        end
      )
    );
$$;

create or replace function app.answer_problems(
  p_type public.answer_type, p_options jsonb, p_visual jsonb, p_key jsonb, p_miscs jsonb
) returns text[] language plpgsql stable set search_path = '' as $$
declare
  t text := p_type::text;
  p text[] := '{}';
  ids text[] := '{}';
  lefts text[];
  rights text[];
  correct text[];
  n int;
  el jsonb;
  clue jsonb;
  rows_n numeric;
  cols_n numeric;
  slots_n numeric;
  mn numeric;
  mx numeric;
  st numeric;
  val numeric;
  area_n int;
  perim_n int;
  sol_count int;
  sol text[];
  keyarr text[];
begin
  if p_key is null or jsonb_typeof(p_key) <> 'object' then
    return array['Kunci jawaban belum diisi.'];
  end if;

  -- ---------------------------------------------------------- pilihan tunggal
  if t = 'single_choice' then
    p := app.options_problems(p_options, 2, 6, 'Opsi jawaban');
    if cardinality(p) = 0 then
      ids := array(select o ->> 'id' from jsonb_array_elements(p_options) o);
      if coalesce(jsonb_typeof(p_key -> 'correct'), '') <> 'string' then
        p := p || 'Kunci jawaban harus memilih tepat satu opsi.';
      elsif not ((p_key ->> 'correct') = any (ids)) then
        p := p || 'Kunci jawaban merujuk opsi yang tidak ada.';
      else
        p := p || app.misconceptions_problems(p_miscs, ids, array[p_key ->> 'correct'], true);
      end if;
    end if;

  -- ---------------------------------------------------------- pilihan majemuk / kemungkinan
  elsif t in ('multi_choice', 'possibilities') then
    p := app.options_problems(p_options, 2, 6, 'Opsi jawaban');
    if cardinality(p) = 0 then
      ids := array(select o ->> 'id' from jsonb_array_elements(p_options) o);
      n := cardinality(ids);
      if coalesce(jsonb_typeof(p_key -> 'correct'), '') <> 'array' then
        p := p || 'Kunci jawaban harus berupa daftar opsi yang benar.';
      elsif exists (select 1 from jsonb_array_elements(p_key -> 'correct') x where jsonb_typeof(x) <> 'string') then
        p := p || 'Kunci jawaban harus berupa daftar id opsi.';
      else
        correct := array(select jsonb_array_elements_text(p_key -> 'correct'));
        if (select count(distinct x) from unnest(correct) x) <> cardinality(correct) then
          p := p || 'Kunci jawaban memuat opsi ganda.';
        elsif exists (select 1 from unnest(correct) x where not (x = any (ids))) then
          p := p || 'Kunci jawaban merujuk opsi yang tidak ada.';
        elsif cardinality(correct) < 1 or cardinality(correct) > n - 1 then
          p := p || 'Pilihan majemuk harus memiliki minimal satu jawaban benar dan minimal satu pengecoh.';
        else
          p := p || app.misconceptions_problems(p_miscs, ids, correct, true);
        end if;
      end if;
    end if;

  -- ---------------------------------------------------------- isian angka
  elsif t = 'numeric' then
    if coalesce(jsonb_typeof(p_options), '') <> 'array' or jsonb_array_length(p_options) <> 0 then
      p := p || 'Soal isian angka tidak memakai opsi.';
    end if;
    if coalesce(jsonb_typeof(p_key -> 'value'), '') <> 'number' then
      p := p || 'Kunci jawaban harus berupa satu angka.';
    end if;
    p := p || app.misconceptions_problems(p_miscs, '{}', '{}', false);

  -- ---------------------------------------------------------- benar/salah
  elsif t = 'true_false' then
    if coalesce(jsonb_typeof(p_options), '') <> 'array' or jsonb_array_length(p_options) <> 0 then
      p := p || 'Soal benar/salah tidak memakai opsi.';
    end if;
    if coalesce(jsonb_typeof(p_key -> 'value'), '') <> 'boolean' then
      p := p || 'Kunci jawaban harus benar atau salah.';
    end if;
    p := p || app.misconceptions_problems(p_miscs, '{}', '{}', false);

  -- ---------------------------------------------------------- mengurutkan
  elsif t = 'ordering' then
    p := app.options_problems(p_options, 2, 6, 'Butir urutan');
    if cardinality(p) = 0 then
      ids := array(select o ->> 'id' from jsonb_array_elements(p_options) o);
      n := cardinality(ids);
      if coalesce(jsonb_typeof(p_key -> 'order'), '') <> 'array'
         or exists (select 1 from jsonb_array_elements(p_key -> 'order') x where jsonb_typeof(x) <> 'string') then
        p := p || 'Kunci urutan harus berupa daftar id butir.';
      else
        correct := array(select jsonb_array_elements_text(p_key -> 'order'));
        if cardinality(correct) <> n
           or (select count(distinct x) from unnest(correct) x) <> n
           or exists (select 1 from unnest(correct) x where not (x = any (ids))) then
          p := p || 'Kunci urutan harus memuat semua butir tepat satu kali.';
        end if;
      end if;
    end if;
    p := p || app.misconceptions_problems(p_miscs, '{}', '{}', false);

  -- ---------------------------------------------------------- mencocokkan
  elsif t = 'matching' then
    if coalesce(jsonb_typeof(p_options), '') <> 'object' then
      p := array['Soal mencocokkan membutuhkan kolom kiri dan kolom kanan.'];
    else
      p := app.options_problems(p_options -> 'left', 2, 6, 'Kolom kiri')
        || app.options_problems(p_options -> 'right', 2, 6, 'Kolom kanan');
      if cardinality(p) = 0 then
        if jsonb_array_length(p_options -> 'left') <> jsonb_array_length(p_options -> 'right') then
          p := p || 'Jumlah butir kolom kiri dan kanan harus sama.';
        else
          lefts := array(select o ->> 'id' from jsonb_array_elements(p_options -> 'left') o);
          rights := array(select o ->> 'id' from jsonb_array_elements(p_options -> 'right') o);
          n := cardinality(lefts);
          if coalesce(jsonb_typeof(p_key -> 'pairs'), '') <> 'array'
             or jsonb_array_length(p_key -> 'pairs') <> n
             or exists (
               select 1 from jsonb_array_elements(p_key -> 'pairs') x
               where jsonb_typeof(x) <> 'object'
                  or coalesce(jsonb_typeof(x -> 'left'), '') <> 'string'
                  or coalesce(jsonb_typeof(x -> 'right'), '') <> 'string'
             ) then
            p := p || 'Kunci pasangan harus memasangkan setiap butir kiri dengan tepat satu butir kanan.';
          elsif (select count(distinct x ->> 'left') from jsonb_array_elements(p_key -> 'pairs') x) <> n
             or (select count(distinct x ->> 'right') from jsonb_array_elements(p_key -> 'pairs') x) <> n
             or exists (select 1 from jsonb_array_elements(p_key -> 'pairs') x
                        where not ((x ->> 'left') = any (lefts)) or not ((x ->> 'right') = any (rights))) then
            p := p || 'Kunci pasangan harus satu-satu dan memakai id yang ada.';
          end if;
        end if;
      end if;
    end if;
    p := p || app.misconceptions_problems(p_miscs, '{}', '{}', false);

  -- ---------------------------------------------------------- interaksi visual
  elsif t = 'visual' then
    if p_visual is null or jsonb_typeof(p_visual) <> 'object' then
      p := array['Data visual belum diisi.'];
    elsif p_visual ->> 'kind' = 'grid_select' then
      if coalesce(jsonb_typeof(p_visual -> 'rows'), '') <> 'number' or coalesce(jsonb_typeof(p_visual -> 'cols'), '') <> 'number' then
        p := array['Kisi harus memiliki jumlah baris dan kolom.'];
      else
        rows_n := (p_visual ->> 'rows')::numeric;
        cols_n := (p_visual ->> 'cols')::numeric;
        if rows_n <> trunc(rows_n) or cols_n <> trunc(cols_n) or rows_n not between 1 and 10 or cols_n not between 1 and 10 then
          p := array['Kisi harus berukuran 1 sampai 10 baris dan kolom.'];
        else
          p := app.cells_problems(p_key -> 'cells', rows_n::int, cols_n::int, 1, 'Kunci petak');
        end if;
      end if;
    elsif p_visual ->> 'kind' = 'number_line' then
      if coalesce(jsonb_typeof(p_visual -> 'min'), '') <> 'number'
         or coalesce(jsonb_typeof(p_visual -> 'max'), '') <> 'number'
         or coalesce(jsonb_typeof(p_visual -> 'step'), '') <> 'number'
         or coalesce(jsonb_typeof(p_key -> 'value'), '') <> 'number' then
        p := array['Garis bilangan harus memiliki min, max, step, dan kunci berupa angka.'];
      else
        mn := (p_visual ->> 'min')::numeric;
        mx := (p_visual ->> 'max')::numeric;
        st := (p_visual ->> 'step')::numeric;
        val := (p_key ->> 'value')::numeric;
        if mx <= mn or st <= 0 or mod(mx - mn, st) <> 0 or (mx - mn) / st > 100 then
          p := array['Garis bilangan tidak valid: max harus lebih besar dari min, step positif membagi rentang, dan maksimal 100 langkah.'];
        elsif val < mn or val > mx or mod(val - mn, st) <> 0 then
          p := array['Kunci harus berada pada garis bilangan dan tepat pada kelipatan langkah.'];
        end if;
      end if;
    else
      p := array['Jenis visual tidak dikenal.'];
    end if;
    p := p || app.misconceptions_problems(p_miscs, '{}', '{}', false);

  -- ---------------------------------------------------------- puzzle geometri (kisi satuan)
  elsif t = 'geometry_puzzle' then
    if p_visual is null or jsonb_typeof(p_visual) <> 'object' or p_visual ->> 'kind' <> 'unit_grid' then
      p := array['Puzzle geometri membutuhkan data visual berjenis unit_grid.'];
    elsif coalesce(jsonb_typeof(p_visual -> 'rows'), '') <> 'number'
       or coalesce(jsonb_typeof(p_visual -> 'cols'), '') <> 'number'
       or coalesce(p_visual ->> 'measure', '') not in ('area', 'perimeter')
       or coalesce(jsonb_typeof(p_key -> 'value'), '') <> 'number' then
      p := array['Kisi harus memiliki baris, kolom, ukuran (area atau perimeter), dan kunci berupa angka.'];
    else
      rows_n := (p_visual ->> 'rows')::numeric;
      cols_n := (p_visual ->> 'cols')::numeric;
      if rows_n <> trunc(rows_n) or cols_n <> trunc(cols_n) or rows_n not between 1 and 12 or cols_n not between 1 and 12 then
        p := array['Kisi harus berukuran 1 sampai 12 baris dan kolom.'];
      else
        p := app.cells_problems(p_visual -> 'cells', rows_n::int, cols_n::int, 1, 'Bangun');
        if cardinality(p) = 0 then
          area_n := jsonb_array_length(p_visual -> 'cells');
          with cells as (
            select (e ->> 0)::int as r, (e ->> 1)::int as c from jsonb_array_elements(p_visual -> 'cells') e
          )
          select count(*)::int into perim_n
          from cells a
          cross join (values (1, 0), (-1, 0), (0, 1), (0, -1)) d (dr, dc)
          where not exists (select 1 from cells b where b.r = a.r + d.dr and b.c = a.c + d.dc);
          val := (p_key ->> 'value')::numeric;
          if p_visual ->> 'measure' = 'area' and val <> area_n then
            p := p || format('Kunci tidak sesuai bangun: luasnya %s petak.', area_n);
          elsif p_visual ->> 'measure' = 'perimeter' and val <> perim_n then
            p := p || format('Kunci tidak sesuai bangun: kelilingnya %s satuan.', perim_n);
          end if;
        end if;
      end if;
    end if;
    p := p || app.misconceptions_problems(p_miscs, '{}', '{}', false);

  -- ---------------------------------------------------------- puzzle logika (posisi berdasarkan petunjuk)
  elsif t = 'logic_puzzle' then
    if p_visual is null or jsonb_typeof(p_visual) <> 'object' or p_visual ->> 'kind' <> 'position_clues' then
      p := array['Puzzle logika membutuhkan data visual berjenis position_clues.'];
    elsif coalesce(jsonb_typeof(p_visual -> 'slots'), '') <> 'number' then
      p := array['Puzzle logika harus memiliki jumlah posisi.'];
    else
      slots_n := (p_visual ->> 'slots')::numeric;
      if slots_n <> trunc(slots_n) or slots_n not between 3 and 5 then
        p := array['Jumlah posisi harus 3 sampai 5.'];
      else
        p := app.options_problems(p_visual -> 'entities', slots_n::int, slots_n::int, 'Tokoh');
        if cardinality(p) = 0 then
          ids := array(select o ->> 'id' from jsonb_array_elements(p_visual -> 'entities') o);
          if coalesce(jsonb_typeof(p_visual -> 'clues'), '') <> 'array'
             or jsonb_array_length(p_visual -> 'clues') not between 1 and 12 then
            p := array['Puzzle logika harus memiliki 1 sampai 12 petunjuk.'];
          else
            for clue in select * from jsonb_array_elements(p_visual -> 'clues') loop
              if jsonb_typeof(clue) <> 'object' then
                p := array['Petunjuk tidak valid.'];
                exit;
              end if;
              if clue ->> 'type' in ('at', 'not_at') then
                if coalesce(jsonb_typeof(clue -> 'entity'), '') <> 'string'
                   or not ((clue ->> 'entity') = any (ids))
                   or coalesce(jsonb_typeof(clue -> 'slot'), '') <> 'number' then
                  p := array['Petunjuk posisi harus merujuk tokoh yang ada dan nomor posisi.'];
                  exit;
                end if;
                val := (clue ->> 'slot')::numeric;
                if val <> trunc(val) or val < 1 or val > slots_n then
                  p := array['Nomor posisi pada petunjuk di luar rentang.'];
                  exit;
                end if;
              elsif clue ->> 'type' in ('left_of', 'next_to') then
                if coalesce(jsonb_typeof(clue -> 'a'), '') <> 'string'
                   or coalesce(jsonb_typeof(clue -> 'b'), '') <> 'string'
                   or not ((clue ->> 'a') = any (ids))
                   or not ((clue ->> 'b') = any (ids))
                   or (clue ->> 'a') = (clue ->> 'b') then
                  p := array['Petunjuk hubungan harus merujuk dua tokoh berbeda yang ada.'];
                  exit;
                end if;
              else
                p := array['Jenis petunjuk tidak dikenal.'];
                exit;
              end if;
            end loop;
            if cardinality(p) = 0 then
              select count(*)::int into sol_count from app.logic_solutions(ids, p_visual -> 'clues');
              if sol_count <> 1 then
                p := array[format('Puzzle harus memiliki tepat satu solusi (saat ini %s).', sol_count)];
              elsif coalesce(jsonb_typeof(p_key -> 'arrangement'), '') <> 'array'
                 or exists (select 1 from jsonb_array_elements(p_key -> 'arrangement') x where jsonb_typeof(x) <> 'string') then
                p := array['Kunci susunan harus berupa daftar id tokoh per posisi.'];
              else
                select s into sol from app.logic_solutions(ids, p_visual -> 'clues') s limit 1;
                keyarr := array(select jsonb_array_elements_text(p_key -> 'arrangement'));
                if keyarr is distinct from sol then
                  p := array['Kunci susunan tidak sama dengan solusi puzzle.'];
                end if;
              end if;
            end if;
          end if;
        end if;
      end if;
    end if;
    p := p || app.misconceptions_problems(p_miscs, '{}', '{}', false);
  else
    p := array['Jenis jawaban tidak dikenal.'];
  end if;

  return p;
end $$;

-- Masalah kelengkapan satu versi soal; array kosong berarti lengkap dan layak diajukan/diterbitkan.
create or replace function app.question_problems(p_version uuid) returns text[]
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.question_versions;
  q public.questions;
  n public.curriculum_nodes;
  k public.question_keys;
  p text[] := '{}';
begin
  select * into v from public.question_versions where id = p_version;
  if not found then
    return array['Soal belum memiliki isi.'];
  end if;
  select * into q from public.questions where id = v.question_id;
  select * into n from public.curriculum_nodes where id = q.node_id;
  select * into k from public.question_keys where question_version_id = p_version;

  if btrim(v.statement) = '' then
    p := p || 'Pernyataan soal wajib diisi.';
  end if;
  if btrim(v.source) = '' then
    p := p || 'Sumber soal wajib diisi.';
  end if;
  if v.grade < n.grade_min or v.grade > n.grade_max then
    p := p || format('Kelas sasaran soal (%s) di luar rentang kelas submateri (%s sampai %s).', v.grade, n.grade_min, n.grade_max);
  end if;
  if k.question_version_id is null then
    return p || 'Kunci jawaban belum diisi.';
  end if;
  if btrim(k.explanation) = '' then
    p := p || 'Pembahasan wajib diisi.';
  end if;
  if coalesce(jsonb_typeof(k.hints), '') <> 'array' or jsonb_array_length(k.hints) not between 2 and 3 then
    p := p || 'Petunjuk bertahap wajib berjumlah 2 sampai 3 butir.';
  elsif exists (select 1 from jsonb_array_elements(k.hints) h
                where jsonb_typeof(h) <> 'string' or btrim(h #>> '{}') = '') then
    p := p || 'Setiap petunjuk wajib berisi teks.';
  end if;
  p := p || app.answer_problems(v.answer_type, v.options, v.visual_data, k.answer_key, k.misconceptions);
  return p;
end $$;

-- ============================================================ penjaga soal (diperbarui)
create or replace function app.questions_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  admin_ctx boolean := app.is_trusted_context();
  via_rpc boolean := coalesce(current_setting('app.workflow', true), '') = 'on';
begin
  -- pembaruan bersarang dari trigger lain (mis. versi baru) tidak diperiksa ulang
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not admin_ctx and not via_rpc and (new.status <> 'draft' or new.validated or new.reviewer_id is not null) then
      raise exception 'soal baru harus berstatus draft dan belum tervalidasi' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.code <> old.code or new.created_by <> old.created_by then
    raise exception 'kode dan pembuat soal tidak boleh diubah' using errcode = '42501';
  end if;

  -- Penerbitan: kelengkapan wajib pada SEMUA konteks (termasuk admin dan sesi layanan).
  if new.status = 'published' and old.status is distinct from 'published' then
    if new.current_version_id is null or cardinality(app.question_problems(new.current_version_id)) > 0 then
      raise exception 'soal belum lengkap sehingga tidak dapat diterbitkan' using errcode = 'MQ422';
    end if;
  end if;

  if not admin_ctx and not via_rpc then
    if new.validated is distinct from old.validated
       or new.reviewer_id is distinct from old.reviewer_id
       or new.current_version_id is distinct from old.current_version_id then
      raise exception 'validasi, peninjau, dan versi aktif hanya diatur oleh admin atau sistem' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      if not ((old.status = 'draft' and new.status = 'review')
           or (old.status = 'review' and new.status = 'draft')) then
        raise exception 'transisi status % -> % hanya boleh oleh admin', old.status, new.status using errcode = '42501';
      end if;
    elsif old.status in ('published', 'archived') then
      raise exception 'soal berstatus % tidak dapat diubah; buat versi baru', old.status using errcode = '42501';
    end if;
  end if;

  if new.status is distinct from old.status then
    perform app.log_audit('question.status_changed', 'questions', old.id::text,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end $$;

-- Kunci boleh dibaca staf untuk soal berstatus review/terbit (peninjau harus melihat kunci).
create or replace function app.can_view_key(p_version uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_admin() or exists (
    select 1
    from public.question_versions v
    join public.questions q on q.id = v.question_id
    where v.id = p_version
      and app.is_staff()
      and (
        q.created_by = auth.uid()
        or q.reviewer_id = auth.uid()
        or q.status in ('review', 'published')
      )
  );
$$;

-- ============================================================ RPC: simpan soal
create or replace function app.save_question_core(p_question_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_q public.questions;
  v_cur public.question_versions;
  v_node uuid;
  v_grade smallint;
  v_diff smallint;
  v_level text;
  v_type public.answer_type;
  v_statement text;
  v_instr text;
  v_source text;
  v_expl text;
  v_options jsonb;
  v_visual jsonb;
  v_hints jsonb;
  v_miscs jsonb;
  v_key jsonb;
  v_secs integer;
  v_ai boolean;
  v_version uuid;
  v_status public.question_status;
  v_num numeric;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text) > 200000 then
    raise exception 'isi soal tidak valid atau terlalu besar' using errcode = 'MQ422';
  end if;

  if coalesce(p_payload ->> 'node_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'submateri wajib dipilih' using errcode = 'MQ422';
  end if;
  v_node := (p_payload ->> 'node_id')::uuid;
  if not exists (select 1 from public.curriculum_nodes n where n.id = v_node) then
    raise exception 'submateri tidak ditemukan' using errcode = 'MQ422';
  end if;

  if coalesce(jsonb_typeof(p_payload -> 'grade'), '') <> 'number' or (p_payload ->> 'grade')::numeric not in (1, 2, 3) then
    raise exception 'kelas sasaran harus 1, 2, atau 3' using errcode = 'MQ422';
  end if;
  v_grade := (p_payload ->> 'grade')::smallint;

  if coalesce(jsonb_typeof(p_payload -> 'difficulty'), '') <> 'number'
     or (p_payload ->> 'difficulty')::numeric not in (1, 2, 3, 4, 5) then
    raise exception 'kesulitan harus 1 sampai 5' using errcode = 'MQ422';
  end if;
  v_diff := (p_payload ->> 'difficulty')::smallint;

  v_level := p_payload ->> 'cognitive_level';
  if v_level is null or v_level not in ('L1', 'L2', 'L3') then
    raise exception 'tingkat kognitif harus L1, L2, atau L3' using errcode = 'MQ422';
  end if;

  if coalesce(p_payload ->> 'answer_type', '') not in (
    'single_choice', 'multi_choice', 'numeric', 'true_false', 'ordering', 'matching',
    'possibilities', 'visual', 'geometry_puzzle', 'logic_puzzle'
  ) then
    raise exception 'jenis jawaban tidak dikenal' using errcode = 'MQ422';
  end if;
  v_type := (p_payload ->> 'answer_type')::public.answer_type;

  if coalesce(jsonb_typeof(p_payload -> 'statement'), '') <> 'string'
     or btrim(p_payload ->> 'statement') = '' or char_length(p_payload ->> 'statement') > 4000 then
    raise exception 'pernyataan soal wajib diisi (maksimal 4000 karakter)' using errcode = 'MQ422';
  end if;
  v_statement := btrim(p_payload ->> 'statement');

  v_instr := coalesce(p_payload ->> 'instructions', '');
  if jsonb_typeof(p_payload -> 'instructions') not in ('string', 'null') and p_payload ? 'instructions' then
    raise exception 'instruksi harus berupa teks' using errcode = 'MQ422';
  end if;
  if char_length(v_instr) > 500 then
    raise exception 'instruksi maksimal 500 karakter' using errcode = 'MQ422';
  end if;
  v_instr := btrim(v_instr);

  v_source := btrim(coalesce(p_payload ->> 'source', ''));
  if char_length(v_source) > 300 then
    raise exception 'sumber soal maksimal 300 karakter' using errcode = 'MQ422';
  end if;

  v_expl := btrim(coalesce(p_payload ->> 'explanation', ''));
  if char_length(v_expl) > 4000 then
    raise exception 'pembahasan maksimal 4000 karakter' using errcode = 'MQ422';
  end if;

  v_options := coalesce(p_payload -> 'options', '[]'::jsonb);
  if jsonb_typeof(v_options) not in ('array', 'object') then
    raise exception 'opsi harus berupa daftar atau objek' using errcode = 'MQ422';
  end if;

  v_visual := p_payload -> 'visual_data';
  if v_visual is not null and jsonb_typeof(v_visual) not in ('object', 'null') then
    raise exception 'data visual harus berupa objek' using errcode = 'MQ422';
  end if;
  if v_visual is not null and jsonb_typeof(v_visual) = 'null' then
    v_visual := null;
  end if;

  v_hints := coalesce(p_payload -> 'hints', '[]'::jsonb);
  if jsonb_typeof(v_hints) <> 'array' or jsonb_array_length(v_hints) > 3
     or exists (select 1 from jsonb_array_elements(v_hints) h
                where jsonb_typeof(h) <> 'string' or char_length(h #>> '{}') > 300) then
    raise exception 'petunjuk harus berupa daftar teks (maksimal 3 butir, masing-masing 300 karakter)' using errcode = 'MQ422';
  end if;
  v_hints := coalesce((select jsonb_agg(btrim(h #>> '{}') order by ord)
                         from jsonb_array_elements(v_hints) with ordinality as t (h, ord)), '[]'::jsonb);

  v_miscs := coalesce(p_payload -> 'misconceptions', '[]'::jsonb);
  if jsonb_typeof(v_miscs) <> 'array' or jsonb_array_length(v_miscs) > 20 then
    raise exception 'miskonsepsi harus berupa daftar (maksimal 20 butir)' using errcode = 'MQ422';
  end if;

  v_key := coalesce(p_payload -> 'answer_key', 'null'::jsonb);

  if p_payload ? 'recommended_seconds' and jsonb_typeof(p_payload -> 'recommended_seconds') <> 'null' then
    if jsonb_typeof(p_payload -> 'recommended_seconds') <> 'number' then
      raise exception 'waktu rekomendasi harus berupa angka' using errcode = 'MQ422';
    end if;
    v_num := (p_payload ->> 'recommended_seconds')::numeric;
    if v_num <> trunc(v_num) or v_num < 10 or v_num > 3600 then
      raise exception 'waktu rekomendasi harus 10 sampai 3600 detik' using errcode = 'MQ422';
    end if;
    v_secs := v_num::integer;
  end if;

  if p_payload ? 'ai_assisted' and jsonb_typeof(p_payload -> 'ai_assisted') not in ('boolean', 'null') then
    raise exception 'penanda bantuan AI harus benar atau salah' using errcode = 'MQ422';
  end if;
  v_ai := coalesce((p_payload ->> 'ai_assisted')::boolean, false);

  -- ------------------------------------------------ soal baru atau pembaruan
  if p_question_id is null then
    insert into public.questions (code, node_id, created_by, ai_assisted)
    values (app.next_question_code(v_node, v_grade), v_node, v_uid, v_ai)
    returning * into v_q;
    perform app.log_audit('question.created', 'questions', v_q.id::text, jsonb_build_object('code', v_q.code));

    insert into public.question_versions (
      question_id, statement, instructions, grade, cognitive_level, difficulty, answer_type,
      options, visual_data, recommended_seconds, source, created_by
    ) values (
      v_q.id, v_statement, v_instr, v_grade, v_level, v_diff, v_type,
      v_options, v_visual, v_secs, v_source, v_uid
    ) returning id into v_version;

    insert into public.question_keys (question_version_id, answer_key, explanation, hints, misconceptions)
    values (v_version, v_key, v_expl, v_hints, v_miscs);
  else
    select * into v_q from public.questions q where q.id = p_question_id for update;
    if not found then
      raise exception 'soal tidak ditemukan' using errcode = 'MQ404';
    end if;
    if not (app.is_admin() or v_q.created_by = v_uid) then
      raise exception 'hanya pembuat soal atau admin yang dapat mengubah soal ini' using errcode = 'MQ403';
    end if;
    if v_q.status = 'archived' then
      raise exception 'soal yang diarsipkan tidak dapat diubah' using errcode = 'MQ409';
    end if;

    select * into v_cur from public.question_versions v where v.id = v_q.current_version_id;
    if found and v_cur.frozen_at is null then
      -- versi draf: edit di tempat
      update public.question_versions v
         set statement = v_statement, instructions = v_instr, grade = v_grade, cognitive_level = v_level,
             difficulty = v_diff, answer_type = v_type, options = v_options, visual_data = v_visual,
             recommended_seconds = v_secs, source = v_source
       where v.id = v_cur.id;
      insert into public.question_keys (question_version_id, answer_key, explanation, hints, misconceptions)
      values (v_cur.id, v_key, v_expl, v_hints, v_miscs)
      on conflict (question_version_id) do update
        set answer_key = excluded.answer_key, explanation = excluded.explanation,
            hints = excluded.hints, misconceptions = excluded.misconceptions;
      v_version := v_cur.id;
    else
      -- versi aktif sudah beku (terbit): buat versi baru
      insert into public.question_versions (
        question_id, statement, instructions, grade, cognitive_level, difficulty, answer_type,
        options, visual_data, recommended_seconds, source, created_by
      ) values (
        v_q.id, v_statement, v_instr, v_grade, v_level, v_diff, v_type,
        v_options, v_visual, v_secs, v_source, v_uid
      ) returning id into v_version;
      insert into public.question_keys (question_version_id, answer_key, explanation, hints, misconceptions)
      values (v_version, v_key, v_expl, v_hints, v_miscs);
    end if;

    -- Perubahan isi pada soal yang sedang ditelaah atau sudah divalidasi mewajibkan telaah ulang.
    update public.questions q
       set node_id = v_node,
           ai_assisted = v_ai,
           status = case when q.status = 'review' then 'draft'::public.question_status else q.status end,
           validated = false,
           reviewer_id = null
     where q.id = v_q.id;
  end if;

  select q.status, q.code into v_status, v_q.code from public.questions q where q.id = v_q.id;
  return jsonb_build_object('question_id', v_q.id, 'version_id', v_version, 'code', v_q.code, 'status', v_status);
end $$;

-- ============================================================ RPC publik
create or replace function app.require_staff() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.is_staff() then
    raise exception 'hanya guru atau admin yang dapat mengelola soal' using errcode = 'MQ403';
  end if;
end $$;

create or replace function public.save_question(p_question_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  perform app.require_staff();
  perform set_config('app.workflow', 'on', true);
  r := app.save_question_core(p_question_id, p_payload);
  perform set_config('app.workflow', '', true);
  return r;
end $$;

create or replace function public.submit_question_for_review(p_question_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q public.questions;
  problems text[];
begin
  perform app.require_staff();
  select * into q from public.questions where id = p_question_id for update;
  if not found then
    raise exception 'soal tidak ditemukan' using errcode = 'MQ404';
  end if;
  if not (app.is_admin() or q.created_by = auth.uid()) then
    raise exception 'hanya pembuat soal atau admin yang dapat mengajukan soal ini' using errcode = 'MQ403';
  end if;
  if q.status <> 'draft' then
    raise exception 'hanya soal berstatus draf yang dapat diajukan untuk review' using errcode = 'MQ409';
  end if;
  problems := case when q.current_version_id is null then array['Soal belum memiliki isi.']
                   else app.question_problems(q.current_version_id) end;
  if cardinality(problems) > 0 then
    raise exception 'soal belum lengkap: %', array_to_string(problems, ' ')
      using errcode = 'MQ422', detail = to_json(problems)::text;
  end if;
  perform set_config('app.workflow', 'on', true);
  update public.questions set status = 'review', validated = false, reviewer_id = null where id = q.id;
  insert into public.question_review_events (question_id, version_id, actor_id, event)
  values (q.id, q.current_version_id, auth.uid(), 'submitted');
  perform set_config('app.workflow', '', true);
  return jsonb_build_object('question_id', q.id, 'status', 'review');
end $$;

create or replace function public.review_question(p_question_id uuid, p_decision text, p_notes text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q public.questions;
  problems text[];
  v_notes text := btrim(coalesce(p_notes, ''));
begin
  perform app.require_staff();
  if p_decision not in ('approve', 'return') then
    raise exception 'keputusan harus approve atau return' using errcode = 'MQ422';
  end if;
  if char_length(v_notes) > 2000 then
    raise exception 'catatan maksimal 2000 karakter' using errcode = 'MQ422';
  end if;
  select * into q from public.questions where id = p_question_id for update;
  if not found then
    raise exception 'soal tidak ditemukan' using errcode = 'MQ404';
  end if;
  if q.status <> 'review' then
    raise exception 'hanya soal berstatus review yang dapat ditelaah' using errcode = 'MQ409';
  end if;
  if q.created_by = auth.uid() then
    raise exception 'pembuat soal tidak dapat menelaah soalnya sendiri' using errcode = 'MQ403';
  end if;

  perform set_config('app.workflow', 'on', true);
  if p_decision = 'approve' then
    if q.validated then
      raise exception 'soal ini sudah disetujui; tinggal menunggu penerbitan oleh admin' using errcode = 'MQ409';
    end if;
    problems := app.question_problems(q.current_version_id);
    if cardinality(problems) > 0 then
      raise exception 'soal belum lengkap: %', array_to_string(problems, ' ')
        using errcode = 'MQ422', detail = to_json(problems)::text;
    end if;
    update public.questions
       set validated = true, reviewer_id = auth.uid(), validation_notes = v_notes
     where id = q.id;
    insert into public.question_review_events (question_id, version_id, actor_id, event, notes)
    values (q.id, q.current_version_id, auth.uid(), 'approved', v_notes);
    perform app.log_audit('question.approved', 'questions', q.id::text, '{}'::jsonb);
  else
    if char_length(v_notes) < 5 then
      raise exception 'alasan pengembalian wajib diisi (minimal 5 karakter)' using errcode = 'MQ422';
    end if;
    update public.questions
       set status = 'draft', validated = false, reviewer_id = null, validation_notes = v_notes
     where id = q.id;
    insert into public.question_review_events (question_id, version_id, actor_id, event, notes)
    values (q.id, q.current_version_id, auth.uid(), 'returned', v_notes);
  end if;
  perform set_config('app.workflow', '', true);
  return jsonb_build_object('question_id', q.id, 'decision', p_decision);
end $$;

create or replace function public.publish_question(p_question_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q public.questions;
begin
  if not app.is_admin() then
    raise exception 'hanya admin yang dapat menerbitkan soal' using errcode = 'MQ403';
  end if;
  select * into q from public.questions where id = p_question_id for update;
  if not found then
    raise exception 'soal tidak ditemukan' using errcode = 'MQ404';
  end if;
  if q.status <> 'review' then
    raise exception 'hanya soal berstatus review yang dapat diterbitkan' using errcode = 'MQ409';
  end if;
  if not q.validated or q.reviewer_id is null or q.reviewer_id = q.created_by then
    raise exception 'soal harus disetujui oleh peninjau selain pembuatnya sebelum diterbitkan' using errcode = 'MQ409';
  end if;
  perform set_config('app.workflow', 'on', true);
  update public.questions set status = 'published' where id = q.id;
  update public.question_versions set frozen_at = now() where id = q.current_version_id and frozen_at is null;
  insert into public.question_review_events (question_id, version_id, actor_id, event)
  values (q.id, q.current_version_id, auth.uid(), 'published');
  perform set_config('app.workflow', '', true);
  return jsonb_build_object('question_id', q.id, 'status', 'published');
end $$;

create or replace function public.archive_question(p_question_id uuid, p_notes text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  q public.questions;
begin
  perform app.require_staff();
  select * into q from public.questions where id = p_question_id for update;
  if not found then
    raise exception 'soal tidak ditemukan' using errcode = 'MQ404';
  end if;
  if q.status = 'archived' then
    raise exception 'soal sudah diarsipkan' using errcode = 'MQ409';
  end if;
  if not (app.is_admin() or (q.created_by = auth.uid() and q.status = 'draft')) then
    raise exception 'pembuat hanya dapat mengarsipkan soal draf miliknya; soal lain diarsipkan oleh admin' using errcode = 'MQ403';
  end if;
  perform set_config('app.workflow', 'on', true);
  update public.questions set status = 'archived', validated = false where id = q.id;
  update public.question_versions set frozen_at = now() where id = q.current_version_id and frozen_at is null;
  insert into public.question_review_events (question_id, version_id, actor_id, event, notes)
  values (q.id, q.current_version_id, auth.uid(), 'archived', btrim(coalesce(p_notes, '')));
  perform set_config('app.workflow', '', true);
  return jsonb_build_object('question_id', q.id, 'status', 'archived');
end $$;

create or replace function public.import_questions(p_items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  idx int;
  v_node uuid;
  norm text;
  dup_code text;
  res jsonb;
  results jsonb := '[]'::jsonb;
begin
  perform app.require_staff();
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 200 then
    raise exception 'impor harus berisi 1 sampai 200 soal' using errcode = 'MQ422';
  end if;
  perform set_config('app.workflow', 'on', true);
  for item, idx in select value, (ordinality - 1)::int from jsonb_array_elements(p_items) with ordinality loop
    begin
      if jsonb_typeof(item) <> 'object' then
        raise exception 'butir impor harus berupa objek' using errcode = 'MQ422';
      end if;
      select n.id into v_node from public.curriculum_nodes n where n.code = item ->> 'node_code';
      if v_node is null then
        raise exception 'kode submateri "%" tidak ditemukan', coalesce(item ->> 'node_code', '') using errcode = 'MQ422';
      end if;
      norm := lower(btrim(regexp_replace(coalesce(item ->> 'statement', ''), '\s+', ' ', 'g')));
      select q.code into dup_code
        from public.questions q
        join public.question_versions v on v.id = q.current_version_id
       where q.node_id = v_node and q.status <> 'archived'
         and lower(btrim(regexp_replace(v.statement, '\s+', ' ', 'g'))) = norm
       limit 1;
      if dup_code is not null then
        res := jsonb_build_object('index', idx, 'ok', false, 'duplicate', true,
                 'error', format('Soal dengan pernyataan yang sama sudah ada (%s).', dup_code));
      else
        res := jsonb_build_object('index', idx, 'ok', true)
               || app.save_question_core(null, (item - 'node_code') || jsonb_build_object('node_id', v_node));
      end if;
    exception when others then
      res := jsonb_build_object('index', idx, 'ok', false,
               'error', case when sqlstate like 'MQ%' then sqlerrm else 'Butir ini tidak dapat diimpor.' end);
    end;
    results := results || res;
  end loop;
  perform set_config('app.workflow', '', true);
  perform app.log_audit('question.imported', 'questions', null,
    jsonb_build_object('total', jsonb_array_length(p_items),
                       'imported', (select count(*) from jsonb_array_elements(results) r where (r ->> 'ok')::boolean)));
  return results;
end $$;

-- ============================================================ hak akses
revoke all on all functions in schema app from public, anon, authenticated;
-- fungsi pembantu peran (dipakai kebijakan RLS) tetap dapat dipanggil oleh pengguna masuk
grant execute on function
  app.is_admin(), app.is_teacher(), app.is_staff(), app.is_student(),
  app.teaches_class(uuid), app.teaches_student(uuid), app.is_class_member(uuid),
  app.student_can_view_version(uuid), app.can_view_key(uuid), app.assessment_assigned_to_me(uuid)
  to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'public.save_question(uuid, jsonb)',
    'public.submit_question_for_review(uuid)',
    'public.review_question(uuid, text, text)',
    'public.publish_question(uuid)',
    'public.archive_question(uuid, text)',
    'public.import_questions(jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Penulisan soal hanya lewat RPC.
revoke insert, update on public.questions from authenticated;
revoke insert on public.question_versions from authenticated;
revoke insert on public.question_keys from authenticated;
drop policy if exists questions_insert on public.questions;
drop policy if exists questions_update on public.questions;
drop policy if exists versions_insert on public.question_versions;
drop policy if exists keys_insert on public.question_keys;

-- Staf dapat melihat nama guru/admin lain (untuk jejak telaah). Data siswa tetap dibatasi.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid() or app.is_admin() or app.teaches_student(id)
    or (app.is_staff() and role in ('teacher', 'admin'))
  );

-- ============================================================ tampilan bank soal
drop view if exists public.question_bank_v;
create view public.question_bank_v with (security_invoker = true) as
select
  q.id, q.code, q.status, q.validated, q.ai_assisted, q.validation_notes,
  q.created_by, cp.full_name as created_by_name,
  q.reviewer_id, rp.full_name as reviewer_name,
  q.node_id, n.code as node_code, n.title as node_title, n.domain,
  v.id as version_id, v.version_no, v.statement, v.grade, v.cognitive_level, v.difficulty, v.answer_type,
  q.created_at, q.updated_at
from public.questions q
join public.curriculum_nodes n on n.id = q.node_id
left join public.question_versions v on v.id = q.current_version_id
left join public.profiles cp on cp.id = q.created_by
left join public.profiles rp on rp.id = q.reviewer_id;

drop view if exists public.question_review_events_v;
create view public.question_review_events_v with (security_invoker = true) as
select e.id, e.question_id, e.version_id, e.actor_id, p.full_name as actor_name, e.event, e.notes, e.created_at
from public.question_review_events e
left join public.profiles p on p.id = e.actor_id;

revoke all on public.question_bank_v from anon, authenticated;
revoke all on public.question_review_events_v from anon, authenticated;
grant select on public.question_bank_v to authenticated;
grant select on public.question_review_events_v to authenticated;

-- ============================================================ E. kurikulum
create or replace function app.prereq_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_pre_min smallint;
  v_node_max smallint;
begin
  select n.grade_min into v_pre_min from public.curriculum_nodes n where n.id = new.prerequisite_id;
  select n.grade_max into v_node_max from public.curriculum_nodes n where n.id = new.node_id;
  if v_pre_min > v_node_max then
    raise exception 'prasyarat tidak boleh dimulai pada kelas yang lebih tinggi daripada materi yang membutuhkannya'
      using errcode = 'MQ422';
  end if;
  if exists (
    with recursive up (id) as (
      select new.prerequisite_id
      union
      select p.prerequisite_id from public.curriculum_prerequisites p join up on p.node_id = up.id
    )
    select 1 from up where up.id = new.node_id
  ) then
    raise exception 'prasyarat ini menimbulkan siklus (materi saling bergantung)' using errcode = 'MQ422';
  end if;
  return new;
end $$;

drop trigger if exists trg_prereq_guard on public.curriculum_prerequisites;
create trigger trg_prereq_guard before insert on public.curriculum_prerequisites
  for each row execute function app.prereq_guard();

create or replace function app.nodes_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.domain is distinct from old.domain
     and exists (select 1 from public.questions q where q.node_id = old.id) then
    raise exception 'domain submateri tidak dapat diubah karena sudah memiliki soal' using errcode = 'MQ409';
  end if;
  return new;
end $$;

drop trigger if exists trg_nodes_guard on public.curriculum_nodes;
create trigger trg_nodes_guard before update on public.curriculum_nodes
  for each row execute function app.nodes_guard();

create or replace function app.audit_curriculum() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  if tg_table_name = 'curriculum_nodes' then
    perform app.log_audit('curriculum.node_' || lower(tg_op), 'curriculum_nodes', r ->> 'id',
      jsonb_build_object('code', r ->> 'code'));
  else
    perform app.log_audit('curriculum.prerequisite_' || lower(tg_op), 'curriculum_prerequisites', r ->> 'node_id',
      jsonb_build_object('prerequisite_id', r ->> 'prerequisite_id'));
  end if;
  return null;
end $$;

drop trigger if exists trg_audit_nodes on public.curriculum_nodes;
create trigger trg_audit_nodes after insert or update or delete on public.curriculum_nodes
  for each row execute function app.audit_curriculum();
drop trigger if exists trg_audit_prereq on public.curriculum_prerequisites;
create trigger trg_audit_prereq after insert or delete on public.curriculum_prerequisites
  for each row execute function app.audit_curriculum();

-- Log audit tidak boleh diubah atau dihapus oleh siapa pun lewat klien.
create or replace function app.audit_immutable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'log audit bersifat permanen' using errcode = '42501';
end $$;

drop trigger if exists trg_audit_immutable on public.audit_logs;
create trigger trg_audit_immutable before update or delete on public.audit_logs
  for each row execute function app.audit_immutable();
