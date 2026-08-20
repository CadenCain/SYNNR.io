import { Plus, ChevronDown } from "lucide-react";

/**
 * Collapsed-by-default home for creation forms on detail pages. The profile
 * screen stays a display surface (statuses, assets, records) and data entry
 * sits one tap away — but it's a native <details>, not a modal: no client JS,
 * no focus traps to fight with gloves, and when the list is EMPTY the form
 * opens itself, because an empty page whose only action is hidden is a dead
 * end.
 */
export function AddDisclosure({ label, defaultOpen = false, children }: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-2xl border border-line bg-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03),0_20px_40px_-28px_rgba(0,0,0,0.9)]">
      <summary className="flex min-h-13 cursor-pointer list-none items-center gap-2.5 px-5 py-3.5 text-sm font-medium text-ink-dim transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        <Plus className="h-4 w-4 shrink-0" />
        {label}
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-line p-5">{children}</div>
    </details>
  );
}
