import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from "remotion";

// ============================================
// IPHONE MOCKUP
// Realistic CSS-based iPhone with Dynamic Island
// ============================================
interface IPhoneMockupProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
  animation?: "enter" | "float" | "tilt" | "none";
  width?: number;
  frameColor?: string;
}

export const IPhoneMockup: React.FC<IPhoneMockupProps> = ({
  children,
  style,
  delay = 0,
  animation = "enter",
  width = 300,
  frameColor = "#1a1a1a",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);

  const height = width * 2.16; // iPhone 15 Pro aspect ratio
  const bezelWidth = width * 0.04;
  const screenBorderRadius = width * 0.12;
  const shellBorderRadius = width * 0.14;

  // Animation calculations
  let transformStyle = "";
  let opacityVal = 1;

  if (animation === "enter") {
    const enterScale = spring({
      frame: f,
      fps,
      from: 0.85,
      to: 1,
      config: { damping: 15, stiffness: 120 },
    });
    const enterY = interpolate(f, [0, 30], [60, 0], {
      extrapolateRight: "clamp",
    });
    opacityVal = interpolate(f, [0, 20], [0, 1], {
      extrapolateRight: "clamp",
    });
    const enterRotateY = interpolate(f, [0, 35], [-15, 0], {
      extrapolateRight: "clamp",
    });
    transformStyle = `perspective(1200px) translateY(${enterY}px) scale(${enterScale}) rotateY(${enterRotateY}deg)`;
  } else if (animation === "float") {
    const bobY = Math.sin(frame * 0.03) * 12;
    const bobRotate = Math.sin(frame * 0.02) * 2;
    opacityVal = interpolate(f, [0, 15], [0, 1], {
      extrapolateRight: "clamp",
    });
    transformStyle = `translateY(${bobY}px) rotate(${bobRotate}deg)`;
  } else if (animation === "tilt") {
    const tiltX = Math.sin(frame * 0.025) * 8;
    const tiltY = Math.cos(frame * 0.02) * 5;
    opacityVal = interpolate(f, [0, 15], [0, 1], {
      extrapolateRight: "clamp",
    });
    transformStyle = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  }

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        opacity: opacityVal,
        transform: transformStyle,
        ...style,
      }}
    >
      {/* Device shell */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: shellBorderRadius,
          background: `linear-gradient(145deg, #2a2a2a, ${frameColor})`,
          boxShadow: `
            0 25px 60px rgba(0, 0, 0, 0.5),
            0 10px 20px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.3)
          `,
        }}
      />

      {/* Side buttons - left (mute switch, volume up, volume down) */}
      <div
        style={{
          position: "absolute",
          left: -2,
          top: height * 0.15,
          width: 3,
          height: 20,
          background: "#333",
          borderRadius: "2px 0 0 2px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -2,
          top: height * 0.22,
          width: 3,
          height: 35,
          background: "#333",
          borderRadius: "2px 0 0 2px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -2,
          top: height * 0.3,
          width: 3,
          height: 35,
          background: "#333",
          borderRadius: "2px 0 0 2px",
        }}
      />

      {/* Side button - right (power) */}
      <div
        style={{
          position: "absolute",
          right: -2,
          top: height * 0.25,
          width: 3,
          height: 50,
          background: "#333",
          borderRadius: "0 2px 2px 0",
        }}
      />

      {/* Screen area */}
      <div
        style={{
          position: "absolute",
          top: bezelWidth,
          left: bezelWidth,
          right: bezelWidth,
          bottom: bezelWidth,
          borderRadius: screenBorderRadius,
          overflow: "hidden",
          background: "#000",
        }}
      >
        {/* Screen content */}
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {children}
        </div>

        {/* Dynamic Island */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: width * 0.3,
            height: width * 0.08,
            borderRadius: width * 0.04,
            background: "#000",
            zIndex: 10,
          }}
        />

        {/* Home indicator */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: width * 0.35,
            height: 5,
            borderRadius: 2.5,
            background: "rgba(255, 255, 255, 0.3)",
            zIndex: 10,
          }}
        />
      </div>
    </div>
  );
};

// ============================================
// MACBOOK MOCKUP
// Realistic CSS-based MacBook Pro
// ============================================
interface MacBookMockupProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  delay?: number;
  animation?: "enter" | "float" | "tilt" | "none";
  width?: number;
}

export const MacBookMockup: React.FC<MacBookMockupProps> = ({
  children,
  style,
  delay = 0,
  animation = "enter",
  width = 800,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);

  const screenHeight = width * 0.625; // 16:10 aspect ratio
  const bezelWidth = 10;
  const bezelTop = 24; // thicker top for camera

  // Animation
  let transformStyle = "";
  let opacityVal = 1;

  if (animation === "enter") {
    const enterScale = spring({
      frame: f,
      fps,
      from: 0.9,
      to: 1,
      config: { damping: 18, stiffness: 100 },
    });
    const enterY = interpolate(f, [0, 35], [50, 0], {
      extrapolateRight: "clamp",
    });
    opacityVal = interpolate(f, [0, 25], [0, 1], {
      extrapolateRight: "clamp",
    });
    const enterRotateX = interpolate(f, [0, 40], [15, 0], {
      extrapolateRight: "clamp",
    });
    transformStyle = `perspective(1500px) translateY(${enterY}px) scale(${enterScale}) rotateX(${enterRotateX}deg)`;
  } else if (animation === "float") {
    const bobY = Math.sin(frame * 0.025) * 8;
    const bobRotate = Math.sin(frame * 0.015) * 1.5;
    opacityVal = interpolate(f, [0, 20], [0, 1], {
      extrapolateRight: "clamp",
    });
    transformStyle = `translateY(${bobY}px) rotate(${bobRotate}deg)`;
  } else if (animation === "tilt") {
    const tiltX = Math.sin(frame * 0.02) * 5;
    const tiltY = Math.cos(frame * 0.018) * 4;
    opacityVal = interpolate(f, [0, 20], [0, 1], {
      extrapolateRight: "clamp",
    });
    transformStyle = `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  }

  return (
    <div
      style={{
        position: "relative",
        width,
        opacity: opacityVal,
        transform: transformStyle,
        ...style,
      }}
    >
      {/* Screen housing */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: screenHeight,
          borderRadius: "12px 12px 0 0",
          background: `linear-gradient(180deg, #2d2d2d, #1a1a1a)`,
          boxShadow: `
            0 -2px 20px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.08)
          `,
          padding: `${bezelTop}px ${bezelWidth}px ${bezelWidth}px ${bezelWidth}px`,
        }}
      >
        {/* Camera notch */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#1a1a1a",
            border: "1px solid #333",
            zIndex: 5,
          }}
        />

        {/* Screen */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 6,
            overflow: "hidden",
            background: "#000",
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>

      {/* Hinge */}
      <div
        style={{
          width: "100%",
          height: 4,
          background: `linear-gradient(180deg, #333, #1a1a1a, #222)`,
        }}
      />

      {/* Base / keyboard area */}
      <div
        style={{
          width: `calc(100% + 20px)`,
          marginLeft: -10,
          height: 14,
          borderRadius: "0 0 8px 8px",
          background: `linear-gradient(180deg, #c0c0c0, #a8a8a8)`,
          boxShadow: `
            0 4px 15px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.4)
          `,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Trackpad notch */}
        <div
          style={{
            width: 60,
            height: 4,
            borderRadius: 2,
            background: "rgba(0, 0, 0, 0.15)",
          }}
        />
      </div>
    </div>
  );
};

export default { IPhoneMockup, MacBookMockup };
