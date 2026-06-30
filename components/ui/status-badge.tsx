import { cn } from "@/lib/utils";

/**
 * The compliance status system used EVERYWHERE — dashboards, lists, asset
 * cards, item rows. A field guy reads it in 2 seconds.
 *   🟢 valid · 🟡 expiring (within lead days) · 🔴 expired · ⚪️ missing/none
 */
export type ComplianceStatus = "valid" | "expiring" | "expired" | "none";

const STYLES: Record<ComplianceStatus, { dot: string; chip: string; label: string }> = {
  valid: { dot: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", label: "Valid" },
  expiring: { dot: "bg-amber-500", chip: "bg-amber-500/10 text-amber-400 border-amber-500/30", label: "Expiring" },
  expired: { dot: "bg-red-500", chip: "bg-red-500/10 text-red-400 border-red-500/30", label: "Expired" },
  none: { dot: "bg-zinc-500", chip: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30", label: "Missing" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: ComplianceStatus;
  label?: string;
  className?: string;
}) {
  const s = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        s.chip,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {label ?? s.label}
    </span>
  );
}

/** Just the colored dot — for dense rows/cards where the chip is too much. */
export function StatusDot({ status, className }: { status: ComplianceStatus; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full", STYLES[status].dot, className)} aria-hidden />;
}
