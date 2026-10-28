-- ============================================================================
-- remawt v2 "faceless" migration
-- Generated with: prisma migrate diff --from-url <prod Neon> --to-schema-datamodel
--   packages/db/prisma/schema.prisma --script   (read-only introspection; NOT applied)
--
-- DESTRUCTIVE STATEMENTS (v1 data, disposable per docs/PIVOT_PLAN.md):
--   DROP TABLE "Generation";
--   DROP TABLE "JitterDocHistory";      (exists in prod, never in a migration file)
--   DROP TABLE "ProductImage";
--   DROP TABLE "Project";
--   DROP TABLE "ScreenRecording";
--   DROP INDEX "llm_calls_projectId_idx";   (index only; column + rows kept)
--   ALTER TABLE ... DROP CONSTRAINT <fk> on Account, CreditPurchase, Subscription,
--     Generation, JitterDocHistory, ProductImage, Project, ScreenRecording
--     (schema uses relationMode = "prisma"; constraint drops lose NO rows)
--
-- KEPT TABLES (User, Account, Subscription, CreditPurchase, WebhookEvent, Music,
-- llm_calls): only ADD COLUMN with defaults / nullable. No rows are touched except
-- the optional videoAllowance backfill at the bottom.
--
-- Drops use IF EXISTS so the script also runs on DBs built from legacy/web schema.
-- ============================================================================

-- CreateEnum
CREATE TYPE "ChannelStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('TIKTOK', 'YOUTUBE', 'INSTAGRAM', 'FACEBOOK', 'THREADS', 'LINKEDIN', 'X', 'PINTEREST', 'REDDIT', 'GOOGLE_TRENDS', 'NEWS');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('SUGGESTED', 'APPROVED', 'QUEUED', 'PRODUCED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('DRAFT', 'QUEUED', 'TRANSCRIBING', 'SCRIPTING', 'VOICING', 'PLANNING', 'COMPOSING', 'RENDERING', 'QC', 'READY', 'FAILED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SeriesMode" AS ENUM ('APPROVE', 'AUTO');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE IF EXISTS "Account" DROP CONSTRAINT IF EXISTS "Account_userId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "CreditPurchase" DROP CONSTRAINT IF EXISTS "CreditPurchase_userId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "Generation" DROP CONSTRAINT IF EXISTS "Generation_projectId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "JitterDocHistory" DROP CONSTRAINT IF EXISTS "JitterDocHistory_projectId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "ProductImage" DROP CONSTRAINT IF EXISTS "ProductImage_projectId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "Project" DROP CONSTRAINT IF EXISTS "Project_userId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "ScreenRecording" DROP CONSTRAINT IF EXISTS "ScreenRecording_projectId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_userId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "llm_calls_projectId_idx";

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "billing" TEXT NOT NULL DEFAULT 'monthly',
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "dodoCustomerId" TEXT,
ADD COLUMN     "dodoProductId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "rolloverVideos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usagePeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "videoAllowance" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "videosUsed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "llm_calls" ADD COLUMN     "cachedTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "channelId" TEXT,
ADD COLUMN     "usd" DOUBLE PRECISION,
ADD COLUMN     "videoId" TEXT;

-- DropTable
DROP TABLE IF EXISTS "Generation";

-- DropTable
DROP TABLE IF EXISTS "JitterDocHistory";

-- DropTable
DROP TABLE IF EXISTS "ProductImage";

-- DropTable
DROP TABLE IF EXISTS "Project";

-- DropTable
DROP TABLE IF EXISTS "ScreenRecording";

