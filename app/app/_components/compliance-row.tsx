import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, buttonClass } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { COMPLIANCE_KINDS, kindLabel } from "@/lib/saas/taxonomy";
import { fmtDate } from "@/lib/saas/format";
import { saasDb, type ComplianceStatus } from "@/lib/saas/db";
import { localToday } from "@/lib/saas/status";
import { isAnnualInspection } from "@/lib/saas/cert-verify";
import { UploadCert } from "./cert-upload";
import { updateComplianceItem, deleteComplianceItem } from "../_actions";

const inputCls = "h-11 rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone";

export interface RowItem {
  id: string; title: string; kind: string;
  issued_date: string | null; expiration_date: string | null; status: ComplianceStatus;
  renewed_without_proof?: boolean;
  pending_until?: string | null;
  waiting_upload_id?: string | null;
  last_upload_id: string | null;
  /** A later date a manager typed in, held until a photo of the cert shows it. */
  typed_expiration?: string | null;
  /** customer/operator names this requirement applies to; empty = all jobs */
  customers?: string[];
}

/** The columns every page selects for a row. */
export const ROW_COLUMNS = "id, title, kind, issued_date, expiration_date, status, renewed_without_proof, pending_until, waiting_upload_id, last_upload_id, typed_expiration";

const chip = "rounded-sm border px-1.5 py-0.5 text-[11px] font-medium";

/** The time now, read outside render. */
const clock = () => Date.now();

/**
 * A turned-down upload, so whoever sent it sees it and why: the item's newest
 * upload, when a manager turned it down in the last 30 days and nothing new
 * has come in since. (Row-level security keeps the read inside the company.)
 */
