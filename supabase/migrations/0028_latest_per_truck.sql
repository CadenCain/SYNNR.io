-- Each truck's newest load-out and newest check-in, however long ago.
-- The board used to read the company's newest 300 load-outs and work it out:
-- a big shop (36 trucks, a load-out a day each) pushes a truck that's been
-- out on a job for a week past 300, and the board called it "Ready to load".
--
-- security_invoker: the views read the tables as the signed-in person, so
-- the tables' own row security still decides what they see.

create or replace view public.saas_loadout_latest with (security_invoker = true) as
select distinct on (company_id, unit_id)
  id, company_id, unit_id, finished_at, scanned_by, verdict, reasons, pieces, not_scanned
from public.saas_loadout_scans
where unit_id is not null
order by company_id, unit_id, finished_at desc;

create or replace view public.saas_return_latest with (security_invoker = true) as
select distinct on (company_id, unit_id)
  id, company_id, unit_id, finished_at, returned_by
from public.saas_returns
where unit_id is not null
order by company_id, unit_id, finished_at desc;

revoke all on public.saas_loadout_latest, public.saas_return_latest from anon;
grant select on public.saas_loadout_latest, public.saas_return_latest to authenticated;
