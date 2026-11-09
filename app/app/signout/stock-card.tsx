"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { takeSettingTools, bringBackSettingTools, vendorVisit, countToolStock, editToolStock, stopToolStock, addToolStock } from "./stock-actions";

export interface StockView {
  id: string; name: string; plural: string; vendor: string | null; yardName: string;
  ready: number; used: number; lowAt: number; out: number; ranThisMonth: number;
  lastVendor: { when: string; note: string | null } | null;
  outs: { id: string; userId: string | null; name: string; qty: number; note: string | null; days: number }[];
}

const input = "h-12 w-full rounded-lg border border-line-2 bg-coal px-3 text-base text-ink outline-none focus:border-bone";
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `k${Math.random().toString(36).slice(2)}${Date.now()}`);
const NO_SIGNAL = "No signal. Try again when you have signal (it won't save twice).";
const num = (v: string, hi: number) => Math.max(0, Math.min(hi, Math.floor(Number(v) || 0)));

/**
 * One yard's setting tools, by count: how many are ready on the shelf, out
 * with someone, and used waiting on the vendor's pickup. Take one, bring it
 * back (ran it or didn't), and log the vendor's swap, each in a tap or two.
 */
export default function StockCard({ stock: s, me, manager, crew, alertDays, month }: {
  stock: StockView; me: string; manager: boolean; crew: { id: string; name: string }[]; alertDays: number; month: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [panel, setPanel] = useState<"" | "take" | "vendor" | "count" | "edit">("");
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<{ good: boolean; text: string } | null>(null);
  const [qty, setQty] = useState(1);
  const [to, setTo] = useState(me);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState(String(s.used));
  const [dropped, setDropped] = useState(String(s.used));
  const [ready, setReady] = useState(String(s.ready));
  const [used, setUsed] = useState(String(s.used));
  const [name, setName] = useState(s.name);
  const [vendor, setVendor] = useState(s.vendor ?? "");
  const [lowAt, setLowAt] = useState(String(s.lowAt));
  const low = s.ready <= s.lowAt;

  const open = (p: typeof panel) => {
    setMsg(null); setKey(newKey()); setPanel(panel === p ? "" : p);
    setQty(1); setTo(me); setNote("");
    setPicked(String(s.used)); setDropped(String(s.used)); setReady(String(s.ready)); setUsed(String(s.used));
    setName(s.name); setVendor(s.vendor ?? ""); setLowAt(String(s.lowAt));
  };
  const run = (go: () => Promise<{ ok: boolean; error?: string; summary?: string }>) => start(async () => {
    setMsg(null);
    try {
      const r = await go();
      if (r.ok) { setMsg({ good: true, text: r.summary ?? "Saved." }); setPanel(""); router.refresh(); }
      else setMsg({ good: false, text: r.error ?? "Couldn't save that." });
    } catch {
      setMsg({ good: false, text: NO_SIGNAL });
    }
  });

  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border p-4", low ? "border-amber-500/40 bg-amber-500/[0.04]" : "border-line bg-surface")}>
      <div>
        <h3 className="break-words font-semibold">{s.plural}</h3>
        <p className="text-[13px] text-ink-dim">{s.yardName}{s.vendor ? ` · from ${s.vendor}` : ""}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={cn("rounded-xl border p-2", low ? "border-amber-500/40" : "border-emerald-500/30")}>
          <div className={cn("text-2xl font-bold tabular-nums", low ? "text-amber-400" : "text-emerald-400")}>{s.ready}</div>
          <div className="text-[12px] text-ink-dim">Ready</div>
        </div>
        <div className="rounded-xl border border-line-2 p-2">
          <div className="text-2xl font-bold tabular-nums">{s.out}</div>
          <div className="text-[12px] text-ink-dim">Out</div>
        </div>
        <div className="rounded-xl border border-line-2 p-2">
          <div className="text-2xl font-bold tabular-nums">{s.used}</div>
          <div className="text-[12px] text-ink-dim">Used, for pickup</div>
        </div>
      </div>
      {low ? (
        <p className="text-sm font-medium text-amber-400">
          {s.ready === 0 ? "None ready on the shelf." : `Only ${s.ready} ready.`}{s.vendor ? ` Call ${s.vendor} before the next job.` : " Call the vendor before the next job."}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={s.ready === 0} onClick={() => open("take")} className={buttonClass("default", "lg", "h-12 text-base")}>Take one</button>
        <button type="button" onClick={() => open("vendor")} className={buttonClass("outline", "lg", "h-12 text-base")}>Vendor came</button>
        {manager ? <button type="button" onClick={() => open("count")} className={buttonClass("outline", "default", "min-h-12")}>Count the shelf</button> : null}
        {manager ? <button type="button" onClick={() => open("edit")} className={buttonClass("ghost", "default", "min-h-12")}>Edit</button> : null}
      </div>

      {panel === "take" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line-2 p-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-ink-dim">How many</span>
            <button type="button" aria-label="One less" disabled={qty <= 1} onClick={() => setQty((n) => Math.max(1, n - 1))} className={buttonClass("outline", "default", "h-12 w-12 text-lg")}>-</button>
            <span className="w-8 text-center text-xl font-bold tabular-nums">{qty}</span>
            <button type="button" aria-label="One more" disabled={qty >= Math.min(20, s.ready)} onClick={() => setQty((n) => Math.min(20, s.ready, n + 1))} className={buttonClass("outline", "default", "h-12 w-12 text-lg")}>+</button>
          </div>
          {manager && crew.length > 1 ? (
            <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Who's taking it" className={input}>
              {crew.map((c) => <option key={c.id} value={c.id}>{c.id === me ? `Me (${c.name})` : c.name}</option>)}
            </select>
          ) : null}
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 120))} placeholder="For which job? (optional)" aria-label="For which job" className={input} />
          <button type="button" disabled={pending} onClick={() => run(() => takeSettingTools({ stockId: s.id, qty, to: to !== me ? to : undefined, note, key }))}
            className={buttonClass("default", "lg", "h-14 text-base")}>
            {pending ? "Saving…" : `Take ${qty}${to !== me ? ` for ${crew.find((c) => c.id === to)?.name ?? "them"}` : ""}`}
          </button>
        </div>
      ) : null}

      {panel === "vendor" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line-2 p-3">
          <label className="flex flex-col gap-1 text-sm text-ink-dim">Used ones they picked up
            <input type="number" inputMode="numeric" min={0} max={999} value={picked} onChange={(e) => setPicked(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-dim">Ready ones they dropped off
            <input type="number" inputMode="numeric" min={0} max={999} value={dropped} onChange={(e) => setDropped(e.target.value)} className={input} />
          </label>
          <button type="button" disabled={pending} onClick={() => run(() => vendorVisit({ stockId: s.id, picked: num(picked, 999), dropped: num(dropped, 999), key }))}
            className={buttonClass("default", "lg", "h-14 text-base")}>{pending ? "Saving…" : "Save the swap"}</button>
        </div>
      ) : null}

      {panel === "count" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line-2 p-3">
          <p className="text-[13px] text-ink-dim">Count what&apos;s really there. The ones out with people stay out.</p>
          <label className="flex flex-col gap-1 text-sm text-ink-dim">Ready on the shelf
            <input type="number" inputMode="numeric" min={0} max={999} value={ready} onChange={(e) => setReady(e.target.value)} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-dim">Used, waiting on pickup
            <input type="number" inputMode="numeric" min={0} max={999} value={used} onChange={(e) => setUsed(e.target.value)} className={input} />
          </label>
          <button type="button" disabled={pending} onClick={() => run(() => countToolStock({ stockId: s.id, ready: num(ready, 999), used: num(used, 999), key }))}
            className={buttonClass("default", "lg", "h-14 text-base")}>{pending ? "Saving…" : "Save the count"}</button>
        </div>
      ) : null}

      {panel === "edit" ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line-2 p-3">
          <label className="flex flex-col gap-1 text-sm text-ink-dim">What they&apos;re called
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-dim">Vendor
            <input value={vendor} onChange={(e) => setVendor(e.target.value.slice(0, 80))} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink-dim">Warn when ready gets down to
            <input type="number" inputMode="numeric" min={0} max={99} value={lowAt} onChange={(e) => setLowAt(e.target.value)} className={input} />
          </label>
          <button type="button" disabled={pending} onClick={() => run(() => editToolStock({ stockId: s.id, name, vendor, lowAt: num(lowAt, 99) }))}
            className={buttonClass("default", "lg", "h-14 text-base")}>{pending ? "Saving…" : "Save"}</button>
          <button type="button" disabled={pending} onClick={() => { if (window.confirm(`Stop counting ${s.plural} at ${s.yardName}? The history stays.`)) run(() => stopToolStock({ stockId: s.id })); }}
            className="min-h-11 text-left text-sm text-red-400 hover:underline">Stop counting these</button>
        </div>
      ) : null}

      {msg ? <p role="status" className={cn("text-sm font-medium", msg.good ? "text-emerald-400" : "text-amber-400")}>{msg.text}</p> : null}

      {s.outs.length ? (
        <div className="flex flex-col gap-2">
          {s.outs.map((o) => <OutLine key={o.id} o={o} canBring={o.userId === me || manager} me={o.userId === me} late={o.days >= alertDays} alertDays={alertDays} run={run} pending={pending} />)}
        </div>
      ) : null}

      <p className="text-[13px] text-ink-faint">
        Ran in {month}: {s.ranThisMonth}.{" "}
        {s.lastVendor ? `Vendor last came ${s.lastVendor.when}${s.lastVendor.note ? ` (${s.lastVendor.note.replace(/^Vendor /, "").replace(/\.$/, "")})` : ""}.` : "No vendor swap logged yet."}
      </p>
    </div>
  );
}

