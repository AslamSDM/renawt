/**
 * THREE DIRECTOR — 10-minute 3D video orchestrator.
 *
 *   1. planner  → beat sheet (sum of durations == durationSeconds)
 *   2. ledger   → continuity tokens (palette / materials / camera / lights / postFX)
 *   3. emitter  → per-beat parallel scene emission referencing registry components
 *   4. assemble → DirectorPlan → buildSceneSpec → SceneSpec
 *   5. narration + stock images resolve in parallel with stage 3
 *   6. critic   → critiqueThreeScene (returned, NOT auto-applied)
 *
 * Pure data + LLM calls. No React / R3F / three runtime imports.
 */

import {
  chatWithGeminiPro,
  CODE_GENERATOR_CONFIG,
  type ChatMessage,
} from "./model"
import { z } from "zod"
import {
  resolveNarration,
  fetchStockImagesForTopics,
  type NarrationInput,
  type NarrationResult,
  type StockImage,
} from "./jitterAssets"
import {
  rollDesignSystem,
  describeDesignSystem,
  type DesignSystem,
} from "./designSystem"
import type { ProgressEmit } from "./progress"
import { withLlmContext } from "../llm/tokenLogger"
import type {
  SceneSpec,
  ContinuityTokensSpec,
  CameraRigSpec,
  LightDefSpec,
} from "../video/sceneSpec"
import type { DirectorPlan } from "../video/sceneBuilder"
import { buildSceneSpec } from "../video/sceneBuilder"
import {
  THREE_REGISTRY,
  THREE_COMPONENT_NAMES,
  POSTFX_PRESETS,
  HDRI_PRESETS,
} from "../video/threeRegistry"
import {
  critiqueThreeScene,
  type ThreeCriticIssue,
} from "./threeCritic"

export interface ThreeDirectorInput {
  description: string
  brandHint?: {
    productName?: string
    tagline?: string
    features?: Array<{ title: string; description?: string }>
    cta?: string
  }
  durationSeconds?: number
  width?: number
  height?: number
  fps?: number
  narration?: NarrationInput | null
  stockImageTopics?: string[]
  stockImageUrls?: string[]
  images?: string[]
  userId?: string
  projectId?: string
  jobId?: string
  onProgress?: ProgressEmit
}

export interface ThreeDirectorResult {
  plan: DirectorPlan
  spec: SceneSpec
  narration?: NarrationResult
  stockImages: StockImage[]
  continuityTokens: ContinuityTokensSpec
  criticIssues: ThreeCriticIssue[]
}

interface BeatSheetItem {
  name: string
  durationSeconds: number
  purpose: string
}

interface BeatSheet {
  beats: BeatSheetItem[]
}

interface LedgerOutput {
  continuityTokens: ContinuityTokensSpec
  postFXPreset: string
  hdri: string
  cameraRig: CameraRigSpec
  lights: LightDefSpec[]
}

interface EmittedBeat {
  name: string
  startFrame: number
  endFrame: number
  layers: Array<{ id: string; component: string; props: any }>
}

function frameAt(seconds: number, fps: number): number {
  return Math.round(seconds * fps)
}

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const cand = fence ? fence[1] : text
  const start = cand.indexOf("{")
  const end = cand.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("no JSON in response")
  return JSON.parse(cand.slice(start, end + 1))
}

function describePropsSchema(schema: any): string {
  if (!schema) return "(none)"
  const rawShape = (schema as any)?._def?.shape?.() ?? (schema as any)?.shape
  if (!rawShape || typeof rawShape !== "object") return "(opaque schema)"
  const shape = rawShape as Record<string, any>
  const parts: string[] = []
  for (const [key, val] of Object.entries(shape)) {
    const v = val as any
    const isOptional = v instanceof z.ZodOptional || v?._def?.typeName === "ZodOptional"
    const def = isOptional ? (v._def?.innerType ?? v) : v
    let kind = (def?._def?.typeName ?? "unknown").replace(/^Zod/, "").toLowerCase()
    if (def instanceof z.ZodEnum) {
      kind = `enum(${def.options.map((o: any) => JSON.stringify(o)).join("|")})`
    } else if (def instanceof z.ZodDefault) {
      kind = `${kind}(default ${JSON.stringify(def._def.defaultValue())})`
    }
    parts.push(`${key}${isOptional ? "?" : ""}: ${kind}`)
  }
  return parts.join(", ")
}

