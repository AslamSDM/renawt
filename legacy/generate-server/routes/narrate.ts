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
import {
  chatWithGeminiFlash,
  SCRIPT_WRITER_CONFIG,
  type ChatMessage,
} from "../lib/agents/model";

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

// ============================================================
// POST /narrate/generate-script — LLM-write voice-over script
// ============================================================
router.post(
  "/narrate/generate-script",
  async (req: AuthenticatedRequest, res) => {
    const {
      url,
      durationMs,
      notes,
      brandReport,
      tone,
    }: {
      url?: string;
      durationMs?: number;
      notes?: string;
      brandReport?: { productName?: string; tagline?: string; description?: string };
      tone?: string;
    } = req.body || {};

    if (!url?.trim() && !notes?.trim() && !brandReport) {
      return res
        .status(400)
        .json({ error: "url, notes, or brandReport is required" });
    }

    const seconds = Math.max(4, Math.min(60, Math.round((durationMs ?? 16000) / 1000)));
    // ~2.4 words/sec for natural narration pacing
    const targetWords = Math.max(8, Math.round(seconds * 2.4));

    const credits = await checkAndDeductCredits(req.userId!, COSTS.editScript);
    if (!credits.ok) {
      return res
        .status(402)
        .json({ error: credits.error, required: COSTS.editScript });
    }

    const system =
      "You write tight, punchy voice-over scripts for product videos. " +
      "Output ONLY the spoken script — no scene directions, no stage cues, no labels, no markdown. " +
      "Plain sentences a narrator can read aloud. Hook in the first 4 words.";

    const userParts: string[] = [];
    if (url?.trim()) userParts.push(`Source URL: ${url.trim()}`);
    if (brandReport?.productName)
      userParts.push(`Product: ${brandReport.productName}`);
    if (brandReport?.tagline) userParts.push(`Tagline: ${brandReport.tagline}`);
    if (brandReport?.description)
      userParts.push(`About: ${brandReport.description}`);
    if (notes?.trim()) userParts.push(`Direction: ${notes.trim()}`);
    if (tone?.trim()) userParts.push(`Tone: ${tone.trim()}`);
    userParts.push(
      `Target duration: ${seconds}s (~${targetWords} words). Stay within ±10%.`,
    );
    userParts.push(
      "Write the script now. Output only the spoken words, nothing else.",
    );

    const messages: ChatMessage[] = [
      { role: "system", content: system },
      { role: "user", content: userParts.join("\n") },
    ];

    try {
      const { content } = await chatWithGeminiFlash(messages, SCRIPT_WRITER_CONFIG);
      const script = content
        .replace(/^```[\w]*\n?|```$/g, "")
        .replace(/^\s*(?:scene|narrator|vo|voice[- ]?over)\s*\d*\s*[:\-]\s*/gim, "")
        .trim();
      if (!script) {
        return res.status(500).json({ error: "Empty script from LLM" });
      }
      const wordCount = script.split(/\s+/).filter(Boolean).length;
      return res.json({
        script,
        wordCount,
        estimatedDurationSec: estimateNarrationDuration(script),
        targetSeconds: seconds,
      });
    } catch (error) {
      console.error("[Narrate] Script-gen error:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Script generation failed",
      });
    }
  },
);

export default router;
