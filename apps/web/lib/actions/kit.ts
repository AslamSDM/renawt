"use server";

import { engine } from "@/lib/engine";
import { getViewerOrNull } from "@/lib/queries/viewer";
import { NOT_SIGNED_IN, fail, ok, type ActionResult } from "./result";

export async function kitPreviews(input: { niche: string; headline?: string; channelId?: string }): Promise<ActionResult<{ previews: { skinId: string; posterUrl: string }[] }>> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  const res = await engine.kitPreviews(viewer.userId, { channelId: input.channelId ?? "draft", niche: input.niche, headline: input.headline });
  if (!res.ok) return fail(res.reason);
  return ok({ previews: res.data.previews.map((p) => ({ skinId: p.skinId, posterUrl: p.posterUrl })) });
}

export async function voiceSample(input: { voiceId: string; provider: string; text: string }): Promise<ActionResult<{ audioUrl: string }>> {
  const viewer = await getViewerOrNull();
  if (!viewer) return fail(NOT_SIGNED_IN);
  const text = input.text.slice(0, 280);
  const res = await engine.voiceSample(viewer.userId, { ...input, text });
  if (!res.ok) return fail(res.reason);
  return ok({ audioUrl: res.data.audioUrl });
}
