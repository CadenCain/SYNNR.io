"use client";

import { useState } from "react";
import { getProduct, estimateMonthlyUsd, pricePerSeat, isSelfServe } from "@/lib/catalog";

const money = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CheckoutClient({ slug, initialSeats }: { slug: string; initialSeats: number }) {
  const product = getProduct(slug) ?? getProduct("tallyshot")!;
  const [seats, setSeats] = useState(Math.max(1, initialSeats));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const selfServe = isSelfServe(product, seats);
  const perSeat = pricePerSeat(product, seats);
  const est = estimateMonthlyUsd(product, seats, 0); // no usage at signup → no overage
  const monthly = est?.totalUsd ?? 0;
  const pooled = (product.pricing.includedQuotaPerSeat ?? 0) * seats;
  const trialDays = product.pricing.trialDays ?? 0;

  async function start() {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product: product.slug, seats }),
      });
      const d = await r.json();
      if (d.configured && d.url) { window.location.href = d.url; return; }
      if (d.contactSales) { setMsg("That's an enterprise seat count — contact us to set it up."); }
      else if (d.configured === false) setMsg("Checkout isn't connected yet (Stripe keys pending). Your config is ready — try again once billing is live.");
      else setMsg(d.error || "Couldn't start checkout — try again.");
    } catch { setMsg("Couldn't reach SYNNR — try again."); }
    setBusy(false);
  }

  return (
    <div className="co-card">
      <div className="co-head">
        <span className="eyebrow">{product.name} · 14-day free trial</span>
        <h1 className="h2">Start your free trial</h1>
        <p className="muted">Per seat — add a seat for every hand who&apos;ll use it. Volume discounts apply automatically. Cancel anytime.</p>
      </div>

      <div className="co-seats">
        <span>Seats</span>
        <div className="stepper">
          <button onClick={() => setSeats((s) => Math.max(1, s - 1))} disabled={seats <= 1} aria-label="Fewer seats">−</button>
          <input type="number" min={1} value={seats} onChange={(e) => setSeats(Math.max(1, Math.floor(Number(e.target.value) || 1)))} aria-label="Seat count" />
          <button onClick={() => setSeats((s) => s + 1)} aria-label="More seats">+</button>
        </div>
      </div>

      {selfServe && perSeat != null ? (
        <>
          <div className="co-lines">
            <div className="lrow"><span>{seats} seat{seats === 1 ? "" : "s"} × {money(perSeat)}/mo</span><b>{money(monthly)}/mo</b></div>
            <div className="lrow sub"><span>{pooled.toLocaleString()} sheets/mo pooled across your org</span><span>included</span></div>
            <div className="lrow sub"><span>Extra sheets beyond the pool</span><span>{money(product.pricing.overagePerUnitUsd ?? 0)} each</span></div>
            <div className="lrow total"><span>Due today</span><b>{money(0)}</b></div>
            <div className="lrow note"><span>Then {money(monthly)}/mo after your {trialDays}-day free trial.</span></div>
          </div>

          <button className="btn btn-primary co-go" onClick={start} disabled={busy}>
            {busy ? "Starting…" : `Start ${trialDays}-day free trial`}
          </button>
          <p className="co-fine">$0.00 due today. We&apos;ll remind you before the trial ends. Cancel anytime from your billing portal.</p>
        </>
      ) : (
        <div className="co-lines">
          <div className="lrow note"><span>{seats}+ seats is an enterprise plan — we&apos;ll tailor pricing with you.</span></div>
          <a className="btn btn-primary co-go" href={`mailto:cadencain@darkstarops.com?subject=SYNNR%20${product.name}%20(${seats}%20seats)`}>Contact sales</a>
        </div>
      )}

      {msg ? <p className="co-msg">{msg}</p> : null}
      <a className="co-back" href={`/apps/${product.slug}#pricing`}>← Back to pricing</a>
    </div>
  );
}
