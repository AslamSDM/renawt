import { z } from "zod";
import { lenient } from "./coerce";

/**
 * `scene.data` schema for every block. The engine's composer agent fills these; composeVideo
 * validates them and throws with the exact path on failure. `headline` / `body` come from the
 * Scene itself, not from `data`.
 */
const num = z.number().finite();
const text = (max: number) => z.string().min(1).max(max);
const icon = z.string().max(40).describe("lucide icon name, e.g. 'rocket', 'piggy-bank', 'brain'");

export const KineticHeadlineData = z.object({
  kicker: text(40).optional().describe("small label above the headline"),
  emphasis: z.array(z.string()).max(4).default([]).describe("words from the headline to paint in the accent colour"),
  align: z.enum(["center", "left"]).default("center"),
}).default({ emphasis: [], align: "center" });

export const DiagramData = z.object({
  layout: z.enum(["auto", "vertical", "horizontal", "cycle", "hub", "grid"]).default("auto"),
  nodes: z.array(z.object({
    id: text(30),
    label: text(40),
    sub: z.string().max(60).optional(),
    icon: icon.optional(),
    x: num.min(0).max(1).optional().describe("optional manual position 0..1 inside the content box"),
    y: num.min(0).max(1).optional(),
  })).min(1).max(8),
  edges: z.array(z.object({ from: text(30).describe("node id"), to: text(30).describe("node id"), label: z.string().max(24).optional() })).max(12).default([]),
});

export const CounterData = z.object({
  value: num,
  from: num.optional(),
  decimals: z.number().int().min(0).max(3).default(0),
  prefix: z.string().max(4).default(""),
  suffix: z.string().max(8).default(""),
  label: z.string().max(60).optional(),
});

export const ChartData = z.object({
  type: z.enum(["line", "bar", "area"]).default("line"),
  labels: z.array(z.string().max(12)).max(24).optional().describe("x-axis labels, one per value"),
  series: z.array(z.object({ name: text(30), values: z.array(num).min(2).max(24), color: z.string().optional() })).min(1).max(3),
  unit: z.string().max(8).default(""),
  yMin: num.optional(),
  yMax: num.optional(),
  annotations: z.array(z.object({ index: z.number().int().min(0), label: text(32), series: z.number().int().min(0).default(0) })).max(3).default([]),
  source: z.string().max(80).optional().describe("data source shown on screen"),
});

const Side = z.object({ label: text(24), sub: z.string().max(40).optional(), icon: icon.optional(), color: z.string().optional() });
export const SplitTitleData = z.object({ left: Side, right: Side, question: z.string().max(30).default("Which wins?") });

export const SplitStatData = z.object({
  left: Side,
  right: Side,
  rounds: z.array(z.object({
    metric: text(40),
    left: num,
    right: num,
    unit: z.string().max(8).default(""),
    decimals: z.number().int().min(0).max(3).default(0),
    higherIsBetter: z.boolean().default(true),
  })).min(1).max(5),
  roundNumber: z.number().int().min(1).max(9).optional().describe("label 'Round N' for the first round shown"),
});

export const NumberedCardData = z.object({
  n: z.number().int().min(1).max(99),
  total: z.number().int().min(1).max(99).optional(),
  title: z.string().max(60).optional().describe("defaults to scene.headline"),
  body: z.string().max(140).optional().describe("defaults to scene.body"),
  icon: icon.optional(),
});

export const StrikeThroughData = z.object({
  myth: z.string().min(1).max(110).optional().describe("defaults to scene.headline"),
  label: z.string().max(16).default("MYTH"),
  truth: z.string().max(110).optional(),
  truthLabel: z.string().max(16).default("FACT"),
}).default({ label: "MYTH", truthLabel: "FACT" });

export const SourceCardData = z.object({
  quote: text(180),
  source: text(60),
  date: z.string().max(20).optional(),
  url: z.string().max(200).optional(),
  highlight: z.string().max(60).optional().describe("exact substring of quote to highlight"),
  stat: z.object({ value: text(14), label: text(40) }).optional(),
});

export const HeadlineCardData = z.object({
  outlet: text(40),
  headline: z.string().min(1).max(140).optional().describe("defaults to scene.headline"),
  date: z.string().min(1).max(24).optional(),
  url: z.string().max(200).optional(),
  category: z.string().max(20).optional(),
});

export const BulletStackData = z.object({
  items: z.array(z.union([
    z.string().min(1).max(70),
    z.object({ text: text(70), sub: z.string().max(80).optional(), icon: icon.optional() }),
  ])).min(1).max(5),
  numbered: z.boolean().default(false),
});

