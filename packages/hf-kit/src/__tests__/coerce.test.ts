import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMATS, type ScenePlan } from "@remawt/shared";
import {
  BLOCK_NAMES, BLOCK_SAMPLES, OVERLAY_NAMES, OVERLAY_SAMPLES, STRICT_BLOCK_SCHEMAS, STRICT_OVERLAY_SCHEMAS,
  blockGuide, buildSystemPrompt, coerceData, coercePlan, composeVideo, lintComposition, parseNumber, ComposeError,
} from "../index";
import { demoKit, demoScript, fakeVoice } from "../demo/fixtures";

type Fixture = { headline?: string; body?: string; data: unknown; assetIds?: string[]; check?: (d: Record<string, unknown>) => void };

/** Three messy, LLM-shaped fixtures per block (all observed or near-observed planner output). */
const MESSY: Record<string, Fixture[]> = {
  "kinetic-headline": [
    { headline: "The sky is not blue for the reason you think", data: { emphasis: "not blue" }, check: (d) => assert.deepEqual(d.emphasis, ["not", "blue"]) },
    { headline: "Stop believing this", data: { kicker: "Myth #1 that everyone repeats about the colour of the sky above", align: "Centered", highlight: ["believing"] }, check: (d) => { assert.equal(d.align, "center"); assert.ok(String(d.kicker).length <= 40); assert.deepEqual(d.emphasis, ["believing"]); } },
    { headline: "Thank physics", data: null as unknown, check: (d) => assert.deepEqual(d.emphasis, []) },
  ],
  diagram: [
    // The observed live failure: nodes as bare strings.
    { headline: "How light scatters", data: { nodes: ["Sunlight", "Air molecules", "Blue scatters", "Your eyes"] }, check: (d) => { const n = d.nodes as Array<{ id: string; label: string }>; assert.equal(n[0].label, "Sunlight"); assert.equal(n[0].id, "sunlight"); assert.equal((d.edges as unknown[]).length, 3); } },
    { headline: "Cause and effect", data: { layout: "flow", nodes: [{ label: "Rates up" }, { text: "Loans cost more" }, { name: "Spending falls" }], edges: ["Rates up -> Loans cost more", ["Loans cost more", "Spending falls"]] }, check: (d) => { assert.equal(d.layout, "vertical"); assert.deepEqual((d.edges as Array<{ from: string }>).map((e) => e.from), ["rates-up", "loans-cost-more"]); } },
    { headline: "The water cycle", data: { layout: "circular", steps: [{ id: 1, title: "Evaporation", description: "Sun heats the sea" }, { id: 2, title: "Condensation" }, { id: 3, title: "Rain" }], connections: [{ source: 1, target: 2 }, { source: "2", target: "3" }, { source: "Rain", target: "Evaporation", label: "repeat forever and ever and ever" }] }, check: (d) => { assert.equal(d.layout, "cycle"); assert.equal((d.edges as unknown[]).length, 3); assert.equal((d.nodes as Array<{ sub?: string }>)[0].sub, "Sun heats the sea"); } },
  ],
  counter: [
    { headline: "Upfront cost", data: { value: "$4,000", label: "deposit" }, check: (d) => { assert.equal(d.value, 4000); assert.equal(d.prefix, "$"); } },
    { headline: "Share who could cover it", data: { number: "39%", label: "of Americans" }, check: (d) => { assert.equal(d.value, 39); assert.equal(d.suffix, "%"); } },
    { headline: "Light speed", data: { value: 299792.458, suffix: " km per second", decimals: "3" }, check: (d) => { assert.equal(d.decimals, 3); assert.ok(String(d.suffix).length <= 8); } },
  ],
  chart: [
    { headline: "Wavelength vs scattering", data: { type: "bar chart", series: [1, 2.4, 5.6, 9.2], unit: "percent" }, check: (d) => { assert.equal(d.type, "bar"); assert.equal((d.series as Array<{ values: number[] }>)[0].values.length, 4); assert.deepEqual(d.labels, ["1", "2", "3", "4"]); assert.equal(d.unit, "%"); } },
    // The planner's old prompt shape: {labels, values, unit, source} at top level, numbers as strings.
    { headline: "Savings vs inflation", data: { labels: [2020, 2021, 2022, 2023], values: ["$100", "$98", "$91", "$87"], source: { title: "BLS" } as unknown, annotations: [{ at: "2022", text: "Inflation spike" }] }, check: (d) => { assert.deepEqual((d.series as Array<{ values: number[] }>)[0].values, [100, 98, 91, 87]); assert.deepEqual(d.labels, ["2020", "2021", "2022", "2023"]); assert.equal((d.annotations as Array<{ index: number }>)[0].index, 2); assert.equal(d.source, "BLS"); } },
    { headline: "Two lines", data: { series: { "S&P 500": [100, 120, 150], CPI: [100, 103, 108] }, data: undefined, labels: ["2015", "2020", "2025", "2030"] }, check: (d) => { assert.equal((d.series as unknown[]).length, 2); assert.equal((d.labels as unknown[]).length, 3); } },
  ],
  "split-title": [
    { headline: "Rent vs buy", data: { left: "Renting", right: "Buying" }, check: (d) => assert.deepEqual(d.left, { label: "Renting" }) },
    { headline: "Coffee vs tea", data: {}, check: (d) => { assert.equal((d.right as { label: string }).label, "tea"); } },
    { headline: "Which wins?", data: { left: { name: "Index funds", subtitle: "boring" }, right: { title: "Stock picking" }, question: "Who wins this long-term matchup after ten years?" }, check: (d) => { assert.equal((d.left as { sub: string }).sub, "boring"); assert.ok(String(d.question).length <= 30); } },
  ],
  "split-stat": [
    // Old planner prompt shape: stats {left:{label,value}, right:{...}}.
    { headline: "Upfront cost", data: { left: { label: "Renting", value: "$4,000" }, right: { label: "Buying", value: "$60,000" }, higherIsBetter: false }, check: (d) => { const r = (d.rounds as Array<Record<string, unknown>>)[0]; assert.equal(r.left, 4000); assert.equal(r.right, 60000); assert.equal(r.unit, "$"); assert.equal(r.higherIsBetter, false); assert.equal(r.metric, "Upfront cost"); } },
    { headline: "Rent vs buy", data: { rounds: ["Monthly cost: $2,100 vs $2,850"] }, check: (d) => { assert.equal((d.left as { label: string }).label, "Rent"); assert.equal((d.rounds as Array<{ right: number }>)[0].right, 2850); } },
    { headline: "Round 2", data: { left: "Renting", right: "Buying", stats: [{ label: "Wealth after 10y", left: { value: 40000 }, right: { value: "120k" }, better: "higher" }], roundNumber: "2" }, check: (d) => { const r = (d.rounds as Array<Record<string, unknown>>)[0]; assert.equal(r.right, 120000); assert.equal(r.higherIsBetter, true); assert.equal(d.roundNumber, 2); } },
  ],
  "numbered-card": [
    { headline: "Automate your savings", data: { n: "1" }, check: (d) => assert.equal(d.n, 1) },
    { headline: "Kill high-interest debt", data: { number: "Tip #2", total: "5", icon: "credit-card" }, check: (d) => { assert.equal(d.n, 2); assert.equal(d.total, 5); } },
    { headline: "Buy index funds", data: {}, check: (d) => assert.equal(d.n, 1) },
  ],
  "strike-through": [
    { headline: "The sky reflects the ocean", data: { fact: "Air scatters blue light" }, check: (d) => assert.equal(d.truth, "Air scatters blue light") },
    { headline: "Myth", data: { claim: "You need perfect credit", label: "COMMON MYTH ABOUT MONEY" }, check: (d) => { assert.equal(d.myth, "You need perfect credit"); assert.ok(String(d.label).length <= 16); } },
    { body: "Cracking knuckles causes arthritis", data: null as unknown, check: (d) => assert.equal(d.label, "MYTH") },
  ],
  "source-card": [
    // Old planner prompt shape: source {title,url}.
    { headline: "NASA says", data: { quote: "Blue light is scattered more than other colors because it travels as shorter, smaller waves.", source: { title: "NASA SpacePlace", url: "https://spaceplace.nasa.gov/blue-sky/" } }, check: (d) => { assert.equal(d.source, "NASA SpacePlace"); assert.equal(d.url, "https://spaceplace.nasa.gov/blue-sky/"); } },
    { headline: "Only 39% could cover $1,000", data: { source: "Bankrate", date: 2024, stat: "39%" }, check: (d) => { assert.equal(d.quote, "Only 39% could cover $1,000"); assert.equal(d.date, "2024"); assert.deepEqual(d.stat, { value: "39%", label: "Only 39% could cover $1,000" }); } },
    { data: { text: "Rayleigh scattering intensity is inversely proportional to the fourth power of the wavelength of light.", sources: [{ name: "Encyclopaedia Britannica" }], highlight: 123 }, check: (d) => { assert.equal(d.source, "Encyclopaedia Britannica"); assert.ok(String(d.quote).startsWith("Rayleigh")); } },
  ],
  "headline-card": [
    { headline: "Fed holds rates steady", data: { publication: "Financial Desk", date: "Mar 20, 2024" }, check: (d) => assert.equal(d.outlet, "Financial Desk") },
    { headline: "Fed holds rates steady", data: { source: { name: "Daily Ledger" } }, check: (d) => { assert.equal(d.outlet, "Daily Ledger"); assert.equal(d.date, undefined); } },
    { headline: "Markets rally", data: {}, check: (d) => assert.equal(d.outlet, "News") },
  ],
  "bullet-stack": [
    { headline: "What it means", data: { bullets: ["Savings rates stay high", "Mortgages stay expensive"] }, check: (d) => assert.equal((d.items as unknown[]).length, 2) },
    { headline: "Steps", data: { items: [{ label: "Pick a fund", icon: "search" }, { title: "Automate", description: "on payday" }], numbered: "yes" }, check: (d) => { const it = d.items as Array<{ text: string; sub?: string }>; assert.equal(it[0].text, "Pick a fund"); assert.equal(it[1].sub, "on payday"); assert.equal(d.numbered, true); } },
    { headline: "Why", data: { items: "Short waves scatter\nViolet is absorbed high up\nEyes favour blue\nSun is white\nSky looks blue\nSunsets go red" }, check: (d) => assert.equal((d.items as unknown[]).length, 5) },
  ],
  map: [
    { headline: "No income tax", data: { countries: "UAE, Qatar, Bahamas" }, check: (d) => assert.deepEqual(d.regions, ["UAE", "Qatar", "Bahamas"]) },
    { headline: "Where", data: { focus: "Middle East", regions: [{ country: "Qatar" }], markers: [{ latitude: "25.2", lng: 55.27, name: "Dubai" }] }, check: (d) => { assert.equal(d.focus, "middle-east"); assert.deepEqual(d.regions, [{ name: "Qatar" }]); assert.deepEqual(d.points, [{ lat: 25.2, lon: 55.27, label: "Dubai" }]); } },
    { headline: "Global", data: { focus: "global", points: [[35.68, 139.69, "Tokyo"]] }, check: (d) => { assert.equal(d.focus, "world"); assert.equal((d.points as Array<{ label: string }>)[0].label, "Tokyo"); } },
  ],
  "icon-grid": [
    { headline: "Accounts", data: { items: ["Savings", "Index fund", "Emergency"] }, check: (d) => assert.equal((d.items as Array<{ icon: string }>)[0].icon, "sparkles") },
    { headline: "Accounts", data: { icons: [{ icon: "shield", text: "Insurance" }, { name: "Pension", iconName: "landmark" }], columns: 5 }, check: (d) => { assert.equal((d.items as Array<{ label: string }>)[1].label, "Pension"); assert.equal(d.columns, 3); } },
    { headline: "Four colours", data: [{ icon: "sun", label: "Red" }, { icon: "sun", label: "Blue" }], check: (d) => assert.equal((d.items as unknown[]).length, 2) },
  ],
  image: [
    { headline: "Tokyo", data: { caption: "Shinjuku at 2am", kenBurns: "zoom-in" }, assetIds: ["img-1"], check: (d) => assert.equal(d.kenBurns, "in") },
    { headline: "Tokyo", data: { alt: "City", credit: 42, kenBurns: "dramatic" }, assetIds: ["img-1"], check: (d) => { assert.equal(d.caption, "City"); assert.equal(d.credit, "42"); assert.equal(d.kenBurns, "in"); } },
    { headline: "Tokyo", data: { data: { caption: "Wrapped in data" } }, assetIds: ["img-1"], check: (d) => assert.equal(d.caption, "Wrapped in data") },
  ],
  outro: [
    { headline: "Follow for more", data: { callToAction: "Follow for one science fact a day, every day", handle: "@sci" }, check: (d) => assert.ok(String(d.cta).length <= 40) },
    { headline: "Bye", data: { cta: "Follow", handle: 123, sub: null }, check: (d) => assert.equal(d.handle, "123") },
    { headline: "Bye", data: "{\"cta\":\"Save this\"}", check: (d) => assert.equal(d.cta, "Save this") },
  ],
  "video-segment": [
    { data: { inMs: "0", outMs: "3000", crop: "fill" }, assetIds: ["vid-1"], check: (d) => { assert.equal(d.outMs, 3000); assert.equal(d.crop, "cover"); } },
    { data: { startMs: 1000, endMs: 4000, crop: "contain" }, assetIds: ["vid-1"], check: (d) => { assert.equal(d.inMs, 1000); assert.equal(d.crop, "blur-pad"); } },
    { data: { start: 1.5, end: 4, crop: { x: "0.1", y: 0, w: 0.8, h: 1 } }, assetIds: ["vid-1"], check: (d) => { assert.equal(d.inMs, 1500); assert.equal(d.outMs, 4000); } },
  ],
  "chart-3d": [
    { headline: "Debt holders", data: { labels: ["Japan", "China", "UK"], values: ["$1,130", "$768", "$723"], source: "US Treasury" }, check: (d) => { assert.deepEqual((d.items as Array<{ value: number }>).map((i) => i.value), [1130, 768, 723]); assert.equal(d.unit, "$"); assert.equal(d.caption, "US Treasury"); } },
    { headline: "Market share", data: { bars: { Chrome: "65%", Safari: "18%", Edge: "5%" }, highlight: "Chrome" }, check: (d) => { const it = d.items as Array<{ label: string; value: number; highlight?: boolean }>; assert.equal(it[0].label, "Chrome"); assert.equal(it[0].value, 65); assert.equal(it[0].highlight, true); assert.equal(d.unit, "%"); } },
    { headline: "Population", data: { items: ["India: 1.43B", ["China", 1.41], { name: "USA", amount: "335M", winner: false }] }, check: (d) => { const it = d.items as Array<{ label: string; value: number }>; assert.equal(it[0].value, 1.43e9); assert.equal(it[1].label, "China"); assert.equal(it[2].value, 335e6); } },
  ],
  "globe-3d": [
    { headline: "Where it started", data: { location: "Tokyo" }, check: (d) => assert.deepEqual(d.focus, { lat: 35.68, lng: 139.69, label: "Tokyo" }) },
    { headline: "The route", data: { origin: [51.5, -0.13, "London"], destination: { latitude: "40.7", longitude: -74, name: "New York" } }, check: (d) => { assert.deepEqual(d.from, { lat: 51.5, lng: -0.13, label: "London" }); assert.equal((d.focus as { lng: number }).lng, -74); } },
    { headline: "Here", data: { lat: 64.15, lon: -21.94 }, check: (d) => { assert.equal((d.focus as { lat: number }).lat, 64.15); assert.match(String((d.focus as { label: string }).label), /64\.2°N 21\.9°W/); } },
  ],
  "stat-3d": [
    { headline: "Could cover $1,000", data: { value: "39%", subtitle: "from savings" }, check: (d) => { assert.equal(d.value, 39); assert.equal(d.suffix, "%"); assert.equal(d.label, "from savings"); } },
    { headline: "The secret", data: { text: "Patience" }, check: (d) => { assert.equal(d.value, "Patience"); } },
    { headline: "The rule", data: { phrase: "Time in the market wins", description: "not timing it" }, check: (d) => { assert.equal(d.value, "Time in the"); assert.equal(d.label, "not timing it"); } },
  ],
  "scene-3d": [
    { headline: "Orbits", data: { shapes: [{ type: "planet", pos: { x: 0, y: 0, z: 0 }, animation: "rotate", color: "#3b82f6" }, { type: "moon", position: [2, 0], motions: ["revolve"] }], view: "isometric" }, check: (d) => { const o = d.objects as Array<{ id: string; shape: string; position: number[]; motions: Array<{ type: string }>; color: string }>; assert.equal(o[0].shape, "sphere"); assert.equal(o[0].motions[0].type, "spin"); assert.deepEqual(o[1].position, [2, 0, 0]); assert.equal(o[1].motions[0].type, "orbit"); assert.equal(d.camera, "three-quarter"); assert.equal(o[0].color, "accent"); assert.notEqual(o[0].id, o[1].id); } },
    { headline: "Rolling", data: { objects: [{ id: "ball", shape: "ball", position: [-300, 0, 0], motions: [{ type: "move", to: [300, 0, 0], duration: 2, delay: 0.5 }] }, { id: "floor", shape: "floor", size: [8, 1, 8] }] }, check: (d) => { const o = d.objects as Array<{ position: number[]; scale: number; motions: Array<{ type: string; to: number[]; durationMs: number; startMs: number }> }>; assert.deepEqual(o[0].position, [-3, 0, 0]); assert.deepEqual(o[0].motions[0].to, [3, 0, 0]); assert.equal(o[0].motions[0].type, "path"); assert.equal(o[0].motions[0].durationMs, 2000); assert.equal(o[0].motions[0].startMs, 500); assert.ok(Math.abs(o[1].scale - 17 / 3) < 1e-9); } },
    { headline: "Forces", data: { objects: [{ shape: "arrow", label: "Gravity", rotation: { z: -90 }, colour: "secondary", motions: { type: "pulse", amount: 0.2 } }, "cube"], camera: "overhead" }, check: (d) => { const o = d.objects as Array<{ id: string; shape: string; color: string; rotation: number[]; motions: unknown[] }>; assert.equal(o[0].id, "gravity"); assert.equal(o[0].color, "accent2"); assert.deepEqual(o[0].rotation, [0, 0, -90]); assert.equal(o[0].motions.length, 1); assert.equal(o[1].shape, "box"); assert.equal(d.camera, "top"); } },
  ],
};

