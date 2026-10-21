-- 0017 The other half of the yard: iron coming back.
--
-- A load-out that rolls (READY, or NOT READY on a manager's override) puts
-- its pieces "out on a job" until somebody scans them back in. A return
-- (check-in) records who brought what back, when, and where it went: back
-- on the truck (the truck's own kit, parked in the yard) or off into the
-- yard at a rack or spot. A piece out longer than the company's limit
-- (default 7 days) is "out too long": flagged on the board and in one daily
-- email to the managers, not one email per piece.

alter table public.saas_assets add column if not exists out_since timestamptz;
alter table public.saas_assets add column if not exists out_loadout_id uuid references public.saas_loadout_scans(id) on delete set null;
alter table public.saas_assets add column if not exists out_alerted_at timestamptz;
alter table public.saas_assets add column if not exists returned_at timestamptz;
alter table public.saas_assets add column if not exists returned_by text;
create index if not exists saas_assets_out_idx on public.saas_assets (company_id, out_since) where out_since is not null;

-- One row per check-in. Written once by the server, never edited.
create table if not exists public.saas_returns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  yard_id uuid references public.saas_yards(id) on delete set null,
  unit_id uuid references public.saas_units(id) on delete set null,
  unit_name text,
  returned_by text,
  returned_by_user uuid,
  started_at timestamptz,
  finished_at timestamptz not null default now(),
  -- [{asset_id, name, serial, how, at, by, to: "truck"|"yard", rack, out_days, red}]
  pieces jsonb not null default '[]'::jsonb,
  -- [{asset_id, name, serial, outcome: "still_out"|"missing"}]
  not_returned jsonb not null default '[]'::jsonb
);
create index if not exists saas_returns_company_idx on public.saas_returns (company_id, finished_at desc);
create index if not exists saas_returns_unit_idx on public.saas_returns (unit_id, finished_at desc);
alter table public.saas_returns enable row level security;
drop policy if exists saas_returns_select on public.saas_returns;
create policy saas_returns_select on public.saas_returns
  for select using (company_id in (select saas_user_company_ids()));
drop trigger if exists saas_returns_locked on public.saas_returns;
create trigger saas_returns_locked before update on public.saas_returns
  for each row execute function public.saas_loadout_scans_locked();

-- How long iron can be out before it's flagged. A manager's setting.
alter table public.saas_enforcement_settings add column if not exists out_alert_days integer not null default 7
  check (out_alert_days between 1 and 90);
