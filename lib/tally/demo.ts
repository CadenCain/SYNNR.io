/**
 * Cardless TallyShot demo — no AI Gateway card, no network.
 * Runs the whole pipeline on the MKS Sheet 3 fixture, prints the run summary,
 * and writes an .xlsx you can open.
 *
 *   node lib/tally/demo.ts            # writes ./tally-demo.xlsx
 *   node lib/tally/demo.ts /tmp/x.xlsx
 */
import { writeFile } from "node:fs/promises";
import { runTallySample, summarize } from "./run";
import { exportTallyXlsx } from "./xlsx";

async function main() {
  const out = process.argv[2] || "tally-demo.xlsx";
  const result = await runTallySample();
  console.log(summarize(result));
  const buf = await exportTallyXlsx(result);
  await writeFile(out, buf);
  console.log(`\nWrote ${buf.length.toLocaleString()} bytes → ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
