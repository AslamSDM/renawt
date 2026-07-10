/**
 * HyperFrames Media Engine adapter
 *
 * Wraps the canonical HF audio engine (skills/hyperframes-media/scripts/audio.mjs)
 * so the generate-server pipeline can produce TTS, BGM and SFX for a HyperFrames
 * project, upload the resulting assets to R2, and return public URLs.
 *
 * The adapter writes a neutral audio_request.json, invokes the engine, waits for
 * any detached BGM, then uploads voice/bgm/sfx assets to R2 and returns a
 * runtime-ready AudioPlan.
 */

import { spawn } from "child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import { dirname, join, relative, resolve } from "path";
import { randomUUID } from "crypto";
import { uploadAudioBufferToR2, isR2Configured } from "../storage/r2";
import { estimateNarrationDuration } from "../elevenlabs/elevenlabsService";

const HF_MEDIA_ENGINE = resolve(
  process.cwd(),
  "../.config/opencode/skills/hyperframes-media/scripts/audio.mjs",
);
const HF_WAIT_BGM = resolve(
  process.cwd(),
  "../.config/opencode/skills/hyperframes-media/scripts/wait-bgm.mjs",
);

export interface HfVoiceLine {
  id: string;
  text: string;
  sfx?: string[];
}

export interface HfAudioRequest {
  provider?: "auto" | "heygen" | "elevenlabs" | "kokoro";
  voice?: string;
  lang?: string;
  speed?: number;
  lines: HfVoiceLine[];
  bgm?: {
    mode?: "retrieve" | "generate" | "none";
    query?: string;
    prompt?: string;
    blob?: string;
    archetype?: string;
    arc?: string;
  };
}

export interface HfAudioPlan {
  projectDir: string;
  totalDurationS: number;
  voices: Array<{
    id: string;
    text: string;
    localPath: string;
    r2Url?: string;
    durationS: number;
    words: Array<{ id: string | number; text: string; start: number; end: number }>;
  }>;
  bgm?: {
    localPath: string;
    r2Url?: string;
    durationS: number | null;
    mode: string;
    query?: string;
  };
  sfx: Array<{
    id: string;
    name: string;
    localPath: string;
    r2Url?: string;
    durationS: number;
    volume: number;
  }>;
}

export interface HfMediaEngineOptions {
  projectDir: string;
  request: HfAudioRequest;
  /** If true, skip BGM entirely */
  noBgm?: boolean;
}

function mediaEngineExists(): boolean {
  return existsSync(HF_MEDIA_ENGINE);
}

