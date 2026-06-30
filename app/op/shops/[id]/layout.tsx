import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperator } from "@/lib/op/auth";
import { requireReadinessDb } from "@/lib/readiness/db";
import ShopTabs from "./tabs";

export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireOperator();
  const { id } = await params;
  const db = requireReadinessDb();
  const { data } = await db
    .from("rd_shops")
    .select("id, code, name, billing_tier, primary_contact_name, primary_contact_phone, timezone")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) notFound();
  const shop = data as { id: string; code: string; name: string; billing_tier: string | null; primary_contact_name: string | null; primary_contact_phone: string | null; timezone: string };

  return (
    <>
      <div className="op-page-h">
        <div>
          <h1>
            <span className="op-badge op-badge-mono" style={{ marginRight: 10, verticalAlign: "middle" }}>{shop.code}</span>
            {shop.name}
          </h1>
          <div className="op-page-sub">
            {shop.billing_tier ?? "no tier"} · {shop.timezone}
            {shop.primary_contact_name ? <> · {shop.primary_contact_name}</> : null}
            {shop.primary_contact_phone ? <> · <span className="mono">{shop.primary_contact_phone}</span></> : null}
          </div>
        </div>
        <Link className="op-btn op-btn-ghost" href="/op/shops">← All shops</Link>
      </div>

      <ShopTabs shopId={shop.id} />

      {children}
    </>
  );
}
