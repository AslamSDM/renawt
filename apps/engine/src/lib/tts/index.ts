import { elevenlabs } from "./elevenlabs.js";
import { kokoro } from "./kokoro.js";
import type { TtsProvider } from "./types.js";

export * from "./types.js";
export { elevenlabs, kokoro };

/** Pick the TTS provider: kit voice provider, FREE plan → kokoro when configured, fallback to whatever is configured. */
export function ttsFor(provider: string | undefined, opts: { free?: boolean } = {}): TtsProvider {
  if (opts.free && kokoro.isConfigured()) return kokoro;
  if (provider === "kokoro" && kokoro.isConfigured()) return kokoro;
  if (elevenlabs.isConfigured()) return elevenlabs;
  if (kokoro.isConfigured()) return kokoro;
  return elevenlabs; // will throw a clear "not set" error
}
