"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

/**
 * Something threw on a page outside the app. A calm way back instead of a
 * raw error, and the details go to the server log (Vercel runtime logs).
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app/error]", error?.digest ?? "", error?.message ?? error);
  }, [error]);

  return (
    <div className="saas flex min-h-dvh flex-col bg-coal text-ink antialiased">
      <header className="px-5 py-5 md:px-10"><Link href="/" aria-label="SYNNR home"><Wordmark /></Link></header>
      <main className="flex flex-1 items-center px-5 pb-24 md:px-10">
        <div className="max-w-md">
          <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.03em]">That didn&apos;t go through.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-dim">
            Something broke on our end. Nothing you put in was lost. Try again, and if it keeps happening, email{" "}
            <a href="mailto:cadencain@synnr.io" className="text-ink underline underline-offset-4">cadencain@synnr.io</a>.
          </p>
          {error?.digest ? <p className="mt-2 font-mono text-xs text-ink-faint">ref {error.digest}</p> : null}
          <div className="mt-7 flex gap-2">
            <button type="button" onClick={() => reset()} className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-coal transition-colors hover:bg-white">Try again</button>
            <Link href="/" className="inline-flex h-10 items-center rounded-lg border border-line-2 px-4 text-sm text-ink transition-colors hover:bg-elevated">Home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
