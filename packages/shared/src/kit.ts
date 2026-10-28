import { z } from "zod";

/** Persistent Channel Identity Kit — applied to every video; content varies. */
export const VisualSkinSchema = z.object({
  id: z.string(),                       // skin preset id or "custom"
  name: z.string(),
  palette: z.object({
    bg: z.string(),                     // hex
    surface: z.string(),
    ink: z.string(),
    accent: z.string(),
    accent2: z.string().optional(),
  }),
  type: z.object({
    display: z.string(),                // Google font family for headlines
    body: z.string(),
    mono: z.string().optional(),
  }),
  motion: z.enum(["snappy", "smooth", "editorial", "playful"]),
  captionStyle: z.enum(["bottom", "centered", "karaoke", "minimal"]),
  grain: z.boolean().default(false),
  shapes: z.enum(["sharp", "rounded", "pill"]).default("sharp"),
  intro: z.object({ enabled: z.boolean(), sting: z.string().optional() }).default({ enabled: false }),
  outro: z.object({ enabled: z.boolean(), cta: z.string().optional() }).default({ enabled: false }),
  /** Hand-drawn (Excalidraw-style) rendering: blocks draw stroke by stroke, text is hand-written one line at a time. */
  handdrawn: z.boolean().optional(),
});
export type VisualSkin = z.infer<typeof VisualSkinSchema>;

export const VoiceSchema = z.object({
  provider: z.enum(["fish", "elevenlabs", "kokoro", "inworld"]).default("fish"),
  voiceId: z.string(),
  name: z.string(),
  speed: z.number().min(0.8).max(1.2).default(1),
  stability: z.number().min(0).max(1).default(0.5),
  isClone: z.boolean().default(false),
});
export type Voice = z.infer<typeof VoiceSchema>;

export const PersonaSchema = z.object({
  name: z.string().optional(),          // narrator name, e.g. "The Ledger"
  tone: z.object({
    formal: z.number().min(0).max(1),   // 0 casual – 1 formal
    energy: z.number().min(0).max(1),
    humor: z.number().min(0).max(1),
    density: z.number().min(0).max(1), // facts per second
  }),
  pov: z.enum(["first", "second", "third"]).default("second"),
  signaturePhrases: z.array(z.string()).max(5).default([]),
  avoid: z.array(z.string()).default([]),
  sampleScript: z.string().optional(),
  language: z.string().default("en"),
});
export type Persona = z.infer<typeof PersonaSchema>;

export const MascotSchema = z.object({
  enabled: z.boolean().default(false),
  name: z.string().optional(),
  description: z.string().optional(),   // "a round blue owl with a monocle"
  styleRef: z.string().optional(),      // Recraft style id or seed
  imageUrl: z.string().optional(),      // canonical R2 asset
});
export type Mascot = z.infer<typeof MascotSchema>;

export const IdentityKitSchema = z.object({
  version: z.literal(1).default(1),
  audience: z.string(),                 // "beginner investors in their 20s"
  promise: z.string(),                  // "one money concept explained visually per video"
  skin: VisualSkinSchema,
  voice: VoiceSchema,
  persona: PersonaSchema,
  mascot: MascotSchema.default({ enabled: false }),
  formatPrefs: z.array(z.string()).default([]), // format ids
  forbiddenTopics: z.array(z.string()).default([]),
  defaultDurationSec: z.number().min(20).max(90).default(45),
  platformsTarget: z.array(z.enum(["TIKTOK", "YOUTUBE", "INSTAGRAM"])).default(["YOUTUBE", "TIKTOK", "INSTAGRAM"]),
});
export type IdentityKit = z.infer<typeof IdentityKitSchema>;

/** Starter skins (six flat + two hand-drawn). Previews are rendered per channel with niche-specific copy. */
export const SKIN_PRESETS: VisualSkin[] = [
  { id: "ledger", name: "Ledger", palette: { bg: "#07070a", surface: "#14141a", ink: "#f5f5f7", accent: "#3b82f6" }, type: { display: "Inter", body: "Inter", mono: "JetBrains Mono" }, motion: "editorial", captionStyle: "bottom", grain: false, shapes: "sharp", intro: { enabled: true }, outro: { enabled: true } },
  { id: "paper", name: "Paper", palette: { bg: "#f6f1e7", surface: "#ffffff", ink: "#1a1a1a", accent: "#d14b2a" }, type: { display: "EB Garamond", body: "Inter" }, motion: "smooth", captionStyle: "centered", grain: true, shapes: "sharp", intro: { enabled: false }, outro: { enabled: true } },
  { id: "neon", name: "Neon", palette: { bg: "#0b0b12", surface: "#15152a", ink: "#ffffff", accent: "#a3ff12", accent2: "#ff2ea6" }, type: { display: "Space Grotesk", body: "Inter" }, motion: "snappy", captionStyle: "karaoke", grain: false, shapes: "rounded", intro: { enabled: true }, outro: { enabled: false } },
  { id: "chalk", name: "Chalk", palette: { bg: "#1f2a24", surface: "#27352e", ink: "#f2f2e9", accent: "#ffd166" }, type: { display: "Patrick Hand", body: "Inter" }, motion: "playful", captionStyle: "bottom", grain: true, shapes: "rounded", intro: { enabled: false }, outro: { enabled: true } },
  { id: "terminal", name: "Terminal", palette: { bg: "#0a0f0a", surface: "#101810", ink: "#d7ffd7", accent: "#39ff14" }, type: { display: "JetBrains Mono", body: "JetBrains Mono", mono: "JetBrains Mono" }, motion: "snappy", captionStyle: "minimal", grain: false, shapes: "sharp", intro: { enabled: true }, outro: { enabled: false } },
  { id: "pastel", name: "Pastel", palette: { bg: "#fdf6ff", surface: "#ffffff", ink: "#2b2140", accent: "#7c5cff", accent2: "#ffb3c7" }, type: { display: "Fraunces", body: "Inter" }, motion: "smooth", captionStyle: "centered", grain: false, shapes: "pill", intro: { enabled: false }, outro: { enabled: true } },
  // Hand-drawn Excalidraw look (3Blue1Brown palette on #1F2126, Excalifont). Embedded font; Kalam is the Google fallback.
  { id: "sketch", name: "Sketch", palette: { bg: "#1F2126", surface: "#2A2D34", ink: "#ECECEC", accent: "#58C4DD", accent2: "#F0AC5F" }, type: { display: "Excalifont", body: "Excalifont" }, motion: "playful", captionStyle: "minimal", grain: true, shapes: "rounded", intro: { enabled: false }, outro: { enabled: true }, handdrawn: true },
  { id: "sketch-paper", name: "Sketch Paper", palette: { bg: "#FAF8F3", surface: "#F1ECE1", ink: "#1E1E1E", accent: "#1971C2", accent2: "#E8590C" }, type: { display: "Excalifont", body: "Excalifont" }, motion: "playful", captionStyle: "minimal", grain: true, shapes: "rounded", intro: { enabled: false }, outro: { enabled: true }, handdrawn: true },
];
