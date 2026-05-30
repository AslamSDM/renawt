import { Router } from "express";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { spawn } from "child_process";
import { SignJWT } from "jose";
import type { AuthenticatedRequest } from "../lib/auth";
import { captureForJitter } from "../lib/screenshots/jitterCapture";
import { generateVideoFromScreenshot } from "../lib/agents/urlToJitter";
import { sanitizeR2UrlsDeep } from "../lib/storage/r2";
import { noopProgress, type ProgressEmit, type ProgressEvent } from "../lib/agents/progress";

const router: Router = Router();

const REPO_ROOT =
  process.env.REPO_ROOT || resolve(__dirname, "..", "..");

// ============================================================
// GET /jitter — API docs
// ============================================================
router.get("/jitter", (_req, res) => {
  res.json({
    endpoint: "/api/creative/jitter",
    method: "POST",
    body: {
      url: "string (required) - source page to capture",
      audio:
        "object (optional) - { url, bpm, volume? } to override picker",
      durationMs: "number (default 16000)",
      notes: "string (optional) - extra art direction",
      width: "number (default 1920)",
      height: "number (default 1080)",
      projectId: "string (optional) - id used in screenshot/render filenames",
    },
    returns:
      "{ videoUrl, brandReport, music, doc: {artboards, operations, customComponents, durationMs} }",
  });
});

interface JitterBody {
  url: string;
  /** Run pipeline in background, respond 202 immediately, callback when done. */
  async?: boolean;
  /** Generation row id (used for log/correlation only — callback writes to it). */
  generationId?: string;
  /** Full URL the worker POSTs result to when done (Next PATCH endpoint). */
  callbackUrl?: string;
  audio?:
    | { url: string; bpm: number; volume?: number; title?: string }
    | null;
  /** Voice-over narration. Either text (TTS) or audioUrl (pre-existing). */
  narration?: {
    text?: string;
    audioUrl?: string;
    voiceId?: string;
    volume?: number;
    startMs?: number;
    durationMs?: number;
  } | null;
  /** Stock-image topics → Unsplash search. */
  stockImageTopics?: string[];
  /** Or pass already-fetched URLs. */
  stockImageUrls?: string[];
  /** User-uploaded named assets (logos, screen recordings, photos). */
  userAssets?: Array<{
    url: string;
    alias: string;
    kind: "image" | "video";
    name?: string;
    description?: string;
  }>;
  /** Caption track config. Chunks are auto-derived from narration text. */
  captions?: {
    enabled?: boolean;
    style?: "bottom" | "centered" | "minimal";
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    background?: string;
  } | null;
  durationMs?: number;
  notes?: string;
  width?: number;
  height?: number;
  projectId?: string;
}

function runRemotionRender(propsPath: string, mp4Path: string): Promise<void> {
  return new Promise((res, rej) => {
    const child = spawn(
      "npx",
      [
        "remotion",
        "render",
        "remotion/Root.tsx",
        "JitterComposition",
        mp4Path,
        `--props=${propsPath}`,
      ],
      { cwd: REPO_ROOT, stdio: "inherit" },
    );
    child.on("exit", (code) =>
      code === 0
        ? res()
        : rej(new Error(`remotion render exited ${code}`)),
    );
  });
}

