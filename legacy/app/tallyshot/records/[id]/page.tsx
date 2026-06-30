import "../../../../marketing.css";
import "../../../../apps/apps.css";
import "../../tallyshot.css";
import { notFound } from "next/navigation";
import { requireProduct } from "@/lib/marketplace/access";
import { getServerSupabase } from "@/lib/supabase/server";
import type { TallyResult } from "@/lib/tally/types";
import AppShell from "../../../app-shell";
import ExportButton from "./export-button";
import SignOff from "./sign-off";

export const metadata = { title: "Tally — TallyShot records" };

const ft = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)} ft`);

export default async function RecordDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { check } = await requireProduct("tallyshot");
  if (!check.allowed) {
    return (
      <AppShell current="tallyshot" title="Saved tally"><p className="apps-note" style={{ textAlign: "left" }}>{check.reason}</p></AppShell>
    );
  }

  const supabase = await getServerSupabase();
  const { data: row } = supabase
    ? await supabase.from("tallies").select("*").eq("id", id).maybeSingle()
    : { data: null };
  if (!row) notFound();

  const result = row.result as unknown as TallyResult;
  const subAt = new Map<number, number>();
  for (const s of result.subtotals ?? []) subAt.set(s.to, s.ft);
  const title = row.well_name || (row.sheet_no ? `Sheet ${row.sheet_no}` : "Tally");
  const metaLine = [row.company, row.lease && `Lease ${row.lease}`, row.rig && `Rig ${row.rig}`, row.size, row.weight && `${row.weight} lb/ft`, row.grade && `Grade ${row.grade}`, row.connection && `${row.connection} conn`, row.tally_date].filter(Boolean).join("  ·  ") || "Saved tally record";

  return (
    <AppShell current="tallyshot" title={title} subtitle={metaLine}>
        <a className="rec-back" href="/app/tallyshot/records">← All saved tallies</a>
        <SignOff id={row.id} confirmedBy={row.confirmed_by_email} confirmedAt={row.confirmed_at} />

        <div className="ts">
          <div className="ts-actions">
            <ExportButton result={result} filename={`tallyshot-${(row.well_name || "tally").replace(/\s+/g, "-").toLowerCase()}.xlsx`} />
            <ExportButton result={result} kind="pdf" primary={false} filename={`tallyshot-${(row.well_name || "tally").replace(/\s+/g, "-").toLowerCase()}.pdf`} />
          </div>

          <div className="ts-summary">
            <div className="sc"><div className="n">{result.grandTotalFt}</div><div className="k">Trusted total (ft)</div></div>
            <div className="sc"><div className="n">{result.trustedCount}/{result.jointCount}</div><div className="k">Joints trusted</div></div>
            <div className={`sc ${result.flaggedCount ? "amber" : ""}`}><div className="n">{result.flaggedCount}</div><div className="k">Flagged</div></div>
            <div className={`sc ${result.crossCheck?.ran ? (result.crossCheck.pass ? "green" : "red") : ""}`}>
              <div className="n">{result.crossCheck?.ran ? (result.crossCheck.pass ? "PASS" : "FAIL") : "—"}</div><div className="k">Cross-check</div>
            </div>
          </div>

          <div className="ts-table">
            <div className="tr th"><span>No.</span><span>Read</span><span>Length</span><span>Cum ft</span><span>Status</span><span>Comments</span></div>
            {result.joints.map((j) => (
              <div key={j.joint} className={`tr ${j.trusted ? "" : j.flag === "RANGE" ? "flag" : "warn"}`}>
                <span className="mono">{j.joint}</span>
                <span className="mono">{j.raw}</span>
                <span className="mono">{ft(j.lengthFt)}{j.kind && j.kind !== "joint" ? <em className="kind-tag"> {j.kind}</em> : null}</span>
                <span className="mono">{j.cumulativeFt != null ? j.cumulativeFt.toFixed(2) : "—"}</span>
                <span className="st ok">{j.trusted ? "Trusted" : j.flag === "RANGE" ? "Out of range" : j.flag === "LOW_CONFIDENCE" ? "Low confidence" : "Unreadable"}</span>
                <span className="note-ro">{j.note || "—"}</span>
              </div>
            ))}
          </div>
        </div>
    </AppShell>
  );
}
