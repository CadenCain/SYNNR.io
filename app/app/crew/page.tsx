import Link from "next/link";
import { revalidatePath } from "next/cache";
import { HardHat, Plus, ChevronRight } from "lucide-react";
import { requireCompany, requireBillableCompany } from "@/lib/saas/auth";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { worstStatus } from "@/lib/saas/status";
import { isRecentDuplicate } from "@/lib/saas/dedupe";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";

const fld = "h-11 rounded-lg border border-line-2 bg-coal px-3 text-ink outline-none focus:border-bone";

async function createCrewMember(formData: FormData) {
  "use server";
  const { company } = await requireBillableCompany();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  if (!name) return;
  const db = await saasDb();
  if (await isRecentDuplicate(db, "saas_crew_members", { company_id: company.id, name })) {
    revalidatePath("/app/crew");
    return; // double-tap echo, not a second hire
  }
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

  // Field photos waiting on review — surfaced at the top of the roster so a
  // submitted card never dies unseen inside one hand's page.
  const { data: pendingDocs } = await db
    .from("saas_doc_requests")
    .select("crew_member_id")
    .eq("company_id", company.id).eq("status", "submitted");
  const submittedByCrew = new Set(((pendingDocs ?? []) as { crew_member_id: string }[]).map((r) => r.crew_member_id));

  // Worst first: a photo waiting, then lapsed or missing cards, then due soon.
  const RANK: Record<string, number> = { expired: 0, none: 0, nocards: 1, expiring: 2, valid: 3 };
  const rank = (id: string) => (submittedByCrew.has(id) ? -1 : RANK[worst.get(id) ?? "nocards"]);
  crew.sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Crew" description="Your hands and their cards: H2S, well control, CDL, and medical. A truck is only ready if its crew is current." />

      {submittedByCrew.size > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/[0.05] p-4">
          <p className="text-sm">
            <span className="font-semibold text-amber-400">{submittedByCrew.size} card photo{submittedByCrew.size === 1 ? "" : "s"}</span>{" "}
            in from the field and waiting on review. Open the hand&apos;s page below to see {submittedByCrew.size === 1 ? "it" : "them"}.
          </p>
        </Card>
      )}

      {crew.length > 0 && (
        <div className="flex flex-col gap-2">
          {crew.map((c) => (
            <Link key={c.id} href={`/app/crew/${c.id}`}>
              <Card className="flex items-center gap-3 p-4 transition-colors hover:border-line-2 sm:gap-4">
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-coal sm:flex">
                  <HardHat className="h-5 w-5 text-ink-dim" />
                </span>
                {/* Name gets the whole first line; the status rides the second,
                    so a phone never cuts a name to "Aaron Pru…". */}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink">{c.name}{c.status === "inactive" ? <span className="ml-2 text-xs font-normal text-ink-faint">inactive</span> : null}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-dim">
                    {submittedByCrew.has(c.id) && (
                      <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">Photo in</span>
                    )}
                    {worst.has(c.id) ? (
                      <>
                        <StatusBadge status={worst.get(c.id)!} />
                        {/* A green badge over one card and a green badge over
                            five look identical; the count keeps thin records honest. */}
                        <span className="text-xs text-ink-faint">{(byCrew.get(c.id) ?? []).length} card{(byCrew.get(c.id) ?? []).length === 1 ? "" : "s"}</span>
                      </>
                    ) : (
                      <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">No cards on file</span>
                    )}
                    <span className="truncate">{c.role ?? "crew"}{c.phone ? ` · ${c.phone}` : ""}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" />
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-medium text-ink">{crew.length ? "Add another hand" : "Add your first hand"}</h2>
        <form action={createCrewMember} className="flex flex-col gap-3 lg:flex-row">
          <input name="name" required placeholder="Name" className={`${fld} min-w-0 flex-1`} />
          <input name="role" placeholder="Role (operator, driver…)" className={`${fld} min-w-0 flex-1`} />
          <input name="phone" type="tel" placeholder="Phone (optional)" className={`${fld} min-w-0 flex-1`} />
          <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add</Button>
        </form>
      </Card>
    </div>
  );
}
