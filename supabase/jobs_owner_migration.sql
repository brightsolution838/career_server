-- Add owner_id to jobs (which admin created/owns this job)
alter table public.jobs
  add column if not exists owner_id uuid references public.admin_users(id) on delete set null;

-- Add owner_id to application_progress (whose job the applicant applied to)
alter table public.application_progress
  add column if not exists owner_id uuid references public.admin_users(id) on delete set null;

-- Add owner_name to application_progress (denormalized for quick display)
alter table public.application_progress
  add column if not exists owner_name text;
