-- No photo, it doesn't count. 0071 only checked the moment a critical piece
-- went on, which left ways around it: mark a line not critical, tap it on,
-- and mark it critical again; or wipe the photo off a piece already on. Now
-- the rule holds on every write: a critical piece that is on the truck has
-- its photo, and only a manager changes what a line is.

-- Pieces tapped on before photos were required were never proven. They go
-- back off, and their job goes back to loading.
update public.synnr_jobs j set status = 'loading'
 where j.status = 'ready'
   and exists (select 1 from public.synnr_job_lines l
                where l.job_id = j.id and l.critical and l.on_at is not null and l.photo_path is null);
update public.synnr_job_lines set on_at = null
 where critical and on_at is not null and photo_path is null;

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

revoke all on function public.synnr_job_lines_guard() from public, anon, authenticated;
