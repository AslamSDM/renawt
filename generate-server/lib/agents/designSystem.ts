/**
 * DESIGN SYSTEM ROLLER
 *
 * Picks ONE coherent visual style per video so that aesthetics vary
 * run-to-run instead of every video looking the same (same backdrop, same
 * type sizes, same pop effects, only the colors changing).
 *
 * A DesignSystem stays INTERNALLY consistent (one font pairing, one type
 * scale, one motion theme, one layout bias) — coherence WITHIN a video — but
 * is chosen randomly from a curated set so different videos look genuinely
 * different. The composer is told to obey the rolled system instead of the
 * hard-coded defaults baked into the system prompt.
 *
 * The same DesignSystem is reused across every segment of a long video so a
 * stitched 30s reel still reads as one piece.
 */

export type BackdropVariant = "blobs" | "mesh" | "grid" | "dots" | "lines";
export type LayoutBias =
  | "centered"
  | "left-rail"
  | "split"
  | "stacked"
  | "asymmetric";
export type HeadingCase = "upper" | "title" | "sentence";

export interface DesignSystem {
  /** Human label, surfaced to the model + logs. */
  styleName: string;
  /** Two fonts: display for headlines, body for everything else. */
  fonts: { display: string; body: string };
  /** Pixel type scale for a 1080p canvas (scaled linearly by the composer). */
  typeScale: {
    hero: number;
    sub: number;
    body: number;
    caption: number;
    stat: number;
  };
  headingCase: HeadingCase;
  /** Display tracking in px (negative = tighter). */
  letterSpacing: number;
  /** Dominant text alignment for the video. */
  textAlign: "left" | "center";
  layout: LayoutBias;
  motion: {
    /** Allowed ENTRY ops for this style (composer picks ≤2 per scene). */
    entries: string[];
    /** Allowed EXIT ops (pair with the entries). */
    exits: string[];
    /** Text reveal granularity. */
    textSplit: "letters" | "words";
    /** Overall pacing word for the prompt. */
    pace: "snappy" | "smooth" | "punchy";
  };
  /** Signature builtins/effects this style leans on. */
  signatures: string[];
  /** Backdrop look + how bright it is. */
  backdrop: { variant: BackdropVariant; intensity: number; seed: number };
  /** One-line art direction note. */
  vibe: string;
}

interface StylePreset {
  styleName: string;
  fonts: { display: string; body: string };
  typeScale: DesignSystem["typeScale"];
  headingCase: HeadingCase;
  letterSpacing: number;
  textAlign: "left" | "center";
  layout: LayoutBias;
  motion: DesignSystem["motion"];
  signatures: string[];
  backdropVariants: BackdropVariant[];
  intensity: [number, number];
  vibe: string;
}

/**
 * Curated style library. Each is a complete, coherent look. They deliberately
 * differ in font pairing, type scale + ratio, case, layout, motion family, and
 * backdrop so consecutive videos never feel like recolors of one template.
 */