async function runJitterPipeline(
  body: JitterBody,
  tag: string,
  userId: string,
  emit: ProgressEmit = noopProgress,
) {
  await emit({ step: "capture", label: "Capture screenshot", status: "running" });
  const shot = await captureForJitter(body.url, tag, {
    width: body.width ?? 1920,
    height: body.height ?? 1080,
  });
  console.log(`[jitter] screenshot → ${shot.url}`);
  await emit({
    step: "capture",
    label: "Capture screenshot",
    status: "done",
    detail: body.url,
  });

  const result = await generateVideoFromScreenshot({
    url: body.url,
    screenshotPath: shot.url,
    heroImageUrl: shot.url,
    durationMs: body.durationMs ?? 16000,
    extraNotes: body.notes,
    width: body.width,
    height: body.height,
    music: body.audio === null ? false : true,
    audioOverride: body.audio || undefined,
    narration: body.narration || undefined,
    stockImageTopics: body.stockImageTopics,
    stockImageUrls: body.stockImageUrls,
    userAssets: body.userAssets,
    captions: body.captions ?? undefined,
    jobId: tag,
    userId,
    projectId: body.projectId,
    onProgress: emit,
  });

  const doc = result.composer.doc;

  // Heal any private R2 urls (user assets uploaded before R2_PUBLIC_URL was set
  // on the web app) → public domain. Private S3-endpoint urls are ORB-blocked
  // in the Chromium renderer and otherwise hang the render / show blank images.
  sanitizeR2UrlsDeep(doc);

  const propsDir = join(REPO_ROOT, "public", "jitter", "renders");
  if (!existsSync(propsDir)) mkdirSync(propsDir, { recursive: true });
  const propsPath = join(propsDir, `${tag}-doc.json`);
  writeFileSync(propsPath, JSON.stringify(doc, null, 2));

  await emit({ step: "render", label: "Render mp4", status: "running" });
  const mp4Filename = `${tag}-${Date.now()}.mp4`;
  const mp4Path = join(propsDir, mp4Filename);
  await runRemotionRender(propsPath, mp4Path);
  console.log(`[jitter] rendered → ${mp4Path}`);
  await emit({ step: "render", label: "Render mp4", status: "done" });

  return {
    videoUrl: `/jitter/renders/${mp4Filename}`,
    brandReport: result.brandReport,
    music: result.music,
    jitterDoc: doc,
    doc: {
      artboards: doc.conf.artboards.length,
      operations: doc.conf.artboards.reduce(
        (s: number, a: any) => s + a.operations.length,
        0,
      ),
      customComponents: doc.customComponents.length,
      durationMs: doc.conf.artboards.reduce(
        (s: number, a: any) => s + a.duration,
        0,
      ),
    },
  };
}

async function mintCallbackToken(): Promise<string | null> {
  const secret = process.env.API_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[jitter] API_KEY missing — cannot mint callback token");
      return null;
    }
    return "dev";
  }
  const key = new TextEncoder().encode(secret);
  return await new SignJWT({ sub: "internal-worker" })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("callback")
    .setIssuedAt()
    .setExpirationTime("30m")
    .sign(key);
}

async function postCallback(
  callbackUrl: string,
  payload: Record<string, unknown>,
) {
  const token = await mintCallbackToken();
  if (!token) return;
  try {
    const resp = await fetch(callbackUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      console.error(
        `[jitter] callback ${callbackUrl} → ${resp.status} ${await resp.text().catch(() => "")}`,
      );
    }
  } catch (err) {
    console.error("[jitter] callback failed:", err);
  }
}

/** Build a progress emitter that forwards each step event to the Next callback
 *  (server-to-server PATCH) so the browser can poll Generation.progress. Each
 *  emit is best-effort — a dropped progress ping must never fail the pipeline. */
function makeProgressEmitter(callbackUrl: string | undefined): ProgressEmit {
  if (!callbackUrl) return noopProgress;
  return async (e: ProgressEvent) => {
    try {
      await postCallback(callbackUrl, {
        progressEvent: { ...e, at: e.at ?? new Date().toISOString() },
      });
    } catch (err) {
      console.warn("[jitter] progress emit failed (ignored):", err);
    }
  };
}

// ============================================================
// POST /jitter — full URL → mp4 pipeline
// ============================================================
router.post("/jitter", async (req: AuthenticatedRequest, res) => {
  const userId = req.userId || "dev-user";
  const body = (req.body || {}) as JitterBody;
  const tag = body.projectId || `jitter-${Date.now()}`;

  if (!body?.url || !/^https?:\/\//.test(body.url)) {
    return res.status(400).json({ error: "invalid url" });
  }

  console.log(
    `[jitter] user=${userId} project=${tag} url=${body.url} async=${!!body.async}`,
  );

  // Async branch — respond 202 immediately, run pipeline detached, callback on done.
  if (body.async && body.callbackUrl) {
    res.status(202).json({ accepted: true, generationId: body.generationId });
    const emit = makeProgressEmitter(body.callbackUrl);
    (async () => {
      try {
        const out = await runJitterPipeline(body, tag, userId, emit);
        await postCallback(body.callbackUrl!, {
          status: "SUCCEEDED",
          videoUrl: out.videoUrl,
          doc: out.jitterDoc,
          brandReport: out.brandReport,
          music: out.music,
          docSummary: out.doc,
        });
      } catch (err) {
        console.error("[jitter] async failed:", err);
        await postCallback(body.callbackUrl!, {
          status: "FAILED",
          error: err instanceof Error ? err.message : "Jitter pipeline failed",
        });
      }
    })();
    return;
  }

  // Legacy sync branch.
  try {
    const out = await runJitterPipeline(body, tag, userId);
    return res.json(out);
  } catch (err) {
    console.error("[jitter] failed:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Jitter pipeline failed",
    });
  }
});

export default router;
