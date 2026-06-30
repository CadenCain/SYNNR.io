import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/op/auth";
import { requireReadinessDb } from "@/lib/readiness/db";

export const dynamic = "force-dynamic";

async function createAsset(formData: FormData) {
  "use server";
  const op = await requireOperator();
  const db = requireReadinessDb();

  const shop_id = String(formData.get("shop_id") ?? "");
  const asset_code = String(formData.get("asset_code") ?? "").trim();
  const asset_type = String(formData.get("asset_type") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const serial_number = String(formData.get("serial_number") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "in_yard");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!shop_id || !asset_code || !asset_type) throw new Error("Asset code and type are required.");

  const { data, error } = await db
    .from("rd_assets")
    .insert({ shop_id, asset_code, asset_type, description, serial_number, status, notes })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await db.from("rd_audit_log").insert({
    shop_id, actor: op.email, action: "asset.create",
    entity_type: "rd_assets", entity_id: (data as { id: string }).id,
    payload: { asset_code, asset_type },
  });

  redirect(`/op/shops/${shop_id}/assets/${(data as { id: string }).id}`);
}

export default async function NewAssetPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOperator();
  const { id: shopId } = await params;
  const db = requireReadinessDb();
  const { data: shopData } = await db.from("rd_shops").select("code").eq("id", shopId).maybeSingle();
  const codePrefix = (shopData as { code: string } | null)?.code ?? "";

  return (
    <>
      <div className="op-row" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600 }}>Add asset</h2>
        <div className="op-spacer" />
        <Link className="op-btn op-btn-ghost" href={`/op/shops/${shopId}/assets`}>← Back</Link>
      </div>

      <form action={createAsset} className="op-form">
        <input type="hidden" name="shop_id" value={shopId} />

        <div className="op-form-row">
          <label>
            Asset code
            <input name="asset_code" required defaultValue={codePrefix ? `${codePrefix}-` : ""} autoComplete="off" />
            <span className="op-form-help">Human-readable, unique per shop. e.g. {codePrefix}-BOP-003</span>
          </label>
          <label>
            Type
            <input name="asset_type" required list="asset-types" placeholder="BOP, tool, trailer…" autoComplete="off" />
            <datalist id="asset-types">
              <option value="BOP" />
              <option value="tool" />
              <option value="trailer" />
              <option value="truck" />
              <option value="frac iron" />
              <option value="pump" />
              <option value="wireline unit" />
            </datalist>
          </label>
        </div>

        <label>
          Description
          <input name="description" placeholder="What is this exactly?" />
        </label>

        <div className="op-form-row">
          <label>
            Serial number
            <input name="serial_number" autoComplete="off" />
          </label>
          <label>
            Status
            <select name="status" defaultValue="in_yard">
              <option value="in_yard">In yard</option>
              <option value="checked_out">Checked out</option>
              <option value="in_repair">In repair</option>
              <option value="retired">Retired</option>
            </select>
          </label>
        </div>

        <label>
          Notes
          <textarea name="notes" rows={3} />
        </label>

        <div className="op-row">
          <button className="op-btn op-btn-primary" type="submit">Create asset</button>
          <Link className="op-btn op-btn-ghost" href={`/op/shops/${shopId}/assets`}>Cancel</Link>
        </div>
      </form>
    </>
  );
}
