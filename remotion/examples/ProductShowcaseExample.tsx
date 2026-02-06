/**
 * Comprehensive Example: Product Showcase Video
 * 
 * This example demonstrates how to use all the updated components
 * to create a professional product showcase video.
 */

import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";

// Import animation components
import {
  BlurInText,
  StaggerWords,
  GradientMeshBackground,
  ParticleField,
  KineticText,
  GlitchText,
  GlassmorphicCard,
  ThreeScene,
  FloatingGeometries,
} from "../components/animations";

// Import UI mockups
import {
  NotificationCard,
  PhoneMockup,
  FeatureCard,
  LogoAnimation,
  FadeIn,
  ScaleIn,
} from "../components/DemoUIMockups";

// Import hooks
import { BeatMapProvider, useBeatMap } from "../hooks/useBeatMap";
import { createBeatMapFromBPM } from "../../lib/audio/beatDetection";

// ============================================
// EXAMPLE: Complete Product Showcase Video
// ============================================

interface ProductShowcaseProps {
  productName: string;
  tagline: string;
  description: string;
  features: Array<{
    title: string;
    description: string;
    icon: string;
  }>;
  accentColor: string;
}

const ProductShowcase: React.FC<ProductShowcaseProps> = ({
  productName,
  tagline,
  description,
  features,
  accentColor,
}) => {
  const { durationInFrames, fps } = useVideoConfig();
  
  // Create beat map for synchronized animations
  const beatMap = createBeatMapFromBPM(120, durationInFrames / fps, fps);

  return (
    <BeatMapProvider value={beatMap}>
      <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
        {/* Animated Background */}
        <GradientMeshBackground
          colors={[accentColor, "#6366f1", "#ec4899"]}
          speed={0.3}
        />
        
        {/* Particle Overlay */}
        <ParticleField
          particleCount={30}
          color={accentColor}
          maxSize={3}
          speed={0.5}
        />

        <TransitionSeries>
          {/* Scene 1: Logo Animation (0-3s) */}
          <TransitionSeries.Sequence durationInFrames={90}>
            <Scene1_Logo productName={productName} accentColor={accentColor} />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: 15 })}
          />

          {/* Scene 2: Hero with Phone Mockup (3-8s) */}
          <TransitionSeries.Sequence durationInFrames={150}>
            <Scene2_Hero
              productName={productName}
              tagline={tagline}
              accentColor={accentColor}
            />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={wipe({ direction: "from-left" })}
            timing={linearTiming({ durationInFrames: 12 })}
          />

          {/* Scene 3: Features (8-15s) */}
          <TransitionSeries.Sequence durationInFrames={210}>
            <Scene3_Features features={features} accentColor={accentColor} />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={slide({ direction: "from-bottom" })}
            timing={linearTiming({ durationInFrames: 15 })}
          />

          {/* Scene 4: 3D Demo (15-20s) */}
          <TransitionSeries.Sequence durationInFrames={150}>
            <Scene4_3DDemo accentColor={accentColor} />
          </TransitionSeries.Sequence>

          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: 20 })}
          />

          {/* Scene 5: CTA (20-25s) */}
          <TransitionSeries.Sequence durationInFrames={150}>
            <Scene5_CTA productName={productName} accentColor={accentColor} />
          </TransitionSeries.Sequence>
        </TransitionSeries>
      </AbsoluteFill>
    </BeatMapProvider>
  );
};

// Scene 1: Logo Animation
const Scene1_Logo: React.FC<{
  productName: string;
  accentColor: string;
}> = ({ productName, accentColor }) => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LogoAnimation name={productName} accentColor={accentColor} delay={10} />
    </AbsoluteFill>
  );
};

