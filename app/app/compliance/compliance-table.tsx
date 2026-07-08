"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatusBadge, type ComplianceStatus } from "@/components/ui/status-badge";
import { Table, Th, Td, Tr } from "@/components/ui/table";

/** Sortable, filterable compliance table (walkthrough M3). */
export interface CompItem {
  id: string;
  title: string;
  kind: string;
  kindLabel: string;
  expiration_date: string | null;
  status: ComplianceStatus;
  parent_type: string;
  parentLabel: string;
  href: string;
  customers: string[]; // empty = applies to all jobs
}

const STATUS_FILTERS: { key: string; label: string; match: (s: ComplianceStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "expired", label: "Expired", match: (s) => s === "expired" },
  { key: "missing", label: "Missing date", match: (s) => s === "none" },
  { key: "expiring", label: "Due soon", match: (s) => s === "expiring" },
  { key: "valid", label: "Valid", match: (s) => s === "valid" },
];
const KIND_FILTERS = [
  { key: "all", label: "Gear + crew" },
  { key: "gear", label: "Gear" },
  { key: "crew", label: "Crew" },
];
const RANK: Record<ComplianceStatus, number> = { expired: 0, none: 1, expiring: 2, valid: 3 };

export default function ComplianceTable({ items }: { items: CompItem[] }) {
  const [status, setStatus] = useState("all");
  const [kind, setKind] = useState("all");
  const [customer, setCustomer] = useState("all");
  const [sort, setSort] = useState<"severity" | "soonest" | "title">("severity");
  const customerNames = useMemo(
    () => [...new Set(items.flatMap((i) => i.customers))].sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const sf = STATUS_FILTERS.find((f) => f.key === status)!;
    let out = items.filter((i) => sf.match(i.status));
    if (kind === "gear") out = out.filter((i) => i.parent_type !== "crew");
    if (kind === "crew") out = out.filter((i) => i.parent_type === "crew");
    // Customer relevance: tagged to the selected customer, PLUS untagged
    // items (untagged = required on every job — the safe default).
    if (customer !== "all") out = out.filter((i) => i.customers.length === 0 || i.customers.includes(customer));
    return [...out].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "soonest") return (a.expiration_date ?? "9999").localeCompare(b.expiration_date ?? "9999");
      return RANK[a.status] - RANK[b.status] || (a.expiration_date ?? "9999").localeCompare(b.expiration_date ?? "9999");
    });
  }, [items, status, kind, customer, sort]);

  const chip = (active: boolean) =>
    cn("rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
      active ? "border-bone/60 bg-bone/10 text-bone" : "border-line-2 text-ink-dim hover:text-ink");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setStatus(f.key)} className={chip(status === f.key)}>{f.label}</button>
        ))}
        <span className="mx-1 h-4 w-px bg-line-2" />
        {KIND_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setKind(f.key)} className={chip(kind === f.key)}>{f.label}</button>
        ))}
        {customerNames.length > 0 && (
          <>
            <span className="mx-1 h-4 w-px bg-line-2" />
            <select value={customer} onChange={(e) => setCustomer(e.target.value)}
              className="h-8 rounded-lg border border-line-2 bg-coal px-2 text-xs text-ink-dim outline-none">
              <option value="all">All customers</option>
              {customerNames.map((c) => <option key={c} value={c}>Relevant to {c}</option>)}
            </select>
          </>
        )}
        <span className="mx-1 h-4 w-px bg-line-2" />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}
          className="h-8 rounded-lg border border-line-2 bg-coal px-2 text-xs text-ink-dim outline-none">
          <option value="severity">Worst first</option>
          <option value="soonest">Soonest expiring</option>
          <option value="title">A–Z</option>
        </select>
        <span className="ml-auto text-xs text-ink-faint">{filtered.length} of {items.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-sm text-ink-dim">
          Nothing matches this filter.
        </div>
      ) : (
        <Table>
          <thead><tr><Th>Item</Th><Th>On</Th><Th>Expires</Th><Th className="text-right">Status</Th></tr></thead>
          <tbody>
            {filtered.map((i) => (
              <Tr key={i.id}>
                <Td>
                  <Link href={i.href} className="font-medium hover:underline">{i.title}</Link>
                  <span className="ml-2 text-xs text-ink-faint">{i.kindLabel}</span>
                </Td>
                <Td className="text-ink-dim">
                  {i.parentLabel}
                  {i.customers.length > 0 ? <span className="ml-2 text-[11px] text-ink-faint">({i.customers.join(", ")})</span> : null}
                </Td>
                <Td className="whitespace-nowrap tabular-nums text-ink-dim">{i.expiration_date ?? "—"}</Td>
                <Td className="text-right"><StatusBadge status={i.status} /></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
