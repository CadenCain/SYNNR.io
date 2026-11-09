-- The little skipped steps (2026-11-08). From a wireline yard manager's list
-- of what negligence costs: bent BOP rams from traveling open, tools left
-- loose, and setting tools signed out on a paper sheet with no times and no
-- way to see what's still out.
--
-- 1. Redress after every run: a tool marked redress_each_run comes back from
--    a job reading "Needs redress" (needs_redress_since) and can't go out
--    again until someone taps Redressed. The server sets and clears it.
-- 2. Sign a tool out to a person, not a truck: out_with_user / out_with_name
--    on the piece while it's out, and one row per sign-out in saas_signouts
--    (who took it, when, for what job, who brought it back, when). Replaces
--    the sign-out sheet.
-- 3. Roll checks: up to three taps a manager puts on a job package or a
--    truck kit ("BOP rams closed for travel"). The hand taps each before the
--    load-out saves; a missed one makes the truck NOT READY. What was tapped,
--    by whom and when, is kept on the record (roll_checks).

alter table saas_assets add column if not exists redress_each_run boolean not null default false;
alter table saas_assets add column if not exists needs_redress_since timestamptz;
alter table saas_assets add column if not exists out_with_user uuid;
alter table saas_assets add column if not exists out_with_name text;

alter table saas_packages add column if not exists roll_checks text[] not null default '{}';
alter table saas_packages drop constraint if exists saas_packages_roll_checks_check;
alter table saas_packages add constraint saas_packages_roll_checks_check check (cardinality(roll_checks) <= 3);

alter table saas_loadout_scans add column if not exists roll_checks jsonb;

create table if not exists saas_signouts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references saas_companies(id) on delete cascade,
  asset_id uuid not null references saas_assets(id) on delete cascade,
  asset_name text not null,
  serial text,
  out_user uuid,
  out_name text not null,
  job_note text check (job_note is null or length(job_note) <= 120),
  out_at timestamptz not null default now(),
  back_at timestamptz,
  back_by text,
  back_note text
);
create index if not exists saas_signouts_open on saas_signouts (company_id, asset_id) where back_at is null;
create index if not exists saas_signouts_recent on saas_signouts (company_id, out_at desc);
alter table saas_signouts enable row level security;
drop policy if exists saas_signouts_select on saas_signouts;
create policy saas_signouts_select on saas_signouts for select using (company_id in (select saas_user_company_ids()));
-- Written only by the server.
revoke insert, update, delete, truncate on saas_signouts from anon, authenticated;

create or replace function saas_assets_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  old_unit text; new_unit text;
begin
  if new.unit_id is distinct from old.unit_id or new.yard_id is distinct from old.yard_id
     or (new.last_seen_where is distinct from old.last_seen_where and nullif(trim(coalesce(new.last_seen_where, '')), '') is not null) then
    insert into saas_asset_moves (company_id, asset_id, from_where, to_where, note, actor)
    values (new.company_id, new.id, saas_where_label(old.unit_id, old.yard_id), saas_where_label(new.unit_id, new.yard_id),
      nullif(trim(coalesce(new.last_seen_where, '')), ''), coalesce(saas_actor_name(), new.last_seen_by));
  end if;

  if auth.uid() is null then return new; end if;

  if new.tag_token is distinct from old.tag_token then
    raise exception 'A QR tag can''t be changed.' using errcode = '42501';
  end if;
  if new.out_since is distinct from old.out_since or new.out_loadout_id is distinct from old.out_loadout_id
     or new.out_alerted_at is distinct from old.out_alerted_at
     or new.returned_at is distinct from old.returned_at or new.returned_by is distinct from old.returned_by
     or new.tag_seen_at is distinct from old.tag_seen_at
     or new.out_with_user is distinct from old.out_with_user or new.out_with_name is distinct from old.out_with_name
     or new.needs_redress_since is distinct from old.needs_redress_since then
    raise exception 'Out on a job, signed out, checked in, redress, and tag scans are set by a load-out, a sign-out, or a check-in.' using errcode = '42501';
  end if;
  if new.redress_each_run is distinct from old.redress_each_run and not saas_is_company_admin(new.company_id) then
    raise exception 'Only a manager can change whether a tool gets redressed after every run.' using errcode = '42501';
  end if;
  -- A linked tag is how a scan proves the piece was there. Moving a link off a
  -- piece is a manager's job, and in a scan-only yard so is making one.
  if new.nfc_uid is distinct from old.nfc_uid and not saas_is_company_admin(new.company_id) then
    if old.nfc_uid is not null then
      raise exception 'Only a manager can change which tag a piece is linked to.' using errcode = '42501';
    end if;
    if exists (select 1 from saas_enforcement_settings s where s.company_id = new.company_id and s.require_tag_scan) then
      raise exception 'This yard scans tags only. A manager links new tags.' using errcode = '42501';
    end if;
  end if;
  if new.identifier is distinct from old.identifier then
    if not saas_is_company_admin(new.company_id) then
      raise exception 'Only a manager can change a serial number.' using errcode = '42501';
    end if;
    insert into saas_events (company_id, kind, message, unit_id, actor)
    values (new.company_id, 'asset_edited',
      format('%s serial changed: %s → %s', new.name, coalesce(old.identifier, 'none'), coalesce(new.identifier, 'none')),
      coalesce(new.unit_id, old.unit_id), saas_actor_name());
  end if;
  if new.name is distinct from old.name or new.category is distinct from old.category then
    if not saas_is_company_admin(new.company_id) then
      raise exception 'Only a manager can rename iron or change what kind it is.' using errcode = '42501';
    end if;
    insert into saas_events (company_id, kind, message, unit_id, actor)
    values (new.company_id, 'asset_edited',
      case when new.name is distinct from old.name
        then format('%s renamed to %s', old.name, new.name)
        else format('%s changed from %s to %s', new.name, replace(old.category, '_', ' '), replace(new.category, '_', ' ')) end,
      coalesce(new.unit_id, old.unit_id), saas_actor_name());
  end if;
  if new.status is distinct from old.status then
    if old.status = 'out_of_service' and not saas_is_company_admin(new.company_id) then
      raise exception 'Only a manager can put red-tagged gear back in service.' using errcode = '42501';
    end if;
    if (new.status = 'retired' or old.status = 'retired') and not saas_is_company_admin(new.company_id) then
      raise exception 'Only a manager can retire iron or bring it back.' using errcode = '42501';
    end if;
    insert into saas_events (company_id, kind, message, unit_id, actor)
    values (new.company_id, 'asset_status',
      format('%s marked %s (was %s)', new.name,
        case new.status when 'out_of_service' then 'red-tagged' else replace(new.status, '_', ' ') end,
        case old.status when 'out_of_service' then 'red-tagged' else replace(old.status, '_', ' ') end),
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

create or replace function saas_assets_insert_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  new.out_since := null; new.out_loadout_id := null; new.out_alerted_at := null;
  new.returned_at := null; new.returned_by := null; new.tag_seen_at := null;
  new.out_with_user := null; new.out_with_name := null; new.needs_redress_since := null;
  if new.redress_each_run and not saas_is_company_admin(new.company_id) then
    new.redress_each_run := false;
  end if;
  if new.nfc_uid is not null and not saas_is_company_admin(new.company_id)
     and exists (select 1 from saas_enforcement_settings s where s.company_id = new.company_id and s.require_tag_scan) then
    new.nfc_uid := null;
  end if;
  return new;
end $$;
