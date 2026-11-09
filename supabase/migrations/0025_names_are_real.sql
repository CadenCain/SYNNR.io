-- Names can't be forged (2026-11-09, from the security pressure test).
-- 1. A session writing a piece's "scanned by" / "last seen by" gets the real
--    signed-in person's name, whatever it sent. (Load-outs and check-ins
--    already send that name; the server's own writes are untouched.)
-- 2. The locked records (load-outs, check-ins, overrides) are written only by
--    the server: take away the table write grants sessions never use, so a
--    future policy mistake can't open them up.

create or replace function saas_assets_name_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' or new.scanned_by is distinct from old.scanned_by then
    if new.scanned_by is not null then new.scanned_by := coalesce(saas_actor_name(), new.scanned_by); end if;
  end if;
  if tg_op = 'INSERT' or new.last_seen_by is distinct from old.last_seen_by then
    if new.last_seen_by is not null then new.last_seen_by := coalesce(saas_actor_name(), new.last_seen_by); end if;
  end if;
  return new;
end $$;

drop trigger if exists saas_assets_a_name_guard on saas_assets;
-- Runs before the other guards (alphabetical among BEFORE triggers): "a" < "g" < "i".
create trigger saas_assets_a_name_guard before insert or update on saas_assets
  for each row execute function saas_assets_name_guard();

revoke insert, update, delete, truncate on saas_loadout_scans, saas_returns, saas_loadout_overrides from anon, authenticated;
