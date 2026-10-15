-- 0013 A typed date never turns a piece green. (Load-out MVP audit, 2026-10-15)
--
-- The rule RollReady sells: a photo of the cert is the only way a test gets
-- a later date. 0009 stopped hands from typing dates but let a manager type
-- one, marked "no photo" yet still counted: an expired BOP went green the
-- moment someone typed next year into the box.
--
-- Now a typed date that moves a test LATER (or gives a date to one that had
-- none) is held in typed_expiration, and the test keeps its old date until a
-- photo of the cert shows the new one (the server's upload path clears it).
-- A typed date that moves a test EARLIER still applies right away: that only
-- ever makes the yard stricter. First-time setup (adding an item with its
-- date, the spreadsheet import of new items) is unchanged.

alter table public.saas_compliance_items add column if not exists typed_expiration date;

create or replace function public.saas_ci_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_admin boolean;
begin
  -- The server (service role) and the crons carry no user: they are the
  -- paths that already enforce the rules in code.
  if auth.uid() is null then return new; end if;
  is_admin := saas_is_company_admin(new.company_id);

  if tg_op = 'INSERT' then
    if not is_admin and (new.expiration_date is not null or new.issued_date is not null) then
      raise exception 'Only a manager can type in a date. Add the item, then upload a photo of the cert.'
        using errcode = '42501';
    end if;
    new.renewed_without_proof := false;
    new.pending_until := null;
    new.waiting_upload_id := null;
    new.last_upload_id := null;
    new.typed_expiration := null;
    return new;
  end if;

  if new.company_id <> old.company_id or new.parent_type <> old.parent_type or new.parent_id <> old.parent_id then
    raise exception 'A cert can''t be moved to different gear or a different hand.' using errcode = '42501';
  end if;
  if (new.title is distinct from old.title or new.kind is distinct from old.kind) and not is_admin then
    raise exception 'Only a manager can rename a cert.' using errcode = '42501';
  end if;

  -- Only the server sets or clears a held date.
  new.typed_expiration := old.typed_expiration;

  if new.expiration_date is distinct from old.expiration_date or new.issued_date is distinct from old.issued_date then
    if not is_admin then
      raise exception 'Only a manager can change a date by hand. Upload a photo of the new cert instead.'
        using errcode = '42501';
    end if;
    if new.expiration_date is distinct from old.expiration_date then
      if new.expiration_date is not null and (old.expiration_date is null or new.expiration_date > old.expiration_date) then
        -- Later than what's on file: held until a cert photo shows it.
        new.typed_expiration := new.expiration_date;
        new.expiration_date := old.expiration_date;
        new.issued_date := old.issued_date;
        new.renewed_without_proof := old.renewed_without_proof;
        new.last_upload_id := old.last_upload_id;
        new.pending_until := old.pending_until;
      else
        -- Earlier (or cleared): stricter, so it applies. No photo backs it.
        new.typed_expiration := null;
        new.renewed_without_proof := true;
        new.last_upload_id := null;
        new.pending_until := null;
      end if;
    else
      new.renewed_without_proof := old.renewed_without_proof;
      new.last_upload_id := old.last_upload_id;
      new.pending_until := old.pending_until;
    end if;
  else
    new.renewed_without_proof := old.renewed_without_proof;
    new.last_upload_id := old.last_upload_id;
    new.pending_until := old.pending_until;
  end if;
  new.waiting_upload_id := old.waiting_upload_id;
  return new;
end $$;

-- The status view carries the new column (views don't inherit).
create or replace view public.saas_compliance_items_with_status
with (security_invoker = true) as
SELECT id, company_id, parent_type, parent_id, kind, title, issued_date,
  expiration_date, reminder_days, responsible_person, notes, created_at, updated_at,
  CASE
    WHEN expiration_date IS NULL THEN 'none'
    WHEN expiration_date < (now() AT TIME ZONE 'America/Chicago')::date THEN 'expired'
    WHEN expiration_date <= ((now() AT TIME ZONE 'America/Chicago')::date
         + ((reminder_days || ' days')::interval)) THEN 'expiring'
    ELSE 'valid'
  END AS status,
  renewed_without_proof,
  pending_until,
  waiting_upload_id,
  last_upload_id,
  typed_expiration
FROM saas_compliance_items ci;
