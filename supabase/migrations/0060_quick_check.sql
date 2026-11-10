-- 0060 Quick check (2026-11-09).
--
-- What yards told us: the everyday pain isn't an expired cert (that's rare),
-- it's a truck leaving without the right gear and a hotshot to fix it. And a
-- check that takes longer than a group text doesn't get used. So the default
-- check is now the quick one: the hand picks the truck, taps "On truck" on a
-- short list (5 to 8 things), takes one photo of the loaded truck, and taps
-- Ready. Name and time go on a locked record, the same as before.
--
-- 1. saas_enforcement_settings.quick_check: null or true is the quick check;
--    false is the full check (every piece scanned, its tests and paper
--    checked). A manager switches it in Settings, Rules.
-- 2. saas_loadout_scans.check_mode: which check made the record ('quick' or
--    'full'; null on records from before this, which were all full). A quick
--    record's lines carry `confirmed` (how many the hand said are on, who,
--    when) and no pieces.

alter table public.saas_enforcement_settings add column if not exists quick_check boolean;

alter table public.saas_loadout_scans add column if not exists check_mode text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'saas_loadout_scans_check_mode_check') then
    alter table public.saas_loadout_scans add constraint saas_loadout_scans_check_mode_check
      check (check_mode is null or check_mode in ('quick', 'full'));
  end if;
end $$;
