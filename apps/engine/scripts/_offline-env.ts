/**
 * Imported FIRST by scripts that support --offline: loads .env, then (offline only) removes every database URL
 * so nothing — llm_calls logging, progress events, cost rows — can reach the database configured in .env
 * (in this checkout that is the v1 production DB). Must run before src/lib/env.ts is evaluated.
 */
import { config } from "dotenv";

config({ quiet: true } as never);
if (process.argv.includes("--offline")) {
  for (const k of ["DATABASE_URL", "DIRECT_DATABASE_URL", "MASTRA_DATABASE_URL"]) delete process.env[k];
}
