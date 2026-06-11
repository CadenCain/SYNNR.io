# SYNNR.io — Activation Runbook

The app ships **fully working in demo mode** with zero config (public pages +
seeded demo data). To turn on the real, authed, AI-powered product, set the
following. Until then every authed/AI path safely falls back to the demo.

> **Which repo / project:** SYNNR (Loadout + Job Readiness) lives in **`github.com/CadenCain/SYNNR.io`**
> and the live Supabase is **`SYNNR.io`** (`zbtxnvzxnpwdrpaxmliz`, ACTIVE).
> The separate `synnr-appv10` Vercel project (repo `synnr-app`, the "Darkstar"
> compliance pivot) is **not** this product — leave it parked or delete it later.

## 0. Create the Vercel project (one time)
Vercel → **Add New… → Project → Import** `CadenCain/SYNNR.io` → Framework: Next.js
(auto). Don't deploy yet — add the env vars in step 1 first, then deploy. After
this, every `git push` to `main` auto-deploys.

## 1. Vercel → Project → Settings → Environment Variables
Add to **Production + Preview**, then redeploy.

| Key | Value / where to get it |
|-----|--------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://zbtxnvzxnpwdrpaxmliz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_RdzwRXMEgDlY0EY9gc48Yg_Gjqd4i8L` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → **service_role** (secret; webhook only) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | from the webhook you create in step 3 (`whsec_…`) |
| `STRIPE_PRICE_PRO` | Stripe price id for Pro ($499/mo) |
| `STRIPE_PRICE_GROWTH` | Stripe price id for Growth ($999/mo) |
| `AI_MODEL` *(optional)* | default `anthropic/claude-3.5-haiku` (text extraction) |
| `AI_MODEL_VISION` *(optional)* | default `anthropic/claude-sonnet-4.5` (PDF/photo extraction) |

## 2. Supabase → Authentication
- **Email Templates → Magic Link**: include the code, e.g. `Your SYNNR sign-in code is: {{ .Token }}` (the login UI expects a 6-digit code).
- **URL Configuration → Site URL**: your production domain.
- *(Default mailer is rate-limited; add custom SMTP before real volume.)*

## 3. Stripe dashboard
- Create two recurring **Products/Prices**: Pro **$499/mo**, Growth **$999/mo** → copy the `price_…` ids into the env above.
- Developers → **Webhooks** → add endpoint `https://<your-domain>/api/stripe/webhook`, events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted` → copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

## 4. Vercel AI Gateway
- Enable it on the account and add a little credit. On Vercel deploys it authenticates automatically via OIDC (no key to paste). Locally, set `AI_GATEWAY_API_KEY`.

## 5. Smoke test (proves it solves the problem)
1. Sign in at `/login` (email code).
2. Onboarding → upload a sample ticket + invoice + rate sheet (CSV or PDF) → **Run audit**.
3. A real **Reconciled job** appears on `/dashboard`; open it at `/audit` → Approve → Mark recovered.
4. Open `/report` → the Found → In-billing → Recovered artifact.
5. `/checkout` → pay with Stripe test card `4242 4242 4242 4242` → dashboard sidebar shows the **active plan**.

Messy files in → recoverable dollars out, reviewed, billed, and tracked.

## Verified (via SQL, 2026-06)
- All public tables have RLS enabled.
- New-workspace provisioning seeds 6 jobs / 5 findings / $4,570 found / $2,180 rate.
- Detector math: standby $1,430, rate $2,180, + doc blockers.
- Storage bucket `job-data` + engine functions present.
- **Security hardening (2026-06-08):** `seed_workspace_sample` is now guarded to the
  caller's own workspace and `anon` execute was revoked on it + `create_workspace`
  (closed a cross-tenant seed hole). `current_workspace_id` stays anon-callable by
  design (RLS policies reference it; returns null for anon). Remaining advisor WARNs
  (public `leads` insert; signed-in users calling the provisioning RPCs) are intentional.
