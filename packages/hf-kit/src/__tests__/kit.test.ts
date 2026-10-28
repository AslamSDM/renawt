import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMATS, type Composition, type ScenePlan } from "@remawt/shared";
import {
  BLOCK_NAMES, BLOCK_SAMPLES, OVERLAY_NAMES, OVERLAY_SAMPLES, allocateScenes, buildScenePlanPrompt, buildSystemPrompt, chunkWords,
  composeVideo, lintComposition, renderJobId, renderRequestBody, duckingLane, ComposeError, captionWindows,
} from "../index";
import { demoKit, demoScript, fakeVoice, demoPlan } from "../demo/fixtures";

const W = (w: string, s: number, e: number) => ({ w, s, e });

// ---------- captions
test("chunkWords: max 4 words per chunk", () => {
  const words = "one two three four five six seven eight nine".split(" ").map((w, i) => W(w, i * 200, i * 200 + 150));
  const chunks = chunkWords(words);
  assert.ok(chunks.every((c) => c.words.length <= 4));
  assert.equal(chunks.map((c) => c.text).join(" "), words.map((w) => w.w).join(" "));
});

test("chunkWords: splits at punctuation", () => {
  const chunks = chunkWords([W("Stop.", 0, 200), W("Read", 260, 400), W("this,", 420, 600), W("now", 620, 800)]);
  assert.deepEqual(chunks.map((c) => c.text), ["Stop.", "Read this,", "now"]);
});

test("chunkWords: max 1.2 s span and pause split", () => {
  const slow = ["a", "b", "c", "d"].map((w, i) => W(w, i * 500, i * 500 + 450));
  assert.ok(chunkWords(slow).every((c) => c.endMs - c.startMs <= 1200));
  const paused = chunkWords([W("hello", 0, 200), W("there", 220, 400), W("friend", 900, 1100)]);
  assert.deepEqual(paused.map((c) => c.text), ["hello there", "friend"]);
});

test("captionWindows never overlap and stay inside the video", () => {
  const words = "the quick brown fox jumps over the lazy dog again and again".split(" ").map((w, i) => W(w, i * 300, i * 300 + 250));
  const chunks = chunkWords(words);
  const wins = captionWindows(chunks, 4000);
  wins.forEach((w, i) => {
    assert.ok(w.s >= 100 && w.e <= 4000 && w.e > w.s);
    if (i) assert.ok(w.s >= wins[i - 1].e - 1, "one group at a time");
  });
});

// ---------- allocation
test("allocateScenes: one slot per beat, sums to total, snaps to word gaps", () => {
  for (const format of FORMATS) {
    const script = demoScript(format);
    const voice = fakeVoice(script, 45000);
    const slots = allocateScenes(format, 45000, voice.words);
    assert.equal(slots.length, format.beats.length);
    assert.equal(slots.reduce((a, s) => a + s.durationMs, 0), 45000);
    slots.forEach((s, i) => { if (i) assert.equal(s.startMs, slots[i - 1].startMs + slots[i - 1].durationMs); });
    for (const s of slots.slice(1)) {
      const inside = voice.words.some((w) => s.startMs > w.s + 1 && s.startMs < w.e - 1);
      assert.ok(!inside, `${format.id}: boundary ${s.startMs} cuts a word`);
    }
  }
});

test("allocateScenes: works without words (pure shares)", () => {
  const f = FORMATS[0];
  const slots = allocateScenes(f, 30000, []);
  assert.equal(slots[1].startMs, Math.round(f.beats[0].share * 30000));
});

// ---------- compose + every block
const kit = demoKit("ledger");
const script = demoScript(FORMATS[0]);
const voice = fakeVoice(script, 6000, "https://cdn.example.com/n.mp3");
const assets = [
  { id: "img-1", kind: "image" as const, url: "https://cdn.example.com/a.jpg", source: "test" },
  { id: "vid-1", kind: "user-video" as const, url: "https://cdn.example.com/v.mp4", source: "upload", width: 1080, height: 1920 },
];

