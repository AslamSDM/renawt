import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMATS, SKIN_PRESETS, type Composition, type ScenePlan } from "@remawt/shared";
import {
  BLOCK_SAMPLES, STRICT_BLOCK_SCHEMAS, blockCatalogue, blockGuide, coerceData, composeVideo, lintComposition, resolveBlockName,
} from "../index";
import { THREE_BLOCK_NAMES, THREE_CDN, type ThreeBlockName } from "../blocks/three/index";
import { worldOutlines } from "../blocks/three/globe3d";
import { stat3dText, glyphSubset } from "../blocks/three/stat3d";
import { FONTS_3D } from "../blocks/three/font.data";
import { mixHex, palette3d } from "../blocks/three/runtime";
import { REPAIR_EXAMPLES } from "../repair";
import { demoKit, demoScript, fakeVoice } from "../demo/fixtures";

const script = demoScript(FORMATS[0]);
const voice = fakeVoice(script, 7000, "https://cdn.example.com/n.mp3");

function plan(block: string, data: unknown, extra: Partial<ScenePlan["scenes"][number]> = {}): ScenePlan {
  const s = BLOCK_SAMPLES[block as ThreeBlockName];
  return {
    totalMs: 7000, musicMood: "calm", sfxCues: [],
    scenes: [
      { id: "intro", beatId: "hook", startMs: 0, durationMs: 2000, block: "kinetic-headline", headline: "Hook line here", data: {}, assetIds: [] },
      { id: "x", beatId: "b", startMs: 2000, durationMs: 5000, block, headline: s?.headline ?? "A title", data: data as Record<string, unknown>, assetIds: [], ...extra },
    ],
  };
}
const compose = (block: string, data?: unknown, skin = "ledger", extra: Partial<ScenePlan["scenes"][number]> = {}): Composition =>
  composeVideo({ script, voice, plan: plan(block, data ?? BLOCK_SAMPLES[block as ThreeBlockName].data, extra), kit: demoKit(skin), assets: [] });
const scene = (c: Composition, id = "x") => c.sceneFiles.find((f) => f.id === id)!.html;

// ---------- schemas
test("3D samples parse strictly with zero coercions", () => {
  for (const b of THREE_BLOCK_NAMES) {
    assert.ok(STRICT_BLOCK_SCHEMAS[b].safeParse(BLOCK_SAMPLES[b].data).success, b);
    assert.deepEqual(coerceData(b, STRICT_BLOCK_SCHEMAS[b], BLOCK_SAMPLES[b].data).changes, [], b);
  }
});

test("3D schemas reject what would break the render", () => {
  const S = STRICT_BLOCK_SCHEMAS;
  assert.ok(!S["chart-3d"].safeParse({ items: [{ label: "a", value: 1 }] }).success, "needs ≥ 2 items");
  assert.ok(!S["chart-3d"].safeParse({ items: Array.from({ length: 9 }, (_, i) => ({ label: `x${i}`, value: i })) }).success, "≤ 8 items");
  assert.ok(!S["chart-3d"].safeParse({ items: [{ label: "a", value: -1 }, { label: "b", value: 2 }] }).success, "values ≥ 0");
  assert.ok(!S["globe-3d"].safeParse({ focus: { lat: 95, lng: 0, label: "x" } }).success, "lat range");
  assert.ok(!S["globe-3d"].safeParse({ focus: { lat: 1, lng: 2 } }).success, "focus label required");
  assert.ok(!S["stat-3d"].safeParse({ value: "A phrase that is far too long" }).success, "value ≤ 14 chars");
  assert.ok(!S["scene-3d"].safeParse({ objects: [] }).success, "≥ 1 object");
  assert.ok(!S["scene-3d"].safeParse({ objects: [{ id: "a", shape: "teapot" }] }).success, "known shapes only");
  assert.ok(!S["scene-3d"].safeParse({ objects: [{ id: "a", shape: "box", position: [0, 9, 0] }] }).success, "positions within ±4");
  assert.ok(!S["scene-3d"].safeParse({ objects: [{ id: "a", shape: "box", motions: [{ type: "spin" }, { type: "bob" }, { type: "pulse" }, { type: "orbit" }] }] }).success, "≤ 3 motions");
});

test("negative chart-3d values are not clamped to 0 by coercion (they fail and go to repair)", () => {
  const r = coerceData("chart-3d", STRICT_BLOCK_SCHEMAS["chart-3d"], { items: [{ label: "a", value: -5 }, { label: "b", value: 3 }] });
  assert.equal((r.data as { items: Array<{ value: number }> }).items[0].value, -5);
});

