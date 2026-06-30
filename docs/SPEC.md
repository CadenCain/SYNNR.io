# SYNNR — Build Spec (hand to Claude Code)

Multi-tenant compliance platform for oilfield service companies. A company signs up, pays per yard via Stripe, and tracks every truck, shop, asset, cert, inspection, and DOT item with photos + proof documents + expiration dates. Self-serve, role-based, multi-tenant.

**Stack:** Next.js (App Router, TypeScript) · Supabase (Postgres + Auth + Storage + RLS) · Stripe (per-yard subscription) · Vercel (hosting) · Tailwind + shadcn/ui · Resend (email alerts) · Twilio (SMS alerts, phase 2).

---

## 0. Decisions still needed from Caden (fill these before/at build)
- **Per-yard price:** placeholder **$149/yard/month**. Confirm the number.
- **Trial:** suggest **14-day free trial** (card required) OR first yard free. Pick one.
- **Setup add-on:** optional paid "we'll load your yard for you" — list as a one-time line item later, not in v1 self-serve.
- **Alert channels v1:** email only (Resend); SMS (Twilio) in phase 2.
- **Expiring window default:** 30 days (per-item override allowed).

---

## 1. Core concepts / hierarchy
```
Company (tenant, billed per yard)
 └─ Yard (billing unit)
     ├─ Truck (unit, type=truck)  → has a "truck book": certs, inspections, DOT stickers, registrations
     │    └─ Assets (equipment mounted/assigned to the truck)
     └─ Shop (unit, type=shop)    → houses tools & pressure control
          └─ Assets (tools, pressure-control equipment)

Every Truck, Shop, and Asset can carry Compliance Items (cert / inspection / DOT / test / document),
each with issued + expiration dates, a status, photos, and proof files.
```

## 2. Data model (Supabase / Postgres)

> Every tenant-scoped table carries `company_id` for RLS. Use `uuid` PKs, `created_at`/`updated_at`.

**companies** — `id, name, stripe_customer_id, stripe_subscription_id, subscription_status (trialing|active|past_due|canceled|none), plan, yard_quantity int, trial_ends_at, created_at`

**profiles** (1:1 with `auth.users`) — `id (=auth.uid), email, full_name, phone, created_at`

**memberships** (user ↔ company + role) — `id, company_id, user_id, role (owner|admin|member), status (active|invited), created_at` — unique(company_id, user_id)

**invitations** — `id, company_id, email, role, token, invited_by, status (pending|accepted|revoked), expires_at, created_at`

**yards** — `id, company_id, name, location, created_at` *(count of active yards drives Stripe quantity)*

**units** — `id, company_id, yard_id, type (truck|shop), name, identifier (VIN/unit#), notes, created_at`

**assets** — `id, company_id, yard_id, unit_id (nullable), name, category (tool|equipment|pressure_control|vehicle|other), identifier, primary_photo_path, status (in_service|out_of_service|missing), notes, created_at`

**compliance_items** (the heart — anything with an expiration) — `id, company_id, parent_type (unit|asset), parent_id, kind (cert|inspection|dot_sticker|test|registration|document), title, issued_date, expiration_date, reminder_days (default 30), status (computed: valid|expiring|expired|none), responsible_person, notes, created_at`
- `status` is **derived**, not stored as source of truth: `expired` if `expiration_date < today`; `expiring` if within `reminder_days`; else `valid`. Compute in a SQL view (`compliance_items_with_status`) and/or on read.

**attachments** (photos + proof docs, generic) — `id, company_id, entity_type (asset|unit|compliance_item), entity_id, storage_path, content_type, label (photo|proof), uploaded_by, created_at`

**notification_settings** — `id, company_id, email_enabled bool, sms_enabled bool, lead_days int (default 30), recipients text[] , created_at`

**alerts_sent** (dedupe log) — `id, company_id, compliance_item_id, channel, sent_at`

## 2.5 Asset & unit type taxonomy (ship seeded, allow custom)
The app should ship with oilfield-specific types so users pick from a dropdown instead of free-texting. Store as a seeded `asset_types` reference table (global defaults) plus per-company custom types. Each type maps to a `category` and suggests the **compliance items it usually needs** (so adding a "Service Rig" auto-prompts "BOP test, annual DOT inspection, rig inspection," etc.).

**Unit types (the big things — `units.type` extends beyond truck/shop):**
- Service rig, workover rig, pump truck, vacuum/transport truck, hot oil truck, wireline truck, coil tubing unit, cement pump unit, nitrogen unit, frac/pressure pump, crane truck, winch/gin pole truck, trailer (various), light vehicle/pickup, **shop/yard building**.

