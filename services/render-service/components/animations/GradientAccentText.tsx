import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

// ============================================
// GRADIENT ACCENT TEXT
// Purple→Pink gradient text with scale + opacity entry
// ============================================
interface GradientAccentTextProps {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  delay?: number;
  fromColor?: string;
  toColor?: string;
}

export const GradientAccentText: React.FC<GradientAccentTextProps> = ({
  text,
  fontSize = 64,
  fontFamily = "system-ui, sans-serif",
  fontWeight = 700,
  delay = 0,
  fromColor = "#a855f7",
  toColor = "#ec4899",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);

  const scale = spring({
    frame: f,
    fps,
    from: 0.8,
    to: 1,
    config: { damping: 15, stiffness: 100 },
  });

  const opacity = interpolate(f, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <span
      style={{
        fontSize,
        fontFamily,
        fontWeight,
        display: "inline-block",
        background: `linear-gradient(135deg, ${fromColor}, ${toColor})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {text}
    </span>
  );
};
