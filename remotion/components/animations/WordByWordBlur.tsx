import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

// ============================================
// WORD BY WORD BLUR REVEAL
// Each word fades in with blur + translateY, staggered
// ============================================
interface WordByWordBlurProps {
  words: string[];
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  color?: string;
  delay?: number;
  staggerFrames?: number;
  gradientWordIndices?: number[];
}

export const WordByWordBlur: React.FC<WordByWordBlurProps> = ({
  words,
  fontSize = 48,
  fontFamily = "system-ui, sans-serif",
  fontWeight = 600,
  color = "#ffffff",
  delay = 0,
  staggerFrames = 5,
  gradientWordIndices = [],
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.3em",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {words.map((word, i) => {
        const wordStart = delay + i * staggerFrames;
        const f = Math.max(0, frame - wordStart);

        const opacity = interpolate(f, [0, 15], [0, 1], {
          extrapolateRight: "clamp",
        });
        const blur = interpolate(f, [0, 15], [10, 0], {
          extrapolateRight: "clamp",
        });
        const translateY = interpolate(f, [0, 15], [30, 0], {
          extrapolateRight: "clamp",
        });

        const isGradient = gradientWordIndices.includes(i);

        const wordStyle: React.CSSProperties = {
          fontSize,
          fontFamily,
          fontWeight,
          opacity,
          filter: `blur(${blur}px)`,
          transform: `translateY(${translateY}px)`,
          display: "inline-block",
          color: isGradient ? "transparent" : color,
          ...(isGradient
            ? {
                background: "linear-gradient(135deg, #a855f7, #ec4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }
            : {}),
        };

        return (
          <span key={i} style={wordStyle}>
            {word}
          </span>
        );
      })}
    </div>
  );
};
