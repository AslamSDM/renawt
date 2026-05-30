/**
 * SCENE CRITIC AGENT
 *
 * Runs AFTER the content-relevance pass. Where contentRelevanceChecker works
 * layer-by-layer ("is this text on-brand?"), this agent reviews the doc
 * SCENE-BY-SCENE (artboard by artboard, in playback order) and judges each
 * scene as a viewer would. It catches the defects that survive a per-layer
 * scan:
 *
 *   - Fabricated statistics: a NumberCounter / ProgressBar showing a number or
 *     percentage (the classic stray "99%" at the end) that is NOT backed by a
 *     real figure in the BrandReport. Marketing pages rarely ship a "99%" stat;
 *     the LLM invents them. We drop or correct these.
 *   - A final scene that fizzles on a random metric / mockup instead of a clear
 *     brand sign-off or CTA.
 *   - Empty mockups (chrome with no screenshot) the relevance pass missed.
 *   - Duplicate / repeated headlines across consecutive scenes.
 *
 * Output: per-scene issues with fixes the caller applies in-place. One LLM call
 * (Gemini Pro). Cheap enough to run on every video.
 */

import { chatWithGeminiPro, CODE_GENERATOR_CONFIG } from "./model";
import type { JitterDoc } from "../video/jitterJson";
import type { BrandReport } from "./urlToJitter";

export interface SceneIssue {
  /** 0-based artboard index in playback order. */
  sceneIndex: number;
  layerId: string;
  /**
   * stat  → NumberCounter / ProgressBar with an unsupported figure.
   * text  → headline / caption rewrite.
   * drop  → remove the layer entirely.
   */
  field: "stat" | "text" | "drop";
  problem: string;
  /**
   * For field="text": replacement string.
   * For field="stat": JSON object of corrected props (e.g. {"to":40,"suffix":"%"})
   *   — omit to DROP the stat layer instead (preferred when no real figure exists).
   * For field="drop": ignored.
   */
  fix?: string;
}

export interface SceneCritique {
  issues: SceneIssue[];
}

const SYSTEM_PROMPT = `You are a finishing critic for short auto-generated product videos. You watch the video SCENE BY SCENE (each scene is one artboard, given in playback order) and flag anything a human reviewer would call out before shipping.

You receive:
1. A BrandReport with the real product copy: productName, tagline, headlines, features, CTA, and an explicit list of REAL STATS that actually appear on the page (may be empty).
2. The scenes in order. Each scene lists its layers: text content, mockups (and whether they have a real screenshot), and STAT widgets (NumberCounter / ProgressBar) with the number/percentage they animate to.

Flag these defects:
- FABRICATED STAT (most important): a NumberCounter or ProgressBar whose number/percentage is NOT in the BrandReport's REAL STATS. These are hallucinated — e.g. a stray "99%", "100", "10x" with no basis. Auto-generators love to end on a random percentage. If a matching real stat exists, correct the widget to that figure (field="stat", fix=JSON of corrected props). If NO real stat backs it, DROP it (field="stat", omit fix).
- WEAK ENDING: the final scene ends on a stat or bare mockup instead of the product name / tagline / CTA. Prefer rewriting a text layer to the CTA or tagline (field="text"), or dropping the offending layer (field="drop").
- EMPTY MOCKUP: a mockup scene with no real screenshot and nothing else meaningful — drop the layer.
- DUPLICATE COPY: the same headline repeated in back-to-back scenes — drop the repeat.

Return ONLY a JSON object, no markdown:
{
  "issues": [
    { "sceneIndex": 0, "layerId": "string", "field": "stat|text|drop", "problem": "short reason", "fix": "string or omit" }
  ]
}

RULES:
- Be conservative. Only flag a stat as fabricated when it is clearly unsupported by REAL STATS. A real figure that matches (even loosely) is fine — leave it.
- For field="stat" with a fix, the fix MUST be a JSON object string of NumberCounter/ProgressBar props to override (e.g. "{\\"to\\":40,\\"suffix\\":\\"%\\"}"). To remove the stat, use field="stat" and omit fix.
- For field="text", fix MUST be verbatim from BrandReport (headline / tagline / productName / CTA).
- If a scene is fine, include nothing for it. Return only issues. Empty issues array is a valid, expected answer.`;

interface StatSnapshot {
  layerId: string;
  component: "NumberCounter" | "ProgressBar";
  to?: number;
  prefix?: string;
  suffix?: string;
}

interface SceneSnapshot {
  sceneIndex: number;
  name?: string;
  isLast: boolean;
  texts: { layerId: string; text: string }[];
  mockups: { layerId: string; component: string; hasScreenshot: boolean }[];
  stats: StatSnapshot[];
}

