// AUTO-GENERATED — edit SHARED_HELPERS in generate-server/lib/video/registry.ts
import { spring } from "remotion";

export function ease(t: number): number { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
export function applyAnim(animation: string, localFrame: number, fps: number): { opacity: number; transform: string; filter: string } {
  if (animation === "none") return { opacity: 1, transform: "none", filter: "none" };
  const dur = Math.max(1, Math.round(fps * 0.5));
  const t = Math.min(1, Math.max(0, localFrame / dur));
  const e = ease(t);
  if (animation === "fade") return { opacity: e, transform: "none", filter: "none" };
  if (animation === "slide-up") return { opacity: e, transform: `translateY(${(1-e)*40}px)`, filter: "none" };
  if (animation === "slide-down") return { opacity: e, transform: `translateY(${(1-e)*-40}px)`, filter: "none" };
  if (animation === "scale") {
    const s = spring({ frame: localFrame, fps, config: { damping: 14 } });
    return { opacity: e, transform: `scale(${s})`, filter: "none" };
  }
  if (animation === "blur-in") return { opacity: e, transform: "none", filter: `blur(${(1-e)*16}px)` };
  return { opacity: 1, transform: "none", filter: "none" };
}
