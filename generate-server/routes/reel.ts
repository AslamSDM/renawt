/**
 * Reel Generation Route
 *
 * New pipeline for fast-paced AI-generated video reels:
 *  1. Takes a script or topic as input
 *  2. Breaks it into fast-paced scenes (max 2s each)
 *  3. Generates narration via ElevenLabs TTS
 *  4. Generates video clips via Google Veo 3
 *  5. Stitches everything together with background music
 *
 * POST /api/creative/reel
 */

import { Router } from "express";
import { AuthenticatedRequest } from "../lib/auth";
import { setupSSE, createSSESend } from "../lib/sse";
import { checkAndDeductCredits, COSTS } from "../lib/billing";
import { withAgentLogging } from "../lib/agentLogger";
import {
  generateReelScript,
  generateReelFromTopic,
  type ReelScript,
} from "../lib/agents/reelScriptWriter";
import {
  generateNarration,
  generateNarrationSegments,
  isElevenLabsConfigured,
  type NarrationSegment,
} from "../lib/elevenlabs/elevenlabsService";
import {
  generateVideoClip,
  generateVideoClips,
  isVeoConfigured,
  type VeoGenerateRequest,
} from "../lib/veo/veoService";
import {
  stitchVideo,
  cleanupTempFiles,
  type ClipInput,
  type NarrationInput,
} from "../lib/video/videoStitcher";
import { uploadVideoToR2, isR2Configured } from "../lib/storage/r2";

const router: Router = Router();

// ============================================================
// GET /reel — API docs
// ============================================================
router.get("/reel", (_req, res) => {
  res.json({
    endpoint: "/api/creative/reel",
    method: "POST",
    description:
      "Generate a fast-paced AI video reel with narration, AI-generated clips, and background music",
    body: {
      script: "string (optional) — Full narration script to use",
      topic: "string (optional) — Topic/idea to generate a reel about (used if no script)",
      style: "string (optional) — Visual style: cinematic, energetic, dramatic, minimal",
      aspectRatio: "string (optional) — 16:9, 9:16, 1:1 (default: 9:16)",
      maxDurationSec: "number (optional) — Max duration in seconds (default: 30)",
      voiceId: "string (optional) — ElevenLabs voice ID",
      backgroundMusicUrl: "string (optional) — URL to background music MP3",
      musicVolume: "number (optional) — Background music volume 0-1 (default: 0.15)",
    },
    returns: "Streaming events: reelScript, narration, clips, stitching, complete",
    cost: COSTS.reel,
    services: {
      elevenlabs: isElevenLabsConfigured() ? "configured" : "NOT configured — set ELEVENLABS_API_KEY",
      veo3: isVeoConfigured() ? "configured" : "NOT configured — set GOOGLE_AI_API_KEY",
      r2: isR2Configured() ? "configured" : "NOT configured",
    },
  });
});

