-- Admin users table
create table if not exists public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  name          text,
  role          text not null default 'admin',   -- 'admin' | 'super_admin'
  approved      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.admin_users add column if not exists name     text;
alter table public.admin_users add column if not exists role     text not null default 'admin';
alter table public.admin_users add column if not exists approved boolean not null default false;

alter table public.admin_users enable row level security;
-- No RLS policies needed — service role bypasses RLS.
