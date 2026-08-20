"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Camera, Check, ChevronLeft, MapPin, Plus, RefreshCw, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { extractExpirationDate } from "@/lib/ocr-date";
import { StatusBadge, type ComplianceStatus } from "@/components/ui/status-badge";
import { ASSET_CATEGORIES, COMPLIANCE_KINDS, UNIT_TYPES } from "@/lib/saas/taxonomy";
import { updateAssetLastSeen } from "../_actions";
import { fmtDate } from "@/lib/saas/format";
import { renewComplianceItem } from "@/app/app/units/[unitId]/actions";
import { quickAddCert, quickAddUnit, quickAddAsset } from "./actions";

/**
 * The 2-tap field workflow. Built for gloved hands in sunlight:
 * huge tap targets, camera-first, one decision per screen, big green done.
 *
 * Renew: tap the item → shoot the new cert → confirm date → done.
 * Add:   pick the truck → name it → shoot it → done.
 *
 * Everything a shop needs to PUT ON THE BOOKS lives here too — trucks and
 * gear, not just paper. Before this, a new customer standing in his own yard
 * could open the app and do nothing at all: adding a cert needed a truck, and
 * adding a truck needed a desktop. Nobody buys software they can't start.
 */

export interface QuickItem {
  id: string;
  title: string;
  status: ComplianceStatus;
  expiration_date: string | null;
  parentLabel: string;
}
export interface QuickAsset {
  id: string;
  name: string;
  lastSeen: string | null;
  unitName: string;
}
export interface QuickUnit {
  id: string;
  name: string;
  yardName: string;
  type: string;
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

export default function QuickClient({ items, units, assets, companyId }: { items: QuickItem[]; units: QuickUnit[]; assets: QuickAsset[]; companyId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"home" | "renew" | "add" | "seen" | "unit" | "gear" | "done">("home");
  /** Kept locally so a truck added a second ago is selectable immediately,
   *  without waiting on a server round-trip to re-render the page. */
  const [unitList, setUnitList] = useState<QuickUnit[]>(units);
  const [addForUnit, setAddForUnit] = useState<QuickUnit | null>(null);
  const [justMade, setJustMade] = useState<QuickUnit | null>(null);
  const [pickedAsset, setPickedAsset] = useState<QuickAsset | null>(null);
  const [whereText, setWhereText] = useState("");
  const [picked, setPicked] = useState<QuickItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [doneMsg, setDoneMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const [expiration, setExpiration] = useState(plusOneYear());
  const [ocr, setOcr] = useState<"idle" | "reading" | "unconfirmed" | "confirmed" | "none">("idle");
  const fileRef = useRef<HTMLInputElement>(null);
  // Gear intake carries TWO shots — the iron and its paperwork — each with
  // its own camera field. Optional in a hurry; the asset flags amber without them.
  const gearPhotoRef = useRef<HTMLInputElement>(null);
  const gearPaperRef = useRef<HTMLInputElement>(null);
  const [gearPhotoName, setGearPhotoName] = useState("");
  const [gearPaperName, setGearPaperName] = useState("");

  async function onPickPhoto(file: File | undefined) {
    setFileName(file?.name ?? "");
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setErr("That photo is over 15 MB — take a normal-quality shot and try again.");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setErr("");
    setOcr("reading");
    const read = await extractExpirationDate(file);
    if (read) { setExpiration(read); setOcr("unconfirmed"); }
    else setOcr("none");
  }

  function reset(toHome = true) {
    setPicked(null);
    setPickedAsset(null);
    setAddForUnit(null);
    setJustMade(null);
    setWhereText("");
    setErr("");
    setFileName("");
    setGearPhotoName("");
    setGearPaperName("");
    setOcr("idle");
    setExpiration(plusOneYear());
    if (fileRef.current) fileRef.current.value = "";
    if (gearPhotoRef.current) gearPhotoRef.current.value = "";
    if (gearPaperRef.current) gearPaperRef.current.value = "";
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

  async function saveUnit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const res = await quickAddUnit({ name: String(fd.get("name") ?? ""), type: String(fd.get("type") ?? "truck") });
    setBusy(false);
    if (!res.ok || !res.unit) { setErr(res.error ?? "Couldn't save."); return; }
    setUnitList((prev) => [...prev, res.unit!].sort((a, b) => a.name.localeCompare(b.name)));
    setJustMade(res.unit);
    setDoneMsg(`${res.unit.name} is on the books ✓`);
    setMode("done");
    router.refresh();
  }

  async function saveGear(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const upIntake = async (f: File | undefined, label: string): Promise<string | null> => {
      if (!f) return null;
      const sb = getBrowserSupabase();
      if (!sb) return null;
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${companyId}/asset/intake/${Date.now()}-${label}-${safe}`;
      const { error } = await sb.storage.from("proofs").upload(path, f, { upsert: false });
      return error ? null : path;
    };
    const photo_path = await upIntake(gearPhotoRef.current?.files?.[0], "photo");
    const paper_path = await upIntake(gearPaperRef.current?.files?.[0], "paperwork");
    const res = await quickAddAsset({
      unit_id: String(fd.get("unit_id") ?? ""),
      name,
      category: String(fd.get("category") ?? "other"),
      where: String(fd.get("where") ?? ""),
      photo_path,
      paper_path,
    });
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "Couldn't save."); return; }
    setDoneMsg(`${name} added ✓`);
    setMode("done");
    router.refresh();
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
          {/* A truck with nothing on it is worth nothing — hand them the next
              step instead of dropping them back at the menu. */}
          {justMade ? (
            <>
              <button onClick={() => { const u = justMade; reset(false); setAddForUnit(u); setMode("add"); }}
                className="h-14 rounded-xl bg-bone text-base font-semibold text-coal">Add a cert to {justMade.name}</button>
              {justMade.type !== "shop" && (
                <button onClick={() => { const u = justMade; reset(false); setAddForUnit(u); setMode("gear"); }}
                  className="h-14 rounded-xl border border-line-2 text-base text-ink">Add gear to {justMade.name}</button>
              )}
            </>
          ) : (
            <button onClick={() => reset()} className="h-14 rounded-xl bg-bone text-base font-semibold text-coal">Do another</button>
          )}
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
            <div className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface p-6 text-center">
              <p className="text-ink-dim">Nothing tracked yet — add your first cert and it&apos;ll show up here to renew.</p>
              <button onClick={() => setMode("add")} className="flex min-h-12 items-center gap-2 rounded-lg bg-bone px-5 font-semibold text-coal">
                <Plus className="h-5 w-5" /> Add a cert
              </button>
            </div>
          ) : (
            items.map((it) => (
              <button key={it.id} onClick={() => setPicked(it)}
                className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left active:bg-elevated">
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">{it.title}</span>
                  <span className="block truncate text-sm text-ink-dim">{it.parentLabel}{it.expiration_date ? ` · ${fmtDate(it.expiration_date)}` : ""}</span>
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
    // No trucks yet means this form can't be submitted at all. Send them to
    // the one screen that unblocks it instead of showing a dead dropdown.
    if (unitList.length === 0) {
      return (
        <div className="flex flex-col gap-4">
          <BackBar onBack={() => reset()} label="Add a cert or inspection" />
          <div className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface p-6 text-center">
            <p className="text-ink-dim">Certs hang off a truck, rig, or shop. Put your first one on the books and this takes 20 seconds.</p>
            <button onClick={() => { setErr(""); setMode("unit"); }}
              className="flex min-h-12 items-center gap-2 rounded-lg bg-bone px-5 font-semibold text-coal">
              <Truck className="h-5 w-5" /> Add a truck or rig
            </button>
          </div>
        </div>
      );
    }
    return (
      <form onSubmit={saveAdd} className="flex flex-col gap-4">
        <BackBar onBack={() => reset()} label="Add a cert or inspection" sub={addForUnit?.name} />
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          Which truck / rig / shop?
          <select name="unit_id" required className={FIELD} defaultValue={addForUnit?.id ?? ""}>
            <option value="" disabled>Pick one…</option>
            {unitList.map((u) => <option key={u.id} value={u.id}>{u.name}{u.yardName ? ` — ${u.yardName}` : ""}</option>)}
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

  /* ── ADD A TRUCK / RIG ── */
  if (mode === "unit") {
    return (
      <form onSubmit={saveUnit} className="flex flex-col gap-4">
        <BackBar onBack={() => reset()} label="Add a truck, rig, or shop" />
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          What do you call it?
          <input name="name" required autoFocus placeholder="e.g. Truck 12, Rig 4, Main shop" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          What is it?
          <select name="type" defaultValue="truck" className={FIELD}>
            {UNIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        {err ? <p className="text-sm text-amber-400">{err}</p> : null}
        <button type="submit" disabled={busy} className="h-14 rounded-xl bg-bone text-base font-semibold text-coal disabled:opacity-50">
          {busy ? "Saving…" : "Put it on the books"}
        </button>
        <p className="text-center text-xs text-ink-faint">
          {unitList.length === 0
            ? "First one — we'll start a yard called Main yard. Rename it any time in Yards."
            : "Goes in your first yard. Move it any time in Yards."}
        </p>
      </form>
    );
  }

  /* ── ADD GEAR TO A TRUCK ──
     Shops are excluded as gear targets: nothing "rides on" a building. A
     shop's own equipment lives as certs in its book, not as assets. */
  if (mode === "gear") {
    const gearTargets = unitList.filter((u) => u.type !== "shop");
    if (gearTargets.length === 0) {
      return (
        <div className="flex flex-col gap-4">
          <BackBar onBack={() => reset()} label="Add gear" />
          <div className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface p-6 text-center">
            <p className="text-ink-dim">Gear rides on a truck or rig. Add one first, then hang the gear off it.</p>
            <button onClick={() => { setErr(""); setMode("unit"); }}
              className="flex min-h-12 items-center gap-2 rounded-lg bg-bone px-5 font-semibold text-coal">
              <Truck className="h-5 w-5" /> Add a truck or rig
            </button>
          </div>
        </div>
      );
    }
    return (
      <form onSubmit={saveGear} className="flex flex-col gap-4">
        <BackBar onBack={() => reset()} label="Add gear" sub={addForUnit?.name} />
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          On which truck / rig?
          <select name="unit_id" required className={FIELD} defaultValue={addForUnit && addForUnit.type !== "shop" ? addForUnit.id : ""}>
            <option value="" disabled>Pick one…</option>
            {gearTargets.map((u) => <option key={u.id} value={u.id}>{u.name}{u.yardName ? ` — ${u.yardName}` : ""}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          What is it?
          <input name="name" required placeholder="e.g. BOP #3, PH6 crossover" className={FIELD} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          Kind of gear
          <select name="category" defaultValue="other" className={FIELD}>
            {ASSET_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm text-ink-dim">
          Where is it right now? (optional)
          <input name="where" placeholder="Andrews yard, on 12, shop bench" className={FIELD} />
        </label>
        <CameraField fileRef={gearPhotoRef} fileName={gearPhotoName} setFileName={setGearPhotoName} label="Shoot the iron" />
        <CameraField fileRef={gearPaperRef} fileName={gearPaperName} setFileName={setGearPaperName} label="Shoot its paperwork" />
        <p className="text-center text-xs text-ink-faint">No photos yet? Save anyway — it&apos;ll wear an amber flag until both are on file.</p>
        {err ? <p className="text-sm text-amber-400">{err}</p> : null}
        <button type="submit" disabled={busy} className="h-14 rounded-xl bg-bone text-base font-semibold text-coal disabled:opacity-50">
          {busy ? "Saving…" : "Put it on the books"}
        </button>
      </form>
    );
  }

  /* ── WHERE'S SOMETHING: pick the gear, say where it is ── */
  if (mode === "seen") {
    if (!pickedAsset) {
      return (
        <div className="flex flex-col gap-3">
          <BackBar onBack={() => reset()} label="What are you looking at?" />
          {assets.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-line bg-surface p-6 text-center">
              <p className="text-ink-dim">No gear on the books yet.</p>
              <button onClick={() => { setErr(""); setMode("gear"); }}
                className="flex min-h-12 items-center gap-2 rounded-lg bg-bone px-5 font-semibold text-coal">
                <Plus className="h-5 w-5" /> Add gear
              </button>
            </div>
          ) : (
            assets.map((a) => (
              <button key={a.id} onClick={() => { setPickedAsset(a); setWhereText(""); }}
                className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left active:bg-elevated">
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium">{a.name}</span>
                  <span className="block truncate text-sm text-ink-dim">
                    {a.lastSeen ? `Last seen ${a.lastSeen}` : a.unitName || "not on a truck"}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      );
    }
    return (
      <form
        action={async (fd) => {
          setBusy(true);
          try { await updateAssetLastSeen(fd); setDoneMsg(`${pickedAsset.name} — ${whereText}`); setMode("done"); }
          catch { setErr("Couldn't save that. Try again."); }
          finally { setBusy(false); }
        }}
        className="flex flex-col gap-4"
      >
        <BackBar onBack={() => setPickedAsset(null)} label={pickedAsset.name} sub={pickedAsset.lastSeen ? `Last seen ${pickedAsset.lastSeen}` : "No location on file"} />
        <input type="hidden" name="id" value={pickedAsset.id} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-dim">Where is it?</span>
          <input name="last_seen_where" required autoFocus value={whereText} onChange={(e) => setWhereText(e.target.value)}
            placeholder="Andrews yard, on 12, shop bench" className={FIELD} />
        </label>
        {err ? <p className="text-sm text-amber-400">{err}</p> : null}
        <button type="submit" disabled={busy || !whereText.trim()}
          className="h-14 rounded-xl bg-bone text-base font-semibold text-coal disabled:opacity-50">
          {busy ? "Saving…" : "Save it"}
        </button>
        <p className="text-center text-xs text-ink-faint">
          Just a note for the crew. It doesn&apos;t change any truck&apos;s ready call.
        </p>
      </form>
    );
  }

  /* ── HOME: three giant buttons.
     Phone keeps the full-width glove-sized stack (that's the product);
     tablet/desktop tile the same cards into a row so the whole screen
     fits without scrolling. ── */
  const needsWork = items.filter((i) => i.status === "expired" || i.status === "expiring").length;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
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
      <button onClick={() => setMode("seen")}
        className="flex min-h-24 items-center gap-4 rounded-2xl border border-line bg-surface px-5 text-left active:bg-elevated">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line-2 bg-elevated text-ink"><MapPin className="h-6 w-6" /></span>
        <span>
          <span className="block text-lg font-semibold">Where&apos;s something</span>
          <span className="block text-sm text-ink-dim">Say where a piece of gear is right now</span>
        </span>
      </button>
      </div>

      {/* Setup work. Smaller on purpose — done once per truck, not daily —
          but it lives on the phone because that's where the truck is. */}
      <div className="mt-2 flex flex-col gap-2 border-t border-line pt-4">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-ink-faint">Put something new on the books</span>
        <div className="grid gap-2 sm:grid-cols-2">
        <button onClick={() => setMode("unit")}
          className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface px-4 text-left active:bg-elevated">
          <Truck className="h-5 w-5 shrink-0 text-ink-dim" />
          <span className="text-base font-medium">Add a truck, rig, or shop</span>
        </button>
        <button onClick={() => setMode("gear")}
          className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface px-4 text-left active:bg-elevated">
          <Box className="h-5 w-5 shrink-0 text-ink-dim" />
          <span className="text-base font-medium">Add gear to a truck</span>
        </button>
        </div>
      </div>
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
