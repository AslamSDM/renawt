/**
 * JITTER CRITIC (merged content-relevance + scene critic)
 *
 * Replaces the two former passes (contentRelevanceChecker + jitterSceneCritic)
 * with ONE LLM call. The model sees the doc scene-by-scene — every text /
 * mockup / code / stat layer in playback order, plus the BrandReport and an
 * explicit allow-list of REAL STATS — and flags everything a human reviewer
 * would catch before shipping:
 *
 *   relevance defects (were contentRelevanceChecker):
 *     - placeholder text ("yoursite.com", "Your Product", "Lorem", …)
 *     - mockup url chrome that isn't the real domain
 *     - empty mockup chrome (no screenshot)
 *     - code blocks on a non-dev product
 *     - invented / paraphrased copy not backed by BrandReport
 *
 *   finishing defects (were jitterSceneCritic):
 *     - fabricated stats (NumberCounter / ProgressBar with no real figure)
 *     - weak ending (final scene fizzles on a stat / bare mockup, not the CTA)
 *     - duplicate headlines across back-to-back scenes
 *
 * One LLM call (Gemini), one apply pass. Fixes are applied in-place by layer id.
 */

import { chatWithGeminiPro, CODE_GENERATOR_CONFIG } from "./model";
import type { JitterDoc } from "../video/jitterJson";
import type { BrandReport } from "./urlToJitter";

export interface CriticIssue {
  /** 0-based artboard index in playback order (for the model's reasoning). */
  sceneIndex?: number;
  layerId: string;
  /**
   * text   → rewrite a text / Typewriter layer (fix = verbatim BrandReport copy)
   * url    → fix BrowserMockup domain (fix = real domain, no protocol)
   * screenshot → set a mockup/ScreenshotShowcase screenshot (fix = image url) or drop if omitted
   * code   → rewrite a CodeBlock (fix = real code) — rare
   * stat   → correct a NumberCounter/ProgressBar (fix = JSON props) or drop if omitted
   * drop   → remove the layer entirely
   */
  field: "text" | "url" | "screenshot" | "code" | "stat" | "drop";
  problem: string;
  /** Replacement value (see field). Omit to delete for field=stat/screenshot/drop. */
  fix?: string;
}

export interface Critique {
  issues: CriticIssue[];
}

const SYSTEM_PROMPT = `You are the finishing critic for short auto-generated product videos. You review the video SCENE BY SCENE (each scene is one artboard, given in playback order) and flag anything a human reviewer would call out before shipping.

You receive:
1. A BrandReport with the REAL product copy (productName, tagline, headlines, features, CTA) and an explicit list of REAL STATS that actually appear on the page (may be empty).
2. SOURCE URL + HERO IMAGE URL (use the hero url to fix missing mockup screenshots).
3. The scenes in order. Each lists its layers with an id, a kind (text / browser / mac / phone / code / typewriter / numberCounter / progressBar), and the current content (text, mockup url, whether it has a real screenshot, stat value).

Flag these defects:
- PLACEHOLDER TEXT: "yoursite.com", "example.com", "Your Product", "Product Name", "Click here", "Lorem ipsum", "Tagline", "Feature 1", "Sample text", any generic stand-in → field="text", fix = verbatim BrandReport copy (headline / tagline / productName / feature title / CTA).
- INVENTED / PARAPHRASED COPY not supported by BrandReport → field="text" with the closest real copy, or field="drop" if nothing fits.
- MOCKUP URL chrome that isn't the real product domain → field="url", fix = real domain (strip protocol; if unknown, productName slug + ".com").
- EMPTY MOCKUP (browser/mac/phone with no real screenshot and nothing meaningful) → field="screenshot" with fix = the HERO IMAGE URL if provided, else field="drop".
- CODE BLOCK on a non-coding product → field="drop".
- FABRICATED STAT: a numberCounter / progressBar whose number/percentage is NOT in REAL STATS (the classic stray "99%", "100", "10x"). If a real stat matches, correct it (field="stat", fix = JSON of props to override, e.g. "{\\"to\\":40,\\"suffix\\":\\"%\\"}"). If nothing backs it, DROP it (field="stat", omit fix).
- WEAK ENDING: the final scene ends on a stat or bare mockup instead of the productName / tagline / CTA → rewrite a text layer to the CTA/tagline (field="text"), or field="drop".
- DUPLICATE COPY: the same headline repeated in back-to-back scenes → field="drop" the repeat.

Return ONLY a JSON object, no markdown:
{
  "issues": [
    { "sceneIndex": 0, "layerId": "string", "field": "text|url|screenshot|code|stat|drop", "problem": "short reason", "fix": "string or omit" }
  ]
}

RULES:
- Be conservative on stats: only flag clearly-unsupported figures. A loosely-matching real figure is fine — leave it.
- text/url fixes MUST be verbatim from the BrandReport. Never invent.
- If a layer is fine, do not include it. An empty issues array is a valid, expected answer.`;

interface LayerSnapshot {
  layerId: string;
  kind:
    | "text"
    | "browser"
    | "mac"
    | "phone"
    | "code"
    | "typewriter"
    | "numberCounter"
    | "progressBar";
  text?: string;
  url?: string;
  hasScreenshot?: boolean;
  to?: number;
  prefix?: string;
  suffix?: string;
}

interface SceneSnapshot {
  sceneIndex: number;
  name?: string;
  isLast: boolean;
  layers: LayerSnapshot[];
}

