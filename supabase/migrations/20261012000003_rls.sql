-- MathQuest Junior — Migrasi 3: hak akses tabel dan Row Level Security.
-- Prinsip: tolak secara bawaan, buka hanya yang diperlukan.
-- Tabel hasil belajar (attempts, mastery_records, xp_ledger, student_achievements)
-- TIDAK dapat ditulis klien. Penulisan dilakukan fungsi tepercaya (Fase 3–5).

-- ---------------------------------------------------------------- pembantu tambahan
create or replace function app.assessment_assigned_to_me(p_assessment uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.is_student() and exists (
    select 1
    from public.assessments a
    join public.assessment_assignments g on g.assessment_id = a.id
    where a.id = p_assessment
      and a.is_published
      and g.opens_at <= now()
      and (g.closes_at is null or g.closes_at > now())
      and (g.student_id = auth.uid()
           or (g.class_id is not null and app.is_class_member(g.class_id)))
  );
$$;
grant execute on function app.assessment_assigned_to_me(uuid) to authenticated;
revoke execute on function app.assessment_assigned_to_me(uuid) from public, anon;

-- ---------------------------------------------------------------- hak tabel (tolak dulu)
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, role, grade, is_active) on public.profiles to authenticated;

grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, delete on public.class_members to authenticated;
grant select, insert, delete on public.teacher_class_assignments to authenticated;

grant select, insert, update, delete on public.curriculum_nodes to authenticated;
grant select, insert, delete on public.curriculum_prerequisites to authenticated;

grant select, insert, update on public.questions to authenticated;
grant select, insert on public.question_versions to authenticated;
grant select, insert on public.question_keys to authenticated;

grant select, insert, update, delete on public.assessments to authenticated;
grant select, insert, update, delete on public.assessment_items to authenticated;
grant select, insert, delete on public.assessment_assignments to authenticated;

grant select, insert on public.learning_sessions to authenticated;
grant update (state, status, last_active_at, completed_at) on public.learning_sessions to authenticated;

grant select on public.attempts to authenticated;
grant select on public.mastery_records to authenticated;
grant select on public.student_achievements to authenticated;
grant select on public.xp_ledger to authenticated;

grant select, insert, update, delete on public.achievements to authenticated;
grant select on public.audit_logs to authenticated;

-- ---------------------------------------------------------------- aktifkan RLS
alter table public.profiles                  enable row level security;
alter table public.classes                   enable row level security;
alter table public.class_members             enable row level security;
alter table public.teacher_class_assignments enable row level security;
alter table public.curriculum_nodes          enable row level security;
alter table public.curriculum_prerequisites  enable row level security;
alter table public.questions                 enable row level security;
alter table public.question_versions         enable row level security;
alter table public.question_keys             enable row level security;
alter table public.assessments               enable row level security;
alter table public.assessment_items          enable row level security;
alter table public.assessment_assignments    enable row level security;
alter table public.learning_sessions         enable row level security;
alter table public.attempts                  enable row level security;
alter table public.mastery_records           enable row level security;
alter table public.achievements              enable row level security;
alter table public.student_achievements      enable row level security;
alter table public.xp_ledger                 enable row level security;
alter table public.audit_logs                enable row level security;

-- ---------------------------------------------------------------- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or app.is_admin() or app.teaches_student(id));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or app.is_admin())
  with check (id = auth.uid() or app.is_admin());

-- ---------------------------------------------------------------- classes
drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes for select to authenticated
  using (app.is_admin() or app.teaches_class(id) or app.is_class_member(id) or created_by = auth.uid());

drop policy if exists classes_insert on public.classes;
create policy classes_insert on public.classes for insert to authenticated
  with check (app.is_staff() and created_by = auth.uid());

drop policy if exists classes_update on public.classes;
create policy classes_update on public.classes for update to authenticated
  using (app.is_admin() or app.teaches_class(id))
  with check (app.is_admin() or app.teaches_class(id));

drop policy if exists classes_delete on public.classes;
create policy classes_delete on public.classes for delete to authenticated
  using (app.is_admin());

