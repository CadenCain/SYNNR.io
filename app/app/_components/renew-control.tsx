"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, X } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { renewComplianceItem } from "@/app/app/units/[unitId]/actions";

/**
 * The product's core loop: snap → renewed → done. Two taps.
 * Tap Renew → camera opens → photograph the new cert → confirm the new
 * expiration date (pre-filled +1yr) → Save. Status flips on refresh.
 */
function plusOneYear(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

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
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const fd = new FormData(e.currentTarget);
    const expiration = String(fd.get("expiration_date") ?? "");
    if (!expiration) {
      setErr("Set the new expiration date.");
      return;
    }
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

  return (
    <form onSubmit={save} className="mt-3 flex flex-col gap-2 rounded-lg border border-line-2 bg-coal p-3">
      <label className="flex flex-col gap-1 text-xs text-ink-dim">
        New proof photo
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
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
          defaultValue={plusOneYear()}
          className="h-10 rounded-md border border-line-2 bg-surface px-3 text-sm text-ink outline-none focus:border-[#e7ddc7]"
        />
      </label>
      {err ? <p className="text-xs text-amber-400">{err}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#e7ddc7] px-3 py-1.5 text-[13px] font-medium text-coal disabled:opacity-50">
          <Check className="h-4 w-4" /> {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-[13px] text-ink hover:bg-elevated">
          <X className="h-4 w-4" /> Cancel
        </button>
      </div>
    </form>
  );
}
