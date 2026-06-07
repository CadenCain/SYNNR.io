# SYNNR.io — Backend Handoff Spec

This is the contract the frontend already implies and the schema now in
Supabase (`zbtxnvzxnpwdrpaxmliz`). Build the backend to this; the screens will
read from it once they're converted from static markup to data-driven
components.

---

## 0. Locked decisions

| Area | Decision | Why |
|---|---|---|
| **Auth** | **Supabase Auth** (email magic link / OTP) + **RLS** | DB is already Supabase; one less vendor; RLS gives per-tenant isolation for free. Wire with `@supabase/ssr` (cookie sessions) so `current_workspace_id()` resolves per request. |
| **Tenancy** | One `workspace` per company; every domain row carries `workspace_id`; users join via `profiles.workspace_id` | Matches the onboarding "create workspace" step. |
| **Billing MVP** | **Flat Stripe subscriptions** (Recover $2,500 / Command $7,500). **Defer** the performance / "15% of collected" model. | Performance pricing needs collected-dollar attribution (re-bill → paid → confirmed) — real work you shouldn't gate launch on. Keep the perf toggle as marketing only for now. |
| **Ingestion MVP** | **Upload-only** (files → Storage → parse). Connectors (QuickBooks/ServiceTitan/Procore/Drive) are **"Soon"** in the UI. | Connector OAuth + sync is the second hardest thing after extraction. Ship upload first. |
| **"Request Early Access"** | Captures a **lead** (already wired: `POST /api/lead` → `leads` table) *and* opens the self-serve wizard | Lets you collect demand now without pretending full self-serve is production-ready. |

---

## 1. Data model (live in Supabase)

All tables have `id uuid` + `created_at timestamptz`. Money is stored as
**integer cents** (`*_cents`). RLS is **enabled** on every table; the tenant
policy is `workspace_id = public.current_workspace_id()`.

- **workspaces** `(name, industry)`
- **profiles** `(id = auth.users.id, workspace_id, name, email, role)` — the user↔workspace link
- **clients** `(workspace_id, name, msa_number)`
- **crews** `(workspace_id, name, lead)`
- **jobs** `(workspace_id, number, title, client_id, crew_id, status, priority, closed_at, recoverable_cents)`
  - `status`: `open | in_review | delivered | resolved | clean`
  - `priority`: `low | medium | high`
- **findings** `(workspace_id, job_id, type, title, subtitle, amount_cents, state, blocker, evidence jsonb)`
  - `type`: `missed | rate | doc`
  - `state`: `open → approved → recovered | dismissed`, plus `resolved` for blockers
  - `blocker`: `backup | sign | null` (doc findings hold billing instead of carrying a dollar amount)
  - `evidence`: `[{ label, ok: boolean, detail }]` — the side-by-side proof the audit screen renders
- **pricebook_rules** `(workspace_id, label, billed_cents, contract_cents, unit, note)`
- **audit_runs** `(workspace_id, label, jobs_count, recovered_cents, status)`
- **integrations** `(workspace_id, name, status)` — `connected | available`
- **leads** `(email, company, name, industry, source)` — anon-insert allowed (waitlist/onboarding)

Generated TS types: [`lib/supabase/types.ts`](../lib/supabase/types.ts). Regenerate after schema changes:
```
supabase gen types typescript --project-id zbtxnvzxnpwdrpaxmliz > lib/supabase/types.ts
```
A demo workspace ("Permian Field Services") is seeded so the numbers match the
UI (job `RC-4821`: findings 1,430 + 2,180 + 960 = $4,570; YTD recovered
$284,750 = 148,200 + 94,300 + 42,250).

### The recovery pipeline (the core invariant)
A finding moves `open → approved → recovered`. The three dashboard/audit
figures are **derived**, never conflated:
- **Found** = Σ `amount_cents` where `state != dismissed`
- **In billing** = Σ where `state in (approved, recovered)`
- **Recovered** = Σ where `state = recovered` ← the only number a CFO signs off on

---

## 2. API surface (implied by the screens)

Prefer Next Route Handlers (`app/api/*`) or Server Actions, all tenant-scoped via RLS.

| Method · Route | Used by | Returns |
|---|---|---|
| `POST /api/lead` ✅ done | Onboarding / Early Access | `{ ok }` (inserts `leads`) |
| `POST /api/auth/*` | Login/onboarding | Supabase Auth session |
| `POST /api/workspaces` | Onboarding step 1 | create workspace + profile |
| `POST /api/uploads` | Onboarding step 2/3 | signed Storage URL; row per `artifact` |
| `POST /api/audits` | "Run first audit" / "New audit" | kicks off an `audit_run`, returns id |
| `GET /api/dashboard` | `/dashboard` overview | stats, trend, risk rows, activity |
| `GET /api/jobs?view=` | dashboard tabs | jobs / at-risk / disputes lists |
| `GET /api/jobs/:id` | `/audit` | job + findings (+ evidence) |
| `PATCH /api/findings/:id` | `/audit` actions | set `state` (approve/recover/dismiss/resolve) → recompute pipeline |
| `GET /api/pricebook` · `GET /api/clients` · `GET /api/crews` · `GET /api/integrations` | dashboard tabs | lists |
| `POST /api/stripe/checkout` · `POST /api/stripe/webhook` | `/checkout` | real subscription + entitlement |

