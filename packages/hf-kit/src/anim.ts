import type { MotionPreset } from "./skin/index";
import { js, r3 } from "./util";

export type Dir = "up" | "down" | "left" | "right" | "scale" | "none";
type Vars = Record<string, unknown>;

/**
 * Tween writer for a scene's paused GSAP timeline (`tl`). Encodes the render contract:
 * - never `fromTo()` with opacity: opacity goes `set(0)` at 0, then `.to(1)`;
 * - `fromTo()` only for transforms (x/y/scale/rotation), which is seek-safe (`from()` is not);
 * - no display/visibility tweens; no layout properties.
 */
export class Anim {
  private lines: string[] = [];
  private initial: string[] = [];
  constructor(public motion: MotionPreset, private opts: { instant?: boolean } = {}) {}

  private fmt(v: Vars): string {
    const o: Vars = {};
    for (const [k, val] of Object.entries(v)) o[k] = typeof val === "number" ? r3(val) : val;
    return js(o);
  }

  set(sel: string, vars: Vars, at: number): this {
    // A zero-duration tl.set at 0 does not render while the playhead sits at 0 (hyperframes lint
    // gsap_timeline_set_initial_hide), so initial states are applied immediately with gsap.set.
    if (at <= 0) {
      const line = `gsap.set(${js(sel)}, ${this.fmt(vars)});`;
      if (!this.initial.includes(line)) this.initial.push(line);
      return this;
    }
    this.lines.push(`tl.set(${js(sel)}, ${this.fmt(vars)}, ${r3(Math.max(0, at))});`);
    return this;
  }

  to(sel: string, vars: Vars, at: number): this {
    this.lines.push(`tl.to(${js(sel)}, ${this.fmt(vars)}, ${r3(Math.max(0, at))});`);
    return this;
  }

  fromTo(sel: string, from: Vars, to: Vars, at: number): this {
    if ("opacity" in from || "opacity" in to || "autoAlpha" in from || "autoAlpha" in to) {
      throw new Error(`hf-kit: fromTo() must not touch opacity (${sel})`);
    }
    this.lines.push(`tl.fromTo(${js(sel)}, ${this.fmt(from)}, ${this.fmt(to)}, ${r3(Math.max(0, at))});`);
    return this;
  }

  raw(line: string): this {
    this.lines.push(line);
    return this;
  }

  /** Entrance: opacity set→to, plus a transform settle in direction `from`. */
  enter(sel: string, at: number, o: { from?: Dir; dist?: number; dur?: number; ease?: string; stagger?: number } = {}): this {
    const m = this.motion;
    const from = o.from ?? "up";
    const dur = o.dur ?? m.dur;
    const ease = o.ease ?? m.ease;
    const instant = this.opts.instant && at < 0.25;
    const dist = (o.dist ?? m.dist) * (instant ? 0.35 : 1);
    const st = o.stagger ? { stagger: o.stagger } : {};
    if (!instant) {
      this.set(sel, { opacity: 0 }, 0);
      this.to(sel, { opacity: 1, duration: Math.min(dur * 0.6, 0.35), ease: "power1.out", ...st }, at);
    }
    const t = transformFrom(from, dist);
    if (t) this.fromTo(sel, t.from, { ...t.to, duration: dur, ease, ...st }, at);
    return this;
  }

  /** Opacity-only reveal. */
  fadeIn(sel: string, at: number, dur = 0.3): this {
    if (this.opts.instant && at < 0.25) return this;
    this.set(sel, { opacity: 0 }, 0);
    return this.to(sel, { opacity: 1, duration: dur, ease: "power1.out" }, at);
  }

  fadeTo(sel: string, opacity: number, at: number, dur = 0.3): this {
    return this.to(sel, { opacity, duration: dur, ease: "power1.inOut" }, at);
  }

  /** Grow along one axis from 0 (bars, rules, strike lines). */
  grow(sel: string, axis: "x" | "y", at: number, o: { dur?: number; ease?: string; origin?: string; stagger?: number; to?: number } = {}): this {
    const key = axis === "x" ? "scaleX" : "scaleY";
    const origin = o.origin ?? (axis === "x" ? "0% 50%" : "50% 100%");
    const st = o.stagger ? { stagger: o.stagger } : {};
    return this.fromTo(sel, { [key]: 0, transformOrigin: origin }, { [key]: o.to ?? 1, duration: o.dur ?? this.motion.dur * 1.4, ease: o.ease ?? "power3.out", transformOrigin: origin, ...st }, at);
  }

  /** Left→right reveal via clip-path (draw-on for SVG lines without stroke-dash tweens). */
  wipe(sel: string, at: number, dur: number, ease = "power1.inOut"): this {
    return this.fromTo(sel, { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: dur, ease }, at);
  }

  /** Short emphasis pulse (scale up and back). */
  pulse(sel: string, at: number, amount = 1.06, dur = 0.18): this {
    this.to(sel, { scale: amount, duration: dur, ease: "power2.out" }, at);
    return this.to(sel, { scale: 1, duration: dur * 1.6, ease: "power2.inOut" }, at + dur);
  }

  out(): string {
    return [...this.initial, ...this.lines].join("\n      ");
  }
}

export function transformFrom(from: Dir, dist: number): { from: Vars; to: Vars } | null {
  switch (from) {
    case "up": return { from: { y: dist }, to: { y: 0 } };
    case "down": return { from: { y: -dist }, to: { y: 0 } };
    case "left": return { from: { x: -dist }, to: { x: 0 } };
    case "right": return { from: { x: dist }, to: { x: 0 } };
    case "scale": return { from: { scale: 0.86 }, to: { scale: 1 } };
    default: return null;
  }
}