function planFor(block: string, extra: Partial<ScenePlan["scenes"][number]> = {}): ScenePlan {
  const s = BLOCK_SAMPLES[block as keyof typeof BLOCK_SAMPLES] ?? { data: {} };
  return {
    totalMs: 6000, musicMood: "calm", sfxCues: [],
    scenes: [
      { id: "intro", beatId: "hook", startMs: 0, durationMs: 2000, block: "kinetic-headline", headline: "Hook line here", data: {}, assetIds: [] },
      { id: "x", beatId: "b", startMs: 2000, durationMs: 4000, block, headline: s.headline, body: s.body, data: s.data, assetIds: s.assetIds ?? [], ...extra },
    ],
  };
}

for (const block of BLOCK_NAMES) {
  test(`block ${block} renders and passes lint`, () => {
    const comp = composeVideo({ script, voice, plan: planFor(block), kit, assets, music: { url: "https://cdn.example.com/m.mp3", bpm: 120, durationMs: 4000 }, sfx: [{ atMs: 2000, url: "https://cdn.example.com/s.mp3" }], watermark: true });
    const r = lintComposition(comp);
    assert.deepEqual(r.errors, [], r.errors.join("\n"));
    assert.ok(comp.sceneFiles.some((f) => f.id === "x"));
  });
}

for (const block of OVERLAY_NAMES) {
  test(`overlay ${block} renders over footage and passes lint`, () => {
    const plan: ScenePlan = { totalMs: 5000, musicMood: "calm", sfxCues: [], scenes: [
      { id: "talk", beatId: "a", startMs: 0, durationMs: 5000, block: "video-segment", data: { inMs: 1000, outMs: 6000 }, assetIds: ["vid-1"] },
      { id: "ov", beatId: "a", startMs: 500, durationMs: 2000, block, data: OVERLAY_SAMPLES[block], assetIds: [] },
    ] };
    const comp = composeVideo({ script, voice: { ...voice, durationMs: 5000 }, plan, kit, assets, media: { speechAudioUrl: "https://cdn.example.com/speech.mp3" } });
    const r = lintComposition(comp);
    assert.deepEqual(r.errors, [], r.errors.join("\n"));
    assert.ok(comp.sceneFiles.some((f) => f.id === "overlays"));
    assert.match(comp.indexHtml, /id="narration" src="https:\/\/cdn\.example\.com\/speech\.mp3"/);
    assert.equal(comp.durationMs, 5000);
  });
}

test("composeVideo: total duration = sum of scenes, covers narration", () => {
  for (const format of FORMATS) {
    const sc = demoScript(format);
    const v = fakeVoice(sc, 45000, "https://x.example/n.mp3");
    const comp = composeVideo({ script: sc, voice: v, plan: demoPlan(format, v), kit, assets });
    assert.ok(comp.durationMs >= 45000);
    assert.deepEqual(lintComposition(comp).errors, []);
  }
});

test("composeVideo: invalid data throws with the exact path", () => {
  const plan = planFor("chart", { data: { series: [{ name: "a", values: [1] }] } });
  assert.throws(() => composeVideo({ script, voice, plan, kit, assets }), (e: unknown) => e instanceof ComposeError && /plan\.scenes\[1\]\.data\.series\[0\]\.values/.test((e as Error).message));
  assert.throws(() => composeVideo({ script, voice, plan: planFor("nope"), kit, assets }), /unknown block "nope"/);
  assert.throws(() => composeVideo({ script, voice, plan: planFor("image", { assetIds: ["missing"] }), kit, assets }), /assetIds\[0\]/);
  assert.throws(() => composeVideo({ script, voice, plan: planFor("video-segment", { data: { inMs: 5000, outMs: 1000 } }), kit, assets }), /outMs/);
});

test("composeVideo is deterministic", () => {
  const a = composeVideo({ script, voice, plan: planFor("chart"), kit, assets });
  const b = composeVideo({ script, voice, plan: planFor("chart"), kit, assets });
  assert.deepEqual(a, b);
  assert.equal(renderJobId(a, "vid_1"), renderJobId(b, "vid_1"));
});

