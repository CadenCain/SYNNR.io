"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, TriangleAlert, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge, type ComplianceStatus } from "@/components/ui/status-badge";
import { submitCheckout, submitCheckin, type CheckItemInput } from "./actions";

/**
 * The pre-dispatch loadout check. One-thumb, 5am-proof:
 * exception-based toggles (everything defaults OK — flip what's wrong),
 * certs/crew certs are FACTS pulled from real status (not toggleable),
 * and a live Ready / Not-ready banner that names every failing item.
 */

export interface ToggleRow {
  key: string;
  source_type: "loadout_item" | "asset";
  source_id: string | null;
  label: string;
  sub?: string;
  required: boolean;
  initialMissing?: boolean;
}
export interface FactRow {
  key: string;
  source_type: "cert" | "crew_cert";
  source_id: string;
  label: string;
  sub?: string;
  status: ComplianceStatus;
}
export interface CrewOption {
  id: string;
  name: string;
  role: string | null;
  certs: { id: string; title: string; status: ComplianceStatus; expiration_date: string | null }[];
}

const SECTION = "text-xs font-semibold uppercase tracking-wider text-ink-faint";

function Toggle({ missing, onFlip }: { missing: boolean; onFlip: () => void }) {
  return (
    <button type="button" onClick={onFlip}
      className={cn(
        "flex h-11 w-28 shrink-0 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold transition-colors",
        missing
          ? "border-red-500/40 bg-red-500/10 text-red-400"
          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
      )}>
      {missing ? <><X className="h-4 w-4" /> Missing</> : <><Check className="h-4 w-4" /> OK</>}
    </button>
  );
}

