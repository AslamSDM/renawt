import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { Composition } from "@remawt/shared";
import { parseAudioTags } from "./audio/index";

/** Rewrite private R2 S3 endpoints to the public URL (same behaviour as the legacy scaffold). */
export function sanitizeR2Urls(html: string): string {
  const pub = process.env.R2_PUBLIC_URL?.replace(/[%\s/]+$/, "");
  if (!pub) return html;
  return html.replace(/https?:\/\/[^/"'\s]*\.r2\.cloudflarestorage\.com\/([^"'\s]+)/g, `${pub}/$1`);
}

/** Relative path → file content for every file of the project (what the render Lambda takes as projectFiles). */
export function projectFiles(comp: Composition): Record<string, string> {
  const files: Record<string, string> = { "index.html": sanitizeR2Urls(comp.indexHtml) };
  for (const f of comp.sceneFiles) files[`compositions/${f.fileName}`] = sanitizeR2Urls(f.html);
  files["hyperframes.json"] = JSON.stringify({ $schema: "https://hyperframes.dev/schema.json", entry: "index.html", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" } }, null, 2);
  files["assets/manifest.json"] = JSON.stringify(assetManifest(comp), null, 2);
  return files;
}

/** Every external asset the composition references (audio, images, fonts). */
export function assetManifest(comp: Composition): { width: number; height: number; fps: number; durationMs: number; audio: ReturnType<typeof parseAudioTags>; images: string[]; fonts: string[] } {
  const all = [comp.indexHtml, ...comp.sceneFiles.map((f) => f.html)].join("\n");
  const images = [...new Set([...all.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")))];
  const fonts = [...new Set([...comp.indexHtml.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&")))];
  return { width: comp.width, height: comp.height, fps: comp.fps, durationMs: comp.durationMs, audio: parseAudioTags(comp.indexHtml), images, fonts };
}

/**
 * Write the project to `dir` (must live under os.tmpdir()): index.html, compositions/*.html,
 * hyperframes.json and assets/manifest.json. Ready for `npx hyperframes lint|check|render`.
 */
export function scaffoldProject(comp: Composition, dir: string): { indexPath: string; files: string[] } {
  const root = resolve(dir);
  const tmp = resolve(tmpdir());
  const rel = relative(tmp, root);
  // macOS: os.tmpdir() may be /var/... while realpath is /private/var/...
  const underTmp = (!rel.startsWith("..") && !rel.startsWith(sep) && rel !== "") || root.startsWith("/private" + tmp) || root.startsWith(tmp.replace(/^\/private/, ""));
  if (!underTmp) throw new Error(`scaffoldProject: ${root} is outside os.tmpdir() (${tmp})`);
  rmSync(join(root, "compositions"), { recursive: true, force: true });
  const written: string[] = [];
  for (const [p, content] of Object.entries(projectFiles(comp))) {
    const full = join(root, p);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
    written.push(full);
  }
  return { indexPath: join(root, "index.html"), files: written };
}
