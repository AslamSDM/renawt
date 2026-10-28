import * as React from "react";
import { SKIN_PRESETS, type VisualSkin } from "@remawt/shared";
import { cn } from "@/lib/utils";
import { fontStack } from "./fonts";

/* All scenes are pure CSS. The un-animated state of every element is the
   finished frame, so reduced-motion users see a complete composition. */

type Anim = "kf-word-in" | "kf-word-in-late" | "kf-word-in-later" | "kf-bar" | "kf-wipe" | "kf-strike" | "kf-fade" | "kf-slide-l" | "kf-slide-r" | "kf-stack-in" | "kf-pulse";
const a = (name: Anim, delay = 0, extra?: React.CSSProperties): React.CSSProperties => ({
  animationName: name,
  animationDelay: `${delay}s`,
  ...extra,
});

export function skinById(id: string): VisualSkin {
  return SKIN_PRESETS.find((s) => s.id === id) ?? SKIN_PRESETS[0];
}

interface PhoneFrameProps {
  skin: VisualSkin;
  handle: string;
  loop?: number;
  className?: string;
  children: React.ReactNode;
  label: string;
}

/** 9:16 frame with story-progress bar and channel handle. Scales via container units. */
export function PhoneFrame({ skin, handle, loop = 6, className, children, label }: PhoneFrameProps) {
  const { bg, ink, accent } = skin.palette;
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("phone-frame scene @container", className)}
      style={{ background: bg, color: ink, ["--loop" as string]: `${loop}s`, fontFamily: fontStack(skin.type.body) }}
    >
      <div className="absolute inset-x-[5cqw] top-[4cqw] z-10 h-[0.9cqw] overflow-hidden rounded-full" style={{ background: `${ink}26` }}>
        <div
          className="h-full origin-left rounded-full"
          style={{ background: ink, animationName: "kf-progress", animationTimingFunction: "linear", transform: "scaleX(1)" }}
        />
      </div>
      <div className="absolute inset-x-[5cqw] top-[7.5cqw] z-10 flex items-center gap-[2cqw]">
        <span className="size-[5cqw] rounded-full" style={{ background: accent }} />
        <span className="text-[3.6cqw] font-medium tracking-tight opacity-80">{handle}</span>
      </div>
      {children}
    </div>
  );
}

/* ─── Hero: "Did you know", Paper skin ───────────────────────────────── */
export function HeroScene({ className }: { className?: string }) {
  const skin = skinById("paper");
  const { ink, accent } = skin.palette;
  return (
    <PhoneFrame skin={skin} handle="@ledger.history" loop={7} className={className} label="Example short: a kinetic-type explainer about Roman marching distances">
      <div className="absolute inset-x-[8cqw] top-[22cqw] flex flex-col" style={{ fontFamily: fontStack("EB Garamond") }}>
        <p className="font-mono text-[3.4cqw] uppercase tracking-[0.2em]" style={a("kf-word-in", 0, { color: accent })}>
          Did you know
        </p>
        <p className="mt-[3cqw] text-[10.5cqw] leading-[1.02] tracking-[-0.02em]" style={a("kf-word-in", 0.15)}>
          A Roman legionary marched
        </p>
        <p className="mt-[1cqw] text-[42cqw] italic leading-[0.86] tracking-[-0.04em]" style={a("kf-word-in-later", 0, { color: accent })}>
          20
        </p>
        <p className="text-[9cqw] leading-none tracking-[-0.02em]" style={a("kf-word-in-later", 0.2)}>
          miles a day.
        </p>
      </div>
      <div className="absolute inset-x-[8cqw] bottom-[30cqw] flex h-[7cqw] items-end gap-[1.2cqw]" aria-hidden>
        {Array.from({ length: 20 }).map((_, i) => (
          <span
            key={i}
            className="flex-1 origin-bottom"
            style={a("kf-bar", 1.1 + i * 0.04, { height: `${40 + ((i * 37) % 60)}%`, background: i === 19 ? accent : `${ink}cc` })}
          />
        ))}
      </div>
      <div className="absolute inset-x-[8cqw] bottom-[12cqw] text-center" style={a("kf-fade")}>
        <p className="text-[5.4cqw] font-semibold leading-[1.25]">
          in full kit, with{" "}
          <span className="px-[1cqw]" style={{ background: accent, color: skin.palette.surface }}>
            30 kg
          </span>{" "}
          on his back
        </p>
      </div>
    </PhoneFrame>
  );
}

/* ─── Format scenes ───────────────────────────────────────────────────── */
export const FORMAT_SKIN: Record<string, string> = {
  "did-you-know": "ledger",
  "chart-explains": "paper",
  "x-vs-y": "neon",
  "wish-i-knew": "chalk",
  mythbust: "terminal",
  "headline-reaction": "pastel",
};