// Scene 2: Hero with Phone Mockup
const Scene2_Hero: React.FC<{
  productName: string;
  tagline: string;
  accentColor: string;
}> = ({ productName, tagline, accentColor }) => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 100,
        padding: 80,
      }}
    >
      {/* Phone Mockup */}
      <PhoneMockup delay={20}>
        <div
          style={{
            width: "100%",
            height: "100%",
            background: `linear-gradient(135deg, ${accentColor}20, #000000)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 20,
            padding: 20,
          }}
        >
          <NotificationCard
            title="Welcome"
            message="Get started with our app"
            actionText="Get Started"
            logoColor={accentColor}
            delay={40}
          />
        </div>
      </PhoneMockup>

      {/* Text Content */}
      <div style={{ maxWidth: 600, textAlign: "left" }}>
        <KineticText
          text={productName}
          startFrame={0}
          fontSize={80}
          color="#ffffff"
          charDelay={3}
        />
        <div style={{ marginTop: 24 }}>
          <StaggerWords
            text={tagline}
            fontSize={32}
            color="#cccccc"
            staggerDelay={4}
            animation="slide-up"
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Scene 3: Features Grid
const Scene3_Features: React.FC<{
  features: Array<{ title: string; description: string; icon: string }>;
  accentColor: string;
}> = ({ features, accentColor }) => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 80,
        gap: 40,
      }}
    >
      <GlitchText
        text="FEATURES"
        triggerFrame={0}
        duration={20}
        fontSize={56}
        color={accentColor}
      />

      <div
        style={{
          display: "flex",
          gap: 30,
          justifyContent: "center",
          flexWrap: "wrap",
          maxWidth: 1200,
        }}
      >
        {features.map((feature, index) => (
          <div
            key={index}
            style={{
              opacity: interpolate(
                useCurrentFrame(),
                [20 + index * 15, 40 + index * 15],
                [0, 1],
                { extrapolateRight: "clamp" }
              ),
              transform: `translateY(${interpolate(
                useCurrentFrame(),
                [20 + index * 15, 40 + index * 15],
                [50, 0],
                { extrapolateRight: "clamp" }
              )}px)`,
            }}
          >
            <FeatureCard
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              delay={20 + index * 10}
              accentColor={accentColor}
            />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// Scene 4: 3D Demo
const Scene4_3DDemo: React.FC<{ accentColor: string }> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <BlurInText
        text="Powered by 3D"
        delay={10}
        fontSize={64}
        color="#ffffff"
      />
      
      <div style={{ width: 800, height: 500, marginTop: 40 }}>
        <ThreeScene cameraPosition={[0, 2, 8]}>
          <FloatingGeometries
            count={6}
            color1={accentColor}
            color2="#6366f1"
            speed={0.8}
            opacity={0.7}
          />
        </ThreeScene>
      </div>
    </AbsoluteFill>
  );
};

// Scene 5: Call to Action
const Scene5_CTA: React.FC<{
  productName: string;
  accentColor: string;
}> = ({ productName, accentColor }) => {
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(180deg, transparent, ${accentColor}20)`,
      }}
    >
      <BlurInText
        text="Ready to Get Started?"
        delay={10}
        fontSize={72}
        color="#ffffff"
      />
      
      <div style={{ marginTop: 30 }}>
        <StaggerWords
          text={`Download ${productName} today`}
          fontSize={28}
          color="#cccccc"
          staggerDelay={5}
          animation="slide-up"
        />
      </div>

      <div
        style={{
          marginTop: 50,
          padding: "20px 60px",
          background: accentColor,
          borderRadius: 50,
          fontSize: 28,
          fontWeight: "bold",
          color: "#000000",
          opacity: interpolate(
            useCurrentFrame(),
            [60, 90],
            [0, 1],
            { extrapolateRight: "clamp" }
          ),
          transform: `scale(${spring({
            frame: Math.max(0, useCurrentFrame() - 60),
            fps: 30,
            config: { damping: 12, stiffness: 100 },
          })})`,
        }}
      >
        Download Now →
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// USAGE EXAMPLE
// ============================================

export const ExampleUsage: React.FC = () => {
  const productData = {
    productName: "NexGen",
    tagline: "The Future of Productivity",
    description:
      "Revolutionize your workflow with AI-powered automation and seamless collaboration.",
    features: [
      {
        icon: "🤖",
        title: "AI Automation",
        description: "Let AI handle repetitive tasks",
      },
      {
        icon: "⚡",
        title: "Real-time Sync",
        description: "Changes appear instantly",
      },
      {
        icon: "🔒",
        title: "Enterprise Security",
        description: "Bank-grade protection",
      },
    ],
    accentColor: "#8b5cf6",
  };

  return (
    <ProductShowcase
      productName={productData.productName}
      tagline={productData.tagline}
      description={productData.description}
      features={productData.features}
      accentColor={productData.accentColor}
    />
  );
};

export default ProductShowcase;
