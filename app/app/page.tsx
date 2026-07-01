import Link from "next/link";
import { Warehouse, Plus, Upload, AlertTriangle, Clock, ShieldCheck, Gauge } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { kindLabel } from "@/lib/saas/taxonomy";
import { Table, Th, Td, Tr } from "@/components/ui/table";

export const dynamic = "force-dynamic";

interface Item { id: string; title: string; kind: string; expiration_date: string | null; status: ComplianceStatus; parent_type: string; parent_id: string; }

export default async function Dashboard() {
  const { company, user } = await requireCompany();
  const db = await saasDb();
  const first = ((user.user_metadata?.full_name as string | undefined)?.trim().split(" ")[0]) || user.email?.split("@")[0] || "there";

  const [{ count: yardCount }, { data: itemData }] = await Promise.all([
    db.from("saas_yards").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    db.from("saas_compliance_items_with_status").select("id, title, kind, expiration_date, status, parent_type, parent_id").eq("company_id", company.id),
  ]);
  const items = (itemData ?? []) as Item[];
  const c = { expired: 0, expiring: 0, valid: 0, none: 0 } as Record<ComplianceStatus, number>;
  for (const i of items) c[i.status]++;
  const tracked = c.expired + c.expiring + c.valid;
  const readiness = tracked > 0 ? Math.round((c.valid / tracked) * 100) : 100;

  const actionList = items
    .filter((i) => i.status === "expired" || i.status === "expiring")
    .sort((a, b) => (a.expiration_date ?? "").localeCompare(b.expiration_date ?? ""))
    .slice(0, 15);

  const hrefFor = (i: Item) => (i.parent_type === "unit" ? `/app/units/${i.parent_id}` : `/app/assets/${i.parent_id}`);

  const kpis = [
    { icon: Gauge, label: "Readiness", value: `${readiness}%`, accent: readiness >= 90 ? "text-emerald-400" : readiness >= 70 ? "text-amber-400" : "text-red-400", bar: readiness },
    { icon: AlertTriangle, label: "Expired", value: c.expired, accent: "text-red-400" },
    { icon: Clock, label: "Expiring soon", value: c.expiring, accent: "text-amber-400" },
    { icon: ShieldCheck, label: "Valid", value: c.valid, accent: "text-emerald-400" },
  ];

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Hello, {first} <span className="align-middle">👋</span></h1>
        <p className="mt-1 text-sm text-ink-dim">Here&apos;s where {company.name} stands right now.</p>
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
