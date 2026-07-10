import { scrapeWithCrawl, type ScrapeWithCrawlResult } from "../screenshots/capture";
import { analyzeBrandFromScreenshot, type CrawlContext } from "./urlToJitter";
import {
  generateHfComposition,
  buildCaptionsFromNarration,
  type NarrationResult,
} from "./hfComposer";
import { submitAndWaitForHfRender } from "../render/hfRenderClient";
import { noopProgress, type ProgressEmit } from "./progress";
import {
  pickTrack,
  moodToMusicKeyword,
  type PickedTrack,
} from "../audio/musicPicker";
import {
  generateSfx,
  type SfxRequest,
  type SfxOutput,
  type SfxPlan,
} from "../audio/sfxGenerator";
import {
  runHfMediaEngine,
  buildSfxCueNames,
  type HfAudioPlan,
  type HfVoiceLine,
} from "../audio/hfMediaEngine";
import { scaffoldHfProject, cleanupHfProject, type HfProjectManifest } from "../audio/hfProject";
import { spawnSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

export interface NarrationInput {
  text?: string;
  audioUrl?: string;
  voiceId?: string;
  volume?: number;
  startMs?: number;
  durationMs?: number;
}

export interface HfPipelineParams {
  url: string;
  durationMs?: number;
  width?: number;
  height?: number;
  fps?: number;
  extraNotes?: string;
  audioUrl?: string;
  imageUrls?: string[];
  projectId?: string;
  tag: string;
  userId: string;
  onProgress?: ProgressEmit;
  musicMood?: string;
  preferredBpm?: number;
  narration?: NarrationInput | null;
  captions?: {
    enabled?: boolean;
    style?: "bottom" | "centered" | "minimal";
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    background?: string;
  } | null;
  sfxEnabled?: boolean;
  /** Number of scenes to generate (default 4) */
  sceneCount?: number;
  /** Registry blocks/components to install/use */
  registryBlocks?: string[];
  /** Transition style hints: push, scale, dissolve, cover, distortion, light, grid, blur, other */
  transitionStyle?: string;
  /** If true, run HyperFrames CLI lint/validate/inspect before rendering */
  runCliChecks?: boolean;
}

export interface HfPipelineResult {
  videoUrl: string;
  /** URL to the generated project directory in R2 (optional) */
  projectUrl?: string;
  /** The orchestrator index.html */
  compositionHtml: string;
  /** Paths to scene sub-compositions */
  sceneFiles?: Array<{ id: string; fileName: string; html: string }>;
  brandReport: object;
  renderTime?: number;
  music?: PickedTrack | null;
  narration?: NarrationResult | null;
  sfx?: SfxOutput | null;
  audioPlan?: HfAudioPlan | null;
  manifest?: HfProjectManifest;
}

function buildSfxPlan(
  brandMood: string,
  durationMs: number,
  sceneCount: number,
): SfxPlan {
  const requests: SfxRequest[] = [];
  const sceneDuration = durationMs / sceneCount;

  for (let i = 0; i < sceneCount; i++) {
    const sceneStart = i * sceneDuration;
    if (i > 0) {
      requests.push({
        type: "swoosh",
        startMs: Math.max(0, sceneStart - 150),
        durationMs: 400,
        volume: 0.25,
        sceneIndex: i,
        sceneLabel: `scene_${i}_transition`,
      });
    }
    if (i % 2 === 0) {
      requests.push({
        type: "pop",
        startMs: sceneStart + 100,
        durationMs: 150,
        volume: 0.3,
        sceneIndex: i,
        sceneLabel: `scene_${i}_entrance`,
      });
    }
    if (i < sceneCount - 1) {
      requests.push({
        type: "tap",
        startMs: sceneStart + sceneDuration * 0.4,
        durationMs: 100,
        volume: 0.15,
        sceneIndex: i,
        sceneLabel: `scene_${i}_accent`,
      });
    }
  }

  requests.push({
    type: "chime_mid",
    startMs: durationMs - 1500,
    durationMs: 800,
    volume: 0.35,
    sceneIndex: sceneCount - 1,
    sceneLabel: "final_chime",
  });

  return {
    requests,
    description: `Generated ${requests.length} SFX clips across ${sceneCount} scenes: transition swooshes between scenes, pop entrances on even scenes, tap accents mid-scene, and a closing chime.`,
  };
}

function buildVoiceLines(narrationText?: string): HfVoiceLine[] {
  if (!narrationText?.trim()) return [];
  // Split into logical paragraphs / sentences for per-line SFX control.
  const chunks = narrationText
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 6);
  return chunks.map((text, i) => ({
    id: String(i + 1).padStart(2, "0"),
    text,
    // Add subtle accent SFX on first and last lines if video is short
    sfx: i === 0 ? ["sparkle"] : i === chunks.length - 1 ? ["chime"] : undefined,
  }));
}

