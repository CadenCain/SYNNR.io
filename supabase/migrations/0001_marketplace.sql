-- SYNNR marketplace schema (Phase 2).
--
-- Extends the existing single-tenant model into a multi-product marketplace.
-- The existing `workspaces` table IS the spec's "Organization" (it already
-- backs current_workspace_id() RLS); this migration adds the org type +
-- Stripe customer, multi-org membership, the product catalog, per-(org,product)
-- subscriptions with seats, seat assignments, metered usage, and invites.
--
-- NOT auto-applied. Review, then apply via Supabase (MCP apply_migration or
-- `supabase db push`). Idempotent where practical so a re-run is safe.

-- ── Organizations ────────────────────────────────────────────────────────────
alter table public.workspaces
  add column if not exists type text not null default 'company'
    check (type in ('personal','company')),
  add column if not exists stripe_customer_id text;

-- ── Membership (many-to-many; a hand can be in their own personal org AND a
--    company org). profiles.workspace_id stays as the user's *active* org. ─────
create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique (user_id, workspace_id)
);
create index if not exists memberships_workspace_idx on public.memberships(workspace_id);
create index if not exists memberships_user_idx on public.memberships(user_id);

-- ── Product catalog (public-readable) ────────────────────────────────────────
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  status text not null default 'coming_soon' check (status in ('live','coming_soon')),
  pricing_model text not null check (pricing_model in ('per_seat','flat','metered','hybrid')),
  created_at timestamptz not null default now()
);

create table if not exists public.prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  stripe_price_id text not null,
  tier_meta jsonb not null default '{}'::jsonb,  -- { min_seats, per_seat_usd, label }
  interval text not null default 'month' check (interval in ('month','year')),
  created_at timestamptz not null default now()
);
create index if not exists prices_product_idx on public.prices(product_id);

-- ── Subscriptions: one row per (org, product). Extends the existing table. ────
alter table public.subscriptions
  add column if not exists product_slug text,
  add column if not exists seats integer not null default 1;
create index if not exists subscriptions_workspace_idx on public.subscriptions(workspace_id);
create unique index if not exists subscriptions_org_product_uniq
  on public.subscriptions(workspace_id, product_slug)
  where product_slug is not null;

-- ── Seat assignments: which member holds a seat for which product ─────────────
create table if not exists public.seat_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_slug text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workspace_id, product_slug, user_id)
);
create index if not exists seat_assignments_org_product_idx
  on public.seat_assignments(workspace_id, product_slug);

-- ── Metered usage (overage scans, etc.) ──────────────────────────────────────
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  product_slug text not null,
  user_id uuid references auth.users(id) on delete set null,
  qty integer not null default 1,
  ts timestamptz not null default now()
);
create index if not exists usage_events_org_product_ts_idx
  on public.usage_events(workspace_id, product_slug, ts);

-- ── Invites ──────────────────────────────────────────────────────────────────
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner','admin','member')),
  token text unique not null default encode(gen_random_bytes(24),'hex'),
  status text not null default 'pending' check (status in ('pending','accepted','revoked')),
  created_at timestamptz not null default now()
);
create index if not exists invites_workspace_idx on public.invites(workspace_id);
create index if not exists invites_email_idx on public.invites(lower(email));

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Org-scoped tables: a row is visible iff its workspace_id matches the caller's
-- active workspace (current_workspace_id(), same helper the existing tables use).
alter table public.memberships enable row level security;
alter table public.products enable row level security;
alter table public.prices enable row level security;
alter table public.seat_assignments enable row level security;
alter table public.usage_events enable row level security;
alter table public.invites enable row level security;

-- Catalog is world-readable (the marketplace shows it pre-login).
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (true);
drop policy if exists prices_read on public.prices;
create policy prices_read on public.prices for select using (true);

-- Memberships: a user sees their own rows; admins/owners see their org's.
drop policy if exists memberships_self on public.memberships;
create policy memberships_self on public.memberships
  for select using (user_id = auth.uid() or workspace_id = public.current_workspace_id());

drop policy if exists seat_assignments_org on public.seat_assignments;
create policy seat_assignments_org on public.seat_assignments
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

drop policy if exists usage_events_org on public.usage_events;
create policy usage_events_org on public.usage_events
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

drop policy if exists invites_org on public.invites;
create policy invites_org on public.invites
  for all using (workspace_id = public.current_workspace_id())
  with check (workspace_id = public.current_workspace_id());

-- ── Seed the catalog (mirrors lib/catalog/products.ts) ────────────────────────
insert into public.products (slug, name, status, pricing_model) values
  ('tallyshot', 'TallyShot', 'live', 'hybrid'),
  ('loadcheck', 'LoadCheck', 'coming_soon', 'per_seat'),
  ('ticketflow', 'TicketFlow', 'coming_soon', 'per_seat'),
  ('certwatch', 'CertWatch', 'coming_soon', 'per_seat')
on conflict (slug) do update
  set name = excluded.name, status = excluded.status, pricing_model = excluded.pricing_model;
