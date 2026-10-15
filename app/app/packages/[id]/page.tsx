import { notFound, redirect } from "next/navigation";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { PageHeader } from "@/components/ui/page-header";
import { buttonClass } from "@/components/ui/button";
import LinesEditor from "../../_components/lines-editor";
import { renamePackage, deletePackage } from "../actions";

export const dynamic = "force-dynamic";

/** One package: its name and lines. */
export default async function PackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { company } = await requireCompany();
  const { id } = await params;
  const db = await saasDb();
  const [{ data: pkg }, { data: lineRows }, { data: names }] = await Promise.all([
    db.from("saas_packages").select("id, name, unit_id").eq("id", id).eq("company_id", company.id).maybeSingle(),
    db.from("saas_package_lines").select("id, label, qty").eq("package_id", id).eq("company_id", company.id).order("sort"),
    db.from("saas_assets").select("name").eq("company_id", company.id).neq("status", "retired").limit(2000),
  ]);
  if (!pkg) notFound();
  const p = pkg as { id: string; name: string; unit_id: string | null };
  if (p.unit_id) redirect(`/app/units/${p.unit_id}/kit`);
  const manager = company.role === "owner" || company.role === "admin";
  const pieceNames = [...new Set(((names ?? []) as { name: string }[]).map((n) => n.name.replace(/\s*#\s*\d+\b/g, "").trim()))].sort();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: "/app/packages", label: "Packages & kits" }} title={p.name}
        description="A hand adds this package when the job calls for it. Every line has to be filled by a scanned piece, or the truck reads NOT READY." />
      {manager ? (
        <form action={renamePackage} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="package_id" value={p.id} />
          <input name="name" defaultValue={p.name} required maxLength={80} aria-label="Package name"
            className="h-12 w-full min-w-0 grow rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone" />
          <button type="submit" className={buttonClass("outline", "lg")}>Rename</button>
        </form>
      ) : null}
      <LinesEditor lines={(lineRows ?? []) as { id: string; label: string; qty: number }[]} editable={manager} packageId={p.id} pieceNames={pieceNames} />
      {manager ? (
        <details className="self-start text-sm">
          <summary className="cursor-pointer text-ink-dim">Delete this package</summary>
          <form action={deletePackage} className="mt-2">
            <input type="hidden" name="package_id" value={p.id} />
            <button type="submit" className={buttonClass("danger")}>Delete {p.name}</button>
            <p className="mt-1 text-xs text-ink-faint">Load-outs already saved keep their record.</p>
          </form>
        </details>
      ) : null}
    </div>
  );
}
