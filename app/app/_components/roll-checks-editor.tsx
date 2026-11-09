import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { setRollChecks } from "../packages/actions";
import { MAX_ROLL_CHECKS } from "@/lib/saas/roll-checks";

/**
 * "Before it rolls": up to three taps a hand makes at the end of every
 * load-out with this package or kit. For the things a scan can't see that
 * cost money when skipped.
 */
export default function RollChecksEditor({ checks, editable, packageId, unitId }: {
  checks: string[];
  editable: boolean;
  packageId?: string;
  unitId?: string;
}) {
  const field = "h-12 w-full rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone";
  const slots = Array.from({ length: MAX_ROLL_CHECKS }, (_, i) => checks[i] ?? "");
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div>
        <h2 className="font-semibold">Before it rolls</h2>
        <p className="mt-0.5 text-sm text-ink-dim">
          Up to {MAX_ROLL_CHECKS} things the hand taps before saving, with their name on each. Skipping one makes the truck NOT READY. Keep them to what costs money when it&apos;s missed.
        </p>
      </div>
      {editable ? (
        <form action={setRollChecks} className="flex flex-col gap-2">
          {packageId ? <input type="hidden" name="package_id" value={packageId} /> : null}
          {unitId ? <input type="hidden" name="unit_id" value={unitId} /> : null}
          {slots.map((c, i) => (
            <input key={i} name="check" defaultValue={c} maxLength={60} aria-label={`Check ${i + 1}`} className={field}
              placeholder={["BOP rams closed for travel", "Everything strapped and padded", "Lubricator capped"][i]} />
          ))}
          <button type="submit" className={buttonClass("outline", "lg", "self-start")}>Save</button>
        </form>
      ) : checks.length ? (
        <ul className="flex flex-col gap-1 text-sm">{checks.map((c) => <li key={c}>{c}</li>)}</ul>
      ) : (
        <p className="text-sm text-ink-faint">None set.</p>
      )}
    </Card>
  );
}
