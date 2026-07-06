/**
 * Shared type definitions for the Three.js render engine. Kept separate from
 * sceneRuntime.ts (which runs inside the browser page) so the Node side can
 * import these types without pulling in browser-only code.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Vec3 = [number, number, number]

/** anime.js v4 easing name (e.g. 'outSine', 'inOutQuad', 'spring()'). */
export type Easing = string

/** A single tweenable property value for an anime.js animation. */
export type AnimValue =
  | number
  | string
  | [number, number]
  | { value: number; ease?: Easing }

export interface StaggerSpec {
  amount?: number
  from?: 'first' | 'center' | 'last'
  grid?: [number, number]
  jitter?: number
}

export interface AnimationSpec {
  /** Which part of the object to animate. */
  target: 'self' | 'material' | 'camera' | 'light'
  /**
   * Property map. Keys are anime.js-flattened property names (e.g. 'x',
   * 'rotateX', 'opacity', 'color', 'fov', 'intensity'). Values may be a
   * scalar, a [from, to] pair, or { value, ease }.
   */
  props: Record<string, AnimValue>
  /** Duration in seconds. */
  duration: number
  /** Delay in seconds. */
  delay?: number
  /** anime.js easing name. */
  ease?: Easing
  loop?: boolean | number
  direction?: 'normal' | 'alternate' | 'reverse'
  stagger?: StaggerSpec
}

export interface SplitTextSpec {
  /** 'chars' | 'words' | 'lines' — split mode. */
  mode: 'chars' | 'words' | 'lines'
  /** Per-segment stagger delay in ms. */
  stagger: number
  /** Stagger origin. */
  from?: 'first' | 'center' | 'last'
}

export interface SceneObject {
  id: string
  kind: 'plane' | 'box' | 'sphere' | 'torus' | 'icosahedron' | 'torusKnot' | 'text' | 'gltf' | 'particles' | 'group' | 'html'
  props?: any
  position?: Vec3
  rotation?: Vec3
  scale?: number | Vec3
  visible?: { startFrame: number; endFrame: number }
  animation?: AnimationSpec[]
  /** Nested objects for 'group' kind. Ignored for other kinds. */
  children?: SceneObject[]
  /** Cast shadows. WebGL objects only. */
  castShadow?: boolean
  /** Receive shadows. WebGL objects only. */
  receiveShadow?: boolean
}

export interface LightSpec {
  type: 'ambient' | 'directional' | 'point' | 'spot'
  intensity: number
  color?: string
  position?: Vec3
  castShadow?: boolean
  shadowMapSize?: number
}

export interface PathRig {
  type: 'path'
  points: Vec3[]
  fov: number
  lookAt: Vec3
}

export interface OrbitRig {
  type: 'orbit'
  center: Vec3
  radius: number
  speed: number
  fov: number
  height: number
}

export interface CurveRig {
  type: 'curve'
  /** Catmull-Rom control points. */
  points: Vec3[]
  /** Closed loop. */
  closed?: boolean
  /** Catmull-Rom tension (0 = uniform, 0.5 = centripetal default). */
  tension?: number
  fov: number
  /** Optional fixed lookAt; if omitted, camera faces along the travel tangent. */
  lookAt?: Vec3
}

export type CameraRig = PathRig | OrbitRig | CurveRig

export interface PostFX {
  bloom?: { intensity: number; threshold: number; radius: number }
  dof?: { focus: number; aperture: number; maxBlur: number }
  vignette?: { offset: number; darkness: number }
}

export interface FogSpec {
  type: 'linear' | 'exp2'
  color: string
  near?: number
  far?: number
  density?: number
}

export interface Beat {
  id: string
  name: string
  startFrame: number
  endFrame: number
  objectIds: string[]
}

export interface ContinuityTokens {
  palette?: string[]
  materials?: Record<string, { color: string; roughness?: number; metalness?: number }>
  cameraRigs?: Record<string, CameraRig>
  lightRigs?: Record<string, LightSpec[]>
  postFXPresets?: Record<string, PostFX>
}

export interface SceneSpec {
  width: number
  height: number
  fps: number
  durationInFrames: number
  bgColor?: string
  hdri?: string
  postFX?: PostFX
  cameraRig?: CameraRig
  lights?: LightSpec[]
  objects: SceneObject[]
  /** Scene fog. */
  fog?: FogSpec
  /** Enable WebGL shadow maps. */
  shadows?: boolean
  /** Informational beat windows — visibility is enforced via per-object `visible`. */
  beats?: Beat[]
  /** Continuity ledger — informational at render time; used by the agent + critic. */
  continuityTokens?: ContinuityTokens
}