/**
 * THREE CRITIC — continuity + finishing pass for the threeDirector SceneSpec.
 *
 * Mirrors jitterCritic: one LLM call sees a compact beat-by-beat snapshot of the
 * scene, the brand, and the real stats; it returns issues; an apply pass mutates
 * the spec in-place (drop layers, fix props, fix colors). The orchestrator calls
 * this and returns the issues without auto-applying — the caller decides.
 */

import { chatWithGeminiPro, CODE_GENERATOR_CONFIG } from "./model"
import type { SceneSpec, SceneObjectSpec } from "../video/sceneSpec"
import type { BrandReport } from "./urlToJitter"

export interface ThreeCriticIssue {
  beatIndex?: number
  layerId: string
  field: "camera" | "palette" | "material" | "visibility" | "drop" | "props"
  problem: string
  fix?: string
}

export interface ThreeCritique {
  issues: ThreeCriticIssue[]
}

interface ObjectSnapshot {
  id: string
  kind: string
  color?: string
  roughness?: number
  metalness?: number
  text?: string
  src?: string
  count?: number
}

interface BeatSnapshot {
  beatIndex: number
  name: string
  startFrame: number
  endFrame: number
  objects: ObjectSnapshot[]
}

const SYSTEM_PROMPT = `You are the continuity + finishing critic for long 3D product videos. You review the scene BEAT BY BEAT (each beat is a time window with its visible objects) and flag continuity + finishing defects a human reviewer would call out before shipping.

You receive:
1. A BRAND REPORT (productName, tagline, headlines, features, CTA) and an explicit REAL STATS list — numbers actually on the page.
2. A HERO IMAGE URL (use to fix missing image srcs).
3. The beats in playback order. Each beat lists { beatIndex, name, startFrame, endFrame, objects: [{ id, kind, color, roughness, metalness, text?, src?, count? }] }.

Flag these defects:
- CAMERA POP: consecutive beats with very different camera rigs (different radius/fov/center) → field="camera", problem describes the jump; fix = "interpolate radius/center over N frames" (text).
- PALETTE DRIFT: object colors outside the continuity ledger palette (allow white/gray/accent) → field="palette", fix = nearest palette hex color.
- MATERIAL MISMATCH: object roughness/metalness that diverges from the ledger material library (e.g. glass should be roughness<0.2) → field="material", fix = JSON like {"roughness":0.1,"metalness":0.0}.
- VISIBILITY GAP: a beat with no visible objects (all objectIds outside the beat's frame window) → field="visibility".
- BAD PROPS: an object with props that don't match its kind (e.g. text kind missing props.text, particles with count > 400) → field="props", fix = JSON of corrected props.
- WEAK ENDING: last beat doesn't end on the CTA / product name → field="drop" on a non-essential layer, or field="props" with fix = JSON to rewrite a Text3D to the CTA/productName.

Return ONLY a JSON object, no markdown:
{
  "issues": [
    { "beatIndex": 0, "layerId": "string", "field": "camera|palette|material|visibility|drop|props", "problem": "short reason", "fix": "string or JSON or omit" }
  ]
}

RULES:
- fix for field="palette" MUST be a hex color from the ledger palette.
- fix for field="props" or "material" MUST be JSON.
- fix for field="camera"/"visibility" is descriptive text.
- field="drop" omits fix.
- If a layer/beat is fine, do not include it. An empty issues array is valid.`

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const cand = fence ? fence[1] : text
  const start = cand.indexOf("{")
  const end = cand.lastIndexOf("}")
  if (start === -1 || end === -1) throw new Error("no JSON in response")
  return JSON.parse(cand.slice(start, end + 1))
}

function flattenObjects(objects: SceneObjectSpec[]): SceneObjectSpec[] {
  const out: SceneObjectSpec[] = []
  for (const obj of objects) {
    out.push(obj)
    if (obj.children?.length) out.push(...flattenObjects(obj.children as SceneObjectSpec[]))
  }
  return out
}

function snapshotFromObject(obj: SceneObjectSpec): ObjectSnapshot {
  const props = (obj.props || {}) as Record<string, unknown>
  return {
    id: obj.id,
    kind: obj.kind,
    color: typeof props.color === "string" ? props.color : undefined,
    roughness: typeof props.roughness === "number" ? props.roughness : undefined,
    metalness: typeof props.metalness === "number" ? props.metalness : undefined,
    text: typeof props.text === "string" ? props.text : undefined,
    src: typeof props.src === "string" ? props.src : undefined,
    count: typeof props.count === "number" ? props.count : undefined,
  }
}

