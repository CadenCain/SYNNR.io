"use client";

import { useState } from "react";
import type { TallyResult } from "@/lib/tally/types";

const ENDPOINT = { xlsx: "/api/tally/export", pdf: "/api/tally/pdf" } as const;
const LABEL = { xlsx: "Export to Excel ↓", pdf: "Export PDF ↓" } as const;

export default function ExportButton({
  result,
  filename,
  kind = "xlsx",
  primary = true,
}: {
  result: TallyResult;
  filename: string;
  kind?: "xlsx" | "pdf";
  primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await fetch(ENDPOINT[kind], { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ result }) });
      if (!r.ok) { setBusy(false); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setBusy(false);
  }
  return <button className={`btn ${primary ? "btn-primary" : "btn-ghost"}`} onClick={go} disabled={busy}>{busy ? "Exporting…" : LABEL[kind]}</button>;
}
