/** Beat-grammar format templates. Durations are targets for a 45s cut; scale to targetSec. */
export interface Beat { id: string; label: string; share: number; block: string; note: string }
export interface FormatTemplate {
  id: string;
  name: string;
  tagline: string;
  risk: "low" | "medium" | "high";
  niches: string[];           // "*" = all
  minSec: number; maxSec: number;
  beats: Beat[];              // shares sum to 1
  visualHints: string[];      // registry block families to favour
  scriptRules: string[];
}

export const FORMATS: FormatTemplate[] = [
  {
    id: "did-you-know", name: "Did You Know", tagline: "Shocking question → visual answer → twist", risk: "low", niches: ["*"], minSec: 30, maxSec: 60,
    beats: [
      { id: "hook", label: "Hook", share: 0.08, block: "kinetic-headline", note: "Question or counter-intuitive claim, ≤12 words" },
      { id: "setup", label: "Setup", share: 0.2, block: "diagram", note: "What most people assume" },
      { id: "reveal", label: "Reveal", share: 0.42, block: "diagram|counter|map", note: "The actual mechanism, one idea per frame" },
      { id: "twist", label: "Twist", share: 0.2, block: "kinetic-headline", note: "Unexpected implication" },
      { id: "loop", label: "Loop/CTA", share: 0.1, block: "outro", note: "Callback to hook; follow for next" },
    ],
    visualHints: ["kinetic-type", "diagram", "counter", "icon-grid"],
    scriptRules: ["Open with the question in ≤2s", "One fact per sentence", "End on a callback to the hook"],
  },
  {
    id: "chart-explains", name: "This Chart Explains", tagline: "Bold claim → animated chart build → takeaway", risk: "low", niches: ["finance", "economics", "tech", "science", "sports", "health"], minSec: 30, maxSec: 60,
    beats: [
      { id: "hook", label: "Claim", share: 0.1, block: "kinetic-headline", note: "A number that sounds wrong" },
      { id: "axes", label: "Axes", share: 0.15, block: "chart", note: "Introduce what's measured" },
      { id: "build", label: "Build", share: 0.45, block: "chart", note: "Animate series in; annotate 2–3 inflection points" },
      { id: "takeaway", label: "Takeaway", share: 0.2, block: "kinetic-headline", note: "What it means for the viewer" },
      { id: "loop", label: "CTA", share: 0.1, block: "outro", note: "Source on screen; follow" },
    ],
    visualHints: ["chart-line", "chart-bar", "counter", "annotation"],
    scriptRules: ["Cite the data source by name on screen", "Never give personalised financial/health advice", "Numbers spoken as rounded, shown exact"],
  },
  {
    id: "x-vs-y", name: "X vs Y", tagline: "Split screen → 3–5 stat rounds → verdict", risk: "low", niches: ["*"], minSec: 30, maxSec: 60,
    beats: [
      { id: "hook", label: "Matchup", share: 0.1, block: "split-title", note: "Name both sides + 'which wins?'" },
      { id: "rounds", label: "Rounds", share: 0.6, block: "split-stat", note: "3–5 rounds, each a measurable comparison" },
      { id: "verdict", label: "Verdict", share: 0.2, block: "kinetic-headline", note: "Clear winner with the nuance" },
      { id: "loop", label: "CTA", share: 0.1, block: "outro", note: "Ask for next matchup" },
    ],
    visualHints: ["split-screen", "bar-compare", "counter", "badge"],
    scriptRules: ["Each round names a metric and a number", "Verdict must acknowledge one counterpoint"],
  },
  {
    id: "wish-i-knew", name: "N Things I Wish I Knew", tagline: "Relatable pain → 3–5 tips → save CTA", risk: "low", niches: ["careers", "finance", "study", "productivity", "parenting", "tech", "psychology", "fitness"], minSec: 35, maxSec: 75,
    beats: [
      { id: "hook", label: "Pain", share: 0.1, block: "kinetic-headline", note: "Specific regret in second person" },
      { id: "tips", label: "Tips", share: 0.65, block: "numbered-card", note: "3–5 numbered tips, each with one concrete action" },
      { id: "best", label: "Best one", share: 0.15, block: "kinetic-headline", note: "Call out the single most valuable tip" },
      { id: "loop", label: "Save CTA", share: 0.1, block: "outro", note: "'Save this' + follow" },
    ],
    visualHints: ["numbered-card", "icon-grid", "checklist"],
    scriptRules: ["Tips are actions, not platitudes", "Vary tip length", "No 'as an AI' phrasing"],
  },
  {
    id: "mythbust", name: "Mythbust", tagline: "Stop believing X → myth → evidence → truth", risk: "low", niches: ["health", "fitness", "finance", "science", "history", "psychology", "tech"], minSec: 30, maxSec: 60,
    beats: [
      { id: "hook", label: "Stop", share: 0.1, block: "kinetic-headline", note: "'Stop believing ___'" },
      { id: "myth", label: "Myth", share: 0.2, block: "strike-through", note: "State the myth as people say it" },
      { id: "evidence", label: "Evidence", share: 0.4, block: "source-card|chart", note: "2 pieces of evidence with sources on screen" },
      { id: "truth", label: "Truth", share: 0.2, block: "kinetic-headline", note: "The corrected belief, one sentence" },
      { id: "loop", label: "CTA", share: 0.1, block: "outro", note: "Which myth next?" },
    ],
    visualHints: ["strike-through", "source-card", "chart-bar", "checkmark"],
    scriptRules: ["Every evidence beat names a source", "No medical/financial directives, only information"],
  },
  {
    id: "headline-reaction", name: "Headline Reaction", tagline: "Animated headline → 3 bullets 'what it means' → question", risk: "medium", niches: ["tech", "ai", "finance", "gaming", "science", "business"], minSec: 30, maxSec: 60,
    beats: [
      { id: "hook", label: "Headline", share: 0.12, block: "headline-card", note: "Real headline, source + date on screen" },
      { id: "context", label: "Context", share: 0.18, block: "kinetic-headline", note: "Why this matters in one line" },
      { id: "bullets", label: "What it means", share: 0.5, block: "bullet-stack", note: "3 implications, each with a visual" },
      { id: "question", label: "Question", share: 0.1, block: "kinetic-headline", note: "Open question to drive comments" },
      { id: "loop", label: "CTA", share: 0.1, block: "outro", note: "Follow for the next one" },
    ],
    visualHints: ["headline-card", "bullet-stack", "logo-grid", "timeline"],
    scriptRules: ["Headline must be verifiable with a URL in evidence", "Mark opinion as opinion"],
  },
];

export const FORMAT_IDS = FORMATS.map((f) => f.id);
export function getFormat(id: string): FormatTemplate | undefined { return FORMATS.find((f) => f.id === id); }