async function turnedDown(itemId: string): Promise<{ from: string | null; by: string | null; note: string | null } | null> {
  const db = await saasDb();
  const { data } = await db.from("saas_cert_uploads")
    .select("status, uploaded_by_name, reviewed_by_name, reviewed_at, review_note")
    .eq("item_id", itemId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const u = data as { status: string; uploaded_by_name: string | null; reviewed_by_name: string | null; reviewed_at: string | null; review_note: string | null } | null;
  if (!u || u.status !== "rejected" || !u.reviewed_at) return null;
  if (Date.parse(u.reviewed_at) < clock() - 30 * 86400e3) return null;
  return { from: u.uploaded_by_name, by: u.reviewed_by_name, note: u.review_note };
}

/** One compliance item: status, dates, "Upload new cert", and an Edit/Delete disclosure. */
export default async function ComplianceRow({ item, redirectPath, isManager, allowOnTheWay = true, paperUrl }: {
  item: RowItem; redirectPath: string; isManager: boolean; allowOnTheWay?: boolean; paperUrl?: string;
}) {
  const down = await turnedDown(item.id);
  const failing = item.status === "expired" || item.status === "none";
  const onTheWay = failing && Boolean(item.pending_until && item.pending_until >= localToday());
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Full width on a phone so the name never gets squeezed into a
            one-word column; the buttons wrap to their own line below. */}
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.title}</span>
            {onTheWay ? (
              <span className={`${chip} border-amber-500/30 bg-amber-500/10 text-amber-400`}>Cert on the way</span>
            ) : (
              <StatusBadge status={item.status} />
            )}
            {item.waiting_upload_id && (
              isManager
                ? <a href="/app/review" className={`${chip} border-amber-500/30 bg-amber-500/10 text-amber-400 underline-offset-2 hover:underline`}>Upload waiting on you</a>
                : <span className={`${chip} border-amber-500/30 bg-amber-500/10 text-amber-400`}>Upload waiting on a manager</span>
            )}
            {item.typed_expiration && (
              <span className={`${chip} border-amber-500/30 bg-amber-500/10 text-amber-400`}
                title="A manager typed a later date. It doesn't count until a photo of the cert shows it.">
                Typed {fmtDate(item.typed_expiration)}, needs the cert photo
              </span>
            )}
            {item.status === "no_paper" && !item.renewed_without_proof && !item.typed_expiration && (
              <span className={`${chip} border-red-500/30 bg-red-500/10 text-red-400`}
                title="No paper, no go: a date only counts with the cert attached.">
                Needs the cert photo to count
              </span>
            )}
            {item.renewed_without_proof && (
              <span className={`${chip} border-amber-500/30 bg-amber-500/10 text-amber-400`}
                title="A manager typed this date in. No photo of the cert backs it yet.">
                Date typed in, no photo
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm text-ink-dim">
            {kindLabel(item.kind).replace(/\s*\(.*$/, "")}{item.expiration_date ? ` · expires ${fmtDate(item.expiration_date)}` : " · no expiration on file"}
            {onTheWay ? ` · counts through ${fmtDate(item.pending_until!)}` : ""}
            {paperUrl ? (
              <> · <a href={paperUrl} target="_blank" rel="noreferrer" className="text-bone underline underline-offset-2">See the cert</a></>
            ) : null}
          </div>
          {down ? (
            <p className="mt-1 text-sm text-red-400">
              Upload{down.from ? ` from ${down.from}` : ""} turned down by {down.by ?? "a manager"}{down.note ? `: ${down.note.replace(/\.+$/, "")}` : ""}. Upload it again.
            </p>
          ) : null}
          {item.customers && item.customers.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.customers.map((c) => (
                <span key={c} className="rounded-sm border border-line-2 bg-coal px-2 py-0.5 text-[11px] text-ink-dim">{c}</span>
              ))}
            </div>
          ) : null}
        </div>
        {/* Upload + edit sit side by side; the upload panel renders
            order-last w-full, wrapping to its own full-width band under the
            row instead of wedging into this corner. */}
        <UploadCert itemId={item.id} isManager={isManager} allowOnTheWay={allowOnTheWay} failing={failing && !onTheWay} noPaper={item.status === "no_paper"}
          annual={isAnnualInspection(item.kind, item.title)} />
        {isManager && (
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger aria-label="Edit item" className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-line-2 text-ink-dim hover:bg-elevated hover:text-ink">
              <Pencil className="h-3.5 w-3.5" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-3">
              <form action={updateComplianceItem} className="flex flex-col gap-2">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="redirect_path" value={redirectPath} />
                <input name="title" defaultValue={item.title} required className={inputCls} />
                <select name="kind" defaultValue={item.kind} className={inputCls}>
                  {COMPLIANCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-ink-faint">Issued
                    <input type="date" name="issued_date" defaultValue={item.issued_date ?? ""} className={`${inputCls} min-w-0`} /></label>
                  <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] text-ink-faint">Expires
                    <input type="date" name="expiration_date" defaultValue={item.expiration_date ?? ""} className={`${inputCls} min-w-0`} /></label>
                </div>
                <p className="text-[11px] leading-snug text-ink-faint">For fixing a typo. A changed date shows &quot;typed in, no photo&quot; and lands on the review page.</p>
                <label className="flex flex-col gap-1 text-[11px] text-ink-faint">Customers this applies to (comma separated; blank = all jobs)
                  <input name="customers" defaultValue={(item.customers ?? []).join(", ")} placeholder="e.g. Oxy, Diamondback" className={inputCls} /></label>
                <Button type="submit" size="sm">Save changes</Button>
              </form>
              <div className="mt-2 border-t border-line pt-2">
                <AlertDialog>
                  <AlertDialogTrigger className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete item
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {item.title}?</AlertDialogTitle>
                      <AlertDialogDescription>Its history and any attached proof photos go with it. There is no undo.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <form action={deleteComplianceItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="redirect_path" value={redirectPath} />
                        <button type="submit" className={buttonClass("default", "default", "w-full bg-red-500 text-white hover:bg-red-400")}>Delete it</button>
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        )}
      </div>
    </Card>
  );
}
