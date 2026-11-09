-- Setting tools a vendor keeps a yard stocked with (Silver Fox in one yard,
-- Baker 20s in another). The yard runs them, puts the used ones aside, and
-- about once a month the vendor picks up the used batch and drops off a
-- ready one. The serials change every batch, so these are counted, not
-- tracked one by one:
--   ready: on the shelf, ready to run
--   used:  ran, waiting on the vendor's pickup (never ready again in here)
--   out:   with someone right now (open rows in saas_tool_outs, the sheet)
-- Every change is a row in saas_tool_stock_log with who and when. Only the
-- server writes any of it, through the functions below, which lock the row
-- so two phones can't take the last one.

create table if not exists saas_tool_stocks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references saas_companies(id) on delete cascade,
  yard_id uuid not null references saas_yards(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  vendor text check (vendor is null or length(vendor) <= 80),
  ready int not null default 0 check (ready between 0 and 999),
  used int not null default 0 check (used between 0 and 999),
  low_at int not null default 2 check (low_at between 0 and 99),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index if not exists saas_tool_stocks_name on saas_tool_stocks (company_id, yard_id, lower(btrim(name))) where archived_at is null;
create index if not exists saas_tool_stocks_company on saas_tool_stocks (company_id);

create table if not exists saas_tool_outs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references saas_companies(id) on delete cascade,
  stock_id uuid not null references saas_tool_stocks(id) on delete cascade,
  out_user uuid,
  out_name text not null,
  qty int not null check (qty between 1 and 20),
  job_note text check (job_note is null or length(job_note) <= 120),
  out_at timestamptz not null default now(),
  out_by text,
  back_at timestamptz,
  back_by text,
  back_used int check (back_used is null or back_used >= 0),
  back_unused int check (back_unused is null or back_unused >= 0),
  request_key text
);
create index if not exists saas_tool_outs_open on saas_tool_outs (company_id, stock_id) where back_at is null;
create index if not exists saas_tool_outs_recent on saas_tool_outs (company_id, out_at desc);
create unique index if not exists saas_tool_outs_key on saas_tool_outs (company_id, request_key) where request_key is not null;

create table if not exists saas_tool_stock_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references saas_companies(id) on delete cascade,
  stock_id uuid not null references saas_tool_stocks(id) on delete cascade,
  kind text not null check (kind in ('added', 'out', 'back', 'vendor', 'count')),
  ready_delta int not null default 0,
  used_delta int not null default 0,
  out_delta int not null default 0,
  note text check (note is null or length(note) <= 200),
  by_name text,
  by_user uuid,
  created_at timestamptz not null default now(),
  request_key text
);
create index if not exists saas_tool_stock_log_recent on saas_tool_stock_log (company_id, stock_id, created_at desc);
create unique index if not exists saas_tool_stock_log_key on saas_tool_stock_log (company_id, request_key) where request_key is not null;

alter table saas_tool_stocks enable row level security;
alter table saas_tool_outs enable row level security;
alter table saas_tool_stock_log enable row level security;
drop policy if exists saas_tool_stocks_select on saas_tool_stocks;
create policy saas_tool_stocks_select on saas_tool_stocks for select using (company_id in (select saas_user_company_ids()));
drop policy if exists saas_tool_outs_select on saas_tool_outs;
create policy saas_tool_outs_select on saas_tool_outs for select using (company_id in (select saas_user_company_ids()));
drop policy if exists saas_tool_stock_log_select on saas_tool_stock_log;
create policy saas_tool_stock_log_select on saas_tool_stock_log for select using (company_id in (select saas_user_company_ids()));
-- Written only by the server.
revoke insert, update, delete, truncate on saas_tool_stocks, saas_tool_outs, saas_tool_stock_log from anon, authenticated;

