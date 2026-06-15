"use client";

import "./ingest.css";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" />
  </svg>
);

export default function IngestPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");

  async function go(opts: { sample?: string; file?: File }) {
    setErr("");
    setBusy(opts.sample ? `sample:${opts.sample}` : "upload");
    try {
      let res: Response;
      if (opts.file) {
        const fd = new FormData();
        fd.append("file", opts.file);
        res = await fetch("/api/ingest", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sample: opts.sample }),
        });
      }
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErr(data.error || "Something went wrong. Try again.");
        setBusy(null);
        return;
      }
      router.push(data.reviewUrl);
    } catch {
      setErr("Couldn't reach SYNNR — check your connection and try again.");
      setBusy(null);
    }
  }

  return (
    <div className="ing">
      <div className="topbar">
        <a className="brand" href="/dashboard">{MARK}<b>SYNNR</b></a>
        <a className="back" href="/dashboard">← Dashboard</a>
      </div>

      <div className="wrap">
        <div className="eyebrow">Ingestion engine</div>
        <h1>Bring in a document</h1>
        <p className="lede">
          Drop in a certification or rate sheet — SYNNR reads it, scores every field, and
          routes anything it&rsquo;s unsure about to a quick review. No templates, no manual entry.
        </p>

        <div
          className={`drop${over ? " over" : ""}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) go({ file: f }); }}
        >
          <div className="ic">
            {busy === "upload"
              ? <span className="spin" />
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>}
          </div>
          <b>{busy === "upload" ? "Reading your document…" : "Drag & drop, or click to browse"}</b>
          <p>Certifications &amp; rate sheets · up to 25 MB</p>
          <div className="formats"><span>PDF</span><span>JPG / PNG / HEIC</span><span>XLSX / CSV</span><span>DOCX</span></div>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.xlsx,.csv,.docx,.txt"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) go({ file: f }); }}
          />
        </div>

        <div className="or">or see it on a sample</div>
        <div className="samples">
          <button className="samp" disabled={!!busy} onClick={() => go({ sample: "CERTIFICATION" })}>
            <b>{busy === "sample:CERTIFICATION" ? "Reading…" : "Sample certification"}</b>
            <span>A scanned H2S card — watch the handwritten expiry route to review.</span>
          </button>
          <button className="samp" disabled={!!busy} onClick={() => go({ sample: "RATE_SHEET" })}>
            <b>{busy === "sample:RATE_SHEET" ? "Reading…" : "Sample rate sheet"}</b>
            <span>An MSA rate sheet — a smudged rate cell gets flagged for a human.</span>
          </button>
        </div>

        {err ? <div className="err">{err}</div> : null}
        <p className="note">Samples run instantly with no setup. Uploading your own documents uses the AI engine.</p>
      </div>
    </div>
  );
}
