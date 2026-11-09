"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { handOffTool } from "./actions";

/**
 * "Hand it to someone": on location, the tool goes from one hand to another
 * without a trip to the yard. For a tool redressed after every run, it asks
 * whether it ran, so the next person doesn't run it without a redress.
 */
export default function HandOff({ assetId, holder, crew, redress }: {
  assetId: string;
  /** Who has it now (left out of the list). */
  holder: string | null;
  crew: { id: string; name: string }[];
  redress: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const others = crew.filter((c) => c.id !== holder);
  const [to, setTo] = useState(others[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ good: boolean; text: string } | null>(null);
  if (!others.length) return null;

  const go = (ran: boolean) => start(async () => {
    setMsg(null);
    try {
      const r = await handOffTool({ assetId, to, ran });
      if (r.ok) { setMsg({ good: true, text: r.summary ?? "Handed off." }); setOpen(false); router.refresh(); }
      else setMsg({ good: false, text: r.error ?? "Couldn't hand it off." });
    } catch {
      setMsg({ good: false, text: "No signal. Try again when you have signal (it won't hand it off twice)." });
    }
  });

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      {open ? (
        <div className="flex w-full flex-col gap-2 sm:w-72">
          <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Who's taking it"
            className="h-12 w-full rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone">
            {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {redress ? (
            <>
              <button type="button" disabled={pending || !to} onClick={() => go(true)} className={buttonClass("default", "default", "min-h-12")}>
                {pending ? "Saving…" : "It ran. Hand it over, needs redress"}
              </button>
              <button type="button" disabled={pending || !to} onClick={() => go(false)} className={buttonClass("outline", "default", "min-h-12")}>
                It didn&apos;t run. Hand it over
              </button>
            </>
          ) : (
            <button type="button" disabled={pending || !to} onClick={() => go(false)} className={buttonClass("default", "default", "min-h-12")}>
              {pending ? "Saving…" : "Hand it over"}
            </button>
          )}
          <button type="button" disabled={pending} onClick={() => setOpen(false)} className="min-h-11 text-sm text-ink-dim hover:text-ink">Cancel</button>
        </div>
      ) : (
        <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className={buttonClass("outline", "default", "min-h-11")}>
          Hand it to someone
        </button>
      )}
      {msg ? <span role="status" className={msg.good ? "text-[13px] text-emerald-400" : "text-[13px] text-amber-400"}>{msg.text}</span> : null}
    </div>
  );
}
