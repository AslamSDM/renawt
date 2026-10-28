/**
 * Policy linter (PIVOT_PLAN §4.8): advisor phrasing in finance/health/legal niches, missing sources on
 * evidence formats, "as an AI" phrasing, and AI-label decisions (syntheticMedia / aigc).
 */
import type { Script, Asset } from "@remawt/shared";
import { getNiche } from "@remawt/shared";

const ADVISOR_PATTERNS: Array<[RegExp, string]> = [
  [/\b(as your|i am your|i'm your)\s+(financial|investment|medical|legal|health)\s+(advisor|adviser|doctor|lawyer|coach)\b/i, "advisor_persona"],
  [/\byou should (buy|sell|invest in|short|take|stop taking|start taking)\b/i, "directive_advice"],
  [/\b(guaranteed|risk[- ]free) (returns?|profits?|gains?)\b/i, "guaranteed_returns"],
  [/\b(this|it) will (cure|heal|reverse|treat)\b/i, "medical_claim"],
  [/\b(stop|quit) taking your (medication|meds)\b/i, "medication_directive"],
  [/\b(not|this is not) (financial|medical|legal) advice\b/i, "disclaimer_only"],
  [/\bprice (target|prediction)\b|\bwill (hit|reach) \$?\d/i, "price_prediction"],
];
const AS_AN_AI = /\bas an ai\b|\bi am an ai\b|\bi'm an ai\b|\blanguage model\b/i;
const REGULATED_GROUPS = new Set(["finance", "health"]);
const REGULATED_SLUGS = new Set(["law", "mental-health"]);
const SOURCE_FORMATS = new Set(["chart-explains", "mythbust", "headline-reaction"]);

export interface PolicyReport { flags: string[]; regulated: boolean; blocking: boolean }

export function policyLint(script: Script, opts: { niche: string; format: string }): PolicyReport {
  const n = getNiche(opts.niche);
  const regulated = !!n && (REGULATED_GROUPS.has(n.group) || REGULATED_SLUGS.has(n.slug));
  const text = [script.hook, ...script.lines.map((l) => `${l.text} ${l.onScreen ?? ""}`), script.cta].join("\n");
  const flags = new Set<string>();
  if (AS_AN_AI.test(text)) flags.add("as_an_ai_phrasing");
  if (regulated) for (const [re, flag] of ADVISOR_PATTERNS) if (re.test(text)) flags.add(flag);
  if (SOURCE_FORMATS.has(opts.format) && !script.sources.length) flags.add("missing_sources");
  if (regulated && !script.sources.length) flags.add("regulated_niche_without_sources");
  const blocking = ["advisor_persona", "medication_directive", "guaranteed_returns"].some((f) => flags.has(f));
  return { flags: [...flags], regulated, blocking };
}

/** AI labels: true only when assets include AI-generated *realistic* imagery (people/scenes). Stylized motion graphics are exempt. */
export function aiLabels(assets: Asset[]): { syntheticMedia: boolean; aigc: boolean } {
  const realistic = assets.some((a) => a.source !== "pexels" && a.source !== "pixabay" && a.license === "generated" && a.kind !== "icon" && /\b(photo|photoreal|realistic|person|people|man|woman|portrait|crowd|street|cinematic)\b/i.test(a.prompt ?? ""));
  return { syntheticMedia: realistic, aigc: realistic };
}
