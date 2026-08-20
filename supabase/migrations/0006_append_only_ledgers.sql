-- 0006: Tamper-guard the historical ledgers.
--
-- saas_alerts_sent and saas_events already deny ALL session writes (RLS: no
-- insert/update/delete policies — only the service role writes). This adds a
-- database-level guarantee that rows are never EDITED by anyone, service
-- role included: there is no legitimate UPDATE path to either table, so any
-- UPDATE is by definition a bug or tampering, and now it throws.
--
-- DELETE is deliberately NOT blocked: clearAlertLog removes an item's rows
-- when its expiration renews — that's the alert re-arm mechanism (dedupe is
-- per item, not per cycle). It runs service-role-only and item-scoped; RLS
-- already keeps every session away from it.

create or replace function public.saas_block_update()
returns trigger language plpgsql as $$
begin
  raise exception 'ledger % is append-only — rows are never edited', tg_table_name;
end $$;

drop trigger if exists saas_alerts_sent_no_update on public.saas_alerts_sent;
create trigger saas_alerts_sent_no_update
  before update on public.saas_alerts_sent
  for each row execute function public.saas_block_update();

drop trigger if exists saas_events_no_update on public.saas_events;
create trigger saas_events_no_update
  before update on public.saas_events
  for each row execute function public.saas_block_update();
