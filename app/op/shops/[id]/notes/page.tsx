import { requireOperator } from "@/lib/op/auth";
import { requireReadinessDb } from "@/lib/readiness/db";

export const dynamic = "force-dynamic";

export default async function ShopNotes({ params }: { params: Promise<{ id: string }> }) {
  await requireOperator();
  const { id: shopId } = await params;
  const db = requireReadinessDb();

  const { data } = await db
    .from("rd_audit_log")
    .select("id, actor, action, entity_type, entity_id, payload, occurred_at")
    .eq("shop_id", shopId)
    .order("occurred_at", { ascending: false })
    .limit(200);
  const entries = (data ?? []) as { id: string; actor: string; action: string; entity_type: string | null; entity_id: string | null; payload: unknown; occurred_at: string }[];

  return (
    <div className="op-stack">
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Audit log</h2>
      <div className="op-card" style={{ padding: 0 }}>
        <table className="op-table">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
          <tbody>
            {entries.length === 0
              ? <tr><td colSpan={5} className="op-table-empty">Nothing logged yet.</td></tr>
              : entries.map(e => (
                <tr key={e.id}>
                  <td className="mono op-faint">{new Date(e.occurred_at).toLocaleString()}</td>
                  <td>{e.actor}</td>
                  <td><span className="op-badge op-badge-mono">{e.action}</span></td>
                  <td className="op-faint mono">{e.entity_type ?? "—"}</td>
                  <td className="op-muted mono" style={{ fontSize: 11.5 }}>{e.payload ? JSON.stringify(e.payload) : "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
