/**
 * CONTENT RELEVANCE AGENT
 *
 * Reads the composed JitterDoc + the source BrandReport, asks an LLM whether
 * every text layer / mockup / code snippet actually matches the product page.
 *
 * Returns a list of per-layer issues with rewrites the caller applies to the
 * doc in-place. Catches:
 *   - placeholder text ("yoursite.com", "Your Product", "Click here", "Lorem")
 *   - generic/wrong feature names that aren't in the BrandReport
 *   - empty mockup chrome (BrowserMockup with no screenshot)
 *   - text that paraphrases instead of using verbatim page copy
 *
 * One LLM call (Gemini Flash). Cheap enough to run every video.
 */

import { chatWithGeminiPro, CODE_GENERATOR_CONFIG } from "./model";
import type { JitterDoc } from "../video/jitterJson";
import type { BrandReport } from "./urlToJitter";

export interface ContentIssue {
  layerId: string;
  artboardId: string;
  field: "text" | "url" | "screenshot" | "code" | "drop";
  problem: string;
  /** Replacement value. For field="drop", absence means delete the layer. */
  fix?: string;
}

export interface RelevanceReport {
  issues: ContentIssue[];
}

const SYSTEM_PROMPT = `You are a content-relevance reviewer for short product videos. You receive:
1. A BrandReport extracted from the product page (verbatim headlines, product name, features, CTA).
2. A list of TEXT / MOCKUP / CODE layers from a generated video doc, each with an id, the artboard id, and the current content.

Your job: scan each layer and flag any that DO NOT reflect the actual product page. Common defects:
- Placeholder text: "yoursite.com", "Your Product", "Product Name", "Click here", "Lorem ipsum", "Tagline", "Feature 1", "Sample text", any generic stand-in.
- Mockup URL chrome that says "yoursite.com" or "example.com" instead of the real product domain.
- BrowserMockup / MacMockup / PhoneMockup with no real screenshot prop set.
- Code blocks containing generic "console.log" or "hello world" when the product is not a coding tool.
- Headlines / features the LLM invented that aren't supported by BrandReport.headlines or BrandReport.features.

Return ONLY a JSON object — no markdown — of the shape:
{
  "issues": [
    { "layerId": "string", "artboardId": "string", "field": "text|url|screenshot|code|drop", "problem": "short reason", "fix": "replacement string (omit for drop)" }
  ]
}

RULES for fixes:
- For text layers with placeholders, suggest replacement using verbatim BrandReport.headlines or BrandReport.tagline / BrandReport.productName / BrandReport.features[*].title.
- For mockup url chrome, use the real product domain from BrandReport (strip the protocol). If unknown, use the productName as a slug + ".com".
- For mockup screenshot props missing, return field="screenshot" with fix=the hero image URL from the brand context if provided, else field="drop".
- For invented/irrelevant headlines, prefer field="text" with a relevant BrandReport headline; if no good match, use field="drop".
- For code blocks unrelated to the product, set field="drop".
- If a layer is fine, do not include it. Return only issues.`;

interface LayerSnapshot {
  layerId: string;
  artboardId: string;
  kind: "text" | "browser" | "mac" | "phone" | "code" | "typewriter";
  text?: string;
  url?: string;
  screenshot?: string;
}

function summarizeDocForReview(doc: JitterDoc): LayerSnapshot[] {
  const out: LayerSnapshot[] = [];
  function walk(layers: any[], artboardId: string) {
    for (const l of layers || []) {
      if (!l || typeof l !== "object") continue;
      if (l.type === "layerGrp" && Array.isArray(l.layers)) {
        walk(l.layers, artboardId);
      }
      if (l.type === "text" && typeof l.text === "string") {
        out.push({ layerId: l.id, artboardId, kind: "text", text: l.text });
      }
      if (l.type === "custom") {
        if (l.component === "BrowserMockup") {
          out.push({
            layerId: l.id,
            artboardId,
            kind: "browser",
            url: l.props?.url,
            screenshot: l.props?.screenshot,
          });
        } else if (l.component === "MacMockup") {
          out.push({
            layerId: l.id,
            artboardId,
            kind: "mac",
            screenshot: l.props?.screenshot,
          });
        } else if (l.component === "PhoneMockup") {
          out.push({
            layerId: l.id,
            artboardId,
            kind: "phone",
            screenshot: l.props?.screenshot,
          });
        } else if (l.component === "CodeBlock") {
          out.push({
            layerId: l.id,
            artboardId,
            kind: "code",
            text: l.props?.code,
          });
        } else if (l.component === "Typewriter") {
          out.push({
            layerId: l.id,
            artboardId,
            kind: "typewriter",
            text: l.props?.text,
          });
        }
      }
    }
  }
  for (const a of doc.conf.artboards) walk(a.layers, a.id);
  return out;
}

function extractJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cand = fence ? fence[1] : text;
  const start = cand.indexOf("{");
  const end = cand.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in response");
  return JSON.parse(cand.slice(start, end + 1));
}

export async function reviewContentRelevance(
  doc: JitterDoc,
  brand: BrandReport,
  ctx: { sourceUrl?: string; heroImageUrl?: string | null } = {},
): Promise<RelevanceReport> {
  const layers = summarizeDocForReview(doc);
  const userMessage = `BRAND REPORT:
${JSON.stringify(brand, null, 2)}

SOURCE URL: ${ctx.sourceUrl ?? "(none)"}
HERO IMAGE URL (use for mockup screenshot fixes): ${ctx.heroImageUrl ?? "(none)"}

LAYERS TO REVIEW (${layers.length} total):
${JSON.stringify(layers, null, 2)}

Return ONLY the JSON issues object.`;

  console.log(
    `[contentRelevance] reviewing ${layers.length} layers across ${doc.conf.artboards.length} artboards`,
  );

  const resp = await chatWithGeminiPro(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    { ...CODE_GENERATOR_CONFIG, maxTokens: 4000 },
  );
  const parsed = extractJson(resp.content);
  if (!parsed || !Array.isArray(parsed.issues)) {
    return { issues: [] };
  }
  return parsed as RelevanceReport;
}

/**
 * Apply a RelevanceReport to a doc in-place. Returns counts for logging.
 */
export function applyContentFixes(
  doc: JitterDoc,
  report: RelevanceReport,
): { rewritten: number; dropped: number } {
  let rewritten = 0;
  let dropped = 0;

  const dropIds = new Set(
    report.issues.filter((i) => i.field === "drop").map((i) => i.layerId),
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
      const issue = report.issues.find(
        (i) => i.layerId === l.id && i.field !== "drop" && i.fix != null,
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
              ["BrowserMockup", "MacMockup", "PhoneMockup", "ScreenshotShowcase"].includes(
                l.component,
              )
            ) {
              if (l.component === "ScreenshotShowcase") {
                l.props = {
                  ...(l.props || {}),
                  screenshots: [issue.fix],
                };
              } else {
                l.props = { ...(l.props || {}), screenshot: issue.fix };
              }
              rewritten++;
            }
            break;
          case "code":
            if (l.type === "custom" && l.component === "CodeBlock") {
              l.props = { ...(l.props || {}), code: issue.fix };
              rewritten++;
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
  return { rewritten, dropped };
}
