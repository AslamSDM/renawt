/**
 * Batch-render translated Jitter templates → mp4 previews → R2.
 *
 * Depends on:
 *   - generate-server/data/jitter-templates/translated/<id>.json  (Stream T output)
 *   - remotion composition "JitterComposition" extended to render them (Stream R)
 *
 * Writes a manifest the gallery reads:
 *   generate-server/data/jitter-templates/previews.json  → { [id]: publicUrl }
 *
 * Resumable: ids already in previews.json are skipped.
 *
 * Usage:
 *   pnpm exec tsx scripts/render-jitter-previews.ts            # all, upload to R2
 *   pnpm exec tsx scripts/render-jitter-previews.ts --limit 5  # first 5 only
 *   pnpm exec tsx scripts/render-jitter-previews.ts --no-upload # render locally only
 *   pnpm exec tsx scripts/render-jitter-previews.ts --ids a,b,c
 */

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { uploadVideoBufferToR2 } from "../lib/storage/r2";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const DATA = path.join(root, "generate-server/data/jitter-templates");
const TRANSLATED = path.join(DATA, "translated");
const PREVIEWS_JSON = path.join(DATA, "previews.json");
const OUT_DIR = path.join(root, "out/template-previews");

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (flag: string) => {
    const i = a.indexOf(flag);
    return i >= 0 ? a[i + 1] : undefined;
  };
  return {
    limit: get("--limit") ? Number(get("--limit")) : Infinity,
    noUpload: a.includes("--no-upload"),
    ids: get("--ids")?.split(",").map((s) => s.trim()).filter(Boolean),
  };
}

function loadPreviews(): Record<string, string> {
  if (!existsSync(PREVIEWS_JSON)) return {};
  try {
    return JSON.parse(readFileSync(PREVIEWS_JSON, "utf8"));
  } catch {
    return {};
  }
}

async function main() {
  const { limit, noUpload, ids } = parseArgs();
  if (!existsSync(TRANSLATED)) {
    throw new Error(
      `No translated docs at ${TRANSLATED}. Run scripts/translate-jitter-templates.ts first.`,
    );
  }
  mkdirSync(OUT_DIR, { recursive: true });

  const previews = loadPreviews();
  let targets = readdirSync(TRANSLATED)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
  if (ids) targets = targets.filter((id) => ids.includes(id));
  targets = targets.filter((id) => !previews[id]).slice(0, limit);

  if (targets.length === 0) {
    console.log("[Previews] Nothing to render (all done or none matched).");
    return;
  }

  console.log(`[Previews] Bundling remotion/Root.tsx ...`);
  const serveUrl = await bundle({
    entryPoint: path.join(root, "remotion/Root.tsx"),
    onProgress: (p) => process.stdout.write(`\r[Previews] Bundle ${p}%   `),
  });
  process.stdout.write("\n");

  let ok = 0;
  let failed = 0;
  for (const [i, id] of targets.entries()) {
    const tag = `(${i + 1}/${targets.length}) ${id}`;
    try {
      const inputProps = JSON.parse(
        readFileSync(path.join(TRANSLATED, `${id}.json`), "utf8"),
      );
      const composition = await selectComposition({
        serveUrl,
        id: "JitterComposition",
        inputProps,
      });
      const outFile = path.join(OUT_DIR, `${id}.mp4`);
      await renderMedia({
        serveUrl,
        composition,
        codec: "h264",
        outputLocation: outFile,
        inputProps,
        scale: Number(process.env.PREVIEW_SCALE || 0.5),
        concurrency: Number(process.env.LOCAL_RENDER_CONCURRENCY || 4),
        // Fail fast on a stuck asset instead of the 28s default delayRender.
        timeoutInMilliseconds: Number(process.env.PREVIEW_TIMEOUT_MS || 12000),
      });

      if (noUpload) {
        previews[id] = `file://${outFile}`;
      } else {
        const res = await uploadVideoBufferToR2(
          readFileSync(outFile),
          `${id}.mp4`,
          "templates",
        );
        if (!res.success || !res.url) {
          throw new Error(res.error || "R2 upload returned no url");
        }
        previews[id] = res.url;
        // Free local disk — only the R2 url is needed downstream.
        try {
          rmSync(outFile);
        } catch {
          /* ignore */
        }
      }
      // Persist after each success so the run is resumable.
      writeFileSync(PREVIEWS_JSON, JSON.stringify(previews, null, 2));
      ok++;
      console.log(`[Previews] ✓ ${tag} → ${previews[id]}`);
    } catch (err) {
      failed++;
      console.error(
        `[Previews] ✗ ${tag}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  console.log(`\n[Previews] Done. ok=${ok} failed=${failed}. Manifest: ${PREVIEWS_JSON}`);
}

main().catch((err) => {
  console.error("[Previews] FATAL:", err);
  process.exit(1);
});
