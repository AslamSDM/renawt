/**
 * Interop shim for @remawt/shared. That package has no `"type": "module"`, so under
 * Node ESM (tsx) it loads as CommonJS and its `export *` re-exports are invisible to
 * named imports. Reading through the namespace (or its `default`) works in both modes.
 */
import * as mod from "@remawt/shared";

type Shared = typeof mod;
const s: Shared = ((mod as unknown as { FORMATS?: unknown }).FORMATS ? mod : (mod as unknown as { default: Shared }).default);

export const FORMATS: Shared["FORMATS"] = s.FORMATS;
export const FORMAT_IDS: Shared["FORMAT_IDS"] = s.FORMAT_IDS;
export const NICHES: Shared["NICHES"] = s.NICHES;
export const SKIN_PRESETS: Shared["SKIN_PRESETS"] = s.SKIN_PRESETS;
export const getNiche: Shared["getNiche"] = s.getNiche;
export const IdentityKitSchema: Shared["IdentityKitSchema"] = s.IdentityKitSchema;
export type { IdentityKit, Niche, FormatTemplate } from "@remawt/shared";
