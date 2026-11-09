"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { markRedressed } from "./actions";

/**
 * "Mark it redressed", built for one bar of signal: it says it's saving,
 * and if the signal drops it says so and stays on the page instead of
 * showing the crash screen.
 */
export default function RedressedButton({ assetId, since }: { assetId: string;
  /** When it came back needing redress, as this page saw it. */
  since?: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" disabled={pending} className={buttonClass("default", "default", "min-h-11")}
        onClick={() => start(async () => {
          setErr("");
          const fd = new FormData();
          fd.set("asset_id", assetId);
          if (since) fd.set("since", since);
          try {
            const r = await markRedressed(fd);
            if (!r.ok) { setErr(r.error ?? "Couldn't save that."); return; }
            router.refresh();
          } catch {
            setErr("No signal. Try again when you have signal.");
          }
        })}>
        {pending ? "Saving…" : "Mark it redressed"}
      </button>
      {err ? <span role="status" className="text-[13px] text-amber-400">{err}</span> : null}
    </span>
  );
}
