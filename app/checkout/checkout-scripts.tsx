"use client";

import { useEffect } from "react";

/**
 * Checkout interactions, ported from the prototype's inline script: plan-aware
 * summary (from ?plan=), card-number/expiry/CVC formatting + brand detection,
 * validation, and the processing -> confirmed -> success overlay flow.
 */
export default function CheckoutScripts() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".co");
    if (!root) return;
    const q = (id: string) => root.querySelector<HTMLElement>("#" + id);

    const PLANS: Record<string, { name: string; desc: string; price: number }> = {
      pro: { name: "SYNNR Pro", desc: "Recurring field jobs · readiness core", price: 499 },
      growth: { name: "SYNNR Growth", desc: "Multi-crew · full readiness suite", price: 999 },
    };
    // legacy keys from old links map onto the current tiers
    const ALIASES: Record<string, string> = { recover: "pro", command: "growth" };
    const rawKey = new URLSearchParams(window.location.search).get("plan") || "";
    const planKey = ALIASES[rawKey] ?? rawKey;
    const plan = PLANS[planKey] || PLANS.growth;
    const money = (n: number) =>
      "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const setText = (id: string, v: string) => {
      const el = q(id);
      if (el) el.textContent = v;
    };
    setText("planName", plan.name);
    setText("priceBig", money(plan.price));
    setText("liName", plan.name);
    setText("liDesc", plan.desc);
    setText("liPrice", money(plan.price));
    setText("subtotal", money(plan.price));
    setText("total", money(plan.price));
    setText("btnAmt", money(plan.price));
    setText("doneName", plan.name);
    setText("doneAmt", money(plan.price) + " / mo");

    const num = q("cardNum") as HTMLInputElement | null;
    const exp = q("cardExp") as HTMLInputElement | null;
    const cvc = q("cardCvc") as HTMLInputElement | null;
    const tag = q("brandTag");
    const box = q("cardbox");
    const brandOf = (d: string) => {
      if (/^4/.test(d)) return "VISA";
      if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "MASTERCARD";
      if (/^3[47]/.test(d)) return "AMEX";
      if (/^6/.test(d)) return "DISCOVER";
      return "";
    };
    if (num)
      num.addEventListener("input", () => {
        const d = num.value.replace(/\D/g, "").slice(0, 16);
        num.value = d.replace(/(.{4})/g, "$1 ").trim();
        if (tag) tag.textContent = brandOf(d);
      });
    if (exp)
      exp.addEventListener("input", () => {
        let d = exp.value.replace(/\D/g, "").slice(0, 4);
        if (d.length >= 3) d = d.slice(0, 2) + " / " + d.slice(2);
        else if (d.length === 2) d = d + " / ";
        exp.value = d;
      });
    if (cvc)
      cvc.addEventListener("input", () => {
        cvc.value = cvc.value.replace(/\D/g, "").slice(0, 4);
      });
    [num, exp, cvc].forEach((i) => {
      if (!i || !box) return;
      i.addEventListener("focus", () => box.classList.add("focus"));
      i.addEventListener("blur", () => box.classList.remove("focus"));
    });

    const btn = q("payBtn") as HTMLButtonElement | null;
    const err = q("err");
    if (btn) {
      const planForCheckout = planKey === "pro" ? "pro" : "growth";

      const runDemo = () => {
        if (err) err.textContent = "";
        const email = (q("email") as HTMLInputElement)?.value.trim() || "";
        const digits = num?.value.replace(/\s/g, "") || "";
        const cardName = (q("cardName") as HTMLInputElement)?.value.trim() || "";
        if (!/\S+@\S+\.\S+/.test(email)) { if (err) err.textContent = "Enter a valid email address."; return; }
        if (digits.length < 15) { if (err) err.textContent = "Enter a complete card number."; return; }
        if ((exp?.value.replace(/\D/g, "").length || 0) < 4) { if (err) err.textContent = "Enter the card expiry."; return; }
        if ((cvc?.value.length || 0) < 3) { if (err) err.textContent = "Enter the card CVC."; return; }
        if (!cardName) { if (err) err.textContent = "Enter the name on the card."; return; }
        btn.disabled = true;
        btn.innerHTML = '<span class="spin"></span>Processing…';
        window.setTimeout(() => {
          btn.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6 9 17l-5-5"/></svg>Confirmed';
          window.setTimeout(() => q("doneOverlay")?.classList.add("on"), 450);
        }, 1700);
      };

      btn.addEventListener("click", async () => {
        if (err) err.textContent = "";
        const prev = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="spin"></span>Processing…';
        // Real Stripe hosted checkout when configured; otherwise demo flow.
        try {
          const res = await fetch("/api/checkout/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plan: planForCheckout }),
          });
          const data = await res.json();
          if (data?.configured && data?.url) {
            window.location.href = data.url;
            return;
          }
        } catch {
          /* fall through to demo */
        }
        btn.disabled = false;
        btn.innerHTML = prev;
        runDemo();
      });
    }
  }, []);

  return null;
}
