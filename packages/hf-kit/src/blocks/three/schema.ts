import { z } from "zod";

/**
 * `scene.data` schemas for the Three.js blocks (chart-3d, globe-3d, stat-3d, scene-3d).
 * Spread into STRICT_BLOCK_SCHEMAS / BLOCK_DOCS / BLOCK_SAMPLES by ../schema.ts. Kept small and flat so the
 * planner (Sonnet/Opus) can fill them reliably; ../coerce.ts repairs the predictable shape mistakes.
 */
const num = z.number().finite();
const text = (max: number) => z.string().min(1).max(max);
// Negative values cannot stand on a ground plane. A refine (not .min) so coercion never clamps real data to 0.
const nonNeg = num.refine((v) => v >= 0, { message: "chart-3d values must be ≥ 0 (use the chart block for negative values)" });

export const Chart3DData = z.object({
  items: z.array(z.object({
    label: text(16),
    value: nonNeg,
    highlight: z.boolean().optional().describe("paint this bar in the accent colour, the rest muted"),
  })).min(2).max(8),
  unit: z.string().max(8).default("").describe("'$', '%', or a short unit word shown with every value"),
  title: z.string().max(48).optional().describe("defaults to scene.headline"),
  caption: z.string().max(70).optional().describe("one line under the chart (e.g. the source)"),
});

const Place = z.object({ lat: num.min(-90).max(90), lng: num.min(-180).max(180) });
export const Globe3DData = z.object({
  focus: Place.extend({ label: text(24) }).describe("the location the globe flies to"),
  from: Place.extend({ label: z.string().max(24).optional() }).optional().describe("optional origin: an arc is drawn from here to focus"),
  title: z.string().max(48).optional().describe("defaults to scene.headline"),
});

export const Stat3DData = z.object({
  value: z.union([num, text(14)]).describe("a number (formatted like counter) or a 1–3 word phrase"),
  decimals: z.number().int().min(0).max(3).default(0),
  prefix: z.string().max(4).default(""),
  suffix: z.string().max(8).default(""),
  label: z.string().max(60).optional().describe("sub-label under the 3D text"),
});

export const SHAPES_3D = ["sphere", "box", "torus", "cone", "cylinder", "arrow", "plane", "ring"] as const;
export const COLOR_ROLES_3D = ["bg", "surface", "ink", "accent", "accent2"] as const;
export const MOTIONS_3D = ["orbit", "spin", "bob", "pulse", "path", "scale-in"] as const;
export const CAMERAS_3D = ["front", "three-quarter", "top", "orbit"] as const;

const vec3 = z.array(num.min(-4).max(4)).min(3).max(3);
export const Scene3DData = z.object({
  objects: z.array(z.object({
    id: text(20),
    shape: z.enum(SHAPES_3D),
    position: vec3.default([0, 0, 0]).describe("[x,y,z] world units, each -4..4; y is up; the view shows about -3..3"),
    scale: num.min(0.1).max(6).default(1).describe("uniform size; 1 = one world unit across"),
    rotation: z.array(num.min(-360).max(360)).min(3).max(3).optional().describe("[x,y,z] degrees; arrow points along +x before rotation"),
    color: z.enum(COLOR_ROLES_3D).default("accent"),
    label: z.string().max(20).optional().describe("short tag drawn above the object"),
    motions: z.array(z.object({
      type: z.enum(MOTIONS_3D),
      startMs: z.number().int().min(0).max(20000).default(0).describe("relative to the scene start"),
      durationMs: z.number().int().min(100).max(20000).default(1200),
      axis: z.enum(["x", "y", "z"]).default("y").describe("spin/orbit axis"),
      turns: num.min(-8).max(8).default(1).describe("spin/orbit revolutions over the duration"),
      amount: num.min(0).max(3).default(0.3).describe("bob height or pulse scale gain"),
      to: vec3.optional().describe("path: end position (start = from or the object's position)"),
      from: vec3.optional(),
    })).max(3).default([]),
  })).min(1).max(8),
  camera: z.enum(CAMERAS_3D).default("three-quarter"),
  caption: z.string().max(70).optional(),
});

