/**
 * DEMO VIDEO COMPOSITION
 * 
 * A professional product demo video with realistic UI mockups
 * Teamble-inspired style with smooth animations
 */

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import {
  FadeIn,
  SlideIn,
  ScaleIn,
  WordByWord,
  LogoAnimation,
  NotificationCard,
  FeatureCard,
  DashboardCard,
  ProgressCard,
  PhoneMockup,
  LaptopMockup,
  AnimatedHeading,
  AnimatedBody,
} from "../components/DemoUIMockups";

// ============================================================================
// SCENE RENDERERS
// ============================================================================

interface DemoScene {
  id: string;
  startFrame: number;
  endFrame: number;
  type: string;
  content: {
    headline?: string;
    subtext?: string;
    notification?: {
      title: string;
      message: string;
      actionText?: string;
    };
    stats?: Array<{
      title: string;
      value: string;
      subtitle?: string;
      trend?: "up" | "down" | "neutral";
    }>;
    progress?: {
      title: string;
      progress: number;
      status: string;
    };
    features?: Array<{
      icon: string;
      title: string;
      description: string;
    }>;
  };
  style: {
    background: string;
    textColor: string;
    accentColor: string;
    cardBackground?: string;
    deviceType?: "none" | "phone" | "laptop";
  };
}

const IntroScene: React.FC<{ scene: DemoScene }> = ({ scene }) => {
  const { name = "Product" } = scene.content as any;
  const parts = name.split(" ");
  const firstPart = parts[0];
  const secondPart = parts.slice(1).join(" ") || "AI";

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: scene.style.background,
      }}
    >
      <LogoAnimation
        name={firstPart + secondPart}
        accentColor={scene.style.accentColor}
        delay={0}
      />
      {scene.content.subtext && (
        <div style={{ marginTop: 30 }}>
          <FadeIn delay={40}>
            <p
              style={{
                fontSize: 24,
                color: scene.style.textColor,
                opacity: 0.8,
                textAlign: "center",
              }}
            >
              {scene.content.subtext}
            </p>
          </FadeIn>
        </div>
      )}
    </AbsoluteFill>
  );
};

const ProblemScene: React.FC<{ scene: DemoScene }> = ({ scene }) => {
  const notification = scene.content.notification;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: scene.style.background,
        padding: 80,
      }}
    >
      <FadeIn delay={0}>
        <h2
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: scene.style.textColor,
            marginBottom: 40,
            textAlign: "center",
          }}
        >
          {scene.content.headline}
        </h2>
      </FadeIn>

      {notification && (
        <SlideIn direction="up" delay={30}>
          <NotificationCard
            title={notification.title}
            message={notification.message}
            actionText={notification.actionText}
            logoColor={scene.style.accentColor}
            delay={30}
          />
        </SlideIn>
      )}
    </AbsoluteFill>
  );
};

const ProductScene: React.FC<{ scene: DemoScene }> = ({ scene }) => {
  const deviceType = scene.style.deviceType || "laptop";

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 80,
        background: scene.style.background,
        padding: 80,
      }}
    >
      <div style={{ maxWidth: 450 }}>
        <WordByWord
          text={scene.content.headline || "Your Product"}
          delay={0}
          className="text-5xl font-bold text-white"
        />
        {scene.content.subtext && (
          <div style={{ marginTop: 20 }}>
            <FadeIn delay={40}>
              <p style={{ fontSize: 20, color: "#9ca3af", lineHeight: 1.6 }}>
                {scene.content.subtext}
              </p>
            </FadeIn>
          </div>
        )}
      </div>

      {deviceType === "phone" ? (
        <PhoneMockup delay={50}>
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
            {/* Fake UI */}
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
                <div
                  style={{
                    width: "100%",
                    height: 12,
                    background: "#333",
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                />
                <div
                  style={{ width: "60%", height: 8, background: "#222", borderRadius: 4 }}
                />
              </div>
            ))}
          </div>
        </PhoneMockup>
      ) : (
        <LaptopMockup delay={50}>
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
            {/* Fake Dashboard UI */}
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              {["#6366f1", "#8b5cf6", "#ec4899"].map((c) => (
                <div key={c} style={{ width: 48, height: 48, background: c, borderRadius: 12 }} />
              ))}
            </div>
            <div
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 16,
                padding: 20,
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 16,
              }}
            >
              {Array.from({ length: 4 }).map((_, i) => (
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
        </LaptopMockup>
      )}
    </AbsoluteFill>
  );
};

