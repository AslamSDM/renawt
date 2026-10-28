/** Recraft image API (flat illustrations / icons). POST /v1/images/generations → data[0].url. */
import { env } from "../env.js";
import { IMAGE_PRICES } from "../pricing.js";
import { cachedAsset, downloadAndStore } from "./store.js";
import type { AssetProvider, AssetRequest, AssetResult } from "./types.js";

const MODEL = () => process.env.RECRAFT_MODEL ?? "recraftv3";

export const recraft: AssetProvider = {
  id: "recraft",
  kinds: ["icon", "image"],
  isConfigured: () => !!env.recraftKey,
  async fetch(req: AssetRequest): Promise<AssetResult | null> {
    const isIcon = req.kind === "icon";
    const ext = isIcon ? "svg" : "png";
    const id = `${req.sceneId}-${isIcon ? "icon" : "img"}`;
    const hit = await cachedAsset(req, "recraft", ext);
    if (hit) return { id, kind: isIcon ? "icon" : "image", url: hit.url, source: "recraft", license: "generated", prompt: req.prompt, usd: 0, cached: true };
    const res = await fetch("https://external.api.recraft.ai/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.recraftKey}` },
      body: JSON.stringify({ prompt: req.prompt, model: MODEL(), style: isIcon ? "vector_illustration" : req.style ?? "digital_illustration", size: isIcon ? "1024x1024" : "1024x1820", n: 1 }),
    });
    if (!res.ok) throw new Error(`Recraft ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { data?: Array<{ url: string }> };
    const src = data.data?.[0]?.url;
    if (!src) return null;
    const url = await downloadAndStore({ ...req }, "recraft", src, { license: "generated", source: "recraft", model: MODEL() });
    return { id, kind: isIcon ? "icon" : "image", url, source: "recraft", license: "generated", prompt: req.prompt, usd: IMAGE_PRICES.recraft, cached: false };
  },
};
