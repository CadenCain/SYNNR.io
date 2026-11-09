import Link from "next/link";
import { PackageCheck } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getEquipment, stateLabel } from "@/lib/saas/equipment";
import { getYardRules } from "@/lib/saas/yard-rules";
import { daysOut } from "@/lib/saas/whereabouts";
import { fmtWhen } from "@/lib/saas/format";
import { TESTED_CATEGORIES } from "@/lib/saas/taxonomy";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markRedressed } from "./actions";
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
  const [list, rules, { data: mineRows }, { data: redressRows }, { data: sheetRows }] = await Promise.all([
    getEquipment(db, company.id),
    getYardRules(db, company.id),
    db.from("saas_assets").select("id").eq("company_id", company.id).eq("out_with_user", user.id),
    db.from("saas_assets").select("id").eq("company_id", company.id).eq("redress_each_run", true),
    db.from("saas_signouts").select("id, asset_id, asset_name, serial, out_name, job_note, out_at, back_at, back_by, back_note")
      .eq("company_id", company.id).order("out_at", { ascending: false }).limit(25),
  ]);
  const mine = new Set(((mineRows ?? []) as { id: string }[]).map((r) => r.id));
  const redressKind = new Set(((redressRows ?? []) as { id: string }[]).map((r) => r.id));
  const live = list.rows.filter((r) => r.state !== "retired");
  const withPeople = live.filter((r) => r.outWith).sort((a, b) => (a.outSince ?? "").localeCompare(b.outSince ?? ""));
  const withMe = withPeople.filter((r) => mine.has(r.id));
  const withCrew = withPeople.filter((r) => !mine.has(r.id));
  const needsRedress = live.filter((r) => r.needsRedress && r.status !== "out_of_service" && r.status !== "missing");
  const sheet = (sheetRows ?? []) as { id: string; asset_id: string; asset_name: string; serial: string | null; out_name: string; job_note: string | null; out_at: string; back_at: string | null; back_by: string | null; back_note: string | null }[];

  // What can be picked: everything not out. Bad pieces show why and can't be picked.
  const pickable: Pickable[] = live.filter((r) => !r.outSince).map((r) => {
    const why = r.state === "down" ? stateLabel(r)
      : r.state === "overdue" ? (r.next ? `${r.next.title}: ${r.next.detail}` : "Out of test")
      : r.state === "no_paper" && TESTED_CATEGORIES.has(r.category) ? (r.next ? "No paper" : "No test on file")
      : null;
    return { id: r.id, name: r.name, serial: r.identifier, where: r.where, blocked: why, redress: redressKind.has(r.id),
      usual: redressKind.has(r.id) || r.category === "tool" || !r.unitId };
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
        {me ? <Link href="/app/return" className={buttonClass("outline", "default", "min-h-11")}><PackageCheck className="h-4 w-4" /> Check it back in</Link> : null}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tools out" description="Sign tools out under your name, see who has what, and redress what came back. This replaces the sign-out sheet." />

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
              <form action={markRedressed}>
                <input type="hidden" name="asset_id" value={r.id} />
                <button type="submit" className={buttonClass("default", "default", "min-h-11")}>Redressed</button>
              </form>
            </div>
          ))}
        </section>
      ) : null}

      <SignOutPicker pieces={pickable} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">Out with the crew ({withCrew.length})</h2>
        {withCrew.length ? withCrew.map((r) => row(r, false)) : <Card className="p-4 text-sm text-ink-dim">Nothing is signed out to anyone else.</Card>}
      </section>

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
