import { z } from "zod"
import type {
  AnimationSpec,
  SceneObjectSpec,
  CameraRigSpec,
  PostFXSpec,
} from "./sceneSpec"

/**
 * Metadata + factory for a plain-Three.js scene component. Unlike
 * {@link ./registry3d.ts}, these builders emit serializable SceneSpec
 * objects (no JSX, no Three.js runtime imports).
 */
export interface ThreeComponentMeta<P extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string
  category: "background" | "text" | "media" | "card" | "shape" | "camera"
  description: string
  useCases: string[]
  propsSchema: z.ZodObject<Record<string, z.ZodTypeAny>, any, any>
  build: (props: z.infer<P>) => SceneObjectSpec | SceneObjectSpec[]
}

/**
 * Spring scale-in entrance. anime.js-style: tween `scale` from `from` to `to`
 * over `durationSec` seconds using a spring easing.
 */
function springScaleIn(
  durationSec: number,
  from: number = 0.92,
  to: number = 1,
): AnimationSpec[] {
  return [
    {
      target: "self",
      props: { scale: [from, to] },
      duration: durationSec,
      ease: "spring(1, 80, 10, 0)",
    },
  ]
}

/**
 * Endless sine bob on the Y axis. The keyframe-like array approximates one
 * full sine cycle (0 -> +amp -> 0 -> -amp -> 0) with inOutSine easing and
 * `loop: true`.
 */
function sineFloatY(
  amplitude: number,
  periodSec: number,
): AnimationSpec[] {
  return [
    {
      target: "self",
      props: { y: [0, amplitude] },
      duration: periodSec,
      ease: "inOutSine",
      loop: true,
      direction: "alternate",
    },
  ]
}

// ---------------------------------------------------------------------------
// Existing components — updated to emit AnimationSpec[]
// ---------------------------------------------------------------------------

const ThreeProductHero: ThreeComponentMeta = {
  name: "ThreeProductHero",
  category: "media",
  description:
    "Plane displaying an image texture with a subtle self-rotation. Pair with an orbit cameraRig (radius 4, speed = orbit/2).",
  useCases: ["intro hero with website screenshot", "premium product showcase", "feature shot with depth"],
  propsSchema: z.object({
    src: z.string(),
    bgColor: z.string().default("#0a0a0a"),
    orbit: z.number().default(0.15),
    tilt: z.number().default(0.05),
    durationSec: z.number().default(10),
  }),
  build: (props) => {
    const { src, orbit, tilt, durationSec } = props
    return {
      id: "three-product-hero",
      kind: "plane",
      props: { src },
      position: [0, 0, 0],
      rotation: [tilt, 0, 0],
      scale: 1,
      animation: [
        {
          target: "self",
            props: { "rotation.y": [-orbit, orbit] },
            duration: durationSec,
            ease: "inOutSine",
            loop: true,
            direction: "alternate",
        },
      ],
    }
  },
}

const GlassPanel3D: ThreeComponentMeta = {
  name: "GlassPanel3D",
  category: "card",
  description:
    "Translucent plane (frosted glass feel) with a title text child and optional body text child. Spring scale-in + sine float.",
  useCases: ["feature card on glass site", "stat callout", "testimonial bezel"],
  propsSchema: z.object({
    title: z.string(),
    body: z.string().default(""),
    tint: z.string().default("rgba(255,255,255,0.08)"),
    depth: z.number().default(0.4),
  }),
  build: (props) => {
    const { title, body, tint, depth } = props
    const children: SceneObjectSpec[] = [
      {
        id: "glass-title",
        kind: "text",
        props: { text: title, fontSize: 0.32, color: "#ffffff" },
        position: [0, body ? 0.12 : 0, 0.02],
        animation: springScaleIn(0.6, 0.92, 1),
      },
    ]
    if (body) {
      children.push({
        id: "glass-body",
        kind: "text",
        props: { text: body, fontSize: 0.18, color: "rgba(255,255,255,0.78)" },
        position: [0, -0.18, 0.02],
        animation: springScaleIn(0.6, 0.92, 1),
      })
    }
    return {
      id: "glass-panel",
      kind: "plane",
      props: { tint, transparent: true, opacity: 0.08 },
      position: [0, 0, 0],
      scale: 1,
      animation: [...springScaleIn(0.6, 0.92, 1), ...sineFloatY(4 * depth, 4)],
      children,
    }
  },
}

