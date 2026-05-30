/**
 * Jitter built-in component library.
 *
 * Each component fills its layer box (width: 100%, height: 100%) and is purely
 * presentational — Jitter operations on the parent layer drive entrance/exit.
 * Time-based EFFECTS (typewriter, cursor click, drifting gradient) use their own
 * useCurrentFrame() so they animate during the layer's visible window.
 */

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  staticFile,
} from "remotion";
import { resolveFontFamily } from "../fonts/jitterFonts";

const FILL: React.CSSProperties = {
  width: "100%",
  height: "100%",
  position: "relative",
  overflow: "hidden",
};

function resolveImg(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("data:")) return url;
  return staticFile(url.replace(/^\//, ""));
}

/** Remotion <Img> that hides itself instead of cancelling the whole render
 *  when a single asset (e.g. a dead R2 url) fails to load. */
function SafeImg({ src, style, ...rest }: React.ComponentProps<typeof Img>) {
  return (
    <Img
      src={src}
      style={style}
      onError={(e) => {
        console.warn(`[Jitter] image failed to load: ${String(src)}`);
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
      {...rest}
    />
  );
}

// ---------- Mockups ----------

export function BrowserMockup({
  url = "yoursite.com",
  screenshot,
  contentColor = "#0b1020",
  cornerRadius = 14,
  theme = "dark",
}: any) {
  const isDark = theme === "dark";
  const chrome = isDark ? "#1f2937" : "#f5f5f7";
  const chromeUrlBg = isDark ? "#111827" : "#ffffff";
  const chromeUrlText = isDark ? "#9ca3af" : "#6b7280";
  return (
    <div
      style={{
        ...FILL,
        borderRadius: cornerRadius,
        backgroundColor: chrome,
        boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
        border: isDark ? "1px solid #2a2f3a" : "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          height: 44,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 8,
          borderBottom: isDark ? "1px solid #2a2f3a" : "1px solid #e5e7eb",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: ["#ff5f57", "#febc2e", "#28c840"][i],
            }}
          />
        ))}
        <div
          style={{
            marginLeft: 16,
            padding: "6px 16px",
            borderRadius: 8,
            backgroundColor: chromeUrlBg,
            color: chromeUrlText,
            fontSize: 14,
            fontFamily: "ui-monospace, monospace",
            flex: 1,
            textAlign: "center",
          }}
        >
          {url}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: 44,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: contentColor,
        }}
      >
        {screenshot ? (
          <SafeImg
            src={resolveImg(screenshot)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function MacMockup({
  screenshot,
  bezelColor = "#1c1c1e",
  screenColor = "#000000",
}: any) {
  return (
    <div
      style={{
        ...FILL,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Screen */}
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 10",
          backgroundColor: bezelColor,
          borderRadius: 18,
          padding: 18,
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          position: "relative",
        }}
      >
        {/* Camera notch */}
        <div
          style={{
            position: "absolute",
            top: 6,
            left: "50%",
            transform: "translateX(-50%)",
            width: 8,
            height: 8,
            borderRadius: 999,
            background: "#111",
            border: "1px solid #333",
          }}
        />
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: screenColor,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          {screenshot ? (
            <SafeImg
              src={resolveImg(screenshot)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </div>
      </div>
      {/* Hinge / base */}
      <div
        style={{
          width: "104%",
          height: 16,
          background: "linear-gradient(180deg, #2a2a2c 0%, #0e0e0f 100%)",
          borderRadius: "0 0 14px 14px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        }}
      />
      <div
        style={{
          width: "20%",
          height: 6,
          background: "#1a1a1c",
          borderRadius: "0 0 12px 12px",
        }}
      />
    </div>
  );
}

export function PhoneMockup({
  screenshot,
  bezelColor = "#0a0a0a",
  screenColor = "#111",
}: any) {
  return (
    <div style={{ ...FILL, display: "flex", justifyContent: "center" }}>
      <div
        style={{
          height: "100%",
          aspectRatio: "9 / 19.5",
          backgroundColor: bezelColor,
          borderRadius: 56,
          padding: 12,
          boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
          border: "2px solid #2a2a2a",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 18,
            left: "50%",
            transform: "translateX(-50%)",
            width: 100,
            height: 26,
            backgroundColor: "#000",
            borderRadius: 999,
            zIndex: 2,
          }}
        />
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 44,
            overflow: "hidden",
            backgroundColor: screenColor,
          }}
        >
          {screenshot ? (
            <SafeImg
              src={resolveImg(screenshot)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------- Cursor + Click ----------

export function CursorClick({
  fromX = 10,
  fromY = 90,
  toX = 50,
  toY = 50,
  clickAt = 0.7, // fraction of layer life (0..1)
  color = "#111",
  size = 32,
}: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lifeFrames = fps * 2.5; // assume 2.5s window
  const t = Math.max(0, Math.min(1, frame / lifeFrames));
  const moveT = Math.min(1, t / Math.max(0.001, clickAt));
  const ease = (x: number) => 1 - Math.pow(1 - x, 3);
  const ex = ease(moveT);
  const x = fromX + (toX - fromX) * ex;
  const y = fromY + (toY - fromY) * ex;
  const clickProgress = Math.max(0, Math.min(1, (t - clickAt) / 0.18));
  const rippleSize = interpolate(clickProgress, [0, 1], [0, 120], {
    extrapolateRight: "clamp",
  });
  const rippleOpacity = interpolate(clickProgress, [0, 1], [0.6, 0], {
    extrapolateRight: "clamp",
  });
  const cursorPressed = clickProgress > 0 && clickProgress < 0.5;
  return (
    <div style={FILL}>
      {/* Ripple */}
      <div
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          transform: "translate(-50%, -50%)",
          width: rippleSize,
          height: rippleSize,
          borderRadius: "50%",
          border: `3px solid ${color}`,
          opacity: rippleOpacity,
          pointerEvents: "none",
        }}
      />
      {/* Cursor SVG */}
      <svg
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${y}%`,
          width: size,
          height: size,
          transform: `translate(-10%, -10%) scale(${cursorPressed ? 0.85 : 1})`,
          filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.25))",
        }}
      >
        <path
          d="M3 2 L21 12 L12 13 L13 21 L3 2 Z"
          fill={color}
          stroke="white"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

// ---------- Text effects ----------

export function Typewriter({
  text = "Hello",
  cps = 22, // characters per second
  cursor = true,
  cursorColor = "#111",
  fontFamily,
  fontSize = 56,
  fontWeight = 600,
  color = "#111",
  textAlign = "left",
}: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const charsToShow = Math.min(
    text.length,
    Math.floor((frame / fps) * cps),
  );
  const visible = text.slice(0, charsToShow);
  const blink = Math.floor((frame / fps) * 2) % 2 === 0;
  return (
    <div
      style={{
        ...FILL,
        display: "flex",
        alignItems: "center",
        justifyContent:
          textAlign === "center"
            ? "center"
            : textAlign === "right"
              ? "flex-end"
              : "flex-start",
        fontFamily: resolveFontFamily(fontFamily),
        fontSize,
        fontWeight,
        color,
        lineHeight: 1.1,
      }}
    >
      <span>
        {visible}
        {cursor ? (
          <span
            style={{
              display: "inline-block",
              width: "0.55em",
              height: "1em",
              marginLeft: 4,
              verticalAlign: "-0.1em",
              backgroundColor: cursorColor,
              opacity: blink ? 1 : 0,
            }}
          />
        ) : null}
      </span>
    </div>
  );
}

export function GradientText({
  text = "",
  from = "#ff2d95",
  to = "#7c3aed",
  angle = 135,
  fontFamily,
  fontSize = 120,
  fontWeight = 800,
  textAlign = "center",
  letterSpacing = -2,
  lineHeight = 1.0,
}: any) {
  return (
    <div
      style={{
        ...FILL,
        display: "flex",
        alignItems: "center",
        justifyContent:
          textAlign === "center"
            ? "center"
            : textAlign === "right"
              ? "flex-end"
              : "flex-start",
      }}
    >
      <span
        style={{
          fontFamily: resolveFontFamily(fontFamily),
          fontWeight,
          fontSize,
          letterSpacing,
          lineHeight,
          background: `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          color: "transparent",
          textAlign,
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </span>
    </div>
  );
}

// ---------- Cards / surfaces ----------

export function GlassCard({
  fillColor = "rgba(255,255,255,0.08)",
  borderColor = "rgba(255,255,255,0.18)",
  cornerRadius = 24,
  blur = 24,
}: any) {
  return (
    <div
      style={{
        ...FILL,
        backgroundColor: fillColor,
        backdropFilter: `blur(${blur}px) saturate(160%)`,
        WebkitBackdropFilter: `blur(${blur}px) saturate(160%)`,
        border: `1px solid ${borderColor}`,
        borderRadius: cornerRadius,
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
      }}
    />
  );
}

export function GlowHalo({
  color = "#7c3aed",
  intensity = 0.55,
  size = 1.1,
}: any) {
  return (
    <div style={FILL}>
      <div
        style={{
          position: "absolute",
          inset: `${(1 - size) * 50}%`,
          background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
          opacity: intensity,
          filter: "blur(40px)",
        }}
      />
    </div>
  );
}

export function AnimatedGradient({
  colors = ["#0b1020", "#1e1b4b", "#0b1020"],
  angle = 135,
  speed = 1, // cycles per video
}: any) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = (frame / Math.max(1, durationInFrames)) * speed;
  const shift = (Math.sin(t * Math.PI * 2) + 1) / 2; // 0..1
  const stop1 = `${Math.round(shift * 40)}%`;
  const stop2 = `${60 + Math.round(shift * 30)}%`;
  const css = `linear-gradient(${angle}deg, ${colors[0]} 0%, ${colors[1] ?? colors[0]} ${stop1}, ${colors[2] ?? colors[0]} ${stop2}, ${colors[0]} 100%)`;
  return (
    <div
      style={{
        ...FILL,
        background: css,
      }}
    />
  );
}

export function BlurredBlob({
  color = "#7c3aed",
  size = 1.0,
  opacity = 0.5,
  driftX = 80,
  driftY = 60,
}: any) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = (frame / Math.max(1, durationInFrames)) * Math.PI * 2;
  const dx = Math.sin(t) * driftX;
  const dy = Math.cos(t * 1.3) * driftY;
  return (
    <div style={FILL}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: `${100 * size}%`,
          height: `${100 * size}%`,
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`,
          background: `radial-gradient(circle, ${color} 0%, transparent 60%)`,
          opacity,
          filter: "blur(60px)",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
}

// ---------- Lines & particles ----------

export function MotionLines({
  color = "#111",
  strokeWidth = 2,
  orientation = "horizontal",
}: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.min(1, frame / (fps * 0.6));
  const scale = 1 - Math.pow(1 - t, 3);
  const horizontal = orientation === "horizontal";
  return (
    <div
      style={{
        ...FILL,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          backgroundColor: color,
          height: horizontal ? strokeWidth : "100%",
          width: horizontal ? "100%" : strokeWidth,
          transform: horizontal ? `scaleX(${scale})` : `scaleY(${scale})`,
          transformOrigin: horizontal ? "left center" : "center top",
        }}
      />
    </div>
  );
}

export function FloatingDots({
  count = 18,
  color = "rgba(255,255,255,0.5)",
  size = 5,
}: any) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const dots = Array.from({ length: count }, (_, i) => {
    const seed = (i * 9301 + 49297) % 233280;
    const px = (seed % 100) / 100;
    const py = ((seed * 7) % 100) / 100;
    const speed = 0.4 + ((seed % 50) / 50) * 0.8;
    const t = (frame / Math.max(1, durationInFrames)) * Math.PI * 2 * speed;
    const dx = Math.sin(t + i) * 12;
    const dy = Math.cos(t * 1.3 + i) * 10;
    return { px, py, dx, dy, seed };
  });
  return (
    <div style={FILL}>
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${d.px * 100}%`,
            top: `${d.py * 100}%`,
            width: size,
            height: size,
            borderRadius: "50%",
            background: color,
            transform: `translate(${d.dx}px, ${d.dy}px)`,
          }}
        />
      ))}
    </div>
  );
}

// ---------- Code + counters + bars ----------

export function CodeBlock({
  code = "console.log('hello')",
  typewriter = true,
  cps = 28,
  background = "#0a0a0a",
  color = "#e4e4e7",
  accent = "#a78bfa",
  fontSize = 22,
  cornerRadius = 14,
  padding = 24,
}: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const charsToShow = typewriter
    ? Math.min(code.length, Math.floor((frame / fps) * cps))
    : code.length;
  const visible = code.slice(0, charsToShow);
  return (
    <div
      style={{
        ...FILL,
        background,
        color,
        borderRadius: cornerRadius,
        padding,
        fontFamily: "ui-monospace, 'JetBrains Mono', monospace",
        fontSize,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
        borderTop: `2px solid ${accent}`,
      }}
    >
      <div style={{ marginBottom: 12, display: "flex", gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: ["#ff5f57", "#febc2e", "#28c840"][i],
            }}
          />
        ))}
      </div>
      <pre style={{ margin: 0, fontFamily: "inherit" }}>{visible}</pre>
    </div>
  );
}

