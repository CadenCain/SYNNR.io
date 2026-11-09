"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOutTools } from "./actions";

export interface Pickable { id: string; name: string; serial: string | null; where: string; blocked: string | null; redress: boolean;
  /** A tool, or anything sitting in the yard (not on a truck): what people sign out. Shown before searching. */
  usual: boolean }

/**
 * Sign tools out to yourself: find it, tap it, say what job (if you want),
 * and sign out. Anything not fit to go shows why and can't be picked; the
 * server checks again before anything is signed out.
 */
export default function SignOutPicker({ pieces }: { pieces: Pickable[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string; list?: { name: string; why: string }[] } | null>(null);

  const shown = useMemo(() => {
    const f = q.trim().toLowerCase();
    // Before searching: the tools and what's in the yard. Searching finds anything.
    const hits = pieces.filter((p) => f ? `${p.name} ${p.serial ?? ""} ${p.where}`.toLowerCase().includes(f) : p.usual);
    // Picked ones stay in view; otherwise a short list, sign-out tools first.
    return [...pieces.filter((p) => picked.includes(p.id) && !hits.includes(p)), ...hits].slice(0, f ? 40 : 12);
  }, [pieces, q, picked]);

  async function submit() {
    if (!picked.length) return;
    setBusy(true); setMsg(null);
    try {
      const r = await signOutTools({ assetIds: picked, note });
      if (r.ok) {
        const n = picked.length - (r.refused?.length ?? 0);
        setMsg({ tone: r.refused?.length ? "bad" : "good", text: `Signed out to you: ${n} ${n === 1 ? "tool" : "tools"}. Check it back in when it comes back.`, list: r.refused });
        setPicked([]); setNote(""); setQ("");
        router.refresh();
      } else {
        setMsg({ tone: "bad", text: r.error ?? "Couldn't sign that out.", list: r.refused });
      }
    } catch {
      setMsg({ tone: "bad", text: "No signal. Nothing was signed out. Try again when you have signal." });
    }
    setBusy(false);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <div>
        <h2 className="font-semibold">Sign out a tool</h2>
        <p className="text-sm text-ink-dim">It goes out under your name, with the time. It stays out with you until it&apos;s checked back in.</p>
      </div>
      <label className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find it: Silver Fox, setting tool, a serial…" aria-label="Find a tool"
          className="h-12 w-full rounded-lg border border-line-2 bg-coal pl-9 pr-3 text-base text-ink outline-none focus:border-bone" />
      </label>
      <div className="flex flex-col gap-2">
        {shown.map((p) => {
          const on = picked.includes(p.id);
          return (
            <button key={p.id} type="button" disabled={Boolean(p.blocked)} aria-pressed={on}
              onClick={() => setPicked((x) => on ? x.filter((i) => i !== p.id) : [...x, p.id])}
              className={cn("flex min-h-14 items-center gap-3 rounded-xl border-2 px-3 py-2 text-left",
                p.blocked ? "cursor-not-allowed border-red-500/30 bg-red-500/[0.05]" : on ? "border-bone bg-bone/10" : "border-line-2 hover:bg-elevated")}>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                on ? "border-bone bg-bone/15 text-bone" : "border-line-2 text-ink-faint")}>{on ? <Check className="h-4 w-4" /> : null}</span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-semibold">{p.name}{p.serial ? <span className="font-normal text-ink-dim"> · {p.serial}</span> : null}</span>
                <span className={cn("block text-[13px]", p.blocked ? "font-medium text-red-400" : "text-ink-dim")}>
                  {p.blocked ? `${p.blocked}. Can't go out.` : p.where}{!p.blocked && p.redress ? " · redressed after every run" : ""}
                </span>
              </span>
            </button>
          );
        })}
        {!shown.length ? <p className="text-sm text-ink-faint">{q.trim() ? "Nothing matches. Check the name or serial." : "Type a name or serial to find any piece."}</p> : null}
      </div>
      {picked.length ? (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-20 flex flex-col gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur md:bottom-4">
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 120))} placeholder="For which job? (optional)" aria-label="For which job"
            className="h-12 w-full rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone" />
          <button type="button" onClick={submit} disabled={busy} className={buttonClass("default", "lg", "h-14 text-base")}>
            {busy ? "Signing out…" : `Sign out ${picked.length} to me`}
          </button>
        </div>
      ) : null}
      {msg ? (
        <div role="status" className={cn("rounded-xl border p-3 text-sm font-medium", msg.tone === "good" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-red-500/40 bg-red-500/10 text-red-400")}>
          {msg.text}
          {msg.list?.length ? <ul className="mt-1 list-disc pl-5">{msg.list.map((x) => <li key={x.name}>{x.name}: {x.why}</li>)}</ul> : null}
        </div>
      ) : null}
    </section>
  );
}
