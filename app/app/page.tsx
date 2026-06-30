import Link from "next/link";
import { Warehouse, Plus, Upload, AlertTriangle, Clock, ShieldCheck, ChevronRight } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

interface Item { id: string; title: string; expiration_date: string | null; status: ComplianceStatus; parent_type: string; parent_id: string; }

export default async function Dashboard() {
  const { company } = await requireCompany();
  const db = await saasDb();

  const [{ count: yardCount }, { data: itemData }] = await Promise.all([
    db.from("saas_yards").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    db.from("saas_compliance_items_with_status").select("id, title, expiration_date, status, parent_type, parent_id").eq("company_id", company.id),
  ]);
  const items = (itemData ?? []) as Item[];
  const counts = { expired: 0, expiring: 0, valid: 0, none: 0 } as Record<ComplianceStatus, number>;
  for (const i of items) counts[i.status]++;

  const actionList = items
    .filter((i) => i.status === "expired" || i.status === "expiring")
    .sort((a, b) => (a.expiration_date ?? "").localeCompare(b.expiration_date ?? ""))
    .slice(0, 12);

  const stats = [
    { icon: AlertTriangle, label: "Expired", count: counts.expired, accent: "text-red-400", ring: "ring-red-500/20", glow: "rgba(224,122,106,0.10)" },
    { icon: Clock, label: "Expiring soon", count: counts.expiring, accent: "text-amber-400", ring: "ring-amber-500/20", glow: "rgba(230,196,106,0.10)" },
    { icon: ShieldCheck, label: "Valid", count: counts.valid, accent: "text-emerald-400", ring: "ring-emerald-500/20", glow: "rgba(123,196,127,0.08)" },
  ];

  const hrefFor = (i: Item) => (i.parent_type === "unit" ? `/app/units/${i.parent_id}` : `/app/assets/${i.parent_id}`);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Compliance" description="Every cert, inspection, and DOT item across your yards — at a glance." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className={`relative overflow-hidden p-5 ring-1 ${s.ring}`}>
              <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(20rem 12rem at 100% 0%, ${s.glow}, transparent 70%)` }} />
              <div className="relative flex items-center justify-between">
                <span className="text-sm text-ink-dim">{s.label}</span>
                <Icon className={`h-4 w-4 ${s.accent}`} />
              </div>
              <div className="relative mt-3 text-4xl font-semibold tabular-nums tracking-tight">{s.count}</div>
            </Card>
          );
        })}
      </div>

      {yardCount === 0 ? (
        <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-coal"><Warehouse className="h-7 w-7 text-ink-dim" /></div>
          <div>
            <h2 className="text-lg font-semibold">No yards yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink-dim">Add your first yard and start tracking trucks, shops, assets, and certs.</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Link href="/app/yards" className={buttonClass("default")}><Plus className="h-[18px] w-[18px]" /> Add a yard</Link>
            <Link href="/app/import" className={buttonClass("outline")}><Upload className="h-[18px] w-[18px]" /> Import a list</Link>
          </div>
        </Card>
      ) : actionList.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Needs attention</h2>
          <div className="flex flex-col gap-2">
            {actionList.map((i) => (
              <Link key={i.id} href={hrefFor(i)}>
                <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-line-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{i.title}</div>
                    <div className="text-sm text-ink-dim">{i.expiration_date ? `expires ${i.expiration_date}` : "no date"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={i.status} />
                    <ChevronRight className="h-4 w-4 text-ink-faint" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <ShieldCheck className="h-8 w-8 text-emerald-400" />
          <p className="text-sm text-ink-dim">Nothing expiring soon. You&apos;re rolling ready.</p>
        </Card>
      )}
    </div>
  );
}
