/** Web ⇄ Engine HTTP contract. Engine is Express on ECS. Web calls it server-side with `Authorization: Bearer ${API_KEY}` and `x-user-id`. See docs/API.md. */
import { z } from "zod";

export const StartVideoRequest = z.object({ videoId: z.string(), channelId: z.string(), ideaId: z.string().optional(), format: z.string(), targetSec: z.number().optional(), notes: z.string().optional(), quality: z.enum(["draft", "standard", "premium"]).default("standard") });
export type StartVideoRequest = z.infer<typeof StartVideoRequest>;
export const StartVideoResponse = z.object({ videoId: z.string(), runId: z.string() });

export const KitPreviewRequest = z.object({ channelId: z.string(), niche: z.string(), skinIds: z.array(z.string()).optional(), headline: z.string().optional() });
export const KitPreviewResponse = z.object({ previews: z.array(z.object({ skinId: z.string(), posterUrl: z.string(), clipUrl: z.string().optional() })) });

export const GenerateIdeasRequest = z.object({ channelId: z.string(), count: z.number().default(10), weekKey: z.string().optional() });
export const GenerateIdeasResponse = z.object({ ideaIds: z.array(z.string()) });

export const RefreshRadarRequest = z.object({ niches: z.array(z.string()).optional(), force: z.boolean().default(false) });

export const SchedulePublicationRequest = z.object({ videoId: z.string(), targets: z.array(z.object({ socialAccountId: z.string(), scheduledAt: z.string(), meta: z.record(z.string(), z.unknown()).optional() })) });
export const SchedulePublicationResponse = z.object({ publicationIds: z.array(z.string()) });

export const RerenderRequest = z.object({ videoId: z.string(), scenes: z.unknown().optional(), script: z.unknown().optional() });
