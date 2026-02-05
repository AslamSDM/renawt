import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
  random,
} from "remotion";
import { BeatMap } from "../../hooks/useBeatMap";

// ============================================
// KINETIC TEXT
// High-energy character-by-character animation
// Fast-paced with aggressive spring physics
// ============================================
interface KineticTextProps {
  text: string;
  startFrame?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  charDelay?: number;
  style?: React.CSSProperties;
}

export const KineticText: React.FC<KineticTextProps> = ({
  text,
  startFrame = 0,
  fontSize = 72,
  color = "#ffffff",
  fontFamily = "system-ui, sans-serif",
  fontWeight = "bold",
  charDelay = 2,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = frame - startFrame;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        flexWrap: "wrap",
        ...style,
      }}
    >
      {text.split("").map((char, i) => {
        const charDelayTime = delay - i * charDelay;
        
        // Quick spring entrance - aggressive settings for fast animation
        const progress = spring({
          frame: charDelayTime,
          fps,
          config: {
            mass: 0.5,
            damping: 12,
            stiffness: 250,
          },
        });

        // Interpolate values
        const opacity = interpolate(progress, [0, 1], [0, 1], {
          extrapolateRight: "clamp",
        });
        
        const translateY = interpolate(progress, [0, 1], [50, 0], {
          extrapolateRight: "clamp",
        });

        const scale = interpolate(progress, [0, 1], [0.5, 1], {
          extrapolateRight: "clamp",
        });

        return (
          <span
            key={i}
            style={{
              fontSize,
              color,
              fontFamily,
              fontWeight,
              display: "inline-block",
              opacity,
              transform: `translateY(${translateY}px) scale(${scale})`,
              whiteSpace: char === " " ? "pre" : "normal",
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </div>
  );
};

// ============================================
// GLITCH TEXT
// RGB split glitch effect for impact moments
// ============================================
interface GlitchTextProps {
  text: string;
  triggerFrame?: number;
  duration?: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  style?: React.CSSProperties;
}

export const GlitchText: React.FC<GlitchTextProps> = ({
  text,
  triggerFrame = 0,
  duration = 15,
  fontSize = 80,
  color = "#ffffff",
  fontFamily = "system-ui, sans-serif",
  fontWeight = "bold",
  style,
}) => {
  const frame = useCurrentFrame();
  const delay = frame - triggerFrame;
  const isGlitching = delay >= 0 && delay < duration;

  // Random offsets for glitch effect (deterministic based on frame)
  const glitchOffsetX = isGlitching
    ? random(`${frame}-x`) * 12 - 6
    : 0;
  const glitchOffsetY = isGlitching
    ? random(`${frame}-y`) * 6 - 3
    : 0;
  const clipTop = isGlitching ? random(`${frame}-clip`) * 100 : 0;
  const clipBottom = isGlitching ? random(`${frame}-clip2`) * 100 : 0;

  // Fade in the main text
  const opacity = interpolate(
    delay,
    [0, duration / 3, duration * 0.7, duration],
    [0, 1, 1, 1],
    { extrapolateRight: "clamp" }
  );

  const textStyle: React.CSSProperties = {
    fontSize,
    color,
    fontFamily,
    fontWeight,
    position: "relative",
    display: "inline-block",
    opacity,
  };

  return (
    <div style={{ ...style, position: "relative", display: "inline-block" }}>
      {/* Main text */}
      <span style={textStyle}>{text}</span>

      {/* Glitch layers - only show during glitch period */}
      {isGlitching && (
        <>
          {/* Red channel offset */}
          <span
            style={{
              ...textStyle,
              position: "absolute",
              top: glitchOffsetY,
              left: glitchOffsetX,
              color: "#ff0000",
              mixBlendMode: "screen",
              opacity: 0.8,
              clipPath: `inset(${clipTop}% 0 ${clipBottom}% 0)`,
            }}
          >
            {text}
          </span>

          {/* Cyan channel offset */}
          <span
            style={{
              ...textStyle,
              position: "absolute",
              top: -glitchOffsetY,
              left: -glitchOffsetX,
              color: "#00ffff",
              mixBlendMode: "screen",
              opacity: 0.8,
              clipPath: `inset(${100 - clipBottom}% 0 ${100 - clipTop}% 0)`,
            }}
          >
            {text}
          </span>

          {/* Noise scanlines */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(0, 0, 0, 0.1) 2px,
                rgba(0, 0, 0, 0.1) 4px
              )`,
              pointerEvents: "none",
              opacity: 0.5,
            }}
          />
        </>
      )}
    </div>
  );
};

// ============================================
// AUDIO REACTIVE GRADIENT
// Background that shifts colors based on audio energy
// ============================================
interface AudioReactiveGradientProps {
  baseColors: string[];
  accentColors: string[];
  beatMap?: BeatMap;
}

export const AudioReactiveGradient: React.FC<AudioReactiveGradientProps> = ({
  baseColors = ["#1a1a2e", "#16213e", "#0f3460"],
  accentColors = ["#667eea", "#764ba2", "#f093fb"],
  beatMap,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Calculate energy level from beat map or use sine wave fallback
  let energy = 0;
  if (beatMap && beatMap.energy && beatMap.energy.length > 0) {
    energy = beatMap.energy[Math.min(frame, beatMap.energy.length - 1)] || 0;
  } else {
    // Fallback: create synthetic energy curve
    energy = (Math.sin(frame * 0.1) + 1) / 2;
  }

  // React to beats
  let beatIntensity = 0;
  if (beatMap && beatMap.beats) {
    const nearestBeat = beatMap.beats.find((b: number) => Math.abs(b - frame) < 5);
    if (nearestBeat) {
      const distance = Math.abs(nearestBeat - frame);
      beatIntensity = Math.max(0, 1 - distance / 5);
    }
  }

  // Combine energy and beat for total intensity
  const totalIntensity = Math.min(1, energy * 0.5 + beatIntensity * 0.8);

  // Animated gradient positions
  const t = (frame / durationInFrames) * 2;
  const pos1 = 20 + Math.sin(t * Math.PI * 2) * 15 + beatIntensity * 10;
  const pos2 = 70 + Math.cos(t * Math.PI * 1.5) * 15 - beatIntensity * 10;
  const pos3 = 50 + Math.sin(t * Math.PI * 1.3) * 10;

  // Color interpolation based on intensity
  const currentColors = totalIntensity > 0.3 ? accentColors : baseColors;
  const opacity = 0.3 + totalIntensity * 0.4;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(
            ellipse 80% 80% at ${pos1}% ${30 + Math.sin(t * Math.PI) * 10}%,
            ${currentColors[0]}${Math.round(opacity * 255).toString(16).padStart(2, "0")} 0%,
            transparent 50%
          ),
          radial-gradient(
            ellipse 60% 60% at ${pos2}% ${60 + Math.cos(t * Math.PI) * 10}%,
            ${currentColors[1]}${Math.round((opacity * 0.8) * 255).toString(16).padStart(2, "0")} 0%,
            transparent 45%
          ),
          radial-gradient(
            ellipse 70% 70% at ${pos3}% ${20 + Math.sin(t * Math.PI * 1.5) * 10}%,
            ${currentColors[2]}${Math.round((opacity * 0.6) * 255).toString(16).padStart(2, "0")} 0%,
            transparent 40%
          ),
          linear-gradient(180deg, ${baseColors[0]} 0%, ${baseColors[1]} 100%)
        `,
      }}
    />
  );
};

// ============================================
// BEAT FLASH ENHANCED
// More intense flash effect with color support
// ============================================
interface BeatFlashEnhancedProps {
  beatMap: BeatMap;
  color?: string;
  intensity?: number;
  decayFrames?: number;
  flashOnDownbeat?: boolean;
}

export const BeatFlashEnhanced: React.FC<BeatFlashEnhancedProps> = ({
  beatMap,
  color = "rgba(255, 255, 255, 0.3)",
  intensity = 0.5,
  decayFrames = 10,
  flashOnDownbeat = true,
}) => {
  const frame = useCurrentFrame();

  // Find frames since last beat
  let framesSinceLastBeat = 1000;
  for (const beat of beatMap.beats) {
    if (beat <= frame) {
      framesSinceLastBeat = Math.min(framesSinceLastBeat, frame - beat);
    }
  }

  // Check if on downbeat (every 4th beat)
  let framesSinceLastDownbeat = 1000;
  if (flashOnDownbeat && beatMap.downbeats) {
    for (const downbeat of beatMap.downbeats) {
      if (downbeat <= frame) {
        framesSinceLastDownbeat = Math.min(
          framesSinceLastDownbeat,
          frame - downbeat
        );
      }
    }
  }

  // Use the closer of beat or downbeat
  const framesSinceEvent = Math.min(
    framesSinceLastBeat,
    flashOnDownbeat ? framesSinceLastDownbeat : 1000
  );

  // Stronger flash for downbeats
  const isDownbeat = framesSinceLastDownbeat < framesSinceLastBeat;
  const actualIntensity = isDownbeat ? intensity * 1.5 : intensity;

  const opacity = interpolate(
    framesSinceEvent,
    [0, decayFrames],
    [actualIntensity, 0],
    { extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: color,
        opacity,
        pointerEvents: "none",
        mixBlendMode: "screen",
      }}
    />
  );
};

// ============================================
// BEAT PULSE ENHANCED
// Enhanced scale pulse with multiple animation types
// ============================================
interface BeatPulseEnhancedProps {
  children: React.ReactNode;
  beatMap: BeatMap;
  pulseAmount?: number;
  decayFrames?: number;
  animationType?: "scale" | "shake" | "glow";
  glowColor?: string;
}

export const BeatPulseEnhanced: React.FC<BeatPulseEnhancedProps> = ({
  children,
  beatMap,
  pulseAmount = 0.08,
  decayFrames = 12,
  animationType = "scale",
  glowColor = "#00d4ff",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find frames since last beat
  let framesSinceLastBeat = 1000;
  for (const beat of beatMap.beats) {
    if (beat <= frame) {
      framesSinceLastBeat = Math.min(framesSinceLastBeat, frame - beat);
    }
  }

  // Check for downbeats (stronger pulse)
  let framesSinceLastDownbeat = 1000;
  if (beatMap.downbeats) {
    for (const downbeat of beatMap.downbeats) {
      if (downbeat <= frame) {
        framesSinceLastDownbeat = Math.min(
          framesSinceLastDownbeat,
          frame - downbeat
        );
      }
    }
  }

  const isDownbeat = framesSinceLastDownbeat < framesSinceLastBeat;
  const actualDecayFrames = isDownbeat ? decayFrames * 1.5 : decayFrames;
  const actualPulseAmount = isDownbeat ? pulseAmount * 1.3 : pulseAmount;

  const progress = interpolate(
    Math.min(framesSinceLastBeat, framesSinceLastDownbeat),
    [0, actualDecayFrames],
    [0, 1],
    { extrapolateRight: "clamp" }
  );

  let style: React.CSSProperties = {};

  switch (animationType) {
    case "scale":
      const scale = spring({
        frame: Math.min(framesSinceLastBeat, framesSinceLastDownbeat),
        fps,
        from: 1 + actualPulseAmount,
        to: 1,
        config: { damping: 12, stiffness: 150 },
      });
      style.transform = `scale(${scale})`;
      style.transformOrigin = "center center";
      break;

    case "shake":
      const shakeIntensity = interpolate(
        Math.min(framesSinceLastBeat, framesSinceLastDownbeat),
        [0, actualDecayFrames],
        [actualPulseAmount * 100, 0],
        { extrapolateRight: "clamp" }
      );
      const shakeX = Math.sin(frame * 0.5) * shakeIntensity;
      const shakeY = Math.cos(frame * 0.5) * shakeIntensity * 0.5;
      style.transform = `translate(${shakeX}px, ${shakeY}px)`;
      break;

    case "glow":
      const glowIntensity = interpolate(
        Math.min(framesSinceLastBeat, framesSinceLastDownbeat),
        [0, actualDecayFrames],
        [20, 0],
        { extrapolateRight: "clamp" }
      );
      style.boxShadow = `0 0 ${glowIntensity}px ${glowColor}, 0 0 ${glowIntensity * 2}px ${glowColor}80`;
      break;
  }

  return <div style={style}>{children}</div>;
};

// ============================================
// FAST TRANSITIONS
// Quick cut transitions for high-energy videos
// ============================================
interface FastSlideProps {
  children: React.ReactNode;
  direction?: "left" | "right" | "up" | "down";
  duration?: number;
  delay?: number;
}

export const FastSlide: React.FC<FastSlideProps> = ({
  children,
  direction = "right",
  duration = 20,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const actualFrame = Math.max(0, frame - delay);

  const progress = spring({
    frame: actualFrame,
    fps,
    from: 0,
    to: 1,
    config: { mass: 0.8, damping: 15, stiffness: 200 },
  });

  let translateX = 0;
  let translateY = 0;

  switch (direction) {
    case "left":
      translateX = interpolate(progress, [0, 1], [100, 0], {
        extrapolateRight: "clamp",
      });
      break;
    case "right":
      translateX = interpolate(progress, [0, 1], [-100, 0], {
        extrapolateRight: "clamp",
      });
      break;
    case "up":
      translateY = interpolate(progress, [0, 1], [100, 0], {
        extrapolateRight: "clamp",
      });
      break;
    case "down":
      translateY = interpolate(progress, [0, 1], [-100, 0], {
        extrapolateRight: "clamp",
      });
      break;
  }

  return (
    <div
      style={{
        transform: `translate(${translateX}%, ${translateY}%)`,
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
};

// Export all high-energy components
export default {
  KineticText,
  GlitchText,
  AudioReactiveGradient,
  BeatFlashEnhanced,
  BeatPulseEnhanced,
  FastSlide,
};
