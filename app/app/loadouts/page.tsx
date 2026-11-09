import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { fmtWhen } from "@/lib/saas/format";
import { outcomeOf, reasonsOf, type LoadoutRecord, type LoadoutOutcome } from "@/lib/saas/loadout-record";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata = { title: "Load-out records" };

export const dynamic = "force-dynamic";

type Row = Pick<LoadoutRecord, "id" | "unit_id" | "unit_name" | "yard_id" | "finished_at" | "scanned_by" | "verdict" | "reasons" | "pieces" | "not_scanned">;
const LABEL: Record<LoadoutOutcome, string> = { ready: "READY", override: "Rolled on override", blocked: "NOT READY" };
const TONE: Record<LoadoutOutcome, string> = { ready: "text-emerald-400", override: "text-amber-400", blocked: "text-red-400" };

/** Every load-out record, newest first. Filter by yard, answer, or who scanned it. */
export default async function LoadoutsPage({ searchParams }: { searchParams: Promise<{ yard?: string; show?: string; by?: string }> }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const db = await saasDb();
  // The filters run in the database, so a pick finds every match, not just
  // the matches among the newest few hundred.
  const want = ["ready", "blocked", "override"].includes(sp.show ?? "") ? sp.show! : "";
  let q = db.from("saas_loadout_scans").select("id, unit_id, unit_name, yard_id, finished_at, scanned_by, verdict, reasons, pieces, not_scanned")
    .eq("company_id", company.id);
  if (sp.yard) q = q.eq("yard_id", sp.yard);
  if (sp.by) q = q.eq("scanned_by", sp.by);
  // Old records saved before the answer was stored (verdict null) are worked out below.
  if (want === "ready") q = q.or("verdict.eq.ready,verdict.is.null");
  else if (want) q = q.or("verdict.neq.ready,verdict.is.null");
  const SHOWN = 400;
  const [{ data: yardRows }, { data: rows }, { data: whoRows }] = await Promise.all([
    db.from("saas_yards").select("id, name").eq("company_id", company.id).order("name"),
    q.order("finished_at", { ascending: false }).limit(SHOWN),
    db.from("saas_loadout_scans").select("scanned_by").eq("company_id", company.id).not("scanned_by", "is", null).order("finished_at", { ascending: false }).limit(2000),
  ]);
  const yards = (yardRows ?? []) as { id: string; name: string }[];
  const all = (rows ?? []) as Row[];
  const capped = all.length >= SHOWN;
  const filtering = Boolean(sp.yard || sp.by || want);
  const any = all.length > 0 || filtering || ((whoRows ?? []) as unknown[]).length > 0;
  const { data: ov } = all.length
    ? await db.from("saas_loadout_overrides").select("loadout_id, by_name").eq("company_id", company.id).limit(20000)
    : { data: [] };
  const overrides = new Map(((ov ?? []) as { loadout_id: string; by_name: string }[]).map((o) => [o.loadout_id, o.by_name]));
  const people = [...new Set([...((whoRows ?? []) as { scanned_by: string }[]).map((r) => r.scanned_by), ...(sp.by ? [sp.by] : [])])].sort();

  const yard = yards.some((y) => y.id === sp.yard) ? sp.yard! : "";
  const show = ["ready", "blocked", "override"].includes(sp.show ?? "") ? sp.show! : "";
  const by = sp.by && people.includes(sp.by) ? sp.by : "";
  const list = all.map((r) => ({ r, o: outcomeOf(r, overrides.has(r.id) ? { loadout_id: r.id, by_name: overrides.get(r.id)!, reason: "", created_at: "" } : null) }))
    .filter(({ r, o }) => (!yard || r.yard_id === yard) && (!show || o === show) && (!by || r.scanned_by === by));

  const sel = "h-12 rounded-lg border border-line-2 bg-surface px-3 text-base text-ink outline-none focus:border-bone";
  return (
    <div className="flex flex-col gap-5">
      <PageHeader back={{ href: "/app", label: "Load out" }} title="Load-out records"
        description="Every load-out, locked when it was saved: who scanned what, when, and whether the truck could roll." />
      {any ? (
        // A file download, not a page: a plain link, so the browser saves it.
        <a href="/app/loadouts/export" download className="-mt-2 self-start text-sm text-bone underline underline-offset-2">Download every load-out as a spreadsheet</a>
      ) : null}

      <form className="grid grid-cols-1 gap-2 sm:grid-cols-4" action="/app/loadouts">
        {yards.length > 1 ? (
          <select name="yard" defaultValue={yard} aria-label="Yard" className={sel}>
            <option value="">All yards</option>
            {yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
        ) : null}
        <select name="show" defaultValue={show} aria-label="Answer" className={sel}>
          <option value="">READY and NOT READY</option>
          <option value="blocked">NOT READY only</option>
          <option value="override">Rolled on override</option>
          <option value="ready">READY only</option>
        </select>
        <select name="by" defaultValue={by} aria-label="Scanned by" className={sel}>
          <option value="">Anyone</option>
          {people.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button type="submit" className="h-12 rounded-lg bg-bone px-5 text-base font-medium text-white hover:bg-bone-soft">Show</button>
      </form>

      {capped ? <p className="-mt-2 text-sm text-ink-faint">Showing the newest {SHOWN}. The spreadsheet has every one.</p> : null}
      {list.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-dim">{filtering ? "Nothing matches." : <>No load-outs yet. Start one from the <Link href="/app" className="font-medium text-bone hover:underline">Load out screen</Link>.</>}</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map(({ r, o }) => {
            const byHand = r.pieces.filter((p) => p.how === "hand").length;
            const why = o === "ready" ? `${r.pieces.length} ${r.pieces.length === 1 ? "piece" : "pieces"} scanned` : reasonsOf(r)[0] ?? "";
            return (
              <Link key={r.id} href={`/app/loadouts/${r.id}`}>
                <Card className="flex items-center gap-3 p-4 hover:border-bone/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-semibold">{r.unit_name}</span>
                      <span className={cn("text-sm font-semibold", TONE[o])}>{LABEL[o]}</span>
                    </div>
                    <div className="text-sm text-ink-dim">{fmtWhen(r.finished_at)}{r.scanned_by ? ` by ${r.scanned_by}` : ""}{o === "override" ? `, override by ${overrides.get(r.id)}` : ""}</div>
                    {why ? <div className="truncate text-sm text-ink-faint">{why}</div> : null}
                    {byHand ? <div className="text-sm text-amber-400">{byHand} of {r.pieces.length} checked by hand</div> : null}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