function registryCatalog(): string {
  const lines: string[] = []
  for (const name of THREE_COMPONENT_NAMES) {
    const entry = THREE_REGISTRY[name]
    if (!entry) continue
    lines.push(
      `- ${name}: ${entry.description}\n  props: { ${describePropsSchema(entry.propsSchema)} }\n  useCases: ${(entry.useCases || []).join(", ")}`,
    )
  }
  return lines.join("\n")
}

const PLANNER_SYSTEM = `You are the planning director for a 10-minute 3D product video. Given the user brief and brand hint, produce a beat sheet: an ordered array of beats that sum to the requested total duration.

Each beat: { "name": string, "durationSeconds": number, "purpose": string }.
The "purpose" is one sentence describing what this beat accomplishes (hook, feature deep-dive, social proof, CTA, etc.).

For a 600-second (10-min) product video, a reasonable starting structure — adjust as the brief demands:
- hook (15s)
- brand intro (30s)
- feature 1 (90s)
- feature 2 (90s)
- feature 3 (90s)
- use case montage (120s)
- social proof (60s)
- pricing (60s)
- recap (30s)
- CTA (15s)

The sum of durationSeconds MUST equal the requested total. Return ONLY JSON: { "beats": [...] }. No markdown fences.`

const LEDGER_SYSTEM = `You are the continuity director for a 3D product video. Given a beat sheet, brand hint, and a rolled design system, emit ONE continuity ledger that every beat will reference. The ledger is the single source of truth — beats MUST NOT re-declare palette, camera, lights, or materials per-beat.

Return ONLY JSON matching:
{
  "continuityTokens": {
    "palette": ["#hex", ...],
    "materials": { "glass": { "color": "#hex", "roughness": 0.1, "metalness": 0.0 }, "metal": {...}, "matte": {...} },
    "cameraRigs": { "hero": { "type": "path", "points": [[x,y,z], ...], "fov": 35, "lookAt": [x,y,z] }, "orbit": { "type": "orbit", "center": [0,0,0], "radius": 4, "speed": 0.2, "fov": 35, "height": 1.5 } },
    "lightRigs": { "key": [ { "type": "directional", "intensity": 1.2, "position": [5,8,6] } ], "fill": [ { "type": "ambient", "intensity": 0.4 } ], "rim": [ { "type": "directional", "intensity": 0.8, "position": [-6,4,-4] } ] },
    "postFXPresets": { "default": "cinematic" }
  },
  "postFXPreset": "cinematic|dreamy|clean|noir",
  "hdri": "studio|sunset|dawn|night|warehouse|forest|city",
  "cameraRig": { "type": "path", "points": [[x,y,z],...], "fov": 35, "lookAt": [0,0,0] },
  "lights": [ { "type": "directional", "intensity": 1.2, "position": [5,8,6] }, { "type": "ambient", "intensity": 0.4 }, { "type": "directional", "intensity": 0.8, "position": [-6,4,-4] } ]
}

Rules:
- palette: 4-6 hex colors. Always include white/gray + the brand accent.
- materials: each entry REQUIRES "color" (hex), plus roughness/metalness.
- cameraRig.type MUST be "path" for cinematic continuity; include 4-8 points. Use "lookAt" (not "target"). Use "orbit" type only for short beats, with center/radius/speed/fov/height.
- lightRigs values are ARRAYS of light defs (each: type/intensity/color?/position?).
- lights (top-level): 1 directional key + 1 ambient fill + 1 rim is the safe default.
- postFXPreset MUST be one of: ${Object.keys(POSTFX_PRESETS).join(", ")}.
- hdri MUST be one of: ${Object.keys(HDRI_PRESETS).join(", ")}.
Return ONLY JSON. No markdown fences.`

