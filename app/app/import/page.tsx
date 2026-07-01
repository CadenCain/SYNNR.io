import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import ImportClient from "./import-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import a list · SYNNR" };

/**
 * Hardened import: dry-run preview, row-level errors, idempotent re-import,
 * crew support. Admin-gated — this is also the "we'll load your yard for you"
 * path: an owner/admin (or you, on their behalf) pastes the shop's sheet.
 */
export default async function ImportPage() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const { data } = await db.from("saas_yards").select("id, name").eq("company_id", company.id).order("name");
  const yards = (data ?? []) as { id: string; name: string }[];
  const isAdmin = company.role === "owner" || company.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: "/app/yards", label: "Yards" }}
        title="Import a list"
        description="Paste a spreadsheet — units, assets, certs, and crew land in one shot. Preview first; re-imports update instead of duplicating."
      />
      {isAdmin ? (
        <ImportClient yards={yards} />
      ) : (
        <Card className="px-6 py-12 text-center text-sm text-ink-dim">
          Importing writes company-wide, so it&apos;s admin-only. Ask an owner or admin to load the sheet.
        </Card>
      )}
    </div>
  );
}
