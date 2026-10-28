/** Pixabay vertical photos/videos → R2 (Pixabay Content License; no hotlinking, so always download). */
import { env } from "../env.js";
import { cachedAsset, downloadAndStore, decodeMeta } from "./store.js";
import type { AssetProvider, AssetRequest, AssetResult } from "./types.js";

export const pixabay: AssetProvider = {
  id: "pixabay",
  kinds: ["stock", "stock-video"],
  isConfigured: () => !!env.pixabayKey,
  async fetch(req: AssetRequest): Promise<AssetResult | null> {
    const video = req.kind === "stock-video";
    const id = `${req.sceneId}-${video ? "vid" : "img"}`;
    const ext = video ? "mp4" : "jpg";
    const hit = await cachedAsset(req, "pixabay", ext);
    if (hit) {
      const m = decodeMeta(hit.metadata);
      return { id, kind: video ? "video" : "image", url: hit.url, source: "pixabay", license: m.license ?? "Pixabay Content License", usd: 0, cached: true, attribution: m.attribution };
    }
    const q = encodeURIComponent((req.query ?? req.prompt ?? "").slice(0, 100));
    if (video) {
      const res = await fetch(`https://pixabay.com/api/videos/?key=${env.pixabayKey}&q=${q}&per_page=5&safesearch=true`);
      if (!res.ok) throw new Error(`Pixabay ${res.status}`);
      const hits = ((await res.json()) as { hits?: Array<{ pageURL: string; user: string; videos: Record<string, { url: string; width: number; height: number }> }> }).hits ?? [];
      const h = hits.find((x) => Object.values(x.videos).some((v) => v.height >= v.width && v.url)) ?? hits[0];
      if (!h) return null;
      const file = Object.values(h.videos).filter((v) => v.url).sort((a, b) => b.height - a.height)[0];
      if (!file) return null;
      const attribution = `Video by ${h.user} on Pixabay (${h.pageURL})`;
      const url = await downloadAndStore(req, "pixabay", file.url, { license: "Pixabay Content License", attribution, source: "pixabay" });
      return { id, kind: "video", url, source: "pixabay", license: "Pixabay Content License", width: file.width, height: file.height, usd: 0, cached: false, attribution };
    }
    const res = await fetch(`https://pixabay.com/api/?key=${env.pixabayKey}&q=${q}&orientation=vertical&image_type=photo&per_page=5&safesearch=true`);
    if (!res.ok) throw new Error(`Pixabay ${res.status}`);
    const h = ((await res.json()) as { hits?: Array<{ pageURL: string; user: string; largeImageURL: string; imageWidth: number; imageHeight: number }> }).hits?.[0];
    if (!h) return null;
    const attribution = `Image by ${h.user} on Pixabay (${h.pageURL})`;
    const url = await downloadAndStore(req, "pixabay", h.largeImageURL, { license: "Pixabay Content License", attribution, source: "pixabay" });
    return { id, kind: "image", url, source: "pixabay", license: "Pixabay Content License", width: h.imageWidth, height: h.imageHeight, usd: 0, cached: false, attribution };
  },
};
