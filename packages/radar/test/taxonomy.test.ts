import { test } from "node:test";
import assert from "node:assert/strict";
import { guessFormat, producibleFormat, TAXONOMY } from "../src/taxonomy";

test("taxonomy has 15 unique formats", () => {
  assert.equal(TAXONOMY.length, 15);
  assert.equal(new Set(TAXONOMY.map((t) => t.id)).size, 15);
  assert.deepEqual([...TAXONOMY.map((t) => t.n)].sort((a, b) => a - b), Array.from({ length: 15 }, (_, i) => i + 1));
});

const cases: Array<[string, string | null, string?]> = [
  ["POV: you just got your first paycheck", "pov-story"],
  ["Top 5 deadliest animals on earth", "listicle-countdown"],
  ["Tesla vs BYD: which is actually better?", "x-vs-y"],
  ["1995 vs 2026 grocery prices", "then-vs-now"],
  ["5 things I wish I knew before my first job", "wish-i-knew"],
  ["Did you know octopuses have three hearts?", "did-you-know"],
  ["Inflation explained", "did-you-know"],
  ["Every cognitive bias explained in 60 seconds", "every-x-explained"],
  ["Stop believing this sleep myth", "mythbust"],
  ["Top 5 fitness myths", "mythbust"],
  ["Only 1% can name these flags", "quiz"],
  ["This chart explains the housing crisis", "chart-explains"],
  ["OpenAI just announced a new model", "headline-reaction"],
  ["How to make a budget in Excel", "tutorial"],
  ["When your mom finds your report card", "comedy-skit"],
  ["The creepy story of the Dyatlov Pass", "story-time"],
  ["\"The obstacle is the way\" — Marcus Aurelius", "quote-motivation"],
  ["sunset over lake", null],
];

for (const [title, expected] of cases) {
  test(`guessFormat: ${title}`, () => {
    assert.equal(guessFormat(title)?.id ?? null, expected);
  });
}

test("caption is a weaker fallback; title wins", () => {
  assert.equal(guessFormat("Wild day", "POV: you missed the bus")?.id, "pov-story");
  assert.ok(guessFormat("Wild day", "POV: you missed the bus")!.confidence < guessFormat("POV: you missed the bus")!.confidence);
  assert.equal(guessFormat("Top 10 cars", "pov: driving")?.id, "listicle-countdown");
});

test("producibleFormat maps taxonomy to shared FORMATS", () => {
  assert.equal(producibleFormat("then-vs-now"), "x-vs-y");
  assert.equal(producibleFormat("mythbust"), "mythbust");
  assert.equal(producibleFormat("pov-story"), undefined);
});
