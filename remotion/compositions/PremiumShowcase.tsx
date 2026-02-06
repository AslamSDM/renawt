/**
 * PREMIUM SHOWCASE COMPOSITION
 *
 * Demonstrates all premium visual components:
 * - DualRadialGradient background
 * - TextureOverlay (noise + geometric)
 * - IPhoneMockup / MacBookMockup device frames
 * - ThreeScene with FloatingGeometries and AnimatedCamera
 * - CameraWrapper for 2D camera movements
 * - Bebas Neue / Montserrat typography
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { HEADLINE_FONT, BODY_FONT } from "../fonts";
import { DualRadialGradient } from "../components/animations/DualRadialGradient";
import { TextureOverlay } from "../components/animations/TextureOverlay";
import { IPhoneMockup, MacBookMockup } from "../components/animations/DeviceMockups";
import { ThreeScene, FloatingGeometries, AnimatedCamera } from "../components/animations/ThreeScene";
import { CameraWrapper } from "../components/animations/CameraWrapper";
import { BlurInText, StaggerWords } from "../components/animations/TextAnimations";
import { GlitchText, KineticText } from "../components/animations/HighEnergy";
import { ParticleField } from "../components/animations/Backgrounds";

// Color scheme
const COLOR1 = "#6366f1"; // Indigo
const COLOR2 = "#ec4899"; // Pink
const BASE_BG = "#050510";

// ============================================================================
// SCENE 1: INTRO - Big headline with gradient + texture + camera zoom
// ============================================================================
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const subtitleOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const subtitleY = interpolate(frame, [25, 45], [20, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill>
      <DualRadialGradient color1={COLOR1} color2={COLOR2} baseColor={BASE_BG} />
      <TextureOverlay type="both" opacity={0.04} speed={0.8} />
      <ParticleField particleCount={20} color={COLOR1} maxSize={3} speed={0.3} />

      <CameraWrapper zoomRange={[1, 1.12]} panY={[0, -15]}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BlurInText
            text="PREMIUM VIDEO"
            fontSize={140}
            delay={5}
            color="#ffffff"
            style={{ letterSpacing: "0.05em", textTransform: "uppercase" }}
          />
          <div
            style={{
              marginTop: 20,
              opacity: subtitleOpacity,
              transform: `translateY(${subtitleY}px)`,
            }}
          >
            <span
              style={{
                fontFamily: BODY_FONT,
                fontSize: 36,
                color: "rgba(255, 255, 255, 0.8)",
                fontWeight: 500,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              Device Mockups &bull; 3D Animations &bull; Camera Movement
            </span>
          </div>
        </AbsoluteFill>
      </CameraWrapper>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 2: iPhone Mockup with floating animation
// ============================================================================
const IPhoneScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });
  const textX = interpolate(frame, [15, 35], [-40, 0], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill>
      <DualRadialGradient color1={COLOR2} color2={COLOR1} baseColor={BASE_BG} speed={0.7} />
      <TextureOverlay type="noise" opacity={0.03} />

      <CameraWrapper zoomRange={[1.05, 1]} panX={[10, -10]}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 100,
            padding: "0 120px",
          }}
        >
          {/* Text side */}
          <div
            style={{
              flex: 1,
              opacity: textOpacity,
              transform: `translateX(${textX}px)`,
            }}
          >
            <h2
              style={{
                fontFamily: HEADLINE_FONT,
                fontSize: 96,
                color: "#ffffff",
                margin: 0,
                lineHeight: 1,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              MOBILE
              <br />
              FIRST
            </h2>
            <p
              style={{
                fontFamily: BODY_FONT,
                fontSize: 24,
                color: "rgba(255, 255, 255, 0.7)",
                marginTop: 24,
                fontWeight: 400,
                lineHeight: 1.6,
              }}
            >
              Beautiful website previews
              <br />
              inside realistic device mockups
            </p>
          </div>

          {/* iPhone mockup */}
          <IPhoneMockup
            width={320}
            delay={10}
            animation="float"
            style={{ flexShrink: 0 }}
          >
            {/* Placeholder screen content */}
            <div
              style={{
                width: "100%",
                height: "100%",
                background: `linear-gradient(135deg, ${COLOR1}, ${COLOR2})`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 20,
              }}
            >
              <div
                style={{
                  fontFamily: HEADLINE_FONT,
                  fontSize: 28,
                  color: "#ffffff",
                  textAlign: "center",
                  letterSpacing: "0.05em",
                }}
              >
                YOUR APP
              </div>
              <div
                style={{
                  fontFamily: BODY_FONT,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.8)",
                  marginTop: 8,
                }}
              >
                Landing Page Preview
              </div>
              <div
                style={{
                  width: "80%",
                  height: 4,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.3)",
                  marginTop: 20,
                }}
              />
              <div
                style={{
                  width: "60%",
                  height: 4,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.2)",
                  marginTop: 8,
                }}
              />
            </div>
          </IPhoneMockup>
        </AbsoluteFill>
      </CameraWrapper>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 3: MacBook + Three.js 3D geometries
