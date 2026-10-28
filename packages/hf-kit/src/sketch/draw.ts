/**
 * Draw-on timing for hand-drawn scenes, the way contentgen `render.mjs` / excalidraw-animate draw
 * an Excalidraw scene: units in element order, one after another, each stroke drawn with
 * stroke-dashoffset (length → 0), each text LINE hand-written by a left→right clip sweep.
 *
 * The output is GSAP code for the scene's paused timeline (`tl`), so HyperFrames can seek it
 * frame by frame. HyperFrames does not drive SVG SMIL, so excalidraw-animate's `<animate>` nodes
 * are not used; this file is the GSAP equivalent of its per-unit begin/dur schedule.
 *
 * Hard rule: text lines are strictly sequential. No two units overlap in time, and a text unit is
 * always exactly one line.
 */
import { r3 } from "../util";

/**
 * Path length per second for pen strokes. Excalidraw's rough paths hold both passes of the double
 * stroke, so 1800 px of path ≈ 900 px/s of visible pen travel.
 */
export const STROKE_SPEED = 1800;
/** Hachure / fill strokes are drawn faster (they are dense). */
export const FILL_SPEED = 5200;
/** Hand-writing speed (characters per second). */
export const WRITE_CPS = 14;
export const MIN_STROKE_S = 0.25;
/** Longest a single shape unit takes at natural speed (excalidraw-animate uses 0.5 s per element). */
export const MAX_STROKE_S = 1.1;
export const MIN_TEXT_S = 0.3;
/** Pause between units. */
export const UNIT_GAP = 0.08;
/** Time to fade a finished page before the next one draws. */
export const PAGE_FADE = 0.3;

export interface Stroke { id: string; len: number; dash: number; fill?: boolean }
export interface DrawUnit {
  kind: "shape" | "text";
  /** Shape units: stroke paths in draw order (outlines before hachure fills). */
  strokes: Stroke[];
  /** Solid-fill paths: faded in at the end of the unit. */
  fills: string[];
  /** Text units: the <g>s of ONE line, written left to right (a line may have coloured segments). */
  texts?: Array<{ id: string; chars: number }>;
  page: number;
  pauseAfter?: number;
  speed?: number;
}

export interface Slot { start: number; dur: number }
export interface Schedule { slots: Slot[]; pages: Array<{ page: number; start: number; end: number }>; end: number; scale: number }

export function naturalDuration(u: DrawUnit): number {
  const speed = u.speed ?? 1;
  if (u.kind === "text") return Math.max(MIN_TEXT_S, (u.texts ?? []).reduce((a, t) => a + t.chars, 0) / WRITE_CPS) / speed;
  const lineLen = u.strokes.filter((s) => !s.fill).reduce((a, s) => a + s.len, 0);
  const fillLen = u.strokes.filter((s) => s.fill).reduce((a, s) => a + s.len, 0);
  const d = (lineLen ? Math.min(MAX_STROKE_S, Math.max(MIN_STROKE_S, lineLen / STROKE_SPEED)) : 0) + (fillLen ? Math.min(0.7, Math.max(0.2, fillLen / FILL_SPEED)) : 0);
  return Math.max(MIN_STROKE_S, d) / speed;
}

/**
 * Lay units out back to back inside [t0, t1]. When the natural schedule does not fit, every
 * duration and gap is scaled by the same factor (still strictly sequential).
 */