function runHyperframesCliCheck(projectDir: string, command: "lint" | "validate" | "inspect"): { ok: boolean; output: string } {
  const r = spawnSync("npx", ["hyperframes", command, "--json"], {
    cwd: projectDir,
    encoding: "utf8",
    shell: true,
    stdio: "pipe",
    timeout: 120000,
  });
  const output = r.stdout || r.stderr || "";
  const json = (() => {
    try {
      return JSON.parse(output.trim().split("\n").pop() || "{}");
    } catch {
      return {};
    }
  })();
  const ok = r.status === 0 && !json.errors?.length && !json.error;
  if (!ok) {
    console.warn(`[hfDirector] hyperframes ${command} issues:`, output);
  }
  return { ok, output };
}

export async function runHfPipeline(params: HfPipelineParams): Promise<HfPipelineResult> {
  const emit = params.onProgress || noopProgress;
  const tag = params.tag;
  const width = params.width ?? 1920;
  const height = params.height ?? 1080;
  const durationMs = params.durationMs ?? 15000;
  const sceneCount = params.sceneCount ?? 4;
  const runCliChecks = params.runCliChecks ?? true;

  await emit({ step: "capture", label: "Capture screenshot + crawl", status: "running" });
  const scrapeResult = await scrapeWithCrawl(params.url, tag, { maxPages: 6, maxDepth: 2 });
  await emit({ step: "capture", label: "Capture screenshot + crawl", status: "done", detail: `${params.url} (${scrapeResult.pages.length} pages)` });

  const crawlCtx: CrawlContext | undefined = scrapeResult.pages.length > 0
    ? {
        pages: scrapeResult.pages,
        logoUrl: scrapeResult.logoUrl,
        brandImages: scrapeResult.brandImages,
        combinedText: scrapeResult.combinedText,
      }
    : undefined;

  await emit({ step: "brand", label: "Analyze brand", status: "running" });
  const brandReport = await analyzeBrandFromScreenshot(scrapeResult.screenshotUrl, {
    hint: params.extraNotes,
    crawl: crawlCtx,
  });
  const br = brandReport as any;
  await emit({
    step: "brand", label: "Analyze brand", status: "done",
    detail: `${br.productName || "Unknown"} · ${br.brand?.mood || "neutral"}`,
    output: brandReport,
  });

  let music: PickedTrack | null = null;
  if (params.audioUrl) {
    music = {
      url: params.audioUrl,
      bpm: params.preferredBpm ?? 124,
      beatMs: 60000 / (params.preferredBpm ?? 124),
      title: "User-selected track",
      moods: [],
    };
  } else {
    await emit({ step: "music", label: "Pick music", status: "running" });
    music = await pickTrack({
      mood: params.musicMood ?? moodToMusicKeyword(br.brand?.mood || "neutral"),
      preferredBpm: params.preferredBpm ?? 124,
    });
    console.log(`[hfDirector] Music: "${music.title}" @ ${music.bpm} BPM`);
  }
  if (music) {
    await emit({ step: "music", label: "Pick music", status: "done", detail: `${music.title} @ ${music.bpm} BPM`, output: { title: music.title, bpm: music.bpm, moods: music.moods } });
  }

  // Resolve narration via HyperFrames media engine if text is supplied.
  let audioPlan: HfAudioPlan | null = null;
  const narrationText = params.narration?.text;
  if (narrationText?.trim()) {
    await emit({ step: "narration", label: "Generate narration", status: "running" });
    const projectDir = join(process.cwd(), "tmp", "hf-audio", tag);
    const voiceLines = buildVoiceLines(narrationText);
    const sfxCueNames = buildSfxCueNames(sceneCount, durationMs, br.brand?.mood || "minimal").flat();
    if (voiceLines.length > 0 && params.sfxEnabled !== false) {
      voiceLines[0].sfx = [...new Set([...(voiceLines[0].sfx || []), ...sfxCueNames.slice(0, 2)])];
      const last = voiceLines[voiceLines.length - 1];
      last.sfx = [...new Set([...(last.sfx || []), ...sfxCueNames.slice(-2)])];
    }
    try {
      audioPlan = await runHfMediaEngine({
        projectDir,
        request: {
          provider: "auto",
          voice: params.narration?.voiceId,
          lines: voiceLines,
          bgm: music?.url
            ? { mode: "none" }
            : {
                mode: "retrieve",
                query: params.musicMood ?? moodToMusicKeyword(br.brand?.mood || "neutral"),
                blob: br.productName || params.url,
                archetype: "product-promo",
              },
        },
        noBgm: !!music?.url,
      });
      console.log(`[hfDirector] Media engine: ${audioPlan.voices.length} voices, ${audioPlan.sfx.length} sfx`);
    } catch (err) {
      console.warn("[hfDirector] Media engine failed:", err);
      audioPlan = null;
    }
    await emit({ step: "narration", label: "Generate narration", status: "done", detail: `${audioPlan?.voices.length ?? 0} voices, ${audioPlan?.sfx.length ?? 0} sfx` });
  }

  // Build a legacy narration result for the composer to use.
  const narration: NarrationResult | null =
    params.narration?.audioUrl
      ? {
          url: params.narration.audioUrl,
          volume: params.narration.volume ?? 0.9,
          startMs: params.narration.startMs,
          durationMs: params.narration.durationMs,
        }
      : audioPlan?.voices[0]
        ? {
            url: audioPlan.voices[0].r2Url || audioPlan.voices[0].localPath,
            volume: params.narration?.volume ?? 0.9,
            estimatedDurationSec: audioPlan.totalDurationS,
          }
        : null;

  let captionChunks: Array<{ text: string; startMs: number; endMs: number }> | null = null;
  if (params.captions?.enabled && narration?.estimatedDurationSec) {
    if (narrationText?.trim()) {
      captionChunks = buildCaptionsFromNarration(narrationText, narration.estimatedDurationSec * 1000);
    }
  }

  let sfx: SfxOutput | null = null;
  if (params.sfxEnabled !== false) {
    await emit({ step: "sfx", label: "Generate sound effects", status: "running" });
    const sfxPlan = buildSfxPlan(br.brand?.mood || "minimal", durationMs, sceneCount);
    sfx = await generateSfx(sfxPlan.requests, tag);
    if (sfx?.mixUrl) console.log(`[hfDirector] SFX ready: ${sfx.clipUrls.length} clips, mix: ${sfx.mixUrl}`);
    await emit({ step: "sfx", label: "Generate sound effects", status: "done", detail: `${sfx?.clipUrls.length ?? 0} clips`, output: { clipCount: sfx?.clipUrls.length, hasMix: !!sfx?.mixUrl } });
  }

  const combinedImageUrls = [
    ...(scrapeResult.brandImages || []),
    ...(params.imageUrls || []),
  ];

  await emit({ step: "compose", label: "Compose HyperFrames", status: "running" });
  const composition = await generateHfComposition({
    brandReport: brandReport as Record<string, unknown>,
    url: params.url,
    durationMs,
    width,
    height,
    extraNotes: params.extraNotes,
    imageUrls: combinedImageUrls,
    music,
    narration,
    captions: params.captions,
    captionChunks,
    sfxPlan: sfx
      ? {
          requests: sfx.scenes.flatMap((s) =>
            s.clips.map((c) => ({
              type: "click" as const,
              startMs: c.startMs,
              durationMs: c.durationMs,
              volume: c.volume,
              sceneIndex: s.sceneIndex,
              sceneLabel: c.label,
            })),
          ),
          description: `Sound effects at: ${sfx.scenes.map((s) => s.clips.map((c) => `${c.label}@${c.startMs}ms`).join(", ")).join("; ")}`,
        }
      : undefined,
    audioPlan,
    sceneCount,
    registryBlocks: params.registryBlocks,
    crawlData: crawlCtx,
  });
  await emit({ step: "compose", label: "Compose HyperFrames", status: "done", detail: `${composition.sceneFiles.length} scenes · ${composition.transitions.join(", ")}` });

  // Scaffold a real HyperFrames project on disk.
  const projectDir = join(process.cwd(), "tmp", "hf-projects", tag);
  const manifest = scaffoldHfProject({
    projectDir,
    indexHtml: composition.indexHtml,
    scenes: composition.sceneFiles,
    audioPlan,
    registryBlocks: composition.registryBlocks,
  });

  // Run CLI checks before rendering.
  if (runCliChecks) {
    await emit({ step: "checks", label: "Validate composition", status: "running" });
    const lint = runHyperframesCliCheck(projectDir, "lint");
    const validate = runHyperframesCliCheck(projectDir, "validate");
    const inspect = runHyperframesCliCheck(projectDir, "inspect");
    await emit({
      step: "checks",
      label: "Validate composition",
      status: lint.ok && validate.ok ? "done" : "done",
      detail: `lint=${lint.ok} validate=${validate.ok} inspect=${inspect.ok}`,
    });
  }

  const fps = params.fps ?? 30;
  const durationInFrames = Math.round((durationMs / 1000) * fps);

  // Collect audio URLs for the render-service muxer.
  const audioUrls: string[] = [];
  if (music?.url) audioUrls.push(music.url);
  if (narration?.url) audioUrls.push(narration.url);
  if (sfx?.mixUrl) audioUrls.push(sfx.mixUrl);
  if (audioPlan?.bgm?.r2Url) audioUrls.push(audioPlan.bgm.r2Url);
  for (const v of audioPlan?.voices || []) {
    if (v.r2Url) audioUrls.push(v.r2Url);
  }

  await emit({ step: "render", label: "Render video", status: "running" });

  // Ship the entire scaffolded project directory to the containerized render
  // service so sub-compositions resolve correctly.
  const projectFiles: Record<string, string> = {};
  for (const filePath of [manifest.indexPath, ...manifest.scenePaths, manifest.hyperframesJsonPath, manifest.audioMetaPath].filter(Boolean) as string[]) {
    const relative = filePath.replace(projectDir + "/", "");
    projectFiles[relative] = readFileSync(filePath, "utf8");
  }

  const renderResult = await submitAndWaitForHfRender({
    compositionHtml: "",
    projectFiles,
    durationInFrames,
    width,
    height,
    fps,
    quality: "standard",
    format: "mp4",
    projectId: params.projectId,
    assets: audioUrls.length > 0 ? { audioUrls } : undefined,
  });
  if (renderResult.status !== "completed" || !renderResult.videoUrl) {
    throw new Error(renderResult.error || "HF render failed");
  }
  await emit({ step: "render", label: "Render video", status: "done", detail: `${((renderResult.renderTime ?? 0) / 1000).toFixed(1)}s` });

  const indexHtml = readFileSync(manifest.indexPath, "utf8");

  return {
    videoUrl: renderResult.videoUrl,
    compositionHtml: indexHtml,
    sceneFiles: composition.sceneFiles,
    brandReport: brandReport as object,
    renderTime: renderResult.renderTime,
    music,
    narration,
    sfx,
    audioPlan,
    manifest,
  };
}
