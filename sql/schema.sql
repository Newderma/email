-- HR follow-up automation schema
-- Run this in the Supabase SQL editor (same project as clinic-tracker).
-- Table names prefixed hrf_ to avoid any collision with existing ct_ tables.

create table if not exists hrf_employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  role text,                 -- e.g. 'HR', 'Legal Consultant' — for tone/context only
  smtp_key text not null,    -- must match an EMPLOYEE_SMTP_<KEY> entry in .env, e.g. 'ISRAA'
  active boolean not null default true,
  last_contacted_at timestamptz
);

create table if not exists hrf_tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references hrf_employees(id) on delete cascade,
  task_text text not null,   -- plain language, e.g. "Renew Ahmed's iqama, expires Aug 15"
  status text not null default 'open', -- 'open' | 'done'
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists hrf_approvals (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references hrf_employees(id) on delete cascade,
  token text unique not null,
  task_ids uuid[] not null,
  status text not null default 'pending', -- 'pending' | 'submitted' | 'expired'
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz
);

create index if not exists idx_hrf_tasks_employee_status on hrf_tasks(employee_id, status);
create index if not exists idx_hrf_approvals_token on hrf_approvals(token);

-- Row Level Security: this backend uses the service_role key exclusively,
-- so lock these tables down from the anon/public key entirely.
alter table hrf_employees enable row level security;
alter table hrf_tasks enable row level security;
alter table hrf_approvals enable row level security;
-- No policies added on purpose: only the service_role key (which bypasses
-- RLS) can touch these tables. The public anon key gets nothing.
