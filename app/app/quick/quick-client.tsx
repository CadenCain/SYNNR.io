"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronLeft, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { extractExpirationDate } from "@/lib/ocr-date";
import { StatusBadge, type ComplianceStatus } from "@/components/ui/status-badge";
import { COMPLIANCE_KINDS } from "@/lib/saas/taxonomy";
import { renewComplianceItem } from "@/app/app/units/[unitId]/actions";
import { quickAddCert } from "./actions";

/**
 * The 2-tap field workflow. Built for gloved hands in sunlight:
 * huge tap targets, camera-first, one decision per screen, big green done.
 *
 * Renew: tap the item → shoot the new cert → confirm date → done.
 * Add:   pick the truck → name it → shoot it → done.
 */

export interface QuickItem {
  id: string;
  title: string;
  status: ComplianceStatus;
  expiration_date: string | null;
  parentLabel: string;
}
export interface QuickUnit {
  id: string;
  name: string;
  yardName: string;
}

function plusOneYear(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

const FIELD = "h-14 rounded-xl border border-line-2 bg-coal px-4 text-base text-ink outline-none focus:border-bone";

async function uploadProof(companyId: string, entityId: string, file: File): Promise<{ path: string; type: string | null } | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${companyId}/compliance_item/${entityId}/${Date.now()}-${safe}`;
  const { error } = await sb.storage.from("proofs").upload(path, file, { upsert: false });
  return error ? null : { path, type: file.type || null };
}

export default function QuickClient({ items, units, companyId }: { items: QuickItem[]; units: QuickUnit[]; companyId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"home" | "renew" | "add" | "done">("home");
  const [picked, setPicked] = useState<QuickItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [doneMsg, setDoneMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const [expiration, setExpiration] = useState(plusOneYear());
  const [ocr, setOcr] = useState<"idle" | "reading" | "unconfirmed" | "confirmed" | "none">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickPhoto(file: File | undefined) {
    setFileName(file?.name ?? "");
    if (!file) return;
    setOcr("reading");
    const read = await extractExpirationDate(file);
    if (read) { setExpiration(read); setOcr("unconfirmed"); }
    else setOcr("none");
  }

  function reset(toHome = true) {
    setPicked(null);
    setErr("");
    setFileName("");
    setOcr("idle");
    setExpiration(plusOneYear());
    if (fileRef.current) fileRef.current.value = "";
    if (toHome) setMode("home");
  }

  async function saveRenew(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked) return;
    if (ocr === "unconfirmed" || ocr === "reading") return;
    setErr("");
    setBusy(true);
    let storage_path: string | null = null;
    let content_type: string | null = null;
    const file = fileRef.current?.files?.[0];
    if (file) {
      const up = await uploadProof(companyId, picked.id, file);
      if (up) { storage_path = up.path; content_type = up.type; }
      else setErr("Photo didn't upload — saved the date anyway.");
    }
    try {
      await renewComplianceItem({ itemId: picked.id, expiration_date: expiration, storage_path, content_type, redirectPath: "/app/quick" });
      setDoneMsg(`${picked.title} renewed ✓`);
      setMode("done");
      router.refresh();
    } catch {
      setErr("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const unit_id = String(fd.get("unit_id") ?? "");
    const title = String(fd.get("title") ?? "").trim();
    const kind = String(fd.get("kind") ?? "cert");
    const expiration_date = String(fd.get("expiration_date") ?? "") || null;

    let storage_path: string | null = null;
    let content_type: string | null = null;
    const file = fileRef.current?.files?.[0];
    if (file && unit_id) {
      const up = await uploadProof(companyId, unit_id, file);
      if (up) { storage_path = up.path; content_type = up.type; }
    }
    const res = await quickAddCert({ unit_id, title, kind, expiration_date, storage_path, content_type });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "Couldn't save."); return; }
    setDoneMsg(`${title} added ✓`);
    setMode("done");
    router.refresh();
  }

  /* ── DONE ── */
  if (mode === "done") {
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40">
          <Check className="h-10 w-10 text-emerald-400" />
        </span>
        <p className="text-xl font-semibold">{doneMsg}</p>
        <div className="flex w-full max-w-sm flex-col gap-2">
          <button onClick={() => reset()} className="h-14 rounded-xl bg-bone text-base font-semibold text-coal">Do another</button>
          <button onClick={() => router.push("/app")} className="h-14 rounded-xl border border-line-2 text-base text-ink">Back to dashboard</button>
        </div>
      </div>
    );
  }

  /* ── RENEW: pick item, then camera+date ── */
  if (mode === "renew") {
    if (!picked) {
      return (
        <div className="flex flex-col gap-3">
          <BackBar onBack={() => reset()} label="What are you renewing?" />
          {items.length === 0 ? (
            <p className="rounded-xl border border-line bg-surface p-6 text-center text-ink-dim">Nothing tracked yet — add a cert first.</p>
          ) : (
            items.map((it) => (
              <button key={it.id} onClick={() => setPicked(it)}
                className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left active:bg-elevated">
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">{it.title}</span>
                  <span className="block truncate text-sm text-ink-dim">{it.parentLabel}{it.expiration_date ? ` · ${it.expiration_date}` : ""}</span>
                </span>
                <StatusBadge status={it.status} />
              </button>
            ))
          )}
        </div>
      );
    }
    return (
      <form onSubmit={saveRenew} className="flex flex-col gap-4">
        <BackBar onBack={() => setPicked(null)} label={picked.title} sub={picked.parentLabel} />
        <CameraField fileRef={fileRef} fileName={fileName} setFileName={setFileName} label="Shoot the new cert" onFile={onPickPhoto} />
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          New expiration date
          <input name="expiration_date" type="date" required value={expiration}
            onChange={(e) => { setExpiration(e.target.value); if (ocr === "unconfirmed") setOcr("confirmed"); }}
            className={cn(FIELD, ocr === "unconfirmed" && "border-amber-500/60 ring-1 ring-amber-500/30")} />
        </label>
        {ocr === "reading" ? (
          <p className="text-sm text-ink-dim">Reading the photo…</p>
        ) : ocr === "unconfirmed" ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
            <span className="text-sm text-amber-400">Read from the photo — confirm it&apos;s right.</span>
            <button type="button" onClick={() => setOcr("confirmed")}
              className="shrink-0 rounded-lg border border-amber-500/50 px-3 py-1.5 text-sm font-semibold text-amber-300">
              Looks right
            </button>
          </div>
        ) : ocr === "confirmed" ? (
          <p className="text-sm text-emerald-400">✓ Date confirmed by you.</p>
        ) : ocr === "none" && fileName ? (
          <p className="text-sm text-ink-faint">Couldn&apos;t read a date off the photo — set it yourself.</p>
        ) : null}
        {err ? <p className="text-sm text-amber-400">{err}</p> : null}
        <button type="submit" disabled={busy || ocr === "reading" || ocr === "unconfirmed"}
          className="h-14 rounded-xl bg-bone text-base font-semibold text-coal disabled:opacity-50">
          {busy ? "Saving…" : ocr === "unconfirmed" ? "Confirm the date first" : "Save — it's renewed"}
        </button>
      </form>
    );
  }

  /* ── ADD ── */
  if (mode === "add") {
    return (
      <form onSubmit={saveAdd} className="flex flex-col gap-4">
        <BackBar onBack={() => reset()} label="Add a cert or inspection" />
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          Which truck / rig / shop?
          <select name="unit_id" required className={FIELD} defaultValue="">
            <option value="" disabled>Pick one…</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.yardName}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          What is it?
          <input name="title" required placeholder="e.g. BOP test, DOT sticker" className={FIELD} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
            Kind
            <select name="kind" defaultValue="cert" className={FIELD}>
              {COMPLIANCE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
            Expires
            <input name="expiration_date" type="date" className={FIELD} />
          </label>
        </div>
        <CameraField fileRef={fileRef} fileName={fileName} setFileName={setFileName} label="Shoot it (optional)" />
        {err ? <p className="text-sm text-amber-400">{err}</p> : null}
        <button type="submit" disabled={busy} className="h-14 rounded-xl bg-bone text-base font-semibold text-coal disabled:opacity-50">
          {busy ? "Saving…" : "Save it"}
        </button>
      </form>
    );
  }

  /* ── HOME: two giant buttons ── */
  const needsWork = items.filter((i) => i.status === "expired" || i.status === "expiring").length;
  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => setMode("renew")}
        className="flex min-h-24 items-center gap-4 rounded-2xl border border-line bg-surface px-5 text-left active:bg-elevated">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bone text-coal"><RefreshCw className="h-6 w-6" /></span>
        <span>
          <span className="block text-lg font-semibold">Renew a cert</span>
          <span className="block text-sm text-ink-dim">{needsWork > 0 ? `${needsWork} need attention` : "Snap the new one, set the date"}</span>
        </span>
      </button>
      <button onClick={() => setMode("add")}
        className="flex min-h-24 items-center gap-4 rounded-2xl border border-line bg-surface px-5 text-left active:bg-elevated">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line-2 bg-elevated text-ink"><Plus className="h-6 w-6" /></span>
        <span>
          <span className="block text-lg font-semibold">Add a cert</span>
          <span className="block text-sm text-ink-dim">New cert, inspection, or DOT item</span>
        </span>
      </button>
    </div>
  );
}

function BackBar({ onBack, label, sub }: { onBack: () => void; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onBack} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line-2 text-ink-dim active:bg-elevated">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0">
        <div className="truncate text-base font-semibold">{label}</div>
        {sub ? <div className="truncate text-sm text-ink-dim">{sub}</div> : null}
      </div>
    </div>
  );
}

function CameraField({ fileRef, fileName, setFileName, label, onFile }: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  fileName: string;
  setFileName: (s: string) => void;
  label: string;
  onFile?: (f: File | undefined) => void;
}) {
  return (
    <div>
      <button type="button" onClick={() => fileRef.current?.click()}
        className={cn(
          "flex h-20 w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed text-base",
          fileName ? "border-emerald-500/50 text-emerald-400" : "border-line-2 text-ink-dim active:bg-elevated",
        )}>
        {fileName ? <><Check className="h-5 w-5" /> Photo ready</> : <><Camera className="h-6 w-6" /> {label}</>}
      </button>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (onFile) void onFile(f); else setFileName(f?.name ?? ""); }} />
    </div>
  );
}
