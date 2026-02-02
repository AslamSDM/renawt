import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from "remotion";

// ============================================
// GLASSMORPHIC CARD
// Frosted glass effect with blur and glow
// ============================================
interface GlassmorphicCardProps {
  children: React.ReactNode;
  width?: string | number;
  height?: string | number;
  blur?: number;
  opacity?: number;
  borderRadius?: number;
  glowColor?: string;
  borderColor?: string;
  delay?: number;
  animationDuration?: number;
}

export const GlassmorphicCard: React.FC<GlassmorphicCardProps> = ({
  children,
  width = "auto",
  height = "auto",
  blur = 20,
  opacity = 0.1,
  borderRadius = 24,
  glowColor = "rgba(255, 255, 255, 0.1)",
  borderColor = "rgba(255, 255, 255, 0.2)",
  delay = 0,
  animationDuration = 25,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const actualFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: actualFrame,
    fps,
    from: 0.9,
    to: 1,
    config: { damping: 15, stiffness: 100 },
  });

  const cardOpacity = interpolate(actualFrame, [0, animationDuration], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(actualFrame, [0, animationDuration], [30, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: `rgba(255, 255, 255, ${opacity})`,
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        border: `1px solid ${borderColor}`,
        boxShadow: `0 8px 32px ${glowColor}, inset 0 0 0 1px ${borderColor}`,
        opacity: cardOpacity,
        transform: `scale(${scale}) translateY(${translateY}px)`,
        padding: 32,
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
};

// ============================================
// SPOTLIGHT CARD
// Moving gradient spotlight effect
// ============================================
interface SpotlightCardProps {
  children: React.ReactNode;
  width?: string | number;
  height?: string | number;
  backgroundColor?: string;
  spotlightColor?: string;
  borderRadius?: number;
  spotlightSize?: number;
  delay?: number;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  width = 400,
  height = 300,
  backgroundColor = "rgba(30, 30, 45, 1)",
  spotlightColor = "rgba(100, 150, 255, 0.3)",
  borderRadius = 20,
  spotlightSize = 200,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const actualFrame = Math.max(0, frame - delay);

  // Animate spotlight position in a circular pattern
  const angle = (actualFrame / 60) * Math.PI * 2; // Complete circle every 60 frames
  const spotX = 50 + Math.cos(angle) * 30;
  const spotY = 50 + Math.sin(angle) * 30;

  const entryOpacity = interpolate(actualFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const entryScale = interpolate(actualFrame, [0, 20], [0.95, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor,
        position: "relative",
        overflow: "hidden",
        opacity: entryOpacity,
        transform: `scale(${entryScale})`,
        border: "1px solid rgba(255, 255, 255, 0.1)",
      }}
    >
      {/* Spotlight overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(
            circle ${spotlightSize}px at ${spotX}% ${spotY}%,
            ${spotlightColor},
            transparent 70%
          )`,
          pointerEvents: "none",
        }}
      />
      {/* Content */}
      <div style={{ position: "relative", zIndex: 1, padding: 24 }}>
        {children}
      </div>
    </div>
  );
};

// ============================================
// TILT CARD
// 3D perspective tilt animation
// ============================================
interface TiltCardProps {
  children: React.ReactNode;
  width?: string | number;
  height?: string | number;
  backgroundColor?: string;
  borderRadius?: number;
  maxTilt?: number;
  delay?: number;
}

export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  width = 350,
  height = 250,
  backgroundColor = "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
  borderRadius = 16,
  maxTilt = 15,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const actualFrame = Math.max(0, frame - delay);

  // Animate tilt in a figure-8 pattern
  const t = actualFrame / 45;
  const rotateY = Math.sin(t) * maxTilt;
  const rotateX = Math.sin(t * 2) * (maxTilt / 2);

  const entryOpacity = interpolate(actualFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const entryScale = interpolate(actualFrame, [0, 25], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        perspective: "1000px",
        transformStyle: "preserve-3d",
      }}
    >
      <div
        style={{
          width,
          height,
          borderRadius,
          background: backgroundColor,
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${entryScale})`,
          opacity: entryOpacity,
          padding: 24,
          border: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: `
            0 20px 40px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.1)
          `,
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ============================================
// BENTO GRID
// Animated bento-style grid layout
// ============================================
interface BentoItem {
  content: React.ReactNode;
  colSpan?: number;
  rowSpan?: number;
}

interface BentoGridProps {
  items: BentoItem[];
  columns?: number;
  gap?: number;
  cellSize?: number;
  staggerDelay?: number;
}

export const BentoGrid: React.FC<BentoGridProps> = ({
  items,
  columns = 3,
  gap = 16,
  cellSize = 200,
  staggerDelay = 8,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
        gap,
      }}
    >
      {items.map((item, index) => {
        const delay = index * staggerDelay;
        const actualFrame = Math.max(0, frame - delay);

        const scale = spring({
          frame: actualFrame,
          fps,
          from: 0.8,
          to: 1,
          config: { damping: 12, stiffness: 100 },
        });

        const opacity = interpolate(actualFrame, [0, 15], [0, 1], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={index}
            style={{
              gridColumn: `span ${item.colSpan || 1}`,
              gridRow: `span ${item.rowSpan || 1}`,
              background: "rgba(255, 255, 255, 0.05)",
              borderRadius: 16,
              border: "1px solid rgba(255, 255, 255, 0.1)",
              padding: 20,
              opacity,
              transform: `scale(${scale})`,
              backdropFilter: "blur(10px)",
            }}
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// FLOATING CARD
// Subtle floating animation with rotation
// ============================================
interface FloatingCardProps {
  children: React.ReactNode;
  width?: string | number;
  height?: string | number;
  backgroundColor?: string;
  borderRadius?: number;
  floatAmplitude?: number;
  rotateAmplitude?: number;
  speed?: number;
  delay?: number;
}

export const FloatingCard: React.FC<FloatingCardProps> = ({
  children,
  width = 320,
  height = 240,
  backgroundColor = "rgba(30, 30, 50, 0.95)",
  borderRadius = 20,
  floatAmplitude = 15,
  rotateAmplitude = 3,
  speed = 0.03,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const actualFrame = Math.max(0, frame - delay);

  const floatY = Math.sin(actualFrame * speed) * floatAmplitude;
  const rotate = Math.sin(actualFrame * speed * 0.7) * rotateAmplitude;

  const entryOpacity = interpolate(actualFrame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });

  const entryY = interpolate(actualFrame, [0, 25], [50, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: backgroundColor,
        opacity: entryOpacity,
        transform: `translateY(${floatY + entryY}px) rotate(${rotate}deg)`,
        padding: 24,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: `
          0 25px 50px rgba(0, 0, 0, 0.25),
          0 0 0 1px rgba(255, 255, 255, 0.05)
        `,
      }}
    >
      {children}
    </div>
  );
};

// ============================================
// FEATURE CARD
// Card with icon, title, and description
// ============================================
interface FeatureCardProps {
  icon: string | React.ReactNode;
  title: string;
  description: string;
  iconBackground?: string;
  textColor?: string;
  subtextColor?: string;
  delay?: number;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  iconBackground = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  textColor = "#ffffff",
  subtextColor = "#a0a0a0",
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const actualFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: actualFrame,
    fps,
    from: 0.9,
    to: 1,
    config: { damping: 15, stiffness: 100 },
  });

  const opacity = interpolate(actualFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const slideX = interpolate(actualFrame, [0, 25], [40, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        background: "rgba(255, 255, 255, 0.05)",
        backdropFilter: "blur(15px)",
        borderRadius: 20,
        padding: "28px 32px",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        opacity,
        transform: `scale(${scale}) translateX(${slideX}px)`,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 18,
          background: iconBackground,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          flexShrink: 0,
          boxShadow: "0 4px 20px rgba(102, 126, 234, 0.4)",
        }}
      >
        {icon}
      </div>
      <div>
        <h3
          style={{
            color: textColor,
            fontSize: 28,
            fontWeight: "bold",
            margin: 0,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            color: subtextColor,
            fontSize: 18,
            margin: "8px 0 0 0",
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1.4,
          }}
        >
          {description}
        </p>
      </div>
    </div>
  );
};

// ============================================
// STAT CARD
// Animated counter stat display
// ============================================
interface StatCardProps {
  value: number;
  label: string;
  suffix?: string;
  valueColor?: string;
  labelColor?: string;
  duration?: number;
  delay?: number;
}

export const StatCard: React.FC<StatCardProps> = ({
  value,
  label,
  suffix = "",
  valueColor = "#ffffff",
  labelColor = "#00d4ff",
  duration = 45,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const actualFrame = Math.max(0, frame - delay);

  const animatedValue = interpolate(actualFrame, [0, duration], [0, value], {
    extrapolateRight: "clamp",
  });

  const scale = spring({
    frame: actualFrame,
    fps,
    from: 0.5,
    to: 1,
    config: { damping: 12, stiffness: 100 },
  });

  const opacity = interpolate(actualFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const displayValue =
    value % 1 === 0
      ? Math.floor(animatedValue).toLocaleString()
      : animatedValue.toFixed(2);

  return (
    <div
      style={{
        textAlign: "center",
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
          color: valueColor,
          background: `linear-gradient(to bottom, ${valueColor}, ${labelColor}50)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {displayValue}
        {suffix}
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: labelColor,
          textTransform: "uppercase",
          letterSpacing: 2,
          marginTop: 8,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default {
  GlassmorphicCard,
  SpotlightCard,
  TiltCard,
  BentoGrid,
  FloatingCard,
  FeatureCard,
  StatCard,
};
