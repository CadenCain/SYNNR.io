import { ShieldCheck, TriangleAlert, OctagonX, Lock } from "lucide-react";
import { fmtWhen, YARD_TZ } from "@/lib/saas/format";
import { plainDate } from "@/lib/saas/judge";
import { outcomeOf, reasonsOf, type LoadoutRecord, type LoadoutOverride } from "@/lib/saas/loadout-record";
import { cn } from "@/lib/utils";

/**
 * One saved load-out, as the record reads: the answer, why, the list it was
 * checked against, every piece with who scanned it and when, and what
 * didn't go. Used in the app and on the public proof link, so the operator
 * sees exactly what the shop sees.
 */

const HOW: Record<string, string> = { nfc: "NFC tap", qr: "QR scan", hand: "Checked by hand" };
const OUTCOME: Record<string, string> = {
  yard: "Taken off, stays in the yard",
  missing: "Can't find it (flagged missing)",
  left: "Not scanned, still logged on the truck",
};
const time = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: YARD_TZ, hour: "numeric", minute: "2-digit" }) : "";
const pieceLabel = (p: { name: string; serial: string | null }) => `${p.name}${p.serial ? ` ${p.serial}` : ""}`;
/** How a test stood when the piece went on: "good to May 12, 2027", "expired Oct 8, 2026", or "no date". */
const testText = (t: { title: string; good_until: string | null; result: string }) =>
  `${t.title}: ${!t.good_until ? "no date" : t.result === "expired" ? `expired ${plainDate(t.good_until)}` : `good to ${plainDate(t.good_until)}`}`;

