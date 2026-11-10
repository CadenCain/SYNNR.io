-- 0050 The feed says which piece (2026-11-09).
--
-- saas_assets_guard writes a line to the feed when a piece's status changes
-- or it moves. Two of those lines didn't say enough:
--
-- 1. "Plug valve marked missing (was in service)" didn't say which plug
--    valve. A status line now carries the serial when there is one:
--    "2in 1502 plug valve PV-2207 marked missing (was in service)".
-- 2. A piece flagged missing comes off its truck in the same save, and the
--    feed read "moved from CT-08 to the yard", which is the opposite of what
--    happened. Flagged missing and taken off a truck, it now reads
--    "2in 1502 plug valve PV-2207 didn't come back on CT-08 (flagged
--    missing)", or, when it was a load-out that couldn't find it (its note
--    reads "not found for CT-08 load-out"), "... wasn't found for the CT-08
--    load-out (flagged missing)".
--
-- Only those two lines change. The rest of the function is exactly as
-- migration 0024 left it: the move log, the locks on out/sign-out/redress
-- and tag fields, the manager-only edits, and the other feed lines. The
-- trigger itself (migration 0010) already calls this function, so it isn't
-- touched.

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
      format('%s%s marked %s (was %s)', new.name, coalesce(' ' || new.identifier, ''),
        case new.status when 'out_of_service' then 'red-tagged' else replace(new.status, '_', ' ') end,
        case old.status when 'out_of_service' then 'red-tagged' else replace(old.status, '_', ' ') end),
      coalesce(new.unit_id, old.unit_id), saas_actor_name());
  end if;
  if new.unit_id is distinct from old.unit_id then
    select name into old_unit from saas_units where id = old.unit_id;
    select name into new_unit from saas_units where id = new.unit_id;
    insert into saas_events (company_id, kind, message, unit_id, actor)
    values (new.company_id, 'asset_moved',
      case when new.status = 'missing' and new.unit_id is null and old.unit_id is not null
        then case when coalesce(new.last_seen_where, '') like 'not found for %'
          then format('%s%s wasn''t found for the %s load-out (flagged missing)', new.name, coalesce(' ' || new.identifier, ''), coalesce(old_unit, 'truck''s'))
          else format('%s%s didn''t come back on %s (flagged missing)', new.name, coalesce(' ' || new.identifier, ''), coalesce(old_unit, 'its truck')) end
        else format('%s moved from %s to %s', new.name, coalesce(old_unit, 'the yard'), coalesce(new_unit, 'the yard')) end,
      coalesce(new.unit_id, old.unit_id), saas_actor_name());
  end if;
  return new;
end $$;

