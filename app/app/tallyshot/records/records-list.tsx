"use client";

import { useMemo, useState } from "react";

export type RecRow = {
  id: string; well_name: string | null; rig: string | null; sheet_no: string | null;
  grand_total_ft: number; joint_count: number; flagged_count: number;
  confirmed_at: string | null; created_at: string;
};

const fmtDate = (s: string) => new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function RecordsList({ rows }: { rows: RecRow[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "flagged" | "verified">("all");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "flagged" && r.flagged_count === 0) return false;
      if (status === "verified" && !r.confirmed_at) return false;
      if (!needle) return true;
      return `${r.well_name ?? ""} ${r.rig ?? ""} ${r.sheet_no ?? ""}`.toLowerCase().includes(needle);
    });
  }, [rows, q, status]);

  return (
    <>
      <div className="rec-controls">
        <input className="rec-search" placeholder="Search well or rig…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tallies" />
        <div className="rec-filters">
          {(["all", "flagged", "verified"] as const).map((s) => (
            <button key={s} className={`rec-chip${status === s ? " on" : ""}`} onClick={() => setStatus(s)}>
              {s === "all" ? "All" : s === "flagged" ? "Needs review" : "Verified"}
            </button>
          ))}
        </div>
      </div>

      <div className="rec-table">
        <div className="rec-row rec-head"><span>Well</span><span>Total</span><span>Joints</span><span>Status</span><span>Saved</span></div>
        {filtered.length === 0 ? (
          <div className="rec-row"><span style={{ gridColumn: "1 / -1", color: "var(--fg-faint)" }}>No tallies match.</span></div>
        ) : filtered.map((r) => (
          <a key={r.id} className="rec-row" href={`/app/tallyshot/records/${r.id}`}>
            <span className="rec-well">{r.well_name || (r.sheet_no ? `Sheet ${r.sheet_no}` : "Untitled tally")}{r.rig ? <em className="rec-rig"> · Rig {r.rig}</em> : null}</span>
            <span className="mono">{Number(r.grand_total_ft).toFixed(2)} ft</span>
            <span className="mono">{r.joint_count}</span>
            <span className={`rec-status ${r.flagged_count ? "warn" : r.confirmed_at ? "ok" : ""}`}>
              {r.flagged_count ? `${r.flagged_count} flagged` : r.confirmed_at ? "✓ Verified" : "Saved"}
            </span>
            <span className="rec-date">{fmtDate(r.created_at)}</span>
          </a>
        ))}
      </div>
    </>
  );
}
