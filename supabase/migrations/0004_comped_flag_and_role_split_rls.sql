-- Yard-entitlement + roles spec (owner's decisions, 2026-08-19). Applied live
-- the same day; mirrored here for source-of-truth. See docs/spec — hard cap:
-- checkout quantity is a paid allowance, yards conform to it, and the role
-- matrix says members do the daily work while admins destroy.

alter table public.saas_companies add column if not exists comped boolean not null default false;

-- units: was admin ALL → member add/update, admin delete
drop policy if exists saas_units_write on public.saas_units;
create policy saas_units_member_insert on public.saas_units for insert
  with check (company_id in (select saas_user_company_ids()));
create policy saas_units_member_update on public.saas_units for update
  using (company_id in (select saas_user_company_ids()))
  with check (company_id in (select saas_user_company_ids()));
create policy saas_units_admin_delete on public.saas_units for delete
  using (saas_is_company_admin(company_id));

-- assets / compliance items / crew: was member ALL → delete becomes admin
drop policy if exists saas_assets_write on public.saas_assets;
create policy saas_assets_member_insert on public.saas_assets for insert
  with check (company_id in (select saas_user_company_ids()));
create policy saas_assets_member_update on public.saas_assets for update
  using (company_id in (select saas_user_company_ids()))
  with check (company_id in (select saas_user_company_ids()));
create policy saas_assets_admin_delete on public.saas_assets for delete
  using (saas_is_company_admin(company_id));

drop policy if exists saas_ci_write on public.saas_compliance_items;
create policy saas_ci_member_insert on public.saas_compliance_items for insert
  with check (company_id in (select saas_user_company_ids()));
create policy saas_ci_member_update on public.saas_compliance_items for update
  using (company_id in (select saas_user_company_ids()))
  with check (company_id in (select saas_user_company_ids()));
create policy saas_ci_admin_delete on public.saas_compliance_items for delete
  using (saas_is_company_admin(company_id));

drop policy if exists saas_crew_write on public.saas_crew_members;
create policy saas_crew_member_insert on public.saas_crew_members for insert
  with check (company_id in (select saas_user_company_ids()));
create policy saas_crew_member_update on public.saas_crew_members for update
  using (company_id in (select saas_user_company_ids()))
  with check (company_id in (select saas_user_company_ids()));
create policy saas_crew_admin_delete on public.saas_crew_members for delete
  using (saas_is_company_admin(company_id));

-- proofs: create stays member, revoke/delete become admin
drop policy if exists saas_proofs_write on public.saas_readiness_proofs;
create policy saas_proofs_member_insert on public.saas_readiness_proofs for insert
  with check (company_id in (select saas_user_company_ids()));
create policy saas_proofs_admin_update on public.saas_readiness_proofs for update
  using (saas_is_company_admin(company_id))
  with check (saas_is_company_admin(company_id));
create policy saas_proofs_admin_delete on public.saas_readiness_proofs for delete
  using (saas_is_company_admin(company_id));

update public.saas_companies set comped = true where name in ('renegade', 'WILDCAT');