export default function LoadoutRecordView({ rec, override, tagHref }: {
  rec: LoadoutRecord;
  override: LoadoutOverride | null;
  /** Link to a piece's public tag page (tests and the cert), when known. */
  tagHref?: (assetId: string) => string | null;
}) {
  const outcome = outcomeOf(rec, override);
  const reasons = reasonsOf(rec);
  const byHand = rec.pieces.filter((p) => p.how === "hand").length;
  const listNames = [
    rec.lines.some((l) => l.source === "kit") ? `${rec.unit_name} kit` : null,
    ...(rec.packages ?? []),
    rec.lines.some((l) => l.source === "quick") ? `${rec.lines.filter((l) => l.source === "quick").length} quick ${rec.lines.filter((l) => l.source === "quick").length === 1 ? "line" : "lines"}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-5">
      <section className={cn("rounded-2xl border p-5",
        outcome === "ready" ? "border-emerald-500/40 bg-emerald-500/10"
          : outcome === "override" ? "border-amber-500/50 bg-amber-500/10"
            : "border-red-500/50 bg-red-500/10")}>
        <div className={cn("flex items-center gap-3 text-2xl font-bold tracking-tight",
          outcome === "ready" ? "text-emerald-400" : outcome === "override" ? "text-amber-400" : "text-red-400")}>
          {outcome === "ready" ? <ShieldCheck className="h-7 w-7 shrink-0" /> : outcome === "override" ? <TriangleAlert className="h-7 w-7 shrink-0" /> : <OctagonX className="h-7 w-7 shrink-0" />}
          {outcome === "ready" ? "READY" : outcome === "override" ? "Rolled NOT READY on a manager's override" : "NOT READY"}
        </div>
        <p className="mt-1 text-sm text-ink-dim">
          {rec.unit_name} load-out, {fmtWhen(rec.finished_at)}{rec.scanned_by ? `, by ${rec.scanned_by}` : ""}.
          {" "}{rec.pieces.length} {rec.pieces.length === 1 ? "piece" : "pieces"} scanned on.
        </p>
        {byHand > 0 ? (
          <p className="mt-1 text-sm font-medium text-amber-400">
            {byHand} of {rec.pieces.length} checked by hand, not scanned off a tag.
          </p>
        ) : null}
        {override ? (
          <div className="mt-3 rounded-xl border border-amber-500/40 bg-surface p-3 text-sm">
            <div className="font-semibold text-ink">Override by {override.by_name}, {fmtWhen(override.created_at)}</div>
            <p className="mt-0.5 break-words text-ink-dim">&ldquo;{override.reason}&rdquo;</p>
          </div>
        ) : null}
        {reasons.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1.5">
            {reasons.map((r) => (
              <li key={r} className={cn("break-words text-[15px] font-medium", outcome === "override" ? "text-amber-300" : "text-red-300")}>{r}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {rec.lines.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">The list{listNames.length ? <span className="font-normal text-ink-dim">: {listNames.join(", ")}</span> : null}</h2>
          <div className="flex flex-col gap-2">
            {rec.lines.map((l, i) => {
              const red = new Set(rec.pieces.filter((p) => p.red).map((p) => p.asset_id));
              const short = l.filled.length < l.qty || l.filled.some((f) => red.has(f.asset_id));
              return (
                <div key={`${l.label}-${i}`} className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-xl border p-3",
                  short ? "border-red-500/40 bg-red-500/[0.06]" : "border-line bg-surface")}>
                  <div className="min-w-0">
                    <div className="break-words text-sm font-semibold">{l.label}</div>
                    <div className="text-[13px] text-ink-faint">
                      {l.source === "kit" ? "Truck kit" : l.source === "package" ? l.package ?? "Package" : "Quick line"}
                      {l.filled.length ? ` · ${l.filled.map((f) => `${f.serial ?? f.name}${red.has(f.asset_id) ? " (bad)" : ""}`).join(", ")}` : ""}
                    </div>
                  </div>
                  <span className={cn("shrink-0 rounded-md border px-2 py-0.5 text-sm font-semibold tabular-nums",
                    short ? "border-red-500/40 text-red-400" : "border-emerald-500/40 text-emerald-400")}>
                    {l.filled.length} of {l.qty}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">What went on the truck</h2>
        {rec.pieces.length === 0 ? <p className="text-sm text-ink-faint">Nothing was scanned on.</p> : null}
        <div className="flex flex-col gap-2 lg:hidden">
          {rec.pieces.map((p) => {
            const href = tagHref?.(p.asset_id) ?? null;
            return (
              <div key={p.asset_id} className={cn("rounded-xl border p-3", p.red ? "border-red-500/40 bg-red-500/[0.06]" : "border-line bg-surface")}>
                <div className="break-words text-sm font-semibold">{href ? <a href={href} className="hover:text-bone hover:underline">{pieceLabel(p)}</a> : pieceLabel(p)}</div>
                <div className={cn("mt-0.5 break-words text-[13px]", p.red ? "text-red-400" : "text-ink-dim")}>
                  {(p.tests ?? []).length ? (p.tests ?? []).map(testText).join(" · ") : "No test on file"}
                </div>
                <div className="mt-0.5 text-[13px] text-ink-faint">{HOW[p.how] ?? p.how}{p.at ? ` ${time(p.at)}` : ""}{p.by ? ` by ${p.by}` : ""}{p.added ? " · brought over from elsewhere" : ""}</div>
              </div>
            );
          })}
        </div>
        {rec.pieces.length > 0 ? (
          <div className="hidden overflow-x-auto rounded-xl border border-line lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-elevated text-[13px] text-ink-dim">
                <tr><th className="px-3 py-2 font-medium">Piece</th><th className="px-3 py-2 font-medium">Serial</th><th className="px-3 py-2 font-medium">Test</th><th className="px-3 py-2 font-medium">How</th><th className="px-3 py-2 font-medium">When</th><th className="px-3 py-2 font-medium">By</th></tr>
              </thead>
              <tbody>
                {rec.pieces.map((p) => {
                  const href = tagHref?.(p.asset_id) ?? null;
                  return (
                    <tr key={p.asset_id} className={cn("border-t border-line align-top", p.red && "bg-red-500/[0.06]")}>
                      <td className="px-3 py-2 font-medium">{href ? <a href={href} className="hover:text-bone hover:underline">{p.name}</a> : p.name}{p.added ? <span className="block text-xs font-normal text-ink-faint">brought over from elsewhere</span> : null}</td>
                      <td className="px-3 py-2 tabular-nums text-ink-dim">{p.serial ?? ""}</td>
                      <td className={cn("px-3 py-2", p.red ? "text-red-400" : "text-ink-dim")}>
                        {(p.tests ?? []).length ? (p.tests ?? []).map((t) => <div key={t.title}>{testText(t)}</div>) : "No test on file"}
                      </td>
                      <td className="px-3 py-2 text-ink-dim">{HOW[p.how] ?? p.how}</td>
                      <td className="px-3 py-2 tabular-nums text-ink-dim">{time(p.at)}</td>
                      <td className="px-3 py-2 text-ink-dim">{p.by ?? rec.scanned_by ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {rec.not_scanned.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Logged on {rec.unit_name} but not scanned</h2>
          {rec.not_scanned.map((n) => (
            <div key={n.asset_id} className={cn("flex flex-wrap justify-between gap-x-3 gap-y-1 rounded-xl border p-3 text-sm",
              n.outcome === "yard" ? "border-line bg-surface" : "border-red-500/40 bg-red-500/[0.06]")}>
              <span className="break-words font-medium">{pieceLabel(n)}</span>
              <span className={n.outcome === "yard" ? "text-ink-dim" : "text-red-400"}>{OUTCOME[n.outcome] ?? n.outcome}</span>
            </div>
          ))}
        </section>
      ) : null}

      <p className="flex items-center gap-2 text-[13px] text-ink-faint">
        <Lock className="h-4 w-4 shrink-0" /> Saved when the load-out finished. Nobody can edit this record.
      </p>
    </div>
  );
}
