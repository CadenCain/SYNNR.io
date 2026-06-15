import { exportTallyXlsx, runTallySample, type TallyResult } from "@/lib/tally";
import { requireProductApi } from "@/lib/marketplace/access";

/**
 * Export a TallyResult to .xlsx. Accepts the (possibly corrected) result from
 * the client; falls back to the cardless sample if none is posted. Gated.
 */
export async function POST(req: Request) {
  const gate = await requireProductApi("tallyshot");
  if (!gate.ok) return Response.json({ ok: false, error: gate.reason }, { status: gate.status });

  let result: TallyResult;
  try {
    const body = await req.json();
    result = body?.result ?? (await runTallySample());
  } catch {
    result = await runTallySample();
  }

  const buf = await exportTallyXlsx(result);
  const name = `tallyshot-${result.meta.sheetNo ? `sheet-${result.meta.sheetNo}` : "export"}.xlsx`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}"`,
    },
  });
}
