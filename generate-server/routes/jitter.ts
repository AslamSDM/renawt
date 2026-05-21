import { Router } from "express";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { spawn } from "child_process";
import type { AuthenticatedRequest } from "../lib/auth";
import { captureForJitter } from "../lib/screenshots/jitterCapture";
import { generateVideoFromScreenshot } from "../lib/agents/urlToJitter";

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

  console.log(`[jitter] user=${userId} project=${tag} url=${body.url}`);

  try {
    // 1. Capture screenshot via scraper-service → R2.
    const shot = await captureForJitter(body.url, tag, {
      width: body.width ?? 1920,
      height: body.height ?? 1080,
    });
    console.log(`[jitter] screenshot → ${shot.url}`);

    // 2. Run orchestrator. Vision-capable callees accept the R2 URL as the
    //    "path" arg. If the caller picked a track, pass it as audioOverride
    //    so the composer aligns to THAT BPM up-front (instead of letting the
    //    picker bias the beat grid then swapping audio after).
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
      jobId: tag,
      userId,
      projectId: body.projectId,
    });

    const doc = result.composer.doc;

    // 4. Persist props + render mp4 — both into served public dirs.
    const propsDir = join(REPO_ROOT, "public", "jitter", "renders");
    if (!existsSync(propsDir)) mkdirSync(propsDir, { recursive: true });
    const propsPath = join(propsDir, `${tag}-doc.json`);
    writeFileSync(propsPath, JSON.stringify(doc, null, 2));

    const mp4Filename = `${tag}-${Date.now()}.mp4`;
    const mp4Path = join(propsDir, mp4Filename);

    await runRemotionRender(propsPath, mp4Path);
    console.log(`[jitter] rendered → ${mp4Path}`);

    // The mp4 lives in the repo /public dir → both Next dev server (3000)
    // and the express static mount below serve it.
    return res.json({
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
    });
  } catch (err) {
    console.error("[jitter] failed:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Jitter pipeline failed",
    });
  }
});

export default router;
