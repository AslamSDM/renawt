/** Pexels portrait photos/videos → downloaded to R2 with license metadata (Pexels License; credit photographer). */
import { env } from "../env.js";
import { cachedAsset, downloadAndStore, decodeMeta } from "./store.js";
import type { AssetProvider, AssetRequest, AssetResult } from "./types.js";

interface PexelsPhoto { id: number; url: string; photographer: string; width: number; height: number; src: { portrait: string; large2x: string; original: string } }
interface PexelsVideo { id: number; url: string; user: { name: string }; video_files: Array<{ link: string; width: number; height: number; file_type: string }> }

export const pexels: AssetProvider = {
  id: "pexels",
  kinds: ["stock", "stock-video"],
  isConfigured: () => !!env.pexelsKey,
  async fetch(req: AssetRequest): Promise<AssetResult | null> {
    const video = req.kind === "stock-video";
    const id = `${req.sceneId}-${video ? "vid" : "img"}`;
    const ext = video ? "mp4" : "jpg";
    const hit = await cachedAsset(req, "pexels", ext);
    if (hit) {
      const m = decodeMeta(hit.metadata);
      return { id, kind: video ? "video" : "image", url: hit.url, source: "pexels", license: m.license ?? "Pexels License", usd: 0, cached: true, attribution: m.attribution };
    }
    const q = encodeURIComponent(req.query ?? req.prompt ?? "");
    const headers = { Authorization: env.pexelsKey };
    if (video) {
      const res = await fetch(`https://api.pexels.com/videos/search?query=${q}&orientation=portrait&per_page=5`, { headers });
      if (!res.ok) throw new Error(`Pexels ${res.status}`);
      const v = ((await res.json()) as { videos?: PexelsVideo[] }).videos?.[0];
      const file = v?.video_files.filter((f) => f.file_type === "video/mp4" && f.height >= f.width).sort((a, b) => Math.abs(a.height - 1920) - Math.abs(b.height - 1920))[0];
      if (!v || !file) return null;
      const attribution = `Video by ${v.user.name} on Pexels (${v.url})`;
      const url = await downloadAndStore(req, "pexels", file.link, { license: "Pexels License", attribution, source: "pexels" });
      return { id, kind: "video", url, source: "pexels", license: "Pexels License", width: file.width, height: file.height, usd: 0, cached: false, attribution };
    }
    const res = await fetch(`https://api.pexels.com/v1/search?query=${q}&orientation=portrait&per_page=5`, { headers });
    if (!res.ok) throw new Error(`Pexels ${res.status}`);
    const p = ((await res.json()) as { photos?: PexelsPhoto[] }).photos?.[0];
    if (!p) return null;
    const attribution = `Photo by ${p.photographer} on Pexels (${p.url})`;
    const url = await downloadAndStore(req, "pexels", p.src.portrait || p.src.large2x, { license: "Pexels License", attribution, source: "pexels" });
    return { id, kind: "image", url, source: "pexels", license: "Pexels License", width: 800, height: 1200, usd: 0, cached: false, attribution };
  },
};
