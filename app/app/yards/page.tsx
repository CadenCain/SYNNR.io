import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MapPin, Plus, ChevronRight, Upload } from "lucide-react";
import { requireCompany, requireBillableCompany, assertCan } from "@/lib/saas/auth";
import { isRecentDuplicate } from "@/lib/saas/dedupe";
import { saasDb } from "@/lib/saas/db";
import { getCompanyReadiness } from "@/lib/saas/readiness";
import { setYardAllowance, billableYardCount } from "@/lib/saas/billing";
import { yardCapState, isWritable } from "@/lib/saas/entitlements";
import { isBillableYard } from "@/lib/saas/billing-rules";
import { Card } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * THE HARD CAP lives here (owner's spec, 2026-08-19): the checkout quantity
 * is a paid allowance. Under it, creating a yard is frictionless. At it, the
 * form is replaced by a wall with a one-tap upgrade (owner only) — nothing
 * ever silently moves the bill, in either direction.
 */

async function createYard(formData: FormData) {
  "use server";
  const { company } = await requireBillableCompany();
  assertCan(company, "create_yard");
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  if (!name) return;
  const db = await saasDb();
  // Server-side cap check — the wall in the UI is presentation, this is law.
  const inUse = await billableYardCount(company.id);
  if (yardCapState(inUse, company.yard_quantity, company.comped).atCap) {
    redirect("/app/yards?atcap=1");
  }
  if (await isRecentDuplicate(db, "saas_yards", { company_id: company.id, name })) {
    revalidatePath("/app/yards");
    return; // double-tap echo
  }
  const { error } = await db.from("saas_yards").insert({ company_id: company.id, name, location });
  if (error) throw new Error(error.message);
  revalidatePath("/app/yards");
}

async function addYardWithUpgrade(formData: FormData) {
  "use server";
  const { company } = await requireBillableCompany();
  // Raising the bill is the owner's alone.
  assertCan(company, "billing");
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  if (!name) return;
  const inUse = await billableYardCount(company.id);
  // One tap: quantity up (prorated), then the yard, same flow. If Stripe
  // refuses, NO yard is created and the real error is shown.
  const res = await setYardAllowance(company.id, Math.max(company.yard_quantity, inUse) + 1);
  if (!res.ok) redirect(`/app/yards?err=${encodeURIComponent(res.error)}`);
  const db = await saasDb();
  const { error } = await db.from("saas_yards").insert({ company_id: company.id, name, location });
  if (error) redirect(`/app/yards?err=${encodeURIComponent(error.message)}`);
  revalidatePath("/app/yards");
  redirect("/app/yards");
}

export default async function YardsPage({ searchParams }: { searchParams: Promise<{ atcap?: string; err?: string }> }) {
  const { company } = await requireCompany();
  const { atcap, err } = await searchParams;
  const db = await saasDb();
  const { data } = await db
    .from("saas_yards")
    .select("id, name, location, saas_units(count), saas_assets(count)")
    .eq("company_id", company.id)
    .order("name");
  type Row = { id: string; name: string; location: string | null; saas_units: { count: number }[]; saas_assets: { count: number }[] };
  const yards = (data ?? []) as Row[];
  const rd = await getCompanyReadiness(db, company.id);
  const yardTrouble = new Map<string, { notReady: number; dueSoon: number }>();
  for (const u of rd.units) {
    const t = yardTrouble.get(u.yardId) ?? { notReady: 0, dueSoon: 0 };
    if (u.state === "not_ready") t.notReady++;
    if (u.state === "due_soon") t.dueSoon++;
    yardTrouble.set(u.yardId, t);
  }

  const inUse = yards.filter((y) => isBillableYard(y.name)).length;
  const cap = yardCapState(inUse, company.yard_quantity, company.comped);
  const writable = isWritable(company.subscription_status, company.comped);
  const hasSubscription = company.subscription_status !== "none";
  const canAdd = company.role !== "member";
  const isOwner = company.role === "owner";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Yards</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Each yard holds your trucks, shops, assets, and certs.
            {company.comped
              ? " Comped account — unlimited yards."
              : ` Using ${inUse} of ${company.yard_quantity} on your plan.`}
          </p>
        </div>
        <Link href="/app/import" className={buttonClass("outline", "sm")}><Upload className="h-4 w-4" /> Import</Link>
      </div>

      {err ? <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p> : null}

      {yards.length > 0 && (
        <div className="flex flex-col gap-2">
          {yards.map((y) => (
            <Link key={y.id} href={`/app/yards/${y.id}`}>
              <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-2 hover:bg-surface">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
                  <MapPin className="h-5 w-5 text-ink-dim" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{y.name}</div>
                  <div className="truncate text-sm text-ink-dim">
                    {y.location ? y.location + " · " : ""}
                    {y.saas_units?.[0]?.count ?? 0} units · {y.saas_assets?.[0]?.count ?? 0} assets
                    {(() => { const t = yardTrouble.get(y.id);
                      if (!t || (t.notReady === 0 && t.dueSoon === 0)) return null;
                      return <> · {t.notReady > 0 ? <span className="font-medium text-red-400">{t.notReady} not ready</span> : null}{t.notReady > 0 && t.dueSoon > 0 ? " · " : ""}{t.dueSoon > 0 ? <span className="text-amber-400">{t.dueSoon} due soon</span> : null}</>; })()}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!canAdd ? null : (!writable || !hasSubscription) && !company.comped ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">{hasSubscription ? "Your subscription has ended." : "No subscription yet."}</h2>
          {isOwner ? (
            <>
              <p className="mt-1 text-sm text-ink-dim">
                {hasSubscription
                  ? "Restart billing to keep building your yard — everything you entered is still here."
                  : "Yards live on a plan — $500/mo each. Start yours and this page opens up."}
              </p>
              <Link href={hasSubscription ? "/app/settings/billing" : "/onboarding/billing"} className={`${buttonClass("default")} mt-3 inline-flex`}>
                {hasSubscription ? "Restart billing" : "Start your subscription"}
              </Link>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-dim">Ask your account owner to set up billing.</p>
          )}
        </Card>
      ) : cap.atCap && !company.comped ? (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">You&apos;re on {company.yard_quantity} yard{company.yard_quantity === 1 ? "" : "s"}.</h2>
          {isOwner ? (
            <>
              <p className="mt-1 text-sm text-ink-dim">
                Add {company.yard_quantity === 0 ? "your first" : `a ${company.yard_quantity + 1}th`} to your plan for $500/mo more, prorated from today.
              </p>
              {atcap ? <p className="mt-1 text-xs text-amber-400">That last one didn&apos;t go through — you were at your limit.</p> : null}
              <form action={addYardWithUpgrade} className="mt-3 flex flex-col gap-3 sm:flex-row">
                <input name="name" required placeholder="Yard name (e.g. Midland Yard)"
                  className="h-11 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]" />
                <input name="location" placeholder="Location (optional)"
                  className="h-11 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]" />
                <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add a yard — $500/mo</Button>
              </form>
            </>
          ) : (
            <p className="mt-1 text-sm text-ink-dim">You&apos;re at your yard limit. Ask your account owner to add one.</p>
          )}
        </Card>
      ) : (
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-medium text-ink">{yards.length ? "Add another yard" : "Add your first yard"}</h2>
          <form action={createYard} className="flex flex-col gap-3 sm:flex-row">
            <input name="name" required placeholder="Yard name (e.g. Midland Yard)"
              className="h-11 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]" />
            <input name="location" placeholder="Location (optional)"
              className="h-11 flex-1 rounded-lg border border-line-2 bg-surface px-3 text-ink outline-none focus:border-[#e7ddc7]" />
            <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add yard</Button>
          </form>
          <p className="mt-2 text-xs text-ink-faint">
            {company.comped
              ? "Comped account — add what you need. The sample yard is always free."
              : `You're on ${company.yard_quantity} yard${company.yard_quantity === 1 ? "" : "s"}. Need another past that? Add it to your plan anytime — $500/mo each, prorated. The sample yard is free and doesn't count.`}
          </p>
        </Card>
      )}
    </div>
  );
}
