import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOperator } from "@/lib/op/auth";
import { requireReadinessDb } from "@/lib/readiness/db";
import { certHealth } from "@/lib/readiness/cert-health";

export const dynamic = "force-dynamic";

async function addCert(formData: FormData) {
  "use server";
  const op = await requireOperator();
  const db = requireReadinessDb();

  const asset_id = String(formData.get("asset_id") ?? "");
  const shop_id = String(formData.get("shop_id") ?? "");
  const cert_type = String(formData.get("cert_type") ?? "").trim();
  const issued_at = String(formData.get("issued_at") ?? "").trim() || null;
  const expires_at = String(formData.get("expires_at") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!asset_id || !cert_type) throw new Error("Asset and cert type are required.");

  const { data, error } = await db
    .from("rd_asset_certs")
    .insert({ asset_id, cert_type, issued_at, expires_at, notes })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await db.from("rd_audit_log").insert({
    shop_id, actor: op.email, action: "cert.create",
    entity_type: "rd_asset_certs", entity_id: (data as { id: string }).id,
    payload: { cert_type, issued_at, expires_at },
  });

  revalidatePath(`/op/shops/${shop_id}/assets/${asset_id}`);
}

async function deleteCert(formData: FormData) {
  "use server";
  const op = await requireOperator();
  const db = requireReadinessDb();
  const id = String(formData.get("id") ?? "");
  const shop_id = String(formData.get("shop_id") ?? "");
  const asset_id = String(formData.get("asset_id") ?? "");

  await db.from("rd_asset_certs").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  await db.from("rd_audit_log").insert({
    shop_id, actor: op.email, action: "cert.delete",
    entity_type: "rd_asset_certs", entity_id: id, payload: {},
  });
  revalidatePath(`/op/shops/${shop_id}/assets/${asset_id}`);
}

async function reconcile(formData: FormData) {
  "use server";
  const op = await requireOperator();
  const db = requireReadinessDb();
  const id = String(formData.get("asset_id") ?? "");
  const shop_id = String(formData.get("shop_id") ?? "");
  await db.from("rd_assets").update({ last_reconciled_at: new Date().toISOString() }).eq("id", id);
  await db.from("rd_audit_log").insert({
    shop_id, actor: op.email, action: "asset.reconcile",
    entity_type: "rd_assets", entity_id: id, payload: {},
  });
  revalidatePath(`/op/shops/${shop_id}/assets/${id}`);
}

export default async function AssetDetail({ params }: { params: Promise<{ id: string; assetId: string }> }) {
  await requireOperator();
  const { id: shopId, assetId } = await params;
  const db = requireReadinessDb();

  const { data: asset } = await db
    .from("rd_assets")
    .select("*")
    .eq("id", assetId)
    .eq("shop_id", shopId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!asset) notFound();

  const { data: certData } = await db
    .from("rd_asset_certs")
    .select("id, cert_type, issued_at, expires_at, notes, created_at")
    .eq("asset_id", assetId)
    .is("deleted_at", null)
    .order("expires_at", { ascending: true, nullsFirst: false });
  const certs = (certData ?? []) as { id: string; cert_type: string; issued_at: string | null; expires_at: string | null; notes: string | null; created_at: string }[];

  const a = asset as { id: string; asset_code: string; asset_type: string; description: string | null; status: string; serial_number: string | null; last_reconciled_at: string | null; notes: string | null };

  return (
    <div className="op-stack">
      <div className="op-row">
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>
          <span className="mono">{a.asset_code}</span> <span className="op-faint">· {a.asset_type}</span>
        </h2>
        <div className="op-spacer" />
        <Link className="op-btn op-btn-ghost" href={`/op/shops/${shopId}/assets`}>← All assets</Link>
      </div>

      <div className="op-card-grid">
        <div className="op-card">
          <div className="op-card-title">Status</div>
          <div className="op-stat" style={{ fontSize: 18, textTransform: "capitalize" }}>{a.status.replace("_", " ")}</div>
        </div>
        <div className="op-card">
          <div className="op-card-title">Serial</div>
          <div className="mono" style={{ fontSize: 14 }}>{a.serial_number ?? "—"}</div>
        </div>
        <div className="op-card">
          <div className="op-card-title">Last reconciled</div>
          <div style={{ fontSize: 14 }}>{a.last_reconciled_at ? new Date(a.last_reconciled_at).toLocaleDateString() : <span className="op-faint">never</span>}</div>
          <form action={reconcile} style={{ marginTop: 8 }}>
            <input type="hidden" name="asset_id" value={a.id} />
            <input type="hidden" name="shop_id" value={shopId} />
            <button className="op-btn op-btn-sm" type="submit">Mark reconciled today</button>
          </form>
        </div>
      </div>

      {a.description ? <div className="op-card"><div className="op-card-title">Description</div>{a.description}</div> : null}
      {a.notes ? <div className="op-card"><div className="op-card-title">Notes</div>{a.notes}</div> : null}

      <div className="op-card" style={{ padding: 0 }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--op-line)" }}>
          <div className="op-card-title" style={{ margin: 0 }}>Certs &amp; inspections</div>
        </div>
        <table className="op-table">
          <thead>
            <tr><th>Type</th><th>Issued</th><th>Expires</th><th>Health</th><th></th></tr>
          </thead>
          <tbody>
            {certs.length === 0 ? (
              <tr><td className="op-table-empty" colSpan={5}>No certs yet — add the first one below.</td></tr>
            ) : (
              certs.map((c) => {
                const h = c.expires_at ? certHealth(c.expires_at) : null;
                return (
                  <tr key={c.id}>
                    <td>{c.cert_type}</td>
                    <td className="mono op-muted">{c.issued_at ?? "—"}</td>
                    <td className="mono">{c.expires_at ?? "—"}</td>
                    <td>{h ? <span className={h.className}>{h.label}</span> : <span className="op-faint">—</span>}</td>
                    <td style={{ textAlign: "right" }}>
                      <form action={deleteCert}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="asset_id" value={a.id} />
                        <input type="hidden" name="shop_id" value={shopId} />
                        <button className="op-btn op-btn-sm op-btn-danger" type="submit">Delete</button>
                      </form>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <div style={{ padding: "16px 18px", borderTop: "1px solid var(--op-line)" }}>
          <form action={addCert} className="op-form" style={{ maxWidth: "none" }}>
            <input type="hidden" name="asset_id" value={a.id} />
            <input type="hidden" name="shop_id" value={shopId} />
            <div className="op-form-row" style={{ gridTemplateColumns: "1.4fr 1fr 1fr" }}>
              <label>
                Cert type
                <input name="cert_type" required list="cert-types" placeholder="BOP test, DOT inspection…" autoComplete="off" />
                <datalist id="cert-types">
                  <option value="BOP test" />
                  <option value="DOT inspection" />
                  <option value="hydro test" />
                  <option value="API 6A" />
                  <option value="annual inspection" />
                </datalist>
              </label>
              <label>Issued<input type="date" name="issued_at" /></label>
              <label>Expires<input type="date" name="expires_at" /></label>
            </div>
            <label>Notes<input name="notes" /></label>
            <div><button className="op-btn op-btn-primary op-btn-sm" type="submit">+ Add cert</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}
