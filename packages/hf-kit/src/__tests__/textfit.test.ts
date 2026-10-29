import { test } from "node:test";
import assert from "node:assert/strict";
import { SKIN_PRESETS, type ScenePlan, type VisualSkin } from "@remawt/shared";
import { Anim } from "../anim";
import { estWidth, fitLines } from "../blocks/common";
import { diagram, diagramGeometry, edgeSegment, fitNodeText, resolveDiagramLayout, type Rect } from "../blocks/diagram";
import type { BlockCtx } from "../blocks/types";
import { lintPlanText } from "../lint";
import { blockCatalogue } from "../prompts/index";
import { contentBox, motionPreset, typeScale } from "../skin/index";
import { sketchDoc } from "../sketch/index";
import { measureText } from "../sketch/board";
import { fit } from "../sketch/blocks/common";

const BOX = contentBox(1080, 1920);
const AREA: Rect = { x: BOX.x, y: BOX.y + 214, w: BOX.w, h: BOX.h - 214 };
const LEDGER = SKIN_PRESETS.find((s) => s.id === "ledger") ?? SKIN_PRESETS[0];
const SKETCH = SKIN_PRESETS.find((s) => s.id === "sketch")!;

function ctx(skin: VisualSkin, data: Record<string, unknown>, headline = "A title here"): BlockCtx<any> {
  const motion = motionPreset(skin);
  return { sid: "t-dg", index: 1, isFirst: false, isLast: false, headline, data, durationS: 4, width: 1080, height: 1920, skin, motion, type: typeScale(1080), box: BOX, assets: [], anim: new Anim(motion) };
}
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r: Rect, o: Rect) => r.x >= o.x - 0.5 && r.y >= o.y - 0.5 && r.x + r.w <= o.x + o.w + 0.5 && r.y + r.h <= o.y + o.h + 0.5;

// ---------- fitter
test("fitLines: keeps the base size when it fits", () => {
  const f = fitLines("Short", { maxWidth: 600, maxLines: 2, base: 54, min: 28 });
  assert.equal(f.size, 54);
  assert.deepEqual(f.lines, ["Short"]);
  assert.equal(f.truncated, false);
});

test("fitLines: shrinks, then wraps, then truncates with an ellipsis; never wider than the box", () => {
  const text = "Money keeps growing every single year while you sleep and do nothing at all";
  for (const maxWidth of [200, 300, 450]) {
    const f = fitLines(text, { maxWidth, maxLines: 2, base: 54, min: 28, weight: 800 });
    assert.ok(f.lines.length <= 2);
    assert.ok(f.size >= 28 && f.size <= 54);
    for (const l of f.lines) assert.ok(estWidth(l, f.size, { weight: 800 }) <= maxWidth, `${l} @${f.size} > ${maxWidth}`);
  }
  const cut = fitLines(text, { maxWidth: 200, maxLines: 2, base: 54, min: 28 });
  assert.equal(cut.truncated, true);
  assert.ok(cut.lines[1].endsWith("…"));
});

test("fitLines: an over-long single word shrinks first and is only broken at the minimum size", () => {
  const f = fitLines("Supercalifragilisticexpialidocious", { maxWidth: 500, maxLines: 2, base: 54, min: 20, weight: 800 });
  assert.equal(f.lines.length, 1);
  assert.equal(f.truncated, false);
  const g = fitLines("Supercalifragilisticexpialidocious", { maxWidth: 200, maxLines: 1, base: 54, min: 28 });
  assert.equal(g.truncated, true);
  assert.ok(estWidth(g.lines[0], g.size) <= 200);
});

test("sketch fit(): long words and long text never exceed the line width", () => {
  const f = fit("Supercalifragilisticexpialidocious is long", 300, 54, 44, 2);
  for (const l of f.lines) assert.ok(measureText(l, f.size) <= 300, l);
  assert.equal(f.truncated, true);
});

// ---------- defect 1: orphan spokes / short arrows in hub layouts
for (const k of [2, 3, 4, 5, 6]) {
  test(`hub with ${k} spokes: every spoke connects to the hub, arrows ≥ 80 px, no overlaps`, () => {
    const nodes = [{ id: "h", label: "Hub" }, ...Array.from({ length: k }, (_, i) => ({ id: `s${i}`, label: `Spoke ${i}` }))];
    const g = diagramGeometry({ layout: "hub", nodes, edges: [{ from: "h", to: "s0" }] }, AREA);
    for (let i = 1; i <= k; i++) {
      const e = g.edges.find((x) => (x.from === 0 && x.to === i) || (x.to === 0 && x.from === i));
      assert.ok(e, `spoke ${i} is an orphan (layout ${g.layout})`);
      if (g.layout === "hub") assert.ok(edgeSegment(g.rects[e.from], g.rects[e.to]).len >= 80, `arrow to spoke ${i} too short`);
    }
    g.rects.forEach((r, i) => {
      assert.ok(inside(r, AREA), `node ${i} outside the area`);
      g.rects.forEach((o, j) => { if (j > i) assert.ok(!overlap(r, o), `nodes ${i} and ${j} overlap`); });
    });
  });
}

