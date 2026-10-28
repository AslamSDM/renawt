import { SKIN_PRESETS, getNiche, type IdentityKit, type Persona, type VisualSkin, type Voice } from "@remawt/shared";

export interface VoiceOption {
  voiceId: string;
  name: string;
  provider: Voice["provider"];
  previewUrl?: string | null;
  tags?: string[];
}

/** Fish Audio default narrators (engine FISH_DEFAULT_VOICES), used when the engine's /v1/voices is unreachable. */
export const FALLBACK_VOICES: VoiceOption[] = [
  { voiceId: "536d3a5e000945adb7038665781a4aca", name: "Ethan", provider: "fish", tags: ["neutral", "educational", "narration", "male"] },
  { voiceId: "bf322df2096a46f18c579d0baa36f41d", name: "Adrian", provider: "fish", tags: ["calm", "storytelling", "narration", "male"] },
  { voiceId: "802e3bc2b27e49c2995d23ef70e6ac89", name: "Energetic Male", provider: "fish", tags: ["energetic", "social-media", "clear", "male"] },
];

export const DISPLAY_FONTS = ["Inter", "EB Garamond", "Space Grotesk", "Fraunces", "Patrick Hand", "JetBrains Mono"] as const;

export const DEFAULT_PERSONA: Persona = {
  tone: { formal: 0.35, energy: 0.6, humor: 0.3, density: 0.55 },
  pov: "second",
  signaturePhrases: [],
  avoid: [],
  language: "en",
};

export function defaultSkin(): VisualSkin {
  return structuredClone(SKIN_PRESETS[0]);
}

export function defaultVoice(v: VoiceOption = FALLBACK_VOICES[0]): Voice {
  return { provider: v.provider, voiceId: v.voiceId, name: v.name, speed: 1, stability: 0.5, isClone: false };
}

/** Niche-flavoured copy for previews and examples. */
export function nicheCopy(slug: string | null | undefined) {
  const n = slug ? getNiche(slug) : undefined;
  const k = n?.keywords[0] ?? "this";
  const map: Record<string, { headline: string; stat: string; audience: string; promise: string }> = {
    "personal-finance": { headline: "Why your savings lose money every year", stat: "3.4%", audience: "people in their 20s starting to save", promise: "one money idea explained visually in under a minute" },
    investing: { headline: "Most fund managers lose to the index", stat: "88%", audience: "first-time investors", promise: "market mechanics without the jargon" },
    history: { headline: "Rome marched 30 km before breakfast", stat: "30 km", audience: "curious people who skipped history class", promise: "one surprising moment from history, mapped and timed" },
    psychology: { headline: "Your brain edits every memory you replay", stat: "1 in 3", audience: "people who like knowing why they do things", promise: "one cognitive bias, shown not told" },
    science: { headline: "Light from the Sun is 8 minutes old", stat: "8:20", audience: "students and lifelong learners", promise: "a physics fact you can explain to a friend after" },
    "ai-tools": { headline: "This AI model reads 1M tokens at once", stat: "1M", audience: "builders keeping up with AI", promise: "one AI release and what it means, in 45 seconds" },
  };
  return (
    (slug ? map[slug] : undefined) ?? {
      headline: `What nobody tells you about ${k.toLowerCase()}`,
      stat: "73%",
      audience: `people curious about ${(n?.name ?? "the topic").toLowerCase()}`,
      promise: `one ${(n?.name ?? "topic").toLowerCase()} idea explained visually per video`,
    }
  );
}

export type KitDraft = Omit<IdentityKit, "version"> & { version?: 1 };