function OutLine({ o, canBring, me, late, alertDays, run, pending }: {
  o: StockView["outs"][number]; canBring: boolean; me: boolean; late: boolean; alertDays: number; pending: boolean;
  run: (go: () => Promise<{ ok: boolean; error?: string; summary?: string }>) => void;
}) {
  const [ran, setRan] = useState(String(o.qty));
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl border p-3", late ? "border-red-500/40 bg-red-500/[0.06]" : "border-line-2")}>
      <div className="min-w-0 text-sm">
        <div className="font-semibold">{me ? "With you" : `With ${o.name}`} · {o.qty}</div>
        <div className={cn("text-[13px]", late ? "font-medium text-red-400" : "text-ink-dim")}>
          {o.days === 0 ? "since today" : `${o.days} ${o.days === 1 ? "day" : "days"}`}{late ? `, past the ${alertDays}-day limit` : ""}{o.note ? ` · ${o.note}` : ""}
        </div>
      </div>
      {canBring ? (
        o.qty === 1 ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => bringBackSettingTools({ outId: o.id, used: 1, unused: 0 }))} className={buttonClass("default", "default", "min-h-12")}>Ran it</button>
            <button type="button" disabled={pending} onClick={() => run(() => bringBackSettingTools({ outId: o.id, used: 0, unused: 1 }))} className={buttonClass("outline", "default", "min-h-12")}>Didn&apos;t run it</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select value={ran} onChange={(e) => setRan(e.target.value)} aria-label="How many ran" className="h-12 rounded-lg border border-line-2 bg-coal px-3 text-base text-ink">
              {Array.from({ length: o.qty + 1 }, (_, i) => <option key={i} value={i}>{i} ran</option>)}
            </select>
            <button type="button" disabled={pending} onClick={() => { const u = num(ran, o.qty); run(() => bringBackSettingTools({ outId: o.id, used: u, unused: o.qty - u })); }}
              className={buttonClass("default", "default", "min-h-12")}>Back</button>
          </div>
        )
      ) : null}
    </div>
  );
}