function summarizeBeats(spec: SceneSpec): BeatSnapshot[] {
  const beats = (spec as any).beats || []
  const allObjects = flattenObjects((spec as any).objects || [])
  const byId = new Map<string, SceneObjectSpec>()
  for (const o of allObjects) byId.set(o.id, o)
  return beats.map((beat: any, i: number) => {
    const ids: string[] = beat.objectIds || []
    const windowObjects: ObjectSnapshot[] = ids
      .map((id) => byId.get(id))
      .filter((o): o is SceneObjectSpec => Boolean(o))
      .map(snapshotFromObject)
    return {
      beatIndex: i,
      name: beat.name ?? `beat-${i}`,
      startFrame: beat.startFrame,
      endFrame: beat.endFrame,
      objects: windowObjects,
    }
  })
}

function extractRealStats(brand: BrandReport): string[] {
  const blob = [
    brand.tagline,
    ...(brand.headlines || []),
    ...(brand.features || []).flatMap((f: any) => [f?.title, f?.description]),
  ]
    .filter(Boolean)
    .join("  •  ")
  const matches = blob.match(
    /[$€£]?\d[\d,.]*\s?(?:%|x|\+|k|m|bn|billion|million|hours?|days?|min|sec)?/gi,
  )
  return Array.from(new Set((matches || []).map((s) => s.trim()))).slice(0, 40)
}

export async function critiqueThreeScene(
  spec: SceneSpec,
  brand: BrandReport,
  ctx: { sourceUrl?: string; heroImageUrl?: string | null } = {},
): Promise<ThreeCritique> {
  const beats = summarizeBeats(spec)
  const realStats = extractRealStats(brand)

  const userMessage = `BRAND REPORT:
${JSON.stringify(
  {
    productName: brand.productName,
    tagline: brand.tagline,
    headlines: brand.headlines,
    features: brand.features,
    cta: brand.cta,
  },
  null,
  2,
)}

SOURCE URL: ${ctx.sourceUrl ?? "(none)"}
HERO IMAGE URL (use to fix missing object srcs): ${ctx.heroImageUrl ?? "(none)"}

REAL STATS found in the page copy (the ONLY numbers/percentages allowed in stat widgets):
${realStats.length ? realStats.join(", ") : "(none — the page has no statistics)"}

CONTINUITY LEDGER PALETTE (allowed colors; white/gray/accent also allowed):
${JSON.stringify(((spec as any).continuityTokens?.palette) || [], null, 2)}

BEATS IN PLAYBACK ORDER (${beats.length} total):
${JSON.stringify(beats, null, 2)}

Return ONLY the JSON issues object.`

  console.log(
    `[threeCritic] reviewing ${beats.length} beats — ${beats.reduce(
      (n, b) => n + b.objects.length,
      0,
    )} objects, realStats=[${realStats.join(", ")}]`,
  )

  let resp = await chatWithGeminiPro(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { ...CODE_GENERATOR_CONFIG, maxTokens: 8000 },
  )
  // Cloud thinking models can truncate at the token cap — retry once with more.
  if (!resp.content || !resp.content.includes("{")) {
    resp = await chatWithGeminiPro(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      { ...CODE_GENERATOR_CONFIG, maxTokens: 16000 },
    )
  }
  const parsed = extractJson(resp.content)
  if (!parsed || !Array.isArray(parsed.issues)) return { issues: [] }
  return parsed as ThreeCritique
}

/**
 * Apply a ThreeCritique to the spec in-place. Returns counts for logging.
 * Drops layers by id, merges JSON fix props, and fixes colors.
 */
export function applyThreeCritique(
  spec: SceneSpec,
  critique: ThreeCritique,
): { rewritten: number; dropped: number } {
  let rewritten = 0
  let dropped = 0
  const dropIds = new Set(
    critique.issues.filter((i) => i.field === "drop").map((i) => i.layerId),
  )

  const fixFor = (id: string) =>
    critique.issues.find(
      (i) => i.layerId === id && i.field !== "drop" && i.fix != null,
    )

  function walkAndFix(list: SceneObjectSpec[]): SceneObjectSpec[] {
    const kept: SceneObjectSpec[] = []
    for (const obj of list) {
      const id = obj.id
      if (dropIds.has(id)) {
        dropped++
        continue
      }
      if (obj.children?.length) {
        obj.children = walkAndFix(obj.children as SceneObjectSpec[]) as SceneObjectSpec[]
      }
      const issue = fixFor(id)
      if (issue && issue.fix) {
        const props = { ...((obj.props as Record<string, unknown>) || {}) }
        if (issue.field === "props" || issue.field === "material") {
          try {
            const overrides = JSON.parse(issue.fix)
            if (overrides && typeof overrides === "object") {
              obj.props = { ...props, ...overrides }
              rewritten++
            }
          } catch {
            // Malformed JSON — skip.
          }
        } else if (issue.field === "palette") {
          obj.props = { ...props, color: issue.fix }
          rewritten++
        }
      }
      kept.push(obj)
    }
    return kept
  }

  const objects: SceneObjectSpec[] = (spec as any).objects || []
  ;(spec as any).objects = walkAndFix(objects)
  return { rewritten, dropped }
}