import { test } from "node:test";
import assert from "node:assert/strict";
import { createDryRunPublisher, dryRunMetrics } from "../adapters/dryrun";
import { createPublisher, PUBLISHERS, resolvePublisherId } from "../index";
import { PublisherError, type PublishRequest } from "../types";

let nowMs = Date.parse("2026-10-28T12:00:00Z");
const pub = createDryRunPublisher({ platformsTarget: ["TIKTOK", "YOUTUBE"], now: () => new Date(nowMs) });

const req = (over: Partial<PublishRequest> = {}): PublishRequest => ({
  publicationId: "pub_1",
  videoUrl: "https://cdn.example.com/v.mp4",
  target: { socialAccountId: "sa_1", platform: "TIKTOK", providerAccountId: "dry_tiktok_x" },
  meta: { caption: "hello", hashtags: ["a"], privacy: "public", aiGenerated: false },
  idempotencyKey: "vid_1:TIKTOK:abc",
  ...over,
});

test("dryrun end-to-end: connect → accounts → schedule → status flips → metrics grow", async () => {
  const c = await pub.connect({ channelId: "ch_1", userId: "u", platform: "TIKTOK", returnUrl: "https://app.test/connect/done" });
  const u = new URL(c.url);
  assert.equal(u.origin + u.pathname, "https://app.test/connect/done");
  assert.equal(u.searchParams.get("dryrun"), "1");
  assert.equal(u.searchParams.get("profile"), c.providerProfileId);

  const accts = await pub.listConnectedAccounts(c.providerProfileId!);
  assert.deepEqual(accts.map((a) => a.platform), ["TIKTOK", "YOUTUBE"]);
  assert.deepEqual(accts, await pub.listConnectedAccounts(c.providerProfileId!));

  const scheduledAt = new Date(nowMs + 3600_000);
  const r = await pub.publish(req({ scheduledAt }));
  assert.equal(r.status, "scheduled");
  assert.equal((await pub.publish(req({ scheduledAt }))).providerJobId, r.providerJobId, "deterministic ids");
  assert.equal((await pub.status(r.providerJobId)).status, "scheduled");

  nowMs += 2 * 3600_000;
  const s = await pub.status(r.providerJobId);
  assert.equal(s.status, "published");
  assert.ok(s.externalPostId && s.externalUrl);

  const m1 = await pub.metrics(s.externalPostId!, "TIKTOK");
  nowMs += 48 * 3600_000;
  const m2 = await pub.metrics(s.externalPostId!, "TIKTOK");
  assert.ok(m1 && m2);
  assert.ok(m2.views >= m1.views && m2.views > 0);
  assert.equal(m2.retention?.length, 11);
  assert.deepEqual(dryRunMetrics(s.externalPostId!, new Date(nowMs)), m2, "deterministic for (postId, now)");
});

test("dryrun publish now → published; caps default", async () => {
  const r = await pub.publish(req({ idempotencyKey: "other" }));
  assert.equal(r.status, "published");
  assert.equal((await pub.caps(req().target)).dailyLimit, 15);
});

test("TikTok requires explicit privacy (audit: no default)", async () => {
  await assert.rejects(pub.publish(req({ meta: { caption: "x" } })), (e) => e instanceof PublisherError && e.code === "validation");
});

test("createPublisher picks dryrun with no keys; registry flags", () => {
  assert.equal(createPublisher({}).id, "dryrun");
  assert.equal(resolvePublisherId({ POSTFORME_API_KEY: "k" }), "postforme");
  assert.equal(resolvePublisherId({ UPLOADPOST_API_KEY: "k" }), "uploadpost");
  assert.equal(createPublisher({ PUBLISHER_PROVIDER: "uploadpost", UPLOADPOST_API_KEY: "k" }).id, "uploadpost");
  assert.throws(() => createPublisher({ PUBLISHER_PROVIDER: "postforme" }), /POSTFORME_API_KEY/);
  assert.throws(() => createPublisher({ PUBLISHER_PROVIDER: "nope" }), /unknown PUBLISHER_PROVIDER/);
  assert.equal(PUBLISHERS.youtube_direct.experimental, true);
  assert.equal(PUBLISHERS.postforme.inheritsAudit, true);
});
