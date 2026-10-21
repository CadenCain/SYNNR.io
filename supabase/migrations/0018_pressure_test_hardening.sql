-- Pressure test, 2026-10-20. Holes a hand could use to roll iron the records
-- say shouldn't go, or to muddy the record, closed in the database so going
-- around the app's screens doesn't get around them.
--
-- 1. Renaming iron or changing what kind it is: managers only (like serials).
--    A hand could rename a good spare "Quad BOP stack" and fill the BOP line
--    on the kit while the real one, out of test, rode along "taken off".
-- 2. Out on a job and checked in (out_since, out_loadout_id, out_alerted_at,
--    returned_at, returned_by) are set only by a load-out or a check-in on the
--    server, never by a phone writing to the table.
-- 3. One save, one record: a load-out or check-in the phone resends after
--    losing signal (the first one already landed) can't make a second record.

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
     or new.returned_at is distinct from old.returned_at or new.returned_by is distinct from old.returned_by then
    raise exception 'Out on a job and checked in are set by a load-out or a check-in.' using errcode = '42501';
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

-- A piece added from a phone starts in the yard's records, not out on a job.
create or replace function saas_assets_insert_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  new.out_since := null; new.out_loadout_id := null; new.out_alerted_at := null;
  new.returned_at := null; new.returned_by := null;
  return new;
end $$;
drop trigger if exists saas_assets_insert_guard on saas_assets;
create trigger saas_assets_insert_guard before insert on saas_assets
  for each row execute function saas_assets_insert_guard();

-- One save, one record. The phone sends the time the load-out (or check-in)
-- started with every try, so a resend matches the first.
delete from saas_returns r using saas_returns k
  where r.returned_by_user is not null and r.company_id = k.company_id and r.returned_by_user = k.returned_by_user
    and r.unit_id is not distinct from k.unit_id and r.started_at = k.started_at and r.finished_at > k.finished_at;
create unique index if not exists saas_loadout_scans_one_save
  on saas_loadout_scans (company_id, scanned_by_user, unit_id, started_at) where scanned_by_user is not null;
create unique index if not exists saas_returns_one_save
  on saas_returns (company_id, returned_by_user, unit_id, started_at) nulls not distinct where returned_by_user is not null;