**Asset categories → example types:**
- **Pressure control** — BOP / BOP stack, accumulator (closing unit), choke manifold, kill/choke line, wellhead, frac head, lubricator, treating iron / chiksan, valves, pressure relief valve.
- **Lifting & rigging** — slings, shackles, chains, hooks, spreader bars, winch line, tongs, elevators, crane/boom.
- **Tools & equipment** — power/hand/torque tools, gauges, pumps, generators, light plants, welders.
- **Safety & detection** — H2S monitors, multi-gas detectors, SCBA, fire extinguishers, fall protection, first-aid/eyewash.
- **Vehicle/DOT** — the truck itself: registration, annual DOT inspection, DOT stickers, IFTA, plates.

**Compliance item kinds (the dated things):** crew certs (H2S, well control/WellCAP, SafeLand, rig pass, CDL, DOT medical card, crane/rigging), equipment tests (BOP test, pressure/hydrostatic test, NDT/MPI on iron, sling/lifting inspection, fire-ext inspection, crane inspection), vehicle items (DOT annual, sticker, registration), and free-form documents.

**Tables to add:** `asset_types (id, company_id nullable=global, category, label, default_compliance_kinds text[])`. Seed the globals in a migration; let admins add company-specific types.

## 3. Auth + multi-tenancy (Supabase RLS)
- Supabase Auth (email/password + magic link). On first login, create `profiles` row (trigger on `auth.users`).
- **RLS on every tenant table.** Helper: a user "belongs to" a company if a row exists in `memberships` (status='active'). Pattern:
  ```sql
  -- SELECT policy (all tenant tables)
  using (company_id in (select company_id from memberships
                        where user_id = auth.uid() and status = 'active'));
  -- write policies additionally check role for admin-only actions
  using ( ... and exists(select 1 from memberships m where m.company_id = table.company_id
            and m.user_id = auth.uid() and m.role in ('owner','admin')) );
  ```
- Storage bucket `proofs` is **private**; serve via signed URLs. Path convention: `company_id/entity_type/entity_id/filename`. Storage RLS checks membership via the path's `company_id`.

## 4. Roles & permissions
- **owner** — everything incl. billing, delete company, manage members.
- **admin** — manage yards/units/assets/compliance, invite/manage members (not billing, not delete company).
- **member** — view everything in their company; create/edit assets & compliance items; no member management, no billing.
- Enforce in **RLS** (source of truth) AND mirror in UI (hide controls).

## 5. Billing (Stripe, per-yard)
- One subscription per company. Price = **per-yard** recurring; `quantity = active yard count`.
- **Signup → access flow:**
  1. User signs up → creates `profiles`.
  2. Onboarding: enter **company name** → creates `companies` + `memberships(owner)`.
  3. Redirect to **Stripe Checkout** (mode=subscription, quantity=1). On `checkout.session.completed` webhook → save `stripe_customer_id`, `stripe_subscription_id`, set `subscription_status`.
  4. **Gate the app**: middleware blocks `/app/**` unless `subscription_status in ('trialing','active')`. Otherwise → `/onboarding/billing`.
  5. When a yard is added/removed, **update Stripe subscription quantity** to match active yard count (server action → Stripe API).
