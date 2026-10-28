import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { SKIN_PRESETS, type ScenePlan, type VisualSkin } from "@remawt/shared";
import { Anim } from "../anim";
import { BLOCK_SAMPLES } from "../blocks/schema";
import type { BlockCtx } from "../blocks/types";
import { composeVideo } from "../compose";
import { demoKit, demoScript, FORMATS } from "../demo/fixtures";
import { lintComposition } from "../lint";
import { contentBox, motionPreset, typeScale } from "../skin/index";
import { Board, SKETCH_BLOCKS, buildUnits, renderSketchBlock, renderSvgs, schedule, sketchDoc, type DrawUnit } from "./index";
import { MAX_LINES_PER_PAGE } from "./doc";

const CHROME = !!(process.env.PUPPETEER_EXECUTABLE_PATH || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].some((p) => existsSync(p)));
const needsChrome = { skip: CHROME ? false : "no Chrome for Excalidraw exportToSvg" };
const SKETCH = SKIN_PRESETS.find((s) => s.id === "sketch")!;
const PAPER = SKIN_PRESETS.find((s) => s.id === "sketch-paper")!;

function ctx(skin: VisualSkin, block: string, over: Partial<BlockCtx> = {}): BlockCtx {
  const s = (BLOCK_SAMPLES as Record<string, { headline?: string; body?: string; data: Record<string, unknown> }>)[block];
  const motion = motionPreset(skin);
  return {
    sid: `t-${block}`, index: 1, isFirst: false, isLast: false, headline: s.headline, body: s.body, data: s.data, durationS: 6,
    width: 1080, height: 1920, skin, motion, type: typeScale(1080), box: contentBox(1080, 1920), assets: [], anim: new Anim(motion), ...over,
  };
}

/** [start, end] of every text-line unit, in draw order. */
function textIntervals(units: DrawUnit[], slots: Array<{ start: number; dur: number }>): Array<[number, number]> {
  return units.flatMap((u, i) => (u.kind === "text" ? [[slots[i].start, slots[i].start + slots[i].dur] as [number, number]] : []));
}

// ---------- presets
test("sketch skins: presets are hand-drawn, Excalifont, theme.py / paper palettes", () => {
  for (const s of [SKETCH, PAPER]) {
    assert.equal((s as VisualSkin & { handdrawn?: boolean }).handdrawn, true);
    assert.equal(s.type.display, "Excalifont");
    assert.equal(s.motion, "playful");
    assert.equal(s.captionStyle, "minimal");
  }
  assert.equal(SKETCH.palette.bg, "#1F2126");
  assert.equal(SKETCH.palette.accent, "#58C4DD");
  assert.equal(PAPER.palette.bg, "#FAF8F3");
  assert.ok(SKIN_PRESETS.filter((s) => !(s as { handdrawn?: boolean }).handdrawn).length >= 6, "flat presets unchanged");
});

// ---------- board
test("board: one element per text line; lines() never emits a multi-line text element", () => {
  const b = new Board("x-", 3);
  b.lines(0, 0, ["one", "two", "three"], { size: 50 });
  assert.equal(b.elements.length, 3);
  assert.throws(() => b.text(0, 0, "a\nb"));
  assert.deepEqual(buildUnits(b.elements), [[0], [1], [2]], "each line is its own unit");
});

test("board: same seed → identical elements (seeds, geometry)", () => {
  const mk = () => { const b = new Board("x-", 42); const a = b.box(10, 10, 200, 100); const c = b.ellipse(300, 10, 120, 120); b.arrowBetween(a, c); return JSON.stringify(b.elements); };
  assert.equal(mk(), mk());
});

// ---------- timing
test("schedule: units are strictly sequential, also when compressed to fit", () => {
  const units: DrawUnit[] = [
    { kind: "shape", strokes: [{ id: "a", len: 2400, dash: 2404 }], fills: [], page: 0 },
    ...Array.from({ length: 6 }, (_, i): DrawUnit => ({ kind: "text", strokes: [], fills: [], texts: [{ id: `t${i}`, chars: 30 }], page: i < 3 ? 0 : 1 })),
  ];
  for (const win of [{ t0: 0.2, t1: 30 }, { t0: 0.2, t1: 3 }]) {
    const sch = schedule(units, win);
    for (let i = 1; i < sch.slots.length; i++) assert.ok(sch.slots[i].start >= sch.slots[i - 1].start + sch.slots[i - 1].dur - 1e-9, `unit ${i} starts before ${i - 1} ends`);
    assert.ok(sch.end <= win.t1 + 1e-6);
  }
  const slow = schedule(units, { t0: 0, t1: 60 });
  assert.ok(Math.abs(slow.slots[1].dur - 30 / 14) < 1e-6, "text written at 14 chars/s when there is time");
});

