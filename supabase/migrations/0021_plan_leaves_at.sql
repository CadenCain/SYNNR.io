-- When a planned job is supposed to leave (2026-11-03). Past that time with
-- no load-out that rolled, the board shows it red: nobody scanned it out.
-- That's how a manager knows the app isn't being used, without a babysitter.
alter table saas_loadout_plans add column if not exists leaves_at timestamptz;
