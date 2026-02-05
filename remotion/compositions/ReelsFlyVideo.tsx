/**
 * REELSFLY - HIGH ENERGY VIDEO COMPOSITION
 * 
 * This takes a basic script and transforms it into a dynamic,
 * beat-synced, high-energy video with:
 * - Audio-reactive backgrounds
 * - Beat-synced flashes and pulses
 * - Fast-paced kinetic text animations
 * - Glitch effects for impact moments
 * - Particle effects
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
  interpolate,
  spring,
  useCurrentFrame,
  Img,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import {
  GradientMeshBackground,
  ParticleField,
  KineticText,
  GlitchText,
  AudioReactiveGradient,
  BeatFlashEnhanced,
  BeatPulseEnhanced,
  BlurInText,
  StaggerWords,
  StaggerChars,
  GradientText,
  FlipText,
} from "../components/animations";
import { BeatMapProvider, useBeatMap, BeatMap } from "../hooks/useBeatMap";
import { createBeatMapFromBPM } from "../../lib/audio/beatDetection";

// ============================================================================
// TYPES
// ============================================================================
interface Scene {
  id: string;
  startFrame: number;
  endFrame: number;
  type: string;
  content: {
    headline?: string;
    subtext?: string;
    image?: string | null;
    icon?: string | null;
    stats?: Array<{ value: number; label: string; suffix?: string }> | null;
    features?: Array<{ icon: string; title: string; description: string }> | null;
  };
  animation: {
    enter: string;
    exit: string;
    staggerDelay: number;
  };
  style: {
    background: string;
    textColor: string;
    accentColor: string;
    fontSize: string;
    layout: string;
    cardStyle: string;
  };
}

interface VideoScript {
  totalDuration: number;
  scenes: Scene[];
  music: {
    tempo: number;
    mood: string;
  };
}

// ============================================================================
// HIGH ENERGY SCENE RENDERERS
// ============================================================================

const IntroHookScene: React.FC<{ scene: Scene; beatMap: BeatMap }> = ({
  scene,
  beatMap,
}) => {
  const frame = useCurrentFrame();

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
      {/* Glitch effect on the main headline */}
      <GlitchText
        text={scene.content.headline || ""}
        triggerFrame={0}
        duration={20}
        fontSize={scene.style.fontSize === "large" ? 80 : 64}
        color={scene.style.textColor}
        style={{ marginBottom: 30, textAlign: "center" }}
      />

      {/* Subtext with kinetic animation */}
      <KineticText
        text={scene.content.subtext || ""}
        startFrame={45}
        fontSize={32}
        color={scene.style.accentColor}
        charDelay={3}
      />
    </AbsoluteFill>
  );
};