test("hub: 4 spokes read as a 2 + 2 pair around the hub", () => {
  const nodes = ["h", "a", "b", "c", "d"].map((id) => ({ id, label: id }));
  const g = diagramGeometry({ layout: "hub", nodes, edges: [] }, AREA);
  const hub = g.rects[0];
  const above = g.rects.slice(1).filter((r) => r.y + r.h < hub.y).length;
  const below = g.rects.slice(1).filter((r) => r.y > hub.y + hub.h).length;
  assert.deepEqual([above, below], [2, 2]);
});

test("auto layout picks the hub as the node with most edges, even when it is not first", () => {
  const nodes = ["a", "b", "h", "c"].map((id) => ({ id, label: id }));
  const edges = ["a", "b", "c"].map((x) => ({ from: "h", to: x }));
  const r = resolveDiagramLayout({ layout: "auto", nodes, edges });
  assert.equal(r.layout, "hub");
  assert.equal(r.hub, 2);
});

test("HTML diagram: hub scene draws one arrow per spoke (implicit spokes included)", () => {
  const nodes = ["h", "a", "b", "c", "d"].map((id) => ({ id, label: `Node ${id}` }));
  const out = diagram(ctx(LEDGER, { layout: "hub", nodes, edges: [{ from: "h", to: "a" }] }));
  assert.equal((out.html.match(/class="t-dg-edge"/g) ?? []).length, 4);
});

// ---------- defect 2: single node stuck at the edge; rows of 3 in portrait
test("single-node diagram is centred and large", () => {
  const g = diagramGeometry({ nodes: [{ id: "x", label: "Scattered light" }] }, AREA);
  assert.equal(g.layout, "single");
  const r = g.rects[0];
  assert.ok(r.w >= 600, `width ${r.w}`);
  assert.ok(Math.abs(r.x + r.w / 2 - (AREA.x + AREA.w / 2)) < 1);
  assert.ok(Math.abs(r.y + r.h / 2 - (AREA.y + AREA.h / 2)) < 1);
  assert.equal(fitNodeText({ label: "Scattered light", icon: "sun" }, r, true).label.size >= 80, true);
});

test("horizontal rows of 3 become a centred vertical chain in 9:16 (real plan s9)", () => {
  const nodes = [{ id: "scat", label: "Scattered light" }, { id: "dome", label: "Blue sky dome" }, { id: "you", label: "You" }];
  const g = diagramGeometry({ layout: "horizontal", nodes, edges: [{ from: "scat", to: "dome" }, { from: "dome", to: "you" }] }, AREA);
  assert.equal(g.layout, "vertical");
  const topGap = g.rects[0].y - AREA.y, botGap = AREA.y + AREA.h - (g.rects[2].y + g.rects[2].h);
  assert.ok(Math.abs(topGap - botGap) < 2, "chain is centred");
  for (const e of g.edges) assert.ok(edgeSegment(g.rects[e.from], g.rects[e.to]).len >= 80);
});

// ---------- defect 3: overflowing sublabel (real sketch plan s7)
const S7 = {
  layout: "horizontal",
  nodes: [{ id: "s25", sub: "Start investing", label: "Age 25" }, { id: "s35", sub: "Stop at $50K", label: "Age 35" }, { id: "s65", sub: "Money keeps growing", label: "Age 65" }],
  edges: [{ from: "s25", to: "s35", label: "invest" }, { from: "s35", to: "s65", label: "no new deposits" }],
};

test("sketch diagram (s7): every text line fits inside its node box", () => {
  const doc = sketchDoc("diagram", ctx(SKETCH, S7, "Age 25: 10 years, $50K"))!;
  const els = doc.pages[0].elements;
  const boxes = els.filter((e) => e.type === "rectangle");
  assert.equal(boxes.length, 3);
  assert.equal(els.filter((e) => e.type === "arrow").length, 2);
  for (const t of els.filter((e) => e.type === "text")) {
    const cx = t.x + t.width / 2, cy = t.y + t.height / 2;
    const host = boxes.find((b) => cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height);
    if (!host) continue; // title / edge labels
    assert.ok(t.x >= host.x && t.x + t.width <= host.x + host.width, `"${t.text}" overflows its box`);
  }
});