export function NumberCounter({
  from = 0,
  to = 100,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1500, // ms
  fontFamily,
  fontSize = 140,
  fontWeight = 800,
  color = "#111",
  textAlign = "center",
}: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.min(1, frame / ((duration / 1000) * fps));
  const ease = 1 - Math.pow(1 - t, 3);
  const value = from + (to - from) * ease;
  const display = `${prefix}${value.toFixed(decimals)}${suffix}`;
  return (
    <div
      style={{
        ...FILL,
        display: "flex",
        alignItems: "center",
        justifyContent:
          textAlign === "center"
            ? "center"
            : textAlign === "right"
              ? "flex-end"
              : "flex-start",
        fontFamily: resolveFontFamily(fontFamily),
        fontWeight,
        fontSize,
        color,
        lineHeight: 1,
      }}
    >
      {display}
    </div>
  );
}

export function ProgressBar({
  to = 100,
  duration = 1500, // ms
  trackColor = "rgba(255,255,255,0.15)",
  fillColor = "#7c3aed",
  height = 14,
  cornerRadius = 999,
}: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.min(1, frame / ((duration / 1000) * fps));
  const ease = 1 - Math.pow(1 - t, 3);
  const pct = (to / 100) * ease * 100;
  return (
    <div
      style={{
        ...FILL,
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          height,
          background: trackColor,
          borderRadius: cornerRadius,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: fillColor,
            borderRadius: cornerRadius,
          }}
        />
      </div>
    </div>
  );
}