// ============================================================================
const ThreeDScene: React.FC = () => {
  const frame = useCurrentFrame();

  const titleScale = spring({
    frame,
    fps: 30,
    from: 0.8,
    to: 1,
    config: { damping: 15 },
  });
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <DualRadialGradient color1={COLOR1} color2={COLOR2} baseColor="#020208" speed={0.5} />

      {/* Three.js 3D layer */}
      <ThreeScene transparent cameraPosition={[0, 2, 8]} cameraFov={50}>
        <AnimatedCamera
          orbitSpeed={0.4}
          dollyRange={[8, 5]}
          panY={[1, 2.5]}
        />
        <FloatingGeometries
          count={5}
          color1={COLOR1}
          color2={COLOR2}
          speed={0.8}
          opacity={0.5}
          spread={5}
        />
      </ThreeScene>

      {/* Texture on top of 3D */}
      <TextureOverlay type="noise" opacity={0.03} />

      {/* MacBook in the center-bottom */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 60,
        }}
      >
        {/* Title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            marginBottom: 40,
            textAlign: "center",
          }}
        >
          <span
            style={{
              fontFamily: HEADLINE_FONT,
              fontSize: 80,
              color: "#ffffff",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            3D ANIMATIONS
          </span>
        </div>

        <MacBookMockup width={700} delay={15} animation="enter">
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, #0f0f2e, #1a1040)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                fontFamily: BODY_FONT,
                fontSize: 20,
                color: "rgba(255,255,255,0.6)",
                textAlign: "center",
              }}
            >
              Website Preview
            </div>
          </div>
        </MacBookMockup>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// SCENE 4: CTA - Big text with camera zoom
// ============================================================================
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const subOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill>
      <DualRadialGradient color1={COLOR2} color2={COLOR1} baseColor={BASE_BG} speed={1.2} />
      <TextureOverlay type="geometric" opacity={0.05} speed={1.5} color="rgba(255,255,255,0.4)" />

      <CameraWrapper zoomRange={[1, 1.25]} panY={[0, -10]}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <KineticText
            text="GET STARTED"
            fontSize={160}
            color="#ffffff"
            charDelay={2}
            style={{ letterSpacing: "0.08em" }}
          />
          <div
            style={{
              marginTop: 30,
              opacity: subOpacity,
            }}
          >
            <span
              style={{
                fontFamily: BODY_FONT,
                fontSize: 32,
                color: "rgba(255, 255, 255, 0.7)",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Premium Video Generation
            </span>
          </div>
        </AbsoluteFill>
      </CameraWrapper>
    </AbsoluteFill>
  );
};

// ============================================================================
// MAIN COMPOSITION
// ============================================================================
const PremiumShowcase: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BASE_BG }}>
      <TransitionSeries>
        {/* Scene 1: Intro - 7 seconds */}
        <TransitionSeries.Sequence durationInFrames={210}>
          <IntroScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 20 })}
        />

        {/* Scene 2: iPhone Mockup - 7 seconds */}
        <TransitionSeries.Sequence durationInFrames={210}>
          <IPhoneScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={linearTiming({ durationInFrames: 20 })}
        />

        {/* Scene 3: MacBook + Three.js - 8 seconds */}
        <TransitionSeries.Sequence durationInFrames={240}>
          <ThreeDScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 20 })}
        />

        {/* Scene 4: CTA - 8 seconds */}
        <TransitionSeries.Sequence durationInFrames={240}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

export default PremiumShowcase;
