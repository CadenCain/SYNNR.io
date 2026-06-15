"use client";

import { useState } from "react";

/** Email capture for coming-soon apps → /api/lead (source = waitlist:slug). */
export default function WaitlistForm({ slug, name }: { slug: string; name: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/\S+@\S+\.\S+/.test(email)) { setState("err"); setMsg("Enter a valid email."); return; }
    setState("busy"); setMsg("");
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: `waitlist:${slug}` }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { setState("err"); setMsg(d.error || "Couldn't save — try again."); return; }
      setState("done"); setMsg(`You're on the ${name} waitlist. We'll email you when it's live.`);
    } catch { setState("err"); setMsg("Couldn't reach SYNNR — try again."); }
  }

  if (state === "done") return <p className="wl-done">{msg}</p>;

  return (
    <form className="wl" onSubmit={submit}>
      <input
        type="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label={`Email for ${name} waitlist`}
      />
      <button className="btn btn-ghost btn-sm" disabled={state === "busy"}>
        {state === "busy" ? "Joining…" : "Join waitlist"}
      </button>
      {state === "err" ? <span className="wl-err">{msg}</span> : null}
    </form>
  );
}