-- CreateTable
CREATE TABLE "UsageLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT,
    "delta" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT,
    "niche" TEXT NOT NULL,
    "kit" JSONB NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "ChannelStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "handle" TEXT,
    "avatarUrl" TEXT,
    "tokens" JSONB,
    "caps" JSONB,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendItem" (
    "id" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "url" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "caption" TEXT,
    "creator" TEXT,
    "creatorMedianViews" INTEGER,
    "stats" JSONB NOT NULL,
    "tags" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "TrendItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrendCard" (
    "id" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "hookType" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "summary" TEXT NOT NULL,
    "exemplars" JSONB NOT NULL,
    "evidence" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Idea" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "cardId" TEXT,
    "hook" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "angle" TEXT,
    "beats" JSONB NOT NULL,
    "evidence" JSONB,
    "risk" JSONB,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "IdeaStatus" NOT NULL DEFAULT 'SUGGESTED',
    "source" TEXT NOT NULL DEFAULT 'radar',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Idea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "ideaId" TEXT,
    "seriesId" TEXT,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "targetSec" INTEGER NOT NULL DEFAULT 45,
    "sourceKind" TEXT NOT NULL DEFAULT 'idea',
    "sourceUrl" TEXT,
    "source" JSONB,
    "transcript" JSONB,
    "status" "VideoStatus" NOT NULL DEFAULT 'DRAFT',
    "runId" TEXT,
    "progress" JSONB,
    "script" JSONB,
    "voice" JSONB,
    "scenes" JSONB,
    "assets" JSONB,
    "composition" JSONB,
    "kitSnapshot" JSONB,
    "masterUrl" TEXT,
    "cuts" JSONB,
    "thumbnailUrl" TEXT,
    "originality" JSONB,
    "qc" JSONB,
    "cost" JSONB,
    "rerenders" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cadence" JSONB NOT NULL,
    "platforms" "Platform"[],
    "mode" "SeriesMode" NOT NULL DEFAULT 'APPROVE',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Publication" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "externalPostId" TEXT,
    "externalUrl" TEXT,
    "providerJobId" TEXT,
    "meta" JSONB,
    "status" "PublicationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "t" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "avgWatchSec" DOUBLE PRECISION,
    "retention" JSONB,
    "outlierScore" DOUBLE PRECISION,
    "raw" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SfxAsset" (
    "id" TEXT NOT NULL,
    "cue" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SfxAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageLedger_userId_createdAt_idx" ON "UsageLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageLedger_videoId_idx" ON "UsageLedger"("videoId");

-- CreateIndex
CREATE INDEX "Channel_userId_idx" ON "Channel"("userId");

-- CreateIndex
CREATE INDEX "Channel_niche_idx" ON "Channel"("niche");

-- CreateIndex
CREATE INDEX "SocialAccount_channelId_idx" ON "SocialAccount"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_channelId_platform_externalId_key" ON "SocialAccount"("channelId", "platform", "externalId");

-- CreateIndex
CREATE INDEX "TrendItem_niche_fetchedAt_idx" ON "TrendItem"("niche", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrendItem_platform_url_key" ON "TrendItem"("platform", "url");

-- CreateIndex
CREATE INDEX "TrendCard_niche_weekKey_score_idx" ON "TrendCard"("niche", "weekKey", "score");

-- CreateIndex
CREATE INDEX "Idea_channelId_status_idx" ON "Idea"("channelId", "status");

-- CreateIndex
CREATE INDEX "Idea_cardId_idx" ON "Idea"("cardId");

-- CreateIndex
CREATE INDEX "Video_channelId_createdAt_idx" ON "Video"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "Video_status_idx" ON "Video"("status");

-- CreateIndex
CREATE INDEX "Video_ideaId_idx" ON "Video"("ideaId");

-- CreateIndex
CREATE INDEX "Video_seriesId_idx" ON "Video"("seriesId");

-- CreateIndex
CREATE INDEX "Series_channelId_idx" ON "Series"("channelId");

-- CreateIndex
CREATE INDEX "Series_active_nextRunAt_idx" ON "Series"("active", "nextRunAt");

-- CreateIndex
CREATE INDEX "Publication_videoId_idx" ON "Publication"("videoId");

-- CreateIndex
CREATE INDEX "Publication_socialAccountId_idx" ON "Publication"("socialAccountId");

-- CreateIndex
CREATE INDEX "Publication_status_scheduledAt_idx" ON "Publication"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "MetricSnapshot_publicationId_idx" ON "MetricSnapshot"("publicationId");

-- CreateIndex
CREATE UNIQUE INDEX "MetricSnapshot_publicationId_t_key" ON "MetricSnapshot"("publicationId", "t");

-- CreateIndex
CREATE UNIQUE INDEX "SfxAsset_cue_key" ON "SfxAsset"("cue");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "CreditPurchase_userId_idx" ON "CreditPurchase"("userId");

-- CreateIndex
CREATE INDEX "Subscription_dodoSubId_idx" ON "Subscription"("dodoSubId");

-- CreateIndex
CREATE INDEX "llm_calls_videoId_idx" ON "llm_calls"("videoId");


-- Backfill: give existing active subscribers their v2 plan allowance (unknown v1 plan
-- names keep the Free default of 3; the next Dodo webhook corrects them anyway).
UPDATE "User" u SET "videoAllowance" = CASE upper(s."plan")
    WHEN 'STARTER' THEN 30
    WHEN 'CREATOR' THEN 60
    WHEN 'PRO' THEN 150
    WHEN 'AGENCY' THEN 400
    ELSE 3 END
FROM "Subscription" s
WHERE s."userId" = u."id" AND lower(s."status") = 'active';
