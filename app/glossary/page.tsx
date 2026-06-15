import "./glossary.css";
import Link from "next/link";
import { GLOSSARY, GLOSSARY_CATEGORIES } from "@/lib/content/glossary";

export const metadata = {
  title: "Field Operations Glossary — Tickets, Certs, Loadouts & Billing | SYNNR",
  description:
    "Plain-English definitions of field-service operations terms — field tickets, MSAs, standby time, invoice backup, H2S certs, loadouts — and why each one matters before a job moves forward.",
};

const MARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" />
  </svg>
);

export default function GlossaryIndex() {
  return (
    <div className="gls">
      <div className="wrap">
        <nav className="topnav">
          <Link className="brand" href="/">{MARK}<b>SYNNR</b></Link>
          <span className="crumb">Field-Ops Glossary</span>
          <Link className="cta-sm" href="/#audit">Request an Operations Audit</Link>
        </nav>

        <div className="eyebrow">The language of job readiness</div>
        <h1>Field operations glossary</h1>
        <p className="lede">
          Plain-English definitions for the terms that decide whether a job rolls, gets done,
          and gets paid — written for service companies with crews, trucks, tools, and job packets.
          Every entry ends with the part that matters: what it costs you when it&rsquo;s missed.
        </p>

        {GLOSSARY_CATEGORIES.map((cat) => (
          <section key={cat}>
            <h2 className="cat">{cat}</h2>
            <div className="grid">
              {GLOSSARY.filter((t) => t.category === cat).map((t) => (
                <Link key={t.slug} className="tcard" href={`/glossary/${t.slug}`}>
                  <b>{t.term}</b>
                  <p>{t.def}</p>
                  <span className="rd">Read definition →</span>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <div className="cta">
          <div>
            <b>We build the system that checks all of this.</b>
            <span>Custom operating systems for oilfield service companies — built on your cloud, owned by you. It starts with an Operations Audit.</span>
          </div>
          <Link className="go" href="/#audit">Request an Operations Audit →</Link>
        </div>
      </div>
    </div>
  );
}
