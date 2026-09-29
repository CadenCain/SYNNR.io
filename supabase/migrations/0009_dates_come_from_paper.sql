-- 0009: Dates come from paper. (Yard-manager audit, 2026-09-28)
--
-- The rule a yard manager actually wants: a hand can't make a cert current by
-- typing. Before this, any logged-in member could, straight from the browser
-- with their own session:
--   · change any expiration date (the app flagged it, the API didn't)
--   · insert a "ready" readiness-check record and its lines (forged proof)
--   · insert lines into the yard feed
--   · overwrite or delete proof photos
--   · put red-tagged gear back in service, or mark a hand inactive
-- The app's own screens mostly behaved. The database didn't, and the database
-- is the only wall a phone with dev tools can't walk around.
--
-- After this:
--   · Members can't type or change a date. Dates change through the server's
--     photo-upload path (service role), which reads the photo and either
--     applies it or parks it for a manager. Managers can still type dates for
--     setup and corrections; a changed date wears renewed_without_proof.
--   · Readiness checks, their lines, and the feed are written by the server
--     only, and never edited.
--   · Proof photos can't be overwritten; only a manager can delete one.
--   · Red tags come off, and hands go inactive, only by a manager. So do
--     the fields a cert photo is checked against: a hand's name, a serial or
--     unit number, a cert's title. Gear status changes, gear moves, and crew
--     assignments log themselves to the feed no matter which client made them.

-- ── Who did it (feed attribution from inside the database) ──────────────
create or replace function public.saas_actor_name()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    split_part(u.email, '@', 1)
  )
  from auth.users u where u.id = auth.uid()
$$;

-- ── The upload ledger ───────────────────────────────────────────────────
create table if not exists public.saas_cert_uploads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  item_id uuid not null references public.saas_compliance_items(id) on delete cascade,
  uploaded_by uuid,
  uploaded_by_name text,
  uploaded_by_role text,                    -- owner | admin | member | crew_link
  created_at timestamptz not null default now(),
  storage_path text not null,
  content_type text,
  sha256 text not null,
  evidence text not null default 'cert' check (evidence in ('cert', 'temporary')),
  claimed_expiration date,
  claimed_issued date,
  prev_expiration date,
  read_ok boolean not null default false,   -- the server managed to read the photo
  read_dates text[] not null default '{}',
  read_excerpt text,
  checks jsonb not null default '[]'::jsonb, -- [{key, label, ok, detail}]
  flags text[] not null default '{}',
  verdict text not null check (verdict in ('verified', 'needs_review')),
  status text not null check (status in ('applied', 'waiting', 'rejected', 'superseded')),
  pending_until date,                       -- temporary evidence deadline
  applied_at timestamptz,
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_note text
);
create index if not exists saas_cu_company_status on public.saas_cert_uploads (company_id, status);
create index if not exists saas_cu_item on public.saas_cert_uploads (item_id, created_at desc);
create index if not exists saas_cu_hash on public.saas_cert_uploads (company_id, sha256);

alter table public.saas_cert_uploads enable row level security;
drop policy if exists saas_cu_select on public.saas_cert_uploads;
create policy saas_cu_select on public.saas_cert_uploads for select
  using (company_id in (select saas_user_company_ids()));
-- No insert/update/delete policies: the server writes this table, nobody else.

-- What was uploaded and what the software found can never change. Only the
-- review outcome moves, and only forward.
create or replace function public.saas_cert_uploads_guard()
returns trigger language plpgsql as $$
begin
  if new.company_id <> old.company_id or new.item_id <> old.item_id
     or new.storage_path <> old.storage_path or new.sha256 <> old.sha256
     or new.created_at <> old.created_at or new.evidence <> old.evidence
     or new.claimed_expiration is distinct from old.claimed_expiration
     or new.claimed_issued is distinct from old.claimed_issued
     or new.prev_expiration is distinct from old.prev_expiration
     or new.uploaded_by is distinct from old.uploaded_by
     or new.uploaded_by_name is distinct from old.uploaded_by_name
     or new.read_ok <> old.read_ok or new.read_dates <> old.read_dates
     or new.read_excerpt is distinct from old.read_excerpt
     or new.checks <> old.checks or new.flags <> old.flags or new.verdict <> old.verdict then
    raise exception 'upload evidence is permanent';
  end if;
  if old.status in ('rejected', 'superseded') and new.status <> old.status then
    raise exception 'a closed upload stays closed';
  end if;
  if old.status = 'applied' and new.status not in ('applied', 'superseded') then
    raise exception 'an applied upload can only be superseded';
  end if;
  return new;