const FeatureScene: React.FC<{ scene: DemoScene }> = ({ scene }) => {
  const features = scene.content.features || [];

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: scene.style.background,
        padding: 80,
      }}
    >
      <FadeIn delay={0}>
        <h2
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: scene.style.textColor,
            marginBottom: 60,
            textAlign: "center",
          }}
        >
          {scene.content.headline}
        </h2>
      </FadeIn>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: features.length > 3 ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
          gap: 24,
          maxWidth: 1000,
        }}
      >
        {features.map((feature, i) => (
          <FeatureCard
            key={i}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
            delay={20 + i * 10}
            accentColor={scene.style.accentColor}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const ResultsScene: React.FC<{ scene: DemoScene }> = ({ scene }) => {
  const stats = scene.content.stats || [];
  const progress = scene.content.progress;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: scene.style.background,
        padding: 80,
      }}
    >
      <FadeIn delay={0}>
        <h2
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: scene.style.textColor,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          {scene.content.headline}
        </h2>
      </FadeIn>

      {scene.content.subtext && (
        <FadeIn delay={20}>
          <p style={{ fontSize: 20, color: "#9ca3af", marginBottom: 60, textAlign: "center" }}>
            {scene.content.subtext}
          </p>
        </FadeIn>
      )}

      {progress ? (
        <SlideIn direction="up" delay={40}>
          <ProgressCard
            title={progress.title}
            progress={progress.progress}
            status={progress.status}
            delay={40}
          />
        </SlideIn>
      ) : (
        <div style={{ display: "flex", gap: 60 }}>
          {stats.map((stat, i) => (
            <DashboardCard
              key={i}
              title={stat.title}
              value={stat.value}
              subtitle={stat.subtitle}
              delay={40 + i * 15}
              trend={stat.trend}
            />
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

const CTAScene: React.FC<{ scene: DemoScene }> = ({ scene }) => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: scene.style.background,
        padding: 80,
      }}
    >
      <ScaleIn delay={0}>
        <div
          style={{
            width: 100,
            height: 100,
            background: `linear-gradient(135deg, ${scene.style.accentColor}, #ec4899)`,
            borderRadius: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
            boxShadow: `0 20px 60px ${scene.style.accentColor}40`,
          }}
        >
          <span style={{ fontSize: 48 }}>⚡</span>
        </div>
      </ScaleIn>

      <FadeIn delay={30}>
        <h1
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: scene.style.textColor,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          {scene.content.headline}
        </h1>
      </FadeIn>

      {scene.content.subtext && (
        <FadeIn delay={50}>
          <p style={{ fontSize: 24, color: "#9ca3af", marginBottom: 50, textAlign: "center" }}>
            {scene.content.subtext}
          </p>
        </FadeIn>
      )}

      <FadeIn delay={70}>
        <div
          style={{
            padding: "18px 40px",
            background: `linear-gradient(135deg, ${scene.style.accentColor}, #8b5cf6)`,
            borderRadius: 14,
            color: "#fff",
            fontSize: 18,
            fontWeight: 600,
            boxShadow: `0 8px 30px ${scene.style.accentColor}40`,
            display: "inline-block",
          }}
        >
          Get Started Free
        </div>
      </FadeIn>

      <FadeIn delay={90}>
        <p style={{ fontSize: 16, color: "#666", marginTop: 30 }}>
          No credit card required
        </p>
      </FadeIn>
    </AbsoluteFill>
  );
};

// ============================================================================
// MAIN COMPOSITION
// ============================================================================

interface ProductDemoVideoProps {
  script: {
    totalDuration: number;
    scenes: DemoScene[];
  };
}

export const ProductDemoVideo: React.FC<ProductDemoVideoProps> = ({ script }) => {
  return (
    <TransitionSeries>
      {script.scenes.map((scene, index) => {
        const duration = scene.endFrame - scene.startFrame;

        return (
          <React.Fragment key={scene.id}>
            <TransitionSeries.Sequence durationInFrames={duration}>
              {scene.type === "intro" && <IntroScene scene={scene} />}
              {scene.type === "problem" && <ProblemScene scene={scene} />}
              {scene.type === "product" && <ProductScene scene={scene} />}
              {scene.type === "feature" && <FeatureScene scene={scene} />}
              {scene.type === "results" && <ResultsScene scene={scene} />}
              {scene.type === "cta" && <CTAScene scene={scene} />}
            </TransitionSeries.Sequence>

            {index < script.scenes.length - 1 && (
              <TransitionSeries.Transition
                presentation={index % 2 === 0 ? fade() : slide({ direction: "from-right" })}
                timing={linearTiming({ durationInFrames: 15 })}
              />
            )}
          </React.Fragment>
        );
      })}
    </TransitionSeries>
  );
};

export default ProductDemoVideo;
