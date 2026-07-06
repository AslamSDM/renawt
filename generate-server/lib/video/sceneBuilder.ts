import {
  SceneSpecSchema,
  type SceneSpec,
  type SceneObjectSpec,
  type CameraRigSpec,
  type LightDefSpec,
  type AnimationSpec,
} from "./sceneSpec"
import { THREE_REGISTRY, POSTFX_PRESETS } from "./threeRegistry"

/**
 * Scrub NaN / Infinity / non-finite numbers from an LLM-emitted object tree.
 * Replaces invalid numeric values with 0 (safe default for positions/rotations/
 * scales). Recurses into children and animation keyframes.
 */
function sanitizeNumbers(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === "number") {
    return Number.isFinite(obj) ? obj : 0
  }
  if (Array.isArray(obj)) return obj.map(sanitizeNumbers)
  if (typeof obj === "object") {
    const out: any = {}
    for (const k of Object.keys(obj)) {
      out[k] = sanitizeNumbers(obj[k])
    }
    return out
  }
  return obj
}

/**
 * Director-facing plan that drives scene assembly. Each beat lists a set of
 * layers; each layer names a {@link THREE_REGISTRY} component and its props.
 */
export interface DirectorPlan {
  width: number
  height: number
  fps: number
  durationInFrames: number
  bgColor: string
  hdri?: string
  /** Key into {@link POSTFX_PRESETS}; defaults to `clean`. */
  postFXPreset?: string
  cameraRig: CameraRigSpec
  lights: LightDefSpec[]
  /**
   * Optional anime.js camera animations (e.g. from `buildCameraDollyRig`).
   * NOTE: the v2 `SceneSpec` schema does not yet expose a top-level
   * `cameraAnimation` channel, so these are not merged into the assembled
   * spec today. Directors wanting camera motion should encode it directly
   * in `cameraRig` (path/curve/orbit) until the schema grows a slot.
   */
  cameraAnimation?: AnimationSpec[]
  beats: Array<{
    name: string
    startFrame: number
    endFrame: number
    layers: Array<{ id: string; component: string; props: any }>
  }>
}

/**
 * Assembles a complete {@link SceneSpec} from a director plan. For each beat,
 * each layer's registry component is invoked to produce one or more
 * {@link SceneObjectSpec}s; the beat's frame window is merged into each
 * object's `visible` field. The assembled spec is validated via
 * {@link SceneSpecSchema.parse} before returning.
 */
export function buildSceneSpec(plan: DirectorPlan): SceneSpec {
  const postFX = plan.postFXPreset
    ? POSTFX_PRESETS[plan.postFXPreset]
    : POSTFX_PRESETS.clean

  const objects: SceneObjectSpec[] = []
  const beats: SceneSpec["beats"] = []

  plan.beats.forEach((beat, beatIndex) => {
    const beatObjectIds: string[] = []
    // LLMs sometimes emit floats — coerce to integers defensively.
    const beatStart = Math.round(beat.startFrame)
    const beatEnd = Math.round(beat.endFrame)
    beat.layers.forEach((layer) => {
      const meta = THREE_REGISTRY[layer.component]
      if (!meta) {
        throw new Error(
          `Unknown 3D component "${layer.component}" in beat "${beat.name}" (layer id "${layer.id}")`,
        )
      }
      const built = meta.build(layer.props)
      const arr = Array.isArray(built) ? built : [built]
      arr.forEach((obj, i) => {
        const id =
          arr.length > 1 ? `${layer.id}__${i}` : layer.id
        const mergedVisible = {
          startFrame: beatStart,
          endFrame: beatEnd,
          ...(obj.visible ?? {}),
        }
        mergedVisible.startFrame = Math.round(mergedVisible.startFrame)
        mergedVisible.endFrame = Math.round(mergedVisible.endFrame)
        const cleanObj = sanitizeNumbers({
          ...obj,
          id,
          visible: mergedVisible,
        }) as SceneObjectSpec
        objects.push(cleanObj)
        beatObjectIds.push(id)
      })
    })
    beats.push({
      id: `beat-${beatIndex}`,
      name: beat.name,
      startFrame: beatStart,
      endFrame: beatEnd,
      objectIds: beatObjectIds,
    })
  })

  const draft: SceneSpec = {
    width: plan.width,
    height: plan.height,
    fps: plan.fps,
    durationInFrames: plan.durationInFrames,
    bgColor: plan.bgColor,
    hdri: plan.hdri,
    postFX,
    cameraRig: plan.cameraRig,
    lights: plan.lights,
    objects,
    beats,
  }

  try {
    return SceneSpecSchema.parse(draft)
  } catch (err: any) {
    const issues = err?.issues
      ? JSON.stringify(err.issues, null, 2)
      : String(err)
    throw new Error(`buildSceneSpec produced an invalid SceneSpec:\n${issues}`)
  }
}