-- ---------------------------------------------------------------- class_members
drop policy if exists class_members_select on public.class_members;
create policy class_members_select on public.class_members for select to authenticated
  using (app.is_admin() or app.teaches_class(class_id) or student_id = auth.uid());

drop policy if exists class_members_insert on public.class_members;
-- Pendaftaran siswa ke kelas hanya oleh admin: guru tidak dapat menarik siswa mana pun
-- ke kelasnya sendiri untuk membuka data siswa tersebut. Guru boleh mengeluarkan anggota.
create policy class_members_insert on public.class_members for insert to authenticated
  with check (app.is_admin());

drop policy if exists class_members_delete on public.class_members;
create policy class_members_delete on public.class_members for delete to authenticated
  using (app.is_admin() or app.teaches_class(class_id));

-- ---------------------------------------------------------------- teacher_class_assignments
drop policy if exists tca_select on public.teacher_class_assignments;
create policy tca_select on public.teacher_class_assignments for select to authenticated
  using (app.is_admin() or teacher_id = auth.uid());

drop policy if exists tca_insert on public.teacher_class_assignments;
create policy tca_insert on public.teacher_class_assignments for insert to authenticated
  with check (app.is_admin());

drop policy if exists tca_delete on public.teacher_class_assignments;
create policy tca_delete on public.teacher_class_assignments for delete to authenticated
  using (app.is_admin());

-- ---------------------------------------------------------------- kurikulum (baca semua, tulis admin)
drop policy if exists nodes_select on public.curriculum_nodes;
create policy nodes_select on public.curriculum_nodes for select to authenticated using (true);
drop policy if exists nodes_write on public.curriculum_nodes;
create policy nodes_write on public.curriculum_nodes for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

drop policy if exists prereq_select on public.curriculum_prerequisites;
create policy prereq_select on public.curriculum_prerequisites for select to authenticated using (true);
drop policy if exists prereq_write on public.curriculum_prerequisites;
create policy prereq_write on public.curriculum_prerequisites for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

-- ---------------------------------------------------------------- bank soal
drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions for select to authenticated
  using (
    app.is_admin()
    or (app.is_staff() and (created_by = auth.uid() or reviewer_id = auth.uid() or status in ('published', 'review')))
    or (app.is_student() and status = 'published')
  );

drop policy if exists questions_insert on public.questions;
create policy questions_insert on public.questions for insert to authenticated
  with check (app.is_staff() and created_by = auth.uid());

drop policy if exists questions_update on public.questions;
create policy questions_update on public.questions for update to authenticated
  using (app.is_admin() or (app.is_staff() and created_by = auth.uid()))
  with check (app.is_admin() or (app.is_staff() and created_by = auth.uid()));

drop policy if exists versions_select on public.question_versions;
create policy versions_select on public.question_versions for select to authenticated
  using (
    app.student_can_view_version(id)
    or (app.is_staff() and exists (select 1 from public.questions q where q.id = question_id))
  );

drop policy if exists versions_insert on public.question_versions;
create policy versions_insert on public.question_versions for insert to authenticated
  with check (
    app.is_staff() and created_by = auth.uid()
    and (app.is_admin() or exists (
      select 1 from public.questions q where q.id = question_id and q.created_by = auth.uid()
    ))
  );

drop policy if exists keys_select on public.question_keys;
create policy keys_select on public.question_keys for select to authenticated
  using (app.can_view_key(question_version_id));

