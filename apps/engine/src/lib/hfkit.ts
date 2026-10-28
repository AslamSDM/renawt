/** Thin binding to @remawt/hf-kit (keeps engine imports stable). */
import {
  composeVideo, lintComposition, scaffoldProject, buildSystemPrompt, buildScenePlanPrompt, renderPoster, submitRender, pollRender,
  coercePlan, sceneIssue, blockGuide, DATA_SHAPE_RULE, BLOCK_NAMES, ComposeError,
} from "@remawt/hf-kit";
export type { ComposeInput as ComposeVideoInput, LintResult as LintReport, RenderPoll, CoercePlanResult, PlanChange, PlanIssue } from "@remawt/hf-kit";

export const hfkit = {
  composeVideo, lintComposition, scaffoldProject, buildSystemPrompt, buildScenePlanPrompt, renderPoster, submitRender, pollRender,
  coercePlan, sceneIssue, blockGuide, DATA_SHAPE_RULE, BLOCK_NAMES, ComposeError,
};