end $$;
drop trigger if exists saas_cert_uploads_guard on public.saas_cert_uploads;
create trigger saas_cert_uploads_guard before update on public.saas_cert_uploads
  for each row execute function public.saas_cert_uploads_guard();

-- ── Compliance items: server-owned columns + the date wall ──────────────
alter table public.saas_compliance_items add column if not exists pending_until date;
alter table public.saas_compliance_items add column if not exists waiting_upload_id uuid;
alter table public.saas_compliance_items add column if not exists last_upload_id uuid;

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
    return new;
  end if;

  if new.company_id <> old.company_id or new.parent_type <> old.parent_type or new.parent_id <> old.parent_id then
    raise exception 'A cert can''t be moved to different gear or a different hand.' using errcode = '42501';
  end if;
  -- The photo check reads the title for what kind of paper this is, so a
  -- hand renaming "BOP test" to match a lubricator cert is the same trick.
  if (new.title is distinct from old.title or new.kind is distinct from old.kind) and not is_admin then
    raise exception 'Only a manager can rename a cert.' using errcode = '42501';
  end if;

  if new.expiration_date is distinct from old.expiration_date or new.issued_date is distinct from old.issued_date then
    if not is_admin then
      raise exception 'Only a manager can change a date by hand. Upload a photo of the new cert instead.'
        using errcode = '42501';
    end if;
    -- A manager typing a date is allowed, and it's marked: no photo backs it.
    if new.expiration_date is distinct from old.expiration_date then
      new.renewed_without_proof := true;
      new.last_upload_id := null;
      new.pending_until := null;
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
drop trigger if exists saas_ci_guard on public.saas_compliance_items;
create trigger saas_ci_guard before insert or update on public.saas_compliance_items
  for each row execute function public.saas_ci_guard();