const DepthParallax: ThreeComponentMeta = {
  name: "DepthParallax",
  category: "background",
  description:
    "Three-layer parallax background (back/mid/front) at different z depths. Pass src URLs or solid colors.",
  useCases: ["depth scene", "scrolling parallax", "cinematic background"],
  propsSchema: z.object({
    back: z.string().default("#0b1020"),
    mid: z.string().default("#1a2540"),
    front: z.string().default("#2a3a60"),
    direction: z.enum(["up", "down", "left", "right"]).default("up"),
    speed: z.number().default(0.5),
    durationSec: z.number().default(10),
  }),
  build: (props) => {
    const { back, mid, front, direction, speed, durationSec } = props
    const isImage = (v: string) => v.startsWith("http") || v.startsWith("/")
    const make = (
      id: string,
      colorOrSrc: string,
      z: number,
      depthFactor: number,
    ): SceneObjectSpec => {
      const axis =
        direction === "left" || direction === "right" ? "x" : "y"
      const sign = direction === "right" || direction === "down" ? 1 : -1
      const target = sign * speed * depthFactor * 60
      const baseProps = isImage(colorOrSrc)
        ? { src: colorOrSrc }
        : { color: colorOrSrc }
      return {
        id,
        kind: "plane",
        props: baseProps,
        position: [0, 0, z],
        scale: 1 + depthFactor * 0.05,
        visible: { startFrame: 0, endFrame: Infinity },
        animation: [
          {
            target: "self",
            props: { [axis]: [0, target] },
            duration: durationSec,
            ease: "linear",
            loop: true,
          },
        ],
      }
    }
    return [
      make("depth-back", back, -6, 0.2),
      make("depth-mid", mid, -4, 0.5),
      make("depth-front", front, -2, 0.9),
    ]
  },
}

/**
 * Builds a slow camera pan rig plus one plane per panel laid out
 * left-to-right. Use when the director wants an establishing pan shot.
 */
export function buildCameraPanRig(props: {
  panels: Array<{ src?: string; color?: string }>
  duration: number
  bgColor: string
}): { cameraRig: CameraRigSpec; objects: SceneObjectSpec[] } {
  const { panels, duration } = props
  const n = Math.max(1, panels.length)
  const span = (n - 1) * 2.4
  const startX = -span / 2 - 1
  const endX = span / 2 + 1
  const steps = 6
  const points: [number, number, number][] = []
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    points.push([startX + t * (endX - startX), 0, 4])
  }
  const objects: SceneObjectSpec[] = panels.map((p, i) => ({
    id: `pan-panel-${i}`,
    kind: "plane",
    props: p.src ? { src: p.src } : { color: p.color ?? "#222" },
    position: [(i - (n - 1) / 2) * 2.4, 0, -i * 0.3],
    rotation: [0, -0.15, 0],
    scale: 1,
    visible: { startFrame: 0, endFrame: duration },
  }))
  return {
    cameraRig: {
      type: "path",
      points,
      fov: 45,
      lookAt: [0, 0, 0],
    },
    objects,
  }
}

/**
 * Builds a static-position camera rig plus an anime.js camera animation that
 * dollies along Z and (optionally) tweens FOV. The director/sceneBuilder
 * would need to attach `cameraAnimation` to the spec separately; this helper
 * just produces the two pieces.
 */
export function buildCameraDollyRig(props: {
  startZ: number
  endZ: number
  startFov: number
  endFov: number
  lookAt?: [number, number, number]
}): {
  cameraRig: CameraRigSpec
  cameraAnimation: AnimationSpec[]
} {
  return {
    cameraRig: {
      type: "static",
      position: [0, 0, props.startZ],
      fov: props.startFov,
      lookAt: props.lookAt ?? [0, 0, 0],
    },
    cameraAnimation: [
      {
        target: "camera",
        props: { z: props.endZ, fov: props.endFov },
        duration: 10,
        ease: "inOutSine",
      },
    ],
  }
}

