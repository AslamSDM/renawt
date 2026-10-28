import { z } from "zod";
import type { Script } from "@remawt/shared";
import { generateStructured, type AgentSpec } from "../llm.js";

export const MetadataSchema = z.object({
  youtube: z.object({ title: z.string(), description: z.string(), tags: z.array(z.string()) }),
  tiktok: z.object({ caption: z.string(), hashtags: z.array(z.string()) }),
  instagram: z.object({ caption: z.string(), hashtags: z.array(z.string()) }),
});
export type PlatformMetadata = z.infer<typeof MetadataSchema>;

export const metadataSpec: AgentSpec = {
  id: "metadata",
  name: "Platform metadata",
  role: "metadata",
  instructions: `You write per-platform publishing metadata for a vertical short video.
- YouTube: title ≤ 100 chars (curiosity + keyword, no clickbait lies), description 2–4 short lines incl. sources if any, 5–10 tags.
- TikTok: caption ≤ 2200 chars incl. hashtags (aim for 80–150 chars + 3–5 hashtags).
- Instagram: caption ≤ 2200 chars; first line is a hook; 3–8 hashtags.
- Hashtags without '#'. Never mention AI tools, "remawt", or that the video is automated. JSON only.`,
};

const trunc = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);
const tags = (xs: string[]) => [...new Set(xs.map((h) => h.replace(/^#/, "").replace(/\s+/g, "").trim()).filter(Boolean))];

/** Enforce hard platform limits regardless of what the model returned. */
export function enforceLimits(m: PlatformMetadata): PlatformMetadata {
  const tt = tags(m.tiktok.hashtags);
  const ig = tags(m.instagram.hashtags);
  const fit = (caption: string, hs: string[], max: number) => {
    const suffix = hs.length ? `\n\n${hs.map((h) => `#${h}`).join(" ")}` : "";
    return trunc(caption, Math.max(0, max - suffix.length)) ;
  };
  return {
    youtube: { title: trunc(m.youtube.title.replace(/\s+/g, " ").trim(), 100), description: trunc(m.youtube.description, 5000), tags: tags(m.youtube.tags).slice(0, 15) },
    tiktok: { caption: fit(m.tiktok.caption, tt, 2200), hashtags: tt.slice(0, 8) },
    instagram: { caption: fit(m.instagram.caption, ig, 2200), hashtags: ig.slice(0, 30) },
  };
}

export async function writeMetadata(script: Script, niche: string): Promise<PlatformMetadata> {
  const prompt = `NICHE: ${niche}\nTITLE: ${script.title}\nHOOK: ${script.hook}\nSCRIPT: ${script.lines.map((l) => l.text).join(" ")}\nCTA: ${script.cta}\nSOURCES: ${script.sources.map((s) => `${s.title} ${s.url}`).join("; ")}\nSUGGESTED HASHTAGS: ${script.hashtags.join(", ")}`;
  const out = await generateStructured({ spec: metadataSpec, quality: "standard", label: "metadata", schema: MetadataSchema, prompt, maxOutputTokens: 3000 });
  return enforceLimits(out);
}

/** Deterministic fallback when no LLM key is configured. */
export function fallbackMetadata(script: Script): PlatformMetadata {
  const desc = [script.description, ...script.sources.map((s) => `Source: ${s.title} ${s.url}`)].filter(Boolean).join("\n");
  return enforceLimits({
    youtube: { title: script.title, description: desc, tags: script.hashtags },
    tiktok: { caption: script.hook, hashtags: script.hashtags },
    instagram: { caption: `${script.hook}\n${script.description}`, hashtags: script.hashtags },
  });
}
