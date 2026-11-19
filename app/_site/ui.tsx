import type { ReactNode } from "react";

/**
 * The public site's few shared parts. The look is near-black, a lot of
 * space, large tight type, and one red that's spent on the main button and
 * nowhere a reader's eye doesn't need to go. No cards, no icons, no
 * decoration: a section is a hairline, a label, and what it has to say.
 */

/** Every public page sits in this: it carries the site's palette (see .site in globals.css). */
export function Site({ children }: { children: ReactNode }) {
  return <div className="site min-h-dvh antialiased">{children}</div>;
}

export const wrap = "mx-auto w-full max-w-[1320px] px-5 md:px-10 lg:px-14";

/** The first line of a page. */
export const h1 = "text-[clamp(38px,6.6vw,92px)] font-medium leading-[0.96] tracking-[-0.055em] text-ink";
/** The first line of a section. */
export const h2 = "text-[clamp(34px,5.2vw,68px)] font-medium leading-[0.98] tracking-[-0.05em] text-ink";
/** A step or a row's own heading. */
export const h3 = "text-[clamp(26px,3.3vw,44px)] font-medium leading-[1.04] tracking-[-0.04em] text-ink";
/** The small word over a section that says what it is. */
export const label = "text-[13px] leading-none text-ink-faint";
export const body = "text-[17px] leading-[1.55] text-ink-dim md:text-[19px]";
export const fine = "text-[14px] leading-[1.6] text-ink-faint";

/** The one red thing on a screen. */
export const cta = "inline-flex h-12 items-center justify-center rounded-sm bg-signal px-6 text-[15px] font-medium text-white transition-colors hover:bg-signal-deep";
/** A link that reads as a link and nothing more. */
export const quiet = "inline-flex min-h-11 items-center text-[15px] text-ink underline decoration-line-2 underline-offset-[6px] transition-colors hover:decoration-ink";

/** A section: space, a hairline, and its label. */
export function Section({ id, name, children, className = "" }: { id?: string; name?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} tabIndex={id ? -1 : undefined} className={`scroll-mt-14 outline-none ${className}`}>
      <div className={`${wrap} pb-24 md:pb-40`}>
        <div className="border-t border-line pt-5">{name ? <div className={label}>{name}</div> : null}</div>
        <div className={name ? "mt-12 md:mt-20" : "mt-7 md:mt-14"}>{children}</div>
      </div>
    </section>
  );
}
