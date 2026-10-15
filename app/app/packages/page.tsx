import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { createPackage } from "./actions";

export const dynamic = "force-dynamic";

type Pkg = { id: string; name: string; unit_id: string | null; saas_package_lines: { label: string; qty: number; sort: number }[] | null };

/** Packages for each kind of job, and every truck's default kit: what a load-out checks against. */
export default async function PackagesPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [{ data: pkgRows }, { data: unitRows }] = await Promise.all([
    db.from("saas_packages").select("id, name, unit_id, saas_package_lines(label, qty, sort)").eq("company_id", company.id).order("name"),
    db.from("saas_units").select("id, name").eq("company_id", company.id).order("name"),
  ]);
  const all = (pkgRows ?? []) as Pkg[];
  const packages = all.filter((p) => !p.unit_id);
  const kitOf = new Map(all.filter((p) => p.unit_id).map((p) => [p.unit_id as string, p]));
  const units = (unitRows ?? []) as { id: string; name: string }[];
  const manager = company.role === "owner" || company.role === "admin";
  const preview = (p: Pkg) => [...(p.saas_package_lines ?? [])].sort((a, b) => a.sort - b.sort).map((l) => `${l.label}${l.qty > 1 ? ` × ${l.qty}` : ""}`).join(", ");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        back={{ href: "/app", label: "Load out" }}
        title="Packages & kits"
        description="What a load-out checks against. Every truck has its own kit. Packages get added for a kind of job. A hand can add quick lines for today at the truck. Anything short when the hand hits Done makes the truck NOT READY."
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Packages</h2>
        {packages.length === 0 ? <Card className="p-4 text-sm text-ink-dim">No packages yet. Make one for each kind of job you run, like Standard Coil Package.</Card> : null}
        {packages.map((p) => (
          <Link key={p.id} href={`/app/packages/${p.id}`}>
            <Card className="flex items-center gap-3 p-4 hover:border-bone/50">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{p.name}</div>
                <div className="break-words text-sm text-ink-dim">{preview(p) || "No lines yet"}</div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
            </Card>
          </Link>
        ))}
        {manager ? (
          <form action={createPackage} className="flex flex-col gap-2 sm:flex-row">
            <input name="name" required maxLength={80} placeholder="New package, like Standard Coil Package" aria-label="Package name"
              className="h-12 w-full min-w-0 grow rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone" />
            <button type="submit" className={buttonClass("default", "lg")}><Plus className="h-5 w-5" /> Make package</button>
          </form>
        ) : <p className="text-sm text-ink-faint">A manager keeps packages and kits.</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Truck kits</h2>
        {units.length === 0 ? <Card className="p-4 text-sm text-ink-dim">No trucks yet. Add them under Yards &amp; trucks.</Card> : null}
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {units.map((u) => {
            const kit = kitOf.get(u.id);
            const text = kit ? preview(kit) : "";
            return (
              <Link key={u.id} href={`/app/units/${u.id}/kit`}>
                <Card className="flex h-full items-center gap-3 p-4 hover:border-bone/50">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{u.name}</div>
                    <div className={text ? "break-words text-sm text-ink-dim" : "text-sm text-amber-400"}>{text || "No kit yet"}</div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
                </Card>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