test("music is ducked under narration via data-automation", () => {
  const lane = JSON.parse(duckingLane([W("hi", 1000, 1500), W("there", 1550, 2000)], 6000));
  const pts = lane.lanes[0].points as Array<{ t: number; v: number }>;
  assert.ok(pts.some((p) => p.t >= 1 && p.t <= 2 && p.v < 0.5));
  assert.equal(pts[0].v, 0);
  assert.equal(pts.at(-1)!.v, 0);
});

test("render request carries projectFiles, frames and audio/video urls", () => {
  const plan: ScenePlan = { totalMs: 3000, musicMood: "", sfxCues: [], scenes: [{ id: "t", beatId: "a", startMs: 0, durationMs: 3000, block: "video-segment", data: { inMs: 0, outMs: 3000 }, assetIds: ["vid-1"] }] };
  const comp = composeVideo({ script, voice: { ...voice, audioUrl: "", durationMs: 0, words: [] }, plan, kit, assets });
  const body = renderRequestBody(comp, { videoId: "v1", audioUrls: ["https://a/n.mp3"] }, "job");
  assert.equal(body.durationInFrames, 90);
  assert.ok(body.projectFiles["index.html"] && body.projectFiles["compositions/t.html"]);
  assert.deepEqual(body.assets.videoUrls, ["https://cdn.example.com/v.mp4"]);
  assert.match(comp.sceneFiles[0].html, /data-has-audio="true"/, "footage keeps its own sound when there is no speech track");
});

// ---------- lint catches each violation
function base(): Composition {
  return composeVideo({ script, voice, plan: planFor("counter"), kit, assets });
}
function mutate(fn: (c: Composition) => void): string[] {
  const c = structuredClone(base());
  fn(c);
  return lintComposition(c).errors;
}
const scene = (c: Composition) => c.sceneFiles.find((f) => f.id === "x")!;