const ProblemSolutionScene: React.FC<{ scene: Scene; beatMap: BeatMap }> = ({
  scene,
  beatMap,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 60,
        padding: 80,
      }}
    >
      {/* Text side */}
      <div style={{ flex: 1, maxWidth: 600 }}>
        <StaggerWords
          text={scene.content.headline || ""}
          staggerDelay={4}
          wordDuration={20}
          fontSize={56}
          color={scene.style.textColor}
          animation="slide-up"
        />
        <BlurInText
          text={scene.content.subtext || ""}
          delay={80}
          duration={30}
          fontSize={28}
          color="#cccccc"
          style={{ marginTop: 20 }}
        />
      </div>

      {/* Image side with beat pulse */}
      <BeatPulseEnhanced beatMap={beatMap} pulseAmount={0.05}>
        <div
          style={{
            width: 300,
            height: 300,
            background: `linear-gradient(135deg, ${scene.style.accentColor}20, ${scene.style.accentColor}40)`,
            borderRadius: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 60px ${scene.style.accentColor}30`,
          }}
        >
          {scene.content.image ? (
            <Img
              src={scene.content.image}
              style={{ width: 200, height: 200, objectFit: "contain" }}
            />
          ) : (
            <span style={{ fontSize: 100 }}>🎬</span>
          )}
        </div>
      </BeatPulseEnhanced>
    </AbsoluteFill>
  );
};

const FeatureGridScene: React.FC<{ scene: Scene; beatMap: BeatMap }> = ({
  scene,
  beatMap,
}) => {
  const frame = useCurrentFrame();
  const features = scene.content.features || [];

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
      {/* Icon with beat pulse */}
      <BeatPulseEnhanced beatMap={beatMap} pulseAmount={0.1}>
        <div style={{ fontSize: 80, marginBottom: 30 }}>
          {scene.content.icon}
        </div>
      </BeatPulseEnhanced>

      {/* Headline with staggered characters */}
      <StaggerChars
        text={scene.content.headline || ""}
        charDelay={2}
        charDuration={15}
        fontSize={64}
        color={scene.style.textColor}
        animation="scale"
      />

      {/* Feature grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 30,
          marginTop: 60,
          maxWidth: 1000,
        }}
      >
        {features.map((feature, index) => (
          <BeatPulseEnhanced
            key={index}
            beatMap={beatMap}
            pulseAmount={0.05}
            animationType="glow"
            glowColor={scene.style.accentColor}
          >
            <div
              style={{
                background: "rgba(255, 255, 255, 0.1)",
                backdropFilter: "blur(10px)",
                borderRadius: 20,
                padding: 30,
                border: `1px solid ${scene.style.accentColor}30`,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 15 }}>
                {feature.icon}
              </div>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: scene.style.textColor,
                  marginBottom: 8,
                }}
              >
                {feature.title}
              </div>
              <div style={{ fontSize: 18, color: "#aaaaaa" }}>
                {feature.description}
              </div>
            </div>
          </BeatPulseEnhanced>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const SplitFeatureScene: React.FC<{ scene: Scene; beatMap: BeatMap }> = ({
  scene,
  beatMap,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 60,
        padding: 80,
      }}
    >
      {/* Image/Visual side */}
      <BeatPulseEnhanced beatMap={beatMap} pulseAmount={0.08}>
        <div
          style={{
            width: 400,
            height: 400,
            background: `linear-gradient(135deg, ${scene.style.accentColor}20, transparent)`,
            borderRadius: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 80px ${scene.style.accentColor}20`,
          }}
        >
          {scene.content.image ? (
            <Img
              src={scene.content.image}
              style={{ width: 350, height: 350, objectFit: "contain" }}
            />
          ) : (
            <span style={{ fontSize: 120 }}>{scene.content.icon}</span>
          )}
        </div>
      </BeatPulseEnhanced>

      {/* Text side */}
      <div style={{ flex: 1, maxWidth: 500 }}>
        <GradientText
          text={scene.content.headline || ""}
          fontSize={56}
          colors={[
            scene.style.textColor,
            scene.style.accentColor,
            scene.style.textColor,
          ]}
          animationDuration={90}
        />
        <BlurInText
          text={scene.content.subtext || ""}
          delay={60}
          duration={30}
          fontSize={28}
          color="#cccccc"
          style={{ marginTop: 20 }}
        />
      </div>
    </AbsoluteFill>
  );
};

