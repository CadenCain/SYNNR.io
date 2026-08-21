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
import type { ComplianceStatus } from "@/lib/saas/db";
import RenewControl from "./renew-control";
import { updateComplianceItem, deleteComplianceItem } from "../_actions";

const inputCls = "h-10 rounded-lg border border-line-2 bg-coal px-3 text-sm text-ink outline-none focus:border-bone";

export interface RowItem {
  id: string; title: string; kind: string;
  issued_date: string | null; expiration_date: string | null; status: ComplianceStatus;
  renewed_without_proof?: boolean;
  /** customer/operator names this requirement applies to; empty = all jobs */
  customers?: string[];
}

/** One compliance item: status, dates, Renew (camera), and an Edit/Delete disclosure. */
export default function ComplianceRow({ item, companyId, redirectPath, canDelete = true }: { item: RowItem; companyId: string; redirectPath: string; canDelete?: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{item.title}</span>
            <StatusBadge status={item.status} />
            {item.renewed_without_proof && (
              <span className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-400"
                title="The date was changed without attaching the new cert — renew with a photo to clear this.">
                renewed — no proof
              </span>
            )}
          </div>
          <div className="mt-0.5 text-sm text-ink-dim">
            {kindLabel(item.kind)}{item.expiration_date ? ` · expires ${fmtDate(item.expiration_date)}` : " · no expiration set"}
          </div>
          {item.customers && item.customers.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.customers.map((c) => (
                <span key={c} className="rounded-sm border border-line-2 bg-coal px-2 py-0.5 text-[11px] text-ink-dim">{c}</span>
              ))}
            </div>
          ) : null}
        </div>
        {/* Renew + edit sit side by side; RenewControl's OPEN state renders
            order-last w-full, wrapping to its own full-width band under the
            row instead of wedging into this corner and colliding with the
            edit popover. */}
        <RenewControl itemId={item.id} companyId={companyId} redirectPath={redirectPath} />
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger aria-label="Edit item" className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-line-2 text-ink-dim hover:bg-elevated hover:text-ink">
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
                  <label className="flex flex-1 flex-col gap-1 text-[11px] text-ink-faint">Issued
                    <input type="date" name="issued_date" defaultValue={item.issued_date ?? ""} className={inputCls} /></label>
                  <label className="flex flex-1 flex-col gap-1 text-[11px] text-ink-faint">Expires
                    <input type="date" name="expiration_date" defaultValue={item.expiration_date ?? ""} className={inputCls} /></label>
                </div>
                <label className="flex flex-col gap-1 text-[11px] text-ink-faint">Customers this applies to (comma separated; blank = all jobs)
                  <input name="customers" defaultValue={(item.customers ?? []).join(", ")} placeholder="e.g. Oxy, Diamondback" className={inputCls} /></label>
                <Button type="submit" size="sm">Save changes</Button>
              </form>
              {canDelete && (
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
                        <button type="submit" className={buttonClass("default", "default", "w-full bg-red-500 text-bone-soft hover:bg-red-400")}>Delete it</button>
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </Card>
  );
}
