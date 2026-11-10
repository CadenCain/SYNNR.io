import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

/** A page that isn't here: say so, and give two ways back. */
export const metadata = { title: "Not found · SYNNR" };

export default function NotFound() {
  return (
    <div className="saas flex min-h-dvh flex-col bg-coal text-ink antialiased">
      <header className="px-5 py-5 md:px-10"><Link href="/" aria-label="SYNNR home"><Wordmark /></Link></header>
      <main className="flex flex-1 items-center px-5 pb-24 md:px-10">
        <div className="max-w-md">
          <p className="font-mono text-[13px] text-ink-faint">404</p>
          <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-[-0.03em]">That page isn&apos;t here.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-dim">The link may be old, or the page moved.</p>
          <div className="mt-7 flex gap-2">
            <Link href="/app" className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-sm font-medium text-coal transition-colors hover:bg-white">Open SYNNR</Link>
            <Link href="/" className="inline-flex h-10 items-center rounded-lg border border-line-2 px-4 text-sm text-ink transition-colors hover:bg-elevated">Home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
