import { ScriptSchema, type Script, type IdentityKit, type FormatTemplate, getNiche } from "@remawt/shared";
import { generateStructured, type AgentSpec } from "../llm.js";
import type { Quality } from "../models.js";

export const scriptwriterSpec: AgentSpec = {
  id: "scriptwriter",
  name: "Scriptwriter",
  role: "script",
  instructions: `You write voiceover scripts for faceless vertical short-form videos (YouTube Shorts, TikTok, Reels).
Rules (all mandatory):
- The hook must land in the first 2 seconds: ≤12 words, no greeting, no channel intro.
- One fact per sentence. Short sentences. Spoken rhythm, not essay prose.
- Every factual claim (numbers, studies, events) must be backed by an entry in "sources" with a real, specific title and URL. If you are not sure a source exists, soften the claim instead of inventing one.
- Never adopt an "AI advisor" persona. In finance, health, legal or mental-health niches present information, not advice: no "you should buy/sell/take", no guarantees, no diagnoses.
- Never say "as an AI", "I am an AI" or mention language models.
- Write in the channel persona's voice (tone, POV, signature phrases) and avoid everything in its avoid-list.
- Follow the format's beat grammar exactly: one or more lines per beat, every line tagged with its beatId, in beat order.
- Each line's targetSec is the time that line should take when spoken at ~2.6 words/second.
- "onScreen" is the short on-screen text for that line (≤6 words), "visualNote" describes what should be shown.
- estimatedSec = sum of targetSec. Title ≤ 70 chars. 3–6 hashtags without '#'. description: 1–2 sentences.
Return JSON only.`,
};

export interface ScriptInput {
  kit: IdentityKit;
  format: FormatTemplate;
  niche: string;
  targetSec: number;
  idea?: { hook?: string; title?: string; angle?: string | null; beats?: unknown; evidence?: unknown } | null;
  notes?: string;
  previousTitles?: string[];
}

export function buildScriptPrompt(i: ScriptInput): string {
  const niche = getNiche(i.niche);
  const beats = i.format.beats.map((b) => `- ${b.id} (${b.label}, ~${Math.round(b.share * i.targetSec)}s, block ${b.block}): ${b.note}`).join("\n");
  const p = i.kit.persona;
  return [
    `FORMAT: ${i.format.name} — ${i.format.tagline}`,
    `BEATS (in order):\n${beats}`,
    `FORMAT RULES:\n${i.format.scriptRules.map((r) => `- ${r}`).join("\n")}`,
    `TARGET LENGTH: ${i.targetSec}s (allowed ${i.format.minSec}–${i.format.maxSec}s)`,
    `NICHE: ${niche?.name ?? i.niche}${niche?.riskNotes ? `\nNICHE RISK NOTES: ${niche.riskNotes}` : ""}`,
    `AUDIENCE: ${i.kit.audience}\nCHANNEL PROMISE: ${i.kit.promise}`,
    `PERSONA: ${p.name ?? "narrator"}; POV ${p.pov}; formality ${p.tone.formal}, energy ${p.tone.energy}, humor ${p.tone.humor}, density ${p.tone.density}; language ${p.language}`,
    p.signaturePhrases.length ? `SIGNATURE PHRASES (use at most one, naturally): ${p.signaturePhrases.join(" | ")}` : "",
    p.avoid.length ? `AVOID: ${p.avoid.join(" | ")}` : "",
    i.kit.forbiddenTopics.length ? `FORBIDDEN TOPICS: ${i.kit.forbiddenTopics.join(" | ")}` : "",
    p.sampleScript ? `PERSONA SAMPLE:\n${p.sampleScript.slice(0, 1500)}` : "",
    i.idea ? `IDEA:\n${JSON.stringify(i.idea).slice(0, 3000)}` : "",
    i.notes ? `CREATOR NOTES: ${i.notes.slice(0, 1500)}` : "",
    i.previousTitles?.length ? `DON'T REPEAT THESE RECENT TITLES/ANGLES: ${i.previousTitles.slice(0, 30).join(" | ")}` : "",
    `Return a Script JSON object: {title, hook, lines:[{beatId, text, onScreen, visualNote, targetSec}], cta, sources:[{title,url}], hashtags, description, estimatedSec}.`,
  ].filter(Boolean).join("\n\n");
}

export async function writeScript(i: ScriptInput, quality: Quality): Promise<Script> {
  return generateStructured({ spec: scriptwriterSpec, quality, label: "script", schema: ScriptSchema, prompt: buildScriptPrompt(i), maxOutputTokens: 8000 });
}
