import React from "react";
import {
  Composition,
  Sequence,
  AbsoluteFill,
  useVideoConfig,
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
} from "../components/animations";
import { BeatMap, BeatMapProvider } from "../hooks/useBeatMap";
import { createBeatMapFromBPM } from "../../lib/audio/beatDetection";

// ============================================
// TECH PRODUCT LAUNCH TEMPLATE
// High-energy, fast-paced tech product video
// Features: Glitch reveals, kinetic text, particle effects
// ============================================
export interface ProductData {
  name: string;
  tagline: string;
  description: string;
  features: Array<{ title: string; description: string; icon?: string }>;
  images: string[];
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

interface TechLaunchProps {
  data: ProductData;
  bpm?: number;
}

const TechLaunchContent: React.FC<TechLaunchProps> = ({
  data,
  bpm = 128,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const beatMap = createBeatMapFromBPM(bpm, durationInFrames / fps, fps);

  // Scene timing (in frames at 30fps)
  const SCENE_1_DURATION = 90; // 3 seconds
  const SCENE_2_DURATION = 150; // 5 seconds
  const SCENE_3_DURATION = 120; // 4 seconds
  const SCENE_4_DURATION = 90; // 3 seconds
  const SCENE_5_DURATION = 150; // 5 seconds
  const SCENE_6_DURATION = 90; // 3 seconds

  return (
    <BeatMapProvider value={beatMap}>
      <AbsoluteFill>
        {/* Audio-reactive background */}
        <AudioReactiveGradient
          baseColors={[data.colors.primary, data.colors.secondary, "#0a0a15"]}
          accentColors={[data.colors.accent, data.colors.primary, "#ffffff"]}
          beatMap={beatMap}
        />

        {/* Particle overlay */}
        <ParticleField
          particleCount={40}
          color={data.colors.accent}
          maxSize={3}
          speed={0.8}
        />

        {/* Beat flash overlay */}
        <BeatFlashEnhanced
          beatMap={beatMap}
          color={`${data.colors.accent}40`}
          intensity={0.4}
          decayFrames={8}
        />

        <TransitionSeries>
          {/* Scene 1: Hook (0-3s) */}
          <TransitionSeries.Sequence durationInFrames={SCENE_1_DURATION}>
            <AbsoluteFill
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 60,
              }}
            >
              <GlitchText
                text={data.tagline}
                triggerFrame={0}
                duration={20}
                fontSize={72}
                color="#ffffff"
                style={{ marginBottom: 30 }}
              />
              <KineticText
                text="Introducing..."
                startFrame={30}
                fontSize={36}
                color={data.colors.accent}
                charDelay={3}
              />
            </AbsoluteFill>
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={wipe({ direction: "from-left" })}
            timing={linearTiming({ durationInFrames: 15 })}
          />

          {/* Scene 2: Product Hero (3-8s) */}
          <TransitionSeries.Sequence durationInFrames={SCENE_2_DURATION}>
            <AbsoluteFill
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 60,
              }}
            >
              <BeatPulseEnhanced beatMap={beatMap} pulseAmount={0.1}>
                <div
                  style={{
                    width: 300,
                    height: 300,
                    background: `linear-gradient(135deg, ${data.colors.primary}, ${data.colors.accent})`,
                    borderRadius: 30,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 40,
                    boxShadow: `0 0 60px ${data.colors.accent}50`,
                  }}
                >
                  <span style={{ fontSize: 120 }}>📱</span>
                </div>
              </BeatPulseEnhanced>

              <KineticText
                text={data.name}
                startFrame={0}
                fontSize={80}
                color="#ffffff"
                charDelay={2}
              />
              <BlurInText
                text={data.description}
                delay={60}
                duration={30}
                fontSize={28}
                color="#cccccc"
                style={{ marginTop: 20, maxWidth: 700, textAlign: "center" }}
              />
            </AbsoluteFill>
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={slide({ direction: "from-bottom" })}
            timing={linearTiming({ durationInFrames: 12 })}
          />

          {/* Scene 3: Features Intro (8-12s) */}
          <TransitionSeries.Sequence durationInFrames={SCENE_3_DURATION}>
            <AbsoluteFill
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 60,
              }}
            >
              <GlitchText
                text="FEATURES"
                triggerFrame={0}
                duration={15}
                fontSize={56}
                color={data.colors.accent}
              />
              <KineticText
                text="What makes us different"
                startFrame={45}
                fontSize={32}
                color="#ffffff"
                charDelay={2}
              />
            </AbsoluteFill>
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: 10 })}
          />

          {/* Scenes 4-6: Feature Cards (12-23s) */}
          {data.features.slice(0, 3).map((feature, index) => (
            <React.Fragment key={index}>
              <TransitionSeries.Sequence
                durationInFrames={index === 0 ? SCENE_4_DURATION : SCENE_5_DURATION}
              >
                <AbsoluteFill
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 80,
                  }}
                >
                  <BeatPulseEnhanced beatMap={beatMap} pulseAmount={0.08}>
                    <div
                      style={{
                        fontSize: 80,
                        marginBottom: 30,
                      }}
                    >
                      {feature.icon || "✨"}
                    </div>
                  </BeatPulseEnhanced>

                  <KineticText
                    text={feature.title}
                    startFrame={0}
                    fontSize={56}
                    color="#ffffff"
                    charDelay={2}
                    style={{ marginBottom: 20 }}
                  />

                  <StaggerWords
                    text={feature.description}
                    staggerDelay={3}
                    wordDuration={15}
                    fontSize={28}
                    color="#cccccc"
                    animation="slide-up"
                  />
                </AbsoluteFill>
              </TransitionSeries.Sequence>

              {index < 2 && (
                <TransitionSeries.Transition
                  presentation={slide({ direction: "from-right" })}
                  timing={linearTiming({ durationInFrames: 12 })}
                />
              )}
            </React.Fragment>
          ))}

          <TransitionSeries.Transition
            presentation={wipe({ direction: "from-top" })}
            timing={linearTiming({ durationInFrames: 15 })}
          />

          {/* Scene 7: CTA (23-26s) */}
          <TransitionSeries.Sequence durationInFrames={SCENE_6_DURATION}>
            <AbsoluteFill
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 60,
                background: `linear-gradient(180deg, transparent, ${data.colors.primary}30)`,
              }}
            >
              <GlitchText
                text="READY TO START?"
                triggerFrame={0}
                duration={20}
                fontSize={64}
                color="#ffffff"
                style={{ marginBottom: 20 }}
              />

              <BeatPulseEnhanced beatMap={beatMap} pulseAmount={0.15}>
                <div
                  style={{
                    padding: "20px 60px",
                    background: data.colors.accent,
                    borderRadius: 50,
                    fontSize: 32,
                    fontWeight: "bold",
                    color: "#000000",
                    marginTop: 30,
                  }}
                >
                  Get Started Now →
                </div>
              </BeatPulseEnhanced>
            </AbsoluteFill>
          </TransitionSeries.Sequence>
        </TransitionSeries>
      </AbsoluteFill>
    </BeatMapProvider>
  );
};