drop policy if exists keys_insert on public.question_keys;
create policy keys_insert on public.question_keys for insert to authenticated
  with check (
    app.is_staff() and exists (
      select 1 from public.question_versions v
      where v.id = question_version_id and v.created_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------- asesmen
drop policy if exists assessments_select on public.assessments;
create policy assessments_select on public.assessments for select to authenticated
  using (app.is_admin() or created_by = auth.uid() or app.assessment_assigned_to_me(id));

drop policy if exists assessments_insert on public.assessments;
create policy assessments_insert on public.assessments for insert to authenticated
  with check (app.is_staff() and created_by = auth.uid() and not is_published);

drop policy if exists assessments_update on public.assessments;
create policy assessments_update on public.assessments for update to authenticated
  using (app.is_admin() or (app.is_staff() and created_by = auth.uid()))
  with check (app.is_admin() or (app.is_staff() and created_by = auth.uid()));

drop policy if exists assessments_delete on public.assessments;
create policy assessments_delete on public.assessments for delete to authenticated
  using (app.is_admin() or (created_by = auth.uid() and not is_published));

drop policy if exists items_select on public.assessment_items;
create policy items_select on public.assessment_items for select to authenticated
  using (
    app.is_admin()
    or exists (select 1 from public.assessments a where a.id = assessment_id and a.created_by = auth.uid())
    or app.assessment_assigned_to_me(assessment_id)
  );

drop policy if exists items_write on public.assessment_items;
create policy items_write on public.assessment_items for all to authenticated
  using (app.is_admin() or exists (
    select 1 from public.assessments a where a.id = assessment_id and a.created_by = auth.uid()))
  with check (app.is_admin() or exists (
    select 1 from public.assessments a where a.id = assessment_id and a.created_by = auth.uid()));

drop policy if exists assign_select on public.assessment_assignments;
create policy assign_select on public.assessment_assignments for select to authenticated
  using (
    app.is_admin() or assigned_by = auth.uid() or student_id = auth.uid()
    or (class_id is not null and app.is_class_member(class_id))
  );

drop policy if exists assign_insert on public.assessment_assignments;
create policy assign_insert on public.assessment_assignments for insert to authenticated
  with check (
    app.is_staff() and assigned_by = auth.uid()
    and exists (
      select 1 from public.assessments a
      where a.id = assessment_id and a.is_published and (a.created_by = auth.uid() or app.is_admin())
    )
    and (class_id is null or app.is_admin() or app.teaches_class(class_id))
    and (student_id is null or app.is_admin() or app.teaches_student(student_id))
  );

drop policy if exists assign_delete on public.assessment_assignments;
create policy assign_delete on public.assessment_assignments for delete to authenticated
  using (app.is_admin() or assigned_by = auth.uid());

-- ---------------------------------------------------------------- sesi belajar
drop policy if exists sessions_select on public.learning_sessions;
create policy sessions_select on public.learning_sessions for select to authenticated
  using (student_id = auth.uid() or app.teaches_student(student_id) or app.is_admin());

drop policy if exists sessions_insert on public.learning_sessions;
create policy sessions_insert on public.learning_sessions for insert to authenticated
  with check (student_id = auth.uid() and app.is_student());

drop policy if exists sessions_update on public.learning_sessions;
create policy sessions_update on public.learning_sessions for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ---------------------------------------------------------------- hasil belajar (hanya baca)
drop policy if exists attempts_select on public.attempts;
create policy attempts_select on public.attempts for select to authenticated
  using (student_id = auth.uid() or app.teaches_student(student_id) or app.is_admin());

drop policy if exists mastery_select on public.mastery_records;
create policy mastery_select on public.mastery_records for select to authenticated
  using (student_id = auth.uid() or app.teaches_student(student_id) or app.is_admin());

drop policy if exists sa_select on public.student_achievements;
create policy sa_select on public.student_achievements for select to authenticated
  using (student_id = auth.uid() or app.teaches_student(student_id) or app.is_admin());

drop policy if exists xp_select on public.xp_ledger;
create policy xp_select on public.xp_ledger for select to authenticated
  using (student_id = auth.uid() or app.teaches_student(student_id) or app.is_admin());

-- ---------------------------------------------------------------- lencana & audit
drop policy if exists achievements_select on public.achievements;
create policy achievements_select on public.achievements for select to authenticated using (true);
drop policy if exists achievements_write on public.achievements;
create policy achievements_write on public.achievements for all to authenticated
  using (app.is_admin()) with check (app.is_admin());

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
  using (app.is_admin());
