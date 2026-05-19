import React from "react";
import {
  useCurrentFrame,
  interpolate,
  AbsoluteFill,
} from "remotion";

// ============================================
// AURORA BACKGROUND (Demo Style)
// Purple/pink aurora gradient - dark & light variants
// ============================================
interface AuroraBackgroundNewProps {
  variant?: "dark" | "light";
  fadeIn?: boolean;
}

export const AuroraBackgroundNew: React.FC<AuroraBackgroundNewProps> = ({
  variant = "dark",
  fadeIn = false,
}) => {
  const frame = useCurrentFrame();

  const opacity = fadeIn
    ? interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" })
    : 1;

  if (variant === "light") {
    return (
      <AbsoluteFill
        style={{
          opacity,
          background: `
            radial-gradient(ellipse at 30% 30%, rgba(168, 85, 247, 0.2) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 70%, rgba(236, 72, 153, 0.2) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 60%),
            linear-gradient(135deg, #faf5ff 0%, #fff5f8 50%, #f5f0ff 100%)
          `,
        }}
      />
    );
  }

  // Dark variant
  return (
    <AbsoluteFill
      style={{
        opacity,
        background: `
          radial-gradient(ellipse at 20% 20%, rgba(168, 85, 247, 0.3) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 80%, rgba(236, 72, 153, 0.3) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.2) 0%, transparent 70%),
          #0a0a0f
        `,
      }}
    />
  );
};
