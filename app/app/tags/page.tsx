import Link from "next/link";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getEquipment } from "@/lib/saas/equipment";
import { qrSvg, tagUrl } from "@/lib/saas/qr";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

/**
 * QR tag sheet. Print on label paper (or plain paper, cut and laminate) and
 * put one on each piece of iron. A scan opens that piece's public tag page.
 * Each tag's link is permanent, so a reprint scans the same.
 */
export default async function TagSheet({ searchParams }: { searchParams: Promise<{ ids?: string; yard?: string; size?: string }> }) {
  const { company } = await requireCompany();
  const { ids, yard, size } = await searchParams;
  const db = await saasDb();
  const list = await getEquipment(db, company.id);
  const want = ids ? new Set(ids.split(",")) : null;
  const rows = list.rows
    .filter((r) => r.state !== "retired")
    .filter((r) => !want || want.has(r.id))
    .filter((r) => !yard || r.yardOf === yard);
  const small = size === "small";
  const codes = await Promise.all(rows.map((r) => qrSvg(tagUrl(r.tagToken))));

  const q = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ids, yard, size, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/app/tags?${s}` : "/app/tags";
  };

  return (
    <div className="tag-sheet flex flex-col gap-5">
      {/* On paper: just the tags. */}
      <style>{`@media print {
        @page { margin: 0.4in; }
        body { background: #fff !important; }
        aside, header, nav, .no-print { display: none !important; }
        main { padding: 0 !important; max-width: none !important; }
        .saas > div > div:not(main) { display: none !important; }
      }`}</style>

      <div className="no-print flex flex-col gap-4">
        <PageHeader
          back={{ href: "/app", label: "Equipment" }}
          title="QR tags"
          description={`${rows.length} ${rows.length === 1 ? "tag" : "tags"}. Print on label paper, or plain paper you cut out and laminate. A scan shows that piece's serial, test dates, and paper.`}
          actions={rows.length ? <PrintButton /> : null}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-ink-faint">Size</span>
          <Link href={q({ size: undefined })} className={cn("rounded-full border px-3 py-1.5", !small ? "border-bone bg-bone text-white" : "border-line-2 bg-surface text-ink-dim")}>Large, 8 per page</Link>
          <Link href={q({ size: "small" })} className={cn("rounded-full border px-3 py-1.5", small ? "border-bone bg-bone text-white" : "border-line-2 bg-surface text-ink-dim")}>Small, 24 per page</Link>
          {!ids && list.yards.length > 1 && (
            <>
              <span className="ml-2 text-ink-faint">Yard</span>
              <Link href={q({ yard: undefined })} className={cn("rounded-full border px-3 py-1.5", !yard ? "border-bone bg-bone text-white" : "border-line-2 bg-surface text-ink-dim")}>All</Link>
              {list.yards.map((y) => (
                <Link key={y.id} href={q({ yard: y.id })} className={cn("rounded-full border px-3 py-1.5", yard === y.id ? "border-bone bg-bone text-white" : "border-line-2 bg-surface text-ink-dim")}>{y.name}</Link>
              ))}
            </>
          )}
          {ids && <Link href="/app/tags" className="ml-2 text-bone hover:underline">Show every tag</Link>}
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="no-print px-6 py-12 text-center text-sm text-ink-dim">
          No equipment to tag yet. <Link href="/app" className="text-bone hover:underline">Add equipment</Link> first.
        </Card>
      ) : (
        <div className={cn("grid gap-3 print:gap-2", small ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
          {rows.map((r, i) => (
            <div key={r.id} className={cn("flex items-center gap-3 rounded-xl border border-dashed border-line-2 bg-white p-3 text-slate-900 [break-inside:avoid]", small ? "gap-2 p-2" : "")}>
              <div className={cn("shrink-0 [&_svg]:h-full [&_svg]:w-full", small ? "h-[0.95in] w-[0.95in]" : "h-[1.6in] w-[1.6in]")}
                dangerouslySetInnerHTML={{ __html: codes[i] }} />
              <div className="min-w-0">
                <div className={cn("truncate font-semibold uppercase tracking-wide text-slate-500", small ? "text-[8px]" : "text-[10px]")}>{company.name}</div>
                <div className={cn("break-words font-bold leading-tight", small ? "text-[11px]" : "text-base")}>{r.name}</div>
                {r.identifier ? <div className={cn("font-semibold tabular-nums", small ? "text-[10px]" : "text-sm")}>SN {r.identifier}</div> : null}
                <div className={cn("mt-1 text-slate-500", small ? "text-[8px]" : "text-[11px]")}>Scan for test dates</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
