import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/** Consistent page header: optional back link, title, description, action slot. */
export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: string;
  description?: string;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-sm text-ink-dim hover:text-ink">
            <ChevronLeft className="h-4 w-4" /> {back.label}
          </Link>
        ) : null}
        <h1 className="truncate text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-dim">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
