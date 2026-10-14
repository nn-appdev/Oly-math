-- MathQuest Junior — Migrasi 1: skema inti.
-- Dapat dijalankan ulang dengan aman (idempoten) pada basis data kosong maupun yang sudah ada.
-- Keamanan (RLS) ada di migrasi 3; fungsi dan trigger ada di migrasi 2.

create extension if not exists pgcrypto;

create schema if not exists app;

-- ---------------------------------------------------------------- ENUM
do $$ begin
  create type public.user_role as enum ('student', 'teacher', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.question_status as enum ('draft', 'review', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.curriculum_domain as enum ('bilangan', 'geometri', 'kombinatorik', 'data');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.answer_type as enum (
    'single_choice', 'multi_choice', 'numeric', 'true_false',
    'ordering', 'matching', 'possibilities', 'visual', 'geometry_puzzle', 'logic_puzzle'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reveal_policy as enum ('after_submit', 'after_close', 'never');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.session_kind as enum ('diagnostic', 'practice', 'assessment', 'transfer', 'retention', 'corrective');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.session_status as enum ('in_progress', 'completed', 'abandoned');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- PROFIL
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  role        public.user_role not null default 'student',
  grade       smallint check (grade between 1 and 3),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------- KELAS
create table if not exists public.classes (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 1 and 80),
  grade            smallint not null check (grade between 1 and 3),
  school_year      text,
  ranking_enabled  boolean not null default false,
  created_by       uuid not null references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.class_members (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete cascade,
  student_id  uuid not null references public.profiles (id) on delete cascade,
  joined_at   timestamptz not null default now(),
  unique (class_id, student_id)
);
create index if not exists class_members_student_idx on public.class_members (student_id);

create table if not exists public.teacher_class_assignments (
  id          uuid primary key default gen_random_uuid(),
  class_id    uuid not null references public.classes (id) on delete cascade,
  teacher_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (class_id, teacher_id)
);
create index if not exists tca_teacher_idx on public.teacher_class_assignments (teacher_id);

-- ---------------------------------------------------------------- KURIKULUM
create table if not exists public.curriculum_nodes (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique check (code ~ '^[A-Z]{3}-[0-9]{1,2}-[0-9]{2,3}$'),
  domain             public.curriculum_domain not null,
  title              text not null check (char_length(title) between 1 and 160),
  grade_min          smallint not null check (grade_min between 1 and 3),
  grade_max          smallint not null check (grade_max between 1 and 3),
  objectives         text not null default '',
  concept_text       text not null default '',
  source_note        text not null default '',
  validation_status  text not null default 'belum_divalidasi'
                       check (validation_status in ('belum_divalidasi', 'dalam_telaah', 'tervalidasi')),
  sort_order         integer not null default 0,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (grade_min <= grade_max)
);
create index if not exists curriculum_nodes_domain_idx on public.curriculum_nodes (domain, sort_order);

create table if not exists public.curriculum_prerequisites (
  node_id          uuid not null references public.curriculum_nodes (id) on delete cascade,
  prerequisite_id  uuid not null references public.curriculum_nodes (id) on delete cascade,
  primary key (node_id, prerequisite_id),
  check (node_id <> prerequisite_id)
);

-- ---------------------------------------------------------------- BANK SOAL
create table if not exists public.questions (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique check (code ~ '^[A-Z]{3}-[0-9]{1,2}-[0-9]{4}$'),
  status              public.question_status not null default 'draft',
  node_id             uuid not null references public.curriculum_nodes (id),
  created_by          uuid not null references public.profiles (id),
  reviewer_id         uuid references public.profiles (id),
  validated           boolean not null default false,
  validation_notes    text not null default '',
  current_version_id  uuid,
  ai_assisted         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- soal terbit wajib tervalidasi dan ditinjau orang lain
  constraint questions_publish_requires_validation check (
    status <> 'published'
    or (validated and reviewer_id is not null and reviewer_id <> created_by)
  )
);
create index if not exists questions_status_idx on public.questions (status);
create index if not exists questions_node_idx on public.questions (node_id);

create table if not exists public.question_versions (
  id                   uuid primary key default gen_random_uuid(),
  question_id          uuid not null references public.questions (id) on delete cascade,
  version_no           integer not null check (version_no >= 1),
  statement            text not null check (char_length(statement) between 1 and 4000),
  instructions         text not null default '',
  grade                smallint not null check (grade between 1 and 3),
  cognitive_level      text not null check (cognitive_level in ('L1', 'L2', 'L3')),
  difficulty           smallint not null check (difficulty between 1 and 5),
  answer_type          public.answer_type not null,
  options              jsonb not null default '[]'::jsonb,
  visual_data          jsonb,
  hints                jsonb not null default '[]'::jsonb,
  targeted_misconceptions jsonb not null default '[]'::jsonb,
  recommended_seconds  integer check (recommended_seconds is null or recommended_seconds between 10 and 3600),
  source               text not null default '',
  created_by           uuid not null references public.profiles (id),
  created_at           timestamptz not null default now(),
  unique (question_id, version_no)
);
create index if not exists question_versions_question_idx on public.question_versions (question_id);

alter table public.questions
  drop constraint if exists questions_current_version_fk;
alter table public.questions
  add constraint questions_current_version_fk
  foreign key (current_version_id) references public.question_versions (id) deferrable initially deferred;

-- Kunci jawaban dan pembahasan dipisah dari konten soal supaya tidak ikut terkirim ke siswa.
create table if not exists public.question_keys (
  question_version_id  uuid primary key references public.question_versions (id) on delete cascade,
  answer_key           jsonb not null,
  explanation          text not null default '' ,
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------- ASESMEN
create table if not exists public.assessments (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(title) between 1 and 160),
  grade          smallint not null check (grade between 1 and 3),
  kind           public.session_kind not null default 'assessment',
  reveal_policy  public.reveal_policy not null default 'after_close',
  time_limit_minutes integer check (time_limit_minutes is null or time_limit_minutes between 1 and 240),
  is_published   boolean not null default false,
  created_by     uuid not null references public.profiles (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.assessment_items (
  id                   uuid primary key default gen_random_uuid(),
  assessment_id        uuid not null references public.assessments (id) on delete cascade,
  question_version_id  uuid not null references public.question_versions (id),
  position             integer not null check (position >= 1),
  points               numeric(5,2) not null default 1 check (points > 0),
  unique (assessment_id, position),
  unique (assessment_id, question_version_id)
);

create table if not exists public.assessment_assignments (
  id             uuid primary key default gen_random_uuid(),
  assessment_id  uuid not null references public.assessments (id) on delete cascade,
  class_id       uuid references public.classes (id) on delete cascade,
  student_id     uuid references public.profiles (id) on delete cascade,
  opens_at       timestamptz not null default now(),
  closes_at      timestamptz,
  assigned_by    uuid not null references public.profiles (id),
  created_at     timestamptz not null default now(),
  check ((class_id is not null) <> (student_id is not null)),
  check (closes_at is null or closes_at > opens_at)
);
create index if not exists assignments_class_idx on public.assessment_assignments (class_id);
create index if not exists assignments_student_idx on public.assessment_assignments (student_id);

-- ---------------------------------------------------------------- PEMBELAJARAN
create table if not exists public.learning_sessions (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles (id) on delete cascade,
  node_id         uuid references public.curriculum_nodes (id),
  assessment_id   uuid references public.assessments (id),
  kind            public.session_kind not null,
  status          public.session_status not null default 'in_progress',
  client_token    text not null check (char_length(client_token) between 8 and 80),
  state           jsonb not null default '{}'::jsonb,
  started_at      timestamptz not null default now(),
  last_active_at  timestamptz not null default now(),
  completed_at    timestamptz,
  unique (student_id, client_token)
);
create index if not exists sessions_student_idx on public.learning_sessions (student_id, started_at desc);

create table if not exists public.attempts (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references public.learning_sessions (id) on delete cascade,
  student_id           uuid not null references public.profiles (id) on delete cascade,
  question_version_id  uuid not null references public.question_versions (id),
  response             jsonb not null,
  is_correct           boolean not null,
  attempt_no           smallint not null default 1 check (attempt_no >= 1),
  hints_used           smallint not null default 0 check (hints_used >= 0),
  time_ms              integer check (time_ms is null or time_ms >= 0),
  misconception_flag   text,
  idempotency_key      text not null check (char_length(idempotency_key) between 8 and 80),
  created_at           timestamptz not null default now(),
  unique (student_id, idempotency_key)
);
create index if not exists attempts_student_idx on public.attempts (student_id, created_at desc);
create index if not exists attempts_version_idx on public.attempts (question_version_id);

create table if not exists public.mastery_records (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles (id) on delete cascade,
  node_id         uuid not null references public.curriculum_nodes (id),
  mastery         numeric(4,3) not null default 0 check (mastery between 0 and 1),
  evidence_count  integer not null default 0 check (evidence_count >= 0),
  independent_rate numeric(4,3) check (independent_rate between 0 and 1),
  transfer_passed boolean,
  next_review_at  timestamptz,
  updated_at      timestamptz not null default now(),
  unique (student_id, node_id)
);

-- ---------------------------------------------------------------- GAMIFIKASI
create table if not exists public.achievements (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  title        text not null,
  description  text not null default '',
  created_at   timestamptz not null default now()
);

create table if not exists public.student_achievements (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.profiles (id) on delete cascade,
  achievement_id  uuid not null references public.achievements (id),
  earned_at       timestamptz not null default now(),
  unique (student_id, achievement_id)
);

create table if not exists public.xp_ledger (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.profiles (id) on delete cascade,
  amount           integer not null check (amount <> 0),
  reason           text not null,
  idempotency_key  text not null check (char_length(idempotency_key) between 8 and 120),
  created_at       timestamptz not null default now(),
  unique (student_id, idempotency_key)
);
create index if not exists xp_student_idx on public.xp_ledger (student_id, created_at desc);

-- ---------------------------------------------------------------- AUDIT
create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  entity      text not null,
  entity_id   text,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
