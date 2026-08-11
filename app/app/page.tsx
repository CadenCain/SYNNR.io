import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { getCompanyReadiness } from "@/lib/saas/readiness";
import DashboardView, { type DashItem, type DashEvent, type DashSnap } from "./_components/dashboard-view";

export const dynamic = "force-dynamic";

/**
 * The Readiness Command Center — data layer only. Every number on the screen
 * is fetched here from live records; the layout lives in DashboardView so the
 * marketing screenshots photograph the exact same component a customer sees.
 */

interface Item { id: string; title: string; kind: string; expiration_date: string | null; status: ComplianceStatus; parent_type: string; parent_id: string; }

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ yard?: string }> }) {
  const { company, user } = await requireCompany();
  const { yard: yardParam } = await searchParams;
  const db = await saasDb();
  const first = ((user.user_metadata?.full_name as string | undefined)?.trim().split(" ")[0]) || user.email?.split("@")[0] || "there";

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

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
  const events = (eventData ?? []) as DashEvent[];
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
  const snaps = (snapData ?? []) as DashSnap[];

  const yards = (yardData ?? []) as { id: string; name: string }[];
  // Yard filter: ?yard=<id> scopes the board, the Not-ready KPI, and the
  // needs-attention list to one yard. Crew cards are company-wide and stay.
  const activeYard = yards.find((y) => y.id === yardParam) ?? null;
  const boardUnits = activeYard ? rd.units.filter((u) => u.yardId === activeYard.id) : rd.units;
  const unitYardById = new Map(rd.units.map((u) => [u.id, u.yardId]));

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
  const actionList: DashItem[] = items
    .filter(inYard)
    .filter((i) => i.status === "expired" || i.status === "expiring" || i.status === "none")
    .sort((a, b) => {
      const rank = (s: string) => (s === "expired" ? 0 : s === "none" ? 1 : 2);
      return rank(a.status) - rank(b.status) || (a.expiration_date ?? "").localeCompare(b.expiration_date ?? "");
    })
    .slice(0, 12);

  return (
    <DashboardView
      first={first}
      companyName={company.name}
      nptDay={company.npt_day_estimate}
      yardCount={yards.length}
      yards={yards}
      activeYard={activeYard}
      boardUnits={boardUnits}
      notReadyUnits={boardUnits.filter((u) => u.state === "not_ready").length}
      readiness={rd.readiness}
      expiring30={rd.counts.expiring}
      missesCaught={missesCaught}
      missThisWk={missThisWk}
      missLastWk={missLastWk}
      warningsMonth={(alertsMonth ?? []).length}
      notReadyMonth={checksMonth.filter((c) => c.type === "checkout" && (c.status === "not_ready" || c.status === "not_ready_override")).length}
      checksRunMonth={checksMonth.length}
      hasSample={Boolean(sampleYard)}
      events={events}
      actionList={actionList}
      spark={{ readiness: snaps.map((s) => s.readiness), misses: snaps.map((s) => s.misses_caught as number | null) }}
      snaps={snaps}
    />
  );
}
