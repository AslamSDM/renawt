import type { MotionPreset, TransitionKind } from "../skin/index";
import { Anim } from "../anim";

/**
 * Between-scene transitions. Scenes are back-to-back sub-compositions and a scene's timeline
 * can only reach its own elements, so each transition is split into an exit on the outgoing
 * scene's `#<sid>-stage` and an entrance on the incoming one (a dip through the root background).
 *
 * Registry equivalents (`npx hyperframes add <name>`), for when a cross-scene shader is wanted:
 *   push → "push-slide" / "vertical-push", dissolve → "blur-crossfade" (css-dissolve),
 *   scale → "zoom-through", blur → "focus-pull". Shader transitions need overlapping scene
 *   slots and @hyperframes/shader-transitions; the kit keeps scenes non-overlapping so the
 *   sum-of-durations contract holds, and uses these GSAP equivalents instead.
 */
const NAME_MAP: Record<string, TransitionKind> = {
  push: "push", "push-slide": "push", "vertical-push": "push", slide: "push", "elastic-push": "push",
  dissolve: "dissolve", crossfade: "dissolve", fade: "dissolve", "css-dissolve": "dissolve",
  "blur-crossfade": "blur", blur: "blur", "focus-pull": "blur", "motion-blur": "blur",
  scale: "scale", zoom: "scale", "zoom-through": "scale", "zoom-out": "scale", "cinematic-zoom": "scale",
  cut: "cut", none: "cut", "hard-cut": "cut",
};

export const TRANSITION_NAMES = Object.keys(NAME_MAP);

export function resolveTransition(name: string | undefined, motion: MotionPreset): TransitionKind {
  if (!name) return motion.transition;
  return NAME_MAP[name.trim().toLowerCase()] ?? motion.transition;
}

/** Entrance of `#<sid>-stage` at t=0. */
export function transitionIn(anim: Anim, sid: string, kind: TransitionKind, motion: MotionPreset): void {
  if (kind === "cut") return;
  const sel = `#${sid}-stage`;
  const d = motion.tDur;
  anim.set(sel, { opacity: 0 }, 0);
  anim.to(sel, { opacity: 1, duration: d * 0.8, ease: "power1.out" }, 0);
  if (kind === "push") anim.fromTo(sel, { y: 160 }, { y: 0, duration: d * 1.4, ease: motion.ease }, 0);
  if (kind === "scale") anim.fromTo(sel, { scale: 1.08 }, { scale: 1, duration: d * 1.4, ease: motion.ease }, 0);
  if (kind === "blur") anim.fromTo(sel, { filter: "blur(18px)" }, { filter: "blur(0px)", duration: d, ease: "power2.out" }, 0);
}

/** Exit of `#<sid>-stage`, landing one frame before the scene ends. */
export function transitionOut(anim: Anim, sid: string, kind: TransitionKind, motion: MotionPreset, durationS: number, fps: number): void {
  if (kind === "cut") return;
  const sel = `#${sid}-stage`;
  const d = Math.min(motion.tDur, durationS * 0.25);
  const at = Math.max(0, durationS - d - 1 / fps);
  anim.to(sel, { opacity: 0, duration: d, ease: "power1.in" }, at);
  if (kind === "push") anim.to(sel, { y: -160, duration: d, ease: motion.exitEase }, at);
  if (kind === "scale") anim.to(sel, { scale: 0.94, duration: d, ease: motion.exitEase }, at);
  if (kind === "blur") anim.to(sel, { filter: "blur(18px)", duration: d, ease: "power2.in" }, at);
}
