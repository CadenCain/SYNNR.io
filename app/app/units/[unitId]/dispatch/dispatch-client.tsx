"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, TriangleAlert, Truck, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { StatusBadge, type ComplianceStatus } from "@/components/ui/status-badge";
import { worstStatus } from "@/lib/saas/status";
import { submitCheckout, submitCheckin, type CheckItemInput } from "./actions";

/**
 * The pre-dispatch loadout check — now with teeth (walkthrough C2/C3/C4):
 *  - CHECK-OUT lines start UNCONFIRMED. Someone has to actively tap OK or
 *    Missing on every required line — no self-certification theater.
 *  - Paper & crew cards are computed facts: expired OR no-date-on-file both
 *    fail, by name.
 *  - Not ready → rollout only through the logged override (who/when/why).
 *  - Enforcement (org-configurable): photo proof on flagged lines, and a
 *    second-person co-sign (name + PIN) before anything rolls.
 *  - Check-in stays exception-based: everything that went out defaults to
 *    "returned"; flip what didn't come back.
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
export interface EnforcementConfig {
  requirePhotoOnFlagged: boolean;
  requireCosign: boolean;
}

type LineResult = "ok" | "missing" | undefined; // undefined = unconfirmed

const SECTION = "text-xs font-semibold uppercase tracking-wider text-ink-faint";

function TriToggle({ value, onSet, confirmOnly }: { value: LineResult; onSet: (v: "ok" | "missing") => void; confirmOnly?: boolean }) {
  return (
    <div className="flex shrink-0 gap-1.5">
      <button type="button" onClick={() => onSet("ok")}
        className={cn(
          "flex h-11 w-16 items-center justify-center gap-1 rounded-xl border text-sm font-semibold transition-colors",
          value === "ok" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400" : "border-line-2 text-ink-faint hover:text-ink",
        )}>
        <Check className="h-4 w-4" /> OK
      </button>
      {!confirmOnly && (
        <button type="button" onClick={() => onSet("missing")}
          className={cn(
            "flex h-11 w-24 items-center justify-center gap-1 rounded-xl border text-sm font-semibold transition-colors",
            value === "missing" ? "border-red-500/50 bg-red-500/15 text-red-400" : "border-line-2 text-ink-faint hover:text-ink",
          )}>
          <X className="h-4 w-4" /> Missing
        </button>
      )}
    </div>
  );
}

export default function DispatchClient(props: {
  mode: "checkout" | "checkin";
  unitId: string;
  unitName: string;
  companyId: string;
  checkoutId?: string;
  toggles: ToggleRow[];
  facts: FactRow[];
  crew: CrewOption[];
  initialCrewIds?: string[];
  enforcement: EnforcementConfig;
}) {
  const router = useRouter();
  const isCheckout = props.mode === "checkout";
  const [results, setResults] = useState<Record<string, LineResult>>(() => {
    const init: Record<string, LineResult> = {};
    for (const t of props.toggles) {
      // check-out: unconfirmed until someone taps; check-in: default returned
      init[t.key] = t.initialMissing ? "missing" : isCheckout ? undefined : "ok";
    }
    return init;
  });
  const [photos, setPhotos] = useState<Record<string, { path: string; name: string }>>({});
  const [photoBusyKey, setPhotoBusyKey] = useState<string | null>(null);
  const [crewIds, setCrewIds] = useState<Set<string>>(() => new Set(props.initialCrewIds ?? []));
  const [jobRef, setJobRef] = useState("");
  const [cosignName, setCosignName] = useState("");
  const [cosignPin, setCosignPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [askOverride, setAskOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const photoForKey = useRef<string | null>(null);

  const selectedCrew = props.crew.filter((c) => crewIds.has(c.id));

  // Every failing line, by name — the banner is the product.
  const failures = useMemo(() => {
    const out: string[] = [];
    for (const t of props.toggles) {
      if (!t.required) continue;
      const r = results[t.key];
      if (r === "missing") out.push(`${t.label} — missing`);
      else if (r === undefined) out.push(`${t.label} — not checked`);
    }
    if (isCheckout) {
      for (const f of props.facts) {
        if (f.status === "expired") out.push(`${f.label} — expired`);
        else if (f.status === "none") out.push(`${f.label} — no expiration on file`);
      }
      for (const c of selectedCrew) {
        for (const cert of c.certs) {
          if (cert.status === "expired") out.push(`${cert.title} — ${c.name}, expired`);
          else if (cert.status === "none") out.push(`${cert.title} — ${c.name}, no date on file`);
        }
      }
    }
    return out;
  }, [props.toggles, props.facts, selectedCrew, results, isCheckout]);

  const warnings = useMemo(() => {
    if (!isCheckout) return [];
    const out: string[] = [];
    for (const f of props.facts) if (f.status === "expiring") out.push(`${f.label} — expiring soon`);
    for (const c of selectedCrew)
      for (const cert of c.certs)
        if (cert.status === "expiring") out.push(`${cert.title} — ${c.name}, expires soon`);
    return out;
  }, [props.facts, selectedCrew, isCheckout]);

  const ready = failures.length === 0;
  const flaggedWithoutPhoto = props.enforcement.requirePhotoOnFlagged
    ? props.toggles.filter((t) => results[t.key] === "missing" && !photos[t.key])
    : [];
  const cosignMissing = isCheckout && props.enforcement.requireCosign && (!cosignName.trim() || !cosignPin.trim());
  const blocked = flaggedWithoutPhoto.length > 0 || cosignMissing;

  async function capturePhoto(key: string, file: File) {
    setPhotoBusyKey(key);
    const sb = getBrowserSupabase();
    if (sb) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${props.companyId}/dispatch/${props.unitId}/${Date.now()}-${safe}`;
      const { error } = await sb.storage.from("proofs").upload(path, file, { upsert: false });
      if (!error) setPhotos((p) => ({ ...p, [key]: { path, name: file.name } }));
      else setErr("Photo upload failed — try again.");
    }
    setPhotoBusyKey(null);
  }

  function buildItems(): CheckItemInput[] {
    const items: CheckItemInput[] = props.toggles.map((t) => ({
      source_type: t.source_type,
      source_id: t.source_id,
      label: t.label,
      result: results[t.key] ?? "unconfirmed",
      photo_path: photos[t.key]?.path ?? null,
    }));
    if (isCheckout) {
      for (const f of props.facts) {
        items.push({ source_type: f.source_type, source_id: f.source_id, label: f.label, result: f.status === "expired" ? "expired" : f.status === "none" ? "missing" : "ok" });
      }
      for (const c of selectedCrew) {
        for (const cert of c.certs) {
          items.push({ source_type: "crew_cert", source_id: cert.id, label: `${cert.title} (${c.name})`, result: cert.status === "expired" ? "expired" : cert.status === "none" ? "missing" : "ok" });
        }
      }
    }
    return items;
  }

  async function submit() {
    setErr("");
    if (blocked) return;
    if (isCheckout && !ready && !askOverride) {
      setAskOverride(true);
      return;
    }
    setBusy(true);
    const res = isCheckout
      ? await submitCheckout({
          unitId: props.unitId, jobRef: jobRef.trim() || null, notes: null,
          crewIds: [...crewIds], items: buildItems(), ready,
          overrideReason: ready ? null : overrideReason.trim() || null,
          failures,
          cosignerName: props.enforcement.requireCosign ? cosignName.trim() : null,
          cosignerPin: props.enforcement.requireCosign ? cosignPin.trim() : null,
        })
      : await submitCheckin({ unitId: props.unitId, checkoutId: props.checkoutId!, notes: null, items: buildItems() });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "Couldn't save."); return; }
    setDone(true);
    router.refresh();
  }

  /* ── DONE ── */
  if (done) {
    const missCount = Object.values(results).filter((r) => r === "missing").length;
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <span className={cn("flex h-20 w-20 items-center justify-center rounded-full ring-1",
          isCheckout
            ? ready ? "bg-emerald-500/15 ring-emerald-500/40" : "bg-amber-500/15 ring-amber-500/40"
            : missCount === 0 ? "bg-emerald-500/15 ring-emerald-500/40" : "bg-amber-500/15 ring-amber-500/40")}>
          {isCheckout
            ? <Truck className={cn("h-10 w-10", ready ? "text-emerald-400" : "text-amber-400")} />
            : <Check className={cn("h-10 w-10", missCount === 0 ? "text-emerald-400" : "text-amber-400")} />}
        </span>
        <div>
          <p className="text-xl font-semibold">
            {isCheckout
              ? ready ? `${props.unitName} rolled out ready ✓` : `${props.unitName} rolled out — override logged`
              : missCount === 0 ? `${props.unitName} checked in — all accounted for ✓` : `${props.unitName} checked in — ${missCount} not returned`}
          </p>
          {!isCheckout && missCount > 0 ? (
            <p className="mt-1 text-sm text-amber-400">Missing gear flagged — it&apos;s on the dashboard until it&apos;s found.</p>
          ) : null}
        </div>
        <button onClick={() => router.push("/app")} className="h-14 w-full max-w-sm rounded-xl bg-bone text-base font-semibold text-coal">
          Back to dashboard
        </button>
      </div>
    );
  }

  const confirmedCount = props.toggles.filter((t) => results[t.key] !== undefined).length;

  return (
    <div className="flex flex-col gap-6 pb-28">
      {/* hidden shared camera input for per-line photo proof */}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          const key = photoForKey.current;
          if (f && key) void capturePhoto(key, f);
          e.target.value = "";
        }} />

      {/* Live banner */}
      <div className={cn("rounded-2xl border p-4",
        ready ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10")}>
        <div className={cn("flex items-center gap-2 text-lg font-semibold", ready ? "text-emerald-400" : "text-red-400")}>
          {ready ? <Check className="h-5 w-5" /> : <TriangleAlert className="h-5 w-5" />}
          {!isCheckout ? (ready ? "All accounted for" : "Items not returned") : ready ? "Ready to roll" : "NOT READY"}
        </div>
        {isCheckout && (
          <p className="mt-0.5 text-xs text-ink-dim">{confirmedCount}/{props.toggles.length} lines checked</p>
        )}
        {failures.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-red-300">
            {failures.map((f) => <li key={f}>• {f}</li>)}
          </ul>
        )}
        {warnings.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-400">
            {warnings.map((w) => <li key={w}>• {w}</li>)}
          </ul>
        )}
      </div>

      {/* Toggle sections — every required line demands a tap */}
      {["loadout_item", "asset"].map((st) => {
        const rows = props.toggles.filter((t) => t.source_type === st);
        if (!rows.length) return null;
        return (
          <section key={st} className="flex flex-col gap-2">
            <h2 className={SECTION}>{st === "loadout_item" ? (!isCheckout ? "Loadout — did it come back?" : "Loadout — check each line") : !isCheckout ? "Assets — did they come back?" : "Assets on this unit — check each line"}</h2>
            {rows.map((t) => (
              <div key={t.key} className={cn("flex flex-col gap-2 rounded-xl border bg-surface px-4 py-3",
                isCheckout && t.required && results[t.key] === undefined ? "border-line-2 border-dashed" : "border-line")}>
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{t.label}{!t.required && <span className="ml-2 text-xs text-ink-faint">optional</span>}</div>
                    {t.sub ? <div className="truncate text-sm text-ink-dim">{t.sub}</div> : null}
                  </div>
                  <TriToggle value={results[t.key]} onSet={(v) => setResults((p) => ({ ...p, [t.key]: p[t.key] === v ? undefined : v }))} />
                </div>
                {results[t.key] === "missing" && (
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={photoBusyKey === t.key}
                      onClick={() => { photoForKey.current = t.key; fileRef.current?.click(); }}
                      className={cn("flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium",
                        photos[t.key] ? "border-emerald-500/40 text-emerald-400" : "border-line-2 text-ink-dim hover:text-ink")}>
                      <Camera className="h-3.5 w-3.5" />
                      {photoBusyKey === t.key ? "Uploading…" : photos[t.key] ? "Photo attached ✓" : props.enforcement.requirePhotoOnFlagged ? "Add photo (required)" : "Add photo"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        );
      })}

      {/* Cert facts (computed — they don't lie) */}
      {isCheckout && props.facts.length > 0 && (
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
      {isCheckout && props.crew.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={SECTION}>Who&apos;s on the truck?</h2>
          {props.crew.map((c) => {
            const on = crewIds.has(c.id);
            const worst = worstStatus(c.certs.map((x) => x.status));
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
                  {worst ? <StatusBadge status={worst} /> : null}
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

      {isCheckout && (
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          Job ref (optional)
          <input value={jobRef} onChange={(e) => setJobRef(e.target.value)} placeholder="e.g. Pad 12 — Well 3H"
            className="h-14 rounded-xl border border-line-2 bg-coal px-4 text-base text-ink outline-none focus:border-bone" />
        </label>
      )}

      {/* Second-person co-sign (org setting) */}
      {isCheckout && props.enforcement.requireCosign && (
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
          <h2 className={SECTION}>Second-person sign-off</h2>
          <p className="text-sm text-ink-dim">A second hand confirms this check. Name + company PIN.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={cosignName} onChange={(e) => setCosignName(e.target.value)} placeholder="Co-signer name"
              className="h-12 flex-1 rounded-xl border border-line-2 bg-coal px-4 text-base text-ink outline-none focus:border-bone" />
            <input value={cosignPin} onChange={(e) => setCosignPin(e.target.value)} placeholder="PIN" type="password" inputMode="numeric"
              className="h-12 w-32 rounded-xl border border-line-2 bg-coal px-4 text-base text-ink outline-none focus:border-bone" />
          </div>
        </section>
      )}

      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      {flaggedWithoutPhoto.length > 0 && (
        <p className="text-sm text-amber-400">Photo required on each flagged item: {flaggedWithoutPhoto.map((t) => t.label).join(", ")}</p>
      )}
      {cosignMissing && <p className="text-sm text-amber-400">Second-person sign-off required before rollout.</p>}

      {askOverride && !ready && isCheckout ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-red-500/50 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-300">
            This truck is NOT ready. Rolling out anyway is recorded with your name, the time, and every failing item.
          </p>
          <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
            Why is it rolling anyway?
            <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. operator waived DOT — paperwork en route"
              className="h-12 rounded-xl border border-red-500/40 bg-coal px-4 text-base text-ink outline-none focus:border-red-400" />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button onClick={submit} disabled={busy || blocked}
              className="h-14 flex-1 rounded-xl bg-red-500/80 text-base font-semibold text-white disabled:opacity-50">
              {busy ? "Saving…" : "Confirm — roll out NOT ready"}
            </button>
            <button onClick={() => setAskOverride(false)} disabled={busy}
              className="h-14 rounded-xl border border-line-2 px-6 text-base text-ink">
              Go back &amp; fix it
            </button>
          </div>
        </div>
      ) : (
        <button onClick={submit} disabled={busy || blocked}
          className={cn("h-14 rounded-xl text-base font-semibold disabled:opacity-50",
            !isCheckout ? "bg-bone text-coal"
              : ready ? "bg-bone text-coal" : "border border-red-500/50 bg-red-500/10 text-red-300")}>
          {busy ? "Saving…"
            : !isCheckout ? "Complete check-in"
            : ready ? "Mark rolled out" : "Roll out anyway (logged)"}
        </button>
      )}
    </div>
  );
}
