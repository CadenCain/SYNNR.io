import type { Extraction, EngineFinding } from "./schemas";

const money = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Deterministic detectors. The LLM extracted typed numbers; here code decides.
 * Each finding ships with side-by-side evidence so it's auditable.
 */
export function detect(x: Extraction): EngineFinding[] {
  const out: EngineFinding[] = [];
  const pb = new Map(x.pricebook.map((r) => [r.code, r]));
  const inv = new Map(x.invoice_lines.map((l) => [l.code, l]));

  // 1. Missed billables — performed more than billed
  for (const t of x.ticket_lines) {
    const il = inv.get(t.code);
    const billedQty = il?.qty ?? 0;
    if (t.qty <= billedQty) continue;
    const rate = pb.get(t.code)?.contract_rate_cents ?? il?.rate_cents ?? 0;
    const amount = Math.round((t.qty - billedQty) * rate);
    if (amount <= 0) continue;
    const unit = t.unit ?? pb.get(t.code)?.unit ?? "";
    out.push({
      type: "missed",
      title: `Unbilled ${t.label.toLowerCase()}`,
      subtitle: `Ticket vs invoice delta · ${t.qty - billedQty} ${unit}`.trim(),
      amount_cents: amount,
      blocker: null,
      evidence: [
        { label: "Field ticket", ok: true, detail: `${t.qty} ${unit} performed`.trim() },
        { label: "Invoice as drafted", ok: false, detail: `${billedQty} ${unit} billed`.trim() },
      ],
    });
  }

  // 2. Rate below contract / MSA
  for (const il of x.invoice_lines) {
    if (il.rate_cents <= 0) continue;
    const rule = pb.get(il.code);
    if (!rule || rule.contract_rate_cents <= il.rate_cents) continue;
    const qty = il.qty || 1;
    const amount = Math.round((rule.contract_rate_cents - il.rate_cents) * qty);
    if (amount <= 0) continue;
    const unit = il.unit ?? rule.unit ?? "";
    out.push({
      type: "rate",
      title: `${il.label} billed below MSA`,
      subtitle: `Contract rate mismatch`,
      amount_cents: amount,
      blocker: null,
      evidence: [
        { label: "Billed rate", ok: false, detail: `${money(il.rate_cents)} / ${unit} × ${qty}`.trim() },
        { label: "Contract rate (MSA)", ok: true, detail: `${money(rule.contract_rate_cents)} / ${unit} × ${qty}`.trim() },
      ],
    });
  }

  // 3. Documentation blockers (hold billing, no dollar claim until resolved)
  if (x.photos_required > x.photos_attached) {
    out.push({
      type: "doc",
      title: "Missing field photos",
      subtitle: `${x.photos_attached} of ${x.photos_required} backup images attached`,
      amount_cents: 0,
      blocker: "backup",
      evidence: [],
    });
  }
  if (!x.signature_present) {
    out.push({
      type: "doc",
      title: "Unsigned service ticket",
      subtitle: "Customer sign-off pending",
      amount_cents: 0,
      blocker: "sign",
      evidence: [],
    });
  }

  return out;
}
