-- 0012 What a truck has to leave with, and a load-out record nobody can edit.
--
-- A load-out checks the iron going on a truck against a list. The list comes
-- from three places: the truck's own default kit, reusable packages for a
-- kind of job ("Standard Coil Package"), and quick one-off lines a hand adds
-- for today. Kits and packages live here; quick lines live only on the
-- load-out record.
--
-- A line is a kind of piece and how many ("Plug valve 2-inch", 4). Any piece
-- whose name matches fills it, so a package doesn't go stale when a valve
-- goes out for recert and another one takes its place.

create table if not exists public.saas_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- Set: this is that truck's default kit (one per truck). Null: a package.
  unit_id uuid references public.saas_units(id) on delete cascade,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists saas_packages_one_kit_per_truck on public.saas_packages (unit_id) where unit_id is not null;
create index if not exists saas_packages_company_idx on public.saas_packages (company_id);

create table if not exists public.saas_package_lines (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.saas_packages(id) on delete cascade,
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  qty integer not null default 1 check (qty between 1 and 99),
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists saas_package_lines_package_idx on public.saas_package_lines (package_id, sort);

-- Everyone in the company reads them (a hand needs the list at the truck).
-- Only a manager changes them.
alter table public.saas_packages enable row level security;
drop policy if exists saas_packages_select on public.saas_packages;
create policy saas_packages_select on public.saas_packages
  for select using (company_id in (select saas_user_company_ids()));
drop policy if exists saas_packages_write on public.saas_packages;
create policy saas_packages_write on public.saas_packages
  for all using (saas_is_company_admin(company_id)) with check (saas_is_company_admin(company_id));

alter table public.saas_package_lines enable row level security;
drop policy if exists saas_package_lines_select on public.saas_package_lines;
create policy saas_package_lines_select on public.saas_package_lines
  for select using (company_id in (select saas_user_company_ids()));
drop policy if exists saas_package_lines_write on public.saas_package_lines;
create policy saas_package_lines_write on public.saas_package_lines
  for all using (saas_is_company_admin(company_id)) with check (saas_is_company_admin(company_id));

-- A kit's truck and a line's package have to be the company's own.
create or replace function public.saas_packages_same_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'saas_packages' then
    if new.unit_id is not null and not exists (
      select 1 from saas_units u where u.id = new.unit_id and u.company_id = new.company_id
    ) then raise exception 'That truck isn''t in this company.' using errcode = '42501'; end if;
  else
    if not exists (
      select 1 from saas_packages p where p.id = new.package_id and p.company_id = new.company_id
    ) then raise exception 'That package isn''t in this company.' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
drop trigger if exists saas_packages_same_company on public.saas_packages;
create trigger saas_packages_same_company before insert or update on public.saas_packages
  for each row execute function public.saas_packages_same_company();
drop trigger if exists saas_package_lines_same_company on public.saas_package_lines;
create trigger saas_package_lines_same_company before insert or update on public.saas_package_lines
  for each row execute function public.saas_packages_same_company();

-- The load-out record: what the truck had to carry, what got scanned on (each
-- piece with who and when), and the answer. READY or NOT READY is worked out
-- on the server from the records, never sent by the phone.
alter table public.saas_loadout_scans add column if not exists verdict text check (verdict in ('ready', 'not_ready'));
alter table public.saas_loadout_scans add column if not exists reasons jsonb not null default '[]'::jsonb;
-- [{label, qty, source: "kit"|"package"|"quick", package?, filled: [{asset_id, name, serial}]}]
alter table public.saas_loadout_scans add column if not exists lines jsonb not null default '[]'::jsonb;
alter table public.saas_loadout_scans add column if not exists packages jsonb not null default '[]'::jsonb;
alter table public.saas_loadout_scans add column if not exists yard_id uuid references public.saas_yards(id) on delete set null;
alter table public.saas_loadout_scans add column if not exists scanned_by_user uuid;
alter table public.saas_loadout_scans add column if not exists proof_token text not null default replace(gen_random_uuid()::text, '-', '');
create unique index if not exists saas_loadout_scans_proof_token_key on public.saas_loadout_scans (proof_token);
create index if not exists saas_loadout_scans_company_idx on public.saas_loadout_scans (company_id, finished_at desc);

-- Only the server writes a load-out (it checks the records first), so a
-- session can't insert a READY it didn't earn.
drop policy if exists saas_loadout_scans_insert on public.saas_loadout_scans;

-- Written once. Nobody edits it, not even the server.
create or replace function public.saas_loadout_scans_locked()
returns trigger language plpgsql as $$
begin
  raise exception 'A load-out record can''t be edited.' using errcode = '42501';
end $$;
drop trigger if exists saas_loadout_scans_locked on public.saas_loadout_scans;
create trigger saas_loadout_scans_locked before update on public.saas_loadout_scans
  for each row execute function public.saas_loadout_scans_locked();

-- A NOT READY truck rolls only on a manager's override: name, reason, time.
-- Its own row, so the load-out record itself never changes. One per load-out.
create table if not exists public.saas_loadout_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.saas_companies(id) on delete cascade,
  loadout_id uuid not null unique references public.saas_loadout_scans(id) on delete cascade,
  by_name text not null,
  by_user uuid,
  reason text not null check (char_length(reason) >= 10),
  created_at timestamptz not null default now()
);
alter table public.saas_loadout_overrides enable row level security;
drop policy if exists saas_loadout_overrides_select on public.saas_loadout_overrides;
create policy saas_loadout_overrides_select on public.saas_loadout_overrides
  for select using (company_id in (select saas_user_company_ids()));
-- No insert/update/delete policy: only the server writes one, after checking
-- the person is a manager.
drop trigger if exists saas_loadout_overrides_locked on public.saas_loadout_overrides;
create trigger saas_loadout_overrides_locked before update on public.saas_loadout_overrides
  for each row execute function public.saas_loadout_scans_locked();
