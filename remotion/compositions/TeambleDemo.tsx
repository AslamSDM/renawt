/**
 * SAAS PRODUCT DEMO VIDEO - Teamble Style
 * 
 * This composition creates a modern, professional SaaS product demo video
 * similar to high-end product marketing videos. Features:
 * 
 * - Smooth scroll-based storytelling
 * - App mockups with realistic interactions
 * - Feature highlights with bento grid layouts
 * - Smooth transitions and micro-interactions
 * - Clean, minimal aesthetic with accent colors
 * - Metrics/stats animations
 * - Call-to-action finale
 */

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Img,
  staticFile,
} from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

// Animation Components
const FadeIn: React.FC<{ children: React.ReactNode; delay?: number; duration?: number }> = ({
  children,
  delay = 0,
  duration = 30,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <div style={{ opacity }}>{children}</div>;
};

const SlideIn: React.FC<{
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

  const distance = 100;
  const transforms: Record<string, string> = {
    left: `translateX(${distance - springValue * distance}px)`,
    right: `translateX(${-distance + springValue * distance}px)`,
    up: `translateY(${distance - springValue * distance}px)`,
    down: `translateY(${-distance + springValue * distance}px)`,
  };

  return <div style={{ transform: transforms[direction] }}>{children}</div>;
};

const ScaleIn: React.FC<{ children: React.ReactNode; delay?: number }> = ({
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

// Typography Components
const H1: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(frame, [delay, delay + 20], [30, 0], { extrapolateRight: "clamp" });

  return (
    <h1
      style={{
        fontSize: 72,
        fontWeight: 700,
        color: "#ffffff",
        opacity,
        transform: `translateY(${y}px)`,
        lineHeight: 1.1,
        margin: 0,
      }}
    >
      {children}
    </h1>
  );
};

const H2: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(frame, [delay, delay + 20], [20, 0], { extrapolateRight: "clamp" });

  return (
    <h2
      style={{
        fontSize: 48,
        fontWeight: 600,
        color: "#ffffff",
        opacity,
        transform: `translateY(${y}px)`,
        margin: 0,
      }}
    >
      {children}
    </h2>
  );
};

const Body: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 25], [0, 1], { extrapolateRight: "clamp" });

  return (
    <p
      style={{
        fontSize: 24,
        color: "#a0a0a0",
        opacity,
        lineHeight: 1.6,
        margin: 0,
      }}
    >
      {children}
    </p>
  );
};

// App Mockup Component
const PhoneMockup: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rotateY = spring({
    frame: Math.max(0, frame - delay),
    fps,
    from: -15,
    to: 0,
    config: { damping: 20, stiffness: 80 },
  });

  return (
    <div
      style={{
        width: 320,
        height: 640,
        background: "#000000",
        borderRadius: 40,
        border: "12px solid #1a1a1a",
        boxShadow: "0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
        transform: `perspective(1000px) rotateY(${rotateY}deg)`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Notch */}
      <div
        style={{
          width: 120,
          height: 28,
          background: "#000000",
          borderRadius: "0 0 20px 20px",
          margin: "0 auto",
          position: "relative",
          zIndex: 10,
        }}
      />
      {children}
    </div>
  );
};

const LaptopMockup: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: Math.max(0, frame - delay),
    fps,
    from: 0.9,
    to: 1,
    config: { damping: 18, stiffness: 100 },
  });

  return (
    <div
      style={{
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Screen */}
      <div
        style={{
          width: 900,
          height: 560,
          background: "#0a0a0a",
          borderRadius: "12px 12px 0 0",
          border: "2px solid #2a2a2a",
          borderBottom: "none",
          overflow: "hidden",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.05)",
          padding: 10,
        }}
      >
        {/* Browser Chrome */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10, padding: "0 10px" }}>
          {["#ff5f56", "#ffbd2e", "#27c93f"].map((color) => (
            <div
              key={color}
              style={{ width: 12, height: 12, borderRadius: "50%", background: color }}
            />
          ))}
        </div>
        {children}
      </div>
      {/* Base */}
      <div
        style={{
          width: 1000,
          height: 16,
          background: "linear-gradient(180deg, #3a3a3a, #2a2a2a)",
          borderRadius: "0 0 12px 12px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        }}
      />
    </div>
  );
};

// UI Components
const Button: React.FC<{ children: React.ReactNode; variant?: "primary" | "secondary" }> = ({
  children,
  variant = "primary",
}) => {
  const isPrimary = variant === "primary";
  return (
    <div
      style={{
        padding: "16px 32px",
        background: isPrimary
          ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
          : "rgba(255,255,255,0.1)",
        borderRadius: 12,
        color: "#ffffff",
        fontSize: 18,
        fontWeight: 600,
        display: "inline-block",
        boxShadow: isPrimary ? "0 4px 20px rgba(99,102,241,0.4)" : "none",
        border: isPrimary ? "none" : "1px solid rgba(255,255,255,0.2)",
      }}
    >
      {children}
    </div>
  );
};