test("3D aliases resolve", () => {
  assert.equal(resolveBlockName("globe"), "globe-3d");
  assert.equal(resolveBlockName("3d-chart"), "chart-3d");
  assert.equal(resolveBlockName("3d-text"), "stat-3d");
  assert.equal(resolveBlockName("3d"), "scene-3d");
});

// ---------- compose snapshot: runtime script + timeline registration + seek wiring
test("compose emits the pinned Three.js script once and registers a seek-driven scene", () => {
  const c = compose("chart-3d");
  const tags = c.indexHtml.match(/<script src="[^"]*three@[^"]*"><\/script>/g) ?? [];
  assert.deepEqual(tags, [`<script src="${THREE_CDN}"></script>`]);
  assert.match(THREE_CDN, /three@\d+\.\d+\.\d+\/build\/three\.min\.js$/);
  assert.ok(c.indexHtml.indexOf("gsap") < c.indexHtml.indexOf("three@"), "GSAP loads first");
  const h = scene(c);
  assert.match(h, /<canvas id="x-gl" class="x-gl" width="1080" height="\d+" data-remawt-3d="/);
  assert.match(h, /var tl = gsap\.timeline\(\{ paused: true \}\);/);
  assert.match(h, /if \(window\.THREE\) \{ try \{/);
  assert.match(h, /new T\.WebGLRenderer\(\{ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true/);
  assert.match(h, /R\.setPixelRatio\(1\)/);
  assert.match(h, /tl\.to\(\{\}, \{ duration: DUR, ease: "none", onUpdate: function \(\) \{ draw\(tl\.time\(\)\); \} \}, 0\);/);
  assert.match(h, /window\.addEventListener\("hf-seek", function \(e\)/);
  assert.match(h, /data-composition-id=\\"x\\"\]\[data-start\]/);
  // registration comes after all Three/GSAP code
  assert.ok(h.indexOf('window.__timelines["x"] = tl') > h.indexOf("hf-seek"));
  assert.doesNotMatch(h, /requestAnimationFrame|setAnimationLoop|Date\.now|performance\.now|Math\.random|new T\.Clock/);
  // a composition without 3D blocks does not load Three.js
  const flat = composeVideo({ script, voice, plan: { ...plan("chart-3d", {}), scenes: plan("chart-3d", {}).scenes.slice(0, 1) }, kit: demoKit(), assets: [] });
  assert.doesNotMatch(flat.indexHtml, /three@/);
});

test("every 3D block composes, lints clean and is deterministic on every skin", () => {
  for (const skin of SKIN_PRESETS.map((s) => s.id)) {
    for (const b of THREE_BLOCK_NAMES) {
      const a = compose(b, undefined, skin);
      const r = lintComposition(a);
      assert.deepEqual(r.errors, [], `${b}/${skin}: ${r.errors.join("\n")}`);
      assert.deepEqual(a, compose(b, undefined, skin), `${b}/${skin} deterministic`);
      // skin palette reaches WebGL as hex
      assert.ok(scene(a).includes(`"accent":"${palette3d(demoKit(skin).skin).accent}"`), `${b}/${skin} palette`);
    }
  }
});

test("hand-drawn skins switch to toon shading, ink edges and the Excalifont outlines", () => {
  const sketch = scene(compose("stat-3d", undefined, "sketch"));
  assert.match(sketch, /HAND = true/);
  const font = JSON.stringify(glyphSubset(FONTS_3D.hand, "39%").g["3"]);
  assert.ok(sketch.includes(font.slice(0, 40)), "Excalifont glyphs embedded");
  assert.match(scene(compose("stat-3d", undefined, "ledger")), /HAND = false/);
});

test("chart-3d value tags land on the counter formatting", () => {
  const h = scene(compose("chart-3d", { items: [{ label: "A", value: 1234.5 }, { label: "B", value: 99 }], unit: "%" }));
  assert.ok(h.includes(">1,234.5%</div>"));
  assert.ok(h.includes(">99.0%</div>"));
});

test("stat-3d text, glyph subset and DOM fallback", () => {
  assert.equal(stat3dText({ value: 12480.5, decimals: 2, prefix: "$", suffix: "" }), "$12,480.50");
  assert.equal(stat3dText({ value: "Patience", decimals: 0, prefix: "", suffix: "" }), "Patience");
  const sub = glyphSubset(FONTS_3D.sans, "$1,2%");
  assert.deepEqual(Object.keys(sub.g).sort(), ["$", "%", ",", "1", "2"].sort());
  assert.ok(sub.g["$"].o.startsWith("m "));
  const h = scene(compose("stat-3d"));
  assert.match(h, /id="x-fb"[^>]*>39%<\/div>/);
});

test("globe outlines are compact and in range", () => {
  const o = worldOutlines();
  assert.ok(o.length > 150);
  const flat = o.flat();
  assert.ok(flat.every((v) => Number.isInteger(v) && Math.abs(v) <= 1800));
  assert.ok(JSON.stringify(o).length < 80_000, `outline JSON ${JSON.stringify(o).length} bytes`);
});

test("palette mixing matches the CSS tokens", () => {
  assert.equal(mixHex("#ffffff", "#000000", 0.5), "#808080");
  const p = palette3d(demoKit("paper").skin);
  assert.equal(p.accent2, p.accent, "accent2 falls back to accent");
});

// ---------- lint
test("lint catches 3D contract violations", () => {
  const c = compose("scene-3d");
  const noScript = { ...c, indexHtml: c.indexHtml.replace(/<script src="[^"]*three@[^"]*"><\/script>/, "") };
  assert.ok(lintComposition(noScript).errors.some((e) => /no Three\.js <script src>/.test(e)));
  const unpinned = { ...c, indexHtml: c.indexHtml.replace(/three@[\d.]+\//, "three@latest/") };
  assert.ok(lintComposition(unpinned).errors.some((e) => /pin an exact version/.test(e)));
  const noSeek = { ...c, sceneFiles: c.sceneFiles.map((f) => (f.id === "x" ? { ...f, html: f.html.replace('addEventListener("hf-seek"', 'addEventListener("hf-x"') } : f)) };
  assert.ok(lintComposition(noSeek).errors.some((e) => /hf-seek/.test(e)));
  const raf = { ...c, sceneFiles: c.sceneFiles.map((f) => (f.id === "x" ? { ...f, html: f.html.replace("draw(0);", "requestAnimationFrame(draw);") } : f)) };
  assert.ok(lintComposition(raf).errors.some((e) => /rAF/.test(e)));
  const longMotion = compose("scene-3d", { objects: [{ id: "a", shape: "box", motions: [{ type: "spin", startMs: 1000, durationMs: 9000 }] }] });
  assert.ok(lintComposition(longMotion).warnings.some((w) => /motions end at 10000ms/.test(w)));
  const p = plan("globe-3d", BLOCK_SAMPLES["globe-3d"].data);
  const short = composeVideo({ script, voice, plan: { ...p, scenes: [{ ...p.scenes[1], durationMs: 1000 }, { ...p.scenes[0], id: "after", durationMs: 6000 }] }, kit: demoKit(), assets: [] });
  assert.ok(lintComposition(short).warnings.some((w) => /3D needs at least/.test(w)));
});

test("lint caps 3D scenes per video", () => {
  const scenes = Array.from({ length: 9 }, (_, i) => ({ id: `g${i}`, beatId: "b", startMs: i * 2000, durationMs: 2000, block: "stat-3d", headline: "x", data: { value: i }, assetIds: [] as string[] }));
  const c = composeVideo({ script, voice, plan: { totalMs: 18000, musicMood: "calm", sfxCues: [], scenes }, kit: demoKit(), assets: [] });
  assert.ok(lintComposition(c).errors.some((e) => /9 3D scenes \(max 8/.test(e)));
  const four = composeVideo({ script, voice, plan: { totalMs: 8000, musicMood: "calm", sfxCues: [], scenes: scenes.slice(0, 4) }, kit: demoKit(), assets: [] });
  assert.ok(lintComposition(four).warnings.some((w) => /4 3D scenes/.test(w)));
});

// ---------- prompts / repair
test("catalogue and repair guide carry the 3D when-to-use text and valid examples", () => {
  const cat = blockCatalogue({ footage: false });
  for (const b of THREE_BLOCK_NAMES) assert.match(cat, new RegExp(`### ${b}\\n`));
  assert.match(cat, /3D blocks \(chart-3d, globe-3d, stat-3d, scene-3d\) — when to use/);
  for (const b of THREE_BLOCK_NAMES) {
    const g = blockGuide(b)!;
    assert.match(g.doc, /Common fixes/);
    for (const line of REPAIR_EXAMPLES[b]!.split("\n")) {
      const m = line.match(/→ (\{.*\})(?: \(|$)/);
      if (!m) continue;
      const right = JSON.parse(m[1]);
      assert.ok(STRICT_BLOCK_SCHEMAS[b].safeParse(right).success, `${b}: ${m[1]}`);
    }
  }
});
