import { FORMAT_IDS } from "./shared";

/**
 * The 15-format faceless short-form taxonomy (research doc §6). Used to label every
 * trend item so we can detect FORMAT trends (format share rising WoW), not just topics.
 * `producible` maps to the @remawt/shared FORMATS template we can actually render today.
 */
export interface TaxonomyFormat {
  id: string;
  n: number;
  name: string;
  structure: string;
  risk: "low" | "medium" | "high";
  producible?: string;
  /** Title/caption regex hints, most specific first. */
  hints: RegExp[];
}

export const TAXONOMY: TaxonomyFormat[] = [
  { id: "did-you-know", n: 1, name: "Did you know / what-if explainer", structure: "shocking question → motion-graphic answer → twist", risk: "low", producible: "did-you-know",
    hints: [/did you know/i, /\bwhat if\b/i, /what (happens|would happen) (if|when|to)/i, /\bwhy (do|does|is|are|did)\b.*\?/i, /\bhow does\b.*\bwork/i, /\bexplained\b/i, /\bthe science of\b/i] },
  { id: "listicle-countdown", n: 2, name: "Listicle countdown (Top N)", structure: "number promise → items in reverse order → #1 payoff", risk: "medium", producible: "did-you-know",
    hints: [/\btop \d+\b/i, /^\s*\d+\s+(craziest|weirdest|best|worst|most|biggest|strangest|facts|places|signs|reasons|ways|things|times|countries|animals|movies|games)\b/i, /\b\d+ (facts|reasons|signs|ways) (about|to|you|that|why)\b/i, /#\d+ (will|is)\b/i] },
  { id: "every-x-explained", n: 3, name: "Stickman \"every X explained\"", structure: "every ___ explained in __ sec → rapid segments → callback", risk: "low", producible: "did-you-know",
    hints: [/\bevery\b.+\bexplained\b/i, /\bexplained in (\d+|one|a) (seconds?|minutes?|sentence)/i, /\b(all|every) .+ in \d+ (seconds|minutes)\b/i] },
  { id: "story-time", n: 4, name: "Horror / story-time narration", structure: "cold open line → escalating story → twist", risk: "medium",
    hints: [/story ?time/i, /^(the )?(true |untold |bizarre |creepy )?story of\b/i, /\b(creepy|scary|horror|haunted|disturbing|chilling)\b/i, /\bthe (case|disappearance|murder) of\b/i, /\bwhat happened (to|when|at)\b/i, /\bnobody (believed|expected)\b/i] },
  { id: "pov-story", n: 5, name: "POV text story", structure: "\"POV: you…\" text → captioned story over b-roll → punchline", risk: "high",
    hints: [/^\s*pov\s*[:\-]/i, /\bpov\s*:/i, /#pov\b/i] },
  { id: "then-vs-now", n: 7, name: "Then vs now", structure: "\"1995 vs 2026\" → paired visuals → surprising stat", risk: "low", producible: "x-vs-y",
    hints: [/\b(1[89]|20)\d{2}\s*(vs\.?|versus|→|->|to)\s*(1[89]|20)\d{2}\b/i, /\bthen (vs\.?|and) now\b/i, /\b\d+ years? (ago )?vs\.? (today|now)\b/i, /\bback then\b/i, /\bcost in (19|20)\d{2}\b/i] },
  { id: "x-vs-y", n: 6, name: "X vs Y comparison", structure: "split screen + \"which wins?\" → 3–5 stat rounds → verdict", risk: "low", producible: "x-vs-y",
    hints: [/\S\s+(vs\.?|versus)\s+\S/i, /\bwhich (is|wins|one)\b.*\b(better|stronger|faster|cheaper|wins)\b/i, /\bcompared?\b.*\bto\b/i] },
  { id: "chart-explains", n: 8, name: "Data-viz \"this chart explains\"", structure: "bold claim → animated chart build → takeaway", risk: "low", producible: "chart-explains",
    hints: [/\bthis (chart|graph|map)\b/i, /\bin (one|a single|\d+) (chart|graph)s?\b/i, /\b(chart|graph|data) (shows|explains|reveals)\b/i, /\bvisuali[sz]ed\b/i, /\bby the numbers\b/i] },
  { id: "headline-reaction", n: 9, name: "News / headline reaction", structure: "animated headline → 3 bullets \"what it means\" → question", risk: "medium", producible: "headline-reaction",
    hints: [/^\s*breaking\b/i, /\bjust (announced|released|launched|dropped|leaked|banned)\b/i, /\b(announces|unveils|launches|releases|confirms)\b/i, /\bwhat (this|it) means\b/i, /\bthis week in\b/i, /\bnews\b/i] },
  { id: "quiz", n: 10, name: "Quiz / guess", structure: "\"only 1% get this\" → 3–5 timed questions → score", risk: "medium", producible: "did-you-know",
    hints: [/\bonly \d+(\.\d+)?% (of people )?(can|get|will|know|pass)/i, /\bguess the\b/i, /\bquiz\b/i, /\bcan you (name|guess|spot|find|solve|answer)\b/i, /\b(trivia|riddle)\b/i, /\bhow many can you\b/i] },
  { id: "mythbust", n: 11, name: "Mythbusting", structure: "\"stop believing ___\" → myth → evidence → truth", risk: "low", producible: "mythbust",
    hints: [/\bmyths?\b/i, /\bstop believing\b/i, /\bis (a )?(lie|lying|myth|wrong|fake)\b/i, /\b(isn'?t|is not|aren'?t) (actually )?(true|real|bad|good)\b/i, /\bdebunk/i, /\bactually (true|false)\b/i, /\bthe truth about\b/i] },
  { id: "wish-i-knew", n: 12, name: "\"X things I wish I knew\"", structure: "relatable pain → 3–5 tips → save CTA", risk: "low", producible: "wish-i-knew",
    hints: [/\bthings? i wish i('d)? knew\b/i, /\bi wish i (knew|had known)\b/i, /\bwish (someone|somebody) told me\b/i, /\bnobody tells you\b/i, /\b(before you|don'?t) (start|buy|quit|sign)\b/i, /\bmistakes? (i|to avoid|everyone)\b/i] },
  { id: "quote-motivation", n: 13, name: "Quote / motivation", structure: "quote in 1s → cinematic b-roll + music → attribution", risk: "high",
    hints: [/^\s*["“][^"”]{8,}["”]\s*[-–—~]/, /\bquotes?\b/i, /\bmotivation(al)?\b/i, /\b(marcus aurelius|seneca|epictetus)\b/i, /\bmindset\b/i, /\bdiscipline\b/i] },
  { id: "tutorial", n: 14, name: "Tutorial / screen-recording how-to", structure: "outcome shown first → steps → result", risk: "low", producible: "wish-i-knew",
    hints: [/\bhow to\b/i, /\btutorial\b/i, /\bstep[- ]by[- ]step\b/i, /\b(beginner'?s? )?guide\b/i, /\b(tips?|tricks?|shortcuts?) (for|in|you)\b/i, /\b(excel|notion|chatgpt|claude|photoshop|figma|canva)\b.*\b(hack|trick|tip|prompt)s?\b/i] },
  { id: "comedy-skit", n: 15, name: "Animated comedy skit / meme", structure: "setup → escalation → punchline", risk: "medium",
    hints: [/^\s*when (you|your|ur|my|the)\b/i, /\bbe like\b/i, /#?(meme|skit|comedy|funny|relatable)\b/i, /\b(lol|lmao)\b/i, /\bnobody:\b/i] },
];

export const TAXONOMY_IDS = TAXONOMY.map((t) => t.id) as [string, ...string[]];
export const UNKNOWN_FORMAT = "other";

export function getTaxonomyFormat(id: string): TaxonomyFormat | undefined { return TAXONOMY.find((t) => t.id === id); }

/** Map a taxonomy id (or a shared FORMATS id) to a producible @remawt/shared FORMATS id. */
export function producibleFormat(id: string): string | undefined {
  if ((FORMAT_IDS as string[]).includes(id)) return id;
  return getTaxonomyFormat(id)?.producible;
}

export interface FormatGuess { id: string; confidence: number; matched: string }

/**
 * Regex-only format guess. Order of TAXONOMY is the precedence (e.g. "then vs now" before
 * "x vs y", "wish I knew" checked before "top N" by `PRECEDENCE`). Title matches score
 * higher than caption matches; earlier (more specific) hints score higher than later ones.
 */
const PRECEDENCE = ["pov-story", "wish-i-knew", "every-x-explained", "then-vs-now", "quiz", "mythbust", "chart-explains", "x-vs-y", "listicle-countdown", "story-time", "headline-reaction", "tutorial", "comedy-skit", "quote-motivation", "did-you-know"];

export function guessFormat(title: string, caption?: string): FormatGuess | null {
  const ordered = PRECEDENCE.map((id) => getTaxonomyFormat(id)!).filter(Boolean);
  let best: FormatGuess | null = null;
  for (const [text, weight] of [[title, 1], [caption ?? "", 0.6]] as const) {
    if (!text) continue;
    for (let rank = 0; rank < ordered.length; rank++) {
      const f = ordered[rank]!;
      for (let h = 0; h < f.hints.length; h++) {
        const m = f.hints[h]!.exec(text);
        if (!m) continue;
        const confidence = weight * (0.9 - 0.04 * h) * (1 - 0.01 * rank);
        if (!best || confidence > best.confidence + 1e-9) best = { id: f.id, confidence: Number(confidence.toFixed(3)), matched: m[0] };
        break;
      }
    }
    if (best && weight === 1) return best; // a title match beats any caption match
  }
  return best;
}