// ---------- Beat-synced effects ----------

/**
 * Beat-driven INVERT HOLD overlay. Place as the LAST (top-most) full-bleed
 * layer of an artboard. On each listed beat it fades in a `mix-blend-mode:
 * difference` plane (which inverts what's below) for `holdBeats` beats, then
 * fades out. The opposite of a strobe — a sustained, deliberate color flip.
 *
 * beats[] are integer beat indices counted from the ARTBOARD START. Use
 * sparingly — 1-2 hits per scene. Skip 0 (intros stay clean).
 */
export function BeatInvert({
  bpm = 124,
  beats = [8, 24],
  holdBeats = 1,
  fadeBeats = 0.25,
  color = "#ffffff",
  blend = "difference",
}: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beatMs = 60000 / bpm;
  const tMs = (frame / fps) * 1000;

  const fadeMs = fadeBeats * beatMs;
  const holdMs = holdBeats * beatMs;
  let opacity = 0;
  for (const b of beats) {
    const startMs = b * beatMs;
    const fadeOutStart = startMs + holdMs;
    const endMs = fadeOutStart + fadeMs;
    if (tMs < startMs || tMs >= endMs) continue;
    let k: number;
    if (tMs < startMs + fadeMs) {
      k = (tMs - startMs) / fadeMs; // ease-in
    } else if (tMs >= fadeOutStart) {
      k = 1 - (tMs - fadeOutStart) / fadeMs; // ease-out
    } else {
      k = 1;
    }
    opacity = Math.max(opacity, k);
  }
  if (opacity <= 0.001) return null;
  return (
    <div
      style={{
        ...FILL,
        backgroundColor: color,
        mixBlendMode: blend as any,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * Sustained color theme swap synced to beats. Acts as the SCENE BACKGROUND.
 * On each listed beat the bg crossfades from `fromColor` to `toColor` (or
 * vice versa), holding until the next listed beat. No strobing — every state
 * lasts at least `minHoldBeats` beats, and transitions cross-fade smoothly.
 *
 * Pair with text layers that use the OTHER color so the contrast flips
 * visibly when the bg swaps.
 */
export function BeatColorSwap({
  bpm = 124,
  beats = [8, 16, 24],
  fromColor = "#0b1020",
  toColor = "#ffffff",
  fadeBeats = 0.5,
  minHoldBeats = 4,
}: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beatMs = 60000 / bpm;
  const tMs = (frame / fps) * 1000;
  const fadeMs = fadeBeats * beatMs;
  const holdMs = minHoldBeats * beatMs;

  // Determine current state by counting how many flip beats have passed
  // (each flip toggles the swap state).
  let state = 0;
  let lastFlipMs = -Infinity;
  for (const b of beats) {
    const flipMs = b * beatMs;
    // Reject flips closer than minHold to avoid stutter.
    if (tMs >= flipMs && flipMs - lastFlipMs >= holdMs) {
      state = 1 - state;
      lastFlipMs = flipMs;
    }
  }

  const sinceFlip = tMs - lastFlipMs;
  const k = isFinite(sinceFlip) ? Math.min(1, sinceFlip / fadeMs) : 1;
  const easedK = 1 - Math.pow(1 - k, 3); // ease-out

  const baseColor = state === 0 ? fromColor : toColor;
  const prevColor = state === 0 ? toColor : fromColor;
  return (
    <div style={{ ...FILL, backgroundColor: prevColor }}>
      <div style={{ ...FILL, backgroundColor: baseColor, opacity: easedK }} />
    </div>
  );
}

/**
 * Sustained TEXT color swap that mirrors BeatColorSwap. Place as a child
 * layer or use the same `beats[]` so the text color flips on the same beats
 * as the bg — preserving contrast through both states.
 *
 * Renders the supplied `text` filling its layer box. Use this INSTEAD of
 * a normal text layer when you want the text color to invert with the bg.
 */
export function BeatTextSwap({
  bpm = 124,
  beats = [8, 16, 24],
  text = "",
  fromColor = "#ffffff",
  toColor = "#0b1020",
  fadeBeats = 0.5,
  minHoldBeats = 4,
  fontFamily,
  fontSize = 96,
  fontWeight = 800,
  textAlign = "center",
  letterSpacing = -1,
  lineHeight = 1.05,
}: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beatMs = 60000 / bpm;
  const tMs = (frame / fps) * 1000;
  const fadeMs = fadeBeats * beatMs;
  const holdMs = minHoldBeats * beatMs;

  let state = 0;
  let lastFlipMs = -Infinity;
  for (const b of beats) {
    const flipMs = b * beatMs;
    if (tMs >= flipMs && flipMs - lastFlipMs >= holdMs) {
      state = 1 - state;
      lastFlipMs = flipMs;
    }
  }
  const sinceFlip = tMs - lastFlipMs;
  const k = isFinite(sinceFlip) ? Math.min(1, sinceFlip / fadeMs) : 1;
  const easedK = 1 - Math.pow(1 - k, 3);

  // Crossfade two stacked spans so the color blends, not a pop.
  const baseColor = state === 0 ? fromColor : toColor;
  const prevColor = state === 0 ? toColor : fromColor;
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent:
      textAlign === "center"
        ? "center"
        : textAlign === "right"
          ? "flex-end"
          : "flex-start",
    fontFamily: resolveFontFamily(fontFamily),
    fontSize,
    fontWeight,
    letterSpacing,
    lineHeight,
    textAlign,
    whiteSpace: "pre-wrap",
  };
  return (
    <div style={FILL}>
      <div style={{ ...baseStyle, color: prevColor }}>{text}</div>
      <div style={{ ...baseStyle, color: baseColor, opacity: easedK }}>
        {text}
      </div>
    </div>
  );
}

// ---------- Abstract backgrounds (must be FIRST layer of scene, full-bleed) ----------

export function DotGrid({
  color = "rgba(255,255,255,0.16)",
  background = "transparent",
  spacing = 28,
  dotSize = 2,
  drift = true,
}: any) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = drift ? (frame / Math.max(1, durationInFrames)) * Math.PI * 2 : 0;
  const dx = Math.sin(t) * 8;
  const dy = Math.cos(t * 0.8) * 6;
  return (
    <div style={{ ...FILL, background }}>
      <div
        style={{
          position: "absolute",
          inset: -spacing * 2,
          backgroundImage: `radial-gradient(${color} ${dotSize}px, transparent ${dotSize + 0.5}px)`,
          backgroundSize: `${spacing}px ${spacing}px`,
          transform: `translate(${dx}px, ${dy}px)`,
          maskImage:
            "radial-gradient(circle at 50% 50%, #000 35%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 50%, #000 35%, transparent 85%)",
        }}
      />
    </div>
  );
}

export function LineGrid({
  color = "rgba(255,255,255,0.08)",
  background = "transparent",
  spacing = 80,
  lineWidth = 1,
  perspective = false,
}: any) {
  const lines: React.CSSProperties = {
    position: "absolute",
    inset: -spacing * 2,
    backgroundImage: `
      linear-gradient(to right, ${color} ${lineWidth}px, transparent ${lineWidth}px),
      linear-gradient(to bottom, ${color} ${lineWidth}px, transparent ${lineWidth}px)
    `,
    backgroundSize: `${spacing}px ${spacing}px`,
    transformOrigin: "50% 50%",
    transform: perspective ? "perspective(1200px) rotateX(55deg)" : "none",
    maskImage:
      "radial-gradient(circle at 50% 50%, #000 30%, transparent 90%)",
    WebkitMaskImage:
      "radial-gradient(circle at 50% 50%, #000 30%, transparent 90%)",
  };
  return (
    <div style={{ ...FILL, background }}>
      <div style={lines} />
    </div>
  );
}

export function MeshGradient({
  colors = ["#1e1b4b", "#831843", "#0f172a", "#22d3ee"],
  speed = 1,
  blur = 80,
}: any) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = (frame / Math.max(1, durationInFrames)) * Math.PI * 2 * speed;
  const palette = colors.length >= 4 ? colors : [...colors, "#0a0a0a", "#1e293b", "#22d3ee"].slice(0, 4);
  const blobs = palette.slice(0, 4).map((c: string, i: number) => {
    const phase = (i * Math.PI) / 2;
    const x = 50 + Math.sin(t + phase) * 30;
    const y = 50 + Math.cos(t * 0.9 + phase) * 28;
    return { c, x, y };
  });
  return (
    <div
      style={{
        ...FILL,
        background: palette[0],
        filter: `blur(${blur}px)`,
      }}
    >
      {blobs.map((b: any, i: number) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${b.x}%`,
            top: `${b.y}%`,
            width: "70%",
            height: "70%",
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, ${b.c} 0%, transparent 70%)`,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

export function NoiseField({
  color = "rgba(255,255,255,0.05)",
  background = "transparent",
  density = 200,
  size = 1.2,
}: any) {
  const dots = React.useMemo(() => {
    return Array.from({ length: density }, (_, i) => {
      const s = (i * 9301 + 49297) % 233280;
      return {
        x: (s % 1000) / 10,
        y: ((s * 7) % 1000) / 10,
        a: 0.2 + ((s % 100) / 100) * 0.8,
      };
    });
  }, [density]);
  return (
    <div style={{ ...FILL, background }}>
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: size,
            height: size,
            background: color,
            opacity: d.a,
            borderRadius: "50%",
          }}
        />
      ))}
    </div>
  );
}

