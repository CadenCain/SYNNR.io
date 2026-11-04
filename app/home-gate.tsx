"use client";

import { useState } from "react";

/**
 * The homepage's hero: one truck at the gate, checked the way the app checks
 * it. Two problems make it NOT READY; "Fix it" swaps the bad BOP stack for a
 * good one and attaches the missing cert, and it reads READY. Same pieces and
 * wording as the demo yard, so it matches what a visitor is about to drive.
 */

type Row = { name: string; serial?: string; ok: string; bad?: string; fixed?: { name: string; serial?: string; ok: string } };

const ROWS: Row[] = [
  { name: "Reel R-3, 2-3/8in", ok: "Fatigue inspection good to Jan 17, 2027" },
  {
    name: "Quad BOP stack #3", serial: "QB-4471", ok: "", bad: "Pressure test expired 6 days ago. Don’t load it.",
    fixed: { name: "Quad BOP stack #1", serial: "QB-4469", ok: "Pressure test good to Jun 1, 2027, cert attached" },
  },
  { name: "Lubricator #2", serial: "LB-812", ok: "Pressure test good to Feb 9, 2027, cert attached" },
  {
    name: "2in 1502 Chiksan swivel", serial: "SW-1107", ok: "", bad: "A test date with no cert behind it",
    fixed: { name: "2in 1502 Chiksan swivel", serial: "SW-1107", ok: "Cert uploaded, good to Mar 23, 2027" },
  },
  { name: "2in 1502 plug valve", serial: "PV-2204", ok: "UT and hydro recert good to Mar 3, 2027" },
  { name: "Photo of the loaded truck", ok: "Taken 4:52 AM" },
];

export default function HomeGate() {
  const [fixed, setFixed] = useState(false);
  const problems = fixed ? 0 : ROWS.filter((r) => r.bad).length;
  return (
    <figure className="gate" aria-label="Example load-out check for truck CT-03">
      <div className="gate-top">
        <div>
          <div className="gate-truck">CT-03</div>
          <div className="gate-meta">Coil tubing unit · planned to leave 5:00 AM</div>
        </div>
        <span className="gate-count">{ROWS.length - problems} of {ROWS.length} check out</span>
      </div>
      <ul className="gate-rows">
        {ROWS.map((r, i) => {
          const showBad = Boolean(r.bad) && !fixed;
          const row = fixed && r.fixed ? r.fixed : r;
          return (
            <li key={r.name} className={showBad ? "bad" : "ok"} style={{ animationDelay: `${0.25 + i * 0.18}s` }}>
              <span className="gate-ic" aria-hidden="true">{showBad ? "✕" : "✓"}</span>
              <span className="gate-row">
                <span className="gate-name">{row.name}{row.serial ? <span className="gate-serial"> · {row.serial}</span> : null}</span>
                <span className="gate-why">{showBad ? r.bad : row.ok}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className={fixed ? "gate-verdict go" : "gate-verdict stop"} aria-live="polite">
        <div className="gate-word">{fixed ? "READY" : "NOT READY"}</div>
        <p>{fixed ? "Every piece checks out. The record is locked and the proof link is ready for the operator." : "2 problems. CT-03 stays in the yard until they’re fixed."}</p>
      </div>
      <div className="gate-foot">
        <button type="button" className="gate-btn" onClick={() => setFixed((f) => !f)}>
          {fixed ? "Start over" : "Fix it: swap the BOP, upload the cert"}
        </button>
        <figcaption>From the demo yard</figcaption>
      </div>
    </figure>
  );
}
