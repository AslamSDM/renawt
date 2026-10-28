-- Add progress column to Generation for streamed pipeline step events (JSON array).
-- Idempotent: column may already exist from an out-of-band apply.
ALTER TABLE "Generation" ADD COLUMN IF NOT EXISTS "progress" TEXT;
