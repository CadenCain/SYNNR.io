import "../glossary.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GLOSSARY, termBySlug } from "@/lib/content/glossary";

export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = termBySlug(slug);
  if (!t) return {};
  return {
    title: `What is ${t.term}? — Field Operations Glossary | SYNNR`,
    description: t.def.slice(0, 155),
  };
}

const MARK = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1.4 14.6 9.4 22.6 12 14.6 14.6 12 22.6 9.4 14.6 1.4 12 9.4 9.4Z" />
  </svg>
);

export default async function GlossaryTermPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = termBySlug(slug);
  if (!t) notFound();

  const related = t.related.map(termBySlug).filter((x) => !!x);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: t.term,
    description: t.def,
    inDefinedTermSet: { "@type": "DefinedTermSet", name: "SYNNR Field Operations Glossary", url: "https://www.synnr.io/glossary" },
  };

  return (
    <div className="gls">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="wrap">
        <nav className="topnav">
          <Link className="brand" href="/">{MARK}<b>SYNNR</b></Link>
          <Link className="crumb" href="/glossary">Field-Ops Glossary</Link>
          <Link className="cta-sm" href="/ingest">Scan a sheet free</Link>
        </nav>

        <span className="chip">{t.category}</span>
        <h1>{t.term}</h1>
        <p className="def">{t.def}</p>

        <div className="why">
          <div className="wl">Why it matters before the job moves</div>
          <p>{t.why}</p>
        </div>

        {related.length > 0 && (
          <div className="rel">
            <div className="rl">Related terms</div>
            <div className="chips">
              {related.map((r) => (
                <Link key={r!.slug} href={`/glossary/${r!.slug}`}>{r!.term}</Link>
              ))}
            </div>
          </div>
        )}

        <div className="cta">
          <div>
            <b>Software for the boring operational stuff.</b>
            <span>SYNNR builds purpose-built software for oilfield service companies. Start with TallyShot — photograph a handwritten tally sheet, get clean Excel back.</span>
          </div>
          <Link className="go" href="/ingest">Scan a sheet free →</Link>
        </div>

        <Link className="back" href="/glossary">← All terms</Link>
      </div>
    </div>
  );
}
