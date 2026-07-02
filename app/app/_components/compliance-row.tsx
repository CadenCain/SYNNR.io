import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { COMPLIANCE_KINDS, kindLabel } from "@/lib/saas/taxonomy";
import type { ComplianceStatus } from "@/lib/saas/db";
import RenewControl from "./renew-control";
import { updateComplianceItem, deleteComplianceItem } from "../_actions";

const inputCls = "h-10 rounded-lg border border-line-2 bg-coal px-3 text-sm text-ink outline-none focus:border-bone";

export interface RowItem {
  id: string; title: string; kind: string;
  issued_date: string | null; expiration_date: string | null; status: ComplianceStatus;
  /** customer/operator names this requirement applies to; empty = all jobs */
  customers?: string[];
}

/** One compliance item: status, dates, Renew (camera), and an Edit/Delete disclosure. */
export default function ComplianceRow({ item, companyId, redirectPath }: { item: RowItem; companyId: string; redirectPath: string }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium">{item.title}</span>
            <StatusBadge status={item.status} />
          </div>
          <div className="mt-0.5 text-sm text-ink-dim">
            {kindLabel(item.kind)}{item.expiration_date ? ` · expires ${item.expiration_date}` : " · no expiration set"}
          </div>
          {item.customers && item.customers.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {item.customers.map((c) => (
                <span key={c} className="rounded-full border border-line-2 bg-coal px-2 py-0.5 text-[11px] text-ink-dim">{c}</span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <RenewControl itemId={item.id} companyId={companyId} redirectPath={redirectPath} />
          <details className="group relative">
            <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-line-2 text-ink-dim hover:bg-elevated hover:text-ink [&::-webkit-details-marker]:hidden">
              <Pencil className="h-3.5 w-3.5" />
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-line bg-elevated p-3 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.9)]">
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
              <form action={deleteComplianceItem} className="mt-2 border-t border-line pt-2">
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="redirect_path" value={redirectPath} />
                <button type="submit" className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10">
                  <Trash2 className="h-3.5 w-3.5" /> Delete item
                </button>
              </form>
            </div>
          </details>
        </div>
      </div>
    </Card>
  );
}