const STYLE_PRESETS: StylePreset[] = [
  {
    styleName: "Swiss Editorial",
    fonts: { display: "Playfair Display", body: "Inter" },
    typeScale: { hero: 116, sub: 56, body: 36, caption: 24, stat: 160 },
    headingCase: "title",
    letterSpacing: -1,
    textAlign: "left",
    layout: "left-rail",
    motion: {
      entries: ["fadeIn", "slideIn", "textIn"],
      exits: ["fadeOut", "slideOut"],
      textSplit: "words",
      pace: "smooth",
    },
    signatures: ["MotionLines", "GlassCard"],
    backdropVariants: ["dots", "lines"],
    intensity: [0.4, 0.6],
    vibe: "Refined magazine layout — serif display, generous margins, calm left-aligned columns.",
  },
  {
    styleName: "Brutalist Display",
    fonts: { display: "Bebas Neue", body: "Space Grotesk" },
    typeScale: { hero: 200, sub: 72, body: 40, caption: 26, stat: 240 },
    headingCase: "upper",
    letterSpacing: 2,
    textAlign: "left",
    layout: "stacked",
    motion: {
      entries: ["growIn", "slideIn"],
      exits: ["growOut", "slideOut"],
      textSplit: "letters",
      pace: "punchy",
    },
    signatures: ["BeatColorSwap", "BeatTextSwap"],
    backdropVariants: ["lines", "grid"],
    intensity: [0.7, 0.95],
    vibe: "Oversized all-caps type that fills the frame, hard snappy cuts, high contrast slabs.",
  },
  {
    styleName: "Neo Glass",
    fonts: { display: "Sora", body: "Manrope" },
    typeScale: { hero: 108, sub: 52, body: 34, caption: 22, stat: 150 },
    headingCase: "sentence",
    letterSpacing: -1,
    textAlign: "center",
    layout: "centered",
    motion: {
      entries: ["blurIn", "fadeIn"],
      exits: ["blurOut", "fadeOut"],
      textSplit: "words",
      pace: "smooth",
    },
    signatures: ["GlassCard", "GlowHalo"],
    backdropVariants: ["mesh", "blobs"],
    intensity: [0.7, 0.9],
    vibe: "Frosted-glass cards floating over soft gradient mesh, gentle focus-in reveals.",
  },
  {
    styleName: "Kinetic Type",
    fonts: { display: "Space Grotesk", body: "Outfit" },
    typeScale: { hero: 148, sub: 60, body: 38, caption: 24, stat: 180 },
    headingCase: "upper",
    letterSpacing: -2,
    textAlign: "center",
    layout: "centered",
    motion: {
      entries: ["textIn", "slideIn"],
      exits: ["textOut", "slideOut"],
      textSplit: "letters",
      pace: "snappy",
    },
    signatures: ["BeatInvert", "GradientText"],
    backdropVariants: ["grid", "lines"],
    intensity: [0.6, 0.85],
    vibe: "Type IS the motion — words rush in letter by letter on the beat, minimal decoration.",
  },
  {
    styleName: "Minimal Mono",
    fonts: { display: "Geist", body: "Geist" },
    typeScale: { hero: 96, sub: 48, body: 32, caption: 22, stat: 140 },
    headingCase: "sentence",
    letterSpacing: -1,
    textAlign: "center",
    layout: "centered",
    motion: {
      entries: ["fadeIn", "slideIn"],
      exits: ["fadeOut", "slideOut"],
      textSplit: "words",
      pace: "smooth",
    },
    signatures: ["NumberCounter"],
    backdropVariants: ["dots"],
    intensity: [0.35, 0.55],
    vibe: "Restrained, lots of negative space, one idea per scene, almost no decoration.",
  },
  {
    styleName: "Vibrant Gradient",
    fonts: { display: "Poppins", body: "DM Sans" },
    typeScale: { hero: 132, sub: 58, body: 38, caption: 24, stat: 190 },
    headingCase: "title",
    letterSpacing: -2,
    textAlign: "center",
    layout: "centered",
    motion: {
      entries: ["growIn", "fadeIn"],
      exits: ["shrinkOut", "fadeOut"],
      textSplit: "words",
      pace: "punchy",
    },
    signatures: ["GradientText", "GlowHalo", "BlurredBlob"],
    backdropVariants: ["mesh", "blobs"],
    intensity: [0.8, 1.0],
    vibe: "Saturated gradient headlines, glowing accents, bouncy scale-in energy.",
  },
  {
    styleName: "Tech Grid",
    fonts: { display: "Sora", body: "Inter" },
    typeScale: { hero: 120, sub: 54, body: 34, caption: 22, stat: 170 },
    headingCase: "upper",
    letterSpacing: 1,
    textAlign: "left",
    layout: "asymmetric",
    motion: {
      entries: ["slideIn", "blurIn"],
      exits: ["slideOut", "blurOut"],
      textSplit: "words",
      pace: "snappy",
    },
    signatures: ["CodeBlock", "ProgressBar", "MotionLines"],
    backdropVariants: ["grid"],
    intensity: [0.6, 0.8],
    vibe: "Engineered, blueprint grid, monospace-flavored labels, precise left-aligned data.",
  },
  {
    styleName: "Magazine Split",
    fonts: { display: "Montserrat", body: "DM Sans" },
    typeScale: { hero: 124, sub: 56, body: 36, caption: 24, stat: 168 },
    headingCase: "title",
    letterSpacing: -1,
    textAlign: "left",
    layout: "split",
    motion: {
      entries: ["slideIn", "fadeIn"],
      exits: ["slideOut", "fadeOut"],
      textSplit: "words",
      pace: "smooth",
    },
    signatures: ["ScreenshotShowcase", "GlassCard"],
    backdropVariants: ["blobs", "dots"],
    intensity: [0.5, 0.7],
    vibe: "Two-column editorial — copy on one side, mockup/visual on the other, balanced.",
  },
];

/** Stable string hash → 32-bit unsigned int (FNV-1a). */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32 PRNG — deterministic when seeded, good distribution. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Jitter a size by ±pct, rounded to the nearest 2px. */
function jitterSize(v: number, pct: number, rng: () => number): number {
  const delta = v * pct * (rng() * 2 - 1);
  return Math.round((v + delta) / 2) * 2;
}

/**
 * Roll a coherent design system. By default fully random per call (so each
 * generation feels fresh). Pass a `seed` string to make it deterministic
 * (e.g. reuse the same look across the segments of one long video).
 */