test("HTML diagram (s7 + s4 real plans): nothing truncated, sub lines fit their box", () => {
  const s4 = { layout: "vertical", nodes: [{ id: "sun", sub: "all colors mixed", icon: "sun", label: "Sunlight" }, { id: "mol", sub: "far smaller than light waves", icon: "wind", label: "Gas molecules" }, { id: "eye", icon: "eye", label: "Your eyes" }], edges: [{ from: "sun", to: "mol", label: "hits" }, { from: "mol", to: "eye", label: "scattered" }] };
  for (const d of [S7, s4]) {
    const out = diagram(ctx(LEDGER, d));
    assert.ok(!/data-fit="truncated"/.test(out.html), out.html);
    const g = diagramGeometry(d, AREA);
    d.nodes.forEach((nd, i) => {
      const f = fitNodeText(nd, g.rects[i]);
      for (const l of f.sub?.lines ?? []) assert.ok(estWidth(l, f.sub!.size, { mono: true }) <= g.rects[i].w - 44, l);
    });
  }
});

test("HTML diagram: an over-long sub is cut with … and marked for lint", () => {
  const out = diagram(ctx(LEDGER, { layout: "grid", nodes: [{ id: "a", label: "A", sub: "a sublabel that is far far too long to ever fit inside this little box at all" }, { id: "b", label: "B" }, { id: "c", label: "C" }, { id: "d", label: "D" }] }));
  assert.match(out.html, /data-fit="truncated" data-fit-role="diagram node sub"/);
  assert.match(out.html, /…<\/span>/);
});

// ---------- lint
test("lintPlanText: flags labels over budget with a repairable path + message", () => {
  const plan: ScenePlan = {
    totalMs: 4000, musicMood: "calm", sfxCues: [],
    scenes: [{ id: "s7", beatId: "b", startMs: 0, durationMs: 4000, block: "diagram", headline: "Ages", assetIds: [], data: { layout: "vertical", nodes: [{ id: "a", label: "Age 25", sub: "Start investing at the age of twenty five" }, { id: "b", label: "A label that is much too long for a node" }], edges: [{ from: "a", to: "b", label: "keeps compounding" }] } }],
  };
  const r = lintPlanText(plan);
  assert.equal(r.ok, false);
  const paths = r.issues.map((i) => i.path);
  assert.ok(paths.includes("plan.scenes[0].data.nodes[0].sub"));
  assert.ok(paths.includes("plan.scenes[0].data.nodes[1].label"));
  assert.ok(paths.includes("plan.scenes[0].data.edges[0].label"));
  assert.ok(r.issues.every((i) => /Shorten it to ≤ \d+ chars/.test(i.message) && i.sceneId === "s7" && i.block === "diagram"));
});

test("lintPlanText: the real plans' short labels pass", () => {
  const plan: ScenePlan = { totalMs: 4000, musicMood: "calm", sfxCues: [], scenes: [{ id: "s7", beatId: "b", startMs: 0, durationMs: 4000, block: "diagram", headline: "Age 25: 10 years, $50K", assetIds: [], data: { ...S7, edges: [S7.edges[0]] } }] };
  assert.deepEqual(lintPlanText(plan).errors, []);
});

test("lintPlanText: bullet-stack items and split-title labels are measured too", () => {
  const plan: ScenePlan = {
    totalMs: 8000, musicMood: "calm", sfxCues: [],
    scenes: [
      { id: "b", beatId: "b", startMs: 0, durationMs: 4000, block: "bullet-stack", assetIds: [], data: { items: ["Short one", { text: "This bullet item is written as a full long sentence that goes on" }] } },
      { id: "s", beatId: "b", startMs: 4000, durationMs: 4000, block: "split-title", assetIds: [], data: { left: { label: "Renting forever" }, right: { label: "Buy" } } },
    ],
  };
  const paths = lintPlanText(plan).issues.map((i) => i.path);
  assert.ok(paths.includes("plan.scenes[0].data.items[1].text"));
  assert.ok(paths.includes("plan.scenes[1].data.left.label"));
  assert.ok(!paths.some((p) => /items\[0\]|right/.test(p)));
});

test("planner catalogue carries per-block text budgets", () => {
  const cat = blockCatalogue({ footage: false });
  assert.match(cat, /### diagram\n[^\n]*\ntext budget: node label ≤ 18 chars/);
  assert.match(cat, /### bullet-stack\n[^\n]*\ntext budget: bullet-stack item ≤ 40 chars/);
});
