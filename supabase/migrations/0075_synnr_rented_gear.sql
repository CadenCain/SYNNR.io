-- Rented gear. A piece rented for a job (a flange, an adapter) is somebody
-- else's iron, and it bills by the day until it goes back. A line can now say
-- who it's rented from. On a job that makes two lines: the piece on the
-- checklist like any other, and one after the job that stays open, with the
-- vendor's name on it, until there's a photo of it back.

alter table public.synnr_job_lines
  add column if not exists rented_from text check (rented_from is null or char_length(rented_from) between 1 and 80);

-- What a manager asks every morning: what rented gear is still out?
create index if not exists synnr_job_lines_rented_out on public.synnr_job_lines (company_id)
  where rented_from is not null and phase = 'after' and on_at is null;

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

  -- Who it's rented from: a name, or nothing.
  new.rented_from := nullif(btrim(new.rented_from), '');

  -- What a line is (its name, how many, whether it's critical, whose it is)
  -- is the manager's call. A hand taps it on and off; that's all.
  if tg_op = 'UPDATE'
     and (new.critical is distinct from old.critical or new.label is distinct from old.label or new.qty is distinct from old.qty
          or new.rented_from is distinct from old.rented_from)
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

revoke all on function public.synnr_job_lines_guard() from public, anon, authenticated;
