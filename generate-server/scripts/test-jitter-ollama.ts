/**
 * Test the Jitter composer agent against a local Ollama model.
 *
 *   tsx generate-server/scripts/test-jitter-ollama.ts
 *   tsx generate-server/scripts/test-jitter-ollama.ts "your brief here"
 *   OLLAMA_MODEL=gemma3n:e4b tsx generate-server/scripts/test-jitter-ollama.ts
 *
 * Defaults:
 *   LLM_PROVIDER=ollama
 *   OLLAMA_BASE_URL=http://localhost:11434/v1
 *   OLLAMA_MODEL=gemma4:e4b   (override via env if your tag differs)
 *
 * Writes:
 *   tmp/test-output/jitter-ollama-doc.json
 *   tmp/test-output/jitter-ollama-raw.txt
 */

// ── Force Ollama BEFORE importing anything that reads env ──
process.env.LLM_PROVIDER = process.env.LLM_PROVIDER || "ollama";
process.env.OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
process.env.OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:e4b";

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

// Re-apply after dotenv in case .env tries to override.
process.env.LLM_PROVIDER = "ollama";

import { generateJitterDoc } from "../lib/agents/jitterComposer";
import { pickTemplateInspirations } from "../lib/agents/jitterTemplateRegistry";

const DEFAULT_BRIEF = `A 5-second hero animation for a productivity SaaS called "Flowdeck".
- Scene 1 (2.5s): The Flowdeck logo wordmark scales in from center with a soft shadow,
  then a subtitle "Plan less. Ship more." reveals letter-by-letter beneath it.
- Scene 2 (2.5s): Three feature pills slide up in a row — "AI tasks", "Auto-roadmap",
  "Zero meetings" — over a subtle dark navy background with a single magenta accent.
Brand: dark navy background (#0b1020), white text, magenta accent (#ff2d95).`;

async function ping(): Promise<void> {
  const base = process.env.OLLAMA_BASE_URL!.replace(/\/v1\/?$/, "");
  try {
    const r = await fetch(`${base}/api/tags`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data: any = await r.json();
    const tags: string[] = (data?.models || []).map((m: any) => m.name);
    const want = process.env.OLLAMA_MODEL!;
    console.log(
      `[ollama] reachable. ${tags.length} model(s) installed.`,
    );
    if (!tags.includes(want)) {
      console.warn(
        `[ollama] WARNING: "${want}" not in installed tags. Pull it first:\n` +
          `  ollama pull ${want}\n` +
          `Available: ${tags.slice(0, 12).join(", ")}${tags.length > 12 ? " …" : ""}`,
      );
    }
  } catch (e) {
    console.warn(
      `[ollama] Could not reach ${base}/api/tags — ` +
        `make sure \`ollama serve\` is running. (${(e as Error).message})`,
    );
  }
}

async function main() {
  const brief = process.argv.slice(2).join(" ").trim() || DEFAULT_BRIEF;

  console.log("[test-jitter-ollama] Provider:", process.env.LLM_PROVIDER);
  console.log("[test-jitter-ollama] Base:    ", process.env.OLLAMA_BASE_URL);
  console.log("[test-jitter-ollama] Model:   ", process.env.OLLAMA_MODEL);
  console.log(
    "[test-jitter-ollama] Brief:",
    brief.slice(0, 200) + (brief.length > 200 ? "…" : ""),
  );

  await ping();

  const outDir = join(process.cwd(), "tmp", "test-output");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const inspirations = pickTemplateInspirations(
    ["websites", "ui-elements", "text"],
    { perSection: 2, minLayers: 6 },
  );
  console.log(
    `[test-jitter-ollama] Inspirations: ${inspirations.length} templates`,
  );
  for (const t of inspirations)
    console.log(
      `  - ${t.name} [${t.sections.join(",")}] layers=${t.layerCount} ops=${t.opCount}`,
    );

  const t0 = Date.now();
  const result = await generateJitterDoc({
    brief,
    width: 1920,
    height: 1080,
    durationMs: 5000,
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
    join(outDir, "jitter-ollama-doc.json"),
    JSON.stringify(result.doc, null, 2),
  );
  writeFileSync(join(outDir, "jitter-ollama-raw.txt"), result.rawText);

  const artboards = result.doc.conf.artboards;
  const ops = artboards.reduce((s, a) => s + a.operations.length, 0);
  const layers = (function count(layers: any[]): number {
    return layers.reduce(
      (s, l) =>
        s +
        1 +
        (l.type === "layerGrp" && Array.isArray(l.layers)
          ? count(l.layers)
          : 0),
      0,
    );
  })(artboards.flatMap((a) => a.layers));

  console.log(
    `[test-jitter-ollama] Done in ${ms}ms (attempts: ${result.attempts})`,
  );
  console.log(
    `[test-jitter-ollama] Artboards: ${artboards.length} | layers: ${layers} | operations: ${ops} | customComponents: ${result.doc.customComponents.length} | totalFrames: ${result.totalFrames}`,
  );
  console.log(
    `[test-jitter-ollama] Wrote ${join(outDir, "jitter-ollama-doc.json")}`,
  );
}

main().catch((err) => {
  console.error("[test-jitter-ollama] FAILED:", err);
  process.exit(1);
});