const MaterialCard: ThreeComponentMeta = {
  name: "MaterialCard",
  category: "card",
  description:
    "Plane with PBR-style material (matte/glossy/metallic/neon) and optional title/body text child. Spring scale-in.",
  useCases: ["premium feature card", "product spec callout", "stat card on metallic site"],
  propsSchema: z.object({
    title: z.string(),
    body: z.string().default(""),
    material: z.enum(["matte", "glossy", "metallic", "neon"]).default("metallic"),
    accent: z.string().default("#ffffff"),
  }),
  build: (props) => {
    const { title, body, material, accent } = props
    const materialProps: Record<string, unknown> =
      material === "matte"
        ? { color: "#1a1a1a", roughness: 0.9, metalness: 0 }
        : material === "glossy"
          ? { color: "#1f2937", roughness: 0.2, metalness: 0.3 }
          : material === "metallic"
            ? { color: "#9ca3af", roughness: 0.3, metalness: 0.95 }
            : { color: "#06010a", roughness: 0.5, metalness: 0, emissive: accent }
    const children: SceneObjectSpec[] = [
      {
        id: "material-title",
        kind: "text",
        props: {
          text: title,
          fontSize: 0.28,
          color: material === "metallic" ? "#0a0a0a" : "#ffffff",
        },
        position: [0, body ? 0.1 : 0, 0.02],
        animation: springScaleIn(0.6, 0.94, 1),
      },
    ]
    if (body) {
      children.push({
        id: "material-body",
        kind: "text",
        props: { text: body, fontSize: 0.16, color: "rgba(255,255,255,0.82)" },
        position: [0, -0.16, 0.02],
        animation: springScaleIn(0.6, 0.94, 1),
      })
    }
    return {
      id: "material-card",
      kind: "plane",
      props: materialProps,
      position: [0, 0, 0],
      scale: 1,
      animation: springScaleIn(0.6, 0.94, 1),
      children,
    }
  },
}

const ParticleField: ThreeComponentMeta = {
  name: "ParticleField",
  category: "background",
  description:
    "Drifting particle field — dust, snow, sparks. Configure color, count, speed, size.",
  useCases: ["cinematic backdrop", "neon scene base", "subtle ambient layer"],
  propsSchema: z.object({
    color: z.string().default("#ffffff"),
    count: z.number().int().min(20).max(400).default(120),
    speed: z.number().default(0.4),
    size: z.number().default(2),
  }),
  build: (props) => {
    const { color, count, speed, size } = props
    return {
      id: "particle-field",
      kind: "particles",
      props: { color, count, speed, size },
      position: [0, 0, 0],
      scale: 1,
    }
  },
}

const Text3D: ThreeComponentMeta = {
  name: "Text3D",
  category: "text",
  description:
    "3D text object with spring scale-in and a subtle float. Set font URL for custom typefaces.",
  useCases: ["hero headline", "section title in 3D", "punchline"],
  propsSchema: z.object({
    text: z.string(),
    fontSize: z.number().default(1),
    color: z.string().default("#ffffff"),
    font: z.string().optional(),
  }),
  build: (props) => {
    const { text, fontSize, color, font } = props
    return {
      id: "text-3d",
      kind: "text",
      props: { text, fontSize, color, font },
      position: [0, 0, 0],
      scale: 1,
      animation: [...springScaleIn(0.6, 0.92, 1), ...sineFloatY(0.1, 5)],
    }
  },
}

// ---------------------------------------------------------------------------
// New motion-graphics components
// ---------------------------------------------------------------------------

const KineticTypography: ThreeComponentMeta = {
  name: "KineticTypography",
  category: "text",
  description: "Per-character text reveal with anime.js stagger. SDF text via troika.",
  useCases: ["headline reveal", "tagline entrance", "kinetic typography"],
  propsSchema: z.object({
    text: z.string(),
    fontSize: z.number().default(1),
    color: z.string().default("#ffffff"),
    font: z.string().optional(),
    splitMode: z.enum(["chars", "words", "lines"]).default("chars"),
    staggerDelay: z.number().default(0.03),
    from: z.enum(["start", "center", "end"]).default("start"),
    ease: z.string().default("outSine"),
  }),
  build: (props) => {
    return {
      id: "kinetic-text",
      kind: "text",
      props: {
        text: props.text,
        fontSize: props.fontSize,
        color: props.color,
        font: props.font,
        anchorX: "center",
        anchorY: "middle",
        splitText: {
          mode: props.splitMode,
          stagger: props.staggerDelay,
          from: props.from,
        },
      },
      animation: [
        {
          target: "self",
          props: { opacity: [0, 1] },
          duration: 0.5,
          ease: props.ease,
        },
      ],
    }
  },
}

