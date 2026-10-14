-- MathQuest Junior — Migrasi 2: fungsi pembantu, trigger, dan aturan integritas.
-- Semua fungsi keamanan memakai SECURITY DEFINER dengan search_path kosong,
-- sehingga tidak dapat dibajak lewat objek buatan pengguna.

create schema if not exists app;

-- ---------------------------------------------------------------- PEMBANTU PERAN
create or replace function app.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.is_active
  );
$$;

create or replace function app.is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher' and p.is_active
  );
$$;

create or replace function app.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('teacher', 'admin') and p.is_active
  );
$$;

create or replace function app.is_student() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student' and p.is_active
  );
$$;

create or replace function app.teaches_class(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.teacher_class_assignments t
    where t.class_id = p_class and t.teacher_id = auth.uid()
  ) and app.is_teacher();
$$;

create or replace function app.teaches_student(p_student uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_teacher() and exists (
    select 1
    from public.class_members m
    join public.teacher_class_assignments t on t.class_id = m.class_id
    where m.student_id = p_student and t.teacher_id = auth.uid()
  );
$$;

create or replace function app.is_class_member(p_class uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.class_members m
    where m.class_id = p_class and m.student_id = auth.uid()
  );
$$;

-- Siswa hanya boleh melihat versi soal yang (a) versi terkini dari soal terbit, atau
-- (b) disematkan pada asesmen terbit yang sedang ditugaskan kepadanya.
create or replace function app.student_can_view_version(p_version uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_student() and (
    exists (
      select 1 from public.questions q
      where q.current_version_id = p_version and q.status = 'published'
    )
    or exists (
      select 1
      from public.assessment_items i
      join public.assessments a on a.id = i.assessment_id and a.is_published
      join public.assessment_assignments g on g.assessment_id = a.id
      where i.question_version_id = p_version
        and g.opens_at <= now()
        and (g.closes_at is null or g.closes_at > now())
        and (
          g.student_id = auth.uid()
          or (g.class_id is not null and app.is_class_member(g.class_id))
        )
    )
  );
$$;

-- Kunci jawaban hanya untuk admin, pembuat, peninjau, dan guru (khusus soal terbit).
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
        or (q.status = 'published' and app.is_teacher())
      )
  );
$$;

create or replace function app.log_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb));
$$;

-- Konteks tepercaya: admin, atau koneksi layanan/SQL editor (bukan peran klien).
create or replace function app.is_trusted_context() returns boolean
language sql stable security definer set search_path = '' as $$
  -- Catatan: di dalam fungsi SECURITY DEFINER, current_user adalah pemilik fungsi, bukan pemanggil.
  -- Karena itu peran pemanggil dibaca dari GUC "role" (diatur PostgREST/SET ROLE).
  select app.is_admin()
      or (auth.uid() is null
          and coalesce(nullif(current_setting('role', true), ''), 'none') not in ('authenticated', 'anon'));
$$;

grant usage on schema app to authenticated;
revoke all on all functions in schema app from public, anon;
grant execute on all functions in schema app to authenticated;

-- ---------------------------------------------------------------- updated_at
create or replace function app.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'classes', 'curriculum_nodes', 'questions', 'assessments', 'mastery_records']
  loop
    execute format('drop trigger if exists trg_touch on public.%I', t);
    execute format('create trigger trg_touch before update on public.%I for each row execute function app.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- PROFIL BARU
-- Peran SELALU "student" untuk akun baru. Peran dari metadata pengguna diabaikan sepenuhnya.
create or replace function app.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), 'student')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_user();

-- Perubahan peran, kelas tingkat, dan status aktif hanya oleh konteks tepercaya.
create or replace function app.profiles_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.id <> old.id then
    raise exception 'id profil tidak boleh diubah' using errcode = '42501';
  end if;

  if (new.role is distinct from old.role
      or new.grade is distinct from old.grade
      or new.is_active is distinct from old.is_active)
     and not app.is_trusted_context() then
    raise exception 'hanya admin yang boleh mengubah peran, kelas tingkat, atau status akun' using errcode = '42501';
  end if;

  if old.role = 'admin' and (new.role <> 'admin' or not new.is_active) then
    if not exists (
      select 1 from public.profiles p
      where p.role = 'admin' and p.is_active and p.id <> old.id
    ) then
      raise exception 'tidak boleh menonaktifkan atau menurunkan admin terakhir' using errcode = '23514';
    end if;
  end if;

  if new.role is distinct from old.role then
    perform app.log_audit('profile.role_changed', 'profiles', old.id::text,
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard before update on public.profiles
  for each row execute function app.profiles_guard();

-- ---------------------------------------------------------------- KELAS
create or replace function app.classes_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- guru pembuat otomatis menjadi pengampu kelasnya
  if exists (select 1 from public.profiles p where p.id = new.created_by and p.role = 'teacher') then
    insert into public.teacher_class_assignments (class_id, teacher_id)
    values (new.id, new.created_by) on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists trg_classes_after_insert on public.classes;
create trigger trg_classes_after_insert after insert on public.classes
  for each row execute function app.classes_after_insert();

create or replace function app.class_members_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = new.student_id and p.role = 'student') then
    raise exception 'anggota kelas harus berperan siswa' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_class_members_guard on public.class_members;
