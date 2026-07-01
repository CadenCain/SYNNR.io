"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, TriangleAlert, Eye, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { previewImport, commitImport, type ImportResult } from "./actions";

const SAMPLE = `unit,unit_type,asset,category,crew,item,kind,issued,expires
Rig 4,service rig,,,,Annual DOT inspection,inspection,2026-02-01,2027-02-01
Rig 4,service rig,BOP #3,pressure control,,BOP test,test,2026-01-15,2026-07-15
Truck 12,truck,,,,DOT sticker,dot_sticker,2026-03-01,2027-03-01
,,,,Jerry Boles,H2S Clear,cert,2026-05-01,2027-05-01`;

export default function ImportClient({ yards }: { yards: { id: string; name: string }[] }) {
  const router = useRouter();
  const [csv, setCsv] = useState(SAMPLE);
  const [yardId, setYardId] = useState("");
  const [newYard, setNewYard] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function run(commit: boolean) {
    setBusy(true);
    const res = commit
      ? await commitImport({ csv, yardId, newYard })
      : await previewImport({ csv, yardId, newYard });
    setResult(res);
    setBusy(false);
    if (commit && res.ok) router.refresh();
  }

  const fld = "h-11 rounded-lg border border-line-2 bg-coal px-3 text-ink outline-none focus:border-bone";

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4 p-5">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="text-ink">Yard</span>
          {yards.length > 0 ? (
            <select value={yardId} onChange={(e) => setYardId(e.target.value)} className={fld}>
              <option value="">— New yard below —</option>
              {yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          ) : null}
          <input value={newYard} onChange={(e) => setNewYard(e.target.value)} placeholder="Or name a new yard" className={`${fld} mt-2`} />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="flex items-center justify-between text-ink">
            CSV
            <a download="synnr-import-template.csv"
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}
              className="text-xs text-bone hover:underline">Download template</a>
          </span>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={10}
            className="rounded-lg border border-line-2 bg-coal px-3 py-2 font-mono text-xs text-ink outline-none focus:border-bone" />
          <span className="text-xs text-ink-faint">
            Columns (any order): <span className="font-mono">unit, unit_type, asset, category, crew, item, kind, issued, expires</span>.
            Crew rows: leave unit blank, fill <span className="font-mono">crew</span>. Re-importing updates dates — no duplicates.
            Working in Excel? File → Save As → CSV, then paste here.
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => run(false)} disabled={busy} variant="outline">
            <Eye className="h-[18px] w-[18px]" /> {busy ? "Working…" : "Preview (dry run)"}
          </Button>
          <Button onClick={() => run(true)} disabled={busy || !result || !result.ok || (!result.committed && result.errors === result.rows.length)}>
            <Upload className="h-[18px] w-[18px]" /> {busy ? "Working…" : "Commit import"}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="flex flex-col gap-3 p-5">
          {!result.ok ? (
            <p className="flex items-center gap-2 text-sm text-red-400"><TriangleAlert className="h-4 w-4" /> {result.error}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className={`flex items-center gap-1.5 font-semibold ${result.committed ? "text-emerald-400" : "text-ink"}`}>
                  {result.committed ? <><Check className="h-4 w-4" /> Imported</> : "Dry run"}
                </span>
                <span className="text-ink-dim">{result.creates} create{result.creates === 1 ? "" : "s"}</span>
                <span className="text-ink-dim">{result.updates} update{result.updates === 1 ? "" : "s"}</span>
                <span className={result.errors > 0 ? "font-medium text-red-400" : "text-ink-dim"}>{result.errors} error{result.errors === 1 ? "" : "s"}</span>
              </div>
              <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                {result.rows.map((r, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2 text-sm ${r.error ? "border-red-500/40 bg-red-500/10" : "border-line bg-coal"}`}>
                    <span className="mr-2 font-mono text-xs text-ink-faint">{r.line === 0 ? "yard" : `L${r.line}`}</span>
                    {r.error ? <span className="text-red-300">{r.error}</span> : <span className="text-ink-dim">{r.ops.join(" · ")}</span>}
                  </div>
                ))}
              </div>
              {!result.committed && result.errors === 0 ? (
                <p className="text-xs text-ink-faint">Looks clean — hit Commit import to apply.</p>
              ) : !result.committed && result.errors > 0 ? (
                <p className="text-xs text-amber-400">Rows with errors are skipped on commit; the rest import fine.</p>
              ) : null}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
