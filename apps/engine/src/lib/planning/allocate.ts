/**
 * Scene timing: allocate scene durations to format beats by `share`, then snap scene boundaries to
 * word boundaries (gaps between spoken words) so cuts never land mid-word. Optionally nudge each
 * boundary onto the music beat grid when that stays inside the same word gap.
 */
import type { Word } from "../captions.js";

export interface BeatShare { id: string; share: number }
export interface TimedBeat { beatId: string; startMs: number; durationMs: number }

/** Split totalMs across beats proportionally to share (normalised; shares need not sum to 1). */
export function allocateBeatDurations(beats: BeatShare[], totalMs: number): TimedBeat[] {
  const sum = beats.reduce((a, b) => a + Math.max(0, b.share), 0) || 1;
  let t = 0;
  return beats.map((b, i) => {
    const end = i === beats.length - 1 ? totalMs : Math.round(t + (Math.max(0, b.share) / sum) * totalMs);
    const r = { beatId: b.id, startMs: Math.round(t), durationMs: end - Math.round(t) };
    t = end;
    return r;
  });
}

/** Candidate cut points: 0, midpoints of inter-word gaps, totalMs. */
export function wordGapBoundaries(words: Word[], totalMs: number): number[] {
  const out = [0];
  for (let i = 1; i < words.length; i++) out.push(Math.round((words[i - 1].e + words[i].s) / 2));
  out.push(totalMs);
  return out;
}

function nearest(values: number[], ms: number, lo = -Infinity, hi = Infinity): number {
  let best = ms;
  let bestD = Infinity;
  for (const v of values) {
    if (v <= lo || v >= hi) continue;
    const d = Math.abs(v - ms);
    if (d < bestD) { best = v; bestD = d; }
  }
  return best;
}

const tokenCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/**
 * Map script lines to [firstWord, lastWord] index ranges by word counts. Returns null if the
 * narration word count differs from the script by >20% (provider normalisation, etc.).
 */
export function lineWordRanges(lines: string[], words: Word[]): Array<[number, number]> | null {
  const counts = lines.map(tokenCount);
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total || !words.length || Math.abs(total - words.length) / total > 0.2) return null;
  const scale = words.length / total;
  const ranges: Array<[number, number]> = [];
  let idx = 0;
  counts.forEach((c, i) => {
    const n = i === counts.length - 1 ? words.length - idx : Math.max(c ? 1 : 0, Math.round(c * scale));
    const start = Math.min(idx, words.length - 1);
    const end = Math.min(words.length - 1, Math.max(start, idx + n - 1));
    ranges.push([start, end]);
    idx = end + 1;
  });
  return ranges;
}

export interface AlignInput {
  scenes: Array<{ id: string; beatId: string }>;
  lines: Array<{ beatId: string; text: string }>;
  beats: BeatShare[];            // format beat order + shares
  words: Word[];
  totalMs: number;
  beatMs?: number;               // music beat length; enables beat-grid nudge
  minSceneMs?: number;
}

export interface AlignedScene { id: string; beatId: string; startMs: number; durationMs: number }

export function alignScenes(input: AlignInput): AlignedScene[] {
  const { scenes, lines, words, totalMs } = input;
  const minScene = input.minSceneMs ?? 900;
  if (!scenes.length) return [];
  const gaps = wordGapBoundaries(words, totalMs);

  // Beat order = format order filtered to beats that have scenes (unknown beat ids appended in scene order).
  const order: string[] = [];
  for (const b of input.beats) if (scenes.some((s) => s.beatId === b.id)) order.push(b.id);
  for (const s of scenes) if (!order.includes(s.beatId)) order.push(s.beatId);

  // 1) beat window starts: from narration (first word of the first line of that beat) or by share.
  const ranges = lineWordRanges(lines.map((l) => l.text), words);
  const shareWindows = allocateBeatDurations(order.map((id) => ({ id, share: input.beats.find((b) => b.id === id)?.share ?? 1 / order.length })), totalMs);
  const starts: number[] = order.map((beatId, i) => {
    if (i === 0) return 0;
    if (ranges) {
      const li = lines.findIndex((l) => l.beatId === beatId);
      if (li >= 0) {
        const wi = ranges[li][0];
        return wi > 0 ? Math.round((words[wi - 1].e + words[wi].s) / 2) : 0;
      }
    }
    return nearest(gaps, shareWindows[i].startMs);
  });
  // keep monotone
  for (let i = 1; i < starts.length; i++) if (starts[i] <= starts[i - 1]) starts[i] = Math.min(totalMs, starts[i - 1] + minScene);

  // 2) split each beat window across its scenes, snapping internal cuts to word gaps.
  const bounds: Array<{ id: string; beatId: string; s: number }> = [];
  order.forEach((beatId, i) => {
    const ws = starts[i];
    const we = i + 1 < starts.length ? starts[i + 1] : totalMs;
    const inBeat = scenes.filter((s) => s.beatId === beatId);
    inBeat.forEach((sc, k) => {
      const ideal = ws + ((we - ws) * k) / inBeat.length;
      const s = k === 0 ? ws : nearest(gaps, ideal, ws, we);
      bounds.push({ id: sc.id, beatId, s: Math.round(s) });
    });
  });

  // 3) optional beat-grid nudge: move a cut onto the nearest music beat if it stays inside the same word gap.
  if (input.beatMs && input.beatMs > 0 && words.length) {
    for (let i = 1; i < bounds.length; i++) {
      const s = bounds[i].s;
      const onBeat = Math.round(s / input.beatMs) * input.beatMs;
      const prevWordEnd = Math.max(0, ...words.filter((w) => w.e <= s).map((w) => w.e));
      const nextWordStart = Math.min(totalMs, ...words.filter((w) => w.s >= s).map((w) => w.s));
      if (onBeat > prevWordEnd && onBeat < nextWordStart) bounds[i].s = Math.round(onBeat);
    }
  }

  // 4) enforce monotone + min duration, then emit.
  bounds.sort((a, b) => a.s - b.s);
  const out: AlignedScene[] = [];
  for (let i = 0; i < bounds.length; i++) {
    const s = i === 0 ? 0 : Math.max(bounds[i].s, out[i - 1].startMs + minScene);
    out.push({ id: bounds[i].id, beatId: bounds[i].beatId, startMs: Math.min(s, totalMs), durationMs: 0 });
  }
  for (let i = 0; i < out.length; i++) {
    const end = i + 1 < out.length ? out[i + 1].startMs : totalMs;
    out[i].durationMs = Math.max(0, end - out[i].startMs);
  }
  // restore the planner's scene order (cuts are sorted by time already; scene order normally matches)
  const pos = new Map(scenes.map((s, i) => [s.id, i]));
  return out.sort((a, b) => (a.startMs - b.startMs) || ((pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0)));
}
