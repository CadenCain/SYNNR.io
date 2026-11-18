-- The manager's call. A second simulated yard found three things only a
-- manager can decide about a job, and no way to do any of them:
--
--  1. Send a photo back. A manager who threw out a bad photo left no word
--     for the crew and no record it had happened. Now the line keeps who
--     sent it back, when, why, and the photo that was sent back with who
--     took it. The check is owed again until a new photo is taken.
--  2. Close a job out. A job the customer cancelled sat in the morning email
--     for a week. A closed job owes nothing and nothing on it changes until
--     a manager opens it back up; who closed it, when and why stay on it.
--  3. Fix the unit or the kind of job. A hand typed the wrong unit and only
--     a delete could clear it. A manager can correct it, and what it said
--     before stays on the record.
--
-- All three are stamped here, by the database's own clock under the
-- signed-in manager's own name, like everything else on a job.

alter table public.synnr_jobs
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by text check (closed_by is null or char_length(closed_by) <= 120),
  add column if not exists closed_why text check (closed_why is null or char_length(closed_why) between 1 and 200),
  add column if not exists fixed_at timestamptz,
  add column if not exists fixed_by text check (fixed_by is null or char_length(fixed_by) <= 120),
  add column if not exists fixed_from text check (fixed_from is null or char_length(fixed_from) <= 160);

alter table public.synnr_job_lines
  add column if not exists back_at timestamptz,
  add column if not exists back_by text check (back_by is null or char_length(back_by) <= 120),
  add column if not exists back_why text check (back_why is null or char_length(back_why) between 1 and 200),
  add column if not exists back_photo_path text check (back_photo_path is null or char_length(back_photo_path) <= 300),
  add column if not exists back_from text check (back_from is null or char_length(back_from) <= 120),
  add column if not exists back_from_at timestamptz;

create or replace function public.synnr_jobs_guard() returns trigger
language plpgsql set search_path = public as $$
declare
  server boolean := coalesce(auth.role(), '') = 'service_role';
  boss boolean;
begin
  boss := server or public.saas_is_company_admin(new.company_id);
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
      if not boss then
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

  -- The manager's call on a job. Stamped here, never by the phone.
  if not server then
    if tg_op = 'INSERT' then
      new.fixed_at := null; new.fixed_by := null; new.fixed_from := null;
      new.closed_at := null; new.closed_by := null; new.closed_why := null;
    else
      -- The unit or the kind of job was corrected: what it said before stays on the record.
      if new.truck is distinct from old.truck or new.job_type is distinct from old.job_type then
        new.fixed_at := now();
        new.fixed_by := coalesce(public.saas_actor_name(), 'A manager');
        new.fixed_from := left(concat_ws(', ', nullif(btrim(coalesce(old.truck, '')), ''), old.job_type), 160);
      else
        new.fixed_at := old.fixed_at; new.fixed_by := old.fixed_by; new.fixed_from := old.fixed_from;
      end if;

      if not boss then
        new.closed_at := old.closed_at; new.closed_by := old.closed_by; new.closed_why := old.closed_why;
      elsif new.closed_at is null then
        -- Opened back up, or never closed.
        new.closed_by := null; new.closed_why := null;
      elsif old.closed_at is null then
        -- Closed out now, by the manager signed in, with a reason.
        new.closed_why := nullif(left(btrim(coalesce(new.closed_why, '')), 200), '');
        if new.closed_why is null then
          raise exception 'NEEDS_REASON: say why the job is being closed out.';
        end if;
        new.closed_at := now();
        new.closed_by := coalesce(public.saas_actor_name(), 'A manager');
      else
        -- Already closed: who, when and why stay as they were.
        new.closed_at := old.closed_at; new.closed_by := old.closed_by; new.closed_why := old.closed_why;
      end if;
    end if;
  elsif new.closed_at is null then
    new.closed_by := null; new.closed_why := null;
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
    if new.closed_at is not null and not server then
      raise exception 'JOB_CLOSED: this job was closed out.';
    end if;
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
  job_closed timestamptz;
  server boolean := coalesce(auth.role(), '') = 'service_role';
  boss boolean;
begin
  -- Hold the job's row while one of its lines changes, so a piece coming off
  -- and a READY can't pass each other.
  select company_id, closed_at into job_company, job_closed from public.synnr_jobs where id = new.job_id for update;
  if job_company is null or job_company is distinct from new.company_id then
    raise exception 'That job belongs to another company.';
  end if;
  if tg_op = 'UPDATE' and new.job_id is distinct from old.job_id then
    raise exception 'A line cannot move to another job.';
  end if;
  if tg_op = 'UPDATE' and new.phase is distinct from old.phase then
    raise exception 'A line stays where it is: something to load, or something to prove after the job.';
  end if;
  -- A job that was closed out is finished: nothing on it is tapped, added or
  -- sent back until a manager opens it back up.
  if job_closed is not null and not server then
    raise exception 'JOB_CLOSED: this job was closed out.';
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

  -- A photo sent back: a manager's call. The line keeps who sent it back,
  -- when and why, and the photo that was sent back with who took it. The
  -- piece reads as off (or the check as owed) until a new photo is taken.
  if not server then
    if tg_op = 'INSERT' then
      new.back_at := null; new.back_by := null; new.back_why := null;
      new.back_photo_path := null; new.back_from := null; new.back_from_at := null;
    elsif boss and new.back_at is not null and new.back_at is distinct from old.back_at then
      if old.on_at is null or old.photo_path is null then
        raise exception 'NO_PHOTO: there is no photo on that line to send back.';
      end if;
      new.back_why := nullif(left(btrim(coalesce(new.back_why, '')), 200), '');
      if new.back_why is null then
        raise exception 'NEEDS_REASON: say what is wrong with the photo.';
      end if;
      new.back_at := now();
      new.back_by := coalesce(public.saas_actor_name(), 'A manager');
      new.back_photo_path := old.photo_path;
      new.back_from := old.on_by;
      new.back_from_at := old.on_at;
      new.on_at := null;
    else
      new.back_at := old.back_at; new.back_by := old.back_by; new.back_why := old.back_why;
      new.back_photo_path := old.back_photo_path; new.back_from := old.back_from; new.back_from_at := old.back_from_at;
    end if;
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

revoke all on function public.synnr_jobs_guard() from public, anon, authenticated;
revoke all on function public.synnr_job_lines_guard() from public, anon, authenticated;
