import { NextResponse } from "next/server";
import { billableYardCount } from "@/lib/saas/billing";
import { getStripe } from "@/lib/stripe";
import { requireCompany } from "@/lib/saas/auth";
import { canPerform } from "@/lib/saas/entitlements";
import { saasAdmin } from "@/lib/saas/db";
import { clampYards, SELF_SERVE_OPEN } from "@/lib/saas/plan";
import { createYardCheckout, siteOrigin } from "@/lib/saas/onboarding";

/**
 * Start (or restart) the subscription from the payment page: Stripe Checkout
 * at the per-yard price (closed while SELF_SERVE_OPEN is off). The owner only; the demo yard
 * never; never a second subscription on top of a live one. First-time
 * onboarding goes straight to Stripe from the company step instead.
 */
export async function POST(req: Request) {
  const { user, company } = await requireCompany();
  const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });
  // Early access: nobody pays online until the new price is in Stripe.
  if (!SELF_SERVE_OPEN) return no("Paying online is off while SYNNR is in early access. Call or text 432-250-0715 and we'll get you set up.", 403);
  if (company.is_demo) return no("This is the demo company, so nothing here can be billed.", 403);
  if (!canPerform(company.role, "billing")) return no("Only the account owner can start the subscription.", 403);
  if (company.subscription_status === "active" || company.subscription_status === "past_due") {
    return no("You're already subscribed. Add or remove yards under Settings, Billing.", 409);
  }
  const stripe = getStripe();
  const admin = saasAdmin();
  if (!stripe || !admin) return no("Billing isn't set up yet. Call or text 432-250-0715.", 500);

  let requested: unknown = null;
  try { requested = (await req.json())?.quantity; } catch { /* no body */ }
  const { data: row } = await admin.from("saas_companies").select("requested_yards").eq("id", company.id).maybeSingle();
  const quantity = clampYards(requested ?? (row as { requested_yards: number | null } | null)?.requested_yards ?? 1);
  // Restarting after a cancel: the plan covers every yard already set up.
  const inUse = await billableYardCount(company.id);
  if (quantity < inUse) {
    return no(`You have ${inUse} yards set up. Restart with ${inUse}, or delete a yard under Yards first.`, 409);
  }

  try {
    const s = await createYardCheckout(stripe, admin, {
      companyId: company.id, companyName: company.name, userEmail: user.email ?? null,
      quantity, origin: siteOrigin(req.headers, req.url),
    });
    return NextResponse.json({ ok: true, url: s.url, quantity: s.quantity, amount_total: s.amountTotal });
  } catch (e) {
    console.error("[checkout]", e instanceof Error ? e.message : e);
    return no("Billing is down for a minute on our end. Call or text 432-250-0715 and we'll get you set up today.", 500);
  }
}
