/**
 * kitPreviews — in-process Mastra workflow (default engine; the request is synchronous for onboarding):
 * for each skin → hf-kit renderPoster (1080x1920 PNG with niche copy) → R2 `kits/{channelId}/{skinId}.png`.
 * Cached by hash of (skin, headline, sub, niche): the object metadata carries the hash.
 */
import { z } from "zod";
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { SKIN_PRESETS, getNiche, type VisualSkin } from "@remawt/shared";
import { hfkit } from "../../lib/hfkit.js";
import { existingObject, putObject } from "../../lib/r2.js";
import { hashOf } from "../../lib/hash.js";

const InputSchema = z.object({ channelId: z.string(), niche: z.string(), skinIds: z.array(z.string()).optional(), headline: z.string().optional() });
const OutputSchema = z.object({ previews: z.array(z.object({ skinId: z.string(), posterUrl: z.string(), clipUrl: z.string().optional() })) });

const NICHE_COPY: Record<string, [string, string]> = {
  "personal-finance": ["Where your first $1,000 should go", "One money idea, explained in 45 seconds"],
  investing: ["Why index funds win (most of the time)", "The chart that explains it"],
  history: ["The empire that collapsed in a week", "History, one map at a time"],
  psychology: ["Why your brain loves bad decisions", "One bias, explained visually"],
  science: ["What actually happens inside a black hole", "Science facts in under a minute"],
  "ai-tools": ["5 AI tools that replace an afternoon of work", "Tested, not hyped"],
};

export function nicheCopy(niche: string, headline?: string): { headline: string; sub: string } {
  const c = NICHE_COPY[niche];
  const n = getNiche(niche);
  return { headline: headline ?? c?.[0] ?? `The ${n?.keywords[0] ?? niche} fact nobody tells you`, sub: c?.[1] ?? `${n?.name ?? niche}, explained visually` };
}

export async function renderKitPreview(channelId: string, niche: string, skin: VisualSkin, headline?: string) {
  const copy = nicheCopy(niche, headline);
  const hash = hashOf(skin, copy, niche);
  const key = `kits/${channelId}/${skin.id}.png`;
  const hit = await existingObject(key);
  if (hit && hit.metadata.hash === hash) return { skinId: skin.id, posterUrl: `${hit.url}?v=${hash}` };
  const png = await hfkit.renderPoster({ skin, headline: copy.headline, sub: copy.sub, niche });
  const url = await putObject(key, png, "image/png", { hash, niche });
  return { skinId: skin.id, posterUrl: `${url}?v=${hash}` };
}

const renderAll = createStep({
  id: "render-posters",
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  execute: async ({ inputData }) => {
    const skins = inputData.skinIds?.length ? SKIN_PRESETS.filter((s) => inputData.skinIds!.includes(s.id)) : SKIN_PRESETS;
    // Puppeteer is memory-heavy: two posters at a time.
    const out: Array<{ skinId: string; posterUrl: string }> = [];
    for (let i = 0; i < skins.length; i += 2) {
      out.push(...(await Promise.all(skins.slice(i, i + 2).map((s) => renderKitPreview(inputData.channelId, inputData.niche, s, inputData.headline)))));
    }
    return { previews: out };
  },
});

export const kitPreviews = createWorkflow({ id: "kitPreviews", inputSchema: InputSchema, outputSchema: OutputSchema }).then(renderAll).commit();
