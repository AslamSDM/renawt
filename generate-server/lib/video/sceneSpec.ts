import { z } from "zod"

const Vec3 = z.tuple([z.number(), z.number(), z.number()])

// ---------------------------------------------------------------------------
// Animation (anime.js-compatible)
// ---------------------------------------------------------------------------

export const AnimeValue = z.union([
  z.number(),
  z.string(),
  z.tuple([z.number(), z.number()]),
  z.object({
    value: z.number(),
    ease: z.string().optional(),
  }),
])

export type AnimeValue = z.infer<typeof AnimeValue>

const Stagger = z.object({
  amount: z.number().optional(),
  from: z.enum(["first", "center", "last"]).optional(),
  grid: z.tuple([z.number(), z.number()]).optional(),
  jitter: z.number().optional(),
})

export const AnimationSpec = z.object({
  target: z.enum(["self", "material", "camera", "light"]),
  props: z.record(z.string(), AnimeValue),
  duration: z.number().default(1),
  delay: z.number().optional(),
  ease: z.string().optional(),
  loop: z.union([z.boolean(), z.number()]).optional(),
  direction: z.enum(["normal", "alternate", "reverse"]).optional(),
  stagger: Stagger.optional(),
})

export type AnimationSpec = z.infer<typeof AnimationSpec>

// ---------------------------------------------------------------------------
// Object kinds & typed props
// ---------------------------------------------------------------------------

const ObjectKind = z.enum([
  "plane",
  "box",
  "sphere",
  "torus",
  "icosahedron",
  "torusKnot",
  "text",
  "html",
  "gltf",
  "particles",
  "group",
])

const TextSplit = z.object({
  mode: z.enum(["chars", "words", "lines"]),
  stagger: z.number().optional(),
  from: z.enum(["start", "center", "end"]).optional(),
  jitter: z.number().optional(),
})

const TextProps = z.object({
  text: z.string(),
  font: z.string().optional(),
  fontSize: z.number().default(1),
  color: z.string().default("#ffffff"),
  letterSpacing: z.number().optional(),
  lineHeight: z.union([z.number(), z.literal("normal")]).optional(),
  textAlign: z.enum(["left", "center", "right", "justify"]).optional(),
  anchorX: z.union([z.enum(["left", "center", "right"]), z.number()]).optional(),
  anchorY: z.union([z.enum(["top", "middle", "bottom"]), z.number()]).optional(),
  maxWidth: z.number().optional(),
  whiteSpace: z.enum(["normal", "nowrap", "overflowWrap"]).optional(),
  outlineWidth: z.number().optional(),
  outlineColor: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeColor: z.string().optional(),
  curveRadius: z.number().optional(),
  depthOffset: z.number().optional(),
  direction: z.enum(["ltr", "rtl"]).optional(),
  splitText: TextSplit.optional(),
})

const HtmlProps = z.object({
  html: z.string(),
  css: z.string().optional(),
  width: z.number().default(400),
  height: z.number().default(300),
  classes: z.array(z.string()).optional(),
})

// Union of typed prop bags keyed by kind. Kept permissive so LLM output still
// validates; non-text/html kinds fall back to a free-form record.
const PropsByKind = z.union([TextProps, HtmlProps, z.record(z.string(), z.unknown())])

const VisibilityWindow = z.object({
  startFrame: z.number().default(0),
  endFrame: z.number().default(Infinity),
})

export interface SceneObjectShape {
  id: string
  kind: z.infer<typeof ObjectKind>
  props?: z.infer<typeof PropsByKind>
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number | [number, number, number]
  visible?: { startFrame: number; endFrame: number }
  animation?: AnimationSpec[]
  castShadow?: boolean
  receiveShadow?: boolean
  children?: SceneObjectShape[]
}

export const SceneObject: z.ZodType<SceneObjectShape> = z.object({
  id: z.string(),
  kind: ObjectKind,
  props: PropsByKind.optional(),
  position: Vec3.optional(),
  rotation: Vec3.optional(),
  scale: z.union([z.number(), Vec3]).optional(),
  visible: VisibilityWindow.optional(),
  animation: z.array(AnimationSpec).default([]),
  castShadow: z.boolean().optional(),
  receiveShadow: z.boolean().optional(),
  children: z.lazy(() => z.array(SceneObject)).default([]),
}) as z.ZodType<SceneObjectShape>

// ---------------------------------------------------------------------------
// Camera rig
// ---------------------------------------------------------------------------

const CameraRig = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("path"),
    points: z.array(Vec3).min(2),
    fov: z.number().default(50),
    lookAt: Vec3.default([0, 0, 0]),
  }),
  z.object({
    type: z.literal("curve"),
    points: z.array(Vec3).min(2),
    fov: z.number().default(50),
    lookAt: Vec3.default([0, 0, 0]),
    tension: z.number().default(0.5),
    closed: z.boolean().default(false),
  }),
  z.object({
    type: z.literal("orbit"),
    center: Vec3.default([0, 0, 0]),
    radius: z.number().default(5),
    speed: z.number().default(0.2),
    fov: z.number().default(50),
    height: z.number().default(1.5),
  }),
  z.object({
    type: z.literal("static"),
    position: Vec3.default([0, 0, 5]),
    fov: z.number().default(50),
    lookAt: Vec3.default([0, 0, 0]),
  }),
])

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------

