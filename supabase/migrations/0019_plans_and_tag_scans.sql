-- Planned load-outs and scan-only yards, 2026-10-21.
--
-- 1. A manager plans a truck's next job: the packages it needs, any extra
--    pieces, a short note. The hand at the truck sees it and can add to the
--    list but not take anything off. The plan is used up when the truck rolls.
-- 2. A yard can require every piece of pressure iron (and anything on the
--    list) to be scanned off its tag, never checked by hand. The server checks
--    each scan against the piece's tag before counting it.
-- 3. tag_seen_at: the last time a piece was scanned off its tag, so a manager
--    can see what still needs a tag before turning scan-only on.

create table if not exists saas_loadout_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references saas_companies(id) on delete cascade,
  unit_id uuid not null references saas_units(id) on delete cascade,
  package_ids uuid[] not null default '{}',
  lines jsonb not null default '[]'::jsonb,
  note text check (note is null or length(note) <= 120),
  planned_by text,
  planned_by_user uuid,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_loadout_id uuid references saas_loadout_scans(id) on delete set null
);
-- One open plan per truck.
create unique index if not exists saas_loadout_plans_open on saas_loadout_plans (company_id, unit_id) where used_at is null;
alter table saas_loadout_plans enable row level security;
drop policy if exists saas_loadout_plans_select on saas_loadout_plans;
create policy saas_loadout_plans_select on saas_loadout_plans for select
  using (company_id in (select saas_user_company_ids()));
drop policy if exists saas_loadout_plans_write on saas_loadout_plans;
create policy saas_loadout_plans_write on saas_loadout_plans for all
  using (saas_is_company_admin(company_id)) with check (saas_is_company_admin(company_id));

alter table saas_loadout_scans add column if not exists plan jsonb;
alter table saas_enforcement_settings add column if not exists require_tag_scan boolean not null default false;
alter table saas_assets add column if not exists tag_seen_at timestamptz;

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
     or new.tag_seen_at is distinct from old.tag_seen_at then
    raise exception 'Out on a job, checked in, and tag scans are set by a load-out or a check-in.' using errcode = '42501';
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
  if new.nfc_uid is not null and not saas_is_company_admin(new.company_id)
     and exists (select 1 from saas_enforcement_settings s where s.company_id = new.company_id and s.require_tag_scan) then
    new.nfc_uid := null;
  end if;
  return new;
end $$;
