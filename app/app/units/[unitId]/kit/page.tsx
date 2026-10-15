import { notFound } from "next/navigation";
import { Wand2 } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import LinesEditor from "../../../_components/lines-editor";
import { kitFromTruck } from "../../../packages/actions";

export const dynamic = "force-dynamic";

/** A truck's default kit: what it always has to leave with. */
export default async function TruckKitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { company } = await requireCompany();
  const { unitId } = await params;
  const db = await saasDb();
  const [{ data: unit }, { data: kit }, { data: names }, { count: onTruck }] = await Promise.all([
    db.from("saas_units").select("id, name").eq("id", unitId).eq("company_id", company.id).maybeSingle(),
    db.from("saas_packages").select("id, saas_package_lines(id, label, qty, sort)").eq("company_id", company.id).eq("unit_id", unitId).maybeSingle(),
    db.from("saas_assets").select("name").eq("company_id", company.id).neq("status", "retired").limit(2000),
    db.from("saas_assets").select("id", { count: "exact", head: true }).eq("company_id", company.id).eq("unit_id", unitId).neq("status", "retired"),
  ]);
  if (!unit) notFound();
  const u = unit as { id: string; name: string };
  const lines = [...((kit as { saas_package_lines: { id: string; label: string; qty: number; sort: number }[] } | null)?.saas_package_lines ?? [])].sort((a, b) => a.sort - b.sort);
  const manager = company.role === "owner" || company.role === "admin";
  const pieceNames = [...new Set(((names ?? []) as { name: string }[]).map((n) => n.name.replace(/\s*#\s*\d+\b/g, "").trim()))].sort();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: `/app/units/${u.id}`, label: u.name }} title={`${u.name} kit`}
        description={`What ${u.name} always leaves with. Every load-out on ${u.name} checks against it, plus any package picked for the job. Short means NOT READY.`} />
      {manager && (onTruck ?? 0) > 0 ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-ink-dim">{lines.length ? "Start over from" : "Start from"} the {onTruck} {onTruck === 1 ? "piece" : "pieces"} logged on {u.name} now: one line per kind of piece.</p>
          <form action={kitFromTruck}>
            <input type="hidden" name="unit_id" value={u.id} />
            <button type="submit" className={buttonClass("outline", "lg")}><Wand2 className="h-5 w-5" /> {lines.length ? "Redo from the truck" : "Fill from the truck"}</button>
          </form>
        </Card>
      ) : null}
      <LinesEditor lines={lines} editable={manager} unitId={u.id} pieceNames={pieceNames} />
      {!manager ? <p className="text-sm text-ink-faint">A manager keeps the kit. Ask one if something should be on it.</p> : null}
    </div>
  );
}
