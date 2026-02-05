/**
 * Premium Scene Templates - Pre-built components for high-quality video generation
 * These are ready-to-use components that ensure premium animations work correctly.
 */

import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  Easing,
} from "remotion";

// ============================================================================
// ANIMATION PRIMITIVES
// ============================================================================

export const BlurInText: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  color?: string;
}> = ({ text, fontSize = 72, delay = 0, color = "#ffffff" }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const blur = interpolate(f, [0, 25], [15, 0], { extrapolateRight: "clamp" });
  const y = interpolate(f, [0, 25], [30, 0], { extrapolateRight: "clamp" });

  return (
    <span
      style={{
        fontSize,
        fontWeight: "bold",
        fontFamily: "system-ui, sans-serif",
        color,
        opacity,
        filter: `blur(${blur}px)`,
        transform: `translateY(${y}px)`,
        display: "inline-block",
      }}
    >
      {text}
    </span>
  );
};

export const StaggerWords: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  staggerDelay?: number;
  color?: string;
}> = ({
  text,
  fontSize = 32,
  delay = 0,
  staggerDelay = 4,
  color = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.3em",
        justifyContent: "center",
        fontSize,
        fontFamily: "system-ui, sans-serif",
        color,
      }}
    >
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * staggerDelay);
        const opacity = interpolate(f, [0, 15], [0, 1], {
          extrapolateRight: "clamp",
        });
        const y = interpolate(f, [0, 15], [20, 0], {
          extrapolateRight: "clamp",
        });
        return (
          <span key={i} style={{ opacity, transform: `translateY(${y}px)` }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

export const ScaleIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const scale = spring({
    frame: f,
    fps,
    from: 0,
    to: 1,
    config: { damping: 15 },
  });
  const opacity = interpolate(f, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ transform: `scale(${scale})`, opacity }}>{children}</div>
  );
};

// ============================================================================
// BACKGROUNDS
// ============================================================================

export const GradientMeshBackground: React.FC<{
  primary: string;
  secondary: string;
}> = ({ primary, secondary }) => {
  const frame = useCurrentFrame();
  const offset = (frame * 0.5) % 100;

  return (
    <AbsoluteFill
      style={{
        background: `
        radial-gradient(ellipse 80% 80% at ${20 + offset * 0.3}% ${30}%, ${primary}40 0%, transparent 50%),
        radial-gradient(ellipse 60% 60% at ${80 - offset * 0.2}% ${70}%, ${secondary}40 0%, transparent 45%),
        linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)
      `,
      }}
    />
  );
};

export const SolidGradientBackground: React.FC<{
  gradient: string;
}> = ({ gradient }) => {
  return <AbsoluteFill style={{ background: gradient }} />;
};

// ============================================================================
// CARDS
// ============================================================================

export const GlassCard: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const scale = spring({
    frame: f,
    fps,
    from: 0.9,
    to: 1,
    config: { damping: 15, stiffness: 100 },
  });
  const opacity = interpolate(f, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 24,
        border: "1px solid rgba(255, 255, 255, 0.15)",
        padding: 40,
        opacity,
        transform: `scale(${scale})`,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      }}
    >
      {children}
    </div>
  );
};

// ============================================================================
// SCENE TEMPLATES
// ============================================================================

interface SceneColors {
  primary: string;
  secondary: string;
  text: string;
  accent: string;
}

export const IntroScene: React.FC<{
  headline: string;
  subtext: string;
  colors: SceneColors;
}> = ({ headline, subtext, colors }) => {
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <BlurInText text={headline} fontSize={84} color={colors.text} delay={0} />
      <div style={{ marginTop: 30 }}>
        <StaggerWords
          text={subtext}
          fontSize={32}
          color={colors.text}
          delay={20}
        />
      </div>
    </AbsoluteFill>
  );
};

