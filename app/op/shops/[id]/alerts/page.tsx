import Link from "next/link";
import { requireOperator } from "@/lib/op/auth";
import { requireReadinessDb } from "@/lib/readiness/db";
import type { AlertStatus, AlertType } from "@/lib/readiness/types";

export const dynamic = "force-dynamic";

export default async function ShopAlerts({ params }: { params: Promise<{ id: string }> }) {
  await requireOperator();
  const { id: shopId } = await params;
  const db = requireReadinessDb();

  const { data } = await db
    .from("rd_alerts")
    .select("id, alert_type, due_at, message, status, generated_at, sent_at, to_phone")
    .eq("shop_id", shopId)
    .order("generated_at", { ascending: false })
    .limit(100);
  const alerts = (data ?? []) as { id: string; alert_type: AlertType; due_at: string | null; message: string; status: AlertStatus; generated_at: string; sent_at: string | null; to_phone: string | null }[];

  return (
    <div className="op-stack">
      <div className="op-row">
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Recent alerts</h2>
        <div className="op-spacer" />
        <Link className="op-btn" href="/op/outbound">Today&apos;s outbound →</Link>
      </div>
      <div className="op-card" style={{ padding: 0 }}>
        <table className="op-table">
          <thead><tr><th>When</th><th>Type</th><th>Due</th><th>Status</th><th>Message</th></tr></thead>
          <tbody>
            {alerts.length === 0
              ? <tr><td colSpan={5} className="op-table-empty">No alerts yet. The daily sweep populates this.</td></tr>
              : alerts.map(a => (
                <tr key={a.id}>
                  <td className="mono op-faint">{new Date(a.generated_at).toLocaleString()}</td>
                  <td>{a.alert_type}</td>
                  <td className="mono">{a.due_at ?? "—"}</td>
                  <td><span className={`op-badge ${a.status === "pending" ? "op-badge-warn" : a.status === "sent" ? "op-badge-good" : ""}`}>{a.status}</span></td>
                  <td className="op-muted">{a.message}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