const Card: React.FC<{ icon: string; title: string; description: string; delay?: number }> = ({
  icon,
  title,
  description,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(frame, [delay, delay + 20], [40, 0], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 30,
        opacity,
        transform: `translateY(${y}px)`,
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 600, color: "#ffffff", marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ fontSize: 16, color: "#808080", lineHeight: 1.5 }}>{description}</div>
    </div>
  );
};

const Stat: React.FC<{ value: string; label: string; delay?: number }> = ({
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
          fontWeight: 700,
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          transform: `scale(${0.8 + scale * 0.2})`,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 16, color: "#808080", marginTop: 8 }}>{label}</div>
    </div>
  );
};

// Scene Components
const HeroScene: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #0a0a0a 0%, #111111 100%)",
        padding: 80,
      }}
    >
      {/* Logo */}
      <FadeIn delay={0}>
        <div
          style={{
            width: 80,
            height: 80,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            borderRadius: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <span style={{ fontSize: 40 }}>⚡</span>
        </div>
      </FadeIn>

      <H1 delay={20}>Work Together</H1>
      <H1 delay={35}>Like Never Before</H1>

      <div style={{ marginTop: 30, maxWidth: 600, textAlign: "center" }}>
        <Body delay={50}>
          The all-in-one platform that helps teams collaborate, manage projects, and ship faster.
        </Body>
      </div>

      <div style={{ marginTop: 50, display: "flex", gap: 20 }}>
        <FadeIn delay={70}>
          <Button>Get Started Free</Button>
        </FadeIn>
        <FadeIn delay={85}>
          <Button variant="secondary">Watch Demo</Button>
        </FadeIn>
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
        background: "linear-gradient(180deg, #111111 0%, #0a0a0a 100%)",
        padding: 80,
      }}
    >
      <div style={{ maxWidth: 500 }}>
        <H2 delay={0}>Tired of scattered tools?</H2>
        <div style={{ marginTop: 20 }}>
          <Body delay={20}>
            Jumping between Slack, Trello, Google Docs, and Zoom? We were too. That&apos;s why we
            built Teamble — everything you need, in one place.
          </Body>
        </div>

        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            "✓ No more app switching",
            "✓ Everything syncs automatically",
            "✓ One subscription, not ten",
          ].map((item, i) => (
            <SlideIn key={i} direction="left" delay={40 + i * 10}>
              <div style={{ fontSize: 20, color: "#a0a0a0" }}>{item}</div>
            </SlideIn>
          ))}
        </div>
      </div>

      <ScaleIn delay={30}>
        <LaptopMockup>
          <div
            style={{
              background: "linear-gradient(135deg, #1a1a2e, #0f0f1a)",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              padding: 20,
            }}
          >
            {/* Fake UI */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              {["#ff6b6b", "#4ecdc4", "#45b7d1"].map((c) => (
                <div key={c} style={{ width: 40, height: 40, background: c, borderRadius: 8 }} />
              ))}
            </div>
            <div
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <div style={{ width: "60%", height: 16, background: "#333", borderRadius: 4 }} />
              <div
                style={{ width: "80%", height: 16, background: "#333", borderRadius: 4, marginTop: 10 }}
              />
            </div>
          </div>
        </LaptopMockup>
      </ScaleIn>
    </AbsoluteFill>
  );
};