function emitterSystemPrompt(catalog: string): string {
  return `You are a 3D scene emitter. You receive ONE beat (name, startFrame, endFrame, purpose), the continuity ledger, and the registry of available 3D components. Emit the beat's layers.

Available components (name → description + prop schema):
${catalog}

Return ONLY JSON:
{
  "name": string,
  "startFrame": number,
  "endFrame": number,
  "layers": [
    { "id": string, "component": "<one of the registry names>", "props": { ...matching that component's propsSchema... } }
  ]
}

Rules:
- "component" MUST be one of: ${THREE_COMPONENT_NAMES.join(", ")}.
- props MUST match the component's propsSchema.
- Reference palette/material tokens by id from the ledger; never invent raw colors that drift from the ledger palette (white/gray/accent are allowed).
- Do NOT use Math.random in props — pass "seed": number for deterministic particles.
- Text3D requires props.text. ParticleField count <= 400.
- A beat should have 1–5 layers; the hook/CTA beats favor a single hero layer.
Return ONLY JSON. No markdown fences.`
}

function beatUserMessage(
  beat: BeatSheetItem,
  startFrame: number,
  endFrame: number,
  ledgerJson: string,
  brandHint: ThreeDirectorInput["brandHint"],
): string {
  return `BRAND HINT:
${JSON.stringify(brandHint ?? {}, null, 2)}

CONTINUITY LEDGER (reference tokens by id; do not re-declare):
${ledgerJson}

BEAT:
{
  "name": ${JSON.stringify(beat.name)},
  "startFrame": ${startFrame},
  "endFrame": ${endFrame},
  "purpose": ${JSON.stringify(beat.purpose)}
}

Emit the beat JSON now.`
}

async function callJson(
  messages: ChatMessage[],
  maxTokens = 8000,
): Promise<any> {
  let resp = await chatWithGeminiPro(messages, {
    ...CODE_GENERATOR_CONFIG,
    maxTokens,
  })
  // Cloud models with thinking can truncate at the token cap, producing empty
  // or partial output. Retry once with a bigger budget before giving up.
  if (!resp.content || !resp.content.includes("{")) {
    console.warn("[threeDirector] empty/non-JSON response, retrying with 2x tokens")
    resp = await chatWithGeminiPro(messages, {
      ...CODE_GENERATOR_CONFIG,
      maxTokens: maxTokens * 2,
    })
  }
  return extractJson(resp.content)
}

function validateBeatLayers(
  beat: EmittedBeat,
): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  for (const layer of beat.layers || []) {
    const entry = THREE_REGISTRY[layer.component]
    if (!entry) {
      errors.push(`layer "${layer.id}": unknown component "${layer.component}"`)
      continue
    }
    const schema = entry.propsSchema
    if (schema) {
      const parsed = (schema as any).safeParse(layer.props)
      if (!parsed.success) {
        errors.push(
          `layer "${layer.id}" (${layer.component}): ${parsed.error.message}`,
        )
      }
    }
  }
  return { ok: errors.length === 0, errors }
}

