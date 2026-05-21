-- CreateTable
CREATE TABLE "Music" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "artist" TEXT,
    "bpm" INTEGER NOT NULL DEFAULT 120,
    "durationMs" INTEGER,
    "moods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'seed',
    "license" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Music_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Music_filename_key" ON "Music"("filename");

-- CreateIndex
CREATE INDEX "Music_source_idx" ON "Music"("source");

-- CreateIndex
CREATE INDEX "Music_bpm_idx" ON "Music"("bpm");