const HtmlCard3D: ThreeComponentMeta = {
  name: "HtmlCard3D",
  category: "card",
  description: "Real DOM card (CSS3DRenderer) with gradient, shadow, web font. Spring scale-in.",
  useCases: ["DOM card in 3D", "feature card with rich styling", "image+text composite"],
  propsSchema: z.object({
    html: z.string(),
    css: z.string().default(""),
    width: z.number().default(400),
    height: z.number().default(300),
  }),
  build: (props) => {
    return {
      id: "html-card",
      kind: "html",
      props: {
        html: props.html,
        css: props.css,
        width: props.width,
        height: props.height,
      },
      animation: springScaleIn(0.6, 0.9, 1),
    }
  },
}

const GlassMorphismCard: ThreeComponentMeta = {
  name: "GlassMorphismCard",
  category: "card",
  description: "Frosted glass card in 3D space with backdrop-filter blur.",
  useCases: ["glass UI", "feature card", "premium showcase"],
  propsSchema: z.object({
    title: z.string(),
    body: z.string().default(""),
    width: z.number().default(480),
    height: z.number().default(280),
  }),
  build: (props) => {
    return {
      id: "glass-card",
      kind: "html",
      props: {
        width: props.width,
        height: props.height,
        html: `<div class="glass-card"><h2>${props.title}</h2><p>${props.body}</p></div>`,
        css: `.glass-card{backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.16);border-radius:24px;padding:32px 40px;color:#fff;font-family:Inter,sans-serif;box-shadow:0 30px 60px rgba(0,0,0,0.35);}h2{font-size:36px;font-weight:700;margin:0 0 12px;}p{font-size:20px;opacity:0.78;margin:0;line-height:1.4;}`,
      },
      animation: springScaleIn(0.6, 0.9, 1),
    }
  },
}

const AnimatedHeadline: ThreeComponentMeta = {
  name: "AnimatedHeadline",
  category: "text",
  description: "Text with animated color tween + opacity reveal + outline glow.",
  useCases: ["hero headline", "color-shift title", "branded opener"],
  propsSchema: z.object({
    text: z.string(),
    fontSize: z.number().default(2),
    fromColor: z.string().default("#333333"),
    toColor: z.string().default("#ffffff"),
    outlineWidth: z.number().default(0),
    ease: z.string().default("inOutSine"),
  }),
  build: (props) => {
    return {
      id: "animated-headline",
      kind: "text",
      props: {
        text: props.text,
        fontSize: props.fontSize,
        color: props.fromColor,
        anchorX: "center",
        anchorY: "middle",
        outlineWidth: props.outlineWidth,
        outlineColor: props.toColor,
      },
      animation: [
        {
          target: "material",
          props: { opacity: [0, 1], color: props.toColor },
          duration: 1.5,
          ease: props.ease,
        },
      ],
    }
  },
}

const StatCounter: ThreeComponentMeta = {
  name: "StatCounter",
  category: "card",
  description: "Number counting up in a CSS3D card with anime.js.",
  useCases: ["stats reel", "metric callout", "growth number"],
  propsSchema: z.object({
    to: z.number(),
    suffix: z.string().default(""),
    prefix: z.string().default(""),
    label: z.string().default(""),
    duration: z.number().default(2),
  }),
  build: (props) => {
    return {
      id: "stat-counter",
      kind: "html",
      props: {
        width: 360,
        height: 200,
        html: `<div class="stat"><div class="num" data-target="${props.to}">0</div><div class="label">${props.label}</div></div>`,
        css: `.stat{text-align:center;color:#fff;font-family:Inter,sans-serif;padding:24px;}.num{font-size:72px;font-weight:800;background:linear-gradient(135deg,#6366f1,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}.label{font-size:18px;opacity:0.7;margin-top:8px;}`,
      },
      animation: [
        {
          target: "self",
          props: { opacity: [0, 1], y: [20, 0] },
          duration: 0.5,
          ease: "outSine",
        },
      ],
    }
  },
}

