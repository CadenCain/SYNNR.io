import "../marketing.css";
import "../apps/apps.css";
import "../app/tallyshot/tallyshot.css";
import type { Metadata } from "next";
import { runTallySample } from "@/lib/tally";
import { SiteNav, SiteFooter } from "../site-chrome";

export const metadata: Metadata = {
  title: "TallyShot live demo — photo → clean Excel",
  description: "See TallyShot read a real casing tally sheet: parsed joints, per-10 subtotals, grand total, and every shaky digit flagged for review.",
};

const ft = (n: number | null) => (n == null ? "—" : `${n.toFixed(2)} ft`);

export default async function DemoPage() {
  const r = await runTallySample();

  return (
    <div className="mkt">
      <SiteNav />
      <main className="container apps-wrap">
        <div className="head" style={{ textAlign: "left", marginInline: 0 }}>
          <span className="eyebrow">TallyShot · live demo</span>
          <h1 className="h2">A real tally sheet, read by TallyShot</h1>
          <p className="lede" style={{ marginInline: 0 }}>
            This is a sample casing tally (MKS Sheet 3). TallyShot parsed every joint, applied the implied decimal,
            totaled it, and <b>flagged the digits it wasn&apos;t sure about</b> instead of guessing. Start a free trial to
            scan your own and export to Excel.
          </p>
        </div>

        <div className="ts">
          <div className="ts-summary">
            <div className="sc"><div className="n">{r.grandTotalFt}</div><div className="k">Grand total (trusted) ft</div></div>
            <div className="sc"><div className="n">{r.trustedCount}/{r.jointCount}</div><div className="k">Joints trusted</div></div>
            <div className="sc amber"><div className="n">{r.flaggedCount}</div><div className="k">Flagged</div></div>
            <div className={`sc ${r.crossCheck.pass ? "green" : "red"}`}><div className="n">{r.crossCheck.pass ? "PASS" : "FAIL"}</div><div className="k">Cross-check</div></div>
          </div>

          <div className="ts-flagbar">
            <b>{r.flaggedCount} flagged for review.</b> In the app you confirm or correct each in a tap — that&apos;s why the exported total is one you can trust.
          </div>

          <div className="ts-table">
            <div className="tr th"><span>No.</span><span>Read</span><span>Length</span><span>Status</span></div>
            {r.joints.map((j) => (
              <div key={j.joint} className={`tr ${j.trusted ? "" : j.flag === "RANGE" ? "flag" : "warn"}`}>
                <span className="mono">{j.joint}</span>
                <span className="mono">{j.raw}</span>
                <span className="mono">{ft(j.lengthFt)}</span>
                <span className="st ok">{j.trusted ? "Trusted" : j.flag === "RANGE" ? "Out of range — confirm" : "Low confidence — confirm"}</span>
              </div>
            ))}
          </div>

          <div className="ts-subs">
            {r.subtotals.map((s) => (
              <div key={s.from} className="sub"><span>Joints {s.from}–{s.to}</span><b className="mono">{s.ft} ft</b>{s.flagged ? <span className="fl">{s.flagged} flagged</span> : null}</div>
            ))}
          </div>

          <div className="appcard-foot" style={{ marginTop: 26 }}>
            <a className="btn btn-primary" href="/checkout?product=tallyshot&seats=1">Start free trial</a>
            <a className="btn btn-ghost" href="/apps/tallyshot">How TallyShot works</a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
