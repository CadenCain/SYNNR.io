import { Plus, Trash2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addLine, setLineQty, removeLine } from "../packages/actions";

/**
 * The lines of a package or a truck kit: a kind of piece and how many. Any
 * scanned piece whose name matches fills a line, so pick names the way
 * they're written on your iron (the box suggests them).
 */
export default function LinesEditor({ lines, editable, packageId, unitId, pieceNames }: {
  lines: { id: string; label: string; qty: number }[];
  editable: boolean;
  /** Adding to a package... */
  packageId?: string;
  /** ...or to a truck's kit (made on the first line). */
  unitId?: string;
  pieceNames: string[];
}) {
  const field = "h-12 rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone";
  return (
    <div className="flex flex-col gap-3">
      {lines.length === 0 ? <Card className="p-4 text-sm text-ink-dim">Nothing on this list yet.</Card> : null}
      {lines.map((l) => (
        <Card key={l.id} className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-0 flex-1 break-words font-medium">{l.label}</div>
          {editable ? (
            <>
              <form action={setLineQty} className="flex items-center gap-2">
                <input type="hidden" name="line_id" value={l.id} />
                <label className="text-sm text-ink-dim" htmlFor={`q-${l.id}`}>How many</label>
                <input id={`q-${l.id}`} name="qty" defaultValue={l.qty} inputMode="numeric" pattern="[0-9]*" maxLength={2} className={`${field} w-16 text-center`} />
                <button type="submit" className={buttonClass("outline", "lg")}>Save</button>
              </form>
              <form action={removeLine}>
                <input type="hidden" name="line_id" value={l.id} />
                <button type="submit" aria-label={`Take ${l.label} off the list`} className={buttonClass("ghost", "icon", "h-12 w-12 text-ink-faint hover:text-red-400")}><Trash2 className="h-5 w-5" /></button>
              </form>
            </>
          ) : (
            <span className="text-base font-semibold tabular-nums text-ink-dim">× {l.qty}</span>
          )}
        </Card>
      ))}
      {editable ? (
        <form action={addLine} className="flex flex-col gap-2 rounded-2xl border border-dashed border-line-2 p-3 sm:flex-row">
          {packageId ? <input type="hidden" name="package_id" value={packageId} /> : null}
          {unitId ? <input type="hidden" name="unit_id" value={unitId} /> : null}
          <input name="label" required maxLength={80} list="rr-line-names" placeholder="Kind of piece, like 2in 1502 plug valve" aria-label="Kind of piece"
            className={`${field} w-full min-w-0 grow`} />
          <datalist id="rr-line-names">{pieceNames.map((n) => <option key={n} value={n} />)}</datalist>
          <div className="flex gap-2">
            <input name="qty" defaultValue="1" inputMode="numeric" pattern="[0-9]*" maxLength={2} aria-label="How many" className={`${field} w-16 shrink-0 text-center`} />
            <button type="submit" className={buttonClass("default", "lg", "grow")}><Plus className="h-5 w-5" /> Add</button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
