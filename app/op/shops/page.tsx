import Link from "next/link";
import { requireOperator } from "@/lib/op/auth";
import { requireReadinessDb } from "@/lib/readiness/db";
import type { Shop } from "@/lib/readiness/types";

export const dynamic = "force-dynamic";

export default async function ShopsList() {
  await requireOperator();
  const db = requireReadinessDb();

  const { data, error } = await db
    .from("rd_shops")
    .select("id, code, name, primary_contact_name, billing_tier, timezone, created_at")
    .is("deleted_at", null)
    .order("name");

  const shops = (data ?? []) as Pick<Shop, "id" | "code" | "name" | "primary_contact_name" | "billing_tier" | "timezone" | "created_at">[];

  return (
    <>
      <div className="op-page-h">
        <div>
          <h1>Shops</h1>
          <div className="op-page-sub">Every shop you run readiness for.</div>
        </div>
        <Link className="op-btn op-btn-primary" href="/op/shops/new">+ New shop</Link>
      </div>

      {error ? <p className="op-form-err">{error.message}</p> : null}

      <div className="op-card" style={{ padding: 0 }}>
        <table className="op-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Tier</th>
              <th>Contact</th>
              <th>Timezone</th>
            </tr>
          </thead>
          <tbody>
            {shops.length === 0 ? (
              <tr><td className="op-table-empty" colSpan={5}>No shops yet. <Link href="/op/shops/new">Add your first</Link>.</td></tr>
            ) : (
              shops.map((s) => (
                <tr key={s.id}>
                  <td><span className="op-badge op-badge-mono">{s.code}</span></td>
                  <td><Link href={`/op/shops/${s.id}`}>{s.name}</Link></td>
                  <td className="op-muted">{s.billing_tier ?? "—"}</td>
                  <td className="op-muted">{s.primary_contact_name ?? "—"}</td>
                  <td className="op-faint mono">{s.timezone}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
