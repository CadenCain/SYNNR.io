import { cn } from "@/lib/utils";

/** The SYNNR mark: a solid orange block, then the name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden className="h-2.5 w-2.5 rounded-[1px] bg-bone" />
      <span className="text-[15px] font-semibold tracking-[0.14em] text-ink">SYNNR</span>
    </span>
  );
}
