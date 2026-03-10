/**
 * UI MOCKUP COMPONENTS
 * 
 * Realistic product UI components for demo videos
 * Based on Teamble demo style
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

// ============================================
// ANIMATION UTILITIES
// ============================================

export const FadeIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  duration?: number;
}> = ({ children, delay = 0, duration = 30 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [delay, delay + duration], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <div style={{ opacity, transform: `translateY(${y}px)` }}>{children}</div>;
};

export const SlideIn: React.FC<{
  children: React.ReactNode;
  direction?: "left" | "right" | "up" | "down";
  delay?: number;
}> = ({ children, direction = "up", delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springValue = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  const distance = 50;
  const transforms: Record<string, string> = {
    left: `translateX(${distance - springValue * distance}px)`,
    right: `translateX(${-distance + springValue * distance}px)`,
    up: `translateY(${distance - springValue * distance}px)`,
    down: `translateY(${-distance + springValue * distance}px)`,
  };

  return <div style={{ transform: transforms[direction] }}>{children}</div>;
};

export const ScaleIn: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 15, stiffness: 120 },
  });

  return <div style={{ transform: `scale(${0.8 + scale * 0.2})` }}>{children}</div>;
};

export const WordByWord: React.FC<{
  text: string;
  className?: string;
  delay?: number;
}> = ({ text, className = "", delay = 0 }) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  return (
    <div className={`flex flex-wrap gap-x-2 ${className}`}>
      {words.map((word, index) => {
        const wordDelay = delay + index * 8;
        const opacity = interpolate(frame, [wordDelay, wordDelay + 15], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const y = interpolate(frame, [wordDelay, wordDelay + 15], [20, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const blur = interpolate(frame, [wordDelay, wordDelay + 15], [10, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <span
            key={index}
            style={{
              opacity,
              transform: `translateY(${y}px)`,
              filter: `blur(${blur}px)`,
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ============================================
// LOGO COMPONENT
// ============================================

export const LogoAnimation: React.FC<{
  name: string;
  accentColor?: string;
  delay?: number;
}> = ({ name, accentColor = "#8b5cf6", delay = 0 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [delay, delay + 25], [0.8, 1], {
    extrapolateRight: "clamp",
  });

  const splitIndex = Math.floor(name.length / 2);
  const firstPart = name.slice(0, splitIndex);
  const secondPart = name.slice(splitIndex);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <h1
        style={{
          fontSize: 80,
          fontWeight: 700,
          opacity,
          transform: `scale(${scale})`,
          margin: 0,
        }}
      >
        <span style={{ color: "#ffffff" }}>{firstPart}</span>
        <span
          style={{
            background: `linear-gradient(135deg, ${accentColor}, #ec4899)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {secondPart}
        </span>
      </h1>
      {/* Glow effect */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(135deg, ${accentColor}30, #ec489930)`,
          filter: "blur(60px)",
          transform: "scale(1.5)",
          zIndex: -1,
          opacity: interpolate(frame, [delay + 10, delay + 35], [0, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      />
    </div>
  );
};

// ============================================
// UI CARD COMPONENTS
// ============================================

export const NotificationCard: React.FC<{
  title: string;
  message: string;
  actionText?: string;
  logoColor?: string;
  delay?: number;
}> = ({ title, message, actionText, logoColor = "#8b5cf6", delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springValue = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const y = interpolate(springValue, [0, 1], [50, 0], { extrapolateRight: "clamp" });
  const opacity = interpolate(springValue, [0, 1], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(springValue, [0, 1], [0.9, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px)",
        borderRadius: 24,
        padding: 24,
        boxShadow: "0 25px 50px rgba(0,0,0,0.15)",
        maxWidth: 400,
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${logoColor}, #ec4899)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            viewBox="0 0 24 24"
            style={{ width: 20, height: 20, color: "#fff" }}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontWeight: 600, color: "#111827", fontSize: 18, margin: "0 0 4px 0" }}>
            {title}
          </h3>
          <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>{message}</p>
          {actionText && (
            <button
              style={{
                marginTop: 16,
                padding: "10px 20px",
                background: `linear-gradient(135deg, ${logoColor}, #ec4899)`,
                color: "#fff",
                borderRadius: 20,
                border: "none",
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {actionText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const FeatureCard: React.FC<{
  icon: string;
  title: string;
  description: string;
  delay?: number;
  accentColor?: string;
}> = ({ icon, title, description, delay = 0, accentColor = "#8b5cf6" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springValue = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const y = interpolate(springValue, [0, 1], [40, 0], { extrapolateRight: "clamp" });
  const opacity = interpolate(springValue, [0, 1], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.05)",
        border: `1px solid ${accentColor}20`,
        borderRadius: 20,
        padding: 28,
        opacity,
        transform: `translateY(${y}px)`,
        backdropFilter: "blur(10px)",
        transition: "all 0.3s",
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 15, color: "#9ca3af", lineHeight: 1.5 }}>{description}</div>
    </div>
  );
};

export const DashboardCard: React.FC<{
  title: string;
  value: string;
  subtitle?: string;
  delay?: number;
  trend?: "up" | "down" | "neutral";
}> = ({ title, value, subtitle, delay = 0, trend = "neutral" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springValue = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  const scale = interpolate(springValue, [0, 1], [0.9, 1], { extrapolateRight: "clamp" });

  const trendColors = {
    up: "#10b981",
    down: "#ef4444",
    neutral: "#6b7280",
  };

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: 20,
        padding: 24,
        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 8 }}>{title}</div>
      <div
        style={{
          fontSize: 36,
          fontWeight: 700,
          color: trendColors[trend],
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 8 }}>{subtitle}</div>
      )}
    </div>
  );
};

export const ProgressCard: React.FC<{
  title: string;
  progress: number;
  status: string;
  delay?: number;
}> = ({ title, progress, status, delay = 0 }) => {
  const frame = useCurrentFrame();
  const targetProgress = Math.min(progress, interpolate(frame, [delay, delay + 60], [0, progress], { extrapolateRight: "clamp" }));

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.95)",
        borderRadius: 20,
        padding: 24,
        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        maxWidth: 500,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ fontWeight: 600, color: "#111827", margin: 0 }}>{title}</h3>
        <span style={{ color: "#10b981", fontSize: 14, fontWeight: 500 }}>{status}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 14, color: "#6b7280", minWidth: 40 }}>{Math.round(targetProgress)}%</span>
        <div style={{ flex: 1, height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${targetProgress}%`,
              background: "linear-gradient(90deg, #8b5cf6, #ec4899)",
              borderRadius: 4,
              transition: "width 0.1s linear",
            }}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================
// DEVICE MOCKUPS
// ============================================

export const PhoneMockup: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rotateY = spring({
    frame: Math.max(0, frame - delay),
    fps,
    from: -25,
    to: -8,
    config: { damping: 20, stiffness: 60 },
  });

  return (
    <div
      style={{
        width: 280,
        height: 560,
        background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
        borderRadius: 40,
        padding: 10,
        boxShadow: "0 50px 100px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)",
        transform: `perspective(1000px) rotateY(${rotateY}deg) rotateX(5deg)`,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000",
          borderRadius: 32,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: "50%",
            transform: "translateX(-50%)",
            width: 90,
            height: 24,
            background: "#000",
            borderRadius: "0 0 14px 14px",
            zIndex: 10,
          }}
        />
        {children}
      </div>
    </div>
  );
};

export const LaptopMockup: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rotateX = spring({
    frame: Math.max(0, frame - delay),
    fps,
    from: 20,
    to: -5,
    config: { damping: 20, stiffness: 60 },
  });

  const scale = spring({
    frame: Math.max(0, frame - delay),
    fps,
    from: 0.9,
    to: 1,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <div
      style={{
        transform: `perspective(1200px) rotateX(${rotateX}deg) scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Screen */}
      <div
        style={{
          width: 720,
          height: 450,
          background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
          borderRadius: "12px 12px 0 0",
          padding: 8,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 30px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#0a0a0a",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      </div>
      {/* Base */}
      <div
        style={{
          width: 800,
          height: 14,
          background: "linear-gradient(180deg, #3a3a3a, #2a2a2a)",
          borderRadius: "0 0 10px 10px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
};

// ============================================
// TYPOGRAPHY COMPONENTS
// ============================================

export const AnimatedHeading: React.FC<{
  children: React.ReactNode;
  size?: "xl" | "lg" | "md";
  delay?: number;
}> = ({ children, size = "xl", delay = 0 }) => {
  const frame = useCurrentFrame();

  const sizes = {
    xl: 72,
    lg: 48,
    md: 32,
  };

  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(frame, [delay, delay + 20], [30, 0], { extrapolateRight: "clamp" });

  return (
    <h2
      style={{
        fontSize: sizes[size],
        fontWeight: 700,
        color: "#ffffff",
        opacity,
        transform: `translateY(${y}px)`,
        margin: 0,
        lineHeight: 1.2,
      }}
    >
      {children}
    </h2>
  );
};

export const AnimatedBody: React.FC<{
  children: React.ReactNode;
  delay?: number;
  color?: string;
}> = ({ children, delay = 0, color = "#9ca3af" }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [delay, delay + 25], [0, 1], { extrapolateRight: "clamp" });

  return (
    <p
      style={{
        fontSize: 20,
        color,
        opacity,
        lineHeight: 1.6,
        margin: 0,
      }}
    >
      {children}
    </p>
  );
};
