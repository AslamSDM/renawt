import { Router } from "express";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { spawn } from "child_process";
import type { AuthenticatedRequest } from "../lib/auth";
import { generateJitterFromReference } from "../lib/agents/jitterReferenceOrchestrator";

const router: Router = Router();
const REPO_ROOT =
  process.env.REPO_ROOT || resolve(__dirname, "..", "..");

router.get("/jitter-reference", (_req, res) => {
  res.json({
    endpoint: "/api/creative/jitter-reference",
    method: "POST",
    body: {
      referenceVideoPath: "string (required) - local path or http URL of reference",
      description: "string (required) - what content to swap in",
      clipSections: "number (default 4)",
      audio: "object (optional) - { url, bpm, volume? } — defaults to none",
      images: "string[] (optional) - hero/logo URLs",
      brandHint: "object (optional) - { productName, tagline, features[], cta }",
      width: "number (default 1920)",
      height: "number (default 1080)",
      projectId: "string (optional) - id used in render filenames",
    },
    returns:
      "{ videoUrl, doc: {artboards, operations, customComponents, durationMs}, clips, reports }",
  });
});

interface JitterRefBody {
  referenceVideoPath: string;
  description: string;
  clipSections?: number;
  audio?: { url: string; bpm: number; volume?: number };
  images?: string[];
  stockImageTopics?: string[];
  stockImageUrls?: string[];
  narration?: {
    text?: string;
    audioUrl?: string;
    voiceId?: string;
    volume?: number;
    startMs?: number;
  } | null;
  brandHint?: {
    productName?: string;
    tagline?: string;
    features?: Array<{ title: string; description?: string }>;
    cta?: string;
  };
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

router.post("/jitter-reference", async (req: AuthenticatedRequest, res) => {
  const userId = req.userId || "dev-user";
  const body = (req.body || {}) as JitterRefBody;
  const tag = body.projectId || `jitref-${Date.now()}`;

  if (!body?.referenceVideoPath) {
    return res
      .status(400)
      .json({ error: "referenceVideoPath is required" });
  }
  if (!body?.description) {
    return res.status(400).json({ error: "description is required" });
  }

  console.log(
    `[jitter-ref] user=${userId} project=${tag} ref=${body.referenceVideoPath}`,
  );

  try {
    const result = await generateJitterFromReference({
      referenceVideoPath: body.referenceVideoPath,
      description: body.description,
      clipSections: body.clipSections ?? 4,
      audio: body.audio,
      images: body.images,
      stockImageTopics: body.stockImageTopics,
      stockImageUrls: body.stockImageUrls,
      narration: body.narration || undefined,
      brandHint: body.brandHint,
      width: body.width,
      height: body.height,
      jobId: tag,
      userId,
      projectId: body.projectId,
    });

    const outDir = join(REPO_ROOT, "public", "jitter", "renders");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const propsPath = join(outDir, `${tag}-doc.json`);
    writeFileSync(propsPath, JSON.stringify(result.doc, null, 2));

    const mp4Filename = `${tag}-${Date.now()}.mp4`;
    const mp4Path = join(outDir, mp4Filename);
    await runRemotionRender(propsPath, mp4Path);

    return res.json({
      videoUrl: `/jitter/renders/${mp4Filename}`,
      clips: result.clips.map((c) => ({
        index: c.index,
        startMs: c.startMs,
        durationMs: c.durationMs,
      })),
      reports: result.reports.map((r) => ({
        summary: r.summary,
        mood: r.mood,
        layout: r.layout,
      })),
      doc: {
        artboards: result.doc.conf.artboards.length,
        operations: result.doc.conf.artboards.reduce(
          (s: number, a: any) => s + a.operations.length,
          0,
        ),
        customComponents: result.doc.customComponents.length,
        durationMs: result.doc.conf.artboards.reduce(
          (s: number, a: any) => s + a.duration,
          0,
        ),
      },
    });
  } catch (err) {
    console.error("[jitter-ref] failed:", err);
    return res.status(500).json({
      error:
        err instanceof Error ? err.message : "Jitter reference flow failed",
    });
  }
});

export default router;