const kit = demoKit("ledger");
const script = demoScript(FORMATS[0]);
const voice = fakeVoice(script, 6000, "https://cdn.example.com/n.mp3");
const assets = [
  { id: "img-1", kind: "image" as const, url: "https://cdn.example.com/a.jpg", source: "test" },
  { id: "vid-1", kind: "user-video" as const, url: "https://cdn.example.com/v.mp4", source: "upload", width: 1080, height: 1920 },
];
const planWith = (block: string, f: Fixture): ScenePlan => ({
  totalMs: 6000, musicMood: "calm", sfxCues: [],
  scenes: [
    { id: "intro", beatId: "hook", startMs: 0, durationMs: 2000, block: "kinetic-headline", headline: "Hook line here", data: {}, assetIds: [] },
    { id: "x", beatId: "b", startMs: 2000, durationMs: 4000, block, headline: f.headline, body: f.body, data: f.data as Record<string, unknown>, assetIds: f.assetIds ?? [] },
  ],
});

test("every block has 3 messy fixtures", () => {
  for (const b of BLOCK_NAMES) assert.equal(MESSY[b]?.length, 3, b);
});

for (const block of BLOCK_NAMES) {
  MESSY[block].forEach((f, i) => {
    test(`coerce ${block} #${i + 1}: valid after coercePlan, renders and lints`, () => {
      const r = coercePlan(planWith(block, f), { assetIds: assets.map((a) => a.id) });
      assert.deepEqual(r.invalid, [], JSON.stringify(r.invalid));
      const d = r.plan.scenes[1].data as Record<string, unknown>;
      const strict = STRICT_BLOCK_SCHEMAS[block].parse(d) as Record<string, unknown>;
      f.check?.(strict);
      const comp = composeVideo({ script, voice, plan: r.plan, kit, assets });
      assert.deepEqual(lintComposition(comp).errors, []);
    });
  });
}

