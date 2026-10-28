import { fish } from "./fish.js";
import { elevenlabs } from "./elevenlabs.js";
import { kokoro } from "./kokoro.js";
import type { TtsProvider } from "./types.js";

export * from "./types.js";
export { fish, elevenlabs, kokoro };

const PROVIDERS: Record<string, TtsProvider> = { fish, elevenlabs, kokoro };

/**
 * Pick the TTS provider. Order: FREE plan → kokoro (when configured); explicit kit `voice.provider`;
 * env `TTS_PROVIDER`; then fish → elevenlabs → kokoro, first configured wins.
 * Falls back to fish unconfigured so the error names the default provider's missing key.
 */
export function ttsFor(provider: string | undefined, opts: { free?: boolean; providers?: Record<string, TtsProvider>; envProvider?: string } = {}): TtsProvider {
  const all = opts.providers ?? PROVIDERS;
  const pick = (id: string | undefined) => (id && all[id]?.isConfigured() ? all[id] : undefined);
  if (opts.free && all.kokoro?.isConfigured()) return all.kokoro;
  return pick(provider) ?? pick(opts.envProvider ?? process.env.TTS_PROVIDER) ?? pick("fish") ?? pick("elevenlabs") ?? pick("kokoro") ?? all.fish;
}
