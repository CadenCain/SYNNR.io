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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {back ? (
          <Link href={back.href} className="mb-2 inline-flex min-h-9 items-center gap-1 text-[13px] text-ink-faint transition-colors hover:text-ink">
            <ChevronLeft className="h-4 w-4" /> {back.label}
          </Link>
        ) : null}
        <h1 className="break-words text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-ink-dim">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
