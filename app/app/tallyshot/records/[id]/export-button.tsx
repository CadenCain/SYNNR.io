"use client";

import { useState } from "react";
import type { TallyResult } from "@/lib/tally/types";

export default function ExportButton({ result, filename }: { result: TallyResult; filename: string }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await fetch("/api/tally/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result }) });
      if (!r.ok) { setBusy(false); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setBusy(false);
  }
  return <button className="btn btn-primary" onClick={go} disabled={busy}>{busy ? "Exporting…" : "Export to Excel ↓"}</button>;
}