// ============================================
// APP SHOWCASE TEMPLATE
// Rhythmic, elegant app presentation
// Features: Smooth transitions, beat-synced reveals
// ============================================
interface AppShowcaseProps {
  data: ProductData;
  bpm?: number;
}

const AppShowcaseContent: React.FC<AppShowcaseProps> = ({
  data,
  bpm = 110,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  const beatMap = createBeatMapFromBPM(bpm, durationInFrames / fps, fps);

  return (
    <BeatMapProvider value={beatMap}>
      <AbsoluteFill>
        {/* Aurora background */}
        <GradientMeshBackground
          colors={[data.colors.primary, data.colors.accent, data.colors.secondary]}
          speed={0.8}
        />

        {/* Subtle beat flash */}
        <BeatFlashEnhanced
          beatMap={beatMap}
          color={`${data.colors.primary}20`}
          intensity={0.25}
          decayFrames={12}
          flashOnDownbeat={true}
        />

        <TransitionSeries>
          {/* Scene 1: Intro */}
          <TransitionSeries.Sequence durationInFrames={90}>
            <AbsoluteFill
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BlurInText
                text="Meet"
                delay={0}
                duration={30}
                fontSize={48}
                color="#aaaaaa"
              />
              <KineticText
                text={data.name}
                startFrame={30}
                fontSize={96}
                color="#ffffff"
                charDelay={4}
              />
            </AbsoluteFill>
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: 20 })}
          />

          {/* Scene 2: App Mockup */}
          <TransitionSeries.Sequence durationInFrames={150}>
            <AbsoluteFill
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 60,
                padding: 80,
              }}
            >
              <BeatPulseEnhanced beatMap={beatMap} pulseAmount={0.05}>
                <div
                  style={{
                    width: 280,
                    height: 560,
                    background: "#000000",
                    borderRadius: 40,
                    border: "8px solid #333",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: `0 0 80px ${data.colors.primary}30`,
                  }}
                >
                  <div
                    style={{
                      width: 240,
                      height: 480,
                      background: `linear-gradient(180deg, ${data.colors.primary}20, ${data.colors.accent}20)`,
                      borderRadius: 20,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ fontSize: 60 }}>📱</span>
                  </div>
                </div>
              </BeatPulseEnhanced>

              <div style={{ maxWidth: 500 }}>
                <StaggerWords
                  text={data.tagline}
                  staggerDelay={4}
                  wordDuration={20}
                  fontSize={42}
                  color="#ffffff"
                  animation="slide-up"
                />
              </div>
            </AbsoluteFill>
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={slide({ direction: "from-left" })}
            timing={linearTiming({ durationInFrames: 15 })}
          />

          {/* Scenes 3-5: Features */}
          {data.features.slice(0, 3).map((feature, index) => (
            <React.Fragment key={index}>
              <TransitionSeries.Sequence durationInFrames={120}>
                <AbsoluteFill
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 80,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 40,
                      marginBottom: 40,
                    }}
                  >
                    <BeatPulseEnhanced beatMap={beatMap} pulseAmount={0.1}>
                      <div
                        style={{
                          width: 80,
                          height: 80,
                          background: data.colors.accent,
                          borderRadius: 20,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 40,
                        }}
                      >
                        {feature.icon || "⚡"}
                      </div>
                    </BeatPulseEnhanced>

                    <KineticText
                      text={feature.title}
                      startFrame={0}
                      fontSize={48}
                      color="#ffffff"
                      charDelay={3}
                    />
                  </div>

                  <BlurInText
                    text={feature.description}
                    delay={45}
                    duration={30}
                    fontSize={28}
                    color="#cccccc"
                    style={{ maxWidth: 600, textAlign: "center" }}
                  />
                </AbsoluteFill>
              </TransitionSeries.Sequence>

              {index < 2 && (
                <TransitionSeries.Transition
                  presentation={fade()}
                  timing={linearTiming({ durationInFrames: 12 })}
                />
              )}
            </React.Fragment>
          ))}

          <TransitionSeries.Transition
            presentation={wipe({ direction: "from-bottom" })}
            timing={linearTiming({ durationInFrames: 15 })}
          />

          {/* Final CTA */}
          <TransitionSeries.Sequence durationInFrames={90}>
            <AbsoluteFill
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GlitchText
                text="Download Now"
                triggerFrame={0}
                duration={20}
                fontSize={72}
                color="#ffffff"
              />
              <BlurInText
                text="Available on iOS & Android"
                delay={45}
                duration={25}
                fontSize={28}
                color="#aaaaaa"
                style={{ marginTop: 20 }}
              />
            </AbsoluteFill>
          </TransitionSeries.Sequence>
        </TransitionSeries>
      </AbsoluteFill>
    </BeatMapProvider>
  );
};

// ============================================
// Export Components (for use in compositions)
// ============================================
export { TechLaunchContent, AppShowcaseContent };

// Default export
export default {
  TechLaunchContent,
  AppShowcaseContent,
};