export const FeatureScene: React.FC<{
  headline: string;
  subtext: string;
  icon?: string;
  features?: Array<{ icon: string; title: string; description: string }>;
  colors: SceneColors;
  layout?: "centered" | "split" | "bento";
}> = ({ headline, subtext, icon, features, colors, layout = "centered" }) => {
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 60,
      }}
    >
      {icon && (
        <ScaleIn delay={0}>
          <div style={{ fontSize: 80, marginBottom: 20 }}>{icon}</div>
        </ScaleIn>
      )}
      <BlurInText
        text={headline}
        fontSize={72}
        color={colors.text}
        delay={10}
      />
      <div style={{ marginTop: 20, marginBottom: 40 }}>
        <StaggerWords
          text={subtext}
          fontSize={28}
          color={colors.text}
          delay={25}
        />
      </div>
      {features && features.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 30,
            flexWrap: "wrap",
            justifyContent: "center",
            maxWidth: 1000,
          }}
        >
          {features.map((feature, i) => (
            <GlassCard key={i} delay={40 + i * 10}>
              <div
                style={{
                  textAlign: "center",
                  color: colors.text,
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                <div style={{ fontSize: 48, marginBottom: 10 }}>
                  {feature.icon}
                </div>
                <div style={{ fontSize: 24, fontWeight: "bold" }}>
                  {feature.title}
                </div>
                <div style={{ fontSize: 16, opacity: 0.8, marginTop: 8 }}>
                  {feature.description}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const CTAScene: React.FC<{
  headline: string;
  subtext: string;
  icon?: string;
  colors: SceneColors;
}> = ({ headline, subtext, icon, colors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = 1 + Math.sin(frame / 15) * 0.05;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
      }}
    >
      <GradientMeshBackground
        primary={colors.accent}
        secondary={colors.primary}
      />
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        {icon && (
          <ScaleIn delay={0}>
            <div
              style={{
                fontSize: 100,
                marginBottom: 30,
                transform: `scale(${pulse})`,
              }}
            >
              {icon}
            </div>
          </ScaleIn>
        )}
        <BlurInText
          text={headline}
          fontSize={78}
          color={colors.text}
          delay={15}
        />
        <div style={{ marginTop: 30 }}>
          <StaggerWords
            text={subtext}
            fontSize={36}
            color={colors.accent}
            delay={35}
            staggerDelay={6}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================================
// MAIN COMPOSITION BUILDER
// ============================================================================

export interface VideoSceneConfig {
  id: string;
  type: "intro" | "feature" | "cta";
  startFrame: number;
  endFrame: number;
  headline: string;
  subtext: string;
  icon?: string;
  features?: Array<{ icon: string; title: string; description: string }>;
  colors: {
    background: string;
    text: string;
    accent: string;
  };
}

export const buildVideoComposition = (scenes: VideoSceneConfig[]) => {
  return () => {
    return (
      <AbsoluteFill style={{ backgroundColor: "#0f0f1a" }}>
        {scenes.map((scene) => {
          const duration = scene.endFrame - scene.startFrame;
          const colors: SceneColors = {
            primary: scene.colors.background.includes("gradient")
              ? "#1E40AF"
              : scene.colors.background,
            secondary: scene.colors.accent,
            text: scene.colors.text,
            accent: scene.colors.accent,
          };

          return (
            <Sequence
              key={scene.id}
              from={scene.startFrame}
              durationInFrames={duration}
            >
              {scene.type === "intro" && (
                <IntroScene
                  headline={scene.headline}
                  subtext={scene.subtext}
                  colors={colors}
                />
              )}
              {scene.type === "feature" && (
                <FeatureScene
                  headline={scene.headline}
                  subtext={scene.subtext}
                  icon={scene.icon}
                  features={scene.features}
                  colors={colors}
                />
              )}
              {scene.type === "cta" && (
                <CTAScene
                  headline={scene.headline}
                  subtext={scene.subtext}
                  icon={scene.icon}
                  colors={colors}
                />
              )}
            </Sequence>
          );
        })}
      </AbsoluteFill>
    );
  };
};
