"use client";

import { useEffect } from "react";

/**
 * Something threw inside the app. The frame stays put, nothing technical is
 * shown, and Try again asks the server for the page again (a plain reset
 * only redraws what already failed).
 */
export default function AppError({ error, reset, unstable_retry }: { error: Error & { digest?: string }; reset: () => void; unstable_retry?: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-14 md:px-8">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">That didn&apos;t go through</h1>
      <p className="text-sm leading-relaxed text-ink-dim">
        Something broke on our end, or the signal dropped. Try again, and check that your last tap saved. If it keeps happening, email{" "}
        <a href="mailto:cadencain@synnr.io" className="text-ink underline underline-offset-4">cadencain@synnr.io</a>.
      </p>
      {error.digest ? <p className="font-mono text-xs text-ink-faint">ref {error.digest}</p> : null}
      <div className="flex gap-2">
        <button type="button" onClick={() => (unstable_retry ?? reset)()} className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-coal transition-colors hover:bg-white">Try again</button>
        <a href="/app" className="inline-flex h-10 items-center rounded-lg border border-line-2 px-4 text-sm text-ink transition-colors hover:bg-elevated">Back to jobs</a>
      </div>
    </div>
  );
}
