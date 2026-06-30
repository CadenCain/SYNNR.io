import Link from "next/link";
import { Warehouse, Plus, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { StatusDot, type ComplianceStatus } from "@/components/ui/status-badge";

// Phase 1 dashboard — the real rollup + action list lands in Phase 5 once
// there's data. For now: the status-rollup layout with zero state + a real
// empty state that points at onboarding (Phase 2) / yard creation (Phase 4).
export default function Dashboard() {
  const rollup: { status: ComplianceStatus; label: string; count: number }[] = [
    { status: "expired", label: "Expired", count: 0 },
    { status: "expiring", label: "Expiring this month", count: 0 },
    { status: "valid", label: "Valid", count: 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
        <p className="mt-1 text-sm text-zinc-400">Every cert, inspection, and DOT item across your yards — at a glance.</p>
      </div>

      {/* Status rollup */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {rollup.map((r) => (
          <Card key={r.label} className="p-5">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <StatusDot status={r.status} />
              {r.label}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{r.count}</div>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
          <Warehouse className="h-6 w-6 text-zinc-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">No yards yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">
            Add your first yard and start tracking trucks, shops, assets, and certs — or import an existing list to load it in minutes.
          </p>
        </div>
        <div className="flex w-full flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Link href="/app/yards" className={buttonClass("default")}>
            <Plus className="h-[18px] w-[18px]" /> Add a yard
          </Link>
          <Link href="/app/yards" className={buttonClass("outline")}>
            <Upload className="h-[18px] w-[18px]" /> Import a list
          </Link>
        </div>
        <p className="text-xs text-zinc-500">Preview build — sign-in &amp; onboarding land in the next phase.</p>
      </Card>
    </div>
  );
}
