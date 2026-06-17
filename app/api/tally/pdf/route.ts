import { buildTallyPdf, runTallySample, type TallyResult } from "@/lib/tally";
import { requireProductApi } from "@/lib/marketplace/access";

/**
 * Export a TallyResult to PDF (confirmed values + sign-off line) for invoice
 * backup / well-file. Accepts the corrected result from the client; falls back
 * to the cardless sample if none is posted. Gated.
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

  const bytes = await buildTallyPdf(result);
  const name = `tallyshot-${result.meta.sheetNo ? `sheet-${result.meta.sheetNo}` : "export"}.pdf`;
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${name}"`,
    },
  });
}
