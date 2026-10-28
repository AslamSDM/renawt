/** Thin binding to @remawt/hf-kit (keeps engine imports stable). */
import { composeVideo, lintComposition, scaffoldProject, buildSystemPrompt, buildScenePlanPrompt, renderPoster, submitRender, pollRender } from "@remawt/hf-kit";
export type { ComposeInput as ComposeVideoInput, LintResult as LintReport, RenderPoll } from "@remawt/hf-kit";

export const hfkit = { composeVideo, lintComposition, scaffoldProject, buildSystemPrompt, buildScenePlanPrompt, renderPoster, submitRender, pollRender };
