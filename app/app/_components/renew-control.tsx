"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, X, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { extractExpirationDate } from "@/lib/ocr-date";
import { renewComplianceItem } from "@/app/app/units/[unitId]/actions";

/**
 * The product's core loop: snap → renewed → done. Two taps.
 *
 * Trust layer (the most-requested pattern from operator feedback): when a
 * proof photo is attached we OCR it and PRE-FILL the expiration — flagged
 * unconfirmed — and Save stays disabled until the human explicitly accepts
 * or corrects the date. A blind auto-read never saves itself; one missed
 * digit on a BOP cert is a real invoice.
 */
function plusOneYear(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

type OcrState = "idle" | "reading" | "unconfirmed" | "confirmed" | "none";

export default function RenewControl({
  itemId,
  companyId,
  redirectPath,
}: {
  itemId: string;
  companyId: string;
  redirectPath: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");
  const [expiration, setExpiration] = useState(plusOneYear());
  const [ocr, setOcr] = useState<OcrState>("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(file: File | undefined) {
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
    if (read) {
      setExpiration(read);
      setOcr("unconfirmed"); // Save blocked until the human accepts/corrects
    } else {
      setOcr("none"); // nothing plausible found — plain manual entry, no block
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    if (!expiration) {
      setErr("Set the new expiration date.");
      return;
    }
    if (ocr === "unconfirmed" || ocr === "reading") return; // belt + suspenders
    setBusy(true);
    let storage_path: string | null = null;
    let content_type: string | null = null;

    const file = fileRef.current?.files?.[0];
    if (file) {
      const sb = getBrowserSupabase();
      if (sb) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${companyId}/compliance_item/${itemId}/${Date.now()}-${safe}`;
        const { error } = await sb.storage.from("proofs").upload(path, file, { upsert: false });
        if (error) {
          setErr("Photo upload failed — saved the date without it.");
        } else {
          storage_path = path;
          content_type = file.type || null;
        }
      }
    }

    try {
      await renewComplianceItem({ itemId, expiration_date: expiration, storage_path, content_type, redirectPath });
      setOpen(false);
      setFileName("");
      setOcr("idle");
      router.refresh();
    } catch {
      setErr("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-elevated"
      >
        <Camera className="h-4 w-4" /> Renew
      </button>
    );
  }

  const saveBlocked = busy || ocr === "reading" || ocr === "unconfirmed";

  return (
    <form onSubmit={save} className="mt-3 flex flex-col gap-2 rounded-lg border border-line-2 bg-coal p-3">
      <label className="flex flex-col gap-1 text-xs text-ink-dim">
        New proof photo
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => void onPick(e.target.files?.[0])}
          className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-ink"
        />
        {fileName ? <span className="text-emerald-400">✓ {fileName}</span> : null}
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink-dim">
        New expiration date
        <input
          name="expiration_date"
          type="date"
          required
          value={expiration}
          onChange={(e) => {
            setExpiration(e.target.value);
            if (ocr === "unconfirmed") setOcr("confirmed"); // human corrected = confirmed
          }}
          className={cn(
            "h-10 rounded-md border bg-surface px-3 text-sm text-ink outline-none",
            ocr === "unconfirmed"
              ? "border-amber-500/60 ring-1 ring-amber-500/30 focus:border-amber-400"
              : "border-line-2 focus:border-[#e7ddc7]",
          )}
        />
      </label>
      {expiration && expiration < new Date().toISOString().slice(0, 10) ? (
        <p className="text-xs text-amber-400">That date is already past — this item will show Expired the moment you save.</p>
      ) : null}
      {ocr === "reading" ? (
        <p className="flex items-center gap-1.5 text-xs text-ink-dim"><ScanLine className="h-3.5 w-3.5 animate-pulse" /> Reading the photo…</p>
      ) : ocr === "unconfirmed" ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-2">
          <span className="text-xs text-amber-400">Read from the photo — confirm it&apos;s right before saving.</span>
          <button type="button" onClick={() => setOcr("confirmed")}
            className="shrink-0 rounded-md border border-amber-500/50 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-500/15">
            Looks right
          </button>
        </div>
      ) : ocr === "confirmed" ? (
        <p className="text-xs text-emerald-400">✓ Date confirmed by you.</p>
      ) : ocr === "none" && fileName ? (
        <p className="text-xs text-ink-faint">Couldn&apos;t read a date off the photo — set it yourself.</p>
      ) : null}
      {err ? <p className="text-xs text-amber-400">{err}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saveBlocked}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#e7ddc7] px-3 py-1.5 text-[13px] font-medium text-coal disabled:opacity-50">
          <Check className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setOcr("idle"); setFileName(""); }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-[13px] text-ink hover:bg-elevated">
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </form>
  );
}
