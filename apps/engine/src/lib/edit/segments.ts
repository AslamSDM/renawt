/**
 * Transcript segmentation + edited-timeline remapping for user-supplied video/audio.
 * All times in ms. Segments are sentence-ish speech runs split on pauses and sentence ends;
 * gaps longer than `silenceMs` become "silence" segments (dropped by default), filler-only runs
 * become "filler" segments (dropped by default).
 */
import type { Word } from "../captions.js";

export interface Segment { id: string; startMs: number; endMs: number; text: string; kind: "speech" | "silence" | "filler"; keep: boolean }

export const FILLERS = new Set(["um", "umm", "uh", "uhh", "erm", "er", "ah", "hmm", "mm", "mhm"]);
const norm = (w: string) => w.toLowerCase().replace(/[^a-z']/g, "");
export const isFiller = (w: string) => FILLERS.has(norm(w));

export interface SegmentOptions { silenceMs?: number; maxSegMs?: number }

export function buildSegments(words: Word[], opts: SegmentOptions = {}): Segment[] {
  const silenceMs = opts.silenceMs ?? 700;
  const maxSegMs = opts.maxSegMs ?? 7000;
  const segs: Segment[] = [];
  let cur: Word[] = [];
  let n = 0;
  const push = (kind: Segment["kind"], startMs: number, endMs: number, text: string) => {
    n++;
    segs.push({ id: `g${n}`, startMs, endMs, text, kind, keep: kind === "speech" });
  };
  const flush = () => {
    if (!cur.length) return;
    // trim leading/trailing fillers off a speech run; a run of only fillers is a filler segment
    let a = 0, b = cur.length - 1;
    while (a <= b && isFiller(cur[a].w)) a++;
    while (b >= a && isFiller(cur[b].w)) b--;
    if (a > b) push("filler", cur[0].s, cur[cur.length - 1].e, cur.map((w) => w.w).join(" "));
    else {
      if (a > 0) push("filler", cur[0].s, cur[a - 1].e, cur.slice(0, a).map((w) => w.w).join(" "));
      push("speech", cur[a].s, cur[b].e, cur.slice(a, b + 1).map((w) => w.w).join(" "));
      if (b < cur.length - 1) push("filler", cur[b + 1].s, cur[cur.length - 1].e, cur.slice(b + 1).map((w) => w.w).join(" "));
    }
    cur = [];
  };
  let lastEnd: number | null = null;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (lastEnd !== null && w.s - lastEnd > silenceMs) {
      flush();
      push("silence", lastEnd, w.s, "");
    } else if (cur.length && w.e - cur[0].s > maxSegMs) {
      flush();
    }
    cur.push(w);
    lastEnd = w.e;
    if (/[.!?]["')\]]?$/.test(w.w)) flush();
  }
  flush();
  return segs;
}

export interface TimelinePiece { segmentId: string; srcStartMs: number; srcEndMs: number; editStartMs: number; durationMs: number }

/** Build the edited timeline from kept segments (source order), padding each by `padMs` without overlapping neighbours. */
export function editTimeline(segments: Segment[], keepIds: Set<string>, padMs = 80): TimelinePiece[] {
  const kept = segments.filter((s) => keepIds.has(s.id) && s.kind === "speech").sort((a, b) => a.startMs - b.startMs);
  const out: TimelinePiece[] = [];
  let t = 0;
  kept.forEach((s, i) => {
    const prevEnd = i > 0 ? kept[i - 1].endMs : 0;
    const nextStart = i + 1 < kept.length ? kept[i + 1].startMs : Infinity;
    const srcStartMs = Math.max(prevEnd, s.startMs - padMs, 0);
    const srcEndMs = Math.min(nextStart, s.endMs + padMs);
    const durationMs = Math.max(0, srcEndMs - srcStartMs);
    out.push({ segmentId: s.id, srcStartMs, srcEndMs, editStartMs: t, durationMs });
    t += durationMs;
  });
  return out;
}

/** Map source words onto the edited timeline (words outside kept pieces are dropped). */
export function remapWords(words: Word[], pieces: TimelinePiece[]): Word[] {
  const out: Word[] = [];
  for (const w of words) {
    const p = pieces.find((x) => w.s >= x.srcStartMs && w.e <= x.srcEndMs + 1);
    if (!p || isFiller(w.w)) continue;
    out.push({ w: w.w, s: w.s - p.srcStartMs + p.editStartMs, e: w.e - p.srcStartMs + p.editStartMs });
  }
  return out;
}

export function timelineDuration(pieces: TimelinePiece[]): number {
  const last = pieces[pieces.length - 1];
  return last ? last.editStartMs + last.durationMs : 0;
}

/** Target number of motion-graphic cut-ins for an edited duration. light≈1/20s, medium≈1/12s, heavy≈1/8s. */
export function cutInTarget(durationMs: number, density: "light" | "medium" | "heavy"): number {
  const every = density === "light" ? 20000 : density === "heavy" ? 8000 : 12000;
  return Math.max(1, Math.round(durationMs / every));
}
