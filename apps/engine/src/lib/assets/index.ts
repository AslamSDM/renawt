import { nanobanana } from "./nanobanana.js";
import { recraft } from "./recraft.js";
import { pexels } from "./pexels.js";
import { pixabay } from "./pixabay.js";
import { log, errMsg } from "../logger.js";
import type { AssetProvider, AssetRequest, AssetResult } from "./types.js";

export * from "./types.js";
export { nanobanana, recraft, pexels, pixabay };

/** Provider preference per asset kind. FREE (stockOnly) never generates images. */
function chain(kind: AssetRequest["kind"], stockOnly: boolean): AssetProvider[] {
  const stock = [pexels, pixabay];
  if (kind === "stock" || kind === "stock-video") return stock;
  if (stockOnly) return stock;
  if (kind === "icon") return [recraft];
  return [nanobanana, recraft, ...stock];
}

/** Resolve one asset request through the provider chain. Never throws; null when nothing configured/found. */
export async function resolveAsset(req: AssetRequest, opts: { stockOnly?: boolean } = {}): Promise<AssetResult | null> {
  for (const p of chain(req.kind, !!opts.stockOnly)) {
    if (!p.isConfigured()) continue;
    try {
      const effective: AssetRequest = p.kinds.includes(req.kind) ? req : { ...req, kind: "stock", query: req.query ?? req.prompt };
      const r = await p.fetch(effective);
      if (r) return r;
    } catch (e) {
      log.warn("asset provider failed", { provider: p.id, sceneId: req.sceneId, err: errMsg(e) });
    }
  }
  return null;
}