export const MapData = z.object({
  focus: z.enum(["world", "europe", "asia", "africa", "north-america", "south-america", "americas", "oceania", "middle-east"]).default("world"),
  regions: z.array(z.union([
    z.string().min(1).max(40),
    z.object({ name: text(40), label: z.string().max(30).optional() }),
  ])).max(24).default([]).describe("country names (e.g. 'Japan', 'USA') or continent names"),
  points: z.array(z.object({ lat: num.min(-90).max(90), lon: num.min(-180).max(180), label: z.string().max(24).optional() })).max(8).default([]),
  label: z.string().max(60).optional(),
});

export const IconGridData = z.object({
  items: z.array(z.object({ icon, label: text(28) })).min(2).max(9),
  columns: z.number().int().min(2).max(3).optional(),
});

export const ImageData = z.object({
  assetId: z.string().optional().describe("defaults to scene.assetIds[0]"),
  caption: z.string().max(80).optional(),
  credit: z.string().max(60).optional(),
  kenBurns: z.enum(["in", "out", "left", "right", "none"]).default("in"),
}).default({ kenBurns: "in" });

export const OutroData = z.object({
  cta: z.string().max(40).optional().describe("defaults to kit.skin.outro.cta or 'Follow for more'"),
  handle: z.string().max(30).optional(),
  sub: z.string().max(70).optional(),
}).default({});

/** Play a trimmed range of the user's footage (scene.assetIds[0] = user-video asset). */
export const VideoSegmentData = z.object({
  assetId: z.string().optional().describe("defaults to scene.assetIds[0]"),
  inMs: num.min(0),
  outMs: num.min(1),
  crop: z.union([
    z.enum(["cover", "blur-pad"]),
    z.object({ x: num.min(0), y: num.min(0), w: num.positive(), h: num.positive() }).describe("fractions 0..1 of the source frame (or source px when asset width/height are known)"),
  ]).default("cover"),
}).refine((d) => d.outMs > d.inMs, { message: "outMs must be greater than inMs", path: ["outMs"] });

/** Motion graphics drawn OVER footage. Placed by the scene's absolute startMs/durationMs, not in the back-to-back sequence. */
export const OverlayLowerThirdData = z.object({ name: text(40), title: z.string().max(60).optional() });
export const OverlayKeywordData = z.object({ text: text(32), atMs: num.min(0).optional().describe("absolute video time the word pops; defaults to scene.startMs") });
export const OverlayStatData = z.object({ value: text(14), label: text(48) });
export const OverlayProgressData = z.object({ current: z.number().int().min(1), total: z.number().int().min(1).max(12), label: z.string().max(40).optional() });

/** Strict overlay schemas (renderer contract). */
export const STRICT_OVERLAY_SCHEMAS = {
  "overlay-lower-third": OverlayLowerThirdData,
  "overlay-keyword": OverlayKeywordData,
  "overlay-stat": OverlayStatData,
  "overlay-progress": OverlayProgressData,
} as const;
export type OverlayName = keyof typeof STRICT_OVERLAY_SCHEMAS;
export const OVERLAY_NAMES = Object.keys(STRICT_OVERLAY_SCHEMAS) as OverlayName[];
type LenientMap<M extends Record<string, z.ZodType>> = { [K in keyof M]: z.ZodPipe<z.ZodTransform<unknown, unknown>, M[K]> };
function lenientMap<M extends Record<string, z.ZodType>>(m: M): LenientMap<M> {
  return Object.fromEntries(Object.entries(m).map(([k, s]) => [k, lenient(k, s)])) as LenientMap<M>;
}
/** Lenient overlay schemas: coerce obvious LLM shapes (see ./coerce.ts), then validate strictly. */
export const OVERLAY_SCHEMAS = lenientMap(STRICT_OVERLAY_SCHEMAS);
export function isOverlayBlock(raw: string): raw is OverlayName {
  return String(raw).trim().toLowerCase() in OVERLAY_SCHEMAS;
}

/** Strict block data schemas (renderer contract; used for prompt shapes). */
export const STRICT_BLOCK_SCHEMAS = {
  "kinetic-headline": KineticHeadlineData,
  diagram: DiagramData,
  counter: CounterData,
  chart: ChartData,
  "split-title": SplitTitleData,
  "split-stat": SplitStatData,
  "numbered-card": NumberedCardData,
  "strike-through": StrikeThroughData,
  "source-card": SourceCardData,
  "headline-card": HeadlineCardData,
  "bullet-stack": BulletStackData,
  map: MapData,
  "icon-grid": IconGridData,
  image: ImageData,
  outro: OutroData,
  "video-segment": VideoSegmentData,
} as const;

