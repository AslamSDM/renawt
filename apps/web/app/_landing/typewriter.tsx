"use client";

import * as React from "react";

const IDEAS = [
  "why rent feels like a trap",
  "Rome vs Carthage, by numbers",
  "the myth of the 10% brain",
  "3 things I wish I knew at 22",
  "the chart that explains AI",
];

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Types niche ideas one by one. Reduced motion: shows the first idea, static. */
export function Typewriter() {
  const [idx, setIdx] = React.useState(0);
  const [text, setText] = React.useState(IDEAS[0]);
  const [phase, setPhase] = React.useState<"hold" | "delete" | "type">("hold");
  const still = React.useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED).matches, () => false);

  React.useEffect(() => {
    if (still) return;
    const target = IDEAS[idx];
    let t: ReturnType<typeof setTimeout>;
    if (phase === "hold") t = setTimeout(() => setPhase("delete"), 2200);
    else if (phase === "delete") {
      if (text.length === 0)
        t = setTimeout(() => {
          setIdx((i) => (i + 1) % IDEAS.length);
          setPhase("type");
        }, 120);
      else t = setTimeout(() => setText((s) => s.slice(0, -1)), 28);
    } else {
      if (text === target) t = setTimeout(() => setPhase("hold"), 0);
      else t = setTimeout(() => setText(target.slice(0, text.length + 1)), 55);
    }
    return () => clearTimeout(t);
  }, [phase, text, idx, still]);

  return (
    <span className="font-serif-italic text-ink">
      <span className="sr-only">{IDEAS[0]}</span>
      <span aria-hidden>
        “{text}
        <span className="typing-cursor not-italic text-accent">|</span>”
      </span>
    </span>
  );
}
