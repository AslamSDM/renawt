import { FORMATS, SKIN_PRESETS, type Asset, type FormatTemplate, type IdentityKit, type ScenePlan, type Script, type VoiceTrack } from "@remawt/shared";
import { allocateScenes } from "../compose";
import { BLOCK_SAMPLES, resolveBlockName, type BlockName } from "../blocks/schema";

export const LEDGER = SKIN_PRESETS.find((s) => s.id === "ledger")!;

export function demoKit(skinId = "ledger"): IdentityKit {
  const skin = SKIN_PRESETS.find((s) => s.id === skinId) ?? LEDGER;
  return {
    version: 1,
    audience: "beginner investors in their 20s",
    promise: "one money concept explained visually per video",
    skin,
    voice: { provider: "elevenlabs", voiceId: "demo", name: "Demo", speed: 1, stability: 0.5, isClone: false },
    persona: { name: "The Ledger", tone: { formal: 0.4, energy: 0.7, humor: 0.3, density: 0.6 }, pov: "second", signaturePhrases: [], avoid: [], language: "en" },
    mascot: { enabled: false },
    formatPrefs: [],
    forbiddenTopics: [],
    defaultDurationSec: 45,
    platformsTarget: ["YOUTUBE", "TIKTOK", "INSTAGRAM"],
  };
}

const LINES: Record<string, string> = {
  hook: "Your savings account is quietly losing you money every single year.",
  setup: "Most people think a bank account keeps their cash safe and growing.",
  reveal: "But inflation eats about three percent a year while the bank pays you almost nothing. Over a decade that gap compounds into thousands of dollars of lost buying power.",
  twist: "The safest looking choice is often the most expensive one.",
  loop: "Follow for one money idea every day.",
  axes: "Here is the S and P five hundred against inflation over ten years.",
  build: "Watch the line climb. It dips during COVID, rebounds, drops again in the twenty twenty two bear market, and still ends far ahead of prices.",
  takeaway: "Time in the market beat timing the market for almost everyone.",
  rounds: "Round one is upfront cost, and renting wins easily. Round two is monthly cost, where renting still edges ahead. Round three is long term wealth, and buying finally takes it.",
  verdict: "Buying wins over ten years, but only if you stay put.",
  tips: "First, automate your savings on payday. Second, kill high interest debt before investing. Third, buy boring index funds and leave them alone for decades.",
  best: "If you only do one, automate it.",
  myth: "You need a perfect credit score to buy a house.",
  evidence: "A Bankrate survey found only thirty nine percent of Americans could cover a thousand dollar emergency. And lenders approve scores around six twenty every day.",
  truth: "Good enough credit and a plan beat perfect credit.",
  context: "This keeps borrowing expensive for another quarter at least.",
  bullets: "Savings rates stay high. Mortgages stay expensive. And credit card rates will not drop soon.",
  question: "Would you lock in a rate now or wait?",
};

export function demoScript(format: FormatTemplate, totalSec = 45): Script {
  return {
    title: `${format.name} demo`,
    hook: LINES.hook,
    lines: format.beats.map((b) => ({ beatId: b.id, text: LINES[b.id] ?? `${b.label}: ${b.note}.`, targetSec: b.share * totalSec })),
    cta: "Follow for more",
    sources: [{ title: "Bankrate", url: "https://www.bankrate.com" }],
    hashtags: [],
    description: "",
    estimatedSec: totalSec,
  };
}

/** Fake narration: script words spread evenly across the runtime, small pauses at punctuation. */
export function fakeVoice(script: Script, totalMs = 45000, audioUrl = ""): VoiceTrack {
  const ws = script.lines.flatMap((l) => l.text.split(/\s+/).filter(Boolean));
  const usable = totalMs - 800;
  const step = usable / ws.length;
  const words = ws.map((w, i) => ({ w, s: Math.round(300 + i * step), e: Math.round(300 + i * step + step * (/[.,!?]$/.test(w) ? 0.6 : 0.85)) }));
  return { audioUrl, durationMs: totalMs, words, provider: "fake", voiceId: "demo" };
}

function sampleFor(block: BlockName, k: number, n: number) {
  const s = structuredClone(BLOCK_SAMPLES[block]);
  if (block === "numbered-card") s.data = { ...s.data, n: k + 1, total: n };
  if (block === "numbered-card" && k > 0) {
    s.headline = ["Automate your savings", "Kill high-interest debt", "Buy boring index funds"][k % 3];
    s.body = ["Move 10% on payday.", "Anything over 8% APR goes first.", "Then leave them alone for decades."][k % 3];
  }
  if (block === "split-stat") {
    const rounds = [
      { metric: "Upfront cost", left: 4000, right: 60000, unit: "$", higherIsBetter: false },
      { metric: "Monthly cost", left: 2100, right: 2850, unit: "$", higherIsBetter: false },
      { metric: "10-year wealth", left: 38000, right: 142000, unit: "$", higherIsBetter: true },
    ];
    s.data = { left: { label: "Renting" }, right: { label: "Buying" }, roundNumber: k + 1, rounds: [rounds[k % 3]] };
  }
  return s;
}

/** Plan for a format: beat slots from allocateScenes; list beats (tips/rounds/evidence) split into several scenes. */
export function demoPlan(format: FormatTemplate, voice: VoiceTrack): ScenePlan {
  const slots = allocateScenes(format, voice.durationMs, voice.words);
  const scenes: ScenePlan["scenes"] = [];
  for (const slot of slots) {
    const block = resolveBlockName(slot.block) ?? "kinetic-headline";
    const split = (block === "numbered-card" || block === "split-stat") && slot.durationMs > 9000 ? 3 : block === "chart" && slot.durationMs > 12000 ? 1 : 1;
    const evidence = slot.beatId === "evidence";
    const parts = evidence ? 2 : split;
    for (let k = 0; k < parts; k++) {
      const b: BlockName = evidence ? (k === 0 ? "source-card" : "chart") : block;
      const smp = sampleFor(b, k, parts);
      const dur = Math.round(slot.durationMs / parts);
      const beat = format.beats.find((x) => x.id === slot.beatId)!;
      const headline = b === "kinetic-headline" ? (slot.beatId === "hook" ? LINES.hook.replace(/ every single year\./, "") : (LINES[slot.beatId] ?? beat.note).replace(/\.$/, "")) : smp.headline;
      scenes.push({
        id: parts > 1 ? `${slot.beatId}-${k + 1}` : slot.beatId,
        beatId: slot.beatId,
        startMs: slot.startMs + k * dur,
        durationMs: k === parts - 1 ? slot.durationMs - dur * (parts - 1) : dur,
        block: b,
        headline,
        body: b === "kinetic-headline" ? undefined : smp.body,
        data: b === "kinetic-headline" ? { kicker: beat.label, emphasis: slot.beatId === "hook" ? ["losing"] : [] } : smp.data,
        assetIds: [],
      });
    }
  }
  return { scenes, totalMs: voice.durationMs, musicMood: "calm", sfxCues: [] };
}

export function demoAssets(): Asset[] {
  return [{ id: "img-1", kind: "image", url: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1080", source: "unsplash", license: "Unsplash" }];
}

export { FORMATS };
