-- Proof of the load. A critical piece goes on the truck with a photo of it,
-- or it doesn't go on at all. The photo lives in the private "proofs" bucket
-- under the company's own folder, and only the server can attach one to a
-- line (after the upload lands), so a tap from a phone can't fake it.

alter table public.synnr_job_lines
  add column if not exists photo_path text check (photo_path is null or char_length(photo_path) <= 300);

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

  -- A critical piece needs its photo to go on.
  if new.critical and new.on_at is not null and new.photo_path is null
     and (tg_op = 'INSERT' or old.on_at is null) then
    raise exception 'NEEDS_PHOTO: a critical piece needs a photo to go on the truck.';
  end if;
  return new;
end $$;

revoke all on function public.synnr_job_lines_guard() from public, anon, authenticated;
