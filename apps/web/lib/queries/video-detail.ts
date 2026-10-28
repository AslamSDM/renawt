import type { Prisma } from "@remawt/db";
import { prisma } from "@/lib/db/prisma";
import { bypassChannelFixture } from "./channels";
import type { Viewer } from "./viewer";

export const VIDEO_DETAIL_INCLUDE = {
  channel: { include: { socialAccounts: { where: { status: "connected" }, orderBy: { platform: "asc" } } } },
  publications: { orderBy: { scheduledAt: "desc" }, include: { socialAccount: { select: { handle: true } } } },
  idea: { select: { id: true, hook: true } },
} satisfies Prisma.VideoInclude;

export type VideoDetail = Prisma.VideoGetPayload<{ include: typeof VIDEO_DETAIL_INCLUDE }>;

export const BYPASS_VIDEO_ID = "dev-video";

export async function loadVideoDetail(viewer: Viewer, id: string): Promise<VideoDetail | null> {
  if (viewer.bypass) return id === BYPASS_VIDEO_ID ? bypassVideoFixture() : null;
  return prisma.video.findFirst({ where: { id, channel: { userId: viewer.userId } }, include: VIDEO_DETAIL_INCLUDE });
}

/** Dev bypass only: a READY "your footage" video with script, scenes, transcript, QC and posts. */
export function bypassVideoFixture(): VideoDetail {
  const channel = bypassChannelFixture();
  const t0 = Date.now() - 26 * 60_000;
  const at = (min: number) => new Date(t0 + min * 60_000).toISOString();
  const steps = ["ingest", "transcribe", "script", "plan", "assets", "compose", "lint", "render", "qc", "cuts"];
  const progress = [
    { step: "queued", status: "done", at: at(0), message: "Waiting for the engine" },
    ...steps.flatMap((s, i) => [
      { step: s, status: "started", at: at(1 + i * 2) },
      { step: s, status: "done", at: at(2 + i * 2), message: s === "transcribe" ? "212 words · 1:04" : s === "render" ? "1080×1920 · 30 fps" : undefined },
    ]),
  ];
  const scenes = {
    totalMs: 52_000,
    musicMood: "focused",
    sfxCues: [],
    scenes: [
      { id: "s1", beatId: "hook", startMs: 0, durationMs: 4000, block: "kinetic-headline", headline: "Your savings lose 3.4% a year", assetIds: [] },
      { id: "s2", beatId: "setup", startMs: 4000, durationMs: 12000, block: "video-segment", data: { assetId: "a1", inMs: 2100, outMs: 14100 }, assetIds: ["a1"] },
      { id: "s3", beatId: "reveal", startMs: 16000, durationMs: 9000, block: "chart-line", headline: "Inflation vs savings rate", body: "UK, 2015–2025", data: { series: [{ x: 2015, y: 0.4 }, { x: 2020, y: 0.9 }, { x: 2025, y: 3.4 }], unit: "%" }, assetIds: [] },
      { id: "s4", beatId: "reveal", startMs: 25000, durationMs: 15000, block: "video-segment", data: { assetId: "a1", inMs: 15800, outMs: 30800 }, assetIds: ["a1"] },
      { id: "s5", beatId: "twist", startMs: 40000, durationMs: 8000, block: "counter", headline: "£1,000 → £707 in 10 years", data: { from: 1000, to: 707, prefix: "£" }, assetIds: [] },
      { id: "s6", beatId: "loop", startMs: 48000, durationMs: 4000, block: "outro", headline: "Follow for the fix", assetIds: [] },
    ],
  };
  const transcript = {
    text: "",
    language: "en",
    durationMs: 64_000,
    words: [],
    segments: [
      { id: "t1", startMs: 0, endMs: 2100, text: "Um, okay, so—", kind: "filler", keep: false },
      { id: "t2", startMs: 2100, endMs: 14100, text: "If your savings account pays one percent and prices rise three, you are losing money every single year.", kind: "speech", keep: true },
      { id: "t3", startMs: 14100, endMs: 15800, text: "", kind: "silence", keep: false },
      { id: "t4", startMs: 15800, endMs: 30800, text: "Here’s the part nobody shows you: after ten years, a thousand pounds buys what seven hundred did.", kind: "speech", keep: true },
      { id: "t5", startMs: 30800, endMs: 41000, text: "So what do you actually do about it? That’s next week.", kind: "speech", keep: true },
    ],
  };
  const script = {
    title: "Why your savings lose money every year",
    hook: "Your savings lose 3.4% a year",
    lines: [
      { beatId: "hook", text: "Your savings lose money every year.", onScreen: "−3.4% / yr", targetSec: 4 },
      { beatId: "setup", text: "If your account pays one percent and prices rise three, you’re behind.", targetSec: 12 },
      { beatId: "reveal", text: "Ten years later, a thousand pounds buys what seven hundred did.", onScreen: "£1,000 → £707", targetSec: 24 },
      { beatId: "loop", text: "What to do about it, next week.", targetSec: 4 },
    ],
    cta: "Follow for the fix",
    sources: [{ title: "ONS: Consumer price inflation, UK", url: "https://www.ons.gov.uk/economy/inflationandpriceindices" }],
    hashtags: ["personalfinance", "inflation", "savings", "moneytips"],
    description: "Why a 1% savings rate loses to inflation, in 50 seconds.",
    estimatedSec: 52,
  };
  const now = new Date();
  const tiktok: VideoDetail["channel"]["socialAccounts"][number] = { id: "dev-sa-tt", channelId: channel.id, platform: "TIKTOK", provider: "dryrun", externalId: "dry_tt", handle: "ledger.money", avatarUrl: null, tokens: null, caps: null, status: "connected", createdAt: now, updatedAt: now };
  const yt: typeof tiktok = { ...tiktok, id: "dev-sa-yt", platform: "YOUTUBE", externalId: "dry_yt", handle: "LedgerMoney" };
  const pub = (id: string, acc: typeof tiktok, status: "SCHEDULED" | "PUBLISHED", minutes: number) => ({
    id,
    videoId: BYPASS_VIDEO_ID,
    socialAccountId: acc.id,
    platform: acc.platform,
    scheduledAt: new Date(Date.now() + minutes * 60_000),
    publishedAt: status === "PUBLISHED" ? new Date(Date.now() + minutes * 60_000) : null,
    externalPostId: null,
    externalUrl: status === "PUBLISHED" ? "https://www.youtube.com/shorts/example" : null,
    providerJobId: null,
    meta: null,
    status,
    error: null,
    createdAt: now,
    updatedAt: now,
    socialAccount: { handle: acc.handle },
  });

  return {
    id: BYPASS_VIDEO_ID,
    channelId: channel.id,
    ideaId: null,
    seriesId: null,
    title: script.title,
    format: "chart-explains",
    targetSec: 52,
    sourceKind: "video",
    sourceUrl: null,
    source: { kind: "video", keepOriginalAudio: true, insertDensity: "medium", mediaAspect: "16:9", mediaDurationMs: 64_000 },
    transcript,
    status: "READY",
    runId: "dev-run",
    progress,
    script,
    voice: null,
    scenes,
    assets: [{ id: "a1", kind: "user-video", url: "https://example.com/upload.mp4", source: "upload" }],
    composition: null,
    kitSnapshot: channel.kit,
    masterUrl: null,
    cuts: null,
    thumbnailUrl: null,
    originality: { score: 0.82, flags: [] },
    qc: { lintPassed: true, criticNotes: ["Hook lands inside 2s.", "Chart source is on screen for 3s; keep it."], labels: { aigc: true, syntheticMedia: false } },
    cost: { llmUsd: 0.041, ttsUsd: 0, imagesUsd: 0, renderUsd: 0.018, totalUsd: 0.059 },
    rerenders: 0,
    error: null,
    createdAt: new Date(t0),
    updatedAt: now,
    channel: { ...channel, socialAccounts: [tiktok, yt] },
    publications: [pub("dev-pub-1", tiktok, "SCHEDULED", 180), pub("dev-pub-2", yt, "PUBLISHED", -60)],
    idea: null,
  } as VideoDetail;
}
