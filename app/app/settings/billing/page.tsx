import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireCompany , assertCan } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import BillingActions from "./billing-actions";
import { redirect } from "next/navigation";
import { setYardAllowance, billableYardCount } from "@/lib/saas/billing";
import { canLowerAllowance } from "@/lib/saas/entitlements";
import { STATUS_LABEL, PER_YARD_DOLLARS, monthlyDollars, money, planLine } from "@/lib/saas/plan";

export const dynamic = "force-dynamic";

async function saveNptRate(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const n = Math.max(0, Math.min(1_000_000, parseInt(String(formData.get("npt") ?? ""), 10) || 0));
  const db = await saasDb();
  await db.from("saas_companies").update({ npt_day_estimate: n }).eq("id", company.id);
  revalidatePath("/app/settings/billing");
  revalidatePath("/app");
}

async function changeAllowance(formData: FormData) {
  "use server";
  const { requireCompany } = await import("@/lib/saas/auth");
  const { company } = await requireCompany();
  assertCan(company, "billing"); // owner only: this moves money
  if (company.subscription_status !== "active" && company.subscription_status !== "past_due") {
    redirect(`/app/settings/billing?err=${encodeURIComponent("Restart the subscription first, then change yards.")}`);
  }
  const dir = String(formData.get("dir"));
  const inUse = await billableYardCount(company.id);
  const target = company.yard_quantity + (dir === "up" ? 1 : -1);
  if (dir === "down") {
    const check = canLowerAllowance(target, inUse);
    if (!check.ok) redirect(`/app/settings/billing?err=${encodeURIComponent(check.reason ?? "Can't lower below yards in use.")}`);
  }
  const res = await setYardAllowance(company.id, target);
  if (!res.ok) redirect(`/app/settings/billing?err=${encodeURIComponent(res.error)}`);
  redirect("/app/settings/billing?changed=1");
}

export default async function BillingSettings({ searchParams }: { searchParams: Promise<{ err?: string; locked?: string; changed?: string }> }) {
  const { company } = await requireCompany();
  const { err, locked, changed } = await searchParams;
  const inUse = await billableYardCount(company.id);
  const db = await saasDb();
  const { data: comp } = await db.from("saas_companies").select("subscription_status, stripe_customer_id, npt_day_estimate").eq("id", company.id).maybeSingle();
  const c = comp as { subscription_status: string; stripe_customer_id: string | null; npt_day_estimate: number } | null;
  const status = c?.subscription_status ?? "none";
  const nptDay = c?.npt_day_estimate ?? 10000;
  const subscribed = status === "active" || status === "past_due";
  const owner = company.role === "owner";
  const plan = company.yard_quantity;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/app/settings" className="text-sm text-ink-dim hover:text-ink">← Settings</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-ink-dim">{money(PER_YARD_DOLLARS)} per yard, per month. Your whole crew, never per-seat.</p>
      </div>

      {locked ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          That needs an active subscription. Your records are safe, readable, and exportable meanwhile.
        </p>
      ) : null}
      {changed ? <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">Done. Stripe has the new yard count.</p> : null}
      {err ? <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p> : null}

      {company.comped ? (
        <Card className="p-5">
          <h2 className="font-semibold">Comped account</h2>
          <p className="mt-1 text-sm text-ink-dim">Unlimited yards, nothing billed.</p>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm text-ink-dim">Subscription</div>
              <div className="text-lg font-semibold">{STATUS_LABEL[status] ?? status}</div>
            </div>
            {owner ? (
              subscribed && c?.stripe_customer_id
                ? <BillingActions mode="portal" />
                : <Link href="/onboarding/billing" className={buttonClass("default", "lg")}>{status === "none" ? "Start the subscription" : "Restart the subscription"}</Link>
            ) : <span className="text-sm text-ink-faint">The account owner manages billing.</span>}
          </div>

          {subscribed ? (
            <>
              <div className="grid grid-cols-1 gap-3 border-t border-line pt-4 sm:grid-cols-3">
                <div><div className="text-sm text-ink-dim">Yards you pay for</div><div className="text-2xl font-semibold tabular-nums">{plan}</div></div>
                <div><div className="text-sm text-ink-dim">Yards set up</div><div className="text-2xl font-semibold tabular-nums">{inUse}</div></div>
                <div><div className="text-sm text-ink-dim">Monthly</div><div className="text-2xl font-semibold tabular-nums">{money(monthlyDollars(plan))}</div></div>
              </div>
              <p className="text-sm tabular-nums text-ink-dim">{planLine(plan)}</p>

              {owner ? (
                <div className="flex flex-col gap-3 border-t border-line pt-4">
                  <h2 className="font-semibold">Add or remove a yard</h2>
                  <div className="flex flex-wrap gap-2">
                    <form action={changeAllowance}>
                      <input type="hidden" name="dir" value="up" />
                      <button className={buttonClass("outline", "lg")}>Add a yard: {money(monthlyDollars(plan + 1))}/month</button>
                    </form>
                    {plan > 1 ? (
                      <form action={changeAllowance}>
                        <input type="hidden" name="dir" value="down" />
                        <button className={buttonClass("outline", "lg")} disabled={plan - 1 < inUse}>Remove a yard: {money(monthlyDollars(plan - 1))}/month</button>
                      </form>
                    ) : null}
                  </div>
                  <p className="text-sm text-ink-faint">
                    Changes go to Stripe right away and are prorated: adding a yard charges for the rest of this month on your next bill, removing one credits it.
                    {plan - 1 < inUse && plan > 1 ? ` To remove a yard, delete one of your ${inUse} yards first, under Yards. Nothing gets deleted for you.` : ""}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h2 className="text-sm font-medium text-ink">Your NPT day-rate</h2>
          <p className="mt-0.5 text-sm text-ink-dim">
            Used to estimate the downtime a caught miss saved you. This is <span className="text-ink">your estimate</span>, not a measured figure. Set it to what a day of non-productive time actually costs your shop.
          </p>
        </div>
        <form action={saveNptRate} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-ink-faint">
            NPT cost per day ($)
            <input name="npt" type="number" min={0} max={1000000} defaultValue={nptDay}
              className="h-11 w-40 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#1d4ed8]" />
          </label>
          <Button type="submit" size="sm">Save</Button>
        </form>
      </Card>
    </div>
  );
}
