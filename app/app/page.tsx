import Link from "next/link";
import {
  Warehouse, Plus, Upload, AlertTriangle, Clock, ShieldCheck, Gauge, Truck,
  Flame, Activity, HardHat, Sparkles, Trash2,
} from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { getCompanyReadiness, type UnitTile } from "@/lib/saas/readiness";
import { Card } from "@/components/ui/card";
import { buttonClass, Button } from "@/components/ui/button";
import { StatusBadge, StatusDot } from "@/components/ui/status-badge";
import { kindLabel } from "@/lib/saas/taxonomy";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import ShareProof from "./_components/share-proof";
import { loadSampleYard, clearSampleYard } from "./_actions";
import { Sparkline } from "@/components/ui/sparkline";

export const dynamic = "force-dynamic";

/**
 * The Readiness Command Center (spec Phase 2) — the screen an owner leaves
 * open all day: KPIs that mean something, a fleet board, the day's flow,
 * and a real activity feed. No GPS anywhere — "Out" comes from open
 * checkouts, not telematics.
 */

interface Item { id: string; title: string; kind: string; expiration_date: string | null; status: ComplianceStatus; parent_type: string; parent_id: string; }

const STATE_UI = {
  ready: { chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", label: "Ready" },
  due_soon: { chip: "border-amber-500/30 bg-amber-500/10 text-amber-400", label: "Due soon" },
  not_ready: { chip: "border-red-500/40 bg-red-500/10 text-red-400", label: "Not ready" },
  not_setup: { chip: "border-line-2 bg-elevated text-ink-faint", label: "Not set up" },
} as const;
const STATE_ORDER: Record<UnitTile["state"], number> = { not_ready: 0, due_soon: 1, ready: 2, not_setup: 3 };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ yard?: string }> }) {
  const { company, user } = await requireCompany();
  const { yard: yardParam } = await searchParams;
  const db = await saasDb();
  const first = ((user.user_metadata?.full_name as string | undefined)?.trim().split(" ")[0]) || user.email?.split("@")[0] || "there";
  const nptDay = company.npt_day_estimate;

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [rd, { data: yardData }, { data: itemData }, { data: eventData }, { data: monthChecks }, { data: alertsMonth }, { data: sampleYard }] = await Promise.all([
    getCompanyReadiness(db, company.id),
    db.from("saas_yards").select("id, name").eq("company_id", company.id).order("name"),
    db.from("saas_compliance_items_with_status").select("id, title, kind, expiration_date, status, parent_type, parent_id").eq("company_id", company.id),
    db.from("saas_events").select("kind, message, actor, created_at").eq("company_id", company.id)
      .neq("kind", "miss_caught") // KPI counter only — its message duplicates check_not_ready in the feed
      .order("created_at", { ascending: false }).limit(20),
    db.from("saas_dispatch_checks").select("id, unit_id, type, status, started_at")
      .eq("company_id", company.id).gte("started_at", monthStart.toISOString()),
    db.from("saas_alerts_sent").select("id").eq("company_id", company.id).gte("sent_at", monthStart.toISOString()),
    db.from("saas_yards").select("id").eq("company_id", company.id).eq("name", "Sample Yard (demo)").maybeSingle(),
  ]);

  const items = (itemData ?? []) as Item[];
  const events = (eventData ?? []) as { kind: string; message: string; actor: string | null; created_at: string }[];
  type Chk = { id: string; unit_id: string; type: string; status: string; started_at: string };
  const checksMonth = (monthChecks ?? []) as Chk[];
  const { count: missCount } = await db.from("saas_events").select("id", { count: "exact", head: true })
    .eq("company_id", company.id).eq("kind", "miss_caught").gte("created_at", monthStart.toISOString());
  const missesCaught = missCount ?? 0;

  // Real week-over-week deltas from the event stream (no fabricated trends).
  const weekAgo = new Date(Date.now() - 7 * 86400e3).toISOString();
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400e3).toISOString();
  const countEvents = async (kind: string, from: string, to?: string) => {
    let q = db.from("saas_events").select("id", { count: "exact", head: true })
      .eq("company_id", company.id).eq("kind", kind).gte("created_at", from);
    if (to) q = q.lt("created_at", to);
    const { count } = await q;
    return count ?? 0;
  };
  const [missThisWk, missLastWk, { data: snapData }] = await Promise.all([
    countEvents("miss_caught", weekAgo),
    countEvents("miss_caught", twoWeeksAgo, weekAgo),
    db.from("saas_readiness_snapshots")
      .select("day, readiness, misses_caught")
      .eq("company_id", company.id)
      .order("day", { ascending: true })
      .limit(14),
  ]);
  type Snap = { day: string; readiness: number | null; misses_caught: number };
  const snaps = (snapData ?? []) as Snap[];
  const spark = {
    readiness: snaps.map((s) => s.readiness),
    misses: snaps.map((s) => s.misses_caught as number | null),
  };
  const delta = (now: number, prev: number) =>
    now === prev ? "even with last week" : now > prev ? `+${now - prev} vs last week` : `${now - prev} vs last week`;
  const notReadyMonth = checksMonth.filter((c) => c.type === "checkout" && (c.status === "not_ready" || c.status === "not_ready_override")).length;
  const warningsMonth = (alertsMonth ?? []).length;
  const hasSample = Boolean(sampleYard);

  const yards = (yardData ?? []) as { id: string; name: string }[];
  const yardCount = yards.length;
  // Yard filter: ?yard=<id> scopes the board, the Not-ready KPI, and the
  // needs-attention list to one yard. Crew cards are company-wide and stay.
  const activeYard = yards.find((y) => y.id === yardParam) ?? null;
  const boardUnits = activeYard ? rd.units.filter((u) => u.yardId === activeYard.id) : rd.units;
  const unitYardById = new Map(rd.units.map((u) => [u.id, u.yardId]));
  const notReadyUnits = boardUnits.filter((u) => u.state === "not_ready").length;

  let assetYardById = new Map<string, string | null>();
  if (activeYard) {
    const { data: assetRows } = await db.from("saas_assets").select("id, yard_id, unit_id").eq("company_id", company.id);
    assetYardById = new Map(((assetRows ?? []) as { id: string; yard_id: string | null; unit_id: string | null }[])
      .map((a) => [a.id, a.yard_id ?? (a.unit_id ? unitYardById.get(a.unit_id) ?? null : null)]));
  }
  const inYard = (i: Item) =>
    !activeYard ? true
    : i.parent_type === "unit" ? unitYardById.get(i.parent_id) === activeYard.id
    : i.parent_type === "asset" ? assetYardById.get(i.parent_id) === activeYard.id
    : true; // crew cards are company-wide — they roll with any yard's trucks
  const actionList = items
    .filter(inYard)
    .filter((i) => i.status === "expired" || i.status === "expiring" || i.status === "none")
    .sort((a, b) => {
      const rank = (s: string) => (s === "expired" ? 0 : s === "none" ? 1 : 2);
      return rank(a.status) - rank(b.status) || (a.expiration_date ?? "").localeCompare(b.expiration_date ?? "");
    })
    .slice(0, 12);
  const hrefFor = (i: Item) => i.parent_type === "unit" ? `/app/units/${i.parent_id}` : i.parent_type === "crew" ? `/app/crew/${i.parent_id}` : `/app/assets/${i.parent_id}`;

  // The actionable number leads: which trucks are down RIGHT NOW. The blended
  // readiness % is context, not the headline — a foreman acts on counts.
  const kpis: { icon: typeof Gauge; label: string; value: string | number; accent: string; href: string; bar?: number; sub?: string; spark?: (number | null)[]; sparkColor?: string }[] = [
    { icon: Truck, label: activeYard ? `Not ready — ${activeYard.name}` : "Not ready", value: notReadyUnits, accent: notReadyUnits > 0 ? "text-red-400" : "text-emerald-400", href: "/app/dispatch", sub: notReadyUnits > 0 ? "units failing right now — fix these first" : "every unit current" },
    rd.readiness === null
      ? { icon: Gauge, label: "Readiness", value: "Not set up yet", accent: "text-ink-faint", href: "/app/compliance", sub: "add gear & certs to score it" }
      : { icon: Gauge, label: "Readiness", value: `${rd.readiness}%`, accent: rd.readiness >= 90 ? "text-emerald-400" : rd.readiness >= 60 ? "text-amber-400" : "text-red-400", bar: rd.readiness, href: "/app/compliance", spark: spark.readiness, sparkColor: "#e7ddc7" },
    { icon: Flame, label: "Misses caught", value: missesCaught, accent: missesCaught > 0 ? "text-emerald-400" : "text-ink-dim", href: "#activity", sub: missesCaught > 0 ? `before rollout · ${delta(missThisWk, missLastWk)}` : "before rollout, this month", spark: spark.misses, sparkColor: "#34d399" },
    { icon: Clock, label: "Expiring in 30d", value: rd.counts.expiring, accent: "text-amber-400", href: "/app/alerts" },
    { icon: AlertTriangle, label: "NOT-ready checks", value: notReadyMonth, accent: notReadyMonth > 0 ? "text-red-400" : "text-ink-dim", href: "#activity", sub: "recorded this month" },
  ];

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Hello, {first}</h1>
          <p className="mt-1 text-sm text-ink-dim">Here&apos;s where {company.name} stands right now.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShareProof scope="company" />
          <Link href="/app/dispatch" className={buttonClass("default")}>
            <Truck className="h-[18px] w-[18px]" /> Run a check
          </Link>
        </div>
      </div>

      {/* KPI strip — every number clickable, every number honest */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href}>
              <Card className="h-full p-4 transition-colors hover:border-line-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-dim">{k.label}</span>
                  <Icon className={`h-4 w-4 ${k.accent}`} />
                </div>
                <div className={`mt-3 font-semibold tabular-nums tracking-tight ${typeof k.value === "string" && k.value.length > 6 ? "text-lg text-ink-dim" : "text-3xl"}`}>{k.value}</div>
                {typeof k.bar === "number" ? (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div className={`h-full rounded-full ${k.bar >= 90 ? "bg-emerald-500" : k.bar >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${k.bar}%` }} />
                  </div>
                ) : (
                  <div className="mt-1.5 min-h-4 truncate text-xs leading-4 text-ink-faint">{k.sub ?? ""}</div>
                )}
                {k.spark ? (
                  <div className="mt-1.5 flex items-center">
                    <Sparkline values={k.spark} stroke={k.sparkColor ?? "#9a9aa2"} />
                  </div>
                ) : null}
              </Card>
            </Link>
          );
        })}
      </div>

      {yardCount === 0 ? (
        <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <Warehouse className="h-8 w-8 text-ink-faint" />
          <div>
            <p className="font-medium">Your yard isn&apos;t set up yet.</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-dim">Add a yard and a truck, or load a sample yard to see the whole system working — trucks, certs, crew, and the pre-dispatch check.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/app/yards" className={buttonClass("default")}><Plus className="h-[18px] w-[18px]" /> Add your yard</Link>
            <Link href="/app/import" className={buttonClass("outline")}><Upload className="h-[18px] w-[18px]" /> Import a list</Link>
            <form action={loadSampleYard}>
              <Button type="submit" variant="outline"><Sparkles className="h-[18px] w-[18px]" /> Load sample yard</Button>
            </form>
          </div>
        </Card>
      ) : (
        <>
          {/* Fleet Readiness Board */}
          {rd.units.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Fleet readiness board{activeYard ? ` — ${activeYard.name}` : ""}</h2>
                {hasSample && (
                  <form action={clearSampleYard}>
                    <button type="submit" className="flex items-center gap-1.5 text-xs text-ink-faint hover:text-red-400">
                      <Trash2 className="h-3 w-3" /> Clear sample data
                    </button>
                  </form>
                )}
              </div>
              {yardCount > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  <Link href="/app"
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${!activeYard ? "border-bone bg-bone text-coal" : "border-line-2 text-ink-dim hover:text-ink"}`}>
                    All yards
                  </Link>
                  {yards.map((y) => (
                    <Link key={y.id} href={`/app?yard=${y.id}`}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${activeYard?.id === y.id ? "border-bone bg-bone text-coal" : "border-line-2 text-ink-dim hover:text-ink"}`}>
                      {y.name}
                    </Link>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {[...boardUnits].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]).map((u) => (
                  <Link key={u.id} href={`/app/units/${u.id}`}>
                    <Card className={`h-full p-4 transition-colors hover:border-line-2 ${u.state === "not_ready" ? "border-red-500/40" : ""}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{u.name}</div>
                          <div className="truncate text-xs text-ink-faint">{u.yardName}</div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATE_UI[u.state].chip}`}>{STATE_UI[u.state].label}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className={`truncate text-sm ${u.state === "not_ready" ? "text-red-300" : "text-ink-dim"}`}>{u.why}</span>
                        {u.crewWorst ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-ink-faint" title="Assigned crew cards">
                            <HardHat className="h-3 w-3" /> <StatusDot status={u.crewWorst} />
                          </span>
                        ) : null}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-7 xl:grid-cols-2">
            {/* Activity feed */}
            <section id="activity" className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Activity</h2>
              {events.length === 0 ? (
                <Card className="px-6 py-10 text-center text-sm text-ink-dim">
                  Nothing yet — run your first pre-dispatch check and the feed starts here.
                </Card>
              ) : (
                <Card className="flex max-h-[420px] flex-col gap-0 overflow-y-auto p-2">
                  {events.map((e, i) => (
                    <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.02]">
                      <span className="mt-1 shrink-0">
                        {e.kind === "rolled_out_override" || e.kind === "checkin_partial" || e.kind === "check_not_ready" ? <AlertTriangle className="h-4 w-4 text-red-400" />
                          : e.kind === "miss_caught" ? <Flame className="h-4 w-4 text-emerald-400" />
                          : e.kind === "renewed" ? <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          : e.kind === "alert_sent" ? <Activity className="h-4 w-4 text-amber-400" />
                          : <Truck className="h-4 w-4 text-ink-dim" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{e.message}</p>
                        <p className="text-xs text-ink-faint">
                          {new Date(e.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </section>

            {/* Proof panel + needs attention */}
            <div className="flex flex-col gap-7">
              <section className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">What SYNNR caught — this month</h2>
                <Card className="p-5">
                  {missesCaught === 0 && warningsMonth === 0 ? (
                    <p className="text-sm text-ink-dim">Run your first pre-dispatch check to see your saves. Every miss caught before it hits a location shows up here.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-lg font-semibold">
                        SYNNR caught <span className="text-emerald-400">{missesCaught}</span> miss{missesCaught === 1 ? "" : "es"} before {missesCaught === 1 ? "it" : "they"} hit a location.
                      </p>
                      {missesCaught > 0 ? (
                        <p className="text-sm text-ink-dim">
                          At an estimated <span className="text-ink">${nptDay.toLocaleString()}</span>/day of NPT per miss, that&apos;s roughly{" "}
                          <span className="font-medium text-emerald-400">${(missesCaught * nptDay).toLocaleString()}</span> in avoided downtime this month — against a $500 subscription.
                          <span className="mt-0.5 block text-xs text-ink-faint">Estimate, not a measured figure. <Link href="/app/settings/billing" className="underline hover:text-ink">Set your own NPT day-rate.</Link></span>
                        </p>
                      ) : null}
                      <p className="text-sm text-ink-dim">
                        {warningsMonth} expiry warning{warningsMonth === 1 ? "" : "s"} delivered · {notReadyMonth === 0 ? "no NOT-ready checks recorded" : `${notReadyMonth} NOT-ready check${notReadyMonth === 1 ? "" : "s"} recorded — see the feed`}
                      </p>
                    </div>
                  )}
                </Card>
              </section>

              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Needs attention</h2>
                  <Link href="/app/compliance" className="text-sm text-ink-dim hover:text-ink">View all →</Link>
                </div>
                {actionList.length === 0 ? (
                  <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                    <p className="text-sm text-ink-dim">Nothing expiring soon. You&apos;re rolling ready.</p>
                  </Card>
                ) : (
                  <Table>
                    <thead><tr><Th>Item</Th><Th>Expires</Th><Th className="text-right">Status</Th></tr></thead>
                    <tbody>
                      {actionList.map((i) => (
                        <Tr key={i.id}>
                          <Td>
                            <Link href={hrefFor(i)} className="font-medium hover:underline">{i.title}</Link>
                            <span className="ml-2 text-xs text-ink-faint">{kindLabel(i.kind)}{i.parent_type === "crew" ? " · crew" : ""}</span>
                          </Td>
                          <Td className="tabular-nums text-ink-dim">{i.expiration_date ?? "—"}</Td>
                          <Td className="text-right"><StatusBadge status={i.status} /></Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
