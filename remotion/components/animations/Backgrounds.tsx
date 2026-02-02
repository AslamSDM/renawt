import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
} from "remotion";

// ============================================
// GRADIENT MESH BACKGROUND
// Animated mesh gradient like Stripe
// ============================================
interface GradientMeshProps {
  colors?: string[];
  speed?: number;
}

export const GradientMeshBackground: React.FC<GradientMeshProps> = ({
  colors = ["#667eea", "#764ba2", "#f093fb", "#f5576c"],
  speed = 0.5,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Animate gradient positions
  const offset1 = (frame * speed) % 100;
  const offset2 = (frame * speed * 0.7 + 30) % 100;
  const offset3 = (frame * speed * 1.3 + 60) % 100;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(
            ellipse 80% 80% at ${20 + offset1 * 0.3}% ${30 + offset2 * 0.2}%,
            ${colors[0]}40 0%,
            transparent 50%
          ),
          radial-gradient(
            ellipse 60% 60% at ${70 - offset2 * 0.2}% ${60 + offset1 * 0.1}%,
            ${colors[1]}40 0%,
            transparent 45%
          ),
          radial-gradient(
            ellipse 70% 70% at ${50 + offset3 * 0.15}% ${20 - offset1 * 0.1}%,
            ${colors[2]}30 0%,
            transparent 40%
          ),
          radial-gradient(
            ellipse 50% 50% at ${30 + offset1 * 0.2}% ${80 - offset3 * 0.1}%,
            ${colors[3]}35 0%,
            transparent 50%
          ),
          linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%)
        `,
      }}
    />
  );
};

// ============================================
// PARTICLE FIELD
// Floating particles with depth
// ============================================
interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  delay: number;
}

interface ParticleFieldProps {
  particleCount?: number;
  color?: string;
  maxSize?: number;
  speed?: number;
}

export const ParticleField: React.FC<ParticleFieldProps> = ({
  particleCount = 30,
  color = "#ffffff",
  maxSize = 4,
  speed = 0.5,
}) => {
  const frame = useCurrentFrame();

  // Generate particles deterministically
  const particles: Particle[] = React.useMemo(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      x: (i * 37) % 100,
      y: (i * 53) % 100,
      size: 1 + ((i * 7) % maxSize),
      speed: 0.2 + (((i * 11) % 10) / 10) * speed,
      opacity: 0.2 + ((i * 13) % 6) / 10,
      delay: (i * 17) % 60,
    }));
  }, [particleCount, maxSize, speed]);

  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      {particles.map((particle, i) => {
        const actualFrame = Math.max(0, frame - particle.delay);
        const yOffset = (actualFrame * particle.speed) % 120;
        const yPos = ((particle.y - yOffset + 120) % 120) - 10;

        // Gentle horizontal drift
        const xDrift = Math.sin(actualFrame * 0.02 + i) * 2;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${particle.x + xDrift}%`,
              top: `${yPos}%`,
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: particle.opacity,
              boxShadow: `0 0 ${particle.size * 2}px ${color}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ============================================
// NOISE GRADIENT BACKGROUND
// Grainy animated gradient
// ============================================
interface NoiseGradientProps {
  colors?: string[];
  noiseOpacity?: number;
  animationSpeed?: number;
}

export const NoiseGradientBackground: React.FC<NoiseGradientProps> = ({
  colors = ["#1a1a2e", "#16213e", "#0f3460"],
  noiseOpacity = 0.15,
  animationSpeed = 1,
}) => {
  const frame = useCurrentFrame();

  const gradientAngle = (frame * animationSpeed) % 360;

  // Create gradient with colors
  const gradient = `linear-gradient(
    ${gradientAngle}deg,
    ${colors.join(", ")}
  )`;

  return (
    <AbsoluteFill>
      {/* Base gradient */}
      <AbsoluteFill style={{ background: gradient }} />

      {/* Noise overlay using SVG filter */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <filter id="noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="4"
            stitchTiles="stitch"
          />
        </filter>
      </svg>
      <AbsoluteFill
        style={{
          opacity: noiseOpacity,
          filter: "url(#noise)",
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
};

// ============================================
// GRID PATTERN
// Animated grid with glow effect
// ============================================
interface GridPatternProps {
  gridSize?: number;
  lineColor?: string;
  glowColor?: string;
  lineWidth?: number;
  animateGlow?: boolean;
}

export const GridPatternBackground: React.FC<GridPatternProps> = ({
  gridSize = 50,
  lineColor = "rgba(255, 255, 255, 0.1)",
  glowColor = "rgba(100, 150, 255, 0.3)",
  lineWidth = 1,
  animateGlow = true,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const glowOffset = animateGlow ? (frame * 2) % (height + 200) : -100;

  return (
    <AbsoluteFill>
      {/* Base dark background */}
      <AbsoluteFill style={{ background: "#0a0a15" }} />

      {/* Horizontal lines */}
      {Array.from({ length: Math.ceil(height / gridSize) + 1 }, (_, i) => (
        <div
          key={`h-${i}`}
          style={{
            position: "absolute",
            top: i * gridSize,
            left: 0,
            right: 0,
            height: lineWidth,
            backgroundColor: lineColor,
          }}
        />
      ))}

      {/* Vertical lines */}
      {Array.from({ length: Math.ceil(width / gridSize) + 1 }, (_, i) => (
        <div
          key={`v-${i}`}
          style={{
            position: "absolute",
            left: i * gridSize,
            top: 0,
            bottom: 0,
            width: lineWidth,
            backgroundColor: lineColor,
          }}
        />
      ))}

      {/* Animated glow line */}
      {animateGlow && (
        <div
          style={{
            position: "absolute",
            top: glowOffset,
            left: 0,
            right: 0,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)`,
            boxShadow: `0 0 30px 10px ${glowColor}`,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ============================================
// BEAM BACKGROUND
// Animated light beams
// ============================================
interface BeamBackgroundProps {
  beamCount?: number;
  colors?: string[];
  speed?: number;
  backgroundColor?: string;
}

export const BeamBackground: React.FC<BeamBackgroundProps> = ({
  beamCount = 5,
  colors = ["#667eea", "#764ba2", "#f093fb"],
  speed = 1,
  backgroundColor = "#0a0a15",
}) => {
  const frame = useCurrentFrame();

  const beams = React.useMemo(() => {
    return Array.from({ length: beamCount }, (_, i) => ({
      startX: (i * 23) % 100,
      width: 100 + ((i * 31) % 150),
      color: colors[i % colors.length],
      speed: 0.5 + ((i * 7) % 5) / 5,
      angle: 20 + ((i * 11) % 30),
      opacity: 0.1 + ((i * 13) % 3) / 10,
    }));
  }, [beamCount, colors]);

  return (
    <AbsoluteFill style={{ background: backgroundColor, overflow: "hidden" }}>
      {beams.map((beam, i) => {
        const yOffset = (frame * beam.speed * speed) % 200;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${beam.startX}%`,
              top: -100 + yOffset,
              width: beam.width,
              height: "200%",
              background: `linear-gradient(180deg, transparent, ${beam.color}, transparent)`,
              opacity: beam.opacity,
              transform: `rotate(${beam.angle}deg)`,
              filter: `blur(40px)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ============================================
// AURORA BACKGROUND
// Northern lights effect
// ============================================
interface AuroraBackgroundProps {
  colors?: string[];
  speed?: number;
}

export const AuroraBackground: React.FC<AuroraBackgroundProps> = ({
  colors = ["#00d4ff", "#7c3aed", "#f43f5e", "#22c55e"],
  speed = 0.3,
}) => {
  const frame = useCurrentFrame();

  const wave1 = Math.sin(frame * speed * 0.02) * 50;
  const wave2 = Math.sin(frame * speed * 0.015 + 1) * 40;
  const wave3 = Math.sin(frame * speed * 0.025 + 2) * 60;

  return (
    <AbsoluteFill style={{ background: "#0a0a0f", overflow: "hidden" }}>
      {/* Aurora layers */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "-20%",
          right: "-20%",
          height: "50%",
          background: `linear-gradient(
            180deg,
            transparent,
            ${colors[0]}30,
            ${colors[1]}20,
            transparent
          )`,
          transform: `translateY(${wave1}px) scaleX(1.2)`,
          filter: "blur(60px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "-10%",
          right: "-10%",
          height: "40%",
          background: `linear-gradient(
            180deg,
            transparent,
            ${colors[2]}25,
            ${colors[3]}15,
            transparent
          )`,
          transform: `translateY(${wave2}px) scaleX(1.1)`,
          filter: "blur(50px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "-15%",
          right: "-15%",
          height: "45%",
          background: `linear-gradient(
            180deg,
            transparent,
            ${colors[1]}20,
            ${colors[0]}25,
            transparent
          )`,
          transform: `translateY(${wave3}px) scaleX(1.15)`,
          filter: "blur(70px)",
        }}
      />

      {/* Stars */}
      <ParticleField particleCount={40} maxSize={2} speed={0.1} />
    </AbsoluteFill>
  );
};

// ============================================
// VIGNETTE
// Dark edges overlay
// ============================================
interface VignetteProps {
  intensity?: number;
  color?: string;
}

export const Vignette: React.FC<VignetteProps> = ({
  intensity = 0.6,
  color = "#000000",
}) => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(
          ellipse at center,
          transparent 30%,
          ${color}${Math.round(intensity * 255)
            .toString(16)
            .padStart(2, "0")} 100%
        )`,
        pointerEvents: "none",
      }}
    />
  );
};

export default {
  GradientMeshBackground,
  ParticleField,
  NoiseGradientBackground,
  GridPatternBackground,
  BeamBackground,
  AuroraBackground,
  Vignette,
};
