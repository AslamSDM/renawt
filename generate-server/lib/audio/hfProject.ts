/**
 * HyperFrames Project Scaffold
 *
 * Given a generated orchestrator index.html and a set of sub-composition HTML
 * files, writes a real HyperFrames project directory on disk. Optionally installs
 * registry blocks/components via `hyperframes add` and wires audio assets.
 *
 * The directory is ready for `npx hyperframes lint / validate / inspect / render`.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { sanitizeR2UrlsDeep } from "../storage/r2";
import type { HfAudioPlan } from "./hfMediaEngine";

export interface HfSceneFile {
  id: string;
  fileName: string;
  html: string;
}

export interface HfProjectOptions {
  projectDir: string;
  indexHtml: string;
  scenes: HfSceneFile[];
  audioPlan?: HfAudioPlan | null;
  /** Registry block/component names to install (e.g. ["logo-outro", "grain-overlay"]) */
  registryBlocks?: string[];
  /** If true, reuse existing files instead of overwriting. Default false. */
  preserve?: boolean;
}

export interface HfProjectManifest {
  projectDir: string;
  indexPath: string;
  scenePaths: string[];
  audioMetaPath?: string;
  hyperframesJsonPath?: string;
}

function writeFile(path: string, content: string, preserve: boolean): void {
  if (preserve && existsSync(path)) return;
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function sanitizeUrlsInHtml(html: string): string {
  // Deep-sanitize any private R2 S3 endpoint URLs in the HTML to public R2 URLs.
  // We can't import sanitizeR2UrlsDeep on a string, so do a direct regex pass.
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/[%\s/]+$/, "");
  if (!publicUrl) return html;
  return html.replace(
    /https?:\/\/[^/"'\s]*\.r2\.cloudflarestorage\.com\/([^"'\s]+)/g,
    `${publicUrl}/$1`,
  );
}

function installRegistryBlocks(projectDir: string, blocks: string[]): void {
  if (!blocks.length) return;
  const available = new Set(
    (
      spawnSync("npx", ["hyperframes", "catalog", "--json"], {
        cwd: projectDir,
        encoding: "utf8",
        shell: true,
      }).stdout || "[]"
    )
      .trim()
      .split("\n")
      .pop() || "[]",
  );

  for (const block of blocks) {
    try {
      const r = spawnSync("npx", ["hyperframes", "add", block, "--yes"], {
        cwd: projectDir,
        encoding: "utf8",
        shell: true,
        stdio: "pipe",
        timeout: 120000,
      });
      if (r.status !== 0) {
        console.warn(`[HfProject] Registry add "${block}" failed:`, r.stderr || r.stdout);
      } else {
        console.log(`[HfProject] Installed registry block: ${block}`);
      }
    } catch (e) {
      console.warn(`[HfProject] Could not add registry block ${block}:`, e);
    }
  }
}

export function scaffoldHfProject(opts: HfProjectOptions): HfProjectManifest {
  const { projectDir, indexHtml, scenes, audioPlan, registryBlocks, preserve = false } = opts;

  mkdirSync(projectDir, { recursive: true });
  mkdirSync(join(projectDir, "compositions"), { recursive: true });
  mkdirSync(join(projectDir, "assets"), { recursive: true });

  // Install registry blocks first so the composer can reference them.
  if (registryBlocks?.length) {
    installRegistryBlocks(projectDir, registryBlocks);
  }

  // Write index.html (standalone root)
  const indexPath = join(projectDir, "index.html");
  writeFile(indexPath, sanitizeUrlsInHtml(indexHtml), preserve);

  // Write sub-compositions
  const scenePaths: string[] = [];
  for (const scene of scenes) {
    const path = join(projectDir, "compositions", scene.fileName);
    writeFile(path, sanitizeUrlsInHtml(scene.html), preserve);
    scenePaths.push(path);
  }

  // If an audio plan exists and assets live on disk, copy/symlink meta so render can find them.
  let audioMetaPath: string | undefined;
  if (audioPlan) {
    audioMetaPath = join(projectDir, "audio_meta.json");
    const meta = existsSync(join(audioPlan.projectDir, "audio_meta.json"))
      ? JSON.parse(
          readFileSync(join(audioPlan.projectDir, "audio_meta.json"), "utf8"),
        )
      : {};
    writeFileSync(audioMetaPath, JSON.stringify(meta, null, 2), "utf8");
  }

  // Write a minimal hyperframes.json for tooling. Point registry paths to the
  // default install locations so `hyperframes add` blocks/components land where
  // the composer expects them.
  const hyperframesJsonPath = join(projectDir, "hyperframes.json");
  writeFile(
    hyperframesJsonPath,
    JSON.stringify(
      {
        "$schema": "https://hyperframes.dev/schema.json",
        entry: "index.html",
        paths: {
          blocks: "compositions",
          components: "compositions/components",
          assets: "assets",
        },
      },
      null,
      2,
    ),
    preserve,
  );

  return {
    projectDir,
    indexPath,
    scenePaths,
    audioMetaPath,
    hyperframesJsonPath,
  };
}

export function cleanupHfProject(projectDir: string): void {
  if (existsSync(projectDir)) {
    try {
      rmSync(projectDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
