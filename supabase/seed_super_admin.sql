-- Create the admin_users table if it doesn't exist yet
create table if not exists public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,
  role          text not null default 'admin',
  approved      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Add role and approved columns if the table already existed without them
alter table public.admin_users add column if not exists role     text    not null default 'admin';
alter table public.admin_users add column if not exists approved boolean not null default false;

-- Enable RLS (service role bypasses it, so no policies needed)
alter table public.admin_users enable row level security;

-- Insert the super admin
-- email:    superadmin@system.com
-- password: superadmin123
-- name:     Super Admin
insert into public.admin_users (email, password_hash, name, role, approved)
values (
  'superadmin@system.com',
  '$2a$10$z77NVjETPay/dYYdnKBTheXgN.3knAxUNCJq1tLZ1q58RJ8mwzMmm',
  'Super Admin',
  'super_admin',
  true
)
on conflict (email) do update
  set password_hash = excluded.password_hash,
      name          = 'Super Admin',
      role          = 'super_admin',
      approved      = true;
