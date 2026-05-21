/**
 * URL-FREE reference-video orchestrator.
 *
 *   1. clip the reference into N equal sections (ffmpeg)
 *   2. parallel: vision-analyze each clip → SceneReport
 *   3. parallel: per-clip Jitter composer → { artboard, customComponents[] }
 *   4. merge into one JitterDoc
 *
 * Output is rendered separately by the caller via `npx remotion render JitterComposition`.
 */

import { join } from "path";
import { tmpdir } from "os";
import { mkdtempSync } from "fs";

import { clipVideoIntoSections, type ReferenceClip } from "../video/clipReference";
import {
  analyzeReferenceClip,
  type SceneReport,
} from "./jitterReferenceAnalyzer";
import {
  composeClip,
  mergeClipsToDoc,
  type ClipComposeInput,
  type ClipComposeOutput,
} from "./jitterReferenceComposer";
import type { JitterDoc } from "../video/jitterJson";
import {
  resolveNarration,
  fetchStockImagesForTopics,
  type NarrationInput,
} from "./jitterAssets";
import { withLlmContext } from "../llm/tokenLogger";

export interface JitterReferenceInput {
  /** Local path or http(s) URL of the reference video. */
  referenceVideoPath: string;
  /** Number of equal-length clips. Default 4. */
  clipSections?: number;
  /** User content/brief — what to swap in for the reference visuals. */
  description: string;
  /** Optional brand hint (product name / tagline / features / cta). */
  brandHint?: ClipComposeInput["brandHint"];
  /** User-supplied audio (overrides reference audio). */
  audio?: { url: string; bpm: number; volume?: number };
  /** Image URLs (logos / hero images) to weave in. */
  images?: string[];
  /** Stock-image topics → Unsplash search → URLs the composer can use. */
  stockImageTopics?: string[];
  /** Or pass pre-fetched stock URLs directly. */
  stockImageUrls?: string[];
  /** Voice-over narration (TTS text or pre-existing audio URL). */
  narration?: NarrationInput | null;
  width?: number;
  height?: number;
  /** Optional working dir for clip files. Defaults to a tmp dir. */
  workDir?: string;
  /** Tag for narration filename. */
  jobId?: string;
  /** For LLM token-usage logging. */
  userId?: string;
  projectId?: string;
}

export interface JitterReferenceResult {
  doc: JitterDoc;
  clips: ReferenceClip[];
  reports: SceneReport[];
  outputs: ClipComposeOutput[];
}

export async function generateJitterFromReference(
  input: JitterReferenceInput,
): Promise<JitterReferenceResult> {
  return withLlmContext(
    {
      label: `jitterReference:${input.jobId ?? "anon"}`,
      userId: input.userId,
      projectId: input.projectId,
    },
    () => runJitterFromReference(input),
  );
}

async function runJitterFromReference(
  input: JitterReferenceInput,
): Promise<JitterReferenceResult> {
  const numSections = Math.max(1, input.clipSections ?? 4);
  const workDir =
    input.workDir ?? mkdtempSync(join(tmpdir(), "jitter-ref-"));

  console.log(
    `[refOrchestrator] reference=${input.referenceVideoPath} sections=${numSections} workDir=${workDir}`,
  );

  // 1. Clip the reference.
  const clips = await clipVideoIntoSections(
    input.referenceVideoPath,
    numSections,
    workDir,
  );
  console.log(
    `[refOrchestrator] cut into ${clips.length} clips (avg ${Math.round(clips[0].durationMs)}ms each)`,
  );

  // 2. Vision analyze each clip + asset prep (stock images + narration) in parallel.
  //    Stock images flow through as {url, topic} pairs so each clip's composer
  //    can pick a photo whose topic matches the clip's content (instead of
  //    treating the bag of URLs as interchangeable).
  const stockTopicJob: Promise<Array<string | { url: string; topic: string }>> =
    input.stockImageUrls?.length
      ? Promise.resolve(input.stockImageUrls)
      : input.stockImageTopics?.length
        ? fetchStockImagesForTopics(input.stockImageTopics, 3)
        : Promise.resolve([]);
  const narrationTag = input.jobId || `ref-narration-${Date.now()}`;
  const narrationJob = resolveNarration(input.narration, narrationTag);

  const [reports, stockImages, narration] = await Promise.all([
    Promise.all(
      clips.map((c) =>
        analyzeReferenceClip(c.path, { index: c.index, total: clips.length }),
      ),
    ),
    stockTopicJob,
    narrationJob,
  ]);
  console.log(
    `[refOrchestrator] all ${reports.length} clip reports ready | stock=${stockImages.length} | narration=${narration ? "ready" : "none"}`,
  );

  // 3. Per-clip composer in parallel. Each composer call returns ONE artboard
  //    (its own customComponents). Audio + bpm passed to every clip so each
  //    one composes on the SAME beat grid; stock images passed to each so any
  //    clip can use them.
  const outputs = await Promise.all(
    clips.map((c, i) =>
      composeClip({
        index: c.index,
        total: clips.length,
        durationMs: c.durationMs,
        report: reports[i],
        clipPath: c.path,
        userDescription: input.description,
        brandHint: input.brandHint,
        audio: input.audio,
        images: input.images,
        stockImages,
        width: input.width,
        height: input.height,
      }),
    ),
  );
  console.log(
    `[refOrchestrator] all ${outputs.length} clip composers done — merging`,
  );

  // 4. Merge artboards + attach narration if present.
  const doc = mergeClipsToDoc(
    outputs,
    input.audio ?? null,
    input.width ?? 1920,
    input.height ?? 1080,
  );
  if (narration) doc.narration = narration;

  return { doc, clips, reports, outputs };
}
