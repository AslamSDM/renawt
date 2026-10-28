import { PublisherError, type PublishRequest } from "./types";

/**
 * Shared pre-flight checks every adapter runs before calling a provider.
 * TikTok audit rule: privacy must be chosen explicitly by the user (no default).
 */
export function validatePublishRequest(req: PublishRequest, opts: { allowNonHttps?: boolean } = {}): void {
  if (!req.idempotencyKey) throw new PublisherError("validation", "idempotencyKey is required");
  let u: URL;
  try { u = new URL(req.videoUrl); } catch { throw new PublisherError("validation", `videoUrl is not a URL: ${req.videoUrl}`); }
  if (!opts.allowNonHttps && u.protocol !== "https:") throw new PublisherError("validation", "videoUrl must be a public https URL (providers fetch it)");
  if (req.target.platform === "TIKTOK") {
    if (!req.meta.privacy) throw new PublisherError("validation", "TikTok requires an explicit privacy choice from the user (no default allowed)");
    if (req.meta.privacy === "unlisted") throw new PublisherError("validation", "TikTok has no 'unlisted' privacy");
  }
  if (req.target.platform === "YOUTUBE" && req.meta.privacy && ["friends", "followers"].includes(req.meta.privacy)) {
    throw new PublisherError("validation", `YouTube has no '${req.meta.privacy}' privacy (use public|unlisted|private)`);
  }
  if (req.scheduledAt && Number.isNaN(req.scheduledAt.getTime())) throw new PublisherError("validation", "scheduledAt is invalid");
}
