import Link from "next/link";
import { Truck, Box, ShieldCheck, Search } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { unitTypeLabel, categoryLabel } from "@/lib/saas/taxonomy";
import { fmtDate } from "@/lib/saas/format";

export const dynamic = "force-dynamic";

/** One search across the whole yard: equipment (by name or serial), trucks, tests. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { company } = await requireCompany();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const db = await saasDb();

  let units: { id: string; name: string; type: string; identifier: string | null }[] = [];
  let assets: { id: string; name: string; category: string; identifier: string | null; last_seen_where: string | null }[] = [];
  let certs: { id: string; title: string; status: ComplianceStatus; parent_type: string; parent_id: string; expiration_date: string | null }[] = [];

  if (query.length >= 2) {
    const like = `%${query.replace(/[%_,().]/g, "")}%`; // strip PostgREST filter syntax too
    const [u, a, ci] = await Promise.all([
      // Name OR identifier — a dispatcher hunting "1482" means the truck
      // number painted on the door, not what the office named it.
      db.from("saas_units").select("id, name, type, identifier").eq("company_id", company.id)
        .or(`name.ilike.${like},identifier.ilike.${like}`).limit(10),
      // Serial numbers too: the number stamped on the iron is how it's found.
      db.from("saas_assets").select("id, name, category, identifier, last_seen_where").eq("company_id", company.id)
        .or(`name.ilike.${like},identifier.ilike.${like},last_seen_where.ilike.${like}`).limit(15),
      db.from("saas_compliance_items_with_status")
        .select("id, title, status, parent_type, parent_id, expiration_date")
        .eq("company_id", company.id).neq("parent_type", "crew").ilike("title", like).limit(15),
    ]);
    units = (u.data ?? []) as typeof units;
    assets = (a.data ?? []) as typeof assets;
    certs = (ci.data ?? []) as typeof certs;
  }

  const total = units.length + assets.length + certs.length;
  const certHref = (i: (typeof certs)[number]) =>
    i.parent_type === "unit" ? `/app/units/${i.parent_id}` : `/app/assets/${i.parent_id}`;

  const Row = ({ href, icon: Icon, title, sub, right }: { href: string; icon: typeof Truck; title: string; sub?: string; right?: React.ReactNode }) => (
    <Link href={href}>
      <Card className="flex items-center gap-3 p-4 transition-colors hover:border-line-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-coal"><Icon className="h-4 w-4 text-ink-dim" /></span>
        <div className="min-w-0 flex-1">
          <div className="break-words font-medium">{title}</div>
          {sub ? <div className="text-sm text-ink-dim">{sub}</div> : null}
        </div>
        {right}
      </Card>
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Search" description="Equipment, serial numbers, trucks, and tests across every yard." />

      <form action="/app/search" className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2 focus-within:border-line-2">
        <Search className="h-4 w-4 text-ink-faint" />
        <input name="q" defaultValue={query} autoFocus placeholder="Name, serial number, truck, test"
          className="h-10 w-full bg-transparent text-ink placeholder:text-ink-faint outline-none" />
      </form>

      {query.length < 2 ? (
        <Card className="px-6 py-10 text-center text-sm text-ink-dim">Type at least two characters.</Card>
      ) : total === 0 ? (
        <Card className="px-6 py-10 text-center text-sm text-ink-dim">Nothing matches &ldquo;{query}&rdquo;.</Card>
      ) : (
        <div className="flex flex-col gap-5">
          {assets.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-ink-dim">Equipment</h2>
              {assets.map((a) => <Row key={a.id} href={`/app/assets/${a.id}`} icon={Box} title={a.name}
                sub={[categoryLabel(a.category), a.identifier ? `SN ${a.identifier}` : "", a.last_seen_where ?? ""].filter(Boolean).join(" · ")} />)}
            </section>
          )}
          {units.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-ink-dim">Trucks</h2>
              {units.map((u) => <Row key={u.id} href={`/app/units/${u.id}`} icon={Truck} title={u.name} sub={`${unitTypeLabel(u.type)}${u.identifier ? ` · ${u.identifier}` : ""}`} />)}
            </section>
          )}
          {certs.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-ink-dim">Tests &amp; certs</h2>
              {certs.map((i) => (
                <Row key={i.id} href={certHref(i)} icon={ShieldCheck} title={i.title}
                  sub={i.expiration_date ? `expires ${fmtDate(i.expiration_date)}` : "no date on file"}
                  right={<StatusBadge status={i.status} />} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
