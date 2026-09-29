-- 0010 Equipment first: every piece of iron gets a QR tag, a location
-- history the database keeps by itself, and a way to retire scrapped iron.
--
-- Location history is written by triggers, never by the app, so nobody can
-- skip it or write a move that didn't happen. The app just changes where the
-- iron is; the database records from → to, who, and when.

-- ── QR tags ─────────────────────────────────────────────────────────────
-- The tag on the iron points at /t/<tag_token>. Random, unguessable, and
-- fixed for the life of the asset (a reprinted tag must still scan).
alter table public.saas_assets add column if not exists tag_token text;
update public.saas_assets set tag_token = replace(gen_random_uuid()::text, '-', '') where tag_token is null;
alter table public.saas_assets alter column tag_token set default replace(gen_random_uuid()::text, '-', '');
alter table public.saas_assets alter column tag_token set not null;
create unique index if not exists saas_assets_tag_token_key on public.saas_assets (tag_token);

-- ── Location history ────────────────────────────────────────────────────
create table if not exists public.saas_asset_moves (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  asset_id uuid not null references public.saas_assets(id) on delete cascade,
  from_where text,
  to_where text not null,
  note text,
  actor text,
  created_at timestamptz not null default now()
);
create index if not exists saas_asset_moves_asset_idx on public.saas_asset_moves (asset_id, created_at desc);
alter table public.saas_asset_moves enable row level security;
drop policy if exists saas_asset_moves_select on public.saas_asset_moves;
create policy saas_asset_moves_select on public.saas_asset_moves
  for select using (company_id in (select saas_user_company_ids()));
-- No insert/update/delete policies: only the triggers below write here.

-- "CT-03 · Odessa Yard", "Odessa Yard", or "No location".
create or replace function public.saas_where_label(p_unit uuid, p_yard uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select u.name || coalesce(' · ' || y.name, '') from saas_units u left join saas_yards y on y.id = u.yard_id where u.id = p_unit),
    (select y.name from saas_yards y where y.id = p_yard),
    'No location'
  )
$$;

create or replace function public.saas_asset_added_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into saas_asset_moves (company_id, asset_id, from_where, to_where, note, actor)
  values (new.company_id, new.id, null, saas_where_label(new.unit_id, new.yard_id),
    nullif(trim(coalesce(new.last_seen_where, '')), ''), saas_actor_name());
  return new;
end $$;
drop trigger if exists saas_asset_added_log on public.saas_assets;
create trigger saas_asset_added_log after insert on public.saas_assets
  for each row execute function public.saas_asset_added_log();

-- ── The asset guard, extended ──────────────────────────────────────────
-- Same rules as 0009, plus: the tag never changes; only a manager retires
-- iron or brings it back; every move lands in saas_asset_moves (service-role
-- writes too, so seeded and imported moves have history like any other).
create or replace function public.saas_assets_guard()
returns trigger language plpgsql security definer set search_path = public as $$
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
drop trigger if exists saas_assets_guard on public.saas_assets;
create trigger saas_assets_guard before update on public.saas_assets
  for each row execute function public.saas_assets_guard();

-- Existing iron starts its history where it is today.
insert into public.saas_asset_moves (company_id, asset_id, from_where, to_where, note, actor, created_at)
select a.company_id, a.id, null, public.saas_where_label(a.unit_id, a.yard_id), null, null, a.created_at
from public.saas_assets a
where not exists (select 1 from public.saas_asset_moves m where m.asset_id = a.id);