test("samples (prompt examples) parse strictly with zero coercions — they cannot drift from the schemas", () => {
  for (const b of BLOCK_NAMES) {
    const s = BLOCK_SAMPLES[b];
    assert.ok(STRICT_BLOCK_SCHEMAS[b].safeParse(s.data).success, b);
    assert.deepEqual(coerceData(b, STRICT_BLOCK_SCHEMAS[b], s.data).changes, [], b);
  }
  for (const b of OVERLAY_NAMES) assert.ok(STRICT_OVERLAY_SCHEMAS[b].safeParse(OVERLAY_SAMPLES[b]).success, b);
});

test("composeVideo itself is lenient (bare-string diagram nodes no longer throw)", () => {
  const comp = composeVideo({ script, voice, plan: planWith("diagram", { headline: "Flow", data: { nodes: ["A", "B", "C"] } }), kit, assets });
  assert.ok(comp.sceneFiles.some((s) => s.id === "x"));
});

test("strictness kept where rendering would break", () => {
  const bad = coercePlan(planWith("chart", { headline: "x", data: { series: [{ name: "a", values: [1] }] } }));
  assert.equal(bad.invalid.length, 1);
  assert.match(bad.invalid[0].path, /series\[0\]\.values/);
  assert.throws(() => composeVideo({ script, voice, plan: planWith("chart", { data: { series: [{ name: "a", values: [1] }] } }), kit, assets }), ComposeError);
});

