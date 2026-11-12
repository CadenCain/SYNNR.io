-- The record has to be one nobody can dress up. Found in a full review of the
-- job flow: the app always sent the right name and time, but the database
-- took whatever a phone sent. Someone going around the app with his own
-- login could change who loaded a piece and when, backdate a READY, or
-- rewrite what the job was. This closes that, and four smaller gaps:
--
--  1. Who and when come from the database: its own clock, and the signed-in
--     person's own name. Whatever the phone sends for those is ignored.
--  2. What a job is (kind, truck, what the dispatch said, who started it)
--     doesn't change from a hand's login.
--  3. first_ready_at: the first time the truck was cleared, set once and
--     never moved. One stray tap after the job takes a truck back to NOT
--     READY; it used to take the after-the-job checks and the morning email
--     with it. Those now go by first_ready_at.
--  4. A piece coming off and a READY can't pass each other: a line change
--     holds the job's row while it happens.
--  5. Taking the last piece off a READY job's list takes it back to loading
--     (it used to stay READY with nothing on it).
--  6. A job list line can be as long, and as many, as a job line (the form
--     allowed 120 characters and 999; the table refused past 80 and 99).
--  7. Photo storage: only the server writes or deletes. The old rules let a
--     signed-in person put files in, or a manager take them out, directly.

alter table public.synnr_jobs add column if not exists first_ready_at timestamptz;
update public.synnr_jobs set first_ready_at = ready_at where first_ready_at is null and ready_at is not null;
create index if not exists synnr_jobs_went_out_idx on public.synnr_jobs (first_ready_at) where first_ready_at is not null;

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
    if not server then
      -- Who started it stays who started it.
      new.created_by_name := old.created_by_name;
      -- What the job is: a manager's call, never a hand's.
      if not public.saas_is_company_admin(new.company_id) then
        new.job_type := old.job_type;
        new.truck := old.truck;
        new.details := old.details;
        new.remarks := old.remarks;
        new.source := old.source;
      end if;
    end if;
  elsif not server then
    -- A new job is started by the person signed in, under their own name.
    new.created_by_name := coalesce(public.saas_actor_name(), new.created_by_name);
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
    if server then
      new.ready_at := coalesce(new.ready_at, now());
    else
      -- Cleared now, by the person signed in. Not at a time or under a name the phone picked.
      new.ready_at := now();
      new.ready_by := coalesce(public.saas_actor_name(), new.ready_by);
    end if;
  elsif new.status = 'ready' and not server then
    -- Already cleared: who cleared it and when stay as they were.
    new.ready_by := old.ready_by;
    new.ready_at := old.ready_at;
  end if;
  if new.status = 'loading' then
    new.ready_by := null;
    new.ready_at := null;
  end if;

  -- The first time it was cleared: set once, never moved.
  if tg_op = 'UPDATE' then
    new.first_ready_at := coalesce(old.first_ready_at, case when new.status = 'ready' then new.ready_at end);
  else
    new.first_ready_at := case when new.status = 'ready' then new.ready_at end;
  end if;
  return new;
end $$;

create or replace function public.synnr_job_lines_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  job_company uuid;
  server boolean := coalesce(auth.role(), '') = 'service_role';
  boss boolean;
begin
  -- Hold the job's row while one of its lines changes, so a piece coming off
  -- and a READY can't pass each other.
  select company_id into job_company from public.synnr_jobs where id = new.job_id for update;
  if job_company is null or job_company is distinct from new.company_id then
    raise exception 'That job belongs to another company.';
  end if;
  if tg_op = 'UPDATE' and new.job_id is distinct from old.job_id then
    raise exception 'A line cannot move to another job.';
  end if;
  if tg_op = 'UPDATE' and new.phase is distinct from old.phase then
    raise exception 'A line stays where it is: something to load, or something to prove after the job.';
  end if;
  boss := server or public.saas_is_company_admin(new.company_id);

  -- Something proven after the job always takes its photo.
  if new.phase = 'after' then
    new.critical := true;
  end if;

  -- What a line is (its name, how many, whether it's critical) is the
  -- manager's call. A hand taps it on and off; that's all.
  if tg_op = 'UPDATE' and not boss then
    if new.critical is distinct from old.critical or new.label is distinct from old.label or new.qty is distinct from old.qty then
      raise exception 'MANAGER_ONLY: only a manager changes what a line is.';
    end if;
    -- Why it's on the list, where it came from, and its place stay put.
    new.why := old.why;
    new.source := old.source;
    new.sort := old.sort;
  end if;

  -- Off the truck: the name and the photo go with it.
  if new.on_at is null then
    new.on_by := null;
    new.photo_path := null;
  end if;

  -- Who and when: the database's own clock and the signed-in person's own
  -- name. Not a time or a name the phone picked.
  if not server and new.on_at is not null then
    if tg_op = 'UPDATE' and old.on_at is not null then
      new.on_at := old.on_at;
      new.on_by := old.on_by;
    else
      new.on_at := now();
      new.on_by := coalesce(public.saas_actor_name(), new.on_by);
    end if;
  end if;

  if new.photo_path is not null then
    -- A photo always sits in this company's folder for this job.
    if new.photo_path not like new.company_id::text || '/jobs/' || new.job_id::text || '/%' then
      raise exception 'That photo belongs somewhere else.';
    end if;
    -- Only the server attaches a photo, once the upload has landed.
    if (tg_op = 'INSERT' or new.photo_path is distinct from old.photo_path) and not server then
      raise exception 'PHOTO_SERVER_ONLY: a photo is saved by the server, not typed in.';
    end if;
  end if;

  -- A critical piece is never on the truck without its photo.
  if new.critical and new.on_at is not null and new.photo_path is null then
    raise exception 'NEEDS_PHOTO: a critical piece needs a photo to go on the truck.';
  end if;
  return new;
end $$;

-- The last piece taken off a READY job's list: it isn't ready for anything.
create or replace function public.synnr_job_lines_gone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.phase = 'load'
     and not exists (select 1 from public.synnr_job_lines l where l.job_id = old.job_id and l.phase = 'load') then
    update public.synnr_jobs set status = 'loading' where id = old.job_id and status = 'ready';
  end if;
  return null;
end $$;
drop trigger if exists synnr_job_lines_gone on public.synnr_job_lines;
create trigger synnr_job_lines_gone after delete on public.synnr_job_lines
  for each row execute function public.synnr_job_lines_gone();

revoke all on function public.synnr_jobs_guard() from public, anon, authenticated;
revoke all on function public.synnr_job_lines_guard() from public, anon, authenticated;
revoke all on function public.synnr_job_lines_gone() from public, anon, authenticated;

-- A job list line: as long, and as many, as a job line.
alter table public.saas_package_lines drop constraint if exists saas_package_lines_label_check;
alter table public.saas_package_lines add constraint saas_package_lines_label_check check (char_length(label) between 1 and 120);
alter table public.saas_package_lines drop constraint if exists saas_package_lines_qty_check;
alter table public.saas_package_lines add constraint saas_package_lines_qty_check check (qty between 1 and 999);

-- Photo storage: only the server writes or deletes.
drop policy if exists saas_proofs_insert on storage.objects;
drop policy if exists saas_proofs_delete on storage.objects;
