import type { Metadata } from "next";
import { OWNER_PHONE } from "@/lib/contact";
import PrintButton from "./print-button";

/**
 * The leave-behind. One sheet of letter paper, printed black on white and
 * handed across a desk — the 5am problem, the math, free setup, the cell
 * number, and a QR straight into the live demo. Screen shows a preview with
 * a print button; @media print strips everything but the sheet.
 */

export const metadata: Metadata = {
  title: "RollReady one-pager",
  robots: { index: false, follow: false },
};

export default function OnePager() {
  return (
    <div className="op-root">
      {/* prettier-ignore */}
      <style>{`
        .op-root { background:#3a3632; min-height:100dvh; padding:24px 12px; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
        .op-toolbar { max-width: 8.5in; margin: 0 auto 14px; display:flex; justify-content:space-between; align-items:center; color:#cfc8bc; font-size:13px; }
        .op-print-btn { background:#ece5d7; color:#191510; border:0; padding:10px 22px; font-weight:700; font-size:13px; letter-spacing:.06em; text-transform:uppercase; border-radius:3px; cursor:pointer; }
        .op-sheet { background:#fff; color:#111; max-width:8.5in; min-height:10.4in; margin:0 auto; padding:.65in .7in; box-shadow:0 18px 50px rgba(0,0,0,.5); display:flex; flex-direction:column; gap:18px; }
        .op-head { display:flex; justify-content:space-between; align-items:baseline; border-bottom:3px solid #111; padding-bottom:10px; }
        .op-brand { font-size:26px; font-weight:800; letter-spacing:-.02em; }
        .op-brand small { font-weight:500; font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:#555; margin-left:10px; }
        .op-contact { text-align:right; font-size:13px; line-height:1.5; }
        .op-contact b { font-size:15px; }
        .op-h { font-size:30px; font-weight:800; letter-spacing:-.02em; line-height:1.08; margin:0; }
        .op-h .dim { color:#777; }
        .op-p { font-size:14.5px; line-height:1.55; color:#222; margin:0; }
        .op-cols { display:grid; grid-template-columns: 1fr 1fr; gap:20px; }
        .op-box { border:1.5px solid #111; padding:14px 16px; }
        .op-box h3 { margin:0 0 8px; font-size:12px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
        .op-box ul { margin:0; padding-left:16px; font-size:13.5px; line-height:1.65; }
        .op-math { display:flex; gap:0; border:1.5px solid #111; }
        .op-math > div { flex:1; padding:12px 16px; }
        .op-math > div + div { border-left:1.5px solid #111; }
        .op-math .n { font-size:26px; font-weight:800; letter-spacing:-.02em; }
        .op-math .k { font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#555; }
        .op-foot { margin-top:auto; display:flex; justify-content:space-between; align-items:flex-end; gap:18px; border-top:3px solid #111; padding-top:14px; }
        .op-foot .who { font-size:13.5px; line-height:1.6; }
        .op-foot .who b { font-size:16px; }
        .op-qr { text-align:center; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#333; }
        .op-qr img { width:1.15in; height:1.15in; display:block; margin:0 auto 6px; }
        .op-free { background:#111; color:#fff; padding:12px 16px; font-size:15px; font-weight:700; }
        @media (max-width: 700px) { .op-cols { grid-template-columns:1fr; } .op-sheet { padding:24px 18px; min-height:0; } .op-math { flex-direction:column; } .op-math > div + div { border-left:0; border-top:1.5px solid #111; } .op-foot { flex-direction:column; align-items:flex-start; } .op-head { flex-direction:column; gap:8px; } .op-contact { text-align:left; } }
        @media print {
          .op-root { background:#fff; padding:0; }
          .op-toolbar { display:none; }
          .op-sheet { box-shadow:none; max-width:none; min-height:0; margin:0; padding:0; }
          .op-free { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
          @page { size: letter; margin: .5in; }
        }
      `}</style>

      <div className="op-toolbar">
        <span>RollReady one-pager. Prints on one sheet, black on white.</span>
        <PrintButton />
      </div>

      <div className="op-sheet">
        <div className="op-head">
          <div className="op-brand">RollReady<small>by SYNNR · Equipment test tracking · Permian Basin</small></div>
          <div className="op-contact">
            <b>Caden Cain</b>, founder<br />
            Call or text {OWNER_PHONE}
          </div>
        </div>

        <h1 className="op-h">An expired lubricator cert cost us $8,000 on a major&apos;s location.</h1>

        <p className="op-p">
          Nobody knew until the company man checked the paper and turned the crew around at the gate.
          RollReady keeps every piece of iron in your yard on one list, with its serial, which truck it&apos;s on, and when
          its next test is due, and emails the right person before anything lapses. If something does
          lapse, the truck it rides on reads NOT READY until the record is fixed.
        </p>

        <div className="op-cols">
          <div className="op-box">
            <h3>What it catches</h3>
            <ul>
              <li>BOP and lubricator tests, iron recerts (UT + hydro), annual DOT</li>
              <li>A QR tag on every piece: scan it, see its tests and cert</li>
              <li>A yard map: every truck and rack, and what&apos;s on it</li>
              <li>Load-out scans: proof of what actually went out on the truck</li>
              <li>A truck check with no override button</li>
              <li>A live proof link to send the operator instead of a binder</li>
            </ul>
          </div>
          <div className="op-box">
            <h3>The math</h3>
            <div style={{ fontSize: "13.5px", lineHeight: 1.65 }}>
              One lubricator miss is 16 months of RollReady. It&apos;s a flat price per yard and never
              per-seat, so adding people or iron costs nothing. No contract, cancel anytime, and your
              data stays yours.
            </div>
          </div>
        </div>

        <div className="op-math">
          <div><div className="n">$10,000+</div><div className="k">one missed cert, one NPT day</div></div>
          <div><div className="n">$500</div><div className="k">per yard / month, flat</div></div>
          <div><div className="n">16 months</div><div className="k">of RollReady for one lubricator miss</div></div>
        </div>

        <div className="op-free">Setup is free for the first 10 yards. I&apos;ll do it with you in one afternoon. Bring the binder.</div>

        <div className="op-foot">
          <div className="who">
            I ran wireline in the Permian for five years and built RollReady because nobody else had.
            Call or text me and I&apos;ll show you your own trucks in it.<br />
            <b>{OWNER_PHONE}</b> · synnr.io
          </div>
          <div className="op-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/qr-demo.svg" alt="QR code to the live demo at synnr.io/demo" />
            Scan → live demo<br />synnr.io/demo
          </div>
        </div>
      </div>
    </div>
  );
}
