import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import BillingActions from "./billing-actions";

export const dynamic = "force-dynamic";

const PER_YARD = 500;

async function saveNptRate(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const n = Math.max(0, Math.min(1_000_000, parseInt(String(formData.get("npt") ?? ""), 10) || 0));
  const db = await saasDb();
  await db.from("saas_companies").update({ npt_day_estimate: n }).eq("id", company.id);
  revalidatePath("/app/settings/billing");
  revalidatePath("/app");
}

const STATUS_LABEL: Record<string, string> = {
  trialing: "Free trial", active: "Active", past_due: "Payment failed", canceled: "Canceled", none: "No subscription",
};

export default async function BillingSettings() {
  const { company } = await requireCompany();
  const db = await saasDb();

  const [{ data: comp }, { count: yardCount }] = await Promise.all([
    db.from("saas_companies").select("subscription_status, trial_ends_at, stripe_customer_id, npt_day_estimate").eq("id", company.id).maybeSingle(),
    db.from("saas_yards").select("id", { count: "exact", head: true }).eq("company_id", company.id),
  ]);
  const c = (comp as { subscription_status: string; trial_ends_at: string | null; stripe_customer_id: string | null; npt_day_estimate: number } | null);
  const status = c?.subscription_status ?? "none";
  const nptDay = c?.npt_day_estimate ?? 10000;
  const yards = Math.max(1, yardCount ?? 0);
  const subscribed = status === "active" || status === "past_due";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/app/settings" className="text-sm text-ink-dim hover:text-ink">← Settings</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-ink-dim">Per yard, per month. Scales with your operation.</p>
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-ink-dim">Status</div>
            <div className="text-lg font-semibold">{STATUS_LABEL[status] ?? status}</div>
            {status === "trialing" && c?.trial_ends_at ? (
              <div className="mt-0.5 text-sm text-ink-faint">Trial ends {new Date(c.trial_ends_at).toLocaleDateString()}</div>
            ) : null}
          </div>
          <BillingActions subscribed={subscribed} />
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-3">
          <div><div className="text-sm text-ink-dim">Yards</div><div className="text-xl font-semibold tabular-nums">{yardCount ?? 0}</div></div>
          <div><div className="text-sm text-ink-dim">Per yard</div><div className="text-xl font-semibold tabular-nums">${PER_YARD}/mo</div></div>
          <div><div className="text-sm text-ink-dim">Estimated</div><div className="text-xl font-semibold tabular-nums">${(yards * PER_YARD).toLocaleString()}/mo</div></div>
        </div>
      </Card>

      <p className="text-xs text-ink-faint">
        Billed monthly at ${PER_YARD} per active yard. Add or remove yards anytime — your subscription quantity follows.
        Card required, cancel anytime, your data stays exportable.
      </p>

      <Card className="flex flex-col gap-3 p-5">
        <div>
          <h2 className="text-sm font-medium text-ink">Your NPT day-rate</h2>
          <p className="mt-0.5 text-sm text-ink-dim">
            Used on the dashboard to estimate avoided downtime from caught misses. This is <span className="text-ink">your estimate</span>, not a measured figure — set it to what a day of non-productive time actually costs your shop.
          </p>
        </div>
        <form action={saveNptRate} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-ink-faint">
            NPT cost per day ($)
            <input name="npt" type="number" min={0} max={1000000} defaultValue={nptDay}
              className="h-11 w-40 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]" />
          </label>
          <Button type="submit" size="sm">Save</Button>
        </form>
      </Card>
    </div>
  );
}