/**
 * Lenient block data schemas used by composeVideo: bare strings → {label}, "$4,000" → 4000, a bare number
 * series → {values}, key synonyms, too-long text truncated, extra keys stripped. Then the strict schema.
 */
export const BLOCK_SCHEMAS = lenientMap(STRICT_BLOCK_SCHEMAS);

export type BlockName = keyof typeof STRICT_BLOCK_SCHEMAS;
export const BLOCK_NAMES = Object.keys(STRICT_BLOCK_SCHEMAS) as BlockName[];

/** Whether a block needs scene.headline (validated in composeVideo). */
export const NEEDS_HEADLINE: Partial<Record<BlockName, boolean>> = { "kinetic-headline": true };

/** Aliases the LLM / format visualHints may use. */
export const BLOCK_ALIASES: Record<string, BlockName> = {
  "kinetic-type": "kinetic-headline",
  headline: "kinetic-headline",
  title: "kinetic-headline",
  "chart-line": "chart",
  "chart-bar": "chart",
  "chart-area": "chart",
  "data-chart": "chart",
  "bar-compare": "split-stat",
  "split-screen": "split-title",
  checklist: "bullet-stack",
  bullets: "bullet-stack",
  timeline: "bullet-stack",
  "logo-grid": "icon-grid",
  annotation: "chart",
  checkmark: "bullet-stack",
  badge: "counter",
  "world-map": "map",
  flowchart: "diagram",
  photo: "image",
  "b-roll": "image",
  cta: "outro",
};

export function resolveBlockName(raw: string): BlockName | null {
  for (const part of String(raw || "").split("|").map((s) => s.trim().toLowerCase())) {
    if (part in BLOCK_SCHEMAS) return part as BlockName;
    if (part in BLOCK_ALIASES) return BLOCK_ALIASES[part];
  }
  return null;
}

export const BLOCK_DOCS: Record<BlockName, string> = {
  "kinetic-headline": "Big kinetic type, word-by-word reveal. Hooks, twists, takeaways, verdicts, questions. headline ≤ 12 words; body = optional one-line sub.",
  diagram: "Nodes + arrows (flow, cause→effect, hub-and-spoke, cycle). ≤ 6 nodes reads best on 9:16.",
  counter: "One number rolling up to its exact value (odometer). headline = what it counts; label below the number.",
  chart: "Line / bar / area chart drawn on with GSAP (pure SVG). Use real numbers; set source.",
  "split-title": "X vs Y matchup card: left on top, right on bottom, VS badge.",
  "split-stat": "One or more comparison rounds: two columns with bars sized to the values; winner highlighted.",
  "numbered-card": "Tip / item N of a list: big number + title + one-line action.",
  "strike-through": "States a myth, then strikes it out; optional truth line underneath.",
  "source-card": "Evidence card: quote/claim + named source + date (+ optional highlighted stat).",
  "headline-card": "News headline card: outlet (as text), headline, date. Never imitate a real logo.",
  "bullet-stack": "2–5 bullets revealed one at a time; earlier ones dim.",
  map: "World/region outline with highlighted countries and optional labelled points.",
  "icon-grid": "Grid of 2–9 icon tiles with short labels (lucide icon names).",
  image: "Full-bleed image asset with a gentle Ken Burns (≤ 6%). Needs scene.assetIds[0] or data.assetId.",
  outro: "CTA + handle. Callback to the hook in headline if possible.",
  "video-segment": "The user's own footage, trimmed to [inMs, outMs] of the source (scene duration = outMs − inMs). assetIds[0] = the user-video asset. crop: cover | blur-pad | {x,y,w,h}.",
};

export const OVERLAY_DOCS: Record<OverlayName, string> = {
  "overlay-lower-third": "Name + title bar over footage (bottom of the content area). Use when the speaker is introduced.",
  "overlay-keyword": "One keyword pops over footage when it is said (set atMs to the word's time).",
  "overlay-stat": "Small stat card (value + label) over footage, top area.",
  "overlay-progress": "List progress (current/total) bar over footage, top edge.",
};

