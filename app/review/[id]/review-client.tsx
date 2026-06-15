"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type ReviewField = {
  id: string;
  field_path: string;
  label: string;
  value: string | number | null;
  confidence: number;
  flag: "AUTO_ACCEPTED" | "REVIEW_REQUIRED" | "MANUAL_ENTRY";
  business_rule_override: boolean;
  corrected_value: string | number | null;
};
export type ReviewDoc = {
  id: string;
  documentType: string;
  sourceFile: string;
  mime: string | null;
  status: string;
  sourceText: string | null;
  sourceUrl: string | null;
  counts: { auto: number; review: number; manual: number };
};

const MARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" />
  </svg>
);
const cls = (flag: ReviewField["flag"]) => (flag === "AUTO_ACCEPTED" ? "g" : flag === "REVIEW_REQUIRED" ? "a" : "r");
const tag = (flag: ReviewField["flag"]) =>
  flag === "AUTO_ACCEPTED" ? "Auto-accepted" : flag === "REVIEW_REQUIRED" ? "Review" : "Manual entry";

export default function ReviewClient({ doc, fields }: { doc: ReviewDoc; fields: ReviewField[] }) {
  const router = useRouter();
  const init = useMemo(() => {
    const m: Record<string, { val: string; resolved: boolean }> = {};
    for (const f of fields) {
      const v = f.corrected_value ?? f.value;
      m[f.id] = { val: v == null ? "" : String(v), resolved: f.flag === "AUTO_ACCEPTED" || f.corrected_value !== null };
    }
    return m;
  }, [fields]);
  const [state, setState] = useState(init);
  const [committing, setCommitting] = useState(false);
  const [err, setErr] = useState("");

  const need = fields.filter((f) => f.flag !== "AUTO_ACCEPTED");
  const resolvedCount = need.filter((f) => state[f.id]?.resolved).length;
  const allResolved = resolvedCount === need.length;
  const docLabel = doc.documentType === "CERTIFICATION" ? "Certification" : doc.documentType === "RATE_SHEET" ? "Rate sheet" : doc.documentType;

  async function saveField(f: ReviewField) {
    const value = state[f.id]?.val ?? "";
    if (f.flag === "MANUAL_ENTRY" && !value.trim()) { setErr(`${f.label} still needs a value.`); return; }
    setErr("");
    const prev = state[f.id];
    setState((s) => ({ ...s, [f.id]: { ...s[f.id], resolved: true } }));
    try {
      const r = await fetch(`/api/ingest/${doc.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fieldId: f.id, value }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setState((s) => ({ ...s, [f.id]: prev })); // revert on failure
      setErr("Couldn't save that field — try again.");
    }
  }

  async function commit() {
    setErr(""); setCommitting(true);
    try {
      const r = await fetch(`/api/ingest/${doc.id}`, { method: "POST" });
      const data = await r.json();
      if (!r.ok || !data.ok) { setErr(data.error || "Commit failed."); setCommitting(false); return; }
      router.push("/dashboard?ingested=1");
    } catch {
      setErr("Couldn't reach SYNNR — try again."); setCommitting(false);
    }
  }

  return (
    <div className="ing">
      <div className="topbar">
        <a className="brand" href="/dashboard">{MARK}<b>SYNNR</b></a>
        <a className="back" href="/ingest">← New document</a>
      </div>

      <div className="rvwrap">
        <div className="rvhead">
          <div>
            <span className="dtype">{docLabel}</span>
            <h1 style={{ marginTop: 10 }}>Review extracted data</h1>
            <div className="summ">
              <span className="pill g">{doc.counts.auto} auto-accepted</span>
              {doc.counts.review > 0 && <span className="pill a">{doc.counts.review} to review</span>}
              {doc.counts.manual > 0 && <span className="pill r">{doc.counts.manual} manual</span>}
            </div>
          </div>
        </div>

        <div className="cols">
          {/* Source document */}
          <div className="src">
            <div className="sh">Source · {doc.sourceFile}</div>
            {doc.sourceText ? (
              <pre>{doc.sourceText}</pre>
            ) : doc.sourceUrl && (doc.mime || "").startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={doc.sourceUrl} alt={doc.sourceFile} />
            ) : doc.sourceUrl ? (
              <iframe src={doc.sourceUrl} title={doc.sourceFile} style={{ height: "70vh" }} />
            ) : (
              <pre>Source preview unavailable.</pre>
            )}
          </div>

          {/* Extracted fields */}
          <div className="fields">
            <div className="fh">{resolvedCount}/{need.length} reviewed · click to confirm or correct</div>
            {fields.map((f) => {
              const c = cls(f.flag);
              const st = state[f.id] || { val: "", resolved: false };
              const auto = f.flag === "AUTO_ACCEPTED";
              return (
                <div key={f.id} className={`f ${c}${st.resolved && !auto ? " done" : ""}`}>
                  <div className="f1">
                    <span className="lbl">{f.label}</span>
                    <span className="meta">
                      <span className="conf">{Math.round(f.confidence * 100)}%</span>
                      <span className="tag">{st.resolved && !auto ? "Confirmed" : tag(f.flag)}</span>
                    </span>
                  </div>
                  {f.business_rule_override && <div className="rule">⚠ Failed a business-rule check — please verify.</div>}

                  {auto ? (
                    <div className="val">{st.val || "—"}</div>
                  ) : st.resolved ? (
                    <div className="row2" style={{ alignItems: "center" }}>
                      <span className="val" style={{ flex: 1, marginTop: 0 }}>{st.val || "—"}</span>
                      <button className="mini" onClick={() => setState((s) => ({ ...s, [f.id]: { ...s[f.id], resolved: false } }))}>Edit</button>
                    </div>
                  ) : (
                    <div className="row2">
                      <input
                        value={st.val}
                        placeholder={f.flag === "MANUAL_ENTRY" ? "Enter value…" : ""}
                        onChange={(e) => setState((s) => ({ ...s, [f.id]: { ...s[f.id], val: e.target.value } }))}
                        onKeyDown={(e) => e.key === "Enter" && saveField(f)}
                      />
                      <button className="mini solid" onClick={() => saveField(f)}>
                        {f.flag === "REVIEW_REQUIRED" ? "Confirm" : "Save"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="commit">
          <div className="ct">
            <b>{allResolved ? "All fields reviewed." : `${need.length - resolvedCount} field${need.length - resolvedCount === 1 ? "" : "s"} left to review.`}</b>
            <span>Commit writes this into your {docLabel.toLowerCase()} records.</span>
          </div>
          <button className="go" disabled={!allResolved || committing} onClick={commit}>
            {committing ? "Committing…" : `Commit ${docLabel.toLowerCase()}`}
          </button>
        </div>
        {err ? <div className="err" style={{ textAlign: "left" }}>{err}</div> : null}
      </div>
    </div>
  );
}
