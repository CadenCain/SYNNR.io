-- After the job. A job list can now say what the crew proves when the job is
-- done (BOP rams closed for travel, the package washed), next to what it
-- takes. Each of those is a photo, so a manager sees the gear was put away
-- right without driving back up to the yard to look.
--
-- 'load'  = a piece that goes on the truck. READY is about these only.
-- 'after' = something proven when the job is done. Always takes a photo,
--           and never holds a truck back from READY.

alter table public.saas_package_lines
  add column if not exists phase text not null default 'load' check (phase in ('load', 'after'));
alter table public.synnr_job_lines
  add column if not exists phase text not null default 'load' check (phase in ('load', 'after'));

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
  if tg_op = 'UPDATE' and new.phase is distinct from old.phase then
    raise exception 'A line stays where it is: something to load, or something to prove after the job.';
  end if;

  -- Something proven after the job always takes its photo.
  if new.phase = 'after' then
    new.critical := true;
  end if;

  -- What a line is (its name, how many, whether it's critical) is the
  -- manager's call. A hand taps it on and off; that's all.
  if tg_op = 'UPDATE'
     and (new.critical is distinct from old.critical or new.label is distinct from old.label or new.qty is distinct from old.qty)
     and coalesce(auth.role(), '') <> 'service_role'
     and not public.saas_is_company_admin(new.company_id) then
    raise exception 'MANAGER_ONLY: only a manager changes what a line is.';
  end if;

  -- Off the truck: the name and the photo go with it.
  if new.on_at is null then
    new.on_by := null;
    new.photo_path := null;
  end if;

  if new.photo_path is not null then
    -- A photo always sits in this company's folder for this job.
    if new.photo_path not like new.company_id::text || '/jobs/' || new.job_id::text || '/%' then
      raise exception 'That photo belongs somewhere else.';
    end if;
    -- Only the server attaches a photo, once the upload has landed.
    if (tg_op = 'INSERT' or new.photo_path is distinct from old.photo_path)
       and coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'PHOTO_SERVER_ONLY: a photo is saved by the server, not typed in.';
    end if;
  end if;

  -- A critical piece is never on the truck without its photo.
  if new.critical and new.on_at is not null and new.photo_path is null then
    raise exception 'NEEDS_PHOTO: a critical piece needs a photo to go on the truck.';
  end if;
  return new;
end $$;

-- Only a piece coming off the truck takes a READY job back to loading.
create or replace function public.synnr_job_lines_unready() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.on_at is null and new.phase = 'load' then
    update public.synnr_jobs set status = 'loading' where id = new.job_id and status = 'ready';
  end if;
  return null;
end $$;

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

  -- READY is about what goes on the truck. What's proven after the job doesn't hold it back.
  if new.status = 'ready' and (tg_op = 'INSERT' or old.status is distinct from 'ready') then
    if not exists (select 1 from public.synnr_job_lines l where l.job_id = new.id and l.phase = 'load') then
      raise exception 'NOT_READY: this job has no list yet.';
    end if;
    if exists (select 1 from public.synnr_job_lines l where l.job_id = new.id and l.phase = 'load' and l.on_at is null) then
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

revoke all on function public.synnr_job_lines_guard() from public, anon, authenticated;
revoke all on function public.synnr_job_lines_unready() from public, anon, authenticated;
revoke all on function public.synnr_jobs_guard() from public, anon, authenticated;