function summarizeScenes(doc: JitterDoc): SceneSnapshot[] {
  const artboards = doc.conf.artboards;
  return artboards.map((a, i) => {
    const texts: SceneSnapshot["texts"] = [];
    const mockups: SceneSnapshot["mockups"] = [];
    const stats: StatSnapshot[] = [];

    function walk(layers: any[]) {
      for (const l of layers || []) {
        if (!l || typeof l !== "object") continue;
        if (l.type === "layerGrp" && Array.isArray(l.layers)) walk(l.layers);
        if (l.type === "text" && typeof l.text === "string") {
          texts.push({ layerId: l.id, text: l.text });
        }
        if (l.type === "custom") {
          if (l.component === "Typewriter" && l.props?.text) {
            texts.push({ layerId: l.id, text: String(l.props.text) });
          } else if (
            ["BrowserMockup", "MacMockup", "PhoneMockup"].includes(l.component)
          ) {
            mockups.push({
              layerId: l.id,
              component: l.component,
              hasScreenshot: Boolean(l.props?.screenshot),
            });
          } else if (l.component === "NumberCounter") {
            stats.push({
              layerId: l.id,
              component: "NumberCounter",
              to: l.props?.to,
              prefix: l.props?.prefix,
              suffix: l.props?.suffix,
            });
          } else if (l.component === "ProgressBar") {
            stats.push({
              layerId: l.id,
              component: "ProgressBar",
              to: l.props?.to,
              suffix: "%",
            });
          }
        }
      }
    }
    walk(a.layers);

    return {
      sceneIndex: i,
      name: a.name,
      isLast: i === artboards.length - 1,
      texts,
      mockups,
      stats,
    };
  });
}

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cand = fence ? fence[1] : text;
  const start = cand.indexOf("{");
  const end = cand.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in response");
  return JSON.parse(cand.slice(start, end + 1));
}

/** Pull every numeric-looking figure out of the brand copy so the critic has an
 *  explicit allow-list of REAL stats to compare against. */
function extractRealStats(brand: BrandReport): string[] {
  const blob = [
    brand.tagline,
    ...(brand.headlines || []),
    ...(brand.features || []).flatMap((f: any) => [f?.title, f?.description]),
  ]
    .filter(Boolean)
    .join("  •  ");
  const matches = blob.match(/[$€£]?\d[\d,.]*\s?(?:%|x|\+|k|m|bn|billion|million|hours?|days?|min|sec)?/gi);
  return Array.from(new Set((matches || []).map((s) => s.trim()))).slice(0, 40);
}

export async function critiqueScenes(
  doc: JitterDoc,
  brand: BrandReport,
): Promise<SceneCritique> {
  const scenes = summarizeScenes(doc);
  const realStats = extractRealStats(brand);

  // Skip the LLM hop entirely if there are no stats and no empty mockups —
  // nothing for the critic to act on.
  const hasStats = scenes.some((s) => s.stats.length > 0);
  const hasEmptyMockup = scenes.some((s) =>
    s.mockups.some((m) => !m.hasScreenshot),
  );
  if (!hasStats && !hasEmptyMockup && scenes.length <= 1) {
    return { issues: [] };
  }

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

REAL STATS found in the page copy (the ONLY numbers/percentages allowed in stat widgets — if empty, NO stat widget is justified):
${realStats.length ? realStats.join(", ") : "(none — the page has no statistics)"}

SCENES IN PLAYBACK ORDER (${scenes.length} total):
${JSON.stringify(scenes, null, 2)}

Return ONLY the JSON issues object.`;

  console.log(
    `[sceneCritic] reviewing ${scenes.length} scenes — ${scenes.reduce(
      (n, s) => n + s.stats.length,
      0,
    )} stat widgets, realStats=[${realStats.join(", ")}]`,
  );

  const resp = await chatWithGeminiPro(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { ...CODE_GENERATOR_CONFIG, maxTokens: 4000 },
  );
  const parsed = extractJson(resp.content);
  if (!parsed || !Array.isArray(parsed.issues)) return { issues: [] };
  return parsed as SceneCritique;
}

/**
 * Apply a SceneCritique to the doc in-place. Returns counts for logging.
 */
export function applySceneFixes(
  doc: JitterDoc,
  critique: SceneCritique,
): { rewritten: number; dropped: number; statsFixed: number } {
  let rewritten = 0;
  let dropped = 0;
  let statsFixed = 0;

  // Drop = field "drop", OR field "stat" with no fix (remove the stat widget).
  const dropIds = new Set(
    critique.issues
      .filter((i) => i.field === "drop" || (i.field === "stat" && !i.fix))
      .map((i) => i.layerId),
  );

  function fixIn(layers: any[]): any[] {
    const kept: any[] = [];
    for (const l of layers) {
      if (!l || typeof l !== "object") {
        kept.push(l);
        continue;
      }
      if (dropIds.has(l.id)) {
        dropped++;
        continue;
      }
      if (l.type === "layerGrp" && Array.isArray(l.layers)) {
        l.layers = fixIn(l.layers);
      }
      const issue = critique.issues.find(
        (i) => i.layerId === l.id && i.fix != null,
      );
      if (issue && issue.fix) {
        if (issue.field === "text") {
          if (l.type === "text") {
            l.text = issue.fix;
            rewritten++;
          } else if (l.type === "custom" && l.component === "Typewriter") {
            l.props = { ...(l.props || {}), text: issue.fix };
            rewritten++;
          }
        } else if (
          issue.field === "stat" &&
          l.type === "custom" &&
          ["NumberCounter", "ProgressBar"].includes(l.component)
        ) {
          try {
            const overrides = JSON.parse(issue.fix);
            if (overrides && typeof overrides === "object") {
              l.props = { ...(l.props || {}), ...overrides };
              statsFixed++;
            }
          } catch {
            // Malformed override JSON — safer to drop the bogus stat than to
            // leave the fabricated figure on screen.
            dropped++;
            continue;
          }
        }
      }
      kept.push(l);
    }
    return kept;
  }

  for (const art of doc.conf.artboards) {
    art.layers = fixIn(art.layers) as typeof art.layers;
  }
  return { rewritten, dropped, statsFixed };
}
