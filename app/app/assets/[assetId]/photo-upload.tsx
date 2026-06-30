"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { setAssetPhoto } from "./actions";

export default function PhotoUpload({
  assetId,
  companyId,
  hasPhoto,
}: {
  assetId: string;
  companyId: string;
  hasPhoto: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const sb = getBrowserSupabase();
    if (!sb) { setBusy(false); return; }
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${companyId}/asset/${assetId}/${Date.now()}-${safe}`;
    const { error } = await sb.storage.from("proofs").upload(path, file, { upsert: false });
    if (!error) {
      await setAssetPhoto({ assetId, storage_path: path, content_type: file.type || null });
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <>
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-elevated disabled:opacity-50"
      >
        <Camera className="h-4 w-4" /> {busy ? "Uploading…" : hasPhoto ? "Replace photo" : "Add photo"}
      </button>
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
    </>
  );
}
