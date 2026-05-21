-- CreateTable
CREATE TABLE "JitterJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "phase" TEXT,
    "url" TEXT NOT NULL,
    "audio" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 16000,
    "notes" TEXT,
    "error" TEXT,
    "videoUrl" TEXT,
    "brandReport" TEXT,
    "music" TEXT,
    "jitterDoc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JitterJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JitterJob_userId_createdAt_idx" ON "JitterJob"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JitterJob_status_idx" ON "JitterJob"("status");
