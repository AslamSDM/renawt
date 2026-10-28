/** Web ⇄ Engine HTTP contract. Engine is Express on ECS. Web calls it server-side with `Authorization: Bearer ${API_KEY}` and `x-user-id`. See docs/API.md. */
import { z } from "zod";

/** How a video starts. `idea` = radar idea; `prompt` = user typed an idea; `video` = user-recorded footage we cut motion graphics into; `audio` = user voice recording used as the narration track. */
export const VideoSourceSchema = z.object({
  kind: z.enum(["idea", "prompt", "video", "audio"]).default("idea"),
  text: z.string().max(4000).optional(),          // prompt text / extra direction
  mediaUrl: z.string().url().optional(),          // R2 URL of uploaded video or audio
  mediaDurationMs: z.number().optional(),
  mediaAspect: z.enum(["9:16", "16:9", "1:1", "4:5"]).optional(),
  keepOriginalAudio: z.boolean().default(true),   // video kind: keep the speaker's audio
  insertDensity: z.enum(["light", "medium", "heavy"]).default("medium"), // video kind: how many motion-graphic cut-ins
});
export type VideoSource = z.infer<typeof VideoSourceSchema>;

export const StartVideoRequest = z.object({ videoId: z.string(), channelId: z.string(), ideaId: z.string().optional(), format: z.string().optional(), targetSec: z.number().optional(), notes: z.string().optional(), quality: z.enum(["draft", "standard", "premium"]).default("standard"), source: VideoSourceSchema.default({ kind: "idea", keepOriginalAudio: true, insertDensity: "medium" }) });
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

export const CreateUploadRequest = z.object({ channelId: z.string(), kind: z.enum(["video", "audio", "image"]), contentType: z.string(), sizeBytes: z.number().max(2_000_000_000), fileName: z.string() });
export const CreateUploadResponse = z.object({ uploadUrl: z.string(), publicUrl: z.string(), key: z.string(), expiresAt: z.string() });
