import { exportTallyXlsx, runTallySample, type TallyResult } from "@/lib/tally";

/**
 * PUBLIC demo export — turns the (possibly corrected) sample result into a real
 * .xlsx so visitors can see the actual output. No auth/card. Sample-scoped.
 */
export async function POST(req: Request) {
  let result: TallyResult;
  try {
    const body = await req.json();
    result = body?.result ?? (await runTallySample());
  } catch {
    result = await runTallySample();
  }
  const buf = await exportTallyXlsx(result);
  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="tallyshot-sample.xlsx"`,
    },
  });
}