const HANDLES: Record<string, string> = {
  "did-you-know": "@weird.biology",
  "chart-explains": "@rent.math",
  "x-vs-y": "@ev.rounds",
  "wish-i-knew": "@first.job",
  mythbust: "@brain.bust",
  "headline-reaction": "@ai.this.week",
};

export function FormatScene({ formatId, className }: { formatId: string; className?: string }) {
  const skin = skinById(FORMAT_SKIN[formatId] ?? "ledger");
  const { bg, surface, ink, accent } = skin.palette;
  const accent2 = skin.palette.accent2 ?? accent;
  const display = fontStack(skin.type.display);
  const handle = HANDLES[formatId] ?? "@channel";

  switch (formatId) {
    case "did-you-know":
      return (
        <PhoneFrame skin={skin} handle={handle} className={className} label="Did You Know format preview">
          <div className="absolute inset-x-[8cqw] top-[24cqw] flex flex-col" style={{ fontFamily: display }}>
            <p className="text-[34cqw] font-semibold leading-[0.8]" style={a("kf-word-in", 0, { color: accent })}>?</p>
            <p className="mt-[6cqw] text-[10cqw] font-medium leading-[1.05] tracking-[-0.03em]" style={a("kf-word-in-late")}>
              An octopus has
            </p>
            <p className="text-[16cqw] font-semibold leading-none tracking-[-0.04em]" style={a("kf-word-in-later", 0, { color: accent })}>
              3 hearts.
            </p>
          </div>
          <div className="absolute inset-x-[8cqw] bottom-[16cqw] flex gap-[4cqw]" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="aspect-square flex-1 rounded-full border-[0.8cqw]" style={a("kf-pulse", i * 0.25, { borderColor: i === 2 ? accent : `${ink}55`, background: i === 2 ? `${accent}22` : surface })} />
            ))}
          </div>
        </PhoneFrame>
      );
    case "chart-explains": {
      const bars = [22, 28, 35, 44, 58, 71, 86];
      return (
        <PhoneFrame skin={skin} handle={handle} className={className} label="This Chart Explains format preview">
          <div className="absolute inset-x-[8cqw] top-[20cqw]" style={{ fontFamily: display }}>
            <p className="text-[9cqw] leading-[1.05] tracking-[-0.02em]" style={a("kf-word-in")}>Rent outran wages by</p>
            <p className="text-[22cqw] italic leading-[0.95] tracking-[-0.04em]" style={a("kf-word-in-late", 0, { color: accent })}>+212%</p>
          </div>
          <div className="absolute inset-x-[8cqw] bottom-[16cqw] top-[62cqw] flex items-end gap-[2.4cqw] border-b-[0.5cqw]" style={{ borderColor: ink }} aria-hidden>
            {bars.map((h, i) => (
              <span key={i} className="flex-1 origin-bottom" style={a("kf-bar", 0.6 + i * 0.12, { height: `${h}%`, background: i === bars.length - 1 ? accent : `${ink}d0` })} />
            ))}
          </div>
          <div className="absolute inset-x-[8cqw] bottom-[9cqw] flex justify-between font-mono text-[3.2cqw] opacity-70">
            <span>1985</span>
            <span>2025</span>
          </div>
        </PhoneFrame>
      );
    }
    case "x-vs-y":
      return (
        <PhoneFrame skin={skin} handle={handle} className={className} label="X vs Y format preview">
          <div className="absolute inset-x-0 bottom-0 top-[16cqw] grid grid-rows-2" style={{ fontFamily: display }}>
            <div className="flex flex-col justify-center px-[8cqw]" style={a("kf-slide-l", 0, { background: `${accent2}26` })}>
              <p className="font-mono text-[3.4cqw] uppercase tracking-[0.2em] opacity-70">Round 2 · range</p>
              <p className="text-[13cqw] font-bold leading-none tracking-[-0.04em]" style={{ color: accent2 }}>Sedan A</p>
              <p className="text-[20cqw] font-bold leading-none tracking-[-0.04em] tabular-nums">512<span className="text-[7cqw]"> km</span></p>
            </div>
            <div className="flex flex-col items-end justify-center px-[8cqw] text-right" style={a("kf-slide-r", 0.1, { background: `${accent}1f` })}>
              <p className="text-[13cqw] font-bold leading-none tracking-[-0.04em]" style={{ color: accent }}>Sedan B</p>
              <p className="text-[20cqw] font-bold leading-none tracking-[-0.04em] tabular-nums">604<span className="text-[7cqw]"> km</span></p>
            </div>
          </div>
          <span
            className="absolute left-1/2 top-[58cqw] grid size-[16cqw] -translate-x-1/2 place-items-center rounded-full text-[6cqw] font-bold"
            style={{ background: bg, border: `0.8cqw solid ${ink}`, fontFamily: display }}
          >
            <span style={a("kf-word-in-later")}>VS</span>
          </span>
        </PhoneFrame>
      );
    case "wish-i-knew": {
      const tips = ["Negotiate the first offer", "Automate one savings rule", "Write down what you shipped"];
      return (
        <PhoneFrame skin={skin} handle={handle} className={className} label="N Things I Wish I Knew format preview">
          <div className="absolute inset-x-[8cqw] top-[20cqw]" style={{ fontFamily: display }}>
            <p className="text-[11cqw] leading-[1.02]" style={a("kf-word-in")}>
              3 things I wish I knew at <span style={{ color: accent }}>22</span>
            </p>
          </div>
          <ol className="absolute inset-x-[8cqw] bottom-[14cqw] flex flex-col gap-[3.5cqw]">
            {tips.map((t, i) => (
              <li key={t} className="flex items-center gap-[3cqw] rounded-[2cqw] p-[3cqw]" style={a("kf-stack-in", 0.4 + i * 0.6, { background: surface })}>
                <span className="grid size-[9cqw] shrink-0 place-items-center rounded-full text-[5cqw] font-semibold" style={{ background: accent, color: bg, fontFamily: display }}>
                  {i + 1}
                </span>
                <span className="text-[4.6cqw] font-medium leading-tight">{t}</span>
              </li>
            ))}
          </ol>
        </PhoneFrame>
      );
    }
    case "mythbust":
      return (
        <PhoneFrame skin={skin} handle={handle} className={className} label="Mythbust format preview">
          <div className="absolute inset-x-[8cqw] top-[22cqw] flex flex-col gap-[4cqw] font-mono">
            <p className="text-[3.6cqw] uppercase tracking-[0.2em] opacity-70">&gt; myth.load()</p>
            <p className="relative w-fit text-[8.4cqw] leading-[1.15]" style={a("kf-word-in")}>
              You only use 10% of your brain
              <span className="absolute inset-x-0 top-1/2 h-[1cqw] origin-left" style={a("kf-strike", 0, { background: accent })} />
            </p>
          </div>
          <p
            className="absolute left-[8cqw] top-[78cqw] -rotate-6 border-[0.8cqw] px-[3cqw] py-[1cqw] font-mono text-[12cqw] font-bold leading-none"
            style={a("kf-word-in-later", 0, { color: accent, borderColor: accent })}
          >
            FALSE
          </p>
          <div className="absolute inset-x-[8cqw] bottom-[12cqw] flex flex-col gap-[1.5cqw] font-mono text-[3.4cqw] opacity-80" style={a("kf-fade")}>
            <span>■ Brain scans: activity across all regions</span>
            <span>■ Source shown on screen</span>
          </div>
        </PhoneFrame>
      );
    case "headline-reaction":
    default: {
      const bullets = ["Cheaper to run locally", "Pressure on paid APIs", "Watch the licence terms"];
      return (
        <PhoneFrame skin={skin} handle={handle} className={className} label="Headline Reaction format preview">
          <div className="absolute inset-x-[7cqw] top-[18cqw] rounded-[3cqw] p-[5cqw] shadow-[0_2cqw_6cqw_-2cqw_rgba(43,33,64,0.25)]" style={a("kf-wipe", 0, { background: surface })}>
            <p className="font-mono text-[3cqw] uppercase tracking-[0.16em]" style={{ color: accent }}>Headline · this week</p>
            <p className="mt-[2cqw] text-[8.6cqw] font-semibold leading-[1.08] tracking-[-0.02em]" style={{ fontFamily: display }}>
              Open model matches the paid ones
            </p>
          </div>
          <p className="absolute left-[7cqw] top-[72cqw] text-[5cqw] font-semibold" style={{ fontFamily: display }}>What it means</p>
          <ul className="absolute inset-x-[7cqw] bottom-[12cqw] flex flex-col gap-[2.5cqw]">
            {bullets.map((b, i) => (
              <li key={b} className="flex items-center gap-[3cqw] text-[4.6cqw] font-medium" style={a("kf-stack-in", 0.6 + i * 0.5)}>
                <span className="size-[3cqw] shrink-0 rounded-full" style={{ background: i === 0 ? accent : accent2 }} />
                {b}
              </li>
            ))}
          </ul>
        </PhoneFrame>
      );
    }
  }
}