/** Sample data per block: used by tests, demo and the prompt examples. */
export const BLOCK_SAMPLES: Record<BlockName, { headline?: string; body?: string; data: Record<string, unknown>; assetIds?: string[] }> = {
  "kinetic-headline": { headline: "Your savings account is losing money", body: "Here's the math nobody shows you", data: { kicker: "Did you know", emphasis: ["losing"] } },
  diagram: {
    headline: "Where your paycheck goes",
    data: {
      layout: "vertical",
      nodes: [
        { id: "pay", label: "Paycheck", icon: "banknote" },
        { id: "tax", label: "Taxes", sub: "≈ 22%", icon: "landmark" },
        { id: "bills", label: "Fixed bills", icon: "receipt" },
        { id: "you", label: "What's left", icon: "wallet" },
      ],
      edges: [{ from: "pay", to: "tax" }, { from: "tax", to: "bills" }, { from: "bills", to: "you", label: "finally" }],
    },
  },
  counter: { headline: "Interest you earn per year", data: { value: 12480.5, decimals: 2, prefix: "$", label: "on $250,000 at 5% APY" } },
  chart: {
    headline: "S&P 500 vs inflation",
    data: {
      type: "line",
      labels: ["2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024"],
      series: [
        { name: "S&P 500", values: [2044, 2239, 2674, 2507, 3231, 3756, 4766, 3840, 4770, 5882] },
        { name: "CPI x10", values: [2370, 2400, 2450, 2510, 2560, 2590, 2710, 2930, 3050, 3130] },
      ],
      annotations: [{ index: 5, label: "COVID dip & rebound" }, { index: 7, label: "2022 bear market" }],
      source: "S&P Dow Jones Indices, BLS",
    },
  },
  "split-title": { headline: "Rent vs buy", data: { left: { label: "Renting", icon: "key", sub: "flexibility" }, right: { label: "Buying", icon: "home", sub: "equity" }, question: "Which wins?" } },
  "split-stat": {
    data: {
      left: { label: "Renting" },
      right: { label: "Buying" },
      roundNumber: 1,
      rounds: [
        { metric: "Upfront cost", left: 4000, right: 60000, unit: "$", higherIsBetter: false },
        { metric: "Monthly cost", left: 2100, right: 2850, unit: "$", higherIsBetter: false },
      ],
    },
  },
  "numbered-card": { headline: "Automate your savings", body: "Move 10% to savings the day you get paid.", data: { n: 1, total: 5, icon: "piggy-bank" } },
  "strike-through": { headline: "You need a perfect credit score to buy a house", data: { label: "MYTH", truth: "Many lenders approve scores around 620." } },
  "source-card": { data: { quote: "Only 39% of Americans could cover a $1,000 emergency from savings.", source: "Bankrate survey", date: "Jan 2024", highlight: "39%", stat: { value: "39%", label: "could cover $1,000" } } },
  "headline-card": { headline: "Fed holds rates steady for a fifth straight meeting", data: { outlet: "Financial Desk", date: "Mar 20, 2024", category: "Markets", url: "https://example.com/fed" } },
  "bullet-stack": { headline: "What it means for you", data: { items: [{ text: "Savings rates stay high", icon: "trending-up" }, { text: "Mortgages stay expensive", icon: "home" }, { text: "Credit card APRs won't drop", icon: "credit-card" }] } },
  map: { headline: "Countries with no income tax", data: { focus: "world", regions: ["United Arab Emirates", "Saudi Arabia", "Bahamas", "Qatar", "Kuwait"], points: [{ lat: 25.2, lon: 55.27, label: "Dubai" }] } },
  "icon-grid": { headline: "Four accounts to open", data: { items: [{ icon: "piggy-bank", label: "High-yield savings" }, { icon: "trending-up", label: "Index fund" }, { icon: "shield", label: "Emergency fund" }, { icon: "graduation-cap", label: "Education" }] } },
  image: { headline: "Tokyo never sleeps", data: { caption: "Shinjuku, 2am", kenBurns: "in" }, assetIds: ["img-1"] },
  outro: { headline: "Follow for one money idea a day", data: { cta: "Follow for more", handle: "@theledger" } },
  "video-segment": { data: { inMs: 0, outMs: 3000, crop: "cover" }, assetIds: ["vid-1"] },
};

export const OVERLAY_SAMPLES: Record<OverlayName, Record<string, unknown>> = {
  "overlay-lower-third": { name: "Maya Chen", title: "Personal finance educator" },
  "overlay-keyword": { text: "compound interest" },
  "overlay-stat": { value: "7.2%", label: "average annual return" },
  "overlay-progress": { current: 2, total: 5, label: "Tip 2 of 5" },
};
