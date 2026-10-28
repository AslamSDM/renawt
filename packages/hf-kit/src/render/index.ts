import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Composition } from "@remawt/shared";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { mixFilter, parseAudioTags } from "../audio/index";
import { runHyperframesRender } from "../cli";
import { videoUrlsOf } from "../compose";
import { projectFiles, scaffoldProject } from "../project";
import { getJson, isR2Configured, putJson, statusKey, uploadFile } from "../r2";
import { hash } from "../util";

export type RenderStatus = "queued" | "rendering" | "completed" | "failed";
export interface RenderPoll { status: RenderStatus; videoUrl?: string; error?: string; progress?: number }
export interface SubmitOptions { videoId: string; audioUrls: string[]; callbackUrl?: string; quality?: "draft" | "standard" | "high"; videoUrls?: string[] }

/**
 * Provider selection (env RENDER_PROVIDER):
 *  - "lambda"  → one SQS message to RENDER_QUEUE_URL; the render Lambda writes R2 `status/{jobId}.json`.
 *  - "service" → POST ${HF_RENDER_SERVICE_URL}/render-hf; status via GET /render-hf/:id/status.
 *  - "local"   → `npx hyperframes render` in os.tmpdir() + ffmpeg mux, upload to R2 when configured.
 * Default: lambda if RENDER_QUEUE_URL is set, else service if HF_RENDER_SERVICE_URL is set, else local.
 */
export function renderProvider(): "lambda" | "service" | "local" {
  const p = process.env.RENDER_PROVIDER;
  if (p === "lambda" || p === "service" || p === "local") return p;
  if (process.env.RENDER_QUEUE_URL) return "lambda";
  if (process.env.HF_RENDER_SERVICE_URL) return "service";
  return "local";
}

/** Deterministic job id: same video + same composition → same job (idempotent resubmits). */
export function renderJobId(comp: Composition, videoId: string): string {
  const content = [comp.indexHtml, ...comp.sceneFiles.map((f) => f.html)].join("\u0000");
  return `${videoId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}-${hash(content, 12)}`;
}

function serviceUrl(path: string): string {
  const base = (process.env.HF_RENDER_SERVICE_URL || process.env.RENDER_SERVICE_URL || "http://localhost:4002").replace(/\/$/, "");
  return `${base}/render-hf${path}`;
}

function serviceHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.RENDER_API_KEY) h["x-render-key"] = process.env.RENDER_API_KEY;
  return h;
}

/** Body shared by the Lambda and the render service (legacy HfRenderJobParams). */
export function renderRequestBody(comp: Composition, opts: SubmitOptions, jobId: string) {
  const videoUrls = opts.videoUrls ?? videoUrlsOf(comp);
  return {
    jobId,
    projectFiles: projectFiles(comp),
    entryFile: "index.html",
    durationInFrames: Math.round((comp.durationMs / 1000) * comp.fps),
    width: comp.width,
    height: comp.height,
    fps: comp.fps,
    quality: opts.quality ?? ((process.env.HF_RENDER_QUALITY as SubmitOptions["quality"]) || "standard"),
    outputFormat: "mp4",
    projectId: opts.videoId,
    callbackUrl: opts.callbackUrl,
    // audioUrls: muxed by the Lambda (amix, equal weight, from t=0). videoUrls: footage the
    // composition streams by URL (informational until the Lambda pre-downloads; see docs/REQUESTS.md).
    assets: { audioUrls: opts.audioUrls.length ? opts.audioUrls : undefined, videoUrls: videoUrls.length ? videoUrls : undefined },
  };
}

const localJobs = new Map<string, { videoId: string }>();
const localStatusPath = (jobId: string) => join(tmpdir(), "remawt-hfkit-render", jobId, "status.json");

async function writeStatus(jobId: string, s: RenderPoll & { jobId: string; updatedAt?: string }): Promise<void> {
  const rec = { ...s, updatedAt: new Date().toISOString() };
  mkdirSync(join(tmpdir(), "remawt-hfkit-render", jobId), { recursive: true });
  writeFileSync(localStatusPath(jobId), JSON.stringify(rec));
  if (isR2Configured()) { try { await putJson(statusKey(jobId), rec); } catch { /* best effort */ } }
}

function hasAudioStream(file: string): boolean {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim().length > 0;
}

async function runLocal(comp: Composition, opts: SubmitOptions, jobId: string): Promise<void> {
  const dir = join(tmpdir(), "remawt-hfkit-render", jobId, "project");
  const out = join(tmpdir(), "remawt-hfkit-render", jobId, `hf-${jobId}.mp4`);
  try {
    await writeStatus(jobId, { jobId, status: "rendering", progress: 5 });
    scaffoldProject(comp, dir);
    const quality = opts.quality === "high" ? "delivery" : opts.quality === "draft" ? "draft" : "looks";
    const r = await runHyperframesRender(dir, out, quality);
    if (!r) throw new Error("hyperframes CLI unavailable (npx hyperframes --version failed)");
    if (!r.ok || !existsSync(out)) throw new Error(`hyperframes render failed: ${(r.stderr || r.stdout).slice(-800)}`);
    let final = out;
    if (!hasAudioStream(out)) {
      const tracks = parseAudioTags(comp.indexHtml).filter((t) => t.src);
      if (tracks.length) {
        const { inputs, filter } = mixFilter(tracks, comp.durationMs / 1000);
        final = out.replace(/\.mp4$/, "-mux.mp4");
        const mux = spawnSync("ffmpeg", ["-y", "-i", out, ...inputs.flatMap((i) => ["-i", i]), "-filter_complex", filter.replace(/\[(\d+):a\]/g, (_, n) => `[${Number(n) + 1}:a]`), "-map", "0:v", "-map", "[out]", "-c:v", "copy", "-c:a", "aac", "-shortest", final], { encoding: "utf8" });
        if (mux.status !== 0) final = out; // keep silent video rather than fail
      }
    }
    let videoUrl = `file://${final}`;
    if (isR2Configured()) videoUrl = (await uploadFile(final, `projects/${opts.videoId}/videos/hf-${jobId}.mp4`, "video/mp4")).url;
    const done = { jobId, status: "completed" as const, progress: 100, videoUrl };
    await writeStatus(jobId, done);
    if (opts.callbackUrl) await fetch(opts.callbackUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(done), signal: AbortSignal.timeout(10_000) }).catch(() => undefined);
  } catch (e) {
    await writeStatus(jobId, { jobId, status: "failed", error: e instanceof Error ? e.message : String(e) });
  }
}

