-- 0035 Each yard keeps its own clock (2026-11-09).
--
-- Every time on every screen was shown in Central with no zone on it. A yard
-- in Hobbs, NM runs on Mountain time, so a 5:10 AM load-out there read
-- 6:10 AM on the operator's proof link, after the truck had already reached
-- his pad. A yard now has a time zone, picked by a manager from a short list
-- of US zones. Central stays the default, so every existing yard reads the
-- same as before.
--
-- No new table: saas_yards keeps its policies (members read, managers write).
-- The list here must match YARD_ZONES in lib/saas/format.ts.

alter table public.saas_yards add column if not exists time_zone text not null default 'America/Chicago';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'saas_yards_time_zone_check') then
    alter table public.saas_yards add constraint saas_yards_time_zone_check
      check (time_zone in (
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Phoenix',
        'America/Los_Angeles',
        'America/Anchorage'
      ));
  end if;
end $$;
