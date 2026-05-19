/**
 * Test the Jitter composer agent end-to-end.
 *
 *   tsx generate-server/scripts/test-jitter.ts
 *   tsx generate-server/scripts/test-jitter.ts "your brief here"
 *
 * Writes:
 *   tmp/test-output/jitter-doc.json     — the validated JitterDoc
 *   tmp/test-output/jitter-raw.txt      — raw model output (for debugging)
 *
 * Preview in Remotion Studio:
 *   1. Start studio (npm run remotion)
 *   2. Open composition "JitterComposition"
 *   3. Paste the JSON from jitter-doc.json into the Props panel.
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { generateJitterDoc } from "../lib/agents/jitterComposer";
import { pickTemplateInspirations } from "../lib/agents/jitterTemplateRegistry";

const DEFAULT_BRIEF = `A 5-second hero animation for a productivity SaaS called "Flowdeck".
- Scene 1 (2.5s): The Flowdeck logo wordmark scales in from center with a soft shadow,
  then a subtitle "Plan less. Ship more." reveals letter-by-letter beneath it.
- Scene 2 (2.5s): Three feature pills slide up in a row — "AI tasks", "Auto-roadmap",
  "Zero meetings" — over a subtle dark navy background with a single magenta accent.
Brand: dark navy background (#0b1020), white text, magenta accent (#ff2d95).`;

async function main() {
  const brief = process.argv.slice(2).join(" ").trim() || DEFAULT_BRIEF;
  console.log("[test-jitter] Brief:", brief.slice(0, 200) + (brief.length > 200 ? "…" : ""));

  const outDir = join(process.cwd(), "tmp", "test-output");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const inspirations = pickTemplateInspirations(
    ["websites", "ui-elements", "text"],
    { perSection: 2, minLayers: 6 },
  );
  console.log(`[test-jitter] Inspirations: ${inspirations.length} templates`);
  for (const t of inspirations) console.log(`  - ${t.name} [${t.sections.join(",")}] layers=${t.layerCount} ops=${t.opCount}`);

  const durationMs = Number(process.env.JITTER_DURATION_MS || 5000);
  console.log(`[test-jitter] Duration: ${durationMs}ms`);

  const t0 = Date.now();
  const result = await generateJitterDoc({
    brief,
    width: 1920,
    height: 1080,
    durationMs,
    brand: {
      primary: "#ff2d95",
      background: "#0b1020",
      fontFamily: "Inter",
    },
    allowCustomComponents: true,
    templateInspirations: inspirations.map((t) => ({
      id: t.id,
      name: t.name,
      sections: t.sections,
      palette: t.palette,
      artboardCount: t.artboardCount,
      layerCount: t.layerCount,
      opCount: t.opCount,
      totalDurationMs: t.totalDurationMs,
    })),
  });
  const ms = Date.now() - t0;

  writeFileSync(
    join(outDir, "jitter-doc.json"),
    JSON.stringify(result.doc, null, 2),
  );
  writeFileSync(join(outDir, "jitter-raw.txt"), result.rawText);

  const artboards = result.doc.conf.artboards;
  const ops = artboards.reduce((s, a) => s + a.operations.length, 0);
  const layers = (function count(layers: any[]): number {
    return layers.reduce(
      (s, l) =>
        s + 1 + (l.type === "layerGrp" && Array.isArray(l.layers) ? count(l.layers) : 0),
      0,
    );
  })(artboards.flatMap((a) => a.layers));

  console.log(`[test-jitter] Done in ${ms}ms (attempts: ${result.attempts})`);
  console.log(
    `[test-jitter] Artboards: ${artboards.length} | layers: ${layers} | operations: ${ops} | customComponents: ${result.doc.customComponents.length} | totalFrames: ${result.totalFrames}`,
  );
  console.log(`[test-jitter] Wrote ${join(outDir, "jitter-doc.json")}`);
}

main().catch((err) => {
  console.error("[test-jitter] FAILED:", err);
  process.exit(1);
});