async function emitBeat(
  beat: BeatSheetItem,
  startFrame: number,
  endFrame: number,
  ledgerJson: string,
  brandHint: ThreeDirectorInput["brandHint"],
  catalog: string,
): Promise<EmittedBeat> {
  const sys = emitterSystemPrompt(catalog)
  let payload = await callJson([
    { role: "system", content: sys },
    {
      role: "user",
      content: beatUserMessage(beat, startFrame, endFrame, ledgerJson, brandHint),
    },
  ])
  let beatJson = payload as EmittedBeat
  beatJson.startFrame = startFrame
  beatJson.endFrame = endFrame
  let v = validateBeatLayers(beatJson)
  if (!v.ok) {
    const retryMessages: ChatMessage[] = [
      { role: "system", content: sys },
      {
        role: "user",
        content: beatUserMessage(beat, startFrame, endFrame, ledgerJson, brandHint),
      },
      { role: "assistant", content: JSON.stringify(payload) },
      {
        role: "user",
        content: `Validation failed:\n${v.errors.join("\n")}\n\nFix the layers and re-emit the SAME shape. Keep startFrame=${startFrame} and endFrame=${endFrame}.`,
      },
    ]
    payload = await callJson(retryMessages)
    beatJson = payload as EmittedBeat
    beatJson.startFrame = startFrame
    beatJson.endFrame = endFrame
    v = validateBeatLayers(beatJson)
    if (!v.ok) {
      console.warn(
        `[threeDirector] beat "${beat.name}" still invalid after retry: ${v.errors.join("; ")}`,
      )
    }
  }
  return beatJson
}

export async function generateThreeVideo(
  input: ThreeDirectorInput,
): Promise<ThreeDirectorResult> {
  return withLlmContext(
    {
      label: `threeDirector:${input.jobId ?? "anon"}`,
      userId: input.userId,
      projectId: input.projectId,
    },
    () => runThreeDirector(input),
  )
}