test("coercePlan maps unknown blocks, numbers tips by position and drops unknown asset ids", () => {
  const plan: ScenePlan = { totalMs: 9000, musicMood: "calm", sfxCues: [], scenes: [
    { id: "a", beatId: "hook", startMs: 0, durationMs: 3000, block: "big-title", headline: "Hello", data: {}, assetIds: ["ghost"] },
    { id: "b", beatId: "tips", startMs: 3000, durationMs: 3000, block: "numbered-card", headline: "One", data: {}, assetIds: [] },
    { id: "c", beatId: "tips", startMs: 6000, durationMs: 3000, block: "numbered-card", headline: "Two", data: {}, assetIds: [] },
  ] };
  const r = coercePlan(plan, { assetIds: [] });
  assert.equal(r.plan.scenes[0].block, "kinetic-headline");
  assert.deepEqual(r.plan.scenes[0].assetIds, []);
  assert.deepEqual(r.plan.scenes.slice(1).map((s) => (s.data as { n: number; total: number }).n), [1, 2]);
  assert.equal((r.plan.scenes[2].data as { total: number }).total, 2);
  assert.deepEqual(r.invalid, []);
  assert.ok(r.changes.length >= 3);
});

test("coercePlan keeps engine metadata keys in data", () => {
  const r = coercePlan(planWith("diagram", { headline: "x", data: { nodes: ["A", "B"], asset: { kind: "image", prompt: "p" }, cutIn: true } }));
  const d = r.plan.scenes[1].data as Record<string, unknown>;
  assert.deepEqual(d.asset, { kind: "image", prompt: "p" });
  assert.equal(d.cutIn, true);
});

