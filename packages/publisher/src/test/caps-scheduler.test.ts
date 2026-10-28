import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCap, DEFAULT_CAPS } from "../caps";
import { isWithinCap, localParts, nextSlots, spreadAcrossPlatforms, zonedTimeToUtc } from "../scheduler";

test("default caps", () => {
  assert.equal(DEFAULT_CAPS.TIKTOK.dailyLimit, 15);
  assert.equal(DEFAULT_CAPS.FACEBOOK.dailyLimit, 30);
  assert.equal(DEFAULT_CAPS.INSTAGRAM.dailyLimit, 100);
  assert.equal(DEFAULT_CAPS.THREADS.dailyLimit, 250);
  assert.equal(DEFAULT_CAPS.YOUTUBE.scope, "project");
  assert.deepEqual(checkCap("TIKTOK", 14), { allowed: true, limit: 15, remaining: 1 });
  assert.deepEqual(checkCap("TIKTOK", 15), { allowed: false, limit: 15, remaining: 0 });
  assert.equal(checkCap("X", 3, 3).allowed, false);
});

test("nextSlots: Mon/Wed/Fri 18:00 New York", () => {
  const from = new Date("2026-10-28T12:00:00Z"); // Wed 08:00 EDT
  const slots = nextSlots({ perWeek: 3, days: ["mon", "wed", "fri"], hourLocal: 18 }, "America/New_York", from, 4);
  assert.deepEqual(slots.map((d) => d.toISOString()), [
    "2026-10-28T22:00:00.000Z", // Wed (EDT, -4)
    "2026-10-30T22:00:00.000Z", // Fri
    "2026-11-02T23:00:00.000Z", // Mon after DST ends Nov 1 (EST, -5)
    "2026-11-04T23:00:00.000Z",
  ]);
  for (const s of slots) assert.equal(localParts(s, "America/New_York").hour, 18);
});

test("nextSlots: perWeek caps allowed days; slot equal to from is excluded", () => {
  const from = new Date("2026-10-26T22:00:00Z"); // Mon 18:00 EDT exactly
  const slots = nextSlots({ perWeek: 2, days: [1, 2, 3, 4, 5], hourLocal: 18 }, "America/New_York", from, 4);
  // week of Oct 26: Mon is excluded (== from) but still Tue+Wed fill the 2/week; next week Mon+Tue
  assert.deepEqual(slots.map((d) => localParts(d, "America/New_York").weekday), [2, 3, 1, 2]);
});

test("nextSlots: spring-forward gap in Europe/Berlin shifts to 03:30", () => {
  const from = new Date("2026-03-27T00:00:00Z");
  const [s] = nextSlots({ perWeek: 7, days: ["sun"], hourLocal: 2.5 }, "Europe/Berlin", from, 1);
  assert.equal(s.toISOString(), "2026-03-29T01:30:00.000Z"); // 03:30 CEST
});

test("zonedTimeToUtc: fall-back overlap picks earlier; positive & half-hour zones", () => {
  assert.equal(zonedTimeToUtc(2026, 11, 1, 1, 30, "America/New_York").toISOString(), "2026-11-01T05:30:00.000Z"); // 01:30 EDT
  assert.equal(zonedTimeToUtc(2026, 6, 1, 9, 0, "Asia/Kolkata").toISOString(), "2026-06-01T03:30:00.000Z");
  assert.equal(zonedTimeToUtc(2026, 1, 15, 7, 0, "Australia/Sydney").toISOString(), "2026-01-14T20:00:00.000Z"); // AEDT +11
  assert.equal(zonedTimeToUtc(2026, 6, 15, 7, 0, "Australia/Sydney").toISOString(), "2026-06-14T21:00:00.000Z"); // AEST +10
  assert.equal(zonedTimeToUtc(2026, 6, 15, 7, 0, "UTC").toISOString(), "2026-06-15T07:00:00.000Z");
});

test("nextSlots: empty days spreads perWeek evenly; daily cadence across DST in Sydney", () => {
  const s = nextSlots({ perWeek: 3, days: [], hourLocal: 12 }, "UTC", new Date("2026-10-25T00:00:00Z"), 3);
  assert.equal(new Set(s.map((d) => d.getUTCDay())).size, 3);
  const syd = nextSlots({ perWeek: 7, days: [0, 1, 2, 3, 4, 5, 6], hourLocal: 9 }, "Australia/Sydney", new Date("2026-10-02T00:00:00Z"), 5);
  for (const d of syd) assert.equal(localParts(d, "Australia/Sydney").hour, 9); // DST starts Oct 4
  assert.equal(syd.length, 5);
});

test("spreadAcrossPlatforms staggers 5–15 min deterministically", () => {
  const base = new Date("2026-10-28T18:00:00Z");
  const a = spreadAcrossPlatforms(base, ["TIKTOK", "YOUTUBE", "INSTAGRAM", "FACEBOOK"]);
  const b = spreadAcrossPlatforms(base, ["TIKTOK", "YOUTUBE", "INSTAGRAM", "FACEBOOK"]);
  assert.deepEqual(a, b);
  assert.equal(a[0].at.getTime(), base.getTime());
  for (let i = 1; i < a.length; i++) {
    const gap = (a[i].at.getTime() - a[i - 1].at.getTime()) / 60_000;
    assert.ok(gap >= 5 && gap <= 15, `gap ${gap}`);
  }
  assert.equal(new Set(a.map((x) => x.at.getTime())).size, a.length);
});

test("isWithinCap: rolling 24h windows incl. future scheduled", () => {
  const h = (n: number) => new Date(Date.UTC(2026, 9, 28, 0) + n * 3600_000);
  const existing = [h(0), h(1), h(2)];
  assert.equal(isWithinCap("X", existing, h(3), 3), false);
  assert.equal(isWithinCap("X", existing, h(24.5), 3), true);
  // candidate before a dense future block would overflow the future window
  assert.equal(isWithinCap("X", [h(10), h(11), h(12)], h(5), 3), false);
  assert.equal(isWithinCap("TIKTOK", [], h(0)), true);
});
