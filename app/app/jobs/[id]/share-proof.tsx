"use client";

import { useState, useSyncExternalStore } from "react";
import { Send } from "lucide-react";
import { shareJob, unshareJob } from "../actions";

// The link uses the address the crew is on right now, so it's right on the
// live site and on a test one. The server's first paint assumes the live site.
const never = () => () => {};
const here = () => window.location.origin;
const live = () => "https://www.synnr.io";

/**
 * The link for the customer. It opens this job with no login: the list,
 * what's on the truck, and the photo of each critical piece. Anyone on the
 * crew can make it and send it; a manager can turn it off.
 */
export default function ShareProof({ jobId, title, initialToken, manager, writable, demo }: {
  jobId: string; title: string; initialToken: string | null; manager: boolean; writable: boolean; demo: boolean;
}) {
  const origin = useSyncExternalStore(never, here, live);
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const url = token ? `${origin}/p/${token}` : "";

  async function make() {
    setBusy(true); setErr(""); setNote("");
    try {
      const r = await shareJob(jobId);
      if (!r.ok) { setErr(r.error); return; }
      setToken(r.token);
    } catch {
      setErr("That didn't send. Check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    setErr("");
    try {
      await navigator.clipboard.writeText(url);
      setNote("Copied. Paste it in a text or an email.");
    } catch {
      setNote("Press and hold the link to copy it.");
    }
  }

  // On a phone this opens the share sheet (text, email). Anywhere else it copies the link.
  async function send() {
    setErr(""); setNote("");
    if (typeof navigator.share !== "function") { await copy(); return; }
    try {
      await navigator.share({ title, text: `${title}: what's on the truck, with photos.`, url });
    } catch (e) {
      // Backing out of the share sheet isn't a failure.
      if (!(e instanceof DOMException && e.name === "AbortError")) await copy();
    }
  }

  async function off() {
    if (!window.confirm("Turn this link off? Anyone you sent it to won't be able to open it anymore.")) return;
    setBusy(true); setErr(""); setNote("");
    try {
      const r = await unshareJob(jobId);
      if (!r.ok) { setErr(r.error); return; }
      setToken(null);
      setNote("The link is off.");
    } catch {
      setErr("That didn't send. The link is still on. Check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!token && !writable) return null;

  return (
    <section>
      <h2 className="text-[15px] font-medium text-ink">Send it to the customer</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-faint">
        {demo
          ? "In your own company, this makes a link to the job's list and its photos that a customer opens without logging in. It's off in the demo company."
          : token
            ? "Whoever has this link sees the list, what's on the truck right now, and the photos. No login."
            : "Make a link to this job's list and its photos. Whoever you send it to opens it without logging in, and it always shows the truck as it stands."}
      </p>

      {demo ? null : token ? (
        <div className="mt-3 rounded-xl border border-line bg-surface p-4">
          <input readOnly value={url} aria-label="The link" onFocus={(e) => e.currentTarget.select()}
            className="h-11 w-full rounded-lg border border-line-2 bg-coal px-3 font-mono text-[13px] text-ink outline-none focus:border-ink-faint" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={send} disabled={busy}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-5 text-[14px] font-medium text-coal transition-colors hover:bg-white disabled:opacity-60 sm:flex-none">
              <Send className="h-4 w-4" /> Send it
            </button>
            <button type="button" onClick={copy} disabled={busy}
              className="h-11 flex-1 rounded-lg border border-line-2 px-5 text-[14px] text-ink transition-colors hover:bg-elevated disabled:opacity-60 sm:flex-none">
              Copy link
            </button>
            <a href={url} target="_blank" rel="noopener" className="text-[13px] text-ink-dim underline-offset-4 transition-colors hover:text-ink hover:underline">See what they see</a>
            {manager && writable ? (
              <button type="button" onClick={off} disabled={busy} className="text-[13px] text-ink-faint underline-offset-4 transition-colors hover:text-red-400 hover:underline sm:ml-auto">Turn the link off</button>
            ) : null}
          </div>
        </div>
      ) : (
        <button type="button" onClick={make} disabled={busy}
          className="mt-3 h-11 rounded-lg border border-line-2 px-5 text-[14px] text-ink transition-colors hover:bg-elevated disabled:opacity-60">
          {busy ? "Making the link…" : "Make the link"}
        </button>
      )}

      {note ? <p role="status" className="mt-3 text-[13px] text-ink-dim">{note}</p> : null}
      {err ? <p role="alert" className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</p> : null}
    </section>
  );
}