- **Billing portal**: Stripe Customer Portal link in settings for card/plan/cancel.
- **Webhooks to handle:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` → keep `subscription_status`/`yard_quantity` in sync.

## 6. File / photo upload
- Supabase Storage bucket `proofs` (private). Upload via signed upload URLs from a server action.
- Asset detail: a primary photo + a gallery of proof docs (images/PDF). Compliance item: attach the proof (e.g., the cert PDF / sticker photo).

## 7. Routes / screens (App Router)
- `/login`, `/signup`
- `/onboarding` (create company) → `/onboarding/billing` (Stripe Checkout)
- `/app` — **Compliance dashboard**: counts of expired / expiring / valid across the company; list of next 30-day expirations; filter by yard.
- `/app/yards` · `/app/yards/[yardId]` (units in the yard)
- `/app/units/[unitId]` — truck or shop detail; tabs: **Truck Book** (certs, inspections, DOT, registration), **Assets**, **Documents**.
- `/app/assets/[assetId]` — photo, details, compliance items, proof files.
- `/app/compliance` — global table of all compliance items; filter by status/kind/yard; sort by soonest expiration.
- `/app/settings/team` — members + roles + invite by email.
- `/app/settings/billing` — Stripe portal, current yard count & charge.
- `/app/settings/notifications` — channels, lead days, recipients.
- `/invite/[token]` — accept invite → join company with assigned role.

## 7.5 Design, mobile UX & the renewal loop (THIS IS THE PRODUCT)
Good design is non-negotiable — it's a compliance tool, it has to *look* trustworthy and be usable one-handed in the sun next to a rig. **Mobile-first, desktop-capable.**

**The status system (used everywhere, instantly readable):**
- 🟢 **Valid** · 🟡 **Expiring** (within lead days) · 🔴 **Expired** · ⚪️ **Missing/none**.
- Same colors on dashboards, lists, asset cards, and item rows. A field guy should read a screen in 2 seconds.

**The core loop — "snap → renewed → done" (must be 2 taps):**
> Example: a service rig's truck book has a BOP test going out of date. It shows 🔴 on the dashboard. User taps it → taps **Renew** → camera opens → photographs the new cert/test → enters (or confirms OCR'd) new expiration date → Save. Status flips 🟢. Done.
- "Renew" is a primary, camera-first action on every compliance item. Pre-fills the previous values; user just shoots the new doc + sets the new date.
- Phase 2 nicety: OCR the photographed cert to auto-suggest the expiration date (ties to the ingestion roadmap).

**Navigation / information architecture:**
- **Mobile:** bottom tab bar — **Home** (compliance status) · **Yards** (drill into rig/truck/shop → truck book/assets) · **➕ Quick Action** (renew or add, camera-first) · **Alerts** · **Settings**. Big tap targets, minimal typing, sticky primary actions.
- **Desktop:** left sidebar nav, denser data tables, bulk actions, CSV import, multi-yard rollups.
- **IA depth:** Dashboard → Yard → Unit (rig/truck/shop) → Truck Book / Assets → Compliance Item. Never more than 3 taps to a renewal.

**Home / dashboard (first thing they see):** big counts — "X expired, Y expiring this month, Z valid" — then a prioritized **action list** ("BOP #3 — expired 2 days", "Rig 4 DOT — 11 days"), each row one tap from Renew. Filter by yard.

**Design system:** Tailwind + shadcn/ui, high-contrast industrial-but-modern, large type, generous spacing, photo-forward asset cards. Consistent status badges. Real empty states ("No assets in this yard yet — add your first or import a list"). Skeleton loaders.

**Field realities to design for:** spotty signal at the yard (graceful loading, optimistic UI, retry; consider offline-tolerant reads in a later phase), gloved/sunlit use (contrast, big targets), camera as a primary input not an afterthought.

## 8. Expiration alerts
- Supabase scheduled function (pg_cron daily, ~6am) → select compliance items where `expiration_date` within `lead_days` and no `alerts_sent` row yet → send **email via Resend** to `notification_settings.recipients` → log in `alerts_sent`. (Phase 2: Twilio SMS — ties to the "you get the text" promise.)
- In-app: dashboard badges + an "Expiring soon" view.

## 9. Build order (ship in this sequence)
1. **Project scaffold** — Next.js + Tailwind + shadcn/ui; Supabase project; env wired; Vercel deploy.
2. **Auth + company onboarding** — signup/login, create company, `memberships(owner)`, profile trigger.
3. **Schema + RLS** — all tables, status view, membership-based policies, `proofs` bucket + storage policies.
4. **Core CRUD** — yards → units → assets → compliance items, with photo/proof upload.
5. **Compliance dashboard** — expired/expiring/valid rollup + global compliance table.
6. **Stripe** — Checkout, app gating middleware, webhooks, yard-quantity sync, billing portal.
7. **Team & roles** — invite flow, accept, role enforcement (RLS + UI).
8. **Alerts** — cron function + Resend email; notification settings.
9. **Polish** — empty states, mobile (operators on phones in the yard), CSV import of existing asset/cert lists (kills the data-entry barrier).

## 10. Env / secrets
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_ID` (per-yard price), `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`.

## 11. Guardrails for the build
- RLS is the **security boundary** — never rely on UI checks alone; test that a user from Company A cannot read Company B's rows or files.
- Treat Stripe **webhooks as the source of truth** for subscription state; don't trust the client redirect alone.
- Keep `compliance_items.status` **derived**, never hand-edited.
- Build mobile-friendly from day one — these get used standing next to a truck.
- Make **CSV/photo import** a first-class onboarding path so a buried shop can load a yard in minutes, not hours (this is what makes self-serve actually activate).
```
```
```
NOTE (positioning, not build): self-serve compliance app = the scalable GTM wedge. Optional "we'll load your yard" setup = paid onboarding for shops that won't do data entry. Custom integrations (Ryan's tally chain of custody, Alex's PLC→ticketing) = high-ticket expansion on top. Same funnel, three price points.
```
