/**
 * Inngest client + Mastra Inngest workflow primitives. In dev set INNGEST_DEV=1 (and run
 * `npx inngest-cli@latest dev -u http://localhost:3001/api/inngest`); never set INNGEST_DEV in production.
 * Note: @mastra/inngest 1.10.x requires inngest@^4 (not 3.x).
 */
import { Inngest } from "inngest";
import { init } from "@mastra/inngest";

export const inngest = new Inngest({
  id: "remawt-engine",
  ...(process.env.INNGEST_BASE_URL ? { baseUrl: process.env.INNGEST_BASE_URL } : {}),
});

export const { createWorkflow, createStep, cloneStep } = init(inngest);

/** Event names (web never sends these directly; engine routes do). */
export const EVENTS = {
  produceRequested: "video/produce.requested",
  rerenderRequested: "video/rerender.requested",
  renderSubmitted: "video/render.submitted",
  videoReady: "video/ready",
  radarRefresh: "radar/refresh.requested",
  publishScheduled: "publication/scheduled",
  publicationCancelled: "publication/cancelled",
} as const;
