# SYNNR.io

**Revenue intelligence for field operations.** SYNNR is the self-serve
intelligence system that finds lost revenue, cleans job packets, validates
pricing against contracts, and helps field service companies get paid faster.

This is a clean rebuild from the Claude Design handoff bundle (charcoal + bone
aesthetic, no emoji). The old "digital twin / Service OS" concept has been
fully replaced.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19**
- **TypeScript**
- **Tailwind CSS v4** (CSS-first; per-page design systems scoped under wrapper
  classes so they never collide)
- **Geist / Geist Mono** via `next/font`

## Routes

| Route | Page | What it is |
|-------|------|------------|
| `/` | **Marketing** | Hero with an interactive product dashboard, bento features, ROI calculator, value-based pricing (self-serve / performance), testimonials, FAQ |
| `/dashboard` | **App dashboard** | Stat cards, trend chart, invoice-risk table, activity rail; every sidebar tab swaps the panel; rows open the audit detail |
| `/audit` | **Audit detail** | Finding review with side-by-side evidence and a Found → In-billing → Recovered pipeline (approve / re-bill / mark recovered) |
| `/checkout` | **Checkout** | Stripe-style checkout, plan-aware via `?plan=recover\|command` |

## Architecture notes

Each page is a small server component that injects the prototype markup and
mounts a client `*-scripts.tsx` component that ports the prototype's vanilla JS
(reveals, toggles, carousels, the audit state machine, the dashboard view
registry, checkout card formatting) into a single scoped `useEffect`.

- `app/globals.css` — Tailwind import + base reset + Geist font variables.
- `app/marketing.css` (`.mkt`), `app/dashboard/dashboard.css` (`.dash`),
  `app/audit/audit.css` (`.audit`), `app/checkout/checkout.css` (`.co`) — the
  four design systems, each scoped to a wrapper class.

## Infrastructure

- **Supabase:** project `SYNNR.io` (ref `zbtxnvzxnpwdrpaxmliz`, us-east-1).
- **Vercel:** project `SYNNR.io`. Domain: `synnr.io`.

## Develop

```bash
npm run dev      # http://localhost:3000
npm run build    # production build (all routes prerender)
npm run lint
```

## Roadmap (not yet built)

- Self-serve onboarding / upload flow (the "Request Early Access" funnel step)
- Real backend: ingestion + extraction, reconciliation engine, persistence on
  the SYNNR.io Supabase project
- Auth, Stripe wiring, multi-tenancy
