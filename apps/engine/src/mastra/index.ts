/**
 * Mastra instance: PostgresStore in its own Postgres schema (`mastra`, option `schemaName`) so Prisma never
 * sees drift; PostHog trace exporter when POSTHOG_KEY is set; all workflows registered (Inngest engine for the
 * durable ones, default in-process engine for kitPreviews).
 */
import { Mastra } from "@mastra/core/mastra";
import { PostgresStore } from "@mastra/pg";
import { Observability } from "@mastra/observability";
import { PosthogExporter } from "@mastra/posthog";
import { env } from "../lib/env.js";
import { standardAgents } from "./agents/index.js";
import { produceVideo, rerenderVideo } from "./workflows/produceVideo.js";
import { kitPreviews } from "./workflows/kitPreviews.js";
import { radarRefresh } from "./workflows/radarRefresh.js";
import { publishPublication, collectMetrics } from "./workflows/publish.js";
import { seriesTick } from "./workflows/seriesTick.js";

const storage = env.mastraDatabaseUrl
  ? new PostgresStore({ id: "remawt-mastra", connectionString: env.mastraDatabaseUrl, schemaName: env.mastraSchema })
  : undefined;

const observability = env.posthogKey
  ? new Observability({
      configs: {
        posthog: { serviceName: "remawt-engine", exporters: [new PosthogExporter({ apiKey: env.posthogKey, host: env.posthogHost, enablePrivacyMode: true })] },
      },
    })
  : undefined;

export const mastra = new Mastra({
  agents: standardAgents(),
  workflows: { produceVideo, rerenderVideo, kitPreviews, radarRefresh, publishPublication, collectMetrics, seriesTick },
  ...(storage ? { storage } : {}),
  ...(observability ? { observability } : {}),
  logger: false,
});

export type WorkflowId = "produceVideo" | "rerenderVideo" | "kitPreviews" | "radarRefresh" | "publishPublication" | "collectMetrics" | "seriesTick";
