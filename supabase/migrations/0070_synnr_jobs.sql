-- SYNNR jobs: a job (read from a dispatch or typed in), the list of what it
-- takes, and who put each piece on the truck. The database itself refuses to
-- call a job READY while anything on its list is still off the truck, so no
-- screen or script can say READY early.

-- A job type's list can mark the pieces that stop the job if they're missing.
alter table public.saas_package_lines add column if not exists critical boolean not null default false;

create table if not exists public.synnr_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  job_type text not null check (char_length(job_type) between 1 and 80),
  truck text check (truck is null or char_length(truck) <= 40),
  -- Job facts only (well, sizes, pressure control). Never people or phone numbers.
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) <= 8192),
  remarks text check (remarks is null or char_length(remarks) <= 2000),
  source text not null default 'typed' check (source in ('photo', 'typed')),
  status text not null default 'loading' check (status in ('loading', 'ready')),
  ready_by text check (ready_by is null or char_length(ready_by) <= 120),
  ready_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_by_name text check (created_by_name is null or char_length(created_by_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists synnr_jobs_company_idx on public.synnr_jobs (company_id, created_at desc);

create table if not exists public.synnr_job_lines (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.synnr_jobs(id) on delete cascade,
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  qty integer not null default 1 check (qty between 1 and 999),
  critical boolean not null default false,
  -- Why it's on the list, in the dispatch's own words when it came from there.
  why text check (why is null or char_length(why) <= 300),
  source text not null default 'added' check (source in ('list', 'dispatch', 'added')),
  sort integer not null default 0,
  on_by text check (on_by is null or char_length(on_by) <= 120),
  on_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists synnr_job_lines_job_idx on public.synnr_job_lines (job_id, sort);
create index if not exists synnr_job_lines_company_idx on public.synnr_job_lines (company_id);

alter table public.synnr_jobs enable row level security;
alter table public.synnr_job_lines enable row level security;

-- Everyone on the crew sees the company's jobs, starts one, and taps pieces on.
-- Only a manager deletes a job.
drop policy if exists synnr_jobs_select on public.synnr_jobs;
create policy synnr_jobs_select on public.synnr_jobs for select
  using (company_id in (select saas_user_company_ids()));
drop policy if exists synnr_jobs_insert on public.synnr_jobs;
create policy synnr_jobs_insert on public.synnr_jobs for insert
  with check (company_id in (select saas_user_company_ids()) and created_by = auth.uid());
drop policy if exists synnr_jobs_update on public.synnr_jobs;
create policy synnr_jobs_update on public.synnr_jobs for update
  using (company_id in (select saas_user_company_ids()))
  with check (company_id in (select saas_user_company_ids()));
drop policy if exists synnr_jobs_delete on public.synnr_jobs;
create policy synnr_jobs_delete on public.synnr_jobs for delete
  using (saas_is_company_admin(company_id));

drop policy if exists synnr_job_lines_select on public.synnr_job_lines;
create policy synnr_job_lines_select on public.synnr_job_lines for select
  using (company_id in (select saas_user_company_ids()));
drop policy if exists synnr_job_lines_insert on public.synnr_job_lines;
create policy synnr_job_lines_insert on public.synnr_job_lines for insert
  with check (company_id in (select saas_user_company_ids()));
drop policy if exists synnr_job_lines_update on public.synnr_job_lines;
create policy synnr_job_lines_update on public.synnr_job_lines for update
  using (company_id in (select saas_user_company_ids()))
  with check (company_id in (select saas_user_company_ids()));
drop policy if exists synnr_job_lines_delete on public.synnr_job_lines;
create policy synnr_job_lines_delete on public.synnr_job_lines for delete
  using (saas_is_company_admin(company_id));

-- A job never changes company, and READY only happens with every piece on.
create or replace function public.synnr_jobs_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then
      raise exception 'A job cannot move to another company.';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  if new.status = 'ready' and (tg_op = 'INSERT' or old.status is distinct from 'ready') then
    if not exists (select 1 from public.synnr_job_lines l where l.job_id = new.id) then
      raise exception 'NOT_READY: this job has no list yet.';
    end if;
    if exists (select 1 from public.synnr_job_lines l where l.job_id = new.id and l.on_at is null) then
      raise exception 'NOT_READY: something on the list is still off the truck.';
    end if;
    new.ready_at := coalesce(new.ready_at, now());
  end if;
  if new.status = 'loading' then
    new.ready_by := null;
    new.ready_at := null;
  end if;
  return new;
end $$;
drop trigger if exists synnr_jobs_guard on public.synnr_jobs;
create trigger synnr_jobs_guard before insert or update on public.synnr_jobs
  for each row execute function public.synnr_jobs_guard();

-- A line always belongs to its job's company, and never moves to another job.
create or replace function public.synnr_job_lines_guard() returns trigger
language plpgsql set search_path = public as $$
declare job_company uuid;
begin
  select company_id into job_company from public.synnr_jobs where id = new.job_id;
  if job_company is null or job_company is distinct from new.company_id then
    raise exception 'That job belongs to another company.';
  end if;
  if tg_op = 'UPDATE' and new.job_id is distinct from old.job_id then
    raise exception 'A line cannot move to another job.';
  end if;
  return new;
end $$;
drop trigger if exists synnr_job_lines_guard on public.synnr_job_lines;
create trigger synnr_job_lines_guard before insert or update on public.synnr_job_lines
  for each row execute function public.synnr_job_lines_guard();

-- Anything that leaves a piece off the truck (a new line, an un-tap) takes a
-- READY job back to loading. Runs as the table owner so it holds whoever
-- made the change.
create or replace function public.synnr_job_lines_unready() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.on_at is null then
    update public.synnr_jobs set status = 'loading' where id = new.job_id and status = 'ready';
  end if;
  return null;
end $$;
drop trigger if exists synnr_job_lines_unready on public.synnr_job_lines;
create trigger synnr_job_lines_unready after insert or update on public.synnr_job_lines
  for each row execute function public.synnr_job_lines_unready();

revoke all on function public.synnr_jobs_guard() from public, anon, authenticated;
revoke all on function public.synnr_job_lines_guard() from public, anon, authenticated;
revoke all on function public.synnr_job_lines_unready() from public, anon, authenticated;