/** Submit a render. Idempotent per (videoId, composition content). */
export async function submitRender(comp: Composition, opts: SubmitOptions): Promise<{ jobId: string }> {
  const jobId = renderJobId(comp, opts.videoId);
  const provider = renderProvider();
  if (provider === "lambda") {
    const queueUrl = process.env.RENDER_QUEUE_URL;
    if (!queueUrl) throw new Error("RENDER_QUEUE_URL is not set");
    if (isR2Configured()) {
      const prev = await getJson<{ status?: string }>(statusKey(jobId));
      if (prev?.status === "completed" || prev?.status === "rendering") return { jobId };
    }
    const sqs = new SQSClient({ region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1" });
    await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(renderRequestBody(comp, opts, jobId)) }));
    return { jobId };
  }
  if (provider === "service") {
    const res = await fetch(serviceUrl(""), { method: "POST", headers: serviceHeaders(), body: JSON.stringify(renderRequestBody(comp, opts, jobId)), signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`HF render service error (${res.status}): ${await res.text()}`);
    const j = (await res.json()) as { jobId?: string };
    const id = j.jobId ?? jobId;
    localJobs.set(id, { videoId: opts.videoId });
    return { jobId: id };
  }
  // local
  if (existsSync(localStatusPath(jobId))) {
    const prev = JSON.parse(readFileSync(localStatusPath(jobId), "utf8")) as RenderPoll;
    if (prev.status !== "failed") return { jobId };
  }
  await writeStatus(jobId, { jobId, status: "queued" });
  localJobs.set(jobId, { videoId: opts.videoId });
  void runLocal(comp, opts, jobId);
  return { jobId };
}

function normalise(raw: string | undefined): RenderStatus {
  return raw === "completed" ? "completed" : raw === "failed" ? "failed" : raw === "rendering" || raw === "active" ? "rendering" : "queued";
}

/** Poll a render. Lambda: R2 status object. Service: HTTP (downloads + uploads to R2 on completion). Local: tmp status file. */
export async function pollRender(jobId: string): Promise<RenderPoll> {
  const provider = renderProvider();
  if (provider === "lambda") {
    const s = await getJson<{ status?: string; videoUrl?: string; error?: string; progress?: number }>(statusKey(jobId));
    if (!s) return { status: "queued" };
    const status = normalise(s.status);
    if (status === "completed" && !s.videoUrl) return { status: "failed", error: "render completed without a videoUrl" };
    return { status, videoUrl: s.videoUrl, error: s.error, progress: typeof s.progress === "number" ? s.progress / 100 : undefined };
  }
  if (provider === "service") {
    const res = await fetch(serviceUrl(`/${jobId}/status`), { headers: serviceHeaders(), signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
    const s = (await res.json()) as { status?: string; videoUrl?: string; error?: string; progress?: number };
    const status = normalise(s.status);
    if (status !== "completed" || s.videoUrl) return { status, videoUrl: s.videoUrl, error: s.error, progress: s.progress };
    // Service keeps the file: download it and push to R2 (legacy submitAndWaitForHfRender behaviour).
    const file = await fetch(serviceUrl(`/${jobId}/file`), { headers: serviceHeaders(), signal: AbortSignal.timeout(120_000) });
    if (!file.ok) return { status: "failed", error: `HF file download failed (${file.status})` };
    if (!isR2Configured()) return { status: "failed", error: "R2 not configured" };
    const tmp = join(tmpdir(), `hf-${jobId}.mp4`);
    writeFileSync(tmp, Buffer.from(await file.arrayBuffer()));
    const videoId = localJobs.get(jobId)?.videoId;
    const { url } = await uploadFile(tmp, videoId ? `projects/${videoId}/videos/hf-${jobId}.mp4` : `videos/${jobId}/hf-${jobId}.mp4`, "video/mp4");
    fetch(serviceUrl(`/${jobId}/cleanup`), { method: "DELETE", headers: serviceHeaders() }).catch(() => undefined);
    return { status: "completed", videoUrl: url };
  }
  const p = localStatusPath(jobId);
  if (existsSync(p)) {
    const s = JSON.parse(readFileSync(p, "utf8")) as RenderPoll;
    return { status: normalise(s.status), videoUrl: s.videoUrl, error: s.error, progress: s.progress };
  }
  if (isR2Configured()) {
    const s = await getJson<RenderPoll>(statusKey(jobId));
    if (s) return { status: normalise(s.status), videoUrl: s.videoUrl, error: s.error };
  }
  return { status: "queued" };
}