const LightDef = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ambient"),
    intensity: z.number().default(1),
    color: z.string().default("#ffffff"),
    position: Vec3.optional(),
    castShadow: z.boolean().default(false),
    shadowMapSize: z.number().default(1024),
  }),
  z.object({
    type: z.literal("directional"),
    intensity: z.number().default(1),
    color: z.string().default("#ffffff"),
    position: Vec3.optional(),
    castShadow: z.boolean().default(true),
    shadowMapSize: z.number().default(1024),
  }),
  z.object({
    type: z.literal("point"),
    intensity: z.number().default(1),
    color: z.string().default("#ffffff"),
    position: Vec3.optional(),
    castShadow: z.boolean().default(false),
    shadowMapSize: z.number().default(1024),
  }),
  z.object({
    type: z.literal("spot"),
    intensity: z.number().default(1),
    color: z.string().default("#ffffff"),
    position: Vec3.optional(),
    castShadow: z.boolean().default(true),
    shadowMapSize: z.number().default(1024),
  }),
  z.object({
    type: z.literal("hemisphere"),
    intensity: z.number().default(1),
    color: z.string().default("#ffffff"),
    groundColor: z.string().default("#444444"),
    position: Vec3.optional(),
    castShadow: z.boolean().default(false),
    shadowMapSize: z.number().default(1024),
  }),
  z.object({
    type: z.literal("rectarea"),
    intensity: z.number().default(1),
    color: z.string().default("#ffffff"),
    width: z.number().default(5),
    height: z.number().default(5),
    position: Vec3.optional(),
    castShadow: z.boolean().default(false),
    shadowMapSize: z.number().default(1024),
  }),
])

// ---------------------------------------------------------------------------
// PostFX
// ---------------------------------------------------------------------------

const PostFX = z
  .object({
    bloom: z
      .object({
        intensity: z.number().default(1),
        threshold: z.number().default(0.85),
        radius: z.number().default(0.5),
      })
      .optional(),
    dof: z
      .object({
        focus: z.number().default(10),
        aperture: z.number().default(0.025),
        maxBlur: z.number().default(1),
      })
      .optional(),
    vignette: z
      .object({
        offset: z.number().default(1),
        darkness: z.number().default(1),
      })
      .optional(),
    chromaticAberration: z
      .object({
        offset: z.number().default(0.0015),
        radialModulation: z.boolean().default(false),
        modulationOffset: z.number().default(0),
      })
      .optional(),
    glitch: z
      .object({
        perturbationMap: z.string().optional(),
        delay: z.number().default(0),
        duration: z.number().default(0.2),
        strength: z.number().default(0.3),
      })
      .optional(),
    godrays: z
      .object({
        density: z.number().default(0.96),
        decay: z.number().default(0.95),
        weight: z.number().default(0.4),
        exposure: z.number().default(0.3),
        samplesMax: z.number().optional(),
        blur: z.boolean().default(false),
      })
      .optional(),
  })
  .optional()

// ---------------------------------------------------------------------------
// Fog
// ---------------------------------------------------------------------------

const Fog = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("linear"),
    color: z.string().default("#000000"),
    near: z.number().default(1),
    far: z.number().default(50),
  }),
  z.object({
    type: z.literal("exp2"),
    color: z.string().default("#000000"),
    density: z.number().default(0.025),
  }),
])

export type FogSpec = z.infer<typeof Fog>

// ---------------------------------------------------------------------------
// Beats & continuity
// ---------------------------------------------------------------------------

const Beat = z.object({
  id: z.string(),
  name: z.string(),
  startFrame: z.number().default(0),
  endFrame: z.number(),
  objectIds: z.array(z.string()).default([]),
})

const ContinuityTokens = z.object({
  palette: z.array(z.string()).default([]),
  materials: z
    .record(
      z.string(),
      z.object({
        color: z.string(),
        roughness: z.number().default(0.5),
        metalness: z.number().default(0),
      }),
    )
    .default({}),
  cameraRigs: z.record(z.string(), CameraRig).default({}),
  lightRigs: z.record(z.string(), z.array(LightDef)).default({}),
  postFXPresets: z.record(z.string(), PostFX).default({}),
  fogPresets: z.record(z.string(), Fog).default({}),
  shadowPresets: z
    .record(
      z.string(),
      z.object({
        castShadow: z.boolean(),
        receiveShadow: z.boolean(),
        shadowMapSize: z.number(),
      }),
    )
    .default({}),
})

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export const SceneSpecSchema = z.object({
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  fps: z.number().int().positive().default(30),
  durationInFrames: z.number().positive(),
  bgColor: z.string().default("#0a0a0a"),
  hdri: z.string().optional(),
  postFX: PostFX,
  fog: Fog.optional(),
  cameraRig: CameraRig,
  lights: z.array(LightDef).default([
    { type: "ambient", intensity: 0.6 },
    { type: "directional", intensity: 1.1, position: [3, 4, 5] },
  ]),
  objects: z.array(SceneObject).default([]),
  beats: z.array(Beat).default([]),
  continuityTokens: ContinuityTokens.optional(),
})

export type SceneSpec = z.infer<typeof SceneSpecSchema>
export type SceneObjectSpec = z.infer<typeof SceneObject>
export type CameraRigSpec = z.infer<typeof CameraRig>
export type LightDefSpec = z.infer<typeof LightDef>
export type PostFXSpec = z.infer<typeof PostFX>
export type BeatSpec = z.infer<typeof Beat>
export type ContinuityTokensSpec = z.infer<typeof ContinuityTokens>

/**
 * Returns the total frame count of a scene spec.
 */
export function totalFrames(spec: SceneSpec): number {
  return spec.durationInFrames
}

/**
 * Parses and validates an unknown object as a {@link SceneSpec}.
 * Throws a zod error on failure.
 */
export function validateSceneSpec(obj: unknown): SceneSpec {
  return SceneSpecSchema.parse(obj)
}