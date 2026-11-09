-- Which job a load-out was for (2026-11-09). The operator's proof link said
-- "CT-03 load-out" but not which well. A manager can put the job on the plan;
-- the hand can type it at the start of a load-out. It's kept on the record.
alter table saas_loadout_plans add column if not exists job text;
alter table saas_loadout_plans drop constraint if exists saas_loadout_plans_job_check;
alter table saas_loadout_plans add constraint saas_loadout_plans_job_check check (job is null or length(job) <= 120);
alter table saas_loadout_scans add column if not exists job text;
