import { saasAdmin } from "@/lib/saas/db";
import { addDaysIso } from "@/lib/saas/status";
import { DEMO_PAPER } from "@/lib/saas/paper";

/**
 * A sample cert for a demo yard's test: the paper behind it, drawn for that
 * exact piece (its serial, the test, the dates), and stamped as a sample.
 * Demo yards only. In a real yard "See the cert" opens the photo or scan of
 * the actual test paper.
 */
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (iso: string | null) => {
  if (!iso) return "Not on file";
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}/${y}`;
};

export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  const admin = saasAdmin();
  const nope = () => new Response("Not found", { status: 404 });
  if (!admin || !/^[0-9a-f-]{36}$/i.test(itemId)) return nope();
  const { data: item } = await admin.from("saas_compliance_items")
    .select("id, title, issued_date, expiration_date, parent_type, parent_id, company_id, last_upload_id").eq("id", itemId).maybeSingle();
  const it = item as { id: string; title: string; issued_date: string | null; expiration_date: string | null; parent_type: string; parent_id: string; company_id: string; last_upload_id: string | null } | null;
  if (!it?.last_upload_id) return nope();
  // Only a sample paper record (seeded for a demo or showcase yard) draws a
  // sample cert. A real yard's paper is a real photo; nobody can make one of these.
  const { data: up } = await admin.from("saas_cert_uploads").select("storage_path").eq("id", it.last_upload_id).eq("item_id", it.id).maybeSingle();
  if (!(up as { storage_path: string } | null)?.storage_path.startsWith(DEMO_PAPER)) return nope();
  const { data: co } = await admin.from("saas_companies").select("name").eq("id", it.company_id).maybeSingle();
  const company = co as { name: string } | null;
  if (!company) return nope();
  const { data: parent } = it.parent_type === "unit"
    ? await admin.from("saas_units").select("name, identifier").eq("id", it.parent_id).maybeSingle()
    : await admin.from("saas_assets").select("name, identifier").eq("id", it.parent_id).maybeSingle();
  const p = parent as { name: string; identifier: string | null } | null;
  const tested = it.issued_date ?? (it.expiration_date ? addDaysIso(it.expiration_date, -365) : null);

  const rows: [string, string][] = [
    ["Customer", company.name],
    [it.parent_type === "unit" ? "Unit" : "Description", p?.name ?? ""],
    [it.parent_type === "unit" ? "Unit number" : "Serial number", p?.identifier ?? "None"],
    ["Test", it.title],
    ["Tested on", fmt(tested)],
    ["Good until", fmt(it.expiration_date)],
    ["Result", "Pass"],
  ];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1100" viewBox="0 0 850 1100" font-family="Helvetica, Arial, sans-serif">
  <rect width="850" height="1100" fill="#ffffff"/>
  <rect x="40" y="40" width="770" height="1020" fill="none" stroke="#1e293b" stroke-width="3"/>
  <text x="80" y="120" font-size="40" font-weight="700" fill="#0f172a">Test certificate</text>
  <text x="80" y="160" font-size="20" fill="#475569">Sample testing company · Odessa, TX</text>
  <line x1="80" y1="190" x2="770" y2="190" stroke="#cbd5e1" stroke-width="2"/>
  ${rows.map(([k, v], i) => `<text x="80" y="${260 + i * 72}" font-size="20" fill="#64748b">${esc(k)}</text>
  <text x="320" y="${260 + i * 72}" font-size="26" font-weight="600" fill="#0f172a">${esc(v)}</text>`).join("\n  ")}
  <line x1="80" y1="800" x2="400" y2="800" stroke="#0f172a" stroke-width="2"/>
  <text x="80" y="830" font-size="18" fill="#475569">Technician</text>
  <text x="425" y="560" font-size="96" font-weight="800" fill="#dc2626" fill-opacity="0.13" text-anchor="middle" transform="rotate(-30 425 560)">SAMPLE</text>
  <text x="80" y="1010" font-size="18" fill="#64748b">Sample for the RollReady demo yard. In your yard this is the photo of the real test paper.</text>
</svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "private, max-age=300" } });
}
