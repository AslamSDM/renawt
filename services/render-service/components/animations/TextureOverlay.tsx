import React from "react";
import { useCurrentFrame, AbsoluteFill } from "remotion";

// ============================================
// NOISE TEXTURE OVERLAY
// SVG-based grain that subtly shifts
// ============================================
interface NoiseTextureOverlayProps {
  opacity?: number;
  speed?: number;
}

export const NoiseTextureOverlay: React.FC<NoiseTextureOverlayProps> = ({
  opacity = 0.05,
  speed = 1,
}) => {
  const frame = useCurrentFrame();
  // Shift seed every few frames for grain movement
  const seed = Math.floor(frame * speed * 0.3) % 1000;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg
        style={{ position: "absolute", width: 0, height: 0 }}
        aria-hidden="true"
      >
        <filter id={`noise-${seed}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="4"
            seed={seed}
            stitchTiles="stitch"
          />
        </filter>
      </svg>
      <AbsoluteFill
        style={{
          opacity,
          filter: `url(#noise-${seed})`,
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
};

// ============================================
// GEOMETRIC TEXTURE OVERLAY
// Circles, lines, dots that drift slowly
// ============================================
interface GeometricShape {
  type: "circle" | "line" | "dot";
  x: number;
  y: number;
  size: number;
  angle: number;
  speed: number;
  opacity: number;
}

interface GeometricTextureOverlayProps {
  opacity?: number;
  speed?: number;
  color?: string;
  count?: number;
}

export const GeometricTextureOverlay: React.FC<GeometricTextureOverlayProps> = ({
  opacity = 0.04,
  speed = 1,
  color = "rgba(255, 255, 255, 0.5)",
  count = 20,
}) => {
  const frame = useCurrentFrame();

  const shapes: GeometricShape[] = React.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      type: (["circle", "line", "dot"] as const)[i % 3],
      x: (i * 47) % 100,
      y: (i * 61) % 100,
      size: 3 + ((i * 13) % 8),
      angle: (i * 37) % 360,
      speed: 0.1 + ((i * 19) % 10) / 20,
      opacity: 0.3 + ((i * 23) % 5) / 10,
    }));
  }, [count]);

  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      {shapes.map((shape, i) => {
        const driftX = Math.sin(frame * 0.008 * shape.speed * speed + i) * 15;
        const driftY = Math.cos(frame * 0.006 * shape.speed * speed + i * 0.7) * 10;
        const rotation = shape.angle + frame * 0.1 * shape.speed * speed;

        if (shape.type === "circle") {
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${shape.x + driftX * 0.3}%`,
                top: `${shape.y + driftY * 0.3}%`,
                width: shape.size * 2,
                height: shape.size * 2,
                borderRadius: "50%",
                border: `1px solid ${color}`,
                opacity: opacity * shape.opacity,
                transform: `rotate(${rotation}deg)`,
              }}
            />
          );
        }

        if (shape.type === "line") {
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${shape.x + driftX * 0.3}%`,
                top: `${shape.y + driftY * 0.3}%`,
                width: shape.size * 10,
                height: 1,
                backgroundColor: color,
                opacity: opacity * shape.opacity,
                transform: `rotate(${rotation}deg)`,
                transformOrigin: "left center",
              }}
            />
          );
        }

        // dot
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${shape.x + driftX * 0.3}%`,
              top: `${shape.y + driftY * 0.3}%`,
              width: shape.size,
              height: shape.size,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: opacity * shape.opacity,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// ============================================
// COMBINED TEXTURE OVERLAY
// ============================================
interface TextureOverlayProps {
  type?: "noise" | "geometric" | "both";
  opacity?: number;
  speed?: number;
  color?: string;
}

export const TextureOverlay: React.FC<TextureOverlayProps> = ({
  type = "both",
  opacity = 0.05,
  speed = 1,
  color = "rgba(255, 255, 255, 0.5)",
}) => {
  return (
    <>
      {(type === "noise" || type === "both") && (
        <NoiseTextureOverlay opacity={opacity} speed={speed} />
      )}
      {(type === "geometric" || type === "both") && (
        <GeometricTextureOverlay opacity={opacity * 0.8} speed={speed} color={color} />
      )}
    </>
  );
};

export default TextureOverlay;