const VIOLATIONS: Array<[string, (c: Composition) => void, RegExp]> = [
  ["root composition id", (c) => { c.indexHtml = c.indexHtml.replace('data-composition-id="main"', 'data-composition-id="x0"'); }, /root data-composition-id/],
  ["root missing duration", (c) => { c.indexHtml = c.indexHtml.replace(/(id="root"[^>]*?) data-duration="[^"]*"/, "$1"); }, /root is missing data-duration/],
  ["host missing data-start", (c) => { c.indexHtml = c.indexHtml.replace(/(id="x"[^>]*?) data-start="[^"]*"/, "$1"); }, /missing data-start/],
  ["host id ≠ composition id", (c) => { c.indexHtml = c.indexHtml.replace('<div id="x" ', '<div id="xx" '); }, /must equal data-composition-id/],
  ["missing template wrapper", (c) => { scene(c).html = scene(c).html.replace("<template>", "").replace("</template>", ""); }, /wrapped in <template>/],
  ["main timeline not registered", (c) => { c.indexHtml = c.indexHtml.replace('window.__timelines["main"] =', "window.__nope ="); }, /__timelines\["main"\] is not registered/],
  ["scene timeline not registered", (c) => { scene(c).html = scene(c).html.replace('window.__timelines["x"] = tl;', ""); }, /__timelines\["x"\] is not registered/],
  ["registered before tweens", (c) => { scene(c).html = scene(c).html.replace('window.__timelines["x"] = tl;', "").replace("var tl = gsap.timeline({ paused: true });", 'var tl = gsap.timeline({ paused: true }); window.__timelines["x"] = tl;'); }, /registered before its tweens/],
  ["fromTo opacity", (c) => { scene(c).html = scene(c).html.replace("tl.set({}, {}", 'tl.fromTo("#x-c", {opacity: 0}, {opacity: 1, duration: 1}, 0.2); tl.set({}, {}'); }, /fromTo\(\) with opacity/],
  ["forbidden property", (c) => { scene(c).html = scene(c).html.replace("tl.set({}, {}", 'tl.to("#x-c", {width: 200, duration: 1}, 0.2); tl.set({}, {}'); }, /forbidden property "width"/],
  ["display tween", (c) => { scene(c).html = scene(c).html.replace("tl.set({}, {}", 'tl.to("#x-c", {display: "none"}, 0.2); tl.set({}, {}'); }, /forbidden property "display"/],
  ["Math.random", (c) => { scene(c).html = scene(c).html.replace("tl.set({}, {}", "var r = Math.random(); tl.set({}, {}"); }, /Math\.random/],
  ["repeat -1", (c) => { scene(c).html = scene(c).html.replace("tl.set({}, {}", 'tl.to("#x-c", {y: 5, repeat: -1, duration: 1}, 0.2); tl.set({}, {}'); }, /repeat: -1/],
  ["id prefix", (c) => { scene(c).html = scene(c).html.replace('id="x-c"', 'id="other-c"'); }, /must be prefixed with "x-"/],
  ["root background", (c) => { scene(c).html = scene(c).html.replace("#root { position: absolute;", "#root { background: red; position: absolute;"); }, /no background on the scene root/],
  ["durations ≠ sum", (c) => { c.indexHtml = c.indexHtml.replace(/(id="root"[^>]*?data-duration=")[^"]*"/, '$1' + "99\""); }, /sum to|root data-duration/],
  ["gap between scenes", (c) => { c.indexHtml = c.indexHtml.replace(/(<div id="x"[^>]*?data-start=")[^"]*"/, '$1' + "2.5\""); }, /back to back|past root/],
  ["missing scene file", (c) => { c.sceneFiles = c.sceneFiles.filter((f) => f.id !== "x"); }, /not found in sceneFiles/],
  ["local asset path", (c) => { c.indexHtml = c.indexHtml.replace("https://cdn.example.com/n.mp3", "/Users/me/n.mp3"); }, /local path/],
  ["audio without id", (c) => { c.indexHtml = c.indexHtml.replace('<audio id="narration" ', "<audio "); }, /without id/],
  ["audio in scene", (c) => { scene(c).html = scene(c).html.replace("</div>\n  <script>", '<audio id="x-a" src="https://a/b.mp3"></audio></div>\n  <script>'); }, /<audio> belongs in index\.html/],
  ["video not in manifest", (c) => { scene(c).html = scene(c).html.replace("</div>\n  <script>", '<video id="x-v" class="clip" muted src="https://a/b.mp4" data-start="0" data-duration="1" data-media-start="0"></video></div>\n  <script>'); }, /not listed in the #remawt-media manifest/],
  ["CSS transform on GSAP-transformed element", (c) => { scene(c).html = scene(c).html.replace("#x-c {", "#x-num { transform: scale(2); } #x-c {"); }, /CSS transform/],
];

for (const [name, fn, re] of VIOLATIONS) {
  test(`lint catches: ${name}`, () => {
    assert.deepEqual(lintComposition(base()).errors, [], "baseline must be clean");
    const errs = mutate(fn);
    assert.ok(errs.some((e) => re.test(e)), `expected ${re} in:\n${errs.join("\n")}`);
  });
}

test("lint catches video range mismatch", () => {
  const plan: ScenePlan = { totalMs: 3000, musicMood: "", sfxCues: [], scenes: [{ id: "t", beatId: "a", startMs: 0, durationMs: 3000, block: "video-segment", data: { inMs: 1000, outMs: 4000 }, assetIds: ["vid-1"] }] };
  const c = composeVideo({ script, voice: { ...voice, durationMs: 0, words: [] }, plan, kit, assets });
  assert.deepEqual(lintComposition(c).errors, []);
  c.sceneFiles[0].html = c.sceneFiles[0].html.replace('data-media-start="1"', 'data-media-start="2"');
  assert.ok(lintComposition(c).errors.some((e) => /data-media-start/.test(e)));
});

// ---------- prompts
test("prompts include every block schema and the beat slots", () => {
  const f = FORMATS[1];
  const sys = buildSystemPrompt({ kit, format: f, width: 1080, height: 1920, durationMs: 45000 });
  for (const b of BLOCK_NAMES) assert.ok(sys.includes(`### ${b}`), b);
  assert.ok(sys.includes("data schema"));
  const sc = demoScript(f);
  const user = buildScenePlanPrompt({ script: sc, voice: fakeVoice(sc, 45000), format: f, kit });
  for (const b of f.beats) assert.ok(user.includes(`- ${b.id}: start`), b.id);
});