const FeatureTrio: ThreeComponentMeta = {
  name: "FeatureTrio",
  category: "card",
  description: "Three glass cards at different Z depths with staggered entrance.",
  useCases: ["feature trio", "three-up layout", "staggered card reveal"],
  propsSchema: z.object({
    features: z
      .array(z.object({ title: z.string(), body: z.string() }))
      .min(1)
      .max(3)
      .default([]),
  }),
  build: (props) => {
    return props.features.map(
      (f: { title: string; body: string }, i: number) => ({
      id: `feature-${i}`,
      kind: "html",
      position: [(i - 1) * 3, 0, -i * 0.5] as [number, number, number],
      props: {
        width: 400,
        height: 240,
        html: `<div class="card"><h3>${f.title}</h3><p>${f.body}</p></div>`,
        css: `.card{backdrop-filter:blur(16px);background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:24px 32px;color:#fff;font-family:Inter,sans-serif;}h3{font-size:24px;font-weight:700;margin:0 0 8px;}p{font-size:16px;opacity:0.72;margin:0;}`,
      },
      animation: [
        {
          target: "self",
          props: { opacity: [0, 1], y: [30, 0] },
          duration: 0.6,
          delay: i * 0.15,
          ease: "outSine",
        },
      ],
    })) as SceneObjectSpec[]
  },
}

// ---------------------------------------------------------------------------
// Registry & presets
// ---------------------------------------------------------------------------

export const THREE_REGISTRY: Record<string, ThreeComponentMeta> = {
  ThreeProductHero,
  GlassPanel3D,
  DepthParallax,
  MaterialCard,
  ParticleField,
  Text3D,
  KineticTypography,
  HtmlCard3D,
  GlassMorphismCard,
  AnimatedHeadline,
  StatCounter,
  FeatureTrio,
}

export const THREE_COMPONENT_NAMES = Object.keys(THREE_REGISTRY)

export interface CameraPanRigInput {
  panels: Array<{ src?: string; color?: string }>
  duration: number
  bgColor: string
}

/**
 * Public HDRI presets. URLs point at the pmndrs/drei-assets public mirror.
 * The agent may set `spec.hdri` to one of these directly.
 */
export const HDRI_PRESETS: Record<string, string> = {
  studio: "https://raw.githubusercontent.com/pmndrs/drei-assets/main/hdri/studio.exr",
  sunset: "https://raw.githubusercontent.com/pmndrs/drei-assets/main/hdri/sunset.exr",
  dawn: "https://raw.githubusercontent.com/pmndrs/drei-assets/main/hdri/dawn.exr",
  night: "https://raw.githubusercontent.com/pmndrs/drei-assets/main/hdri/night.exr",
  warehouse: "https://raw.githubusercontent.com/pmndrs/drei-assets/main/hdri/warehouse.exr",
  forest: "https://raw.githubusercontent.com/pmndrs/drei-assets/main/hdri/forest.exr",
  city: "https://raw.githubusercontent.com/pmndrs/drei-assets/main/hdri/city.exr",
}

/**
 * Named post-processing presets the agent can reference by key.
 */
export const POSTFX_PRESETS: Record<string, PostFXSpec> = {
  cinematic: {
    bloom: { intensity: 0.8, threshold: 0.85, radius: 0.5 },
    vignette: { offset: 1, darkness: 0.9 },
    chromaticAberration: { offset: 0.0008, radialModulation: false, modulationOffset: 0 },
  },
  dreamy: {
    bloom: { intensity: 1.6, threshold: 0.6, radius: 0.8 },
    dof: { focus: 8, aperture: 0.04, maxBlur: 1 },
  },
  clean: undefined,
  noir: {
    vignette: { offset: 1, darkness: 1.2 },
  },
  tech: {
    bloom: { intensity: 1.0, threshold: 0.8, radius: 0.6 },
    chromaticAberration: { offset: 0.0015, radialModulation: true, modulationOffset: 0.2 },
  },
  glitch: {
    glitch: { delay: 0, duration: 0.2, strength: 0.3 },
    bloom: { intensity: 1.2, threshold: 0.7, radius: 0.7 },
  },
}