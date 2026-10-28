import { test } from "node:test";
import assert from "node:assert/strict";
import { previousWeekKey, weekKey, weekStart } from "../src/week";

test("weekKey matches ISO-8601", () => {
  assert.equal(weekKey(new Date("2026-10-28T12:00:00Z")), "2026-W44");
  assert.equal(weekKey(new Date("2026-01-01T00:00:00Z")), "2026-W01"); // Thu
  assert.equal(weekKey(new Date("2027-01-01T00:00:00Z")), "2026-W53"); // Fri → belongs to 2026's W53
  assert.equal(weekKey(new Date("2024-12-30T00:00:00Z")), "2025-W01"); // Mon of 2025-W01
  assert.equal(weekKey(new Date("2021-01-03T23:59:59Z")), "2020-W53");
});

test("previousWeekKey crosses year boundary", () => {
  assert.equal(previousWeekKey("2026-W44"), "2026-W43");
  assert.equal(previousWeekKey("2026-W01"), "2025-W52");
  assert.equal(previousWeekKey("2027-W01"), "2026-W53");
  assert.equal(previousWeekKey(new Date("2026-10-28T00:00:00Z")), "2026-W43");
});

test("weekStart is Monday 00:00 UTC", () => {
  assert.equal(weekStart("2026-W44").toISOString(), "2026-10-26T00:00:00.000Z");
  assert.equal(weekKey(weekStart("2026-W44")), "2026-W44");
});
