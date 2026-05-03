/**
 * Narration Route
 *
 * Generates AI narration audio via ElevenLabs TTS and uploads to R2.
 * Used to preview and produce voice-overs for video compositions.
 *
 * POST /api/creative/narrate
 * GET  /api/creative/narrate/voices
 */

import { Router } from "express";
import { AuthenticatedRequest } from "../lib/auth";
import { checkAndDeductCredits, COSTS } from "../lib/billing";
import {
  generateNarration,
  isElevenLabsConfigured,
  listVoices,
  estimateNarrationDuration,
  VOICE_MAP,
} from "../lib/elevenlabs/elevenlabsService";
import { uploadAudioBufferToR2, isR2Configured } from "../lib/storage/r2";

const router: Router = Router();

// Preset voice list derived from VOICE_MAP — always available, no ElevenLabs key needed for this endpoint
const PRESET_VOICES = Object.entries(VOICE_MAP).map(([key, { id, label }]) => ({
  voice_id: id,
  name: key.charAt(0).toUpperCase() + key.slice(1),
  category: "premade",
  description: label.split(" — ")[1] ?? "",
}));

// ============================================================
// GET /narrate/voices — list available voices
// ============================================================
router.get("/narrate/voices", async (_req, res) => {
  if (!isElevenLabsConfigured()) {
    return res.json({ voices: PRESET_VOICES, source: "preset" });
  }

  try {
    const liveVoices = await listVoices();
    const presetIds = new Set(PRESET_VOICES.map((v) => v.voice_id));
    const customVoices = liveVoices.filter(
      (v) => !presetIds.has(v.voice_id) && v.category !== "premade",
    );

    return res.json({
      voices: [
        ...PRESET_VOICES,
        ...customVoices.map((v) => ({ ...v, description: "Custom voice" })),
      ],
      source: "live",
    });
  } catch {
    return res.json({ voices: PRESET_VOICES, source: "preset" });
  }
});

// ============================================================
// POST /narrate — generate narration audio
// ============================================================
router.post("/narrate", async (req: AuthenticatedRequest, res) => {
  const { text, voiceId, stability, similarityBoost, modelId } = req.body;

  if (!text?.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  if (text.length > 5000) {
    return res.status(400).json({ error: "text too long (max 5000 chars)" });
  }

  const credits = await checkAndDeductCredits(req.userId!, COSTS.narrate);
  if (!credits.ok) {
    return res.status(402).json({ error: credits.error, required: COSTS.narrate });
  }

  if (!isElevenLabsConfigured()) {
    return res.status(503).json({
      error: "ElevenLabs not configured — set ELEVENLABS_API_KEY",
      estimatedDuration: estimateNarrationDuration(text),
    });
  }

  if (!isR2Configured()) {
    return res.status(503).json({ error: "R2 storage not configured" });
  }

  console.log(`[Narrate] User ${req.userId} — ${text.split(/\s+/).length} words`);

  try {
    const result = await generateNarration({
      text: text.trim(),
      voiceId: voiceId || undefined,
      stability: stability !== undefined ? Number(stability) : undefined,
      similarityBoost: similarityBoost !== undefined ? Number(similarityBoost) : undefined,
      modelId: modelId || undefined,
    });

    if (!result.success || !result.buffer) {
      return res.status(500).json({ error: result.error || "Narration generation failed" });
    }

    const uploadResult = await uploadAudioBufferToR2(result.buffer, "audio/mpeg", "narrations");

    if (!uploadResult.success || !uploadResult.url) {
      return res.status(500).json({ error: uploadResult.error || "R2 upload failed" });
    }

    console.log(`[Narrate] Done: ${uploadResult.url} (~${result.estimatedDurationSec?.toFixed(1)}s)`);

    return res.json({
      audioUrl: uploadResult.url,
      duration: result.estimatedDurationSec,
      voiceId: voiceId || VOICE_MAP.rachel.id,
    });
  } catch (error) {
    console.error("[Narrate] Error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Narration failed",
    });
  }
});

export default router;