test("parseNumber handles display strings", () => {
  assert.deepEqual(parseNumber("$4,000"), { value: 4000, prefix: "$", suffix: "", decimals: 0, scaled: 4000 });
  assert.equal(parseNumber("39%")?.suffix, "%");
  assert.equal(parseNumber("1.2M")?.scaled, 1_200_000);
  assert.equal(parseNumber("≈ 22 %")?.value, 22);
  assert.equal(parseNumber("about 12 million")?.scaled, 12_000_000);
  assert.equal(parseNumber("blue"), null);
});

test("blockGuide gives a generated shape + example; the system prompt embeds shapes and the data rule", () => {
  const g = blockGuide("flowchart")!;
  assert.equal(g.block, "diagram");
  assert.match(g.shape, /nodes: \[\{ id: string/);
  const sys = buildSystemPrompt({ kit, format: FORMATS[0], width: 1080, height: 1920, durationMs: 30000, output: "draft", extraRules: ["custom rule"] });
  assert.ok(sys.includes("data shape: { layout?"));
  assert.ok(sys.includes("11. custom rule"));
  assert.ok(!sys.includes('"startMs":0'), "draft output has no timings");
});

test("image without a resolved asset falls back to type (coercePlan) and is a ComposeError in composeVideo", () => {
  const p = planWith("image", { headline: "Tokyo never sleeps", data: { caption: "Shinjuku", asset: { kind: "image", prompt: "city" } } });
  assert.throws(() => composeVideo({ script, voice, plan: p, kit, assets }), (e: unknown) => e instanceof ComposeError && /assetIds/.test((e as Error).message));
  const r = coercePlan(p, { assetIds: [] });
  assert.equal(r.plan.scenes[1].block, "kinetic-headline");
  assert.deepEqual(r.invalid, []);
  assert.deepEqual(lintComposition(composeVideo({ script, voice, plan: r.plan, kit, assets })).errors, []);
});