// ============================================================
// POST /reel — Full reel generation pipeline
// ============================================================
router.post("/reel", async (req: AuthenticatedRequest, res) => {
  console.log(
    `[ReelRoute] POST /api/creative/reel | User: ${req.userId}`,
  );

  // Deduct credits
  const credits = await checkAndDeductCredits(req.userId!, COSTS.reel);
  if (!credits.ok) {
    return res
      .status(402)
      .json({ error: credits.error, required: COSTS.reel });
  }

  try {
    const {
      script,
      topic,
      style = "cinematic",
      aspectRatio = "9:16",
      maxDurationSec = 30,
      voiceId,
      backgroundMusicUrl,
      musicVolume = 0.15,
    } = req.body;

    if (!script && !topic) {
      return res
        .status(400)
        .json({ error: "Either 'script' or 'topic' is required" });
    }

    const stopHeartbeat = setupSSE(res);
    const send = createSSESend(res);

    try {
      // ============================================================
      // Step 1: Generate reel script (break into scenes)
      // ============================================================
      send("status", {
        step: "scripting",
        message: "Breaking script into fast-paced scenes...",
      });

      let reelScript: ReelScript;

      if (script) {
        reelScript = await withAgentLogging(
          "reelScriptWriter",
          { scriptLength: script.length, style },
          () =>
            generateReelScript(script, {
              style,
              maxDurationSec,
              aspectRatio,
            }),
        );
      } else {
        reelScript = await withAgentLogging(
          "reelScriptWriter",
          { topic, style },
          () =>
            generateReelFromTopic(topic, {
              style,
              targetDurationSec: maxDurationSec,
              aspectRatio,
            }),
        );
      }

      send("reelScript", reelScript);
      console.log(
        `[ReelRoute] Reel script: ${reelScript.scenes.length} scenes, ${reelScript.totalDurationSec}s`,
      );

      // ============================================================
      // Step 2: Generate narration audio (ElevenLabs)
      // ============================================================
      let narrationSegments: NarrationSegment[] = [];

      if (isElevenLabsConfigured()) {
        send("status", {
          step: "narration",
          message: "Generating narration with ElevenLabs...",
        });

        const segments: NarrationSegment[] = reelScript.scenes.map((scene) => ({
          sceneId: scene.id,
          text: scene.narrationText,
        }));

        narrationSegments = await withAgentLogging(
          "elevenlabsNarration",
          { segmentCount: segments.length, voiceId },
          () => generateNarrationSegments(segments, voiceId),
        );

        const successCount = narrationSegments.filter((s) => s.filePath).length; // filePath set by generateNarrationSegments
        send("narration", {
          generated: successCount,
          total: segments.length,
        });

        console.log(
          `[ReelRoute] Narration: ${successCount}/${segments.length} segments generated`,
        );
      } else {
        console.warn("[ReelRoute] ElevenLabs not configured — skipping narration");
        send("status", {
          step: "narration",
          message: "Narration skipped (ElevenLabs not configured)",
        });
      }

      // ============================================================
      // Step 3: Generate video clips (Google Veo 3)
      // ============================================================
      send("status", {
        step: "generating_clips",
        message: `Generating ${reelScript.scenes.length} video clips with Veo 3...`,
      });

      const veoRequests: VeoGenerateRequest[] = reelScript.scenes.map(
        (scene) => ({
          prompt: scene.visualPrompt,
          durationSec: Math.min(5, Math.max(2, Math.ceil(scene.durationSec) + 1)),
          aspectRatio: aspectRatio as "16:9" | "9:16" | "1:1",
          numberOfVideos: 1,
        }),
      );

      // Generate clips with concurrency of 2 to avoid rate limits
      const veoResults = await withAgentLogging(
        "veoClipGeneration",
        {
          clipCount: veoRequests.length,
          prompts: veoRequests.map((r) => r.prompt.substring(0, 50)),
        },
        () => generateVideoClips(veoRequests, 2),
      );

      const successfulClips = veoResults
        .map((result, i) => ({
          result,
          scene: reelScript.scenes[i],
        }))
        .filter((item) => item.result.success && item.result.clips?.[0]);

      send("clips", {
        generated: successfulClips.length,
        total: reelScript.scenes.length,
        failed: reelScript.scenes.length - successfulClips.length,
      });

      console.log(
        `[ReelRoute] Clips: ${successfulClips.length}/${reelScript.scenes.length} generated`,
      );

      if (successfulClips.length === 0) {
        send("error", {
          errors: ["No video clips were generated. Check Veo 3 API configuration."],
        });
        send("complete", { success: false });
        return res.end();
      }

      // ============================================================
      // Step 4: Download background music if URL provided
      // ============================================================
      let backgroundMusicPath: string | undefined;

      if (backgroundMusicUrl) {
        send("status", {
          step: "music",
          message: "Downloading background music...",
        });

        try {
          const musicResponse = await fetch(backgroundMusicUrl);
          if (musicResponse.ok) {
            const musicBuffer = Buffer.from(await musicResponse.arrayBuffer());
            const { mkdirSync, existsSync, writeFileSync } = await import("fs");
            const { join } = await import("path");
            const { randomUUID } = await import("crypto");

            const musicDir = join(process.cwd(), "tmp", "music");
            if (!existsSync(musicDir)) mkdirSync(musicDir, { recursive: true });

            backgroundMusicPath = join(musicDir, `bg-${randomUUID()}.mp3`);
            writeFileSync(backgroundMusicPath, musicBuffer);
            console.log(`[ReelRoute] Background music downloaded: ${backgroundMusicPath}`);
          }
        } catch (e) {
          console.warn("[ReelRoute] Failed to download background music:", e);
        }
      }

      // ============================================================
      // Step 5: Stitch everything together
      // ============================================================
      send("status", {
        step: "stitching",
        message: "Stitching video clips, narration, and music...",
      });

      // Build clip inputs
      const clipInputs: ClipInput[] = successfulClips.map((item) => ({
        filePath: item.result.clips![0].filePath,
        durationSec: item.scene.durationSec,
        transition: item.scene.transition,
      }));

      // Build narration inputs with correct timing
      const narrationInputs: NarrationInput[] = [];
      let currentTimeSec = 0;

      for (const item of successfulClips) {
        const narration = narrationSegments.find(
          (n) => n.sceneId === item.scene.id && n.filePath,
        );

        if (narration?.filePath) {
          narrationInputs.push({
            filePath: narration.filePath,
            startTimeSec: currentTimeSec,
            durationSec: narration.durationSec || item.scene.durationSec,
          });
        }

        currentTimeSec += item.scene.durationSec;
      }

      const stitchResult = await withAgentLogging(
        "videoStitcher",
        {
          clipCount: clipInputs.length,
          narrationCount: narrationInputs.length,
          hasMusic: !!backgroundMusicPath,
        },
        () =>
          stitchVideo({
            clips: clipInputs,
            narrations: narrationInputs,
            backgroundMusicPath,
            musicVolume,
            aspectRatio: aspectRatio as any,
          }),
      );

      if (!stitchResult.success || !stitchResult.outputPath) {
        send("error", {
          errors: [stitchResult.error || "Video stitching failed"],
        });
        send("complete", { success: false });
        return res.end();
      }

      console.log(
        `[ReelRoute] Stitch complete: ${stitchResult.outputPath} (${stitchResult.totalDurationSec}s)`,
      );

      // ============================================================
      // Step 6: Upload to R2
      // ============================================================
      let videoUrl = stitchResult.outputPath;

      if (isR2Configured()) {
        send("status", {
          step: "uploading",
          message: "Uploading final reel to cloud storage...",
        });

        const uploadResult = await uploadVideoToR2(stitchResult.outputPath);
        if (uploadResult.success && uploadResult.url) {
          videoUrl = uploadResult.url;
          console.log(`[ReelRoute] Uploaded to R2: ${videoUrl}`);
        } else {
          console.warn("[ReelRoute] R2 upload failed, using local path");
        }
      }

      // ============================================================
      // Done!
      // ============================================================
      send("videoUrl", videoUrl);
      send("complete", {
        success: true,
        message: "Reel generation complete",
        videoUrl,
        stats: {
          scenes: reelScript.scenes.length,
          clipsGenerated: successfulClips.length,
          narrationSegments: narrationInputs.length,
          totalDurationSec: stitchResult.totalDurationSec,
        },
      });

      // Cleanup temp files in background
      setTimeout(() => {
        cleanupTempFiles(clipInputs, narrationInputs);
      }, 5000);
    } catch (error) {
      console.error("[ReelRoute] Pipeline error:", error);
      send("error", {
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
      send("complete", { success: false });
    } finally {
      stopHeartbeat();
      res.end();
    }
  } catch (error) {
    console.error("[ReelRoute] Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Reel generation failed" });
    }
  }
});

export default router;
