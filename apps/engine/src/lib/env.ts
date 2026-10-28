/** Centralised env access. Everything optional at import time; callers check `has*()` before paying for a call. */
export const env = {
  port: Number(process.env.PORT ?? 3001),
  apiKey: process.env.API_KEY ?? "",
  corsOrigin: process.env.CORS_ORIGIN,
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  /** Public base URL of this engine (used for render/publisher callbacks). */
  publicUrl: process.env.ENGINE_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}`,
  databaseUrl: process.env.DATABASE_URL ?? "",
  mastraDatabaseUrl: process.env.MASTRA_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  mastraSchema: process.env.MASTRA_DB_SCHEMA ?? "mastra",
  renderProvider: (process.env.RENDER_PROVIDER ?? "lambda") as "lambda" | "local",
  elevenlabsKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenlabsModel: process.env.ELEVENLABS_MODEL_ID ?? "",
  deepinfraKey: process.env.DEEPINFRA_API_KEY ?? "",
  googleAiKey: process.env.GOOGLE_AI_API_KEY ?? "",
  recraftKey: process.env.RECRAFT_API_KEY ?? "",
  pexelsKey: process.env.PEXELS_API_KEY ?? "",
  pixabayKey: process.env.PIXABAY_API_KEY ?? "",
  posthogKey: process.env.POSTHOG_KEY ?? process.env.POSTHOG_API_KEY ?? "",
  posthogHost: process.env.POSTHOG_HOST,
  logLevel: (process.env.LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error",
};

export const has = {
  anthropic: () => !!process.env.ANTHROPIC_API_KEY,
  deepseek: () => !!process.env.DEEPSEEK_API_KEY,
  elevenlabs: () => !!env.elevenlabsKey,
  kokoro: () => !!env.deepinfraKey,
  db: () => !!env.databaseUrl,
  r2: () => !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) || !!(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID),
};
