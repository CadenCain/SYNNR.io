import { Card } from "@/components/ui/card";

/** Placeholder for routes whose real build lands in a later phase. Keeps the
 *  nav fully navigable in the Phase 1 preview without 404s. */
export default function PhaseStub({
  title,
  phase,
  blurb,
}: {
  title: string;
  phase: string;
  blurb: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card className="flex flex-col items-center gap-2 px-6 py-16 text-center">
        <span className="rounded-full border border-line-2 bg-surface px-3 py-0.5 text-xs font-medium text-ink-dim">
          {phase}
        </span>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-dim">{blurb}</p>
      </Card>
    </div>
  );
}
