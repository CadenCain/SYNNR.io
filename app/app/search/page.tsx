import Link from "next/link";
import { Truck, HardHat, Box, ShieldCheck, Search } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

/** One search across the whole yard: units, crew, assets, certs (M4). */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { company } = await requireCompany();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const db = await saasDb();

  let units: { id: string; name: string; type: string }[] = [];
  let crew: { id: string; name: string; role: string | null }[] = [];
  let assets: { id: string; name: string; category: string }[] = [];
  let certs: { id: string; title: string; status: ComplianceStatus; parent_type: string; parent_id: string; expiration_date: string | null }[] = [];

  if (query.length >= 2) {
    const like = `%${query.replace(/[%_]/g, "")}%`;
    const [u, c, a, ci] = await Promise.all([
      db.from("saas_units").select("id, name, type").eq("company_id", company.id).ilike("name", like).limit(10),
      db.from("saas_crew_members").select("id, name, role").eq("company_id", company.id).ilike("name", like).limit(10),
      db.from("saas_assets").select("id, name, category").eq("company_id", company.id).ilike("name", like).limit(10),
      db.from("saas_compliance_items_with_status")
        .select("id, title, status, parent_type, parent_id, expiration_date")
        .eq("company_id", company.id).ilike("title", like).limit(15),
    ]);
    units = (u.data ?? []) as typeof units;
    crew = (c.data ?? []) as typeof crew;
    assets = (a.data ?? []) as typeof assets;
    certs = (ci.data ?? []) as typeof certs;
  }

  const total = units.length + crew.length + assets.length + certs.length;
  const certHref = (i: (typeof certs)[number]) =>
    i.parent_type === "unit" ? `/app/units/${i.parent_id}` : i.parent_type === "crew" ? `/app/crew/${i.parent_id}` : `/app/assets/${i.parent_id}`;

  const Row = ({ href, icon: Icon, title, sub, right }: { href: string; icon: typeof Truck; title: string; sub?: string; right?: React.ReactNode }) => (
    <Link href={href}>
      <Card className="flex items-center gap-3 p-4 transition-colors hover:border-line-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><Icon className="h-4 w-4 text-ink-dim" /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{title}</div>
          {sub ? <div className="truncate text-sm text-ink-dim">{sub}</div> : null}
        </div>
        {right}
      </Card>
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Search" description="Trucks, crew, gear, and certs across every yard." />

      <form action="/app/search" className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 focus-within:border-line-2">
        <Search className="h-4 w-4 text-ink-faint" />
        <input name="q" defaultValue={query} autoFocus placeholder="Search anything…"
          className="h-10 w-full bg-transparent text-ink placeholder:text-ink-faint outline-none" />
      </form>

      {query.length < 2 ? (
        <Card className="px-6 py-10 text-center text-sm text-ink-dim">Type at least two characters.</Card>
      ) : total === 0 ? (
        <Card className="px-6 py-10 text-center text-sm text-ink-dim">Nothing matches &ldquo;{query}&rdquo;.</Card>
      ) : (
        <div className="flex flex-col gap-5">
          {units.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Units</h2>
              {units.map((u) => <Row key={u.id} href={`/app/units/${u.id}`} icon={Truck} title={u.name} sub={u.type.replace(/_/g, " ")} />)}
            </section>
          )}
          {crew.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Crew</h2>
              {crew.map((c) => <Row key={c.id} href={`/app/crew/${c.id}`} icon={HardHat} title={c.name} sub={c.role ?? "crew"} />)}
            </section>
          )}
          {assets.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Assets</h2>
              {assets.map((a) => <Row key={a.id} href={`/app/assets/${a.id}`} icon={Box} title={a.name} sub={a.category.replace(/_/g, " ")} />)}
            </section>
          )}
          {certs.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Certs &amp; cards</h2>
              {certs.map((i) => (
                <Row key={i.id} href={certHref(i)} icon={ShieldCheck} title={i.title}
                  sub={i.expiration_date ? `expires ${i.expiration_date}` : "no date on file"}
                  right={<StatusBadge status={i.status} />} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
