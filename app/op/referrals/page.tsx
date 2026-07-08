import { requireOperator } from "@/lib/op/auth";
import { saasAdmin } from "@/lib/saas/db";

export const dynamic = "force-dynamic";

/**
 * Referral payout lookup — which ref code brought in which customer, what
 * they're paying, and what 25% of it is. Deliberately plain: this is the
 * monthly payout worksheet, not a dashboard. Partner interest leads below.
 */
export default async function OpReferrals() {
  await requireOperator();
  const admin = saasAdmin();
  if (!admin) return <p>Admin client not configured.</p>;

  const [{ data: refData }, { data: leadData }] = await Promise.all([
    admin.from("saas_companies")
      .select("name, referred_by, subscription_status, yard_quantity, created_at")
      .not("referred_by", "is", null)
      .order("created_at", { ascending: false }),
    admin.from("partner_leads")
      .select("name, company, email, phone, note, created_at")
      .order("created_at", { ascending: false }).limit(50),
  ]);
  type RefRow = { name: string; referred_by: string; subscription_status: string; yard_quantity: number; created_at: string };
  type Lead = { name: string; company: string | null; email: string | null; phone: string | null; note: string | null; created_at: string };
  const refs = (refData ?? []) as RefRow[];
  const leads = (leadData ?? []) as Lead[];

  const active = refs.filter((r) => r.subscription_status === "active" || r.subscription_status === "past_due");
  const monthlyOwed = active.reduce((s, r) => s + Math.max(1, r.yard_quantity) * 500 * 0.25, 0);

  return (
    <>
      <div className="op-page-h">
        <div>
          <h1>Referrals</h1>
          <div className="op-page-sub">
            {refs.length} referred signup{refs.length === 1 ? "" : "s"} · {active.length} active ·
            ~${monthlyOwed.toLocaleString()}/mo owed at the founding 25% rate
          </div>
        </div>
      </div>

      <table className="op-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th align="left">Customer</th><th align="left">Ref code</th><th align="left">Status</th><th align="right">Yards</th><th align="right">25%/mo</th><th align="left">Signed up</th></tr></thead>
        <tbody>
          {refs.length === 0 ? (
            <tr><td colSpan={6} style={{ padding: 12, opacity: .6 }}>No referred signups yet. Referred companies land here automatically via their ?ref= link.</td></tr>
          ) : refs.map((r) => (
            <tr key={r.name + r.created_at}>
              <td style={{ padding: "8px 6px" }}>{r.name}</td>
              <td style={{ padding: "8px 6px", fontFamily: "monospace" }}>{r.referred_by}</td>
              <td style={{ padding: "8px 6px" }}>{r.subscription_status}</td>
              <td style={{ padding: "8px 6px" }} align="right">{r.yard_quantity}</td>
              <td style={{ padding: "8px 6px" }} align="right">
                {(r.subscription_status === "active" || r.subscription_status === "past_due")
                  ? `$${(Math.max(1, r.yard_quantity) * 125).toLocaleString()}` : "—"}
              </td>
              <td style={{ padding: "8px 6px" }}>{new Date(r.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="op-page-h" style={{ marginTop: 32 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>Partner interest</h1>
          <div className="op-page-sub">From the /partners form — call them back.</div>
        </div>
      </div>
      <table className="op-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th align="left">Name</th><th align="left">Company</th><th align="left">Contact</th><th align="left">Note</th><th align="left">When</th></tr></thead>
        <tbody>
          {leads.length === 0 ? (
            <tr><td colSpan={5} style={{ padding: 12, opacity: .6 }}>No partner leads yet.</td></tr>
          ) : leads.map((l, i) => (
            <tr key={i}>
              <td style={{ padding: "8px 6px" }}>{l.name}</td>
              <td style={{ padding: "8px 6px" }}>{l.company ?? "—"}</td>
              <td style={{ padding: "8px 6px" }}>{[l.phone, l.email].filter(Boolean).join(" · ") || "—"}</td>
              <td style={{ padding: "8px 6px", maxWidth: 300 }}>{l.note ?? "—"}</td>
              <td style={{ padding: "8px 6px" }}>{new Date(l.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
