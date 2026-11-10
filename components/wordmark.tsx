import { cn } from "@/lib/utils";

/**
 * The SYNNR mark: a block leaned forward and cut into an S by two wedges.
 * One shape, one color, readable at the size of a browser tab.
 */
export const MARK_PATH = "M10 3H30L28.2 9H12L25.4 18L22 29H2L3.8 23H20L6.6 14Z";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("shrink-0 fill-bone", className)}>
      <path d={MARK_PATH} />
    </svg>
  );
}

/** The mark, then the name. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark className="h-[18px] w-[18px]" />
      <span className="text-[15px] font-semibold tracking-[0.16em] text-ink">SYNNR</span>
    </span>
  );
}
