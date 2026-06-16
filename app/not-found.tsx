import "./marketing.css";
import Link from "next/link";

/** Friendly 404 — keeps people in the product instead of dumping a bare error. */
export const metadata = { title: "Not found — SYNNR" };

export default function NotFound() {
  return (
    <div className="mkt">
      <main className="container" style={{ minHeight: "70vh", display: "grid", placeItems: "center", textAlign: "center" }}>
        <div style={{ maxWidth: 440 }}>
          <span className="eyebrow">404</span>
          <h1 className="h2" style={{ marginTop: 8 }}>That page isn&apos;t here.</h1>
          <p className="lede" style={{ marginInline: "auto" }}>
            The link may be old or the page moved. Head back and pick up where you left off.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/dashboard">Your apps</Link>
            <Link className="btn btn-ghost" href="/">Home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
