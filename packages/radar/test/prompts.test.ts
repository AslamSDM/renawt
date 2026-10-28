import { test } from "node:test";
import assert from "node:assert/strict";
import { SKIN_PRESETS } from "../src/shared";
import { allowedFormats, buildIdeaPrompt, buildTagPrompt, IdeaResultSchema, parseIdeaResult, parseTagResult, TagResultSchema } from "../src/prompts";
import type { ScoredTrendItem } from "../src/types";

const item = (id: string, title: string): ScoredTrendItem & { id: string } => ({ id, platform: "YOUTUBE", url: `https://y/${id}`, title, views: 1, ageHours: 1, velocity: 1, outlier: 1 });

test("buildTagPrompt lists taxonomy, ids and regex hints", () => {
  const p = buildTagPrompt([item("i1", "POV: you quit your job"), item("i2", "Tesla vs BYD")], { niche: "Cars" });
  assert.equal(p.schema, TagResultSchema);
  assert.match(p.system, /pov-story/);
  assert.match(p.system, /comedy-skit/);
  assert.match(p.prompt, /"id":"i1".*"hint":"pov-story"/);
  assert.match(p.prompt, /"hint":"x-vs-y"/);
  assert.match(p.prompt, /with 2 entries/);
});

test("parseTagResult accepts {tags} or bare array, coerces unknown enums", () => {
  const ok = parseTagResult({ tags: [{ id: "i1", topic: "quitting jobs", format: "pov-story", hookType: "pov" }] });
  assert.equal(ok.length, 1);
  const loose = parseTagResult([{ id: "i2", topic: "ev prices", format: "versus", hookType: "weird" }, { nope: 1 }]);
  assert.deepEqual(loose.map((t) => [t.format, t.hookType]), [["other", "other"]]);
  assert.deepEqual(parseTagResult("garbage"), []);
});

const kit = {
  audience: "beginner investors in their 20s", promise: "one money concept per video", skin: SKIN_PRESETS[0]!,
  persona: { name: "The Ledger", tone: { formal: 0.4, energy: 0.6, humor: 0.3, density: 0.6 }, pov: "second" as const, signaturePhrases: [], avoid: ["hype"], language: "en" },
  formatPrefs: [], forbiddenTopics: ["meme stocks"], defaultDurationSec: 45,
};
const finance = { slug: "personal-finance", name: "Personal finance", group: "finance", riskNotes: "No AI-advisor persona; cite sources; information not advice" };
const cards = [{ id: "c1", topic: "index funds vs etfs", format: "x-vs-y", score: 9.5, summary: "12 items", exemplars: [{ url: "https://youtube.com/watch?v=abc", title: "Index funds vs ETFs", views: 250000, platform: "YOUTUBE" as const }], evidence: [{ url: "https://reuters.com/etf", title: "ETF fees record low", source: "reuters.com" }] }];

test("buildIdeaPrompt: finance rules, format whitelist, dedupe list, mix", () => {
  const p = buildIdeaPrompt({ kit, niche: finance, cards, count: 10, recentTitles: ["Why you should never buy gold"], formatMix: { "x-vs-y": 4, "did-you-know": 6, "pov-story": 2 } });
  assert.equal(p.schema, IdeaResultSchema);
  assert.match(p.system, /NO 'AI advisor'/);
  assert.match(p.system, /No AI-advisor persona; cite sources/);
  assert.match(p.system, /Never cover: meme stocks/);
  assert.match(p.system, /x-vs-y×4, did-you-know×6/);
  assert.doesNotMatch(p.system, /pov-story×2/, "non-producible formats filtered from mix");
  assert.match(p.system, /format MUST be one of: did-you-know, chart-explains, x-vs-y, wish-i-knew, mythbust, headline-reaction/);
  assert.match(p.prompt, /Avoid these recent titles[\s\S]*never buy gold/);
  assert.match(p.prompt, /"id":"c1"/);
  assert.match(p.prompt, /reuters\.com\/etf/);
  const hist = buildIdeaPrompt({ kit, niche: { slug: "history", name: "History", group: "knowledge" }, cards, count: 3, recentTitles: [] });
  assert.doesNotMatch(hist.system, /AI advisor/);
});

test("allowedFormats respects niche tags", () => {
  const ids = allowedFormats({ slug: "history", name: "History", group: "knowledge" }).map((f) => f.id);
  assert.ok(ids.includes("mythbust") && ids.includes("did-you-know") && !ids.includes("chart-explains"));
});

test("parseIdeaResult enforces evidence, dedupe, advice flags", () => {
  const base = { hook: "Which one actually costs you less?", format: "x-vs-y", angle: "fees over 30 years", beats: [{ label: "Matchup", durationSec: 4, note: "" }, { label: "Rounds", durationSec: 30, note: "" }], risk: { level: "low", flags: [] }, score: 0.7 };
  const raw = { ideas: [
    { ...base, title: "Index funds vs ETFs: the 30-year fee gap", cardId: "c1", evidence: [{ url: "https://reuters.com/etf", title: "x" }, { url: "https://made-up.com/x", title: "fake" }] },
    { ...base, title: "Index funds vs ETFs: the 30 year fee gap!", evidence: [] },              // near-dup of previous
    { ...base, title: "Why you should never buy gold again", evidence: [] },                     // recent title
    { ...base, title: "POV: rich", format: "pov-story", evidence: [] },                          // non-producible
    { ...base, title: "Bad", beats: [] },                                                       // schema fail
    { ...base, title: "What a 1% fee really costs", cardId: "nope", evidence: [] },
  ] };
  const out = parseIdeaResult(raw, { cards, recentTitles: ["Why you should never buy gold"], niche: finance });
  assert.equal(out.length, 2, out.map((o) => o.title).join(" | "));
  assert.deepEqual(out[0]!.evidence.map((e) => e.url), ["https://reuters.com/etf"]);
  assert.equal(out[0]!.cardId, "c1");
  assert.equal(out[0]!.risk.level, "medium");
  assert.ok(out[0]!.risk.flags.includes("needs-citation"));
  assert.equal(out[1]!.cardId, undefined);
  assert.ok(out[1]!.risk.flags.includes("no-evidence"));
});
