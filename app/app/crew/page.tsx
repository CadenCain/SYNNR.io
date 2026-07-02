import Link from "next/link";
import { revalidatePath } from "next/cache";
import { HardHat, Plus, ChevronRight } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { worstStatus } from "@/lib/saas/status";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

const fld = "h-11 rounded-lg border border-line-2 bg-coal px-3 text-ink outline-none focus:border-bone";

async function createCrewMember(formData: FormData) {
  "use server";
  const { company } = await requireCompany();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!name) return;
  const db = await saasDb();
  const { error } = await db.from("saas_crew_members").insert({ company_id: company.id, name, role, phone });
  if (error) throw new Error(error.message);
  revalidatePath("/app/crew");
}

export default async function CrewPage() {
  const { company } = await requireCompany();
  const db = await saasDb();

  const { data: crewData } = await db
    .from("saas_crew_members").select("id, name, role, phone, status")
    .eq("company_id", company.id).order("name");
  const crew = (crewData ?? []) as { id: string; name: string; role: string | null; phone: string | null; status: string }[];

  // Worst cert status per hand — the readiness chip.
  const { data: certData } = await db
    .from("saas_compliance_items_with_status")
    .select("parent_id, status").eq("company_id", company.id).eq("parent_type", "crew");
  const byCrew = new Map<string, ComplianceStatus[]>();
  for (const c of (certData ?? []) as { parent_id: string; status: ComplianceStatus }[]) {
    byCrew.set(c.parent_id, [...(byCrew.get(c.parent_id) ?? []), c.status]);
  }
  const worst = new Map<string, ComplianceStatus>();
  for (const [id, list] of byCrew) { const w = worstStatus(list); if (w) worst.set(id, w); }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Crew" description="Your hands and their cards — H2S, well control, CDL, medicals. Current crew is what makes a truck actually ready." />

      {crew.length > 0 && (
        <div className="flex flex-col gap-2">
          {crew.map((c) => (
            <Link key={c.id} href={`/app/crew/${c.id}`}>
              <Card className="flex items-center gap-4 p-4 transition-colors hover:border-line-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-coal">
                  <HardHat className="h-5 w-5 text-ink-dim" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{c.name}{c.status === "inactive" ? <span className="ml-2 text-xs text-ink-faint">inactive</span> : null}</div>
                  <div className="truncate text-sm text-ink-dim">{c.role ?? "crew"}{c.phone ? ` · ${c.phone}` : ""}</div>
                </div>
                {worst.has(c.id) ? <StatusBadge status={worst.get(c.id)!} /> : <span className="text-xs text-ink-faint">no certs</span>}
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-medium text-ink">{crew.length ? "Add another hand" : "Add your first hand"}</h2>
        <form action={createCrewMember} className="flex flex-col gap-3 sm:flex-row">
          <input name="name" required placeholder="Name" className={`${fld} flex-1`} />
          <input name="role" placeholder="Role (operator, driver…)" className={`${fld} flex-1`} />
          <input name="phone" type="tel" placeholder="Phone (optional)" className={`${fld} flex-1`} />
          <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add</Button>
        </form>
      </Card>
    </div>
  );
}
