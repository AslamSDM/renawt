import { defaultCaps } from "../caps";
import { metaFor } from "../meta";
import { PLATFORMS, isPlatform } from "../platforms";
import type { AccountCaps, ConnectRequest, ConnectResult, ConnectedAccount, Metrics, MetricsContext, Platform, PublishRequest, PublishResult, PublishStatus, PublishTarget, Publisher } from "../types";
import { PublisherError } from "../types";
import { fnv1a, hashHex, mulberry32 } from "../util";
import { validatePublishRequest } from "../validate";

export interface DryRunOptions {
  /** Platforms `listConnectedAccounts` reports as connected. Default: all. */
  platformsTarget?: Platform[];
  now?: () => Date;
  capOverrides?: Partial<Record<Platform, number>>;
}

const PREFIX_JOB = "dryjob";
const PREFIX_POST = "drypost";

/**
 * Fully functional fake. Persists nothing: every id encodes what later calls need
 * (platform, publish time, hash) so status/metrics are deterministic and stateless.
 */
export function createDryRunPublisher(opts: DryRunOptions = {}): Publisher {
  const now = opts.now ?? (() => new Date());
  const platformsTarget = opts.platformsTarget?.length ? opts.platformsTarget : [...PLATFORMS];

  const postId = (platform: Platform, publishMs: number, h: string) => `${PREFIX_POST}_${platform.toLowerCase()}_${publishMs}_${h}`;
  const postUrl = (platform: Platform, id: string) => `https://dryrun.remawt.local/${platform.toLowerCase()}/${id}`;

  function parseJob(jobId: string): { platform: Platform; publishMs: number; h: string } {
    const [prefix, p, ms, h] = jobId.split("_");
    const platform = p?.toUpperCase();
    if (prefix !== PREFIX_JOB || !isPlatform(platform) || !Number.isFinite(Number(ms)) || !h) throw new PublisherError("not_found", `unknown dryrun job ${jobId}`);
    return { platform, publishMs: Number(ms), h };
  }

  return {
    id: "dryrun",

    async connect(req: ConnectRequest): Promise<ConnectResult> {
      const profile = req.providerProfileId ?? `dry_${hashHex(req.channelId, 10)}`;
      const url = new URL(req.returnUrl);
      url.searchParams.set("dryrun", "1");
      url.searchParams.set("profile", profile);
      url.searchParams.set("platform", req.platform);
      return { url: url.toString(), providerProfileId: profile };
    },

    async listConnectedAccounts(providerProfileId: string): Promise<ConnectedAccount[]> {
      return platformsTarget.map((platform) => {
        const h = hashHex(`${providerProfileId}:${platform}`, 8);
        return {
          platform,
          providerAccountId: `dry_${platform.toLowerCase()}_${h}`,
          handle: `@dryrun_${platform.toLowerCase()}_${h.slice(0, 4)}`,
          avatarUrl: `https://api.dicebear.com/9.x/shapes/svg?seed=${h}`,
          status: "connected",
        };
      });
    },

    async publish(req: PublishRequest): Promise<PublishResult> {
      validatePublishRequest(req, { allowNonHttps: true });
      metaFor(req.target.platform, req.meta); // exercise limits like real adapters
      const h = hashHex(req.idempotencyKey, 12);
      const t = now().getTime();
      const publishMs = req.scheduledAt && req.scheduledAt.getTime() > t ? req.scheduledAt.getTime() : t;
      const providerJobId = `${PREFIX_JOB}_${req.target.platform.toLowerCase()}_${publishMs}_${h}`;
      if (publishMs > t) return { providerJobId, status: "scheduled" };
      const id = postId(req.target.platform, publishMs, h);
      return { providerJobId, status: "published", externalPostId: id, externalUrl: postUrl(req.target.platform, id) };
    },

    async status(providerJobId: string): Promise<PublishStatus> {
      const { platform, publishMs, h } = parseJob(providerJobId);
      if (now().getTime() < publishMs) return { status: "scheduled" };
      const id = postId(platform, publishMs, h);
      return { status: "published", externalPostId: id, externalUrl: postUrl(platform, id) };
    },

    async metrics(externalPostId: string, _platform: Platform, ctx?: MetricsContext): Promise<Metrics | null> {
      return dryRunMetrics(externalPostId, now(), ctx?.publishedAt);
    },

    async caps(target: PublishTarget): Promise<AccountCaps> {
      return defaultCaps(target.platform, opts.capOverrides);
    },

    async disconnect(): Promise<void> {},
    async cancel(): Promise<void> {},
  };
}

/** Deterministic saturating growth curve seeded by postId. Same (postId, now) → same numbers. */
export function dryRunMetrics(externalPostId: string, now: Date, publishedAt?: Date): Metrics {
  const parts = externalPostId.split("_");
  const encodedMs = parts[0] === PREFIX_POST ? Number(parts[2]) : NaN;
  const publishMs = publishedAt?.getTime() ?? (Number.isFinite(encodedMs) ? encodedMs : now.getTime() - 72 * 3600_000);
  const rng = mulberry32(fnv1a(externalPostId));
  const outlier = rng() < 0.1 ? 8 + rng() * 12 : 1;
  const peak = Math.floor((300 + rng() * 20_000) * outlier);
  const tauH = 6 + rng() * 42;
  const likeRate = 0.03 + rng() * 0.07;
  const commentRate = 0.02 + rng() * 0.06;
  const shareRate = 0.05 + rng() * 0.15;
  const saveRate = 0.05 + rng() * 0.2;
  const avgWatchSec = Math.round((8 + rng() * 25) * 10) / 10;
  const hookDrop = 0.15 + rng() * 0.35;
  const decay = 0.6 + rng() * 1.4;

  const ageH = Math.max(0, (now.getTime() - publishMs) / 3600_000);
  const frac = 1 - Math.exp(-ageH / tauH);
  const views = Math.round(peak * frac);
  const likes = Math.round(views * likeRate);
  const retention = Array.from({ length: 11 }, (_, i) => {
    const ratio = i / 10;
    const watch = i === 0 ? 1 : (1 - hookDrop) * Math.exp(-decay * ratio);
    return { ratio, watch: Math.round(watch * 1000) / 1000 };
  });
  return {
    views,
    likes,
    comments: Math.round(likes * commentRate),
    shares: Math.round(likes * shareRate),
    saves: Math.round(likes * saveRate),
    avgWatchSec: views > 0 ? avgWatchSec : undefined,
    retention: views > 0 ? retention : undefined,
    raw: { dryrun: true, peak, tauH: Math.round(tauH * 10) / 10, ageH: Math.round(ageH * 10) / 10 },
  };
}