create trigger trg_class_members_guard before insert on public.class_members
  for each row execute function app.class_members_guard();

create or replace function app.tca_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiles p where p.id = new.teacher_id and p.role = 'teacher') then
    raise exception 'pengampu harus berperan guru' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists trg_tca_guard on public.teacher_class_assignments;
create trigger trg_tca_guard before insert on public.teacher_class_assignments
  for each row execute function app.tca_guard();

-- ---------------------------------------------------------------- SOAL: alur status
create or replace function app.questions_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  admin_ctx boolean := app.is_trusted_context();
begin
  -- pembaruan bersarang dari trigger lain (mis. versi baru) tidak diperiksa ulang
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not admin_ctx and (new.status <> 'draft' or new.validated or new.reviewer_id is not null) then
      raise exception 'soal baru harus berstatus draft dan belum tervalidasi' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.code <> old.code or new.created_by <> old.created_by then
    raise exception 'kode dan pembuat soal tidak boleh diubah' using errcode = '42501';
  end if;

  if not admin_ctx then
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

drop trigger if exists trg_questions_guard on public.questions;
create trigger trg_questions_guard before insert or update on public.questions
  for each row execute function app.questions_guard();

-- Versi soal tidak dapat diubah atau dihapus (riwayat dan hasil lama tetap terbaca).
create or replace function app.immutable_row() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'baris % bersifat permanen; buat versi baru', tg_table_name using errcode = '42501';
end $$;

drop trigger if exists trg_versions_immutable on public.question_versions;
create trigger trg_versions_immutable before update or delete on public.question_versions
  for each row execute function app.immutable_row();

drop trigger if exists trg_keys_immutable on public.question_keys;
create trigger trg_keys_immutable before update or delete on public.question_keys
  for each row execute function app.immutable_row();

-- Versi baru: nomor berurutan, menjadi versi aktif, dan soal terbit kembali ke "review".
create or replace function app.versions_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  next_no integer;
begin
  select coalesce(max(version_no), 0) + 1 into next_no
  from public.question_versions where question_id = new.question_id;
  new.version_no := next_no;
  return new;
end $$;

drop trigger if exists trg_versions_before_insert on public.question_versions;
create trigger trg_versions_before_insert before insert on public.question_versions
  for each row execute function app.versions_before_insert();

create or replace function app.versions_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.questions q
     set current_version_id = new.id,
         status = case when q.status in ('published', 'archived') then 'review'::public.question_status else q.status end,
         validated = false
   where q.id = new.question_id;
  return new;
end $$;

drop trigger if exists trg_versions_after_insert on public.question_versions;
create trigger trg_versions_after_insert after insert on public.question_versions
  for each row execute function app.versions_after_insert();

-- ---------------------------------------------------------------- ASESMEN
create or replace function app.assessment_items_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  published boolean;
  target_assessment uuid := coalesce(new.assessment_id, old.assessment_id);
begin
  select a.is_published into published from public.assessments a where a.id = target_assessment;

  if published then
    raise exception 'butir asesmen yang sudah terbit tidak dapat diubah' using errcode = '42501';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    if not exists (
      select 1 from public.question_versions v
      join public.questions q on q.id = v.question_id
      where v.id = new.question_version_id
        and q.current_version_id = v.id
        and q.status = 'published' and q.validated
    ) then
      raise exception 'hanya versi aktif dari soal terbit yang tervalidasi yang boleh dipakai pada asesmen' using errcode = '23514';
    end if;
    return new;
  end if;
  return old;
end $$;

drop trigger if exists trg_assessment_items_guard on public.assessment_items;
create trigger trg_assessment_items_guard before insert or update or delete on public.assessment_items
  for each row execute function app.assessment_items_guard();

create or replace function app.assessments_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_published and not coalesce(old.is_published, false) then
    if not exists (select 1 from public.assessment_items i where i.assessment_id = new.id) then
      raise exception 'asesmen tanpa butir tidak dapat diterbitkan' using errcode = '23514';
    end if;
    perform app.log_audit('assessment.published', 'assessments', new.id::text, '{}'::jsonb);
  end if;
  if old.is_published and not new.is_published then
    raise exception 'asesmen yang sudah terbit tidak dapat ditarik kembali' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_assessments_guard on public.assessments;
create trigger trg_assessments_guard before update on public.assessments
  for each row execute function app.assessments_guard();
