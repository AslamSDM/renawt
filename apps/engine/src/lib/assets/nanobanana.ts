/**
 * Gemini image generation ("Nano Banana") via generativelanguage REST, 9:16.
 * Model id is env-overridable (NANOBANANA_MODEL); the default is unverified against today's model list.
 */
import { env } from "../env.js";
import { IMAGE_PRICES } from "../pricing.js";
import { cachedAsset, storeAsset, decodeMeta } from "./store.js";
import type { AssetProvider, AssetRequest, AssetResult } from "./types.js";

const MODEL = () => process.env.NANOBANANA_MODEL ?? "gemini-3.1-flash-image";

export const nanobanana: AssetProvider = {
  id: "nanobanana",
  kinds: ["image"],
  isConfigured: () => !!env.googleAiKey,
  async fetch(req: AssetRequest): Promise<AssetResult | null> {
    const id = `${req.sceneId}-img`;
    const hit = await cachedAsset(req, "nanobanana", "png");
    if (hit) return { id, kind: "image", url: hit.url, source: "nanobanana", license: "generated", prompt: req.prompt, usd: 0, cached: true, ...pick(decodeMeta(hit.metadata)) };
    const prompt = `${req.prompt}\nVertical 9:16 composition for a short-form video background. No text, no watermark, no logos.${req.style ? ` Style: ${req.style}.` : ""}`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.googleAiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "9:16" } } }),
    });
    if (!res.ok) throw new Error(`Gemini image ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType: string; data: string } }> } }> };
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData) return null;
    const url = await storeAsset(req, "nanobanana", "png", Buffer.from(part.inlineData.data, "base64"), part.inlineData.mimeType || "image/png", { license: "generated", source: "nanobanana", model: MODEL() });
    return { id, kind: "image", url, source: "nanobanana", license: "generated", prompt: req.prompt, width: 1080, height: 1920, usd: IMAGE_PRICES.nanobanana, cached: false };
  },
};

function pick(m: Record<string, string>) {
  return m.license ? { license: m.license } : {};
}
