"use client";

import { useEffect, useState } from "react";
import { ArrowUp, Paperclip } from "lucide-react";

const QUESTIONS = [
  "What do we charge for a bond log to 8,000 ft?",
  "We got a plug set tomorrow on WL-07. What do I need to take?",
  "Make me a perf run sheet for 3 stages.",
  "What does the MSA say about standby time?",
  "Read this signed ticket and tell me what to bill.",
  "Who has the setting tools out right now?",
];

/**
 * The product, drawn at full size: one bar, and the kind of thing a crew
 * asks it. It types through real questions. It's a picture, not a form, so
 * screen readers get the questions as a plain list instead.
 */
export default function HeroAsk() {
  const [i, setI] = useState(0);
  const [n, setN] = useState(QUESTIONS[0].length);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    // Anyone who asked their device for less motion gets the questions swapped whole.
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const q = QUESTIONS[i];
    let wait: number;
    let next: () => void;
    if (!typing) {
      // Full question on screen: hold it, then start the next one from empty.
      wait = 2600;
      next = () => { const j = (i + 1) % QUESTIONS.length; setI(j); setN(still ? QUESTIONS[j].length : 0); setTyping(!still); };
    } else if (n < q.length) {
      wait = 24 + (q[n] === " " ? 30 : 0);
      next = () => setN(n + 1);
    } else {
      wait = 0;
      next = () => setTyping(false);
    }
    const t = window.setTimeout(next, wait);
    return () => window.clearTimeout(t);
  }, [i, n, typing]);

  return (
    <div>
      <ul className="sr-only">{QUESTIONS.map((q) => <li key={q}>{q}</li>)}</ul>
      <div aria-hidden className="rounded-xl border border-line-2 bg-surface">
        <div className="flex min-h-[112px] items-start px-5 pt-5 text-[19px] leading-[1.45] tracking-[-0.01em] text-ink sm:min-h-[92px] sm:px-7 sm:pt-7 sm:text-[26px] md:text-[30px]">
          <span>
            {QUESTIONS[i].slice(0, n)}
            <span className="synnr-caret ml-[2px] inline-block h-[1.05em] w-[2px] translate-y-[0.18em] bg-bone" />
          </span>
        </div>
        <div className="flex items-center justify-between px-4 pb-4 sm:px-6 sm:pb-5">
          <span className="flex items-center gap-1.5 text-[13px] text-ink-faint"><Paperclip className="h-4 w-4" /> Photo or file</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-coal"><ArrowUp className="h-4 w-4" /></span>
        </div>
      </div>
    </div>
  );
}