/** A manager starts counting a yard's setting tools. */
export function AddStock({ yards }: { yards: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openForm, setOpen] = useState(false);
  const [yardId, setYard] = useState(yards[0]?.id ?? "");
  const [name, setName] = useState("");
  const [vendor, setVendor] = useState("");
  const [ready, setReady] = useState("");
  const [used, setUsed] = useState("0");
  const [lowAt, setLowAt] = useState("2");
  const [msg, setMsg] = useState<{ good: boolean; text: string } | null>(null);
  if (!yards.length) return null;
  if (!openForm) {
    return (
      <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className={buttonClass("outline", "default", "min-h-12 self-start")}>
        Count a vendor&apos;s setting tools
      </button>
    );
  }
  const save = () => start(async () => {
    setMsg(null);
    try {
      const r = await addToolStock({ yardId, name, vendor, ready: num(ready, 999), used: num(used, 999), lowAt: num(lowAt, 99) });
      if (r.ok) { setOpen(false); setName(""); setVendor(""); setReady(""); setUsed("0"); router.refresh(); }
      else setMsg({ good: false, text: r.error ?? "Couldn't save it." });
    } catch {
      setMsg({ good: false, text: NO_SIGNAL });
    }
  });
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
      <h3 className="font-semibold">Count a vendor&apos;s setting tools</h3>
      <p className="text-[13px] text-ink-dim">For tools a vendor keeps the yard stocked with and swaps out, so the serials change. The app counts them: ready, out, and used waiting on pickup.</p>
      {yards.length > 1 ? (
        <select value={yardId} onChange={(e) => setYard(e.target.value)} aria-label="Which yard" className={input}>
          {yards.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </select>
      ) : null}
      <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder="What they're called: Silver Fox setting tool, Baker 20" aria-label="What they're called" className={input} />
      <input value={vendor} onChange={(e) => setVendor(e.target.value.slice(0, 80))} placeholder="Vendor (optional)" aria-label="Vendor" className={input} />
      <label className="flex flex-col gap-1 text-sm text-ink-dim">Ready on the shelf now
        <input type="number" inputMode="numeric" min={0} max={999} value={ready} onChange={(e) => setReady(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-dim">Used, waiting on pickup now
        <input type="number" inputMode="numeric" min={0} max={999} value={used} onChange={(e) => setUsed(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-dim">Warn me when ready gets down to
        <input type="number" inputMode="numeric" min={0} max={99} value={lowAt} onChange={(e) => setLowAt(e.target.value)} className={input} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending || !name.trim()} onClick={save} className={buttonClass("default", "lg", "h-14 text-base")}>{pending ? "Saving…" : "Start counting"}</button>
        <button type="button" disabled={pending} onClick={() => setOpen(false)} className={buttonClass("ghost", "lg", "h-14 text-base")}>Cancel</button>
      </div>
      {msg ? <p role="status" className="text-sm font-medium text-amber-400">{msg.text}</p> : null}
    </div>
  );
}