-- Take n off the shelf, out to a person. A resend with the same key hands
-- back the first one instead of taking two.
create or replace function saas_tool_take(p_company uuid, p_stock uuid, p_qty int, p_user uuid, p_name text,
  p_note text, p_by text, p_by_user uuid, p_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  s saas_tool_stocks%rowtype;
  oid uuid;
begin
  if p_key is not null then
    select id into oid from saas_tool_outs where company_id = p_company and request_key = p_key;
    if oid is not null then return oid; end if;
  end if;
  if p_qty is null or p_qty < 1 or p_qty > 20 then raise exception 'Take between 1 and 20.' using errcode = '22023'; end if;
  select * into s from saas_tool_stocks where id = p_stock and company_id = p_company and archived_at is null for update;
  if not found then raise exception 'That setting tool list is gone. Reload the page.' using errcode = 'P0002'; end if;
  if s.ready < p_qty then
    raise exception '%', case when s.ready = 0 then 'None ready on the shelf.' else format('Only %s ready on the shelf.', s.ready) end using errcode = 'P0001';
  end if;
  update saas_tool_stocks set ready = ready - p_qty where id = s.id;
  insert into saas_tool_outs (company_id, stock_id, out_user, out_name, qty, job_note, out_by, request_key)
    values (p_company, s.id, p_user, p_name, p_qty, nullif(btrim(coalesce(p_note, '')), ''), p_by, p_key)
    returning id into oid;
  insert into saas_tool_stock_log (company_id, stock_id, kind, ready_delta, out_delta, note, by_name, by_user)
    values (p_company, s.id, 'out', -p_qty, p_qty, left(format('%s to %s%s', p_qty, p_name, coalesce(', ' || nullif(btrim(coalesce(p_note, '')), ''), '')), 200), p_by, p_by_user);
  return oid;
end $$;

-- Back from the job: the ones that ran go on the used pile, the ones that
-- didn't go back on the shelf. A second tap on a line that's already back
-- does nothing.
create or replace function saas_tool_back(p_company uuid, p_out uuid, p_used int, p_unused int, p_by text, p_by_user uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  o saas_tool_outs%rowtype;
begin
  select * into o from saas_tool_outs where id = p_out and company_id = p_company for update;
  if not found then raise exception 'That line is gone. Reload the page.' using errcode = 'P0002'; end if;
  if o.back_at is not null then return false; end if;
  if p_used is null or p_unused is null or p_used < 0 or p_unused < 0 or p_used + p_unused <> o.qty then
    raise exception 'Say how many of the % ran.', o.qty using errcode = '22023';
  end if;
  perform 1 from saas_tool_stocks where id = o.stock_id for update;
  update saas_tool_outs set back_at = now(), back_by = p_by, back_used = p_used, back_unused = p_unused where id = o.id;
  update saas_tool_stocks set ready = least(999, ready + p_unused), used = least(999, used + p_used) where id = o.stock_id;
  insert into saas_tool_stock_log (company_id, stock_id, kind, ready_delta, used_delta, out_delta, note, by_name, by_user)
    values (p_company, o.stock_id, 'back', p_unused, p_used, -o.qty,
      left(format('%s back from %s: %s ran, %s didn''t', o.qty, o.out_name, p_used, p_unused), 200), p_by, p_by_user);
  return true;
end $$;

-- The vendor came by: picked up used ones, dropped off ready ones.
create or replace function saas_tool_vendor(p_company uuid, p_stock uuid, p_picked int, p_dropped int, p_by text, p_by_user uuid, p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s saas_tool_stocks%rowtype;
  took int;
  added int;
begin
  if p_key is not null and exists (select 1 from saas_tool_stock_log where company_id = p_company and request_key = p_key) then return false; end if;
  if p_picked is null or p_dropped is null or p_picked < 0 or p_dropped < 0 or p_picked > 999 or p_dropped > 999 or p_picked + p_dropped = 0 then
    raise exception 'Say how many they picked up and how many they dropped off.' using errcode = '22023';
  end if;
  select * into s from saas_tool_stocks where id = p_stock and company_id = p_company and archived_at is null for update;
  if not found then raise exception 'That setting tool list is gone. Reload the page.' using errcode = 'P0002'; end if;
  took := least(p_picked, s.used);
  added := least(p_dropped, 999 - s.ready);
  update saas_tool_stocks set used = used - took, ready = ready + added where id = s.id;
  insert into saas_tool_stock_log (company_id, stock_id, kind, ready_delta, used_delta, note, by_name, by_user, request_key)
    values (p_company, s.id, 'vendor', added, -took,
      left(format('Vendor picked up %s used, dropped off %s ready%s', p_picked,  p_dropped,
        case when p_picked > s.used then format(' (only %s were on the used pile)', s.used) else '' end), 200), p_by, p_by_user, p_key);
  return true;
end $$;

-- A manager counted the shelf and the used pile: the counts are what they saw.
create or replace function saas_tool_count(p_company uuid, p_stock uuid, p_ready int, p_used int, p_by text, p_by_user uuid, p_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  s saas_tool_stocks%rowtype;
begin
  if p_key is not null and exists (select 1 from saas_tool_stock_log where company_id = p_company and request_key = p_key) then return false; end if;
  if p_ready is null or p_used is null or p_ready < 0 or p_used < 0 or p_ready > 999 or p_used > 999 then
    raise exception 'Counts go from 0 to 999.' using errcode = '22023';
  end if;
  select * into s from saas_tool_stocks where id = p_stock and company_id = p_company and archived_at is null for update;
  if not found then raise exception 'That setting tool list is gone. Reload the page.' using errcode = 'P0002'; end if;
  update saas_tool_stocks set ready = p_ready, used = p_used where id = s.id;
  insert into saas_tool_stock_log (company_id, stock_id, kind, ready_delta, used_delta, note, by_name, by_user, request_key)
    values (p_company, s.id, 'count', p_ready - s.ready, p_used - s.used,
      format('Counted: %s ready (was %s), %s used (was %s)', p_ready, s.ready, p_used, s.used), p_by, p_by_user, p_key);
  return true;
end $$;

revoke all on function saas_tool_take(uuid, uuid, int, uuid, text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function saas_tool_back(uuid, uuid, int, int, text, uuid) from public, anon, authenticated;
revoke all on function saas_tool_vendor(uuid, uuid, int, int, text, uuid, text) from public, anon, authenticated;
revoke all on function saas_tool_count(uuid, uuid, int, int, text, uuid, text) from public, anon, authenticated;
grant execute on function saas_tool_take(uuid, uuid, int, uuid, text, text, text, uuid, text) to service_role;
grant execute on function saas_tool_back(uuid, uuid, int, int, text, uuid) to service_role;
grant execute on function saas_tool_vendor(uuid, uuid, int, int, text, uuid, text) to service_role;
grant execute on function saas_tool_count(uuid, uuid, int, int, text, uuid, text) to service_role;
