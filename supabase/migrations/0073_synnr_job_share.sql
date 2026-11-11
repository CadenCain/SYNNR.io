-- A link the crew can send the customer: the job's list and its proof photos,
-- no login. The link is a long random token on the job. Only the server makes
-- one or takes it away, so nobody can type in a link that's easy to guess.

alter table public.synnr_jobs
  add column if not exists share_token text check (share_token is null or share_token ~ '^[A-Za-z0-9_-]{24,64}$'),
  add column if not exists shared_by text check (shared_by is null or char_length(shared_by) <= 120),
  add column if not exists shared_at timestamptz;
create unique index if not exists synnr_jobs_share_token_idx on public.synnr_jobs (share_token) where share_token is not null;

create or replace function public.synnr_jobs_guard() returns trigger
language plpgsql set search_path = public as $$
declare server boolean := coalesce(auth.role(), '') = 'service_role';
begin
  if tg_op = 'UPDATE' then
    if new.company_id is distinct from old.company_id then
      raise exception 'A job cannot move to another company.';
    end if;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;

  -- The link: made and taken away by the server only.
  if tg_op = 'INSERT' then
    if new.share_token is not null and not server then
      raise exception 'SHARE_SERVER_ONLY: a link is made by the server, not typed in.';
    end if;
  elsif new.share_token is distinct from old.share_token then
    if not server then
      raise exception 'SHARE_SERVER_ONLY: a link is made by the server, not typed in.';
    end if;
  elsif not server then
    -- Who sent it and when stay as they were.
    new.shared_by := old.shared_by;
    new.shared_at := old.shared_at;
  end if;
  if new.share_token is null then
    new.shared_by := null;
    new.shared_at := null;
  else
    new.shared_at := coalesce(new.shared_at, now());
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

revoke all on function public.synnr_jobs_guard() from public, anon, authenticated;
