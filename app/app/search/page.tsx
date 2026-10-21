import Link from "next/link";
import { Truck, Box, Search, Warehouse, ScanLine, PackageCheck, MapPin } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getEquipment, stateLabel } from "@/lib/saas/equipment";
import { getYardRules } from "@/lib/saas/yard-rules";
import { placeOf, daysOut, PLACE_LABEL, type Place } from "@/lib/saas/whereabouts";
import { searchPieces, matchesName } from "@/lib/saas/search";
import { unitTypeLabel, categoryLabel } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PLACE_TONE: Record<Place, string> = {
  red_tagged: "text-red-400", missing: "text-red-400", out_too_long: "text-red-400",
  out: "text-bone", on_truck: "text-ink-dim", in_yard: "text-ink-dim", retired: "text-ink-faint",
};
const STATE_TONE: Record<string, string> = { down: "text-red-400", overdue: "text-red-400", due: "text-amber-400", no_paper: "text-ink-faint", ok: "text-emerald-400", retired: "text-ink-faint" };
const clock = () => Date.now();
const act = (extra = "") => buttonClass("outline", "default", `h-11 ${extra}`);

/**
 * One search across the yard: a serial, a description, a truck, a yard, a
 * rack, a test, or a status ("red-tagged", "missing", "out", "out too long",
 * "out of test", "due"). Every result can jump to the piece, to where it is,
 * or straight into a load-out or a check-in.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { company } = await requireCompany();
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 80);
  const db = await saasDb();
  const [list, rules, { data: unitRows }] = await Promise.all([
    getEquipment(db, company.id),
    getYardRules(db, company.id),
    db.from("saas_units").select("id, name, type, identifier, yard_id").eq("company_id", company.id).order("name"),
  ]);
  const units = (unitRows ?? []) as { id: string; name: string; type: string; identifier: string | null; yard_id: string }[];
  const yardName = new Map(list.yards.map((y) => [y.id, y.name]));
  const now = clock();
  // How much of each truck's iron is out on a job and not checked back in.
  const outOn = new Map<string, number>();
  for (const r of list.rows) if (r.outSince && r.unitId && r.state !== "retired") outOn.set(r.unitId, (outOn.get(r.unitId) ?? 0) + 1);
  const outText = (days: number) => (days === 0 ? ", since today" : `, ${days} ${days === 1 ? "day" : "days"}`);

  const searchable = list.rows.filter((r) => r.state !== "retired").map((r) => ({
    ...r, serial: r.identifier, typeLabel: categoryLabel(r.category), nextTitle: r.next?.title ?? null,
    place: placeOf({ status: r.status, unit_id: r.unitId, out_since: r.outSince }, now, rules.outAlertDays),
  }));
  const pieces = query.length >= 2 ? searchPieces(searchable, query) : [];
  const trucks = query.length >= 2 ? units.filter((u) => matchesName(query, u.name, u.identifier, unitTypeLabel(u.type))).slice(0, 10) : [];
  const yards = query.length >= 2 ? list.yards.filter((y) => matchesName(query, y.name)).slice(0, 5) : [];
  const total = pieces.length + trucks.length + yards.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Search" description="A serial, a description, a truck, a yard, a rack, or a status like red-tagged, missing, out, out too long, out of test, or due." />

      <form action="/app/search" className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 focus-within:border-line-2">
        <Search className="h-5 w-5 text-ink-faint" />
        <input name="q" defaultValue={query} autoFocus enterKeyHint="search" placeholder="4471, plug valve, CT-03, out too long"
          className="h-12 w-full bg-transparent text-base text-ink placeholder:text-ink-faint outline-none" />
      </form>
      {query.length < 2 ? (
        <div className="flex flex-wrap gap-2">
          {["out too long", "out", "red-tagged", "missing", "out of test", "due"].map((s) => (
            <Link key={s} href={`/app/search?q=${encodeURIComponent(s)}`} className="flex h-11 items-center rounded-full border border-line-2 bg-surface px-4 text-sm text-ink-dim hover:text-ink">{s}</Link>
          ))}
        </div>
      ) : total === 0 ? (
        <Card className="px-6 py-10 text-center text-sm text-ink-dim">Nothing matches &ldquo;{query}&rdquo;. Try the serial off the band, or part of the name.</Card>
      ) : (
        <div className="flex flex-col gap-6">
          {pieces.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-ink-dim">Equipment ({pieces.length}{pieces.length === 50 ? "+" : ""})</h2>
              {pieces.map((p) => {
                const out = p.place === "out" || p.place === "out_too_long";
                const days = daysOut(p.outSince, now);
                return (
                  <Card key={p.id} className="flex flex-col gap-3 p-4">
                    <Link href={`/app/assets/${p.id}`} className="group flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><Box className="h-4 w-4 text-ink-dim" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="break-words font-semibold group-hover:text-bone">{p.name}{p.identifier ? <span className="font-normal text-ink-dim"> · {p.identifier}</span> : null}</div>
                        <div className="break-words text-sm text-ink-dim">{p.where}{p.note ? `, ${p.note}` : ""}</div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm">
                          <span className={cn("font-medium", PLACE_TONE[p.place])}>{PLACE_LABEL[p.place]}{out ? outText(days) : ""}</span>
                          {p.state === "down" ? null : <span className={STATE_TONE[p.state]}>{p.state === "ok" || p.state === "due" || p.state === "overdue" ? (p.next ? `${p.next.title}: ${p.next.detail}` : stateLabel(p)) : stateLabel(p)}</span>}
                        </div>
                      </div>
                    </Link>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/app/assets/${p.id}`} className={act()}>Open</Link>
                      <Link href={p.unitId ? `/app/units/${p.unitId}` : "/app/map"} className={act()}><MapPin className="h-4 w-4" /> {p.unitName ?? "Yard map"}</Link>
                      {out ? (
                        <Link href={p.unitId ? `/app/units/${p.unitId}/return` : "/app/return"} className={buttonClass("default", "default", "h-11")}><PackageCheck className="h-4 w-4" /> Check in</Link>
                      ) : p.unitId ? (
                        <Link href={`/app/units/${p.unitId}/scan`} className={act()}><ScanLine className="h-4 w-4" /> Load out {p.unitName}</Link>
                      ) : null}
                    </div>
                  </Card>
                );
              })}
            </section>
          )}
          {trucks.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-ink-dim">Trucks</h2>
              {trucks.map((u) => (
                <Card key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                  <Link href={`/app/units/${u.id}`} className="group flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><Truck className="h-4 w-4 text-ink-dim" /></span>
                    <div className="min-w-0">
                      <div className="font-semibold group-hover:text-bone">{u.name}</div>
                      <div className="text-sm text-ink-dim">{unitTypeLabel(u.type)}{u.identifier ? ` · ${u.identifier}` : ""} · {yardName.get(u.yard_id) ?? ""}{outOn.has(u.id) ? ` · ${outOn.get(u.id)} ${outOn.get(u.id) === 1 ? "piece" : "pieces"} out on a job` : ""}</div>
                    </div>
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    {outOn.has(u.id) ? <Link href={`/app/units/${u.id}/return`} className={buttonClass("default", "default", "h-11")}><PackageCheck className="h-4 w-4" /> Check in</Link> : null}
                    <Link href={`/app/units/${u.id}/scan`} className={outOn.has(u.id) ? act() : buttonClass("default", "default", "h-11")}><ScanLine className="h-4 w-4" /> Start load-out</Link>
                  </div>
                </Card>
              ))}
            </section>
          )}
          {yards.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-ink-dim">Yards</h2>
              {yards.map((y) => (
                <Card key={y.id} className="flex flex-wrap items-center gap-3 p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><Warehouse className="h-4 w-4 text-ink-dim" /></span>
                  <div className="min-w-0 flex-1 font-semibold">{y.name}</div>
                  <Link href={`/app?yard=${y.id}`} className={act()}>Trucks</Link>
                  <Link href="/app/map" className={act()}>Yard map</Link>
                </Card>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