---

## 3. The reconciliation engine (how detection works)

Every finding is a **disagreement between three sources of truth**:
1. **What happened** — field artifacts (tickets, photos, time logs)
2. **What's billed** — the draft invoice
3. **What's owed** — the contract layer (pricebook, rate sheets, MSAs)

**Pipeline:** `ingest → extract → resolve entities → run checks → evidence + confidence + human gate`.

### The one design rule
**Let the LLM extract; let code decide.** Never ask the model "is this
under-billed?" — ask it to *pull typed numbers*, then compare in deterministic
code. That keeps every finding auditable (the `evidence[]` array) and prevents
hallucinated dollars.

### Extraction (LLM, structured output)
Force typed JSON per artifact, e.g.:
```jsonc
// field ticket
{ "job_number": "RC-4821", "date": "2025-08-14",
  "line_items": [{ "code": "standby", "qty": 6.5, "unit": "hr" }],
  "signature_present": true, "photo_count": 2 }
// invoice
{ "job_number": "RC-4821",
  "line_items": [{ "code": "standby", "qty": 0, "unit": "hr", "rate_cents": 0 }] }
```
Use a vision model for photos (signature present? how many backup images?).

### Detectors (deterministic, one per finding type)
| Finding `type` | Rule |
|---|---|
| `missed` — unbilled standby/consumables | ticket qty > invoice qty for a billable code → `delta × rate` |
| `rate` — below MSA | invoice `rate_cents` < `pricebook_rules.contract_cents` for that customer+code → `(contract − billed) × qty` |
| `doc` — missing backup | required docs/photos for job type > attached → `blocker: 'backup'`, holds billing |
| `doc` — unsigned ticket | `signature_present == false` → `blocker: 'sign'`, holds billing |

Each detector emits a `findings` row with `amount_cents` (0 for blockers),
`evidence[]`, and a confidence score; low-confidence or customer-facing ones
route to the review queue (the `/audit` screen) before anything re-bills.

### The genuinely hard parts (where the effort goes)
Extraction from bad inputs (handwriting, blurry photos), price-book mapping
(semantic match "crane svc – 8hr" → SKU; needs embeddings + per-customer
learning), and entity resolution across disconnected systems. **This is the
moat — prove it on one design partner's real data first.**

---

## 4. Frontend refactor that pairs with this

- **Keep static:** `/` (marketing) and `/legal/*` — they're injected HTML by
  design and need no data.
- **Convert to data-driven React** when endpoints exist: `/dashboard`, `/audit`,
  and the onboarding step-4 result. They currently render hardcoded demo markup
  via `dangerouslySetInnerHTML` + a scoped `useEffect`, with state in
  `localStorage` (audit findings, onboarding progress) — those are the exact
  swap points to Supabase queries + `PATCH /api/findings/:id`.

---

## 5. Environment

`.env.local` (local) and Vercel project env need:
```
NEXT_PUBLIC_SUPABASE_URL=https://zbtxnvzxnpwdrpaxmliz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_RdzwRXMEgDlY0EY9gc48Yg_Gjqd4i8L
# server-only, add when building privileged endpoints / Stripe:
# SUPABASE_SERVICE_ROLE_KEY=...
# STRIPE_SECRET_KEY=...  STRIPE_WEBHOOK_SECRET=...
```
Clients: [`lib/supabase/client.ts`](../lib/supabase/client.ts) (browser),
[`lib/supabase/server.ts`](../lib/supabase/server.ts) (server). Both no-op
safely if env is missing so the static site never crashes.

---

## 6. Status

**Done:**
- Schema + RLS + seed; generated types; Supabase client layer; `POST /api/lead`.
- **Supabase Auth** (email OTP) + `@supabase/ssr` + `proxy.ts` session refresh;
  `create_workspace()` RPC; `/onboarding` gated; new workspaces auto-seeded.
- **Live, per-workspace** dashboard + audit (demo fallback when signed out);
  audit approve→recover persists via `PATCH /api/findings/[id]`.
- **Ingestion capture:** `artifacts` table + private `job-data` Storage bucket;
  onboarding uploads real files.
- **Reconciliation engine** (`lib/engine`): AI Gateway extraction + deterministic
  detectors → `POST /api/audits/run` persists job + findings. Reads the
  workspace's **real uploaded text files** (falls back to a sample); PDFs/images
  are skipped pending OCR/vision.
- Vercel Analytics, legal pages, connectors marked "Soon".

**Next:** (1) OCR/vision so PDFs + photos feed the engine (the remaining moat
depth), (2) real **Stripe** subscriptions + webhook entitlement, (3) dashboard
tab-views → live data. **And the thing that actually matters: one design
partner, real data, measure recovered *and* collected.**
