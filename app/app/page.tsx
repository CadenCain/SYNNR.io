import Link from "next/link";
import { Warehouse, Plus, Upload, AlertTriangle, Clock, ShieldCheck, Gauge, Truck } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { kindLabel } from "@/lib/saas/taxonomy";
import { Table, Th, Td, Tr } from "@/components/ui/table";
import { computeReadiness } from "@/lib/saas/status";

export const dynamic = "force-dynamic";

interface Item { id: string; title: string; kind: string; expiration_date: string | null; status: ComplianceStatus; parent_type: string; parent_id: string; }

export default async function Dashboard() {
  const { company, user } = await requireCompany();
  const db = await saasDb();
  const first = ((user.user_metadata?.full_name as string | undefined)?.trim().split(" ")[0]) || user.email?.split("@")[0] || "there";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: yardCount }, { data: itemData }, { data: checkData }, { data: missingAssetData }] = await Promise.all([
    db.from("saas_yards").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    db.from("saas_compliance_items_with_status").select("id, title, kind, expiration_date, status, parent_type, parent_id").eq("company_id", company.id),
    db.from("saas_dispatch_checks")
      .select("id, unit_id, type, status, performed_by_name, started_at, saas_units(name)")
      .eq("company_id", company.id)
      .gte("started_at", todayStart.toISOString())
      .order("started_at", { ascending: false })
      .limit(20),
    db.from("saas_assets").select("id, name, unit_id").eq("company_id", company.id).eq("status", "missing").limit(10),
  ]);
  const items = (itemData ?? []) as Item[];

  type CheckRow = { id: string; unit_id: string; type: string; status: string; performed_by_name: string | null; started_at: string; saas_units: { name: string } | { name: string }[] | null };
  const todaysChecks = ((checkData ?? []) as CheckRow[]).map((c) => ({
    ...c,
    unitName: (Array.isArray(c.saas_units) ? c.saas_units[0]?.name : c.saas_units?.name) ?? "unit",
  }));
  const missingAssets = (missingAssetData ?? []) as { id: string; name: string; unit_id: string | null }[];
  const c = { expired: 0, expiring: 0, valid: 0, none: 0 } as Record<ComplianceStatus, number>;
  for (const i of items) c[i.status]++;

  // Readiness blend (formula + weights documented in lib/saas/status.ts):
  // cert currency (unit+asset) + loadout completeness (latest check-out per
  // unit) + crew cert currency, hard-capped when anything required is failing.
  const split = (pred: (i: Item) => boolean) => {
    const s = { expired: 0, expiring: 0, valid: 0 };
    for (const i of items) if (pred(i) && i.status !== "none") s[i.status as "expired" | "expiring" | "valid"]++;
    return s;
  };
  const gearCerts = split((i) => i.parent_type !== "crew");
  const crewCerts = split((i) => i.parent_type === "crew");
  const gearTotal = gearCerts.expired + gearCerts.expiring + gearCerts.valid;
  const crewTotal = crewCerts.expired + crewCerts.expiring + crewCerts.valid;

  // Latest check-out per unit → ok / (ok+missing) across gear rows.
  const { data: coData } = await db
    .from("saas_dispatch_checks").select("id, unit_id, started_at")
    .eq("company_id", company.id).eq("type", "checkout")
    .order("started_at", { ascending: false }).limit(100);
  const latestByUnit = new Map<string, string>();
  for (const co of (coData ?? []) as { id: string; unit_id: string }[]) {
    if (!latestByUnit.has(co.unit_id)) latestByUnit.set(co.unit_id, co.id);
  }
  let loadoutOk = 0, loadoutTotal = 0, loadoutMissing = 0;
  if (latestByUnit.size > 0) {
    const { data: ciRows } = await db
      .from("saas_dispatch_check_items").select("check_id, result")
      .in("check_id", [...latestByUnit.values()])
      .in("source_type", ["loadout_item", "asset"]);
    for (const r of (ciRows ?? []) as { result: string }[]) {
      if (r.result === "ok") { loadoutOk++; loadoutTotal++; }
      else if (r.result === "missing") { loadoutMissing++; loadoutTotal++; }
    }
  }

  const readiness = computeReadiness({
    certCurrency: gearTotal > 0 ? gearCerts.valid / gearTotal : null,
    loadoutCompleteness: loadoutTotal > 0 ? loadoutOk / loadoutTotal : null,
    crewCurrency: crewTotal > 0 ? crewCerts.valid / crewTotal : null,
    hardFail: c.expired > 0 || missingAssets.length > 0 || loadoutMissing > 0,
  });

  const actionList = items
    .filter((i) => i.status === "expired" || i.status === "expiring")
    .sort((a, b) => (a.expiration_date ?? "").localeCompare(b.expiration_date ?? ""))
    .slice(0, 15);

  const hrefFor = (i: Item) => i.parent_type === "unit" ? `/app/units/${i.parent_id}` : i.parent_type === "crew" ? `/app/crew/${i.parent_id}` : `/app/assets/${i.parent_id}`;

  const kpis = [
    { icon: Gauge, label: "Readiness", value: `${readiness}%`, accent: readiness >= 90 ? "text-emerald-400" : readiness >= 70 ? "text-amber-400" : "text-red-400", bar: readiness },
    { icon: AlertTriangle, label: "Expired", value: c.expired, accent: "text-red-400" },
    { icon: Clock, label: "Expiring soon", value: c.expiring, accent: "text-amber-400" },
    { icon: ShieldCheck, label: "Valid", value: c.valid, accent: "text-emerald-400" },
  ];

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Hello, {first} <span className="align-middle">👋</span></h1>
          <p className="mt-1 text-sm text-ink-dim">Here&apos;s where {company.name} stands right now.</p>
        </div>
        <Link href="/app/dispatch" className={buttonClass("default")}>
          <Truck className="h-[18px] w-[18px]" /> Roll a truck
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-dim">{k.label}</span>
                <Icon className={`h-4 w-4 ${k.accent}`} />
              </div>
              <div className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">{k.value}</div>
              {typeof k.bar === "number" ? (
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div className={`h-full rounded-full ${k.bar >= 90 ? "bg-emerald-500" : k.bar >= 70 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${k.bar}%` }} />
                </div>
              ) : (
                <div className="mt-3 h-1.5" />
              )}
            </Card>
          );
        })}
      </div>

      {(todaysChecks.length > 0 || missingAssets.length > 0) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Dispatch today</h2>
          <div className="flex flex-col gap-2">
            {missingAssets.length > 0 && (
              <Card className="flex items-center gap-3 border-red-500/40 bg-red-500/10 p-4">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
                <div className="min-w-0 text-sm text-red-300">
                  <span className="font-semibold">Missing gear:</span>{" "}
                  {missingAssets.map((a) => a.name).join(", ")}
                  {" — "}went out and hasn&apos;t come back, or wasn&apos;t found at check-out.
                </div>
              </Card>
            )}
            {todaysChecks.map((c) => (
              <Link key={c.id} href={`/app/units/${c.unit_id}`}>
                <Card className={`flex items-center justify-between gap-3 p-4 transition-colors hover:border-line-2 ${c.status === "not_ready_override" ? "border-amber-500/40" : ""}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <Truck className={`h-4 w-4 shrink-0 ${c.status === "not_ready_override" ? "text-amber-400" : "text-ink-dim"}`} />
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {c.unitName} — {c.type === "checkout" ? "rolled out" : "checked in"}
                      </div>
                      <div className="truncate text-sm text-ink-dim">
                        {new Date(c.started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        {c.performed_by_name ? ` · ${c.performed_by_name}` : ""}
                      </div>
                    </div>
                  </div>
                  {c.status === "not_ready_override" ? (
                    <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">NOT ready — override</span>
                  ) : c.status === "partial" ? (
                    <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">Items not returned</span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">{c.type === "checkout" ? "Ready" : "All back"}</span>
                  )}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {yardCount === 0 ? (
        <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-elevated"><Warehouse className="h-7 w-7 text-ink-dim" /></div>
          <div>
            <h2 className="text-lg font-semibold">No yards yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-dim">Add your first yard and start tracking trucks, shops, assets, and certs.</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Link href="/app/yards" className={buttonClass("default")}><Plus className="h-[18px] w-[18px]" /> Add a yard</Link>
            <Link href="/app/import" className={buttonClass("outline")}><Upload className="h-[18px] w-[18px]" /> Import a list</Link>
          </div>
        </Card>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Needs attention</h2>
            <Link href="/app/compliance" className="text-sm text-ink-dim hover:text-ink">View all →</Link>
          </div>
          {actionList.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
              <p className="text-sm text-ink-dim">Nothing expiring soon. You&apos;re rolling ready.</p>
            </Card>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th className="hidden sm:table-cell">Type</Th>
                  <Th>Expires</Th>
                  <Th className="text-right">Status</Th>
                </tr>
              </thead>
              <tbody>
                {actionList.map((i) => (
                  <Tr key={i.id}>
                    <Td>
                      <Link href={hrefFor(i)} className="font-medium text-ink hover:underline">{i.title}</Link>
                    </Td>
                    <Td className="hidden text-ink-dim sm:table-cell">{kindLabel(i.kind)}</Td>
                    <Td className="tabular-nums text-ink-dim">{i.expiration_date ?? "—"}</Td>
                    <Td className="text-right"><StatusBadge status={i.status} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
      )}
    </div>
  );
}
