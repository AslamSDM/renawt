import * as React from "react";
import type { VisualSkin } from "@remawt/shared";
import { cn } from "@/lib/utils";
import { PhoneFrame } from "@/app/_landing/scenes";
import { fontStack } from "@/app/_landing/fonts";

const RADIUS = { sharp: "0.6cqw", rounded: "3cqw", pill: "999px" } as const;

/**
 * 9:16 still of a kit skin with niche copy. Uses the engine-rendered poster when there is one,
 * otherwise a CSS mock drawn from the skin tokens (fonts need `skinFontVars` on an ancestor).
 */
export function SkinPreview({
  skin,
  headline,
  stat,
  handle,
  posterUrl,
  className,
}: {
  skin: VisualSkin;
  headline: string;
  stat?: string;
  handle: string;
  posterUrl?: string | null;
  className?: string;
}) {
  if (posterUrl) {
    return (
      <div className={cn("phone-frame", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={posterUrl} alt={`${skin.name} skin preview`} className="absolute inset-0 size-full object-cover" />
      </div>
    );
  }
  const { bg, surface, ink, accent, accent2 } = skin.palette;
  const r = RADIUS[skin.shapes];
  const caption = {
    bottom: "bottom-[14cqw] left-[8cqw] right-[8cqw] text-left",
    centered: "bottom-[30cqw] left-[8cqw] right-[8cqw] text-center",
    karaoke: "bottom-[18cqw] left-[8cqw] right-[8cqw] text-center",
    minimal: "bottom-[8cqw] left-[8cqw] right-[8cqw] text-left opacity-70",
  }[skin.captionStyle];

  return (
    <PhoneFrame skin={skin} handle={handle} label={`${skin.name} skin preview: ${headline}`} className={className}>
      {skin.grain && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-multiply"
          style={{ backgroundImage: `radial-gradient(${ink} 0.5px, transparent 0.6px)`, backgroundSize: "1.4cqw 1.4cqw" }}
        />
      )}
      <div className="absolute inset-x-[8cqw] top-[22cqw] flex flex-col gap-[4cqw]">
        <span className="h-[1cqw] w-[14cqw]" style={{ background: accent, borderRadius: r }} />
        <p className="text-[9cqw] font-medium leading-[1.02] tracking-[-0.03em]" style={{ fontFamily: fontStack(skin.type.display), color: ink }}>
          {headline}
        </p>
      </div>
      <div
        className="absolute inset-x-[8cqw] top-[96cqw] flex items-end justify-between gap-[3cqw] p-[4cqw]"
        style={{ background: surface, borderRadius: r, border: `1px solid ${ink}1f` }}
      >
        <div className="flex flex-col gap-[1cqw]">
          <span className="text-[3cqw] uppercase tracking-[0.16em] opacity-60" style={{ fontFamily: fontStack(skin.type.mono ?? skin.type.body) }}>
            Example data
          </span>
          <span className="text-[11cqw] font-medium leading-none tabular-nums" style={{ fontFamily: fontStack(skin.type.display), color: accent }}>
            {stat ?? "73%"}
          </span>
        </div>
        <div className="flex h-[14cqw] items-end gap-[1.4cqw]" aria-hidden>
          {[40, 62, 48, 86, 100].map((h, i) => (
            <span key={i} className="w-[3.2cqw]" style={{ height: `${h}%`, background: i === 4 ? (accent2 ?? accent) : `${ink}40`, borderRadius: r }} />
          ))}
        </div>
      </div>
      <p
        className={cn("absolute text-[4.4cqw] font-medium leading-snug", caption)}
        style={{ fontFamily: fontStack(skin.type.body), color: skin.captionStyle === "karaoke" ? ink : ink }}
      >
        {skin.captionStyle === "karaoke" ? (
          <>
            most people <span style={{ background: accent, color: bg, borderRadius: r }} className="px-[1cqw]">never</span> notice
          </>
        ) : (
          "most people never notice this"
        )}
      </p>
      <div className="absolute inset-0 -z-10" style={{ background: bg }} aria-hidden />
    </PhoneFrame>
  );
}
