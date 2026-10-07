-- 0011 Load-out scans: where the iron actually is gets proven at the truck.
--
-- RollReady doesn't track iron with GPS. It knows where a piece was last
-- logged. A load-out scan makes that log trustworthy: a hand taps each
-- piece's tag as it goes on the truck, so "on CT-03" means someone scanned
-- it onto CT-03 this morning, not that someone typed it in last month.

-- A testing company's NFC tag already on the iron can be linked to the
-- piece by its chip ID (factory-set, can't be changed), so the shop doesn't
-- have to add a second tag.
alter table public.saas_assets add column if not exists nfc_uid text;
create unique index if not exists saas_assets_nfc_uid_key
  on public.saas_assets (company_id, nfc_uid) where nfc_uid is not null;

-- When and how its location was last proven by a scan.
alter table public.saas_assets add column if not exists scanned_at timestamptz;
alter table public.saas_assets add column if not exists scanned_by text;
alter table public.saas_assets add column if not exists scanned_unit_id uuid references public.saas_units(id) on delete set null;

-- One row per load-out. Written once, never edited: what the truck was
-- supposed to carry, what got scanned on, and what didn't.
create table if not exists public.saas_loadout_scans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  unit_id uuid references public.saas_units(id) on delete set null,
  unit_name text not null,
  scanned_by text,
  started_at timestamptz,
  finished_at timestamptz not null default now(),
  expected integer not null default 0,
  scanned integer not null default 0,
  -- [{asset_id, name, serial, how: "nfc"|"qr"|"hand", result, added?}]
  pieces jsonb not null default '[]'::jsonb,
  -- [{asset_id, name, serial, outcome: "left"|"yard"|"missing"}]
  not_scanned jsonb not null default '[]'::jsonb
);
create index if not exists saas_loadout_scans_unit_idx on public.saas_loadout_scans (unit_id, finished_at desc);
alter table public.saas_loadout_scans enable row level security;
drop policy if exists saas_loadout_scans_select on public.saas_loadout_scans;
create policy saas_loadout_scans_select on public.saas_loadout_scans
  for select using (company_id in (select saas_user_company_ids()));
drop policy if exists saas_loadout_scans_insert on public.saas_loadout_scans;
create policy saas_loadout_scans_insert on public.saas_loadout_scans
  for insert with check (company_id in (select saas_user_company_ids()));
-- No update or delete policy: a load-out record can't be changed.

-- Scan stamps come only from a load-out, which runs as the signed-in user;
-- a session can't backdate one.
create or replace function public.saas_assets_scan_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.scanned_at is distinct from old.scanned_at and new.scanned_at is not null
     and new.scanned_at > now() + interval '1 minute' then
    raise exception 'A scan time can''t be in the future.' using errcode = '42501';
  end if;
  if new.scanned_at is distinct from old.scanned_at and new.scanned_at is not null
     and new.scanned_at < now() - interval '1 day' then
    raise exception 'A scan time can''t be backdated.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists saas_assets_scan_guard on public.saas_assets;
create trigger saas_assets_scan_guard before update on public.saas_assets
  for each row execute function public.saas_assets_scan_guard();
