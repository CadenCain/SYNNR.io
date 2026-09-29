import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";

/**
 * "Your data, exportable": one-click CSV of every test, cert, and truck
 * paper item with its yard, truck, equipment, and serial. RLS-scoped via the
 * caller's session, for the company they have open (not just their first).
 * Equipment only: crew cards aren't part of the product anymore.
 */
export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [{ data: items }, { data: units }, { data: assets }, { data: yards }] = await Promise.all([
    db.from("saas_compliance_items_with_status")
      .select("title, kind, status, issued_date, expiration_date, reminder_days, parent_type, parent_id")
      .eq("company_id", company.id).neq("parent_type", "crew"),
    db.from("saas_units").select("id, name, yard_id").eq("company_id", company.id),
    db.from("saas_assets").select("id, name, identifier, status, unit_id, yard_id").eq("company_id", company.id),
    db.from("saas_yards").select("id, name").eq("company_id", company.id),
  ]);

  const yardName = new Map(((yards ?? []) as { id: string; name: string }[]).map((y) => [y.id, y.name]));
  const unitRows = (units ?? []) as { id: string; name: string; yard_id: string }[];
  const unitName = new Map(unitRows.map((u) => [u.id, u.name]));
  const unitYard = new Map(unitRows.map((u) => [u.id, yardName.get(u.yard_id) ?? ""]));
  const assetInfo = new Map(((assets ?? []) as { id: string; name: string; identifier: string | null; status: string; unit_id: string | null; yard_id: string | null }[]).map((a) => [a.id, a]));

  type Row = { title: string; kind: string; status: string; issued_date: string | null; expiration_date: string | null; reminder_days: number; parent_type: string; parent_id: string };
  const header = ["yard", "truck", "equipment", "serial", "equipment_status", "item", "kind", "status", "issued", "expires", "reminder_days"];
  const lines = [header.join(",")];
  for (const i of ((items ?? []) as Row[])) {
    let yard = "", truck = "", equipment = "", serial = "", eqStatus = "";
    if (i.parent_type === "unit") {
      truck = unitName.get(i.parent_id) ?? "";
      yard = unitYard.get(i.parent_id) ?? "";
    } else {
      const a = assetInfo.get(i.parent_id);
      equipment = a?.name ?? "";
      serial = a?.identifier ?? "";
      eqStatus = a ? (a.status === "out_of_service" ? "red-tagged" : a.status.replace(/_/g, " ")) : "";
      truck = a?.unit_id ? unitName.get(a.unit_id) ?? "" : "";
      yard = a?.unit_id ? unitYard.get(a.unit_id) ?? "" : a?.yard_id ? yardName.get(a.yard_id) ?? "" : "";
    }
    lines.push([yard, truck, equipment, serial, eqStatus, i.title, i.kind, i.status, i.issued_date ?? "", i.expiration_date ?? "", i.reminder_days].map(esc).join(","));
  }

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="synnr-${company.name.replace(/[^a-zA-Z0-9-]/g, "_")}-${today}.csv"`,
    },
  });
}
