import { redirect } from "next/navigation";
import Link from "next/link";
import { requireOperator } from "@/lib/op/auth";
import { requireReadinessDb } from "@/lib/readiness/db";

export const dynamic = "force-dynamic";

async function createShop(formData: FormData) {
  "use server";
  const op = await requireOperator();
  const db = requireReadinessDb();

  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const primary_contact_name = String(formData.get("primary_contact_name") ?? "").trim() || null;
  const primary_contact_phone = String(formData.get("primary_contact_phone") ?? "").trim() || null;
  const billing_tier = String(formData.get("billing_tier") ?? "").trim() || null;
  const timezone = String(formData.get("timezone") ?? "").trim() || "America/Chicago";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!code || !name) throw new Error("Code and name are required.");
  if (!/^[A-Z0-9]{2,8}$/.test(code)) throw new Error("Code must be 2–8 uppercase letters/digits, e.g. ACE.");

  const { data, error } = await db
    .from("rd_shops")
    .insert({ code, name, primary_contact_name, primary_contact_phone, billing_tier, timezone, notes })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await db.from("rd_audit_log").insert({
    shop_id: (data as { id: string }).id,
    actor: op.email,
    action: "shop.create",
    entity_type: "rd_shops",
    entity_id: (data as { id: string }).id,
    payload: { code, name },
  });

  redirect(`/op/shops/${(data as { id: string }).id}`);
}

export default async function NewShopPage() {
  await requireOperator();
  return (
    <>
      <div className="op-page-h">
        <div>
          <h1>New shop</h1>
          <div className="op-page-sub">Add a shop after the readiness audit — code is the short prefix used in asset IDs (e.g. ACE → ACE-BOP-003).</div>
        </div>
        <Link className="op-btn op-btn-ghost" href="/op/shops">← Back</Link>
      </div>

      <form action={createShop} className="op-form">
        <div className="op-form-row">
          <label>
            Shop code
            <input name="code" required pattern="[A-Za-z0-9]{2,8}" placeholder="ACE" autoComplete="off" />
          </label>
          <label>
            Billing tier
            <select name="billing_tier" defaultValue="single_yard">
              <option value="single_yard">Single Yard</option>
              <option value="multi_crew">Multi-Crew</option>
              <option value="multi_yard">Multi-Yard</option>
            </select>
          </label>
        </div>

        <label>
          Shop name
          <input name="name" required placeholder="Ace Wireline Services" />
        </label>

        <div className="op-form-row">
          <label>
            Primary contact
            <input name="primary_contact_name" placeholder="John Smith" />
          </label>
          <label>
            Phone (E.164)
            <input name="primary_contact_phone" type="tel" placeholder="+14325551234" />
          </label>
        </div>

        <label>
          Timezone
          <select name="timezone" defaultValue="America/Chicago">
            <option value="America/Chicago">America/Chicago (Permian)</option>
            <option value="America/Denver">America/Denver</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="America/New_York">America/New_York</option>
          </select>
          <span className="op-form-help">Used for sending alerts at the right local hour (default 7am–7pm).</span>
        </label>

        <label>
          Notes
          <textarea name="notes" rows={3} placeholder="Anything you'd want to remember walking in." />
        </label>

        <div className="op-row">
          <button className="op-btn op-btn-primary" type="submit">Create shop</button>
          <Link className="op-btn op-btn-ghost" href="/op/shops">Cancel</Link>
        </div>
      </form>
    </>
  );
}
