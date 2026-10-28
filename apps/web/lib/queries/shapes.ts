/**
 * Typed readers for the Json columns in packages/db/prisma/schema.prisma.
 * They never throw: malformed rows degrade to null / [] so a page still renders.
 */
import { z } from "zod";
import {
  IdentityKitSchema,
  ProgressEventSchema,
  ScenePlanSchema,
  ScriptSchema,
  TranscriptSchema,
  VideoSourceSchema,
  type IdentityKit,
  type ProgressEvent,
  type ScenePlan,
  type Script,
  type Transcript,
  type VideoSource,
} from "@remawt/shared";

export function parseKit(json: unknown): IdentityKit | null {
  const r = IdentityKitSchema.safeParse(json);
  return r.success ? r.data : null;
}

export function parseProgress(json: unknown): ProgressEvent[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((e) => {
    const r = ProgressEventSchema.safeParse(e);
    return r.success ? [r.data] : [];
  });
}

export function parseScript(json: unknown): Script | null {
  const r = ScriptSchema.safeParse(json);
  return r.success ? r.data : null;
}

export function parseScenePlan(json: unknown): ScenePlan | null {
  const r = ScenePlanSchema.safeParse(json);
  return r.success ? r.data : null;
}

export function parseTranscript(json: unknown): Transcript | null {
  const r = TranscriptSchema.safeParse(json);
  return r.success ? r.data : null;
}

/**
 * Video source. The schema in packages/db does not have Video.source/sourceKind yet (see docs/REQUESTS.md),
 * so startVideo writes it as the first progress event `{step:"source", output: VideoSource}`.
 */
export function readVideoSource(progressJson: unknown): VideoSource | null {
  const ev = parseProgress(progressJson).find((e) => e.step === "source");
  if (!ev) return null;
  const r = VideoSourceSchema.safeParse(ev.output);
  return r.success ? r.data : null;
}

/** Transcript for video/audio sources. Read from the `transcribe` step output until Video.transcript exists. */
export function readTranscript(progressJson: unknown): Transcript | null {
  const ev = [...parseProgress(progressJson)].reverse().find((e) => e.step === "transcribe" && e.status === "done");
  return ev ? parseTranscript(ev.output) : null;
}

const Num = z.number().finite();

export const QcSchema = z
  .object({
    lintPassed: z.boolean().optional(),
    criticNotes: z.union([z.string(), z.array(z.string())]).optional(),
    labels: z.object({ syntheticMedia: z.boolean().optional(), aigc: z.boolean().optional() }).partial().optional(),
  })
  .partial();
export type Qc = z.infer<typeof QcSchema>;
export function parseQc(json: unknown): Qc | null {
  const r = QcSchema.safeParse(json);
  return r.success ? r.data : null;
}

export const OriginalitySchema = z
  .object({ score: Num, flags: z.array(z.string()).default([]), comparedTo: z.unknown().optional() })
  .partial({ flags: true, comparedTo: true });
export function parseOriginality(json: unknown) {
  const r = OriginalitySchema.safeParse(json);
  return r.success ? r.data : null;
}

export const CostSchema = z.object({ llmUsd: Num, ttsUsd: Num, imagesUsd: Num, renderUsd: Num, totalUsd: Num }).partial();
export function parseCost(json: unknown) {
  const r = CostSchema.safeParse(json);
  return r.success ? r.data : null;
}

export const CutsSchema = z.record(z.string(), z.object({ url: z.string(), sec: Num.optional() }));
export function parseCuts(json: unknown) {
  const r = CutsSchema.safeParse(json);
  return r.success ? r.data : {};
}

export const ExemplarSchema = z.object({ url: z.string(), title: z.string().default(""), views: Num.optional(), platform: z.string().optional() });
export type Exemplar = z.infer<typeof ExemplarSchema>;
export function parseExemplars(json: unknown): Exemplar[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((e) => {
    const r = ExemplarSchema.safeParse(e);
    return r.success ? [r.data] : [];
  });
}

export const EvidenceSchema = z.object({ url: z.string(), title: z.string().default(""), source: z.string().optional() });
export type Evidence = z.infer<typeof EvidenceSchema>;
export function parseEvidence(json: unknown): Evidence[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((e) => {
    const r = EvidenceSchema.safeParse(e);
    return r.success ? [r.data] : [];
  });
}

export const RiskSchema = z.object({ level: z.enum(["low", "medium", "high"]).default("low"), flags: z.array(z.string()).default([]) });
export type Risk = z.infer<typeof RiskSchema>;
export function parseRisk(json: unknown): Risk | null {
  const r = RiskSchema.safeParse(json);
  return r.success ? r.data : null;
}

export const IdeaBeatSchema = z.object({ label: z.string(), durationSec: Num.optional(), note: z.string().optional() });
export function parseIdeaBeats(json: unknown) {
  if (!Array.isArray(json)) return [];
  return json.flatMap((e) => {
    const r = IdeaBeatSchema.safeParse(e);
    return r.success ? [r.data] : [];
  });
}

export const CadenceSchema = z.object({
  perWeek: z.number().int().min(1).max(21).default(5),
  days: z.array(z.number().int().min(1).max(7)).default([1, 2, 3, 4, 5]),
  hourLocal: z.number().int().min(0).max(23).default(18),
  formats: z.array(z.string()).default([]),
});
export type Cadence = z.infer<typeof CadenceSchema>;
export function parseCadence(json: unknown): Cadence {
  const r = CadenceSchema.safeParse(json ?? {});
  return r.success ? r.data : CadenceSchema.parse({});
}

export const PublicationMetaSchema = z
  .object({
    title: z.string(),
    caption: z.string(),
    hashtags: z.array(z.string()),
    privacy: z.string(),
    aiLabel: z.boolean(),
    madeForKids: z.boolean(),
    commercial: z.boolean(),
    brandedContent: z.boolean(),
    needsApproval: z.boolean(),
  })
  .partial();
export type PublicationMeta = z.infer<typeof PublicationMetaSchema>;
export function parsePublicationMeta(json: unknown): PublicationMeta {
  const r = PublicationMetaSchema.safeParse(json ?? {});
  return r.success ? r.data : {};
}

export const TrendStatsSchema = z.object({ views: Num, likes: Num, comments: Num, shares: Num, ageHours: Num, velocity: Num, outlier: Num }).partial();
