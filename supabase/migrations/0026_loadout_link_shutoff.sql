-- Shut off a load-out's proof link (2026-11-09). Every load-out makes a link
-- for the operator (/l/<token>) showing the iron, certs, names, and the photo
-- of the truck. A link sent to the wrong person has to be stoppable. The
-- load-out record itself never changes, so the shut-off lives here.
create table if not exists saas_loadout_link_offs (
  loadout_id uuid primary key references saas_loadout_scans(id) on delete cascade,
  company_id uuid not null references saas_companies(id) on delete cascade,
  off_at timestamptz not null default now(),
  off_by text
);
alter table saas_loadout_link_offs enable row level security;
drop policy if exists saas_loadout_link_offs_select on saas_loadout_link_offs;
create policy saas_loadout_link_offs_select on saas_loadout_link_offs for select
  using (company_id in (select saas_user_company_ids()));
-- Written only by the server (a manager's action).
revoke insert, update, delete, truncate on saas_loadout_link_offs from anon, authenticated;
