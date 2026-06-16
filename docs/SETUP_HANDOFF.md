# SYNNR — Launch Setup Handoff (dashboard / secrets)

synnr.io is live (Next.js on Vercel · Supabase · Stripe). **The code is fully wired** — these are the dashboard + secret steps that must be done by a human/agent with account access. Do them in order. Nothing here requires code changes.

**Safety:** only paste secrets into the Vercel / Supabase / Stripe / Resend dashboards. Never commit them to git or paste them into chat. Price IDs are *not* secret.

---

## A. Email — connect Resend SMTP in Supabase (fixes slow/unbranded auth emails)
DNS for synnr.io is already verified for Resend (DKIM `resend._domainkey.synnr.io`, SPF + return-path MX on `send.synnr.io`). You can send as `@synnr.io`.

1. **Resend → API Keys → Create API Key** (Sending access). Copy the `re_…` value.
2. **Supabase → Project Settings → Authentication → SMTP Settings → enable Custom SMTP:**
   - Sender email: `noreply@synnr.io`
   - Sender name: `SYNNR`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: *(the `re_…` key)*
3. **Supabase → Authentication → URL Configuration:** Site URL = `https://synnr.io`; Redirect URLs include `https://synnr.io/auth/callback` and `https://www.synnr.io/auth/callback`.
4. **Supabase → Authentication → Providers → Email → turn OFF "Confirm email"** (so password sign-up is instant; recommended now that password auth exists).
5. **Supabase → Authentication → Email Templates** — set the action links to the token-hash form (kills the "code challenge does not match" error from email scanners pre-clicking links; the app's `/auth/callback` already supports it):
   - **Magic Link:** `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/dashboard`
   - **Reset Password:** `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/account`
6. Send a test email → confirm it arrives from synnr.io, fast.

---

## B. Caden's dogfood login password
The account `cadencain@yahoo.com` already exists and already has TallyShot access (manual seat).
- **Supabase → Authentication → Users → `cadencain@yahoo.com` → set/reset password.**
- Then sign in at `https://synnr.io/login` with email + that password. No email delivery needed for password sign-in.

---

## C. Stripe — go live (so money lands)
The TallyShot product + per-seat price already exist in Stripe (live): price `price_1TijfqEzyENjapS4Hv2VIg0q` (volume tiers $39 / $34 @10 / $29 @25 / $25 @50, monthly). *(For test mode, run `npm run stripe:setup` with an `sk_test_` key to make a test price.)*

1. **Stripe → complete account activation + connect bank** so payouts are enabled (verification can take a day — start first).
2. **Stripe → Developers → Webhooks → Add endpoint:** `https://synnr.io/api/stripe/webhook`; events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`. Copy the **signing secret**.
3. **Stripe → Settings → Billing → Customer Portal → enable** (live mode): allow cancel, change quantity (seats), update card, view invoices.
4. **Stripe → enable Stripe Tax** (or confirm tax handling — Texas + multi-state).

---

## D. Vercel environment variables (Production) — then redeploy
Add/confirm these in **Vercel → synnr-io → Settings → Environment Variables (Production)**:

| Variable | Value | For |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | *(already set)* | Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(already set, public-safe)* | Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | *(Supabase → Project Settings → API → service_role)* | /team writes, webhook sync |
| `STRIPE_SECRET_KEY` | *(Stripe live `sk_…`)* | checkout, portal |
| `STRIPE_WEBHOOK_SECRET` | *(from step C2)* | webhook verification |
| `STRIPE_PRICE_TALLYSHOT_SEAT` | `price_1TijfqEzyENjapS4Hv2VIg0q` | per-seat checkout (not secret) |
| `AI_GATEWAY_API_KEY` | *(Vercel AI Gateway key, or connect the Vercel AI Gateway integration)* | real photo vision |

Optional: `AI_MODEL_VISION` (default `anthropic/claude-sonnet-4.5`), `RESEND_API_KEY` (only for the app's lead/contact notification emails — separate from Supabase auth email in section A).

**After changing env vars, trigger a redeploy** (Vercel → Deployments → Redeploy) so they take effect.

---

## E. AI Gateway safety
- In the Vercel AI Gateway, set a **hard spend cap / rate limit** so a bad loop or abuse can't run up a bill.

---

## F. End-to-end verification (do these, don't assume)
1. **Fresh account:** sign up (email+password) → land on dashboard → start a TallyShot trial (1 seat) → confirm in Supabase `subscriptions` the row appears and a `seat_assignments` row was auto-created → open `/app/tallyshot`.
2. **Real card test:** $1 live purchase → webhook writes the subscription → access granted → then refund.
3. **Self-service:** open the Customer Portal, change seat count (proration), cancel.
4. **Vision trust test:** upload 3–5 real, ugly tally sheets at `/app/tallyshot` → confirm implied decimal is right, shaky digits get flagged (not silently guessed), and the exported grand total matches a hand count.
5. **Isolation:** with two different accounts, confirm neither can see the other's sheets/subscriptions.

---

## What's already done (no action needed)
- Marketplace site, `/apps`, `/apps/tallyshot`, per-seat `/checkout`, public demo at `/ingest`.
- Email+password auth (`/login`, `/signup`), org auto-provisioning, app switcher.
- Supabase marketplace schema applied (orgs/memberships/products/prices/subscriptions/seats/usage/invites) with RLS.
- Stripe per-seat checkout + Customer Portal route + webhook sync code; VisionReader code; team invites + seat assignment.
- Legal pages (per-seat + 14-day trial wording) — still need attorney review before first charge.
