import Link from "next/link";
import RedressedButton from "./redressed-button";
import HandOff from "./hand-off";
import StockCard, { AddStock, type StockView } from "./stock-card";
import { getToolStocks, plural } from "@/lib/saas/tool-stock";
import { PackageCheck } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, saasAdmin } from "@/lib/saas/db";
import { getEquipment, stateLabel } from "@/lib/saas/equipment";
import { getYardRules } from "@/lib/saas/yard-rules";
import { daysOut } from "@/lib/saas/whereabouts";
import { fmtWhen, YARD_TZ } from "@/lib/saas/format";
import { TESTED_CATEGORIES } from "@/lib/saas/taxonomy";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import SignOutPicker, { type Pickable } from "./picker";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tools out" };

/** The time now, read outside render (the page renders once per request). */
const clock = () => Date.now();

/**
 * Tools out: the sign-out sheet, replaced. Who has what and since when, what
 * needs redress before it runs again, and a list to sign tools out from.
 * Everything here has a name and a time on it.
 */
export default async function ToolsOutPage() {
  const { company, user } = await requireCompany();
  const db = await saasDb();
  const now = clock();
  const [list, rules, { data: mineRows }, { data: redressRows }, { data: sheetRows }, stocks] = await Promise.all([
    getEquipment(db, company.id),
    getYardRules(db, company.id),
    db.from("saas_assets").select("id, out_with_user").eq("company_id", company.id).not("out_with_user", "is", null),
    db.from("saas_assets").select("id").eq("company_id", company.id).eq("redress_each_run", true),
    db.from("saas_signouts").select("id, asset_id, asset_name, serial, out_name, job_note, out_at, back_at, back_by, back_note")
      .eq("company_id", company.id).order("out_at", { ascending: false }).limit(60),
    getToolStocks(db, company.id),
  ]);
  const holders = (mineRows ?? []) as { id: string; out_with_user: string }[];
  const holderOf = new Map(holders.map((r) => [r.id, r.out_with_user]));
  // A manager at the counter can hand a tool to anyone on the crew, and
  // whoever has a tool can hand it to someone on location.
  const manager = company.role === "owner" || company.role === "admin";
  const crew: { id: string; name: string }[] = [];
  const admin = manager || holders.some((r) => r.out_with_user === user.id) ? saasAdmin() : null;
  if (admin) {
    const { data: mem } = await admin.from("saas_memberships").select("user_id").eq("company_id", company.id).eq("status", "active").limit(100);
    // All at once, not one after another: a 40-man crew is one wait, not 40.
    const people = await Promise.all(((mem ?? []) as { user_id: string }[]).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      return { id: m.user_id, name: (data?.user?.user_metadata?.full_name as string | undefined)?.trim() || data?.user?.email?.split("@")[0] || "Someone" };
    }));
    crew.push(...people);
    crew.sort((a, b) => Number(b.id === user.id) - Number(a.id === user.id) || a.name.localeCompare(b.name));
  }
  const mine = new Set(holders.filter((r) => r.out_with_user === user.id).map((r) => r.id));
  const redressKind = new Set(((redressRows ?? []) as { id: string }[]).map((r) => r.id));
  const live = list.rows.filter((r) => r.state !== "retired");
  const withPeople = live.filter((r) => r.outWith).sort((a, b) => (a.outSince ?? "").localeCompare(b.outSince ?? ""));
  const withMe = withPeople.filter((r) => mine.has(r.id));
  const withCrew = withPeople.filter((r) => !mine.has(r.id));
  const needsRedress = live.filter((r) => r.needsRedress && r.status !== "out_of_service" && r.status !== "missing");
  // Tools that left on a truck, not with a person: still out, just not on the sheet.
  const onTrucks = live.filter((r) => r.outSince && !r.outWith && (redressKind.has(r.id) || r.category === "tool"))
    .sort((a, b) => (a.outSince ?? "").localeCompare(b.outSince ?? ""));
  const sheet = (sheetRows ?? []) as { id: string; asset_id: string; asset_name: string; serial: string | null; out_name: string; job_note: string | null; out_at: string; back_at: string | null; back_by: string | null; back_note: string | null }[];

  // What can be picked: everything not out. Bad pieces, and pieces already
  // out, show why and can't be picked (so a search still finds them).
  const pickable: Pickable[] = live.map((r) => {
    const since = r.outSince ? (daysOut(r.outSince, now) === 0 ? "since today" : `${daysOut(r.outSince, now)} ${daysOut(r.outSince, now) === 1 ? "day" : "days"}`) : "";
    const why = r.outWith ? `Out with ${r.outWith}, ${since}`
      : r.outSince ? `Out on ${r.unitName ?? "a job"}, ${since}`
      : r.state === "down" ? stateLabel(r)
      : r.state === "overdue" ? (r.next ? `${r.next.title}: ${r.next.detail}` : "No test on file")
      : r.state === "no_paper" && TESTED_CATEGORIES.has(r.category) ? (r.next ? "No paper" : "No test on file")
      : null;
    return { id: r.id, name: r.name, serial: r.identifier, where: r.where, blocked: why, redress: redressKind.has(r.id),
      usual: !r.outSince && (redressKind.has(r.id) || r.category === "tool" || !r.unitId) };
  }).sort((a, b) => Number(b.redress) - Number(a.redress) || Number(b.usual) - Number(a.usual) || a.name.localeCompare(b.name));

  const row = (r: (typeof live)[number], me: boolean) => {
    const d = r.outSince ? daysOut(r.outSince, now) : 0;
    const late = d >= rules.outAlertDays;
    return (
      <div key={r.id} className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border p-3", late ? "border-red-500/40 bg-red-500/[0.06]" : "border-line bg-surface")}>
        <div className="min-w-0">
          <Link href={`/app/assets/${r.id}`} className="break-words text-sm font-semibold hover:text-bone">{r.name}{r.identifier ? <span className="font-normal text-ink-dim"> · {r.identifier}</span> : null}</Link>
          <div className={cn("text-[13px]", late ? "font-medium text-red-400" : "text-ink-dim")}>
            {me ? "With you" : `With ${r.outWith}`} · {d === 0 ? "since today" : `${d} ${d === 1 ? "day" : "days"}`}{late ? `, past the ${rules.outAlertDays}-day limit` : ""}
          </div>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {me ? <Link href={`/app/return?asset=${r.id}`} className={buttonClass("outline", "default", "min-h-11")}><PackageCheck className="h-4 w-4" /> Check it back in</Link> : null}
          {(me || manager) && crew.length > 1 ? <HandOff assetId={r.id} holder={holderOf.get(r.id) ?? null} crew={crew} redress={redressKind.has(r.id)} /> : null}
        </div>
      </div>
    );
  };

  // Setting tools a vendor stocks, by count, for each yard that has them.
  const month = new Date(now).toLocaleDateString("en-US", { timeZone: YARD_TZ, month: "long" });
  const stockViews: StockView[] = stocks.map((st) => ({
    id: st.id, name: st.name, plural: plural(st.name), vendor: st.vendor, yardName: st.yardName,
    ready: st.ready, used: st.used, lowAt: st.lowAt, out: st.out, ranThisMonth: st.ranThisMonth,
    lastVendor: st.lastVendor ? { when: fmtWhen(st.lastVendor.at), note: st.lastVendor.note } : null,
    outs: st.outs.map((o) => ({ id: o.id, userId: o.userId, name: o.name, qty: o.qty, note: o.note, days: daysOut(o.outAt, now) })),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tools out" description="Who has what and since when, what's ready on the shelf, and what's used and waiting on pickup. This replaces the sign-out sheet." />

      {stockViews.length || manager ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Setting tools</h2>
          {stockViews.map((st) => <StockCard key={st.id} stock={st} me={user.id} manager={manager} crew={crew} alertDays={rules.outAlertDays} month={month} />)}
          {manager ? <AddStock yards={list.yards} /> : null}
        </section>
      ) : null}

      {withMe.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">With you</h2>
          {withMe.map((r) => row(r, true))}
        </section>
      ) : null}

      {needsRedress.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Needs redress before it runs again</h2>
          {needsRedress.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3">
              <Link href={`/app/assets/${r.id}`} className="min-w-0 break-words text-sm font-semibold hover:text-bone">{r.name}{r.identifier ? <span className="font-normal text-ink-dim"> · {r.identifier}</span> : null}</Link>
              <RedressedButton assetId={r.id} />
            </div>
          ))}
        </section>
      ) : null}

      <SignOutPicker pieces={pickable} crew={crew} me={user.id} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Out with the crew ({withCrew.length})</h2>
        {withCrew.length ? withCrew.map((r) => row(r, false)) : <Card className="p-4 text-sm text-ink-dim">Nothing is signed out to anyone else.</Card>}
      </section>

      {onTrucks.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Out on a truck ({onTrucks.length})</h2>
          {onTrucks.map((r) => {
            const d = r.outSince ? daysOut(r.outSince, now) : 0;
            const late = d >= rules.outAlertDays;
            return (
              <div key={r.id} className={cn("rounded-xl border p-3", late ? "border-red-500/40 bg-red-500/[0.06]" : "border-line bg-surface")}>
                <Link href={`/app/assets/${r.id}`} className="break-words text-sm font-semibold hover:text-bone">{r.name}{r.identifier ? <span className="font-normal text-ink-dim"> · {r.identifier}</span> : null}</Link>
                <div className={cn("text-[13px]", late ? "font-medium text-red-400" : "text-ink-dim")}>
                  On {r.unitName ?? "a truck"} · {d === 0 ? "since today" : `${d} ${d === 1 ? "day" : "days"}`}{late ? `, past the ${rules.outAlertDays}-day limit` : ""}
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">The sheet</h2>
        <p className="-mt-1 text-[13px] text-ink-faint">Every sign-out, newest first. Nobody can edit it.</p>
        {sheet.length ? (
          <div className="flex flex-col gap-2">
            {sheet.map((s) => (
              <div key={s.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
                <div className="break-words font-medium">{s.asset_name}{s.serial ? <span className="font-normal text-ink-dim"> · {s.serial}</span> : null}</div>
                <div className="text-[13px] text-ink-dim">
                  Out with {s.out_name} {fmtWhen(s.out_at)}{s.job_note ? `, for ${s.job_note}` : ""}.{" "}
                  {s.back_at ? `Back ${fmtWhen(s.back_at)}${s.back_by ? ` by ${s.back_by}` : ""}${s.back_note ? ` (${s.back_note})` : ""}.` : <span className="font-medium text-amber-400">Still out.</span>}
                </div>
              </div>
            ))}
          </div>
        ) : <Card className="p-4 text-sm text-ink-dim">Nothing signed out yet.</Card>}
      </section>
    </div>
  );
}
