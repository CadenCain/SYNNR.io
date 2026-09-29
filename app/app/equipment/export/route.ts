import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/saas/auth";
import { saasDb } from "@/lib/saas/db";
import { getEquipment, stateLabel } from "@/lib/saas/equipment";
import { categoryLabel } from "@/lib/saas/taxonomy";
import { judgeItem } from "@/lib/saas/judge";
import { localToday } from "@/lib/saas/status";

/**
 * The equipment list as a spreadsheet: one row per test or cert, soonest
 * due first, with the iron's serial and where it is. The "what's coming due"
 * report a shop hands the test company. Iron with nothing tracked still gets
 * a row so it can't hide.
 */
export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const { company } = await requireCompany();
  const db = await saasDb();
  const [list, { data: itemData }] = await Promise.all([
    getEquipment(db, company.id),
    db.from("saas_compliance_items")
      .select("id, title, issued_date, expiration_date, reminder_days, pending_until, parent_id")
      .eq("company_id", company.id).eq("parent_type", "asset"),
  ]);
  type I = { id: string; title: string; issued_date: string | null; expiration_date: string | null; reminder_days: number | null; pending_until: string | null; parent_id: string };
  const items = (itemData ?? []) as I[];
  const today = localToday();

  const header = ["Equipment", "Type", "Serial", "Where", "Equipment status", "Test or cert", "Last done", "Due", "Result"];
  const rows: { due: string; cells: unknown[] }[] = [];
  for (const r of list.rows) {
    if (r.state === "retired") continue;
    const mine = items.filter((i) => i.parent_id === r.id);
    const base = [r.name, categoryLabel(r.category), r.identifier ?? "", r.where, stateLabel(r)];
    if (mine.length === 0) {
      rows.push({ due: "", cells: [...base, "", "", "", "Nothing tracked yet"] });
      continue;
    }
    for (const i of mine) {
      const j = judgeItem(i, today, today);
      rows.push({ due: i.expiration_date ?? "", cells: [...base, i.title, i.issued_date ?? "", i.expiration_date ?? "No date on file", j.detail] });
    }
  }
  // No-date first (they're failing), then soonest due.
  rows.sort((a, b) => (a.due || "0000").localeCompare(b.due || "0000"));

  const csv = [header, ...rows.map((r) => r.cells)].map((line) => line.map(esc).join(",")).join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="equipment-${company.name.replace(/[^a-zA-Z0-9-]/g, "_")}-${today}.csv"`,
    },
  });
}