export function schedule(units: DrawUnit[], o: { t0: number; t1: number }): Schedule {
  const nat = units.map(naturalDuration);
  const gaps = units.map((u, i) => (i === units.length - 1 ? 0 : (u.pauseAfter ?? 0) + (units[i + 1].page !== u.page ? PAGE_FADE + UNIT_GAP : UNIT_GAP)));
  const need = nat.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  const avail = Math.max(0.2, o.t1 - o.t0);
  const scale = need > avail ? avail / need : 1;
  const slots: Slot[] = [];
  let t = o.t0;
  units.forEach((u, i) => {
    const dur = nat[i] * scale;
    slots.push({ start: t, dur });
    t += dur + gaps[i] * scale;
  });
  const pages: Schedule["pages"] = [];
  units.forEach((u, i) => {
    const last = pages[pages.length - 1];
    if (!last || last.page !== u.page) pages.push({ page: u.page, start: slots[i].start, end: slots[i].start + slots[i].dur });
    else last.end = slots[i].start + slots[i].dur;
  });
  const end = slots.length ? slots[slots.length - 1].start + slots[slots.length - 1].dur : o.t0;
  return { slots, pages, end, scale };
}

const q = (s: string) => JSON.stringify(`#${s}`);

/**
 * GSAP statements for a schedule. Initial states are static SVG attributes (dash offset = length)
 * or `gsap.set` (text clip, fill opacity), so frame 0 renders hidden without a tl.set at 0.
 * `pageIds[k]` is the wrapper of page k: it fades out right before page k+1 starts.
 */
export function sketchTimeline(units: DrawUnit[], sch: Schedule, pageIds: string[] = []): string {
  const init: string[] = [];
  const lines: string[] = [];
  units.forEach((u, i) => {
    const { start, dur } = sch.slots[i];
    if (u.kind === "text") {
      // Handwriting: a left→right sweep at constant speed over ONE line (its segments in order).
      const segs = u.texts ?? [];
      const total = segs.reduce((a, t) => a + t.chars, 0) || 1;
      let t = start;
      for (const seg of segs) {
        const d = (dur * seg.chars) / total;
        lines.push(`tl.fromTo(${q(seg.id)}, { clipPath: "inset(-30% 100% -30% -2%)" }, { clipPath: "inset(-30% -2% -30% -2%)", duration: ${r3(Math.max(0.02, d))}, ease: "none" }, ${r3(t)});`);
        t += d;
      }
      return;
    }
    const lineStrokes = u.strokes.filter((s) => !s.fill);
    const fillStrokes = u.strokes.filter((s) => s.fill);
    const lineLen = lineStrokes.reduce((a, s) => a + s.len, 0);
    const fillLen = fillStrokes.reduce((a, s) => a + s.len, 0);
    const lineShare = !fillLen ? 1 : !lineLen ? 0 : Math.min(0.8, Math.max(0.5, lineLen / (lineLen + fillLen / 6)));
    let t = start;
    for (const s of lineStrokes) {
      const d = (dur * lineShare * s.len) / (lineLen || 1);
      lines.push(`tl.to(${q(s.id)}, { strokeDashoffset: 0, duration: ${r3(Math.max(0.02, d))}, ease: "none" }, ${r3(t)});`);
      t += d;
    }
    const fillDur = dur * (1 - lineShare);
    for (const s of fillStrokes) {
      // Hachure lines all sweep in together over the back of the unit (a quick scribble).
      lines.push(`tl.to(${q(s.id)}, { strokeDashoffset: 0, duration: ${r3(Math.max(0.05, fillDur))}, ease: "power1.inOut" }, ${r3(t)});`);
    }
    for (const id of u.fills) {
      init.push(`gsap.set(${q(id)}, { opacity: 0 });`);
      lines.push(`tl.to(${q(id)}, { opacity: 1, duration: ${r3(Math.max(0.12, Math.min(0.3, dur * 0.3)))}, ease: "power1.out" }, ${r3(Math.max(start, start + dur - 0.2))});`);
    }
  });
  sch.pages.slice(1).forEach((p, k) => {
    const prev = pageIds[sch.pages[k].page];
    const from = sch.pages[k].end + UNIT_GAP * sch.scale * 0.5;
    if (prev) lines.push(`tl.to(${q(prev)}, { opacity: 0, duration: ${r3(Math.max(0.1, PAGE_FADE * sch.scale))}, ease: "power1.in" }, ${r3(from)});`);
    void p;
  });
  return [...init, ...lines].join("\n      ");
}
