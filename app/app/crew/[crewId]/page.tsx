import { notFound } from "next/navigation";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { COMPLIANCE_KINDS } from "@/lib/saas/taxonomy";
import { Card } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

import { Button, buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import ComplianceRow, { type RowItem } from "@/app/app/_components/compliance-row";
import { getItemCustomers } from "@/lib/saas/customers";
import { addComplianceItem } from "@/app/app/units/[unitId]/actions";
import { updateCrewMember, deleteCrewMember } from "@/app/app/_actions";
import { closeDocRequest } from "../doc-actions";
import SendUpdateLink from "./send-update-link";
import { fmtDate } from "@/lib/saas/format";

export const dynamic = "force-dynamic";

const fld = "h-11 rounded-lg border border-line-2 bg-coal px-3 text-ink outline-none focus:border-bone";

/** The Crew Book — mirrors the unit Truck Book, same cert engine underneath. */
export default async function CrewDetail({ params }: { params: Promise<{ crewId: string }> }) {
  const { company } = await requireCompany();
  const { crewId } = await params;
  const db = await saasDb();
  const here = `/app/crew/${crewId}`;

  const { data: crewData } = await db
    .from("saas_crew_members").select("id, name, role, phone, status")
    .eq("id", crewId).eq("company_id", company.id).maybeSingle();
  if (!crewData) notFound();
  const c = crewData as { id: string; name: string; role: string | null; phone: string | null; status: string };

  const { data: certData } = await db
    .from("saas_compliance_items_with_status")
    .select("id, title, kind, issued_date, expiration_date, status, renewed_without_proof")
    .eq("parent_type", "crew").eq("parent_id", crewId)
    .order("expiration_date", { ascending: true, nullsFirst: false });
  const certs = (certData ?? []) as RowItem[];
  const itemCustomers = await getItemCustomers(db, company.id, certs.map((i) => i.id));
  for (const it of certs) it.customers = itemCustomers.get(it.id) ?? [];

  // Doc-request queue for this hand: submitted photos waiting review, plus
  // links still out in the field. Signed URLs are short-lived; RLS already
  // scopes the storage read to this company's prefix.
  const { data: docReqData } = await db
    .from("saas_doc_requests")
    .select("id, status, created_at, expires_at, submitted_at, file_path, submitted_kind, submitted_expiration, submitted_note")
    .eq("crew_member_id", crewId).eq("company_id", company.id)
    .in("status", ["pending", "submitted"])
    .order("created_at", { ascending: false });
  type DocReq = { id: string; status: string; created_at: string; expires_at: string; submitted_at: string | null; file_path: string | null; submitted_kind: string | null; submitted_expiration: string | null; submitted_note: string | null };
  const docReqs = ((docReqData ?? []) as DocReq[]).filter((r) => r.status === "submitted" || new Date(r.expires_at) > new Date());
  const photoUrls = new Map<string, string>();
  for (const r of docReqs) {
    if (r.status === "submitted" && r.file_path) {
      const { data: signed } = await db.storage.from("proofs").createSignedUrl(r.file_path, 3600);
      if (signed?.signedUrl) photoUrls.set(r.id, signed.signedUrl);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        back={{ href: "/app/crew", label: "Crew" }}
        title={c.name}
        description={`${c.role ?? "crew"}${c.phone ? ` · ${c.phone}` : ""}${c.status === "inactive" ? " · inactive" : ""}`}
        actions={
          <Popover>
            <PopoverTrigger className="flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-line-2 px-3 text-sm text-ink-dim hover:bg-elevated hover:text-ink">
              <Settings2 className="h-4 w-4" /> Manage
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3">
              <form action={updateCrewMember} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={c.id} />
                <label className="text-xs text-ink-faint">Name<input name="name" defaultValue={c.name} required className={`${fld} mt-1 w-full`} /></label>
                <label className="text-xs text-ink-faint">Role<input name="role" defaultValue={c.role ?? ""} className={`${fld} mt-1 w-full`} /></label>
                <label className="text-xs text-ink-faint">Phone<input name="phone" defaultValue={c.phone ?? ""} className={`${fld} mt-1 w-full`} /></label>
                <label className="text-xs text-ink-faint">Status
                  <select name="status" defaultValue={c.status} className={`${fld} mt-1 w-full`}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select></label>
                <Button type="submit" size="sm">Save</Button>
              </form>
              {company.role !== "member" && (
              <div className="mt-2 border-t border-line pt-2">
                <AlertDialog>
                  <AlertDialogTrigger className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" /> Remove from crew
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove {c.name}?</AlertDialogTitle>
                      <AlertDialogDescription>Their cards and records go with them. There is no undo.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <form action={deleteCrewMember}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className={buttonClass("default", "default", "w-full bg-red-500 text-bone-soft hover:bg-red-400")}>Remove</button>
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              )}
            </PopoverContent>
          </Popover>
        }
      />

      {/* Photos in from the field — review, renew the card, close it out. */}
      {docReqs.some((r) => r.status === "submitted") && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-amber-400">Waiting on your review</h2>
          {docReqs.filter((r) => r.status === "submitted").map((r) => (
            <Card key={r.id} className="flex flex-col gap-3 border-amber-500/30 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  New {r.submitted_kind ?? "card"} photo from {c.name}
                  {r.submitted_expiration ? <span className="text-ink-dim"> — expires {fmtDate(r.submitted_expiration)}</span> : null}
                </p>
                <span className="text-xs text-ink-faint">{r.submitted_at ? new Date(r.submitted_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</span>
              </div>
              {r.submitted_note && <p className="text-sm text-ink-dim">&ldquo;{r.submitted_note}&rdquo;</p>}
              <div className="flex flex-wrap gap-2">
                {photoUrls.get(r.id) && (
                  <a href={photoUrls.get(r.id)} target="_blank" rel="noreferrer"
                    className="flex min-h-10 items-center justify-center rounded-lg bg-bone px-4 text-[13px] font-semibold text-coal hover:bg-bone-soft">
                    Open the photo
                  </a>
                )}
                <form action={closeDocRequest}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="crew_id" value={c.id} />
                  <button type="submit" className="flex min-h-10 cursor-pointer items-center justify-center rounded-lg border border-line-2 px-4 text-[13px] text-ink hover:bg-elevated">
                    Done — card updated below
                  </button>
                </form>
              </div>
              <p className="text-xs text-ink-faint">Check the photo, update the card&apos;s dates in the crew book below, then close this out.</p>
            </Card>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-faint">Crew book — cards &amp; certs</h2>
        {certs.length > 0 && (
          <div className="flex flex-col gap-2">
            {certs.map((it) => <ComplianceRow key={it.id} item={it} companyId={company.id} redirectPath={here} canDelete={company.role !== "member"} />)}
          </div>
        )}
        {/* The office doesn't chase paper — the hand photographs their own
            card from the field and it lands in the review queue above. */}
        <SendUpdateLink crewMemberId={c.id} crewName={c.name} crewPhone={c.phone} />
        {docReqs.some((r) => r.status === "pending") && (
          <p className="text-xs text-ink-faint">
            A link is already out with {c.name.split(" ")[0]} — good through {fmtDate(docReqs.find((r) => r.status === "pending")!.expires_at.slice(0, 10))}.
          </p>
        )}
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium text-ink">{certs.length ? "Add another card" : "Add a card — H2S, well control, CDL, medical…"}</h3>
          <form action={addComplianceItem} className="flex flex-col gap-3">
            <input type="hidden" name="parent_type" value="crew" />
            <input type="hidden" name="parent_id" value={c.id} />
            <input type="hidden" name="redirect_path" value={here} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <input name="title" required placeholder="e.g. H2S Clear, CDL, DOT medical" className={`${fld} flex-1`} />
              <select name="kind" defaultValue="cert" className={`${fld} sm:w-44`}>
                {COMPLIANCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink-faint">Issued<input name="issued_date" type="date" className={fld} /></label>
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink-faint">Expires<input name="expiration_date" type="date" className={fld} /></label>
              <Button type="submit"><Plus className="h-[18px] w-[18px]" /> Add</Button>
            </div>
          </form>
        </Card>
      </section>
    </div>
  );
}