function runAudioEngine(
  projectDir: string,
  only: "tts,bgm" | "tts,bgm,sfx" | "sfx",
  noBgm?: boolean,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const args = [
      HF_MEDIA_ENGINE,
      "--request",
      join(projectDir, "audio_request.json"),
      "--hyperframes",
      projectDir,
      "--out",
      join(projectDir, "audio_meta.json"),
      "--only",
      only,
    ];
    if (noBgm) args.push("--no-bgm");

    const cp = spawn(process.execPath, args, {
      cwd: projectDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    cp.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    cp.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    cp.on("close", (code) => {
      if (code !== 0) {
        console.error("[HfMediaEngine] audio engine stderr:", stderr);
        console.error("[HfMediaEngine] audio engine stdout:", stdout);
      }
      resolve({ ok: code === 0, error: code === 0 ? undefined : stderr || stdout || "audio engine failed" });
    });

    cp.on("error", (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

function waitForBgm(projectDir: string, timeoutMs = 10 * 60 * 1000): Promise<boolean> {
  return new Promise((resolve) => {
    if (!existsSync(HF_WAIT_BGM)) {
      console.warn("[HfMediaEngine] wait-bgm.mjs not found, skipping BGM wait");
      return resolve(false);
    }
    const cp = spawn(process.execPath, [HF_WAIT_BGM, "--hyperframes", projectDir], {
      cwd: projectDir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      try {
        cp.kill("SIGKILL");
      } catch {}
      resolve(false);
    }, timeoutMs);

    cp.on("close", (code) => {
      if (!killed) {
        clearTimeout(timer);
        resolve(code === 0);
      }
    });
    cp.on("error", () => {
      if (!killed) {
        clearTimeout(timer);
        resolve(false);
      }
    });
  });
}

async function uploadLocalAudioToR2(localPath: string, prefix: string, tag: string): Promise<string | undefined> {
  if (!isR2Configured()) return undefined;
  try {
    const buf = readFileSync(localPath);
    const ext = localPath.split(".").pop() || "mp3";
    const up = await uploadAudioBufferToR2(buf, ext === "wav" ? "audio/wav" : "audio/mpeg", prefix, tag);
    return up.success ? up.url : undefined;
  } catch (e) {
    console.warn(`[HfMediaEngine] R2 upload failed for ${localPath}:`, e);
    return undefined;
  }
}

function readAudioMeta(projectDir: string): any {
  const path = join(projectDir, "audio_meta.json");
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

function absoluteAssetPath(projectDir: string, rel: string): string {
  return resolve(projectDir, rel);
}

function durationFromFile(localPath: string): number {
  // Fallback if ffprobe data isn't available: read via meta or estimate.
  // The engine writes duration_s in audio_meta; we use that in callers.
  return 0;
}

function discoverGeneratedSfx(projectDir: string): Array<{ name: string; file: string; duration: number }> {
  const dir = join(projectDir, "assets", "sfx");
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => /\.(mp3|wav)$/i.test(f));
  return files.map((f) => ({
    name: f.replace(/\.\w+$/, ""),
    file: `assets/sfx/${f}`,
    duration: 1,
  }));
}

export async function runHfMediaEngine(opts: HfMediaEngineOptions): Promise<HfAudioPlan> {
  const { projectDir, request, noBgm } = opts;

  if (!mediaEngineExists()) {
    throw new Error(`HyperFrames media engine not found at ${HF_MEDIA_ENGINE}`);
  }

  mkdirSync(projectDir, { recursive: true });
  writeFileSync(join(projectDir, "audio_request.json"), JSON.stringify(request, null, 2));

  const hasLines = request.lines.length > 0;
  const hasSfx = request.lines.some((l) => l.sfx && l.sfx.length > 0);

  // Step 1: TTS + BGM (so we know total voice duration and can wait for BGM)
  if (hasLines || !noBgm) {
    const r1 = await runAudioEngine(projectDir, hasSfx ? "tts,bgm" : "tts,bgm,sfx", noBgm);
    if (!r1.ok) {
      console.warn("[HfMediaEngine] TTS/BGM pass had issues:", r1.error);
    }
  }

  let meta = readAudioMeta(projectDir);

  // Wait for detached BGM if pending
  if (meta.bgm_pending && !noBgm) {
    const ok = await waitForBgm(projectDir);
    if (!ok) console.warn("[HfMediaEngine] BGM generation did not complete in time");
    meta = readAudioMeta(projectDir);
  }

  // Step 2: SFX if we didn't already run it
  if (hasSfx && !request.lines.some((l) => l.sfx && l.sfx.length > 0)) {
    // unreachable because hasSfx already checks this
  }
  if (hasSfx) {
    const r2 = await runAudioEngine(projectDir, "sfx", noBgm);
    if (!r2.ok) {
      console.warn("[HfMediaEngine] SFX pass had issues:", r2.error);
    }
    meta = readAudioMeta(projectDir);
  }

  // Resolve voice lines
  const voices: HfAudioPlan["voices"] = [];
  for (const line of request.lines) {
    const v = (meta.voices || []).find((x: any) => String(x.id) === String(line.id));
    if (!v) {
      console.warn(`[HfMediaEngine] Voice line ${line.id} missing from engine output`);
      continue;
    }
    const localPath = absoluteAssetPath(projectDir, v.path);
    const r2Url = await uploadLocalAudioToR2(localPath, "narration/hf", `${line.id}-${randomUUID().slice(0, 8)}`);
    voices.push({
      id: line.id,
      text: line.text,
      localPath,
      r2Url,
      durationS: v.duration_s || estimateNarrationDuration(line.text),
      words: v.words || [],
    });
  }

  // Resolve BGM
  let bgm: HfAudioPlan["bgm"] | undefined;
  if (meta.bgm && meta.bgm.path) {
    const localPath = absoluteAssetPath(projectDir, meta.bgm.path);
    const r2Url = await uploadLocalAudioToR2(localPath, "bgm/hf", randomUUID().slice(0, 12));
    bgm = {
      localPath,
      r2Url,
      durationS: meta.bgm.duration_s ?? null,
      mode: meta.bgm.mode || "retrieve",
      query: meta.bgm.query,
    };
  }

  // Resolve SFX
  const sfx: HfAudioPlan["sfx"] = [];
  const metaSfx: Array<{ id: string; name: string; file: string; duration_s?: number; volume?: number }> =
    meta.sfx || [];
  for (const s of metaSfx) {
    const localPath = absoluteAssetPath(projectDir, s.file);
    const r2Url = await uploadLocalAudioToR2(localPath, "sfx/hf", `${s.name}-${randomUUID().slice(0, 8)}`);
    sfx.push({
      id: String(s.id),
      name: s.name,
      localPath,
      r2Url,
      durationS: s.duration_s ?? 1,
      volume: s.volume ?? 0.35,
    });
  }

  const totalDurationS = voices.reduce((sum, v) => sum + v.durationS, 0);

  return {
    projectDir,
    totalDurationS,
    voices,
    bgm,
    sfx,
  };
}

export function buildSfxCueNames(
  sceneCount: number,
  durationMs: number,
  brandMood = "minimal",
): string[][] {
  const sceneDuration = durationMs / sceneCount;
  const cuesPerScene: string[][] = [];
  const mood = brandMood.toLowerCase();

  const transitionSfx = ["whoosh", "whoosh-short", "swipe"];
  const accentSfx = ["pop", "click", "ping", "sparkle"];
  const impactSfx = ["impact-bass-1", "impact-bass-2"];

  for (let i = 0; i < sceneCount; i++) {
    const cues: string[] = [];
    if (i > 0) cues.push(transitionSfx[i % transitionSfx.length]);
    if (i % 2 === 0) cues.push(accentSfx[i % accentSfx.length]);
    if (i === sceneCount - 1) {
      cues.push(mood.includes("playful") ? "chime" : impactSfx[i % impactSfx.length]);
    }
    cuesPerScene.push(cues);
  }
  return cuesPerScene;
}
