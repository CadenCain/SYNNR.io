"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { shrinkPhoto } from "@/lib/shrink-photo";

/**
 * A form whose photos get shrunk on the phone before they're sent. A server
 * action caps the request at 4MB and two raw phone photos blow past that, so
 * a plain <form action> with file inputs failed on real photos.
 */
export default function PhotoForm({ action, className, children }: {
  action: (fd: FormData) => Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    const fd = new FormData(e.currentTarget);
    for (const [k, v] of [...fd.entries()]) {
      if (v instanceof File && v.size > 0) fd.set(k, await shrinkPhoto(v));
    }
    try {
      await action(fd);
      ref.current?.reset();
      router.refresh();
    } catch {
      setErr("That didn't save. Check your signal and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={ref} onSubmit={onSubmit} className={className} aria-busy={busy}>
      <fieldset disabled={busy} className="contents">{children}</fieldset>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
    </form>
  );
}
