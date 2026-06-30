import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/op/auth";
import { requireReadinessDb } from "@/lib/readiness/db";
import { sweepExpirations } from "@/lib/readiness/sweep";
import OutboundRow from "./outbound-row";

export const dynamic = "force-dynamic";

async function runSweepNow() {
  "use server";
  const op = await requireOperator();
  const db = requireReadinessDb();
  const result = await sweepExpirations(db);
  await db.from("rd_audit_log").insert({
    actor: op.email, action: "sweep.manual", payload: result,
  });
  revalidatePath("/op/outbound");
}

async function markSent(formData: FormData) {
  "use server";
  const op = await requireOperator();
  const db = requireReadinessDb();
  const id = String(formData.get("id") ?? "");
  const shop_id = String(formData.get("shop_id") ?? "");
  if (!id) return;

  await db.from("rd_alerts")
    .update({ status: "sent", sent_at: new Date().toISOString(), sent_by: `operator:${op.email}` })
    .eq("id", id)
    .eq("status", "pending"); // idempotent — don't unmark dismissed ones

  // Mirror the outbound into the shop_messages thread so it shows up in
  // history. We don't have a Twilio SID since this was sent from your phone.
  const { data: alert } = await db
    .from("rd_alerts").select("shop_id, to_phone, message")
    .eq("id", id).maybeSingle();
  if (alert) {
    const a = alert as { shop_id: string; to_phone: string | null; message: string };
    if (a.to_phone) {
      await db.from("rd_shop_messages").insert({
        shop_id: a.shop_id, direction: "outbound", phone: a.to_phone, body: a.message, alert_id: id,
      });
    }
  }

  await db.from("rd_audit_log").insert({
    shop_id: shop_id || null, actor: op.email, action: "alert.mark_sent",
    entity_type: "rd_alerts", entity_id: id,
  });
  revalidatePath("/op/outbound");
}

async function dismiss(formData: FormData) {
  "use server";
  const op = await requireOperator();
  const db = requireReadinessDb();
  const id = String(formData.get("id") ?? "");
  const shop_id = String(formData.get("shop_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;

  await db.from("rd_alerts")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString(), dismissed_reason: reason })
    .eq("id", id)
    .eq("status", "pending");

  await db.from("rd_audit_log").insert({
    shop_id: shop_id || null, actor: op.email, action: "alert.dismiss",
    entity_type: "rd_alerts", entity_id: id, payload: { reason },
  });
  revalidatePath("/op/outbound");
}

interface Row {
  id: string;
  shop_id: string;
  alert_type: string;
  due_at: string | null;
  to_phone: string | null;
  message: string;
  generated_at: string;
  rd_shops: { id: string; code: string; name: string } | { id: string; code: string; name: string }[];
}

export default async function OutboundPage() {
  await requireOperator();
  const db = requireReadinessDb();
  const { data } = await db
    .from("rd_alerts")
    .select(`
      id, shop_id, alert_type, due_at, to_phone, message, generated_at,
      rd_shops!inner ( id, code, name )
    `)
    .eq("status", "pending")
    .order("due_at", { ascending: true, nullsFirst: false });

  const rows = (data ?? []).map((r) => {
    const s = (r as unknown as Row).rd_shops;
    return { ...(r as unknown as Row), rd_shops: Array.isArray(s) ? s[0] : s };
  }) as (Omit<Row, "rd_shops"> & { rd_shops: { id: string; code: string; name: string } })[];

  // Group by shop so you can run one shop at a time.
  const byShop = new Map<string, typeof rows>();
  for (const r of rows) {
    const arr = byShop.get(r.shop_id) ?? [];
    arr.push(r);
    byShop.set(r.shop_id, arr);
  }
  const groups = Array.from(byShop.values());

  return (
    <>
      <div className="op-page-h">
        <div>
          <h1>Today&apos;s outbound</h1>
          <div className="op-page-sub">Pending alerts the daily sweep has generated. Send the text, then click Mark sent.</div>
        </div>
        <form action={runSweepNow}>
          <button className="op-btn" type="submit">↻ Run sweep now</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="op-card op-muted" style={{ textAlign: "center", padding: 40 }}>
          Nothing to send right now. The daily sweep runs at 6am Central — or hit <b>Run sweep now</b> above.
        </div>
      ) : (
        <div className="op-stack">
          {groups.map((group) => {
            const shop = group[0].rd_shops;
            return (
              <div key={shop.id} className="op-card" style={{ padding: 0 }}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--op-line)", display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="op-badge op-badge-mono">{shop.code}</span>
                  <Link href={`/op/shops/${shop.id}`} style={{ fontWeight: 600 }}>{shop.name}</Link>
                  <span className="op-faint">·</span>
                  <span className="op-faint">{group.length} pending</span>
                </div>
                <table className="op-table">
                  <thead><tr><th>Due</th><th>To</th><th>Message</th><th></th></tr></thead>
                  <tbody>
                    {group.map((r) => (
                      <OutboundRow
                        key={r.id}
                        id={r.id}
                        shopId={shop.id}
                        due_at={r.due_at}
                        to_phone={r.to_phone}
                        message={r.message}
                        markSent={markSent}
                        dismiss={dismiss}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