-- The status view carries the new columns (views don't inherit).
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
  last_upload_id
FROM saas_compliance_items ci;

-- ── Gear: red tags come off by a manager; changes log themselves ────────
create or replace function public.saas_assets_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  old_unit text; new_unit text;
begin
  if auth.uid() is null then return new; end if;
  -- The serial is what a cert photo gets matched against.
  if new.identifier is distinct from old.identifier then
    if not saas_is_company_admin(new.company_id) then
      raise exception 'Only a manager can change a serial number.' using errcode = '42501';
    end if;
    insert into saas_events (company_id, kind, message, unit_id, actor)
    values (new.company_id, 'asset_edited',
      format('%s serial changed: %s → %s', new.name, coalesce(old.identifier, 'none'), coalesce(new.identifier, 'none')),
      coalesce(new.unit_id, old.unit_id), saas_actor_name());
  end if;
  if new.status is distinct from old.status then
    if old.status = 'out_of_service' and not saas_is_company_admin(new.company_id) then
      raise exception 'Only a manager can put red-tagged gear back in service.' using errcode = '42501';
    end if;
    insert into saas_events (company_id, kind, message, unit_id, actor)
    values (new.company_id, 'asset_status',
      format('%s marked %s (was %s)', new.name, replace(new.status, '_', ' '), replace(old.status, '_', ' ')),
      coalesce(new.unit_id, old.unit_id), saas_actor_name());
  end if;
  if new.unit_id is distinct from old.unit_id then
    select name into old_unit from saas_units where id = old.unit_id;
    select name into new_unit from saas_units where id = new.unit_id;
    insert into saas_events (company_id, kind, message, unit_id, actor)
    values (new.company_id, 'asset_moved',
      format('%s moved from %s to %s', new.name, coalesce(old_unit, 'the yard'), coalesce(new_unit, 'the yard')),
      coalesce(new.unit_id, old.unit_id), saas_actor_name());
  end if;
  return new;
end $$;
drop trigger if exists saas_assets_guard on public.saas_assets;
create trigger saas_assets_guard before update on public.saas_assets
  for each row execute function public.saas_assets_guard();

-- ── Trucks: the unit number / VIN is matched against DOT paper ────────
create or replace function public.saas_units_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.identifier is distinct from old.identifier then
    if not saas_is_company_admin(new.company_id) then
      raise exception 'Only a manager can change a unit number.' using errcode = '42501';
    end if;
    insert into saas_events (company_id, kind, message, unit_id, actor)
    values (new.company_id, 'unit_edited',
      format('%s unit number changed: %s → %s', new.name, coalesce(old.identifier, 'none'), coalesce(new.identifier, 'none')),
      new.id, saas_actor_name());
  end if;
  return new;
end $$;
drop trigger if exists saas_units_guard on public.saas_units;
create trigger saas_units_guard before update on public.saas_units
  for each row execute function public.saas_units_guard();

-- ── Crew: only a manager renames a hand or marks one inactive ──────────
create or replace function public.saas_crew_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  -- A card photo is matched against this name.
  if new.name is distinct from old.name then
    if not saas_is_company_admin(new.company_id) then
      raise exception 'Only a manager can change a hand''s name.' using errcode = '42501';
    end if;
    insert into saas_events (company_id, kind, message, actor)
    values (new.company_id, 'crew_edited', format('%s renamed to %s', old.name, new.name), saas_actor_name());
  end if;
  if new.status is distinct from old.status then
    if not saas_is_company_admin(new.company_id) then
      raise exception 'Only a manager can change whether a hand is active.' using errcode = '42501';
    end if;
    insert into saas_events (company_id, kind, message, actor)
    values (new.company_id, 'crew_status', format('%s marked %s', new.name, new.status), saas_actor_name());
  end if;
  return new;
end $$;
drop trigger if exists saas_crew_guard on public.saas_crew_members;
create trigger saas_crew_guard before update on public.saas_crew_members
  for each row execute function public.saas_crew_guard();

-- ── Crew on trucks: every change lands in the feed ─────────────────────
create or replace function public.saas_unit_crew_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r record; hand text; truck text;
begin
  if auth.uid() is null then return null; end if;
  if tg_op = 'INSERT' then r := new; else r := old; end if;
  select name into hand from saas_crew_members where id = r.crew_member_id;
  select name into truck from saas_units where id = r.unit_id;
  insert into saas_events (company_id, kind, message, unit_id, actor)
  values (r.company_id, 'crew_assignment',
    case when tg_op = 'INSERT' then format('%s put on %s', coalesce(hand, 'A hand'), coalesce(truck, 'a truck'))
         else format('%s taken off %s', coalesce(hand, 'A hand'), coalesce(truck, 'a truck')) end,
    r.unit_id, saas_actor_name());
  return null;
end $$;
drop trigger if exists saas_unit_crew_log on public.saas_unit_crew;
create trigger saas_unit_crew_log after insert or delete on public.saas_unit_crew
  for each row execute function public.saas_unit_crew_log();

-- ── Feed: server-written only ───────────────────────────────────────────
drop policy if exists saas_ev_write on public.saas_events;

-- ── Readiness checks: server-written only, never edited ────────────────
drop policy if exists saas_dc_insert on public.saas_dispatch_checks;
drop policy if exists saas_dci_insert on public.saas_dispatch_check_items;
drop policy if exists saas_dcc_insert on public.saas_dispatch_check_crew;
drop trigger if exists saas_dispatch_checks_no_update on public.saas_dispatch_checks;
create trigger saas_dispatch_checks_no_update before update on public.saas_dispatch_checks
  for each row execute function public.saas_block_update();
drop trigger if exists saas_dispatch_check_items_no_update on public.saas_dispatch_check_items;
create trigger saas_dispatch_check_items_no_update before update on public.saas_dispatch_check_items
  for each row execute function public.saas_block_update();

-- ── Photos: add, never overwrite; only a manager deletes ────────────────
drop policy if exists saas_attach_write on public.saas_attachments;
drop policy if exists saas_attach_insert on public.saas_attachments;
create policy saas_attach_insert on public.saas_attachments for insert
  with check (company_id in (select saas_user_company_ids())
              and storage_path like company_id::text || '/%');
drop policy if exists saas_attach_admin_delete on public.saas_attachments;
create policy saas_attach_admin_delete on public.saas_attachments for delete
  using (saas_is_company_admin(company_id));

drop policy if exists saas_proofs_update on storage.objects;
drop policy if exists saas_proofs_delete on storage.objects;
create policy saas_proofs_delete on storage.objects for delete
  using (bucket_id = 'proofs' and saas_is_company_admin(((storage.foldername(name))[1])::uuid));

-- ── Doc requests: closing one out is a manager's review ────────────────
drop policy if exists "doc_requests member update" on public.saas_doc_requests;
drop policy if exists saas_doc_requests_admin_update on public.saas_doc_requests;
create policy saas_doc_requests_admin_update on public.saas_doc_requests for update
  using (saas_is_company_admin(company_id))
  with check (saas_is_company_admin(company_id));

-- ── The manager's switches ──────────────────────────────────────────────
alter table public.saas_enforcement_settings
  add column if not exists hand_uploads_need_ok boolean not null default false;
alter table public.saas_enforcement_settings
  add column if not exists allow_cert_on_the_way boolean not null default true;
