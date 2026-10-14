-- Tiruan minimal lingkungan Supabase untuk uji lokal. JANGAN dijalankan pada proyek Supabase asli.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- meniru auth.uid() Supabase: membaca klaim "sub" dari konfigurasi sesi
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
-- Pada Supabase, tabel baru memberi hak penuh ke anon/authenticated secara bawaan;
-- migrasi 3 mencabutnya. Meniru perilaku itu supaya uji bermakna.
alter default privileges in schema public grant all on tables to anon, authenticated;
