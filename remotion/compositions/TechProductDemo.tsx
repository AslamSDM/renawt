/**
 * ADVANCED TECH PRODUCT DEMO
 * 
 * A high-energy, fast-paced product demo video with:
 * - Rapid 15-frame transitions
 * - 3D device mockups with rotation
 * - Kinetic typography with glitch effects
 * - Particle systems and beat-synced animations
 * - Dynamic backgrounds with gradients
 * - Premium tech aesthetic
 */

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
  random,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

// ============================================================================
// UTILITY COMPONENTS
// ============================================================================

const GlitchText: React.FC<{ text: string; fontSize?: number; delay?: number }> = ({
  text,
  fontSize = 64,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const offset = Math.max(0, frame - delay);

  if (offset < 0 || offset > 20) {
    return (
      <span style={{ fontSize, fontWeight: 700, color: "#fff" }}>{text}</span>
    );
  }

  const glitchOffset = random(`${frame}`) * 8 - 4;
  const clipTop = random(`${frame}-top`) * 100;
  const clipBottom = random(`${frame}-bottom`) * 100;

  return (
    <span style={{ position: "relative", display: "inline-block", fontSize }}>
      <span style={{ fontWeight: 700, color: "#fff" }}>{text}</span>
      <span
        style={{
          position: "absolute",
          top: glitchOffset,
          left: glitchOffset,
          color: "#00ffff",
          mixBlendMode: "screen",
          opacity: 0.8,
          clipPath: `inset(${clipTop}% 0 ${clipBottom}% 0)`,
          fontWeight: 700,
        }}
      >
        {text}
      </span>
      <span
        style={{
          position: "absolute",
          top: -glitchOffset,
          left: -glitchOffset,
          color: "#ff00ff",
          mixBlendMode: "screen",
          opacity: 0.8,
          clipPath: `inset(${clipBottom}% 0 ${clipTop}% 0)`,
          fontWeight: 700,
        }}
      >
        {text}
      </span>
    </span>
  );
};

const KineticText: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  charDelay?: number;
}> = ({ text, fontSize = 48, delay = 0, charDelay = 2 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <span style={{ display: "flex", flexWrap: "wrap" }}>
      {text.split("").map((char, i) => {
        const charFrame = Math.max(0, frame - delay - i * charDelay);
        const progress = spring({
          frame: charFrame,
          fps,
          config: { mass: 0.5, damping: 12, stiffness: 200 },
        });

        const opacity = interpolate(progress, [0, 1], [0, 1], { extrapolateRight: "clamp" });
        const y = interpolate(progress, [0, 1], [30, 0], { extrapolateRight: "clamp" });

        return (
          <span
            key={i}
            style={{
              fontSize,
              fontWeight: 700,
              color: "#fff",
              opacity,
              transform: `translateY(${y}px)`,
              display: "inline-block",
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </span>
  );
};

const ParticleField: React.FC<{ count?: number; color?: string }> = ({
  count = 50,
  color = "#6366f1",
}) => {
  const frame = useCurrentFrame();

  const particles = React.useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      x: (i * 37) % 100,
      y: (i * 53) % 100,
      size: 2 + (i % 4),
      speed: 0.5 + ((i % 5) / 10),
    }));
  }, [count]);

  return (
    <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
      {particles.map((p, i) => {
        const yOffset = (frame * p.speed) % 120;
        const yPos = ((p.y - yOffset + 120) % 120) - 10;
        const drift = Math.sin(frame * 0.02 + i) * 2;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x + drift}%`,
              top: `${yPos}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: color,
              opacity: 0.3,
              boxShadow: `0 0 ${p.size * 2}px ${color}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const AnimatedGradient: React.FC<{ colors?: string[] }> = ({
  colors = ["#0a0a0a", "#1a1a2e", "#0f0f1a"],
}) => {
  const frame = useCurrentFrame();
  const t = frame * 0.5;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 80% 80% at ${20 + Math.sin(t * 0.01) * 20}% ${30 + Math.cos(t * 0.01) * 20}%, ${colors[0]}40 0%, transparent 50%),
          radial-gradient(ellipse 60% 60% at ${70 + Math.cos(t * 0.008) * 15}% ${60 + Math.sin(t * 0.008) * 15}%, ${colors[1]}30 0%, transparent 45%),
          radial-gradient(ellipse 70% 70% at ${50 + Math.sin(t * 0.012) * 25}% ${20 + Math.cos(t * 0.012) * 20}%, ${colors[2]}35 0%, transparent 40%),
          linear-gradient(180deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)
        `,
      }}
    />
  );
};

// ============================================================================
// DEVICE MOCKUPS
// ============================================================================

const Phone3D: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rotateY = spring({
    frame: Math.max(0, frame - delay),
    fps,
    from: -25,
    to: -5,
    config: { damping: 20, stiffness: 60 },
  });

  const rotateX = spring({
    frame: Math.max(0, frame - delay),
    fps,
    from: 10,
    to: 0,
    config: { damping: 20, stiffness: 60 },
  });

  return (
    <div
      style={{
        width: 300,
        height: 600,
        background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
        borderRadius: 45,
        padding: 12,
        boxShadow: `
          0 50px 100px rgba(0,0,0,0.5),
          0 0 0 1px rgba(255,255,255,0.1),
          inset 0 0 20px rgba(0,0,0,0.5)
        `,
        transform: `
          perspective(1000px) 
          rotateY(${rotateY}deg) 
          rotateX(${rotateX}deg)
          translateZ(50px)
        `,
        transformStyle: "preserve-3d",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#000",
          borderRadius: 35,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 100,
            height: 28,
            background: "#000",
            borderRadius: "0 0 18px 18px",
            zIndex: 10,
          }}
        />
        {children}
      </div>
    </div>
  );
};