const FeaturesScene: React.FC = () => {
  const features = [
    { icon: "💬", title: "Team Chat", description: "Real-time messaging with threads, reactions, and file sharing" },
    { icon: "📊", title: "Project Boards", description: "Kanban-style boards to track progress and manage workflows" },
    { icon: "📹", title: "Video Calls", description: "HD video conferencing built right into your workspace" },
    { icon: "📝", title: "Docs & Notes", description: "Collaborative documents that live alongside your projects" },
    { icon: "🔔", title: "Smart Notifications", description: "Get notified about what matters, mute the noise" },
    { icon: "🔒", title: "Enterprise Security", description: "SOC 2 compliant with end-to-end encryption" },
  ];

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        padding: 80,
      }}
    >
      <H2 delay={0}>Everything you need</H2>
      <div style={{ marginTop: 10, marginBottom: 60 }}>
        <Body delay={15}>Powerful features, beautifully simple</Body>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 24,
          maxWidth: 1200,
        }}
      >
        {features.map((f, i) => (
          <Card key={i} {...f} delay={30 + i * 12} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const AppDemoScene: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 80,
        background: "linear-gradient(180deg, #0a0a0a 0%, #111111 100%)",
        padding: 80,
      }}
    >
      <SlideIn direction="up" delay={0}>
        <PhoneMockup>
          <div
            style={{
              flex: 1,
              background: "linear-gradient(180deg, #1a1a2e, #0f0f1a)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 15,
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div
                style={{ width: 36, height: 36, background: "#6366f1", borderRadius: 10 }}
              />
              <div style={{ fontSize: 18, fontWeight: 600, color: "#fff" }}>Teamble</div>
            </div>

            {/* Cards */}
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 12,
                  padding: 16,
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      background: ["#ff6b6b", "#4ecdc4", "#45b7d1"][i - 1],
                      borderRadius: 8,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "#fff" }}>
                      Project {i}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>5 tasks pending</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </PhoneMockup>
      </SlideIn>

      <div style={{ maxWidth: 450 }}>
        <H2 delay={40}>Take it anywhere</H2>
        <div style={{ marginTop: 20 }}>
          <Body delay={60}>
            Stay connected with your team on iOS and Android. Get push notifications, reply to
            messages, and manage tasks on the go.
          </Body>
        </div>

        <div style={{ marginTop: 40, display: "flex", gap: 20 }}>
          <FadeIn delay={80}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🍎</span>
              <span style={{ fontSize: 16, color: "#a0a0a0" }}>iOS</span>
            </div>
          </FadeIn>
          <FadeIn delay={95}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🤖</span>
              <span style={{ fontSize: 16, color: "#a0a0a0" }}>Android</span>
            </div>
          </FadeIn>
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
        background: "linear-gradient(180deg, #111111 0%, #0a0a0a 100%)",
        padding: 80,
      }}
    >
      <H2 delay={0}>Trusted by teams worldwide</H2>
      <div style={{ marginTop: 10, marginBottom: 80 }}>
        <Body delay={15}>Join thousands of companies shipping faster</Body>
      </div>

      <div style={{ display: "flex", gap: 120 }}>
        <Stat value="10K+" label="Active Teams" delay={30} />
        <Stat value="1M+" label="Tasks Completed" delay={45} />
        <Stat value="99.9%" label="Uptime" delay={60} />
      </div>

      {/* Logos */}
      <div style={{ marginTop: 100, display: "flex", gap: 60, opacity: 0.4 }}>
        {["Stripe", "Notion", "Figma", "Linear", "Vercel"].map((company, i) => (
          <FadeIn key={company} delay={80 + i * 15}>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#fff" }}>{company}</div>
          </FadeIn>
        ))}
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
        background: "linear-gradient(180deg, #0a0a0a 0%, #111111 50%, #0a0a0a 100%)",
        padding: 80,
      }}
    >
      <ScaleIn delay={0}>
        <div
          style={{
            width: 100,
            height: 100,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            borderRadius: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
            boxShadow: "0 20px 60px rgba(99,102,241,0.3)",
          }}
        >
          <span style={{ fontSize: 48 }}>⚡</span>
        </div>
      </ScaleIn>

      <H1 delay={30}>Ready to get started?</H1>
      <div style={{ marginTop: 20, maxWidth: 500, textAlign: "center" }}>
        <Body delay={50}>Join 10,000+ teams already shipping faster with Teamble.</Body>
      </div>

      <div style={{ marginTop: 60 }}>
        <FadeIn delay={70}>
          <Button>Start Free Trial</Button>
        </FadeIn>
      </div>

      <div style={{ marginTop: 30 }}>
        <FadeIn delay={90}>
          <div style={{ fontSize: 16, color: "#666" }}>No credit card required</div>
        </FadeIn>
      </div>
    </AbsoluteFill>
  );
};

// Main Composition
export const TeambleDemoVideo: React.FC = () => {
  return (
    <TransitionSeries>
      {/* Scene 1: Hero (0-4s) */}
      <TransitionSeries.Sequence durationInFrames={120}>
        <HeroScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />

      {/* Scene 2: Problem (4-10s) */}
      <TransitionSeries.Sequence durationInFrames={180}>
        <ProblemScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={slide({ direction: "from-right" })} timing={springTiming({ config: { damping: 20, stiffness: 100 } })} />

      {/* Scene 3: Features (10-16s) */}
      <TransitionSeries.Sequence durationInFrames={180}>
        <FeaturesScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 15 })} />

      {/* Scene 4: App Demo (16-23s) */}
      <TransitionSeries.Sequence durationInFrames={210}>
        <AppDemoScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={springTiming({ config: { damping: 20, stiffness: 100 } })} />

      {/* Scene 5: Stats (23-30s) */}
      <TransitionSeries.Sequence durationInFrames={210}>
        <StatsScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: 20 })} />

      {/* Scene 6: CTA (30-35s) */}
      <TransitionSeries.Sequence durationInFrames={150}>
        <CTAScene />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

export default TeambleDemoVideo;
