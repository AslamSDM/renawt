/**
 * Batch-translate every scraped Jitter template into JitterDocInputProps and
 * validate against JitterDocSchema.
 *
 *   pnpm exec tsx scripts/translate-jitter-templates.ts
 *
 * Writes `generate-server/data/jitter-templates/translated/<id>.json` and prints
 * a coverage report: ok/failed counts, first few failure reasons, a histogram of
 * UNMAPPED raw item types, and a breakdown of raw doc shapes.
 */

import * as fs from "fs";
import * as path from "path";
import {
  translateJitterDocDetailed,
  type TranslateResult,
} from "../generate-server/lib/video/jitterTranslate";
import { JitterDocSchema } from "../generate-server/lib/video/jitterJson";

const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(
  ROOT,
  "generate-server/data/jitter-templates/raw",
);
const OUT_DIR = path.join(
  ROOT,
  "generate-server/data/jitter-templates/translated",
);

function main() {
  if (!fs.existsSync(RAW_DIR)) {
    console.error(`Raw dir not found: ${RAW_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const files = fs.readdirSync(RAW_DIR).filter((f) => f.endsWith(".json"));

  let ok = 0;
  let failed = 0;
  const failures: { id: string; reasons: string[] }[] = [];
  const unmapped: Record<string, number> = {};
  const shapes: Record<string, number> = {};
  const notesHist: Record<string, number> = {};

  for (const file of files) {
    const id = file.replace(/\.json$/, "");
    let raw: any;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), "utf8"));
    } catch (e) {
      failed++;
      failures.push({ id, reasons: [`parse error: ${(e as Error).message}`] });
      continue;
    }

    let result: TranslateResult;
    try {
      result = translateJitterDocDetailed(raw, id);
    } catch (e) {
      failed++;
      failures.push({
        id,
        reasons: [`translate threw: ${(e as Error).message}`],
      });
      continue;
    }

    shapes[result.shape] = (shapes[result.shape] || 0) + 1;
    for (const [t, c] of Object.entries(result.unmapped))
      unmapped[t] = (unmapped[t] || 0) + c;
    for (const n of result.notes) notesHist[n] = (notesHist[n] || 0) + 1;

    // Always write the translated doc (even if validation fails) so the
    // renderer can be exercised and gaps inspected.
    fs.writeFileSync(
      path.join(OUT_DIR, `${id}.json`),
      JSON.stringify(result.doc, null, 2),
    );

    const parsed = JitterDocSchema.safeParse(result.doc);
    if (parsed.success) {
      ok++;
    } else {
      failed++;
      const reasons = parsed.error.issues
        .slice(0, 4)
        .map((i) => `${i.path.join(".")}: ${i.message}`);
      failures.push({ id, reasons });
    }
  }

  // ---- report -----------------------------------------------------------
  const line = "─".repeat(60);
  console.log(`\n${line}`);
  console.log("JITTER TEMPLATE TRANSLATION REPORT");
  console.log(line);
  console.log(`total:   ${files.length}`);
  console.log(`ok:      ${ok}`);
  console.log(`failed:  ${failed}`);

  console.log(`\nraw doc shapes:`);
  for (const [s, c] of Object.entries(shapes).sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(c).padStart(4)}  ${s}`);

  console.log(`\nunmapped item types (type → count):`);
  const um = Object.entries(unmapped).sort((a, b) => b[1] - a[1]);
  if (um.length === 0) console.log("  (none — full coverage)");
  else for (const [t, c] of um) console.log(`  ${String(c).padStart(6)}  ${t}`);

  if (Object.keys(notesHist).length) {
    console.log(`\ntranslation notes:`);
    for (const [n, c] of Object.entries(notesHist).sort((a, b) => b[1] - a[1]))
      console.log(`  ${String(c).padStart(4)}  ${n}`);
  }

  if (failures.length) {
    console.log(`\nfirst ${Math.min(failures.length, 15)} validation failures:`);
    for (const f of failures.slice(0, 15)) {
      console.log(`  ✗ ${f.id}`);
      for (const r of f.reasons) console.log(`      - ${r}`);
    }
    // Histogram of failure reason heads to spot systemic schema gaps.
    const reasonHist: Record<string, number> = {};
    for (const f of failures)
      for (const r of f.reasons) {
        const head = r.split(":")[0];
        reasonHist[head] = (reasonHist[head] || 0) + 1;
      }
    console.log(`\nfailure reason heads (path → count):`);
    for (const [r, c] of Object.entries(reasonHist).sort((a, b) => b[1] - a[1]))
      console.log(`  ${String(c).padStart(4)}  ${r}`);
  }

  console.log(`\nwrote ${ok + failed} files → ${OUT_DIR}`);
  console.log(line);
}

main();
