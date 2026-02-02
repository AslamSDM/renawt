import React from "react";
import { useCurrentFrame, AbsoluteFill, Img, interpolate } from "remotion";

interface ScrollAnimationProps {
  imageUrl?: string;
  scrollSpeed?: number;
  direction?: "up" | "down";
  background?: string;
}

export const ScrollAnimation: React.FC<ScrollAnimationProps> = ({
  imageUrl,
  scrollSpeed = 2,
  direction = "up",
  background = "#f5f5f5",
}) => {
  const frame = useCurrentFrame();

  const scrollOffset =
    direction === "up" ? -frame * scrollSpeed : frame * scrollSpeed;

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "70%",
          height: "80%",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          opacity,
        }}
      >
        {/* Browser chrome mockup */}
        <div
          style={{
            height: 40,
            background: "#e0e0e0",
            display: "flex",
            alignItems: "center",
            padding: "0 15px",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#ff5f57",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#febc2e",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "#28c840",
            }}
          />
          <div
            style={{
              flex: 1,
              height: 24,
              background: "#ffffff",
              borderRadius: 6,
              marginLeft: 20,
            }}
          />
        </div>

        {/* Content area with scroll */}
        <div
          style={{
            height: "calc(100% - 40px)",
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          {imageUrl ? (
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                transform: `translateY(${scrollOffset}px)`,
                objectFit: "cover",
                objectPosition: "top",
              }}
            />
          ) : (
            <div
              style={{
                transform: `translateY(${scrollOffset}px)`,
                padding: 40,
              }}
            >
              {/* Placeholder content */}
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} style={{ marginBottom: 30 }}>
                  <div
                    style={{
                      height: 24,
                      background: "#e0e0e0",
                      borderRadius: 4,
                      width: `${60 + Math.random() * 30}%`,
                      marginBottom: 12,
                    }}
                  />
                  <div
                    style={{
                      height: 16,
                      background: "#f0f0f0",
                      borderRadius: 4,
                      width: "100%",
                      marginBottom: 8,
                    }}
                  />
                  <div
                    style={{
                      height: 16,
                      background: "#f0f0f0",
                      borderRadius: 4,
                      width: "80%",
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

interface PhoneMockupProps {
  imageUrl?: string;
  scrollSpeed?: number;
  background?: string;
}

export const PhoneMockup: React.FC<PhoneMockupProps> = ({
  imageUrl,
  scrollSpeed = 1.5,
  background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
}) => {
  const frame = useCurrentFrame();

  const scrollOffset = -frame * scrollSpeed;

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const floatY = Math.sin(frame / 30) * 5;

  return (
    <AbsoluteFill style={{ background, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          width: 280,
          height: 580,
          background: "#1a1a1a",
          borderRadius: 40,
          padding: 10,
          boxShadow: "0 30px 80px rgba(0,0,0,0.4)",
          opacity,
          transform: `translateY(${floatY}px)`,
        }}
      >
        {/* Notch */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 25,
            background: "#1a1a1a",
            borderRadius: "0 0 20px 20px",
            zIndex: 10,
          }}
        />

        {/* Screen */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 30,
            overflow: "hidden",
            background: "#ffffff",
          }}
        >
          {imageUrl ? (
            <Img
              src={imageUrl}
              style={{
                width: "100%",
                transform: `translateY(${scrollOffset}px)`,
                objectFit: "cover",
                objectPosition: "top",
              }}
            />
          ) : (
            <div
              style={{
                transform: `translateY(${scrollOffset}px)`,
                padding: 20,
              }}
            >
              {/* Status bar */}
              <div
                style={{
                  height: 30,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: "bold" }}>9:41</span>
                <div style={{ display: "flex", gap: 5 }}>
                  <div
                    style={{
                      width: 20,
                      height: 12,
                      background: "#333",
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>

              {/* Placeholder app content */}
              {Array.from({ length: 15 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 15,
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: `hsl(${i * 30}, 70%, 80%)`,
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        height: 12,
                        background: "#e0e0e0",
                        borderRadius: 3,
                        width: "70%",
                        marginBottom: 6,
                      }}
                    />
                    <div
                      style={{
                        height: 10,
                        background: "#f0f0f0",
                        borderRadius: 3,
                        width: "50%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

interface ParallaxLayersProps {
  layers: Array<{
    imageUrl?: string;
    speed: number;
    zIndex: number;
  }>;
  background?: string;
}

export const ParallaxLayers: React.FC<ParallaxLayersProps> = ({
  layers,
  background = "#000000",
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background }}>
      {layers.map((layer, index) => {
        const offset = frame * layer.speed;
        const opacity = interpolate(frame, [0, 30], [0, 1], {
          extrapolateRight: "clamp",
        });

        return (
          <AbsoluteFill
            key={index}
            style={{
              zIndex: layer.zIndex,
              transform: `translateX(${-offset}px)`,
              opacity,
            }}
          >
            {layer.imageUrl ? (
              <Img
                src={layer.imageUrl}
                style={{ width: "200%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "200%",
                  height: "100%",
                  background: `hsla(${index * 40}, 50%, 50%, 0.3)`,
                }}
              />
            )}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

export default {
  ScrollAnimation,
  PhoneMockup,
  ParallaxLayers,
};