export function AbstractBackdrop({
  baseColor = "#0a0a0a",
  blobs = ["#4f46e5", "#0ea5e9", "#ec4899"],
  showGrid = true,
  gridColor = "rgba(255,255,255,0.06)",
  noise = true,
}: any) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = (frame / Math.max(1, durationInFrames)) * Math.PI * 2;
  return (
    <div style={{ ...FILL, background: baseColor }}>
      {blobs.map((c: string, i: number) => {
        const phase = (i * Math.PI * 2) / blobs.length;
        const x = 50 + Math.sin(t + phase) * 28;
        const y = 50 + Math.cos(t * 1.1 + phase) * 22;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: "55%",
              height: "55%",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${c} 0%, transparent 60%)`,
              opacity: 0.55,
              filter: "blur(70px)",
              mixBlendMode: "screen",
            }}
          />
        );
      })}
      {showGrid && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(to right, ${gridColor} 1px, transparent 1px),
              linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
            maskImage:
              "radial-gradient(circle at 50% 50%, #000 30%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(circle at 50% 50%, #000 30%, transparent 90%)",
          }}
        />
      )}
      {noise && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.12,
            mixBlendMode: "overlay",
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />
      )}
    </div>
  );
}

/**
 * TemplateBackdrop — recolored backdrop driven by a registry template id.
 * The template id seeds a deterministic visual variation (5 styles), and
 * the palette comes from the actual scraped jitter.video bg template
 * (`generate-server/data/jitter-templates/raw/<id>.json`) blended with the
 * brand palette so the bg matches the product page's mood.
 */
export function TemplateBackdrop({
  palette = ["#0a0a0a", "#4f46e5", "#0ea5e9", "#ec4899"],
  variant = "blobs",
  intensity = 0.8,
  showGrid = true,
  gridColor = "rgba(255,255,255,0.06)",
}: any) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = (frame / Math.max(1, durationInFrames)) * Math.PI * 2;
  const base = palette[0] ?? "#0a0a0a";
  const accents = palette.slice(1, 5);
  while (accents.length < 3) accents.push("#22d3ee");

  if (variant === "grid") {
    return (
      <div style={{ ...FILL, background: base }}>
        <div
          style={{
            position: "absolute",
            inset: -120,
            backgroundImage: `
              linear-gradient(to right, ${gridColor} 1px, transparent 1px),
              linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
            transform: `perspective(1400px) rotateX(58deg) translateY(${Math.sin(t) * 20}px)`,
            transformOrigin: "50% 50%",
            maskImage:
              "radial-gradient(circle at 50% 45%, #000 30%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(circle at 50% 45%, #000 30%, transparent 90%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "55%",
            height: "55%",
            transform: `translate(-50%, -50%)`,
            background: `radial-gradient(circle, ${accents[0]} 0%, transparent 65%)`,
            opacity: intensity * 0.45,
            filter: "blur(80px)",
            mixBlendMode: "screen",
          }}
        />
      </div>
    );
  }

  if (variant === "dots") {
    return (
      <div style={{ ...FILL, background: base }}>
        <div
          style={{
            position: "absolute",
            inset: -60,
            backgroundImage: `radial-gradient(${gridColor} 2px, transparent 2.5px)`,
            backgroundSize: "28px 28px",
            transform: `translate(${Math.sin(t) * 10}px, ${Math.cos(t * 0.8) * 8}px)`,
            maskImage:
              "radial-gradient(circle at 50% 50%, #000 35%, transparent 85%)",
            WebkitMaskImage:
              "radial-gradient(circle at 50% 50%, #000 35%, transparent 85%)",
          }}
        />
        {accents.slice(0, 2).map((c: string, i: number) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${30 + i * 40 + Math.sin(t + i) * 8}%`,
              top: `${40 + Math.cos(t + i) * 10}%`,
              width: "45%",
              height: "45%",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${c} 0%, transparent 60%)`,
              opacity: intensity * 0.55,
              filter: "blur(75px)",
              mixBlendMode: "screen",
            }}
          />
        ))}
      </div>
    );
  }

  if (variant === "lines") {
    return (
      <div style={{ ...FILL, background: base }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `repeating-linear-gradient(
              ${45 + Math.sin(t) * 5}deg,
              ${gridColor} 0px,
              ${gridColor} 1px,
              transparent 1px,
              transparent 24px
            )`,
            maskImage:
              "radial-gradient(circle at 50% 50%, #000 30%, transparent 95%)",
            WebkitMaskImage:
              "radial-gradient(circle at 50% 50%, #000 30%, transparent 95%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "70%",
            top: "30%",
            width: "60%",
            height: "60%",
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, ${accents[0]} 0%, transparent 65%)`,
            opacity: intensity * 0.5,
            filter: "blur(80px)",
            mixBlendMode: "screen",
          }}
        />
      </div>
    );
  }

  if (variant === "mesh") {
    return (
      <div style={{ ...FILL, background: base }}>
        {accents.slice(0, 4).map((c: string, i: number) => {
          const phase = (i * Math.PI) / 2;
          const x = 50 + Math.sin(t + phase) * 30;
          const y = 50 + Math.cos(t * 0.9 + phase) * 28;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: "65%",
                height: "65%",
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(circle, ${c} 0%, transparent 65%)`,
                opacity: intensity * 0.55,
                filter: "blur(90px)",
                mixBlendMode: "screen",
              }}
            />
          );
        })}
      </div>
    );
  }

  // default: "blobs" — abstract drifting color blobs with optional grid overlay
  return (
    <div style={{ ...FILL, background: base }}>
      {accents.slice(0, 3).map((c: string, i: number) => {
        const phase = (i * Math.PI * 2) / 3;
        const x = 50 + Math.sin(t + phase) * 28;
        const y = 50 + Math.cos(t * 1.1 + phase) * 22;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: "55%",
              height: "55%",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${c} 0%, transparent 60%)`,
              opacity: intensity * 0.55,
              filter: "blur(70px)",
              mixBlendMode: "screen",
            }}
          />
        );
      })}
      {showGrid && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(to right, ${gridColor} 1px, transparent 1px),
              linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
            maskImage:
              "radial-gradient(circle at 50% 50%, #000 30%, transparent 90%)",
            WebkitMaskImage:
              "radial-gradient(circle at 50% 50%, #000 30%, transparent 90%)",
          }}
        />
      )}
    </div>
  );
}

/**
 * ScreenshotShowcase — staged web-screen reveal in the style of the jitter.video
 * "Animated web screens" showreel. Stacks up to 3 screenshots with staggered
 * entry: each screen tilts in from the side, settles into a slightly rotated
 * stack, then a subtle drift. Uses the layer's full box.
 *
 * Pass `screenshots: [url, url, url]` (1-3). Single-screen mode is supported.
 */
export function ScreenshotShowcase({
  screenshots = [],
  bezelColor = "#111",
  cornerRadius = 18,
  tilt = 6,
  stagger = 12,
  background = "transparent",
}: any) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const list: string[] = Array.isArray(screenshots)
    ? screenshots.filter(Boolean).slice(0, 3)
    : [];
  if (list.length === 0) {
    return <div style={{ ...FILL, background }} />;
  }
  return (
    <div
      style={{
        ...FILL,
        background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: "1800px",
      }}
    >
      {list.map((src, i) => {
        const order = list.length - 1 - i; // back-most enters first
        const startFrame = order * stagger;
        const t = Math.max(0, Math.min(1, (frame - startFrame) / (fps * 0.6)));
        const eased = 1 - Math.pow(1 - t, 3);
        const offsetX = (i - (list.length - 1) / 2) * 80;
        const offsetY = (i - (list.length - 1) / 2) * 24;
        const rot = (i - (list.length - 1) / 2) * tilt;
        const enterTranslate = (1 - eased) * 160;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              width: "72%",
              height: "78%",
              borderRadius: cornerRadius,
              overflow: "hidden",
              background: bezelColor,
              boxShadow: "0 40px 100px rgba(0,0,0,0.45), 0 8px 20px rgba(0,0,0,0.25)",
              transform: `
                translate(${offsetX}px, ${offsetY}px)
                translateY(${enterTranslate}px)
                rotate(${rot * eased}deg)
                scale(${0.92 + 0.08 * eased})
              `,
              opacity: eased,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <SafeImg
              src={resolveImg(src)}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ---------- Registry export ----------

export const JITTER_BUILTINS: Record<string, React.ComponentType<any>> = {
  BrowserMockup,
  MacMockup,
  PhoneMockup,
  CursorClick,
  Typewriter,
  GradientText,
  GlassCard,
  GlowHalo,
  AnimatedGradient,
  BlurredBlob,
  MotionLines,
  FloatingDots,
  CodeBlock,
  NumberCounter,
  ProgressBar,
  BeatInvert,
  BeatColorSwap,
  BeatTextSwap,
  DotGrid,
  LineGrid,
  MeshGradient,
  NoiseField,
  AbstractBackdrop,
  TemplateBackdrop,
  ScreenshotShowcase,
};

export const BUILTIN_NAMES = Object.keys(JITTER_BUILTINS);