const StatsScene: React.FC<{ scene: Scene; beatMap: BeatMap }> = ({
  scene,
  beatMap,
}) => {
  const frame = useCurrentFrame();
  const stats = scene.content.stats || [];

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
      {/* Headline */}
      <KineticText
        text={scene.content.headline || ""}
        startFrame={0}
        fontSize={72}
        color={scene.style.textColor}
        charDelay={2}
        style={{ marginBottom: 20 }}
      />

      {/* Subtext */}
      <BlurInText
        text={scene.content.subtext || ""}
        delay={60}
        duration={30}
        fontSize={28}
        color="#cccccc"
        style={{ marginBottom: 60 }}
      />

      {/* Stats with massive scale pulse */}
      <div
        style={{
          display: "flex",
          gap: 60,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {stats.map((stat, index) => (
          <BeatPulseEnhanced
            key={index}
            beatMap={beatMap}
            pulseAmount={0.15}
            animationType="scale"
          >
            <div
              style={{
                textAlign: "center",
                background: "rgba(0, 0, 0, 0.3)",
                backdropFilter: "blur(10px)",
                borderRadius: 30,
                padding: "40px 60px",
                border: `2px solid ${scene.style.accentColor}`,
              }}
            >
              <div
                style={{
                  fontSize: 96,
                  fontWeight: "bold",
                  color: scene.style.accentColor,
                  lineHeight: 1,
                }}
              >
                {stat.value}
                <span style={{ fontSize: 48 }}>{stat.suffix}</span>
              </div>
              <div
                style={{
                  fontSize: 24,
                  color: scene.style.textColor,
                  marginTop: 10,
                }}
              >
                {stat.label}
              </div>
            </div>
          </BeatPulseEnhanced>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const CTAScene: React.FC<{ scene: Scene; beatMap: BeatMap }> = ({
  scene,
  beatMap,
}) => {
  const frame = useCurrentFrame();

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
      {/* Logo with beat pulse */}
      <BeatPulseEnhanced beatMap={beatMap} pulseAmount={0.12}>
        <div
          style={{
            width: 150,
            height: 150,
            background: `linear-gradient(135deg, ${scene.style.accentColor}, white)`,
            borderRadius: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
            boxShadow: `0 0 60px ${scene.style.accentColor}50`,
          }}
        >
          {scene.content.image ? (
            <Img
              src={scene.content.image}
              style={{ width: 100, height: 100, objectFit: "contain" }}
            />
          ) : (
            <span style={{ fontSize: 60 }}>🎬</span>
          )}
        </div>
      </BeatPulseEnhanced>

      {/* Brand name with glitch */}
      <GlitchText
        text={scene.content.headline || ""}
        triggerFrame={0}
        duration={25}
        fontSize={96}
        color={scene.style.textColor}
        style={{ marginBottom: 20 }}
      />

      {/* CTA text with flip animation */}
      <FlipText
        text={scene.content.subtext || ""}
        delay={45}
        duration={30}
        fontSize={36}
        color={scene.style.accentColor}
      />

      {/* Pulsing CTA button */}
      <BeatPulseEnhanced beatMap={beatMap} pulseAmount={0.2} animationType="glow">
        <div
          style={{
            marginTop: 50,
            padding: "20px 60px",
            background: scene.style.accentColor,
            borderRadius: 50,
            fontSize: 28,
            fontWeight: "bold",
            color: "#000000",
          }}
        >
          Get Started →
        </div>
      </BeatPulseEnhanced>
    </AbsoluteFill>
  );
};

// ============================================================================
// MAIN COMPOSITION
// ============================================================================

interface ReelsFlyVideoProps {
  script: VideoScript;
}

const ReelsFlyVideoContent: React.FC<ReelsFlyVideoProps> = ({ script }) => {
  const { durationInFrames, fps } = useVideoConfig();

  // Create beat map from the script's tempo
  const beatMap = createBeatMapFromBPM(
    script.music.tempo,
    durationInFrames / fps,
    fps
  );

  // Extract base colors from first scene for background
  const baseColors = ["#000000", "#1e1b4b", "#312e81"];
  const accentColors = ["#6366F1", "#818cf8", "#a5b4fc"];

  return (
    <BeatMapProvider value={beatMap}>
      <AbsoluteFill>
        {/* Dynamic audio-reactive background */}
        <AudioReactiveGradient
          baseColors={baseColors}
          accentColors={accentColors}
          beatMap={beatMap}
        />

        {/* Particle overlay */}
        <ParticleField
          particleCount={50}
          color="#6366F1"
          maxSize={3}
          speed={0.8}
        />

        {/* Beat flash overlay - stronger on downbeats */}
        <BeatFlashEnhanced
          beatMap={beatMap}
          color="rgba(99, 102, 241, 0.2)"
          intensity={0.4}
          decayFrames={10}
          flashOnDownbeat={true}
        />

        <TransitionSeries>
          {script.scenes.map((scene, index) => {
            const duration = scene.endFrame - scene.startFrame;

            return (
              <React.Fragment key={scene.id}>
                <TransitionSeries.Sequence durationInFrames={duration}>
                  {/* Render scene based on type */}
                  {scene.type === "intro" && index === 0 && (
                    <IntroHookScene scene={scene} beatMap={beatMap} />
                  )}
                  {scene.type === "intro" && index === 1 && (
                    <ProblemSolutionScene scene={scene} beatMap={beatMap} />
                  )}
                  {scene.type === "feature" &&
                    scene.style.layout === "bento" && (
                      <FeatureGridScene scene={scene} beatMap={beatMap} />
                    )}
                  {scene.type === "feature" &&
                    scene.style.layout === "split" && (
                      <SplitFeatureScene scene={scene} beatMap={beatMap} />
                    )}
                  {scene.type === "feature" &&
                    scene.content.features &&
                    scene.content.features.length === 1 && (
                      <SplitFeatureScene scene={scene} beatMap={beatMap} />
                    )}
                  {scene.type === "stats" && (
                    <StatsScene scene={scene} beatMap={beatMap} />
                  )}
                  {scene.type === "cta" && (
                    <CTAScene scene={scene} beatMap={beatMap} />
                  )}
                </TransitionSeries.Sequence>

                {/* Fast transitions between scenes */}
                {index < script.scenes.length - 1 && (
                  <TransitionSeries.Transition
                    presentation={fade()}
                    timing={linearTiming({ durationInFrames: 15 })} // Fast 15-frame transitions
                  />
                )}
              </React.Fragment>
            );
          })}
        </TransitionSeries>
      </AbsoluteFill>
    </BeatMapProvider>
  );
};

export default ReelsFlyVideoContent;