async function runThreeDirector(
  input: ThreeDirectorInput,
): Promise<ThreeDirectorResult> {
  const emit: ProgressEmit = input.onProgress ?? (() => {})
  const durationSeconds = input.durationSeconds ?? 600
  const fps = input.fps ?? 30
  const width = input.width ?? 1920
  const height = input.height ?? 1080
  const totalFrames = frameAt(durationSeconds, fps)

  const brandHint = input.brandHint ?? {}
  const ds: DesignSystem = rollDesignSystem({
    seed: input.projectId ?? input.description,
    mood: "premium",
  })
  const dsBlock = describeDesignSystem(ds)

  // --- Stage 1: Planner ---
  await emit({ step: "compose", label: "Planning beats", status: "running" })
  const plannerPayload = await callJson([
    {
      role: "system",
      content: `${PLANNER_SYSTEM}\n\nTotal duration requested: ${durationSeconds}s.`,
    },
    {
      role: "user",
      content: `BRIEF:\n${input.description}\n\nBRAND HINT:\n${JSON.stringify(brandHint, null, 2)}\n\nDESIGN SYSTEM:\n${dsBlock}\n\nProduce the beat sheet now.`,
    },
  ])
  const beatSheet = (plannerPayload as BeatSheet).beats
  if (!Array.isArray(beatSheet) || beatSheet.length === 0) {
    throw new Error("threeDirector: planner returned no beats")
  }
  const sum = beatSheet.reduce((s, b) => s + (b.durationSeconds || 0), 0)
  if (Math.abs(sum - durationSeconds) > Math.max(5, durationSeconds * 0.05)) {
    console.warn(
      `[threeDirector] beat durations sum=${sum}s vs requested=${durationSeconds}s — proceeding`,
    )
  }
  await emit({
    step: "compose",
    label: "Beat sheet ready",
    status: "done",
    detail: `${beatSheet.length} beats · ${sum}s`,
    output: beatSheet,
  })

  // --- Stage 2: Continuity ledger ---
  await emit({
    step: "compose",
    label: "Rolling continuity ledger",
    status: "running",
  })
  const ledgerPayload = await callJson([
    {
      role: "system",
      content: `${LEDGER_SYSTEM}\n\nDESIGN SYSTEM:\n${dsBlock}`,
    },
    {
      role: "user",
      content: `BEAT SHEET:\n${JSON.stringify(beatSheet, null, 2)}\n\nBRAND HINT:\n${JSON.stringify(brandHint, null, 2)}\n\nEmit the continuity ledger now.`,
    },
  ])
  const ledger = ledgerPayload as LedgerOutput
  if (!ledger?.continuityTokens || !ledger?.cameraRig || !Array.isArray(ledger.lights)) {
    throw new Error("threeDirector: ledger missing required fields")
  }
  await emit({
    step: "compose",
    label: "Continuity ledger ready",
    status: "done",
    detail: `postFX=${ledger.postFXPreset} hdri=${ledger.hdri}`,
    output: ledger,
  })

  const ledgerJson = JSON.stringify(ledger, null, 2)
  const catalog = registryCatalog()

  // Compute cumulative frame offsets for each beat.
  let cursor = 0
  const beatFrames = beatSheet.map((b) => {
    const start = frameAt(cursor, fps)
    const dur = b.durationSeconds || 0
    const end = frameAt(cursor + dur, fps)
    cursor += dur
    return { start, end }
  })

  // --- Stage 3 + 6 (parallel): emit each beat + resolve narration + stock images ---
  await emit({
    step: "compose",
    label: `Emitting ${beatSheet.length} beats`,
    status: "running",
  })
  const stockTopicJob: Promise<StockImage[]> = input.stockImageUrls?.length
    ? Promise.resolve(
        input.stockImageUrls.map((url) => ({ url, topic: "provided" })),
      )
    : input.stockImageTopics?.length
      ? fetchStockImagesForTopics(input.stockImageTopics, 3)
      : Promise.resolve([])
  const narrationTag = input.jobId || `three-narration-${Date.now()}`
  const narrationJob = resolveNarration(input.narration, narrationTag)

  const [emittedBeats, stockImages, narration] = await Promise.all([
    Promise.all(
      beatSheet.map((b, i) =>
        emitBeat(
          b,
          beatFrames[i].start,
          beatFrames[i].end,
          ledgerJson,
          brandHint,
          catalog,
        ),
      ),
    ),
    stockTopicJob,
    narrationJob,
  ])
  await emit({
    step: "compose",
    label: "All beats emitted",
    status: "done",
    detail: `${emittedBeats.length} beats · stock=${stockImages.length} · narration=${narration ? "ready" : "none"}`,
  })

  // --- Stage 4: Assemble DirectorPlan ---
  const plan: DirectorPlan = {
    width,
    height,
    fps,
    durationInFrames: totalFrames,
    bgColor: ledger.continuityTokens.palette[0] ?? "#0a0a0a",
    hdri: ledger.hdri,
    postFXPreset: ledger.postFXPreset,
    cameraRig: ledger.cameraRig,
    lights: ledger.lights,
    beats: emittedBeats.map((b, i) => ({
      name: b.name || beatSheet[i].name,
      startFrame: b.startFrame,
      endFrame: b.endFrame,
      layers: b.layers,
    })),
  }

  // --- Stage 5: buildSceneSpec ---
  const spec = buildSceneSpec(plan)
  if (narration) {
    (spec as any).narration = narration
  }
  if (stockImages.length) {
    (spec as any).stockImages = stockImages
  }

  // --- Stage 7: Critic (do NOT auto-apply) ---
  await emit({ step: "critique", label: "Reviewing scene", status: "running" })
  let criticIssues: ThreeCriticIssue[] = []
  try {
    const critique = await critiqueThreeScene(spec, brandHint as any, {
      heroImageUrl: input.images?.[0] ?? null,
    })
    criticIssues = critique.issues
  } catch (err) {
    console.warn(`[threeDirector] critic failed: ${err}`)
  }
  await emit({
    step: "critique",
    label: "Critic done",
    status: "done",
    detail: `${criticIssues.length} issues`,
    output: criticIssues,
  })

  return {
    plan,
    spec,
    narration: narration ?? undefined,
    stockImages,
    continuityTokens: ledger.continuityTokens,
    criticIssues,
  }
}