import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "../../marketing.css";
import { TOOLS, getTool } from "../tools";

// One template, four tools — the per-buyer product page. Same anatomy as the
// vertical-SaaS pages that provably sell in this market: hero with the one
// question, a named-feature grid, cross-sell to the sibling tools, one CTA.
// Copy comes from app/products/tools.ts, which is audited against
// CAPABILITIES.md — do not add claims here directly.

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return {
    title: `${tool.name} — ${tool.question}`,
    description: `${tool.lede} $500 per yard per month, all four SYNNR tools included.`,
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();
  const siblings = TOOLS.filter((t) => t.slug !== tool.slug);

  return (
    <div className="mkt">
      <header className="nav" id="nav">
        <div className="nav-pill">
          <Link className="brand" href="/" aria-label="SYNNR">
            <svg className="mark" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M16 1.6 19.2 12.8 30.4 16 19.2 19.2 16 30.4 12.8 19.2 1.6 16 12.8 12.8Z" fill="#ece5d7" />
            </svg>
            <span className="wordmark">SYNNR</span>
            <span className="by-synnr">yard operations</span>
          </Link>
          <nav className="nav-links">
            <a href="/#products">Products</a>
            <a href="/#how">How it works</a>
            <a href="/#pricing">Pricing</a>
          </nav>
          <div className="nav-cta">
            <Link href="/login" className="nav-login">Log in</Link>
            <Link href="/signup" className="btn btn-primary btn-sm">Get started</Link>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero — the one question this tool answers */}
        <section className="band hero">
          <div className="container">
            <div className="hero-main">
              <span className="eyebrow">{tool.name} · {tool.question}</span>
              <h1 className="display"><span className="lt">{tool.hero.split(". ")[0]}.</span>{tool.hero.includes(". ") ? <><br /><span className="dim">{tool.hero.split(". ").slice(1).join(" ")}</span></> : null}</h1>
              <p className="lede">{tool.lede}</p>
              <div className="hero-cta">
                <Link href="/signup" className="btn btn-primary">Get started
                  <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Link>
                <a href="/#pricing" className="btn btn-ghost">$500 / yard / month</a>
              </div>
            </div>
            <div className="hero-foot">
              <p className="fineprint">{tool.who} All four SYNNR tools come with the account — this one is just the door you walk in through.</p>
            </div>
          </div>
        </section>

        {/* Feature grid — named capabilities, one line each */}
        <section className="band band-light section">
          <div className="container">
            <div className="shead">
              <span className="eyebrow">What it does</span>
              <h2 className="h2">{tool.question}</h2>
            </div>
            <div className="prod-grid">
              {tool.features.map((f) => (
                <div key={f.name} className="prod-card">
                  <p className="prod-what">{f.name}</p>
                  <p className="prod-desc">{f.desc}</p>
                </div>
              ))}
            </div>
            <p className="prod-note">{tool.crossSell}</p>
          </div>
        </section>

        {/* Cross-sell — the sibling tools */}
        <section className="band section">
          <div className="container">
            <div className="shead">
              <span className="eyebrow">Same engine</span>
              <h2 className="h2">It doesn&apos;t work alone.</h2>
              <p className="lede">One system underneath, so nothing gets typed twice. The other three are already on your account.</p>
            </div>
            <div className="prod-grid">
              {siblings.map((s) => (
                <Link key={s.slug} href={`/products/${s.slug}`} className="prod-card" style={{ textDecoration: "none" }}>
                  <span className="prod-name">SYNNR <b>{s.name.replace("SYNNR ", "")}</b></span>
                  <p className="prod-what">{s.question}</p>
                  <p className="prod-who"><b>For</b> {s.who.charAt(0).toLowerCase() + s.who.slice(1)}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="band band-light section final">
          <div className="container">
            <div className="shead">
              <h2 className="h2">One number. Per yard.</h2>
              <p className="lede">$500 a month covers the yard — every truck, every hand, every tool on this page. Never per seat. Cancel anytime, export everything.</p>
              <div className="hero-cta">
                <Link href="/signup" className="btn btn-primary">Get started</Link>
                <Link href="/readiness-audit" className="btn btn-ghost">Free readiness map</Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
