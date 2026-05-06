// AUTO-GENERATED — do not edit by hand. See scripts/generate-registry.mjs.
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
} from "remotion";
import { applyAnim } from "./_helpers";

export function BulletList({ items, color = "#fff", bulletColor = "#a78bfa", size = 40, gap = 20, x = "12%", y = "50%", stagger = 8, delay = 0 }: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: x, top: y, transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap }}>
        {items.map((it, i) => {
          const local = Math.max(0, frame - delay - i * stagger);
          const a = applyAnim("slide-up", local, fps);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, color, fontSize: size, fontFamily: "Inter, sans-serif", opacity: a.opacity, transform: a.transform }}>
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: "50%", backgroundColor: bulletColor }} />
              <span>{it}</span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
