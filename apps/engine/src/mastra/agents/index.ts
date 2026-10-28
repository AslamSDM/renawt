import { getAgent } from "../llm.js";
import { scriptwriterSpec } from "./scriptwriter.js";
import { plannerSpec } from "./planner.js";
import { composerSpec } from "./composer.js";
import { criticSpec } from "./critic.js";
import { metadataSpec } from "./metadata.js";
import { taggerSpec, ideatorSpec } from "./radar.js";
import { repairSpec } from "./repair.js";

export * from "./scriptwriter.js";
export * from "./planner.js";
export * from "./composer.js";
export * from "./critic.js";
export * from "./metadata.js";
export * from "./radar.js";
export * from "./repair.js";

/** Standard-quality instances registered on the Mastra instance (observability/Studio). */
export function standardAgents() {
  return {
    scriptwriter: getAgent(scriptwriterSpec),
    planner: getAgent(plannerSpec),
    composer: getAgent(composerSpec),
    critic: getAgent(criticSpec),
    metadata: getAgent(metadataSpec),
    tagger: getAgent(taggerSpec),
    ideator: getAgent(ideatorSpec),
    repairScene: getAgent(repairSpec),
  };
}
