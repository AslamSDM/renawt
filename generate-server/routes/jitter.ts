import { Router } from "express";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { spawn } from "child_process";
import type { AuthenticatedRequest } from "../lib/auth";
import { captureForJitter } from "../lib/screenshots/jitterCapture";
import { generateVideoFromScreenshot } from "../lib/agents/urlToJitter";
import { PrismaClient } from "../lib/generated/prisma/index.js";

const router: Router = Router();
const prisma = new PrismaClient();

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
      url: "string (required)",
      audio: "object (optional) - { url, bpm, volume?, title? }",
      durationMs: "number (default 16000)",
      notes: "string (optional)",
      width: "number (default 1920)",
      height: "number (default 1080)",
      projectId: "string (optional)",
    },
    returns: "{ jobId, status }",
    polling: {
      "GET /jitter/jobs/:id": "single job status + result",
      "GET /jitter/jobs": "user's recent jobs (limit 20)",
    },
  });
});

interface JitterBody {
  url: string;
  audio?:
    | { url: string; bpm: number; volume?: number; title?: string }
    | null;
  narration?: {
    text?: string;
    audioUrl?: string;
    voiceId?: string;
    volume?: number;
    startMs?: number;
    durationMs?: number;
  } | null;
  stockImageTopics?: string[];
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

async function runJitterPipeline(
  jobId: string,
  body: JitterBody,
  userId: string,
): Promise<void> {
  const tag = body.projectId || jobId;
  try {
    await prisma.jitterJob.update({
      where: { id: jobId },
      data: { status: "running", phase: "capturing" },
    });

    const shot = await captureForJitter(body.url, tag, {
      width: body.width ?? 1920,
      height: body.height ?? 1080,
    });
    console.log(`[jitter:${jobId}] screenshot → ${shot.url}`);

    await prisma.jitterJob.update({
      where: { id: jobId },
      data: { phase: "composing" },
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
      jobId: tag,
      userId,
      projectId: body.projectId,
    });

    const doc = result.composer.doc;

    await prisma.jitterJob.update({
      where: { id: jobId },
      data: { phase: "rendering" },
    });

    const propsDir = join(REPO_ROOT, "public", "jitter", "renders");
    if (!existsSync(propsDir)) mkdirSync(propsDir, { recursive: true });
    const propsPath = join(propsDir, `${tag}-doc.json`);
    writeFileSync(propsPath, JSON.stringify(doc, null, 2));

    const mp4Filename = `${tag}-${Date.now()}.mp4`;
    const mp4Path = join(propsDir, mp4Filename);

    await runRemotionRender(propsPath, mp4Path);
    console.log(`[jitter:${jobId}] rendered → ${mp4Path}`);

    await prisma.jitterJob.update({
      where: { id: jobId },
      data: {
        status: "completed",
        phase: null,
        videoUrl: `/jitter/renders/${mp4Filename}`,
        brandReport: result.brandReport
          ? JSON.stringify(result.brandReport)
          : null,
        music: result.music ? JSON.stringify(result.music) : null,
        jitterDoc: JSON.stringify(doc),
      },
    });
  } catch (err) {
    console.error(`[jitter:${jobId}] failed:`, err);
    await prisma.jitterJob
      .update({
        where: { id: jobId },
        data: {
          status: "failed",
          phase: null,
          error: err instanceof Error ? err.message : String(err),
        },
      })
      .catch(() => {});
  }
}

// ============================================================
// POST /jitter — enqueue job, return jobId
// ============================================================
router.post("/jitter", async (req: AuthenticatedRequest, res) => {
  const userId = req.userId || "dev-user";
  const body = (req.body || {}) as JitterBody;

  if (!body?.url || !/^https?:\/\//.test(body.url)) {
    return res.status(400).json({ error: "invalid url" });
  }

  const job = await prisma.jitterJob.create({
    data: {
      userId,
      projectId: body.projectId,
      status: "queued",
      url: body.url,
      audio: body.audio ? JSON.stringify(body.audio) : null,
      durationMs: body.durationMs ?? 16000,
      notes: body.notes,
    },
  });

  console.log(`[jitter] queued job=${job.id} user=${userId} url=${body.url}`);

  // Fire and forget — pipeline writes status back to DB.
  void runJitterPipeline(job.id, body, userId);

  return res.status(202).json({ jobId: job.id, status: "queued" });
});

// ============================================================
// GET /jitter/jobs — list user's recent jobs
// ============================================================
router.get("/jitter/jobs", async (req: AuthenticatedRequest, res) => {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const jobs = await prisma.jitterJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      projectId: true,
      status: true,
      phase: true,
      url: true,
      durationMs: true,
      error: true,
      videoUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return res.json({ jobs });
});

// ============================================================
// GET /jitter/jobs/:id — single job status + result
// ============================================================
router.get(
  "/jitter/jobs/:id",
  async (req: AuthenticatedRequest, res) => {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const job = await prisma.jitterJob.findUnique({
      where: { id: req.params.id },
    });
    if (!job || job.userId !== userId) {
      return res.status(404).json({ error: "Not found" });
    }

    const doc = job.jitterDoc ? safeJson(job.jitterDoc) : null;

    return res.json({
      jobId: job.id,
      projectId: job.projectId,
      status: job.status,
      phase: job.phase,
      url: job.url,
      durationMs: job.durationMs,
      error: job.error,
      videoUrl: job.videoUrl,
      brandReport: job.brandReport ? safeJson(job.brandReport) : null,
      music: job.music ? safeJson(job.music) : null,
      jitterDoc: doc,
      doc:
        doc && typeof doc === "object"
          ? summarizeDoc(doc as any)
          : null,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });
  },
);

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function summarizeDoc(doc: any) {
  const artboards = doc?.conf?.artboards || [];
  return {
    artboards: artboards.length,
    operations: artboards.reduce(
      (s: number, a: any) => s + (a?.operations?.length || 0),
      0,
    ),
    customComponents: doc?.customComponents?.length || 0,
    durationMs: artboards.reduce(
      (s: number, a: any) => s + (a?.duration || 0),
      0,
    ),
  };
}

// On process start, mark any jobs that were mid-flight as failed —
// the in-process runner is gone, so they can never finish.
prisma.jitterJob
  .updateMany({
    where: { status: { in: ["queued", "running"] } },
    data: {
      status: "failed",
      phase: null,
      error: "Server restarted while job was in flight",
    },
  })
  .then((r) => {
    if (r.count > 0) {
      console.log(`[jitter] swept ${r.count} stale jobs on startup`);
    }
  })
  .catch(() => {});

export default router;
