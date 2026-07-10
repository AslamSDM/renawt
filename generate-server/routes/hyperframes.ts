import { Router } from "express";
import { SignJWT } from "jose";
import type { AuthenticatedRequest } from "../lib/auth";
import { runHfPipeline } from "../lib/agents/hfDirector";
import { noopProgress, type ProgressEmit, type ProgressEvent } from "../lib/agents/progress";

const router: Router = Router();

router.get("/hyperframes", (_req, res) => {
  res.json({
    endpoint: "/api/creative/hyperframes",
    method: "POST",
    body: {
      url: "string (required) - source page to capture",
      async: "boolean (optional) - run in background and call callbackUrl",
      generationId: "string (optional) - id for async job tracking",
      callbackUrl: "string (optional) - webhook for async progress + result",
      durationMs: "number (default 15000)",
      notes: "string (optional) - extra art direction",
      width: "number (default 1920)",
      height: "number (default 1080)",
      fps: "number (default 30)",
      projectId: "string (optional) - id used in screenshot/render filenames",
      musicMood: "string (optional) - override music mood keyword",
      preferredBpm: "number (optional) - override preferred BPM",
      audioUrl: "string (optional) - user-supplied background music URL",
      imageUrls: "string[] (optional) - extra images to embed",
      narration: "{ text?, audioUrl?, voiceId?, volume?, startMs?, durationMs? } (optional)",
      captions: "{ enabled?, style?, fontFamily?, fontSize?, color?, background? } (optional)",
      sfxEnabled: "boolean (default true) - enable sound effects",
      sceneCount: "number (optional, default 4) - number of scenes to generate",
      registryBlocks: "string[] (optional) - HyperFrames registry blocks/components to install",
      transitionStyle: "string (optional) - push | scale | dissolve | cover | distortion | light | grid | blur | other",
      runCliChecks: "boolean (default true) - run hyperframes lint/validate/inspect before render",
    },
    returns: "{ videoUrl, compositionHtml, sceneFiles, brandReport, renderTime, music, narration, sfx, audioPlan, manifest }",
  });
});

interface HyperframesBody {
  async?: boolean;
  generationId?: string;
  callbackUrl?: string;
  url: string;
  durationMs?: number;
  notes?: string;
  width?: number;
  height?: number;
  fps?: number;
  projectId?: string;
  audioUrl?: string;
  imageUrls?: string[];
  musicMood?: string;
  preferredBpm?: number;
  narration?: {
    text?: string;
    audioUrl?: string;
    voiceId?: string;
    volume?: number;
    startMs?: number;
    durationMs?: number;
  } | null;
  captions?: {
    enabled?: boolean;
    style?: "bottom" | "centered" | "minimal";
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    background?: string;
  } | null;
  sfxEnabled?: boolean;
  sceneCount?: number;
  registryBlocks?: string[];
  transitionStyle?: string;
  runCliChecks?: boolean;
}

async function mintCallbackToken(): Promise<string | null> {
  const secret = process.env.API_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[hyperframes] API_KEY missing — cannot mint callback token");
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

async function postCallback(callbackUrl: string, payload: Record<string, unknown>) {
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
      console.error(`[hyperframes] callback ${callbackUrl} → ${resp.status} ${await resp.text().catch(() => "")}`);
    }
  } catch (err) {
    console.error("[hyperframes] callback failed:", err);
  }
}

function makeProgressEmitter(callbackUrl: string | undefined): ProgressEmit {
  if (!callbackUrl) return noopProgress;
  return async (e: ProgressEvent) => {
    try {
      await postCallback(callbackUrl, {
        progressEvent: { ...e, at: e.at ?? new Date().toISOString() },
      });
    } catch (err) {
      console.warn("[hyperframes] progress emit failed (ignored):", err);
    }
  };
}

function extractPipelineParams(body: HyperframesBody, tag: string, userId: string, emit?: ProgressEmit) {
  return {
    url: body.url,
    durationMs: body.durationMs ?? 15000,
    width: body.width ?? 1920,
    height: body.height ?? 1080,
    fps: body.fps ?? 30,
    extraNotes: body.notes,
    audioUrl: body.audioUrl,
    imageUrls: body.imageUrls,
    projectId: body.projectId,
    tag,
    userId,
    onProgress: emit,
    musicMood: body.musicMood,
    preferredBpm: body.preferredBpm,
    narration: body.narration || undefined,
    captions: body.captions ?? undefined,
    sfxEnabled: body.sfxEnabled,
    sceneCount: body.sceneCount,
    registryBlocks: body.registryBlocks,
    transitionStyle: body.transitionStyle,
    runCliChecks: body.runCliChecks,
  };
}

router.post("/hyperframes", async (req: AuthenticatedRequest, res) => {
  const userId = req.userId || "dev-user";
  const body = (req.body || {}) as HyperframesBody;
  const tag = body.projectId || `hf-${Date.now()}`;

  if (!body?.url || !/^https?:\/\//.test(body.url)) {
    return res.status(400).json({ error: "invalid url" });
  }

  console.log(`[hyperframes] user=${userId} project=${tag} url=${body.url} async=${!!body.async}`);

  if (body.async && body.callbackUrl) {
    res.status(202).json({ accepted: true, generationId: body.generationId });
    const emit = makeProgressEmitter(body.callbackUrl);
    (async () => {
      try {
        const out = await runHfPipeline(extractPipelineParams(body, tag, userId, emit));
        await postCallback(body.callbackUrl!, {
          status: "SUCCEEDED",
          videoUrl: out.videoUrl,
          compositionHtml: out.compositionHtml,
          sceneFiles: out.sceneFiles,
          brandReport: out.brandReport,
          renderTime: out.renderTime,
          music: out.music,
          narration: out.narration,
          sfx: out.sfx,
          audioPlan: out.audioPlan,
          manifest: out.manifest,
        });
      } catch (err) {
        console.error("[hyperframes] async failed:", err);
        await postCallback(body.callbackUrl!, {
          status: "FAILED",
          error: err instanceof Error ? err.message : "HyperFrames pipeline failed",
        });
      }
    })();
    return;
  }

  try {
    const out = await runHfPipeline(extractPipelineParams(body, tag, userId));
    return res.json(out);
  } catch (err) {
    console.error("[hyperframes] failed:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "HyperFrames pipeline failed",
    });
  }
});

export default router;
