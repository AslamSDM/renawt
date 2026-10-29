/**
 * Demo compositions for the Three.js blocks: one short video per block (kinetic intro → 3D scene → outro line),
 * each on a different skin so dark, light and hand-drawn palettes are all exercised.
 *   pnpm --filter @remawt/hf-kit demo --only=3d        (all four)
 *   pnpm --filter @remawt/hf-kit demo --only=globe-3d  (one)
 */
import type { Composition, ScenePlan } from "@remawt/shared";
import { composeVideo } from "../compose";
import { BLOCK_SAMPLES } from "../blocks/schema";
import { THREE_BLOCK_NAMES, type ThreeBlockName } from "../blocks/three/schema";
import { FORMATS, demoKit, demoScript, fakeVoice } from "./fixtures";

export const THREE_DEMO_IDS: string[] = [...THREE_BLOCK_NAMES];
export const isThreeDemo = (id: string): id is ThreeBlockName => (THREE_BLOCK_NAMES as string[]).includes(id);

// Skins whose fonts the renderer can resolve offline (bundled or embedded): dark, light, terminal and hand-drawn.
const SKIN: Record<ThreeBlockName, string> = { "chart-3d": "ledger", "globe-3d": "paper", "stat-3d": "terminal", "scene-3d": "sketch-paper" };

export function threeDemo(id: ThreeBlockName, opts: { audioUrl?: string; skin?: string } = {}): Composition {
  const s = BLOCK_SAMPLES[id];
  const plan: ScenePlan = {
    totalMs: 8000, musicMood: "curious", sfxCues: [],
    scenes: [
      { id: "hook", beatId: "hook", startMs: 0, durationMs: 1500, block: "kinetic-headline", headline: "Watch this in 3D", data: {}, assetIds: [] },
      { id: "three", beatId: "reveal", startMs: 1500, durationMs: 6500, block: id, headline: s.headline, body: s.body, data: s.data, assetIds: [] },
    ],
  };
  const script = demoScript(FORMATS[0], 8);
  const voice = fakeVoice(script, 8000, opts.audioUrl ?? "");
  return composeVideo({ script, voice, plan, kit: demoKit(opts.skin ?? SKIN[id]), assets: [] });
}