test("3-line headline → 3 non-overlapping hand-writing intervals", needsChrome, () => {
  const c = ctx(SKETCH, "kinetic-headline", { headline: "Time beats timing every single time", body: undefined, data: { emphasis: [], align: "center" }, durationS: 8 });
  const r = renderSketchBlock("kinetic-headline", c)!;
  const iv = textIntervals(r.units, r.schedule.slots);
  assert.equal(iv.length, 3, `expected 3 written lines, got ${iv.length}`);
  for (let i = 1; i < iv.length; i++) assert.ok(iv[i][0] >= iv[i - 1][1], `line ${i + 1} starts at ${iv[i][0]} before line ${i} ends at ${iv[i - 1][1]}`);
  // Each line is revealed by exactly one clip sweep.
  assert.equal((r.timeline.match(/clipPath: "inset\(-30% 100%/g) ?? []).length, 3);
});

// ---------- rendering
test("exportToSvg: same seed → same path d (two independent renders)", needsChrome, () => {
  const b = new Board("d-", 9);
  const a = b.box(100, 300, 400, 160, { stroke: "#58C4DD" });
  const z = b.box(100, 700, 400, 160, { stroke: "#F0AC5F", fill: "#F0AC5F", fillStyle: "hachure" });
  b.arrowBetween(a, z);
  b.text(100, 1000, "Hello", { size: 60 });
  const [r1, r2] = renderSvgs([{ prefix: "ja", width: 1080, height: 1920, elements: b.elements }, { prefix: "jb", width: 1080, height: 1920, elements: b.elements }]);
  const ds = (svg: string) => [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ds(r1.svg).length >= 4);
  assert.deepEqual(ds(r1.svg), ds(r2.svg));
  assert.ok(r1.els[0].strokes[0].len > 1000, "rough rect path has a measured length");
  assert.match(r1.svg, /stroke-dasharray="\d+ \d+"/);
  assert.match(r1.svg, /font-family="Excalifont/);
});

test("every sketch block renders and lints in both sketch skins; ≤ 7 lines per page; lines sequential", needsChrome, () => {
  for (const skin of [SKETCH, PAPER]) {
    const names = Object.keys(SKETCH_BLOCKS);
    for (const n of names) {
      if (n === "diagram" || n === "chart") continue; // labels, not paragraphs
      const doc = sketchDoc(n, ctx(skin, n))!;
      for (const page of doc.pages) {
        const lines = buildUnits(page.elements).filter((u) => page.elements[u[0]].type === "text").length;
        assert.ok(lines <= MAX_LINES_PER_PAGE, `${n}: ${lines} lines on one page`);
      }
    }
    const scenes = names.map((b, i) => {
      const s = (BLOCK_SAMPLES as Record<string, { headline?: string; body?: string; data: Record<string, unknown> }>)[b];
      return { id: `g${i}`, beatId: "x", startMs: i * 4000, durationMs: 4000, block: b, headline: s.headline, body: s.body, data: s.data, assetIds: [] };
    });
    scenes.push({ id: "map", beatId: "x", startMs: 0, durationMs: 3000, block: "map", headline: "Fallback", body: undefined, data: BLOCK_SAMPLES.map.data, assetIds: [] });
    const plan = { scenes, totalMs: 0, musicMood: "calm", sfxCues: [] } as unknown as ScenePlan;
    const comp = composeVideo({ script: demoScript(FORMATS[0]), voice: { audioUrl: "", durationMs: 0, words: [], provider: "fake", voiceId: "x" }, plan, kit: demoKit(skin.id), assets: [] });
    const lint = lintComposition(comp);
    assert.ok(lint.ok, `${skin.id}: ${lint.errors.join("\n")}`);
    assert.deepEqual(lint.warnings.filter((w) => /non-contract/.test(w)), [], "strokeDashoffset is a contract property");
    for (const f of comp.sceneFiles.filter((f) => /^g\d+$/.test(f.id))) {
      assert.match(f.html, /<svg[^>]*viewBox="0 0 1080 1920"/, `${f.id}: excalidraw svg`);
      assert.match(f.html, /strokeDashoffset: 0/, `${f.id}: strokes draw on`);
      assert.match(f.html, /@font-face \{ font-family: "Excalifont"/, `${f.id}: embedded face`);
      assert.ok(!/fromTo\([^)]*opacity/.test(f.html));
    }
    const mapScene = comp.sceneFiles.find((f) => f.id === "map")!;
    assert.ok(!/stroke-dasharray/.test(mapScene.html), "blocks without a sketch variant keep their renderer");
    assert.ok(!/fonts\.googleapis\.com[^"]*Excalifont/.test(comp.indexHtml), "Excalifont is embedded, not fetched");
  }
});

test("compose is deterministic in a sketch skin", needsChrome, () => {
  const plan = { scenes: [{ id: "a", beatId: "x", startMs: 0, durationMs: 3000, block: "kinetic-headline", headline: "Hand drawn, line by line", data: { emphasis: ["line"] }, assetIds: [] }], totalMs: 0, musicMood: "calm", sfxCues: [] } as unknown as ScenePlan;
  const run = () => composeVideo({ script: demoScript(FORMATS[0]), voice: { audioUrl: "", durationMs: 0, words: [], provider: "fake", voiceId: "x" }, plan, kit: demoKit("sketch"), assets: [] });
  assert.deepEqual(run().sceneFiles, run().sceneFiles);
});
