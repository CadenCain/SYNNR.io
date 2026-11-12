import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { OWNER_PHONE, OWNER_PHONE_TEL } from "@/lib/contact";

export const metadata = { title: "This link is off · SYNNR", robots: { index: false, follow: false } };

/**
 * A customer's link that doesn't open: the shop turned it off, the job was
 * deleted, or the address got cut off in a text. The person here is a
 * customer, not a user, so there's no "log in": just what happened and who
 * to ask.
 */
export default function LinkOff() {
  return (
    <div className="saas flex min-h-dvh flex-col bg-coal text-ink antialiased">
      <header className="mx-auto w-full max-w-3xl px-4 py-5 md:px-8"><Link href="/" aria-label="SYNNR home" className="inline-flex min-h-10 items-center"><Wordmark /></Link></header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 items-center px-4 pb-24 md:px-8">
        <div className="max-w-md">
          <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em] md:text-[32px]">This link isn&apos;t on anymore.</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-dim">
            The shop that sent it turned it off, or the address got cut short on the way. Ask them to send it again.
          </p>
          <p className="mt-6 text-[13px] leading-relaxed text-ink-faint">
            SYNNR is what the shop loads out with. Questions about SYNNR itself: call or text{" "}
            <a href={OWNER_PHONE_TEL} className="text-ink-dim underline underline-offset-4">{OWNER_PHONE}</a>.
          </p>
        </div>
      </main>
    </div>
  );
}
