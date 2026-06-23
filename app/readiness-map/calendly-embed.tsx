"use client";

import { useEffect } from "react";

// Set NEXT_PUBLIC_CALENDLY_URL in Vercel to your "SYNNR Readiness Call" event.
const CAL = process.env.NEXT_PUBLIC_CALENDLY_URL;

/** Inline Calendly booking widget. Until the URL env is set, shows a clean
 *  placeholder so the page never looks broken. */
export default function CalendlyEmbed() {
  useEffect(() => {
    if (!CAL) return;
    const s = document.createElement("script");
    s.src = "https://assets.calendly.com/assets/external/widget.js";
    s.async = true;
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, []);

  if (!CAL) {
    return (
      <div className="rm-cal-placeholder">
        <b>Pick a time — calendar drops in here.</b>
        <p>Send your details above and we&apos;ll email you to lock in a 15-minute Readiness Call this week.</p>
      </div>
    );
  }
  return <div className="calendly-inline-widget" data-url={CAL} style={{ minWidth: 320, height: 680 }} />;
}
