"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { truckBack } from "../units/[unitId]/scan/quick-actions";

/** "It's back": one tap ends the truck's trip, with a name and a time. */
export default function TruckBackButton({ unitId, name }: { unitId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [key] = useState(() => new Date().toISOString());
  const [err, setErr] = useState("");
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <button type="button" disabled={pending} aria-label={`${name} is back in the yard`}
        onClick={() => start(async () => {
          setErr("");
          try {
            const r = await truckBack({ unitId, key });
            if (r.ok) router.refresh(); else setErr(r.error ?? "Couldn't save that.");
          } catch {
            setErr("No signal. Tap it again when you have signal.");
          }
        })}
        className={buttonClass("default", "lg", "h-14 w-full text-base")}>
        <Undo2 className="h-5 w-5" /> {pending ? "Saving…" : "It's back"}
      </button>
      {err ? <span role="status" className="text-[13px] text-amber-400">{err}</span> : null}
    </div>
  );
}
