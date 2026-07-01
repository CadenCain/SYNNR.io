import { NextResponse } from "next/server";
import { getSaasUser, getFirstActiveCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

/**
 * "Your data, exportable" — one-click CSV of every compliance item with its
 * yard/unit/asset context. RLS-scoped via the caller's session.
 */
export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const user = await getSaasUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const company = await getFirstActiveCompany(user.id);
  if (!company) return NextResponse.json({ ok: false, error: "no company" }, { status: 400 });

  const db = await saasDb();
  const [{ data: items }, { data: units }, { data: assets }, { data: yards }] = await Promise.all([
    db.from("saas_compliance_items_with_status")
      .select("title, kind, status, issued_date, expiration_date, reminder_days, parent_type, parent_id")
      .eq("company_id", company.id),
    db.from("saas_units").select("id, name, yard_id").eq("company_id", company.id),
    db.from("saas_assets").select("id, name, unit_id, yard_id").eq("company_id", company.id),
    db.from("saas_yards").select("id, name").eq("company_id", company.id),
  ]);

  const yardName = new Map(((yards ?? []) as { id: string; name: string }[]).map((y) => [y.id, y.name]));
  const unitRows = (units ?? []) as { id: string; name: string; yard_id: string }[];
  const unitName = new Map(unitRows.map((u) => [u.id, u.name]));
  const unitYard = new Map(unitRows.map((u) => [u.id, yardName.get(u.yard_id) ?? ""]));
  const assetRows = (assets ?? []) as { id: string; name: string; unit_id: string | null; yard_id: string | null }[];
  const assetInfo = new Map(assetRows.map((a) => [a.id, a]));

  type Row = { title: string; kind: string; status: string; issued_date: string | null; expiration_date: string | null; reminder_days: number; parent_type: string; parent_id: string };
  const header = ["yard", "unit", "asset", "item", "kind", "status", "issued", "expires", "reminder_days"];
  const lines = [header.join(",")];
  for (const i of ((items ?? []) as Row[])) {
    let yard = "", unit = "", asset = "";
    if (i.parent_type === "unit") {
      unit = unitName.get(i.parent_id) ?? "";
      yard = unitYard.get(i.parent_id) ?? "";
    } else {
      const a = assetInfo.get(i.parent_id);
      asset = a?.name ?? "";
      unit = a?.unit_id ? unitName.get(a.unit_id) ?? "" : "";
      yard = a?.yard_id ? yardName.get(a.yard_id) ?? "" : a?.unit_id ? unitYard.get(a.unit_id) ?? "" : "";
    }
    lines.push([yard, unit, asset, i.title, i.kind, i.status, i.issued_date ?? "", i.expiration_date ?? "", i.reminder_days].map(esc).join(","));
  }

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="synnr-${company.name.replace(/[^a-zA-Z0-9-]/g, "_")}-${today}.csv"`,
    },
  });
}
