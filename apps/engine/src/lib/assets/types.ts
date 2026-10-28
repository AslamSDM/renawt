import type { Asset } from "@remawt/shared";

/** What a scene asks for. The planner writes this into `scene.data.asset`. */
export interface AssetRequest {
  kind: "image" | "stock" | "stock-video" | "icon";
  prompt?: string;   // for image/icon generation
  query?: string;    // for stock search
  style?: string;
  videoId: string;
  sceneId: string;
  width?: number;
  height?: number;
}

export interface AssetResult extends Asset {
  usd: number;
  cached: boolean;
  attribution?: string;
}

export interface AssetProvider {
  readonly id: string;
  readonly kinds: AssetRequest["kind"][];
  isConfigured(): boolean;
  fetch(req: AssetRequest): Promise<AssetResult | null>;
}
