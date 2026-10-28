import { test } from "node:test";
import assert from "node:assert/strict";
import { armMeans, ensureArms, mulberry32, rewardFromOutlier, sampleBeta, sampleMix, updateFromMetrics, type Arm } from "../src/bandit";

test("reward mapping", () => {
  assert.equal(rewardFromOutlier(1), 0.5);
  assert.equal(rewardFromOutlier(3), 0.75);
  assert.equal(rewardFromOutlier(0), 0);
  assert.equal(rewardFromOutlier(Number.NaN), 0);
});

test("beta sampler mean is close to alpha/(alpha+beta)", () => {
  const rng = mulberry32(7);
  for (const [a, b] of [[2, 5], [0.5, 0.5], [30, 10]] as const) {
    let s = 0; const n = 4000;
    for (let i = 0; i < n; i++) s += sampleBeta(a, b, rng);
    assert.ok(Math.abs(s / n - a / (a + b)) < 0.02, `${a},${b} → ${s / n}`);
  }
});

test("updateFromMetrics is immutable and accumulates", () => {
  const arms: Arm[] = [{ format: "x-vs-y", topic: "*", alpha: 1, beta: 1, pulls: 0 }];
  const next = updateFromMetrics(arms, [{ format: "x-vs-y", topic: "*", outlierScore: 3 }, { format: "mythbust", topic: "sleep myths", outlierScore: 1 }]);
  assert.equal(arms[0]!.alpha, 1);
  const x = next.find((a) => a.format === "x-vs-y")!;
  assert.equal(x.alpha, 1.75); assert.equal(x.beta, 1.25); assert.equal(x.pulls, 1);
  const m = next.find((a) => a.format === "mythbust")!;
  assert.equal(m.topic, "myth sleep");
});

test("Thompson sampling converges on the best format", () => {
  const rng = mulberry32(42);
  const truth: Record<string, number> = { "did-you-know": 0.8, "x-vs-y": 3.0, mythbust: 1.2, "wish-i-knew": 0.5 };
  let arms = ensureArms([], Object.keys(truth).map((format) => ({ format })));
  const picks: Record<string, number> = {};
  for (let round = 0; round < 60; round++) {
    const mix = sampleMix(arms, 5, { rng, maxShare: 1 });
    const outcomes = mix.picks.map((p) => ({ format: p.format, topic: p.topic, outlierScore: truth[p.format]! * (0.5 + rng()) }));
    if (round >= 40) for (const p of mix.picks) picks[p.format] = (picks[p.format] ?? 0) + 1;
    arms = updateFromMetrics(arms, outcomes);
  }
  assert.equal(armMeans(arms)[0]!.format, "x-vs-y");
  const total = Object.values(picks).reduce((a, b) => a + b, 0);
  assert.ok((picks["x-vs-y"] ?? 0) / total > 0.6, JSON.stringify(picks));
});

test("maxShare keeps the mix diverse", () => {
  const arms: Arm[] = [
    { format: "x-vs-y", topic: "*", alpha: 100, beta: 1, pulls: 100 },
    { format: "mythbust", topic: "*", alpha: 1, beta: 100, pulls: 100 },
    { format: "quiz", topic: "*", alpha: 1, beta: 100, pulls: 100 },
  ];
  const mix = sampleMix(arms, 10, { rng: mulberry32(1), maxShare: 0.4 });
  assert.equal(mix.formats["x-vs-y"], 4);
  assert.equal(mix.picks.length, 10);
  assert.deepEqual(sampleMix([], 5).picks, []);
});
