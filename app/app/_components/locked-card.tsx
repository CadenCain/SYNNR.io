import Link from "next/link";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";

/**
 * Shown where the load-out would be when the subscription isn't active:
 * canceled, unpaid, or never finished. Records stay readable and exportable.
 */
export default function LockedCard({ owner, what = "Load-outs" }: { owner: boolean; what?: string }) {
  return (
    <Card className="flex flex-col gap-3 border-amber-500/40 p-5">
      <div className="flex items-center gap-2 text-lg font-semibold"><Lock className="h-5 w-5 text-amber-400" /> {what} are locked</div>
      <p className="text-sm text-ink-dim">
        The subscription for this company isn&apos;t active. Your trucks, iron, and every load-out record are safe, and you can still look them up and export them.
      </p>
      {owner ? (
        <Link href="/onboarding/billing" className={buttonClass("default", "lg", "self-start")}>Restart the subscription</Link>
      ) : (
        <p className="text-sm text-ink-faint">Ask your account owner to restart the subscription.</p>
      )}
    </Card>
  );
}