const Laptop3D: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rotateX = spring({
    frame: Math.max(0, frame - delay),
    fps,
    from: 15,
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
        transform: `
          perspective(1200px) 
          rotateX(${rotateX}deg)
          scale(${scale})
        `,
        transformStyle: "preserve-3d",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Screen */}
      <div
        style={{
          width: 800,
          height: 500,
          background: "linear-gradient(145deg, #2a2a2a, #1a1a1a)",
          borderRadius: "12px 12px 0 0",
          padding: 10,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.1), 0 30px 60px rgba(0,0,0,0.4)",
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
      {/* Hinge */}
      <div
        style={{
          width: 850,
          height: 12,
          background: "linear-gradient(180deg, #3a3a3a, #2a2a2a)",
          borderRadius: "0 0 6px 6px",
        }}
      />
      {/* Base */}
      <div
        style={{
          width: 900,
          height: 16,
          background: "linear-gradient(180deg, #4a4a4a, #3a3a3a)",
          borderRadius: "0 0 12px 12px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
        }}
      />
    </div>
  );
};

// ============================================================================
// UI COMPONENTS
// ============================================================================

const FeatureCard: React.FC<{
  icon: string;
  title: string;
  desc: string;
  delay?: number;
  highlight?: boolean;
}> = ({ icon, title, desc, delay = 0, highlight = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springValue = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 15, stiffness: 100 },
  });

  const y = interpolate(springValue, [0, 1], [50, 0], { extrapolateRight: "clamp" });
  const opacity = interpolate(springValue, [0, 1], [0, 1], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        background: highlight
          ? "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))"
          : "rgba(255,255,255,0.03)",
        border: highlight ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 20,
        padding: 30,
        opacity,
        transform: `translateY(${y}px)`,
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 16, color: "#888", lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
};

const AnimatedButton: React.FC<{ children: React.ReactNode; primary?: boolean; delay?: number }> = ({
  children,
  primary = true,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  return (
    <div
      style={{
        padding: "18px 40px",
        background: primary
          ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
          : "rgba(255,255,255,0.08)",
        borderRadius: 14,
        color: "#fff",
        fontSize: 18,
        fontWeight: 600,
        transform: `scale(${0.9 + scale * 0.1})`,
        boxShadow: primary
          ? "0 8px 30px rgba(99,102,241,0.4), 0 0 60px rgba(99,102,241,0.2)"
          : "none",
        border: primary ? "none" : "1px solid rgba(255,255,255,0.15)",
        display: "inline-block",
      }}
    >
      {children}
    </div>
  );
};

const StatBadge: React.FC<{ value: string; label: string; delay?: number }> = ({
  value,
  label,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontSize: 56,
          fontWeight: 800,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          transform: `scale(${0.8 + scale * 0.2})`,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 16, color: "#666", marginTop: 8 }}>{label}</div>
    </div>
  );
};

// ============================================================================
// SCENES
// ============================================================================