export const STRICT_THREE_SCHEMAS = {
  "chart-3d": Chart3DData,
  "globe-3d": Globe3DData,
  "stat-3d": Stat3DData,
  "scene-3d": Scene3DData,
} as const;
export type ThreeBlockName = keyof typeof STRICT_THREE_SCHEMAS;
export const THREE_BLOCK_NAMES = Object.keys(STRICT_THREE_SCHEMAS) as ThreeBlockName[];
export const isThreeBlock = (b: string): b is ThreeBlockName => b in STRICT_THREE_SCHEMAS;

/** Catalogue text: first sentence says WHEN to pick the block (the planner reads it against each beat). */
export const THREE_DOCS: Record<ThreeBlockName, string> = {
  "chart-3d": "3D bar chart: 2–8 extruded columns grow in sequence on a ground plane while the camera slowly orbits; values count up. Use it for a hero comparison or ranking beat (biggest/smallest, who leads) where a dramatic reveal beats a flat chart; use chart for time series or more than 8 values. Mark the winner with highlight: true. Labels ≤ 16 chars, values ≥ 0.",
  "globe-3d": "Rotating 3D globe that flies to a location and drops a labelled pin, with an optional arc from an origin. Use it when a beat is about WHERE (a place, a route, origin → destination, 'this happened in X'); use map for several countries at once. lat/lng in degrees.",
  "stat-3d": "One big number or 1–3 word phrase as extruded 3D type that swings in and settles, lit in the accent colour, with a sub-label. Use it for the single most important stat or word of the video (the reveal, the verdict); use counter when the number should roll up. value ≤ 14 chars.",
  "scene-3d": "A small 3D scene of 1–8 primitives (sphere, box, torus, cone, cylinder, arrow, plane, ring) with colour roles and named motions (orbit, spin, bob, pulse, path, scale-in). Use it to visualise a physical or abstract mechanism (planets orbiting, a ball rolling from A to B, layers stacking, forces as arrows) that a flat diagram cannot show. Keep it to ≤ 5 objects and ≤ 2 motions each; times are ms from the scene start.",
};

export const THREE_SAMPLES: Record<ThreeBlockName, { headline?: string; body?: string; data: Record<string, unknown> }> = {
  "chart-3d": {
    headline: "Who holds the most US debt",
    data: {
      items: [{ label: "Japan", value: 1130, highlight: true }, { label: "China", value: 768 }, { label: "UK", value: 723 }, { label: "Luxembourg", value: 371 }],
      unit: "$",
      caption: "Billions of dollars · US Treasury, 2024",
    },
  },
  "globe-3d": { headline: "The first transatlantic flight", data: { focus: { lat: 53.39, lng: -9.99, label: "Clifden, Ireland" }, from: { lat: 47.56, lng: -52.71, label: "St. John's" } } },
  "stat-3d": { headline: "Share of Americans who could cover $1,000", data: { value: 39, suffix: "%", label: "could pay a $1,000 emergency from savings" } },
  "scene-3d": {
    headline: "Why the Moon shows one face",
    data: {
      camera: "three-quarter",
      objects: [
        { id: "earth", shape: "sphere", position: [0, 0, 0], scale: 1.6, color: "accent", label: "Earth", motions: [{ type: "spin", durationMs: 4000, turns: 1 }] },
        { id: "path", shape: "ring", position: [0, 0, 0], scale: 4.4, color: "surface" },
        { id: "moon", shape: "sphere", position: [2.2, 0, 0], scale: 0.5, color: "ink", label: "Moon", motions: [{ type: "scale-in", durationMs: 600 }, { type: "orbit", startMs: 400, durationMs: 3600, turns: 0.5 }] },
      ],
    },
  },
};

/** Aliases the planner / format visualHints may use for the 3D blocks. */
export const THREE_ALIASES: Record<string, ThreeBlockName> = {
  chart3d: "chart-3d", "3d-chart": "chart-3d", "bar-3d": "chart-3d", "bars-3d": "chart-3d", "3d-bars": "chart-3d",
  globe: "globe-3d", globe3d: "globe-3d", "3d-globe": "globe-3d", earth: "globe-3d", "fly-to": "globe-3d",
  stat3d: "stat-3d", "3d-stat": "stat-3d", "3d-text": "stat-3d", "text-3d": "stat-3d", "3d-number": "stat-3d",
  scene3d: "scene-3d", "3d-scene": "scene-3d", "3d": "scene-3d", "3d-model": "scene-3d",
};