export function rollDesignSystem(opts: {
  seed?: string;
  /** Bias toward presets that suit this brand mood (still randomized). */
  mood?: string;
} = {}): DesignSystem {
  const baseSeed =
    opts.seed != null
      ? hashSeed(opts.seed)
      : (Math.floor(Math.random() * 0xffffffff) >>> 0);
  const rng = makeRng(baseSeed);

  // Mood softly biases the candidate pool but never hard-locks it, so the
  // same mood still produces varied looks.
  const pool = filterByMood(STYLE_PRESETS, opts.mood);
  const preset = pool[Math.floor(rng() * pool.length)] ?? STYLE_PRESETS[0];

  const variant =
    preset.backdropVariants[
      Math.floor(rng() * preset.backdropVariants.length)
    ] ?? "blobs";
  const [lo, hi] = preset.intensity;
  const intensity = Math.round((lo + rng() * (hi - lo)) * 100) / 100;

  // Per-roll size jitter (±8%) so even the same preset varies between videos.
  const typeScale = {
    hero: jitterSize(preset.typeScale.hero, 0.08, rng),
    sub: jitterSize(preset.typeScale.sub, 0.08, rng),
    body: jitterSize(preset.typeScale.body, 0.06, rng),
    caption: preset.typeScale.caption,
    stat: jitterSize(preset.typeScale.stat, 0.08, rng),
  };

  return {
    styleName: preset.styleName,
    fonts: preset.fonts,
    typeScale,
    headingCase: preset.headingCase,
    letterSpacing: preset.letterSpacing,
    textAlign: preset.textAlign,
    layout: preset.layout,
    motion: preset.motion,
    signatures: preset.signatures,
    backdrop: {
      variant,
      intensity,
      seed: Math.floor(rng() * 1_000_000),
    },
    vibe: preset.vibe,
  };
}

const MOOD_PRESET_BIAS: Record<string, string[]> = {
  minimal: ["Minimal Mono", "Swiss Editorial", "Neo Glass"],
  premium: ["Neo Glass", "Swiss Editorial", "Magazine Split"],
  techy: ["Tech Grid", "Kinetic Type", "Minimal Mono"],
  playful: ["Vibrant Gradient", "Kinetic Type", "Brutalist Display"],
  warm: ["Magazine Split", "Vibrant Gradient", "Swiss Editorial"],
  bold: ["Brutalist Display", "Kinetic Type", "Vibrant Gradient"],
};

function filterByMood(presets: StylePreset[], mood?: string): StylePreset[] {
  if (!mood) return presets;
  const names = MOOD_PRESET_BIAS[mood];
  if (!names?.length) return presets;
  // 70% of the time draw from the biased pool, 30% from everything (variety).
  const biased = presets.filter((p) => names.includes(p.styleName));
  if (!biased.length) return presets;
  // Combine: biased entries appear twice → weighted toward mood, never locked.
  return [...biased, ...biased, ...presets];
}

const CASE_LABEL: Record<HeadingCase, string> = {
  upper: "ALL CAPS",
  title: "Title Case",
  sentence: "Sentence case",
};

/**
 * Render the design system as a prompt block the composer must obey. This
 * OVERRIDES the generic text-sizing / motion defaults in the system prompt.
 */
export function describeDesignSystem(ds: DesignSystem): string {
  const ts = ds.typeScale;
  return `\nDESIGN SYSTEM — "${ds.styleName}" (OBEY THIS over any generic default sizing/motion below; it defines THIS video's look):
${ds.vibe}
- FONTS: headlines/display use "${ds.fonts.display}". Body, labels, captions use "${ds.fonts.body}". Use ONLY these two — never mix in other fonts.
- HEADINGS: ${CASE_LABEL[ds.headingCase]}, letterSpacing ${ds.letterSpacing}px.
- DOMINANT ALIGNMENT: ${ds.textAlign}. LAYOUT BIAS: ${ds.layout} (compose every scene around this — do not default to dead-center stacks unless the bias is "centered").
- TYPE SCALE for a 1080p canvas (scale linearly with min(width,height)/1080; ONE hero size + ONE body size per scene — never two roles at the same size):
   * Hero headline (≤6 words): fontSize=${ts.hero}, weight ${ds.headingCase === "upper" ? 800 : 700}.
   * Section/sub headline (≤8 words): fontSize=${ts.sub}, weight 700.
   * Body / feature copy (≤14 words): fontSize=${ts.body}, weight 500.
   * Caption / label: fontSize=${ts.caption}, weight 500.
   * Stat number (NumberCounter): fontSize=${ts.stat}, weight 800.
- MOTION THEME (${ds.motion.pace}): use ONLY these entries this video — ${ds.motion.entries.join(", ")}; pair with exits — ${ds.motion.exits.join(", ")}. Reveal text split by ${ds.motion.textSplit}. Stay on this family across ALL scenes for coherence.
- SIGNATURE EFFECTS to favor (use 1-2, not all): ${ds.signatures.join(", ")}.
- BACKDROP is already injected (variant "${ds.backdrop.variant}", intensity ${ds.backdrop.intensity}) — design content ON TOP, do not add your own full-bleed background.
DIFFERENTIATE FROM OTHER VIDEOS: commit hard to this style's personality. The hero size, font, alignment, and motion above are what make this video look different from the last one — honor them.`;
}