function summarizeScenes(doc: JitterDoc): SceneSnapshot[] {
  const artboards = doc.conf.artboards;
  return artboards.map((a, i) => {
    const layers: LayerSnapshot[] = [];
    function walk(list: any[]) {
      for (const l of list || []) {
        if (!l || typeof l !== "object") continue;
        if (l.type === "layerGrp" && Array.isArray(l.layers)) walk(l.layers);
        if (l.type === "text" && typeof l.text === "string") {
          layers.push({ layerId: l.id, kind: "text", text: l.text });
        }
        if (l.type === "custom") {
          switch (l.component) {
            case "Typewriter":
              if (l.props?.text)
                layers.push({
                  layerId: l.id,
                  kind: "typewriter",
                  text: String(l.props.text),
                });
              break;
            case "BrowserMockup":
              layers.push({
                layerId: l.id,
                kind: "browser",
                url: l.props?.url,
                hasScreenshot: Boolean(l.props?.screenshot),
              });
              break;
            case "MacMockup":
              layers.push({
                layerId: l.id,
                kind: "mac",
                hasScreenshot: Boolean(l.props?.screenshot),
              });
              break;
            case "PhoneMockup":
              layers.push({
                layerId: l.id,
                kind: "phone",
                hasScreenshot: Boolean(l.props?.screenshot),
              });
              break;
            case "CodeBlock":
              layers.push({
                layerId: l.id,
                kind: "code",
                text: l.props?.code,
              });
              break;
            case "NumberCounter":
              layers.push({
                layerId: l.id,
                kind: "numberCounter",
                to: l.props?.to,
                prefix: l.props?.prefix,
                suffix: l.props?.suffix,
              });
              break;
            case "ProgressBar":
              layers.push({
                layerId: l.id,
                kind: "progressBar",
                to: l.props?.to,
                suffix: "%",
              });
              break;
          }
        }
      }
    }
    walk(a.layers);
    return {
      sceneIndex: i,
      name: a.name,
      isLast: i === artboards.length - 1,
      layers,
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
  const matches = blob.match(
    /[$€£]?\d[\d,.]*\s?(?:%|x|\+|k|m|bn|billion|million|hours?|days?|min|sec)?/gi,
  );
  return Array.from(new Set((matches || []).map((s) => s.trim()))).slice(0, 40);
}

export async function critiqueJitterDoc(
  doc: JitterDoc,
  brand: BrandReport,
  ctx: { sourceUrl?: string; heroImageUrl?: string | null } = {},
): Promise<Critique> {
  const scenes = summarizeScenes(doc);
  const realStats = extractRealStats(brand);

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
HERO IMAGE URL (use to fix missing mockup screenshots): ${ctx.heroImageUrl ?? "(none)"}

REAL STATS found in the page copy (the ONLY numbers/percentages allowed in stat widgets — if empty, NO stat widget is justified):
${realStats.length ? realStats.join(", ") : "(none — the page has no statistics)"}

SCENES IN PLAYBACK ORDER (${scenes.length} total):
${JSON.stringify(scenes, null, 2)}

Return ONLY the JSON issues object.`;

  console.log(
    `[jitterCritic] reviewing ${scenes.length} scenes — ${scenes.reduce(
      (n, s) => n + s.layers.length,
      0,
    )} layers, realStats=[${realStats.join(", ")}]`,
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
  return parsed as Critique;
}

/**
 * Apply a Critique to the doc in-place. Returns counts for logging.
 */
export function applyCritique(
  doc: JitterDoc,
  critique: Critique,
): {
  rewritten: number;
  dropped: number;
  statsFixed: number;
  screenshotsFixed: number;
} {
  let rewritten = 0;
  let dropped = 0;
  let statsFixed = 0;
  let screenshotsFixed = 0;

  // Drop = field "drop", OR field "stat"/"screenshot" with no fix.
  const dropIds = new Set(
    critique.issues
      .filter(
        (i) =>
          i.field === "drop" ||
          ((i.field === "stat" || i.field === "screenshot") && !i.fix),
      )
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
        switch (issue.field) {
          case "text":
            if (l.type === "text") {
              l.text = issue.fix;
              rewritten++;
            } else if (l.type === "custom" && l.component === "Typewriter") {
              l.props = { ...(l.props || {}), text: issue.fix };
              rewritten++;
            }
            break;
          case "url":
            if (l.type === "custom" && l.component === "BrowserMockup") {
              l.props = { ...(l.props || {}), url: issue.fix };
              rewritten++;
            }
            break;
          case "screenshot":
            if (
              l.type === "custom" &&
              [
                "BrowserMockup",
                "MacMockup",
                "PhoneMockup",
                "ScreenshotShowcase",
              ].includes(l.component)
            ) {
              if (l.component === "ScreenshotShowcase") {
                l.props = { ...(l.props || {}), screenshots: [issue.fix] };
              } else {
                l.props = { ...(l.props || {}), screenshot: issue.fix };
              }
              screenshotsFixed++;
            }
            break;
          case "code":
            if (l.type === "custom" && l.component === "CodeBlock") {
              l.props = { ...(l.props || {}), code: issue.fix };
              rewritten++;
            }
            break;
          case "stat":
            if (
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
                // Malformed override — safer to drop the bogus stat.
                dropped++;
                continue;
              }
            }
            break;
        }
      }
      kept.push(l);
    }
    return kept;
  }

  for (const art of doc.conf.artboards) {
    art.layers = fixIn(art.layers) as typeof art.layers;
  }
  return { rewritten, dropped, statsFixed, screenshotsFixed };
}