export default function DispatchClient(props: {
  mode: "checkout" | "checkin";
  unitId: string;
  unitName: string;
  checkoutId?: string;
  toggles: ToggleRow[];
  facts: FactRow[];
  crew: CrewOption[];
}) {
  const router = useRouter();
  const [missing, setMissing] = useState<Set<string>>(
    () => new Set(props.toggles.filter((t) => t.initialMissing).map((t) => t.key)),
  );
  const [crewIds, setCrewIds] = useState<Set<string>>(new Set());
  const [jobRef, setJobRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const selectedCrew = props.crew.filter((c) => crewIds.has(c.id));

  // Every failing line, by name — the banner is the product.
  const failures = useMemo(() => {
    const out: string[] = [];
    for (const t of props.toggles) {
      if (t.required && missing.has(t.key)) out.push(`${t.label} — missing`);
    }
    for (const f of props.facts) {
      if (f.status === "expired") out.push(`${f.label} — expired`);
    }
    for (const c of selectedCrew) {
      for (const cert of c.certs) {
        if (cert.status === "expired") out.push(`${cert.title} — ${c.name}, expired`);
      }
    }
    return out;
  }, [props.toggles, props.facts, selectedCrew, missing]);

  const warnings = useMemo(() => {
    const out: string[] = [];
    for (const f of props.facts) if (f.status === "expiring") out.push(`${f.label} — expiring soon`);
    for (const c of selectedCrew)
      for (const cert of c.certs)
        if (cert.status === "expiring") out.push(`${cert.title} — ${c.name}, expires soon`);
    return out;
  }, [props.facts, selectedCrew]);

  const ready = failures.length === 0;

  function buildItems(): CheckItemInput[] {
    const items: CheckItemInput[] = props.toggles.map((t) => ({
      source_type: t.source_type,
      source_id: t.source_id,
      label: t.label,
      result: missing.has(t.key) ? "missing" : "ok",
    }));
    if (props.mode === "checkout") {
      for (const f of props.facts) {
        items.push({ source_type: f.source_type, source_id: f.source_id, label: f.label, result: f.status === "expired" ? "expired" : "ok" });
      }
      for (const c of selectedCrew) {
        for (const cert of c.certs) {
          items.push({ source_type: "crew_cert", source_id: cert.id, label: `${cert.title} (${c.name})`, result: cert.status === "expired" ? "expired" : "ok" });
        }
      }
    }
    return items;
  }

  async function submit() {
    setErr("");
    if (props.mode === "checkout" && !ready) {
      const confirmed = window.confirm(
        `This truck is NOT ready:\n\n• ${failures.join("\n• ")}\n\nRoll out anyway? This is logged as an override with your name.`,
      );
      if (!confirmed) return;
    }
    setBusy(true);
    const res =
      props.mode === "checkout"
        ? await submitCheckout({ unitId: props.unitId, jobRef: jobRef.trim() || null, notes: null, crewIds: [...crewIds], items: buildItems(), ready })
        : await submitCheckin({ unitId: props.unitId, checkoutId: props.checkoutId!, notes: null, items: buildItems() });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "Couldn't save."); return; }
    setDone(true);
    router.refresh();
  }

  if (done) {
    const missCount = [...missing].length;
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <span className={cn("flex h-20 w-20 items-center justify-center rounded-full ring-1",
          props.mode === "checkout"
            ? ready ? "bg-emerald-500/15 ring-emerald-500/40" : "bg-amber-500/15 ring-amber-500/40"
            : missCount === 0 ? "bg-emerald-500/15 ring-emerald-500/40" : "bg-amber-500/15 ring-amber-500/40")}>
          {props.mode === "checkout"
            ? <Truck className={cn("h-10 w-10", ready ? "text-emerald-400" : "text-amber-400")} />
            : <Check className={cn("h-10 w-10", missCount === 0 ? "text-emerald-400" : "text-amber-400")} />}
        </span>
        <div>
          <p className="text-xl font-semibold">
            {props.mode === "checkout"
              ? ready ? `${props.unitName} rolled out ready ✓` : `${props.unitName} rolled out — override logged`
              : missCount === 0 ? `${props.unitName} checked in — all accounted for ✓` : `${props.unitName} checked in — ${missCount} not returned`}
          </p>
          {props.mode === "checkin" && missCount > 0 ? (
            <p className="mt-1 text-sm text-amber-400">Missing gear flagged — it&apos;s on the dashboard until it&apos;s found.</p>
          ) : null}
        </div>
        <button onClick={() => router.push("/app")} className="h-14 w-full max-w-sm rounded-xl bg-bone text-base font-semibold text-coal">
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-28">
      {/* Live Ready banner */}
      <div className={cn("rounded-2xl border p-4",
        ready ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10")}>
        <div className={cn("flex items-center gap-2 text-lg font-semibold", ready ? "text-emerald-400" : "text-red-400")}>
          {ready ? <Check className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
          {props.mode === "checkin" ? (ready ? "All accounted for" : "Items not returned") : ready ? "Ready to roll" : "Not ready"}
        </div>
        {failures.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-red-300">
            {failures.map((f) => <li key={f}>• {f}</li>)}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className={cn("flex flex-col gap-1 text-sm text-amber-400", failures.length > 0 ? "mt-2" : "mt-2")}>
            {warnings.map((w) => <li key={w}>• {w}</li>)}
          </ul>
        )}
      </div>

      {/* Toggle sections */}
      {["loadout_item", "asset"].map((st) => {
        const rows = props.toggles.filter((t) => t.source_type === st);
        if (!rows.length) return null;
        return (
          <section key={st} className="flex flex-col gap-2">
            <h2 className={SECTION}>{st === "loadout_item" ? (props.mode === "checkin" ? "Loadout — did it come back?" : "Loadout") : props.mode === "checkin" ? "Assets — did they come back?" : "Assets on this unit"}</h2>
            {rows.map((t) => (
              <div key={t.key} className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{t.label}{!t.required && <span className="ml-2 text-xs text-ink-faint">optional</span>}</div>
                  {t.sub ? <div className="truncate text-sm text-ink-dim">{t.sub}</div> : null}
                </div>
                <Toggle missing={missing.has(t.key)} onFlip={() => {
                  setMissing((prev) => { const n = new Set(prev); if (n.has(t.key)) n.delete(t.key); else n.add(t.key); return n; });
                }} />
              </div>
            ))}
          </section>
        );
      })}

      {/* Cert facts (not toggleable — they're computed) */}
      {props.facts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={SECTION}>Paper — certs, inspections &amp; DOT</h2>
          {props.facts.map((f) => (
            <div key={f.key} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{f.label}</div>
                {f.sub ? <div className="truncate text-sm text-ink-dim">{f.sub}</div> : null}
              </div>
              <StatusBadge status={f.status} />
            </div>
          ))}
        </section>
      )}

      {/* Crew picker (checkout only) */}
      {props.mode === "checkout" && props.crew.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={SECTION}>Who&apos;s on the truck?</h2>
          {props.crew.map((c) => {
            const on = crewIds.has(c.id);
            const worst: ComplianceStatus = c.certs.some((x) => x.status === "expired") ? "expired"
              : c.certs.some((x) => x.status === "expiring") ? "expiring" : "valid";
            return (
              <button key={c.id} type="button"
                onClick={() => setCrewIds((prev) => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                className={cn("flex min-h-16 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left",
                  on ? "border-bone/60 bg-elevated" : "border-line bg-surface")}>
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.name}</div>
                  <div className="truncate text-sm text-ink-dim">{c.role ?? "crew"} · {c.certs.length} cert{c.certs.length === 1 ? "" : "s"}</div>
                </div>
                <div className="flex items-center gap-2">
                  {c.certs.length > 0 ? <StatusBadge status={worst} /> : null}
                  <span className={cn("flex h-7 w-7 items-center justify-center rounded-full border",
                    on ? "border-bone bg-bone text-coal" : "border-line-2 text-transparent")}>
                    <Check className="h-4 w-4" />
                  </span>
                </div>
              </button>
            );
          })}
        </section>
      )}

      {props.mode === "checkout" && (
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          Job ref (optional)
          <input value={jobRef} onChange={(e) => setJobRef(e.target.value)} placeholder="e.g. Pad 12 — Well 3H"
            className="h-14 rounded-xl border border-line-2 bg-coal px-4 text-base text-ink outline-none focus:border-bone" />
        </label>
      )}

      {err ? <p className="text-sm text-red-400">{err}</p> : null}

      <button onClick={submit} disabled={busy}
        className={cn("h-14 rounded-xl text-base font-semibold disabled:opacity-50",
          props.mode === "checkin" ? "bg-bone text-coal"
            : ready ? "bg-bone text-coal" : "border border-red-500/50 bg-red-500/10 text-red-300")}>
        {busy ? "Saving…"
          : props.mode === "checkin" ? "Complete check-in"
          : ready ? "Mark rolled out" : "Roll out anyway (logged)"}
      </button>
    </div>
  );
}
