import "../../marketing.css";
import "../apps.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRODUCTS, getProduct } from "@/lib/catalog";
import { SiteNav, SiteFooter } from "../../site-chrome";
import WaitlistForm from "../waitlist-form";

// /apps/tallyshot has its own bespoke route; this handles the rest.
export function generateStaticParams() {
  return PRODUCTS.filter((p) => p.slug !== "tallyshot").map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) return { title: "App — SYNNR" };
  return { title: `${p.name} — ${p.tagline}`, description: p.problem ?? p.tagline };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) notFound();

  return (
    <div className="mkt">
      <SiteNav />
      <main>
        <section className="section container product-hero">
          <span className="pill-badge"><span className="d" />{p.name} · {p.status === "live" ? "live now" : "coming soon"}</span>
          <h1 className="display">{p.name}</h1>
          <p className="lede">{p.tagline}</p>
          {p.status === "live" ? (
            <div className="hero-cta">
              <a className="btn btn-primary" href={`/app/${p.slug}`}>Open app</a>
            </div>
          ) : (
            <div style={{ maxWidth: 420, marginInline: "auto", marginTop: 24 }}>
              <WaitlistForm slug={p.slug} name={p.name} />
              <p className="mono micro">Join the waitlist — we&apos;ll email you the day it ships.</p>
            </div>
          )}
        </section>

        {p.problem ? (
          <section className="section container">
            <div className="head">
              <span className="eyebrow">The problem</span>
              <h2 className="h2">Why this needs to exist</h2>
              <p className="lede">{p.problem}</p>
            </div>
            {p.bullets?.length ? (
              <ul className="pricing-incl" style={{ maxWidth: 560 }}>
                {p.bullets.map((b) => (
                  <li key={b}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}><path d="M20 6 9 17l-5-5" /></svg>
                    {b}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        <section className="section container" style={{ textAlign: "center" }}>
          <p className="apps-note" style={{ marginTop: 0 }}>
            Part of the SYNNR suite — one login, one bill. <a href="/apps">See all apps</a> · <a href="/apps/tallyshot">TallyShot is live now</a>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