const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <AnimatedGradient />
      <ParticleField count={60} color="#6366f1" />

      <div style={{ textAlign: "center", zIndex: 10 }}>
        <GlitchText text="NEXUS" fontSize={100} delay={0} />
        <div style={{ marginTop: 20 }}>
          <KineticText text="The Future of Collaboration" fontSize={36} delay={30} charDelay={3} />
        </div>
        <div style={{ marginTop: 50, display: "flex", gap: 20, justifyContent: "center" }}>
          <AnimatedButton primary delay={80}>Get Started</AnimatedButton>
          <AnimatedButton primary={false} delay={95}>Watch Demo</AnimatedButton>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const ProblemScene: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 80,
        padding: 80,
      }}
    >
      <AnimatedGradient colors={["#111111", "#0a0a0a", "#1a1a2e"]} />
      <ParticleField count={40} color="#8b5cf6" />

      <div style={{ maxWidth: 500, zIndex: 10 }}>
        <GlitchText text="Chaos?" fontSize={72} delay={0} />
        <div style={{ marginTop: 20 }}>
          <KineticText
            text="Stop juggling 10 different tools"
            fontSize={28}
            delay={30}
            charDelay={2}
          />
        </div>
        <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 12 }}>
          {["❌ Scattered conversations", "❌ Lost files", "❌ Missed deadlines"].map((item, i) => (
            <div key={i} style={{ fontSize: 20, color: "#ff6b6b", opacity: interpolate(useCurrentFrame(), [40 + i * 10, 60 + i * 10], [0, 1], { extrapolateRight: "clamp" }) }}>
              {item}
            </div>
          ))}
        </div>
      </div>

      <Phone3D delay={20}>
        <div
          style={{
            height: "100%",
            background: "linear-gradient(180deg, #1a1a2e, #0f0f1a)",
            padding: 20,
            paddingTop: 50,
            display: "flex",
            flexDirection: "column",
            gap: 15,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: "rgba(255,255,255,0.05)",
                borderRadius: 12,
                padding: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div style={{ width: 40, height: 40, background: "#ff6b6b", borderRadius: 10, opacity: 0.5 }} />
              <div style={{ flex: 1 }}>
                <div style={{ width: "70%", height: 12, background: "#333", borderRadius: 4 }} />
                <div style={{ width: "50%", height: 8, background: "#222", borderRadius: 4, marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </Phone3D>
    </AbsoluteFill>
  );
};

const SolutionScene: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 80,
        padding: 80,
      }}
    >
      <AnimatedGradient colors={["#0a0a0a", "#1a1a2e", "#111111"]} />

      <Laptop3D delay={0}>
        <div
          style={{
            height: "100%",
            background: "linear-gradient(135deg, #1a1a2e, #0f0f1a)",
            padding: 30,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Fake UI */}
          <div style={{ display: "flex", gap: 10 }}>
            {["#6366f1", "#8b5cf6", "#ec4899"].map((c) => (
              <div key={c} style={{ width: 48, height: 48, background: c, borderRadius: 12 }} />
            ))}
          </div>
          <div
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.03)",
              borderRadius: 16,
              padding: 24,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  background: "rgba(99,102,241,0.1)",
                  borderRadius: 12,
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              />
            ))}
          </div>
        </div>
      </Laptop3D>

      <div style={{ maxWidth: 450, zIndex: 10 }}>
        <GlitchText text="Meet Nexus" fontSize={56} delay={40} />
        <div style={{ marginTop: 20 }}>
          <KineticText text="All your work, unified." fontSize={28} delay={70} charDelay={2} />
        </div>
        <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 12 }}>
          {["✓ Real-time sync", "✓ AI-powered insights", "✓ Enterprise security"].map((item, i) => (
            <div key={i} style={{ fontSize: 20, color: "#4ade80" }}>
              {item}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FeaturesScene: React.FC = () => {
  const features = [
    { icon: "💬", title: "Team Chat", desc: "Channels, DMs, and threads" },
    { icon: "📊", title: "Projects", desc: "Kanban boards & timelines" },
    { icon: "📹", title: "Video", desc: "HD calls & screen share" },
    { icon: "📝", title: "Docs", desc: "Real-time collaboration" },
    { icon: "🤖", title: "AI Agent", desc: "Automate workflows" },
    { icon: "🔒", title: "Security", desc: "SOC 2 & encryption" },
  ];

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <AnimatedGradient colors={["#0a0a0a", "#111111", "#0a0a0a"]} />
      <ParticleField count={30} color="#ec4899" />

      <div style={{ zIndex: 10, textAlign: "center" }}>
        <GlitchText text="Powerful Features" fontSize={56} delay={0} />
        <div style={{ marginTop: 10, marginBottom: 50 }}>
          <KineticText text="Everything you need to ship faster" fontSize={24} delay={30} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            maxWidth: 1100,
          }}
        >
          {features.map((f, i) => (
            <FeatureCard key={i} {...f} delay={50 + i * 10} highlight={i === 4} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const MobileScene: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 100,
        padding: 80,
      }}
    >
      <AnimatedGradient colors={["#111111", "#1a1a2e", "#0a0a0a"]} />

      <Phone3D delay={0}>
        <div
          style={{
            height: "100%",
            background: "linear-gradient(180deg, #6366f1, #8b5cf6)",
            padding: 20,
            paddingTop: 50,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              background: "rgba(255,255,255,0.2)",
              borderRadius: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 30,
            }}
          >
            <span style={{ fontSize: 60 }}>⚡</span>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fff", textAlign: "center" }}>
            Work anywhere
          </div>
          <div style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", marginTop: 10, textAlign: "center" }}>
            iOS & Android
          </div>
        </div>
      </Phone3D>

      <div style={{ maxWidth: 400, zIndex: 10 }}>
        <GlitchText text="Mobile First" fontSize={56} delay={40} />
        <div style={{ marginTop: 20 }}>
          <KineticText text="Your office in your pocket" fontSize={28} delay={70} />
        </div>
        <div style={{ marginTop: 30, display: "flex", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 28 }}>🍎</span>
            <span style={{ fontSize: 18, color: "#888" }}>App Store</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 28 }}>🤖</span>
            <span style={{ fontSize: 18, color: "#888" }}>Play Store</span>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const StatsScene: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <AnimatedGradient colors={["#0a0a0a", "#111111", "#0a0a0a"]} />
      <ParticleField count={50} color="#6366f1" />

      <div style={{ zIndex: 10, textAlign: "center" }}>
        <GlitchText text="Trusted Globally" fontSize={56} delay={0} />
        <div style={{ marginTop: 10, marginBottom: 60 }}>
          <KineticText text="Join 10,000+ teams shipping faster" fontSize={24} delay={30} />
        </div>

        <div style={{ display: "flex", gap: 100 }}>
          <StatBadge value="10K+" label="Teams" delay={50} />
          <StatBadge value="1M+" label="Users" delay={65} />
          <StatBadge value="99.9%" label="Uptime" delay={80} />
        </div>

        <div style={{ marginTop: 80, display: "flex", gap: 50, opacity: 0.4 }}>
          {["Stripe", "Notion", "Figma", "Linear", "Vercel"].map((company, i) => (
            <div key={company} style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>
              {company}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const CTAScene: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <AnimatedGradient colors={["#0a0a0a", "#1a1a2e", "#0a0a0a"]} />
      <ParticleField count={70} color="#8b5cf6" />

      <div
        style={{
          width: 120,
          height: 120,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          borderRadius: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 40,
          boxShadow: "0 30px 60px rgba(99,102,241,0.4)",
        }}
      >
        <span style={{ fontSize: 56 }}>⚡</span>
      </div>

      <GlitchText text="Ready to transform?" fontSize={64} delay={0} />
      <div style={{ marginTop: 20, marginBottom: 50 }}>
        <KineticText text="Start free, upgrade when ready" fontSize={24} delay={40} />
      </div>

      <AnimatedButton primary delay={70}>Get Started Free</AnimatedButton>
      <div style={{ marginTop: 20, fontSize: 16, color: "#666" }}>
        No credit card required
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// MAIN COMPOSITION
// ============================================================================

export const TechProductDemo: React.FC = () => {
  return (
    <TransitionSeries>
      {/* Scene 1: Hero (0-3s) */}
      <TransitionSeries.Sequence durationInFrames={90}>
        <HeroScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />

      {/* Scene 2: Problem (3-7s) */}
      <TransitionSeries.Sequence durationInFrames={120}>
        <ProblemScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={linearTiming({ durationInFrames: 15 })} />

      {/* Scene 3: Solution (7-12s) */}
      <TransitionSeries.Sequence durationInFrames={150}>
        <SolutionScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />

      {/* Scene 4: Features (12-18s) */}
      <TransitionSeries.Sequence durationInFrames={180}>
        <FeaturesScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={linearTiming({ durationInFrames: 15 })} />

      {/* Scene 5: Mobile (18-23s) */}
      <TransitionSeries.Sequence durationInFrames={150}>
        <MobileScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={linearTiming({ durationInFrames: 15 })} />

      {/* Scene 6: Stats (23-29s) */}
      <TransitionSeries.Sequence durationInFrames={180}>
        <StatsScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 20 })} />

      {/* Scene 7: CTA (29-34s) */}
      <TransitionSeries.Sequence durationInFrames={150}>
        <CTAScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

export default TechProductDemo;
