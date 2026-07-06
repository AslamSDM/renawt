import { Router } from "express";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import type { AuthenticatedRequest } from "../lib/auth";
import { generateThreeVideo } from "../lib/agents/threeDirector";
import { applyThreeCritique } from "../lib/agents/threeCritic";
import { routeRender } from "../lib/render/renderRouter";
import { noopProgress, type ProgressEmit } from "../lib/agents/progress";

const router: Router = Router();
const REPO_ROOT =
  process.env.REPO_ROOT || resolve(__dirname, "..", "..");

// ============================================================
// GET /three — API docs
// ============================================================
router.get("/three", (_req, res) => {
  res.json({
    endpoint: "/api/creative/three",
    method: "POST",
    body: {
      description: "string (required) — video brief",
      brandHint:
        "object (optional) — { productName, tagline, features[{title,description}], cta }",
      durationSeconds: "number (default 600 — 10 minutes)",
      width: "number (default 1920)",
      height: "number (default 1080)",
      fps: "number (default 30)",
      narration:
        "object (optional) — { text?, audioUrl?, voiceId?, volume?, startMs? }",
      stockImageTopics: "string[] (optional)",
      stockImageUrls: "string[] (optional)",
      images: "string[] (optional) — hero/logo URLs",
      applyCritic: "boolean (default true) — auto-apply critic fixes",
      async: "boolean (default false) — respond 202 + callback when done",
      callbackUrl: "string (optional) — full URL for async result POST",
      projectId: "string (optional) — id used in render filenames",
    },
    returns:
      "{ videoUrl, plan: {beats, cameraRig, postFXPreset, hdri}, spec: {durationInFrames, objects, beats}, criticIssues, narration? }",
  });
});

interface ThreeBody {
  description: string;
  brandHint?: {
    productName?: string;
    tagline?: string;
    features?: Array<{ title: string; description?: string }>;
    cta?: string;
  };
  durationSeconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  narration?: {
    text?: string;
    audioUrl?: string;
    voiceId?: string;
    volume?: number;
    startMs?: number;
  } | null;
  stockImageTopics?: string[];
  stockImageUrls?: string[];
  images?: string[];
  applyCritic?: boolean;
  async?: boolean;
  callbackUrl?: string;
  projectId?: string;
}

async function runThreePipeline(
  body: ThreeBody,
  userId: string,
  tag: string,
  onProgress?: ProgressEmit,
) {
  const result = await generateThreeVideo({
    description: body.description,
    brandHint: body.brandHint,
    durationSeconds: body.durationSeconds ?? 600,
    width: body.width,
    height: body.height,
    fps: body.fps,
    narration: body.narration ?? undefined,
    stockImageTopics: body.stockImageTopics,
    stockImageUrls: body.stockImageUrls,
    images: body.images,
    userId,
    projectId: body.projectId,
    jobId: tag,
    onProgress: onProgress ?? noopProgress,
  });

  // Optionally apply critic fixes in-place before rendering
  let criticSummary = { rewritten: 0, dropped: 0 };
  if (body.applyCritic !== false && result.criticIssues.length > 0) {
    criticSummary = applyThreeCritique(result.spec, {
      issues: result.criticIssues,
    });
  }

  // Persist the SceneSpec for debugging / re-render
  const outDir = join(REPO_ROOT, "public", "three", "specs");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const specPath = join(outDir, `${tag}-spec.json`);
  writeFileSync(specPath, JSON.stringify(result.spec, null, 2));

  // Audio: if narration produced a url, pass it to the renderer for
  // post-mux. Stock images aren't muxed — they're already referenced inside
  // the spec object props (TextureLoader fetches them at render time).
  const audioUrls: string[] = [];
  if (result.narration?.url) audioUrls.push(result.narration.url);

  const status = await routeRender({
    mode: "3d",
    spec: result.spec,
    projectId: body.projectId,
    audioUrls,
    onProgress: (s) =>
      onProgress?.({
        step: "render",
        label: "3D render",
        status: s.status === "completed" ? "done" : s.status === "failed" ? "failed" : "running",
        detail: s.error ?? `${Math.round((s.progress ?? 0) * 100)}%`,
      }),
  });

  return { result, criticSummary, status };
}

router.post("/three", async (req: AuthenticatedRequest, res) => {
  const userId = req.userId || "dev-user";
  const body = (req.body || {}) as ThreeBody;
  const tag = body.projectId || `three-${Date.now()}`;

  if (!body?.description) {
    return res.status(400).json({ error: "description is required" });
  }

  console.log(`[three] user=${userId} project=${tag} duration=${body.durationSeconds ?? 600}s`);

  // Async mode: respond 202 immediately, POST result to callbackUrl when done
  if (body.async && body.callbackUrl) {
    res.status(202).json({ jobId: tag, status: "queued" });
    try {
      const { result, criticSummary, status } = await runThreePipeline(body, userId, tag);
      const payload = {
        jobId: tag,
        videoUrl: status.videoUrl,
        renderStatus: status.status,
        renderError: status.error,
        plan: {
          beats: result.plan.beats.length,
          cameraRig: result.plan.cameraRig,
          postFXPreset: result.plan.postFXPreset,
          hdri: result.plan.hdri,
        },
        spec: {
          durationInFrames: result.spec.durationInFrames,
          objects: result.spec.objects.length,
          beats: result.spec.beats.length,
        },
        criticIssues: result.criticIssues.length,
        criticApplied: criticSummary,
        narration: result.narration
          ? { url: result.narration.url }
          : null,
      };
      await fetch(body.callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      console.log(`[three] callback sent to ${body.callbackUrl}`);
    } catch (err) {
      console.error(`[three] async pipeline failed:`, err);
      try {
        await fetch(body.callbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: tag,
            renderStatus: "failed",
            renderError: err instanceof Error ? err.message : "Unknown error",
          }),
          signal: AbortSignal.timeout(15000),
        });
      } catch {
        // best-effort
      }
    }
    return;
  }

  // Sync mode: hold the request, return the final result
  try {
    const { result, criticSummary, status } = await runThreePipeline(body, userId, tag);
    if (status.status !== "completed") {
      return res.status(502).json({
        error: status.error || "Render failed",
        renderStatus: status.status,
        spec: {
          durationInFrames: result.spec.durationInFrames,
          objects: result.spec.objects.length,
          beats: result.spec.beats.length,
        },
      });
    }
    return res.json({
      videoUrl: status.videoUrl,
      r2Key: status.r2Key,
      renderTime: status.renderTime,
      plan: {
        beats: result.plan.beats.map((b) => ({
          name: b.name,
          startFrame: b.startFrame,
          endFrame: b.endFrame,
          layers: b.layers.length,
        })),
        cameraRig: result.plan.cameraRig,
        postFXPreset: result.plan.postFXPreset,
        hdri: result.plan.hdri,
      },
      spec: {
        durationInFrames: result.spec.durationInFrames,
        objects: result.spec.objects.length,
        beats: result.spec.beats.length,
        specFile: `/three/specs/${tag}-spec.json`,
      },
      criticIssues: result.criticIssues.length,
      criticApplied: criticSummary,
      narration: result.narration
        ? { url: result.narration.url }
        : null,
      stockImages: result.stockImages.length,
    });
  } catch (err) {
    console.error("[three] failed:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Three pipeline failed",
    });
  }
});

export default router;