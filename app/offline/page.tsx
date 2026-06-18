import "../marketing.css";

export const metadata = { title: "Offline — SYNNR" };

export default function Offline() {
  return (
    <div className="mkt">
      <main className="container" style={{ minHeight: "70vh", display: "grid", placeItems: "center", textAlign: "center" }}>
        <div style={{ maxWidth: 440 }}>
          <span className="eyebrow">Offline</span>
          <h1 className="h2" style={{ marginTop: 8 }}>You&apos;re offline.</h1>
          <p className="lede" style={{ marginInline: "auto" }}>
            TallyShot needs a signal to read a new sheet. Reconnect and it&apos;ll pick right back up — your reviewed
            tallies are saved.
          </p>
        </div>
      </main>
    </div>
  );
}
