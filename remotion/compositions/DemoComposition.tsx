import React from "react";
import {
  AbsoluteFill,
  Sequence,
} from "remotion";
import { TextReveal } from "../components/TextReveal";
import {
  FadeTransition,
  SlideTransition,
  ScaleTransition,
} from "../components/Transitions";
import {
  ProductShowcase,
  FeatureCard,
  CTAScene,
  ModernHero,
} from "../components/ProductShowcase";

export const DemoComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      {/* Scene 1: Modern Hero Intro */}
      <Sequence from={0} durationInFrames={150}>
        <IntroScene />
      </Sequence>

      {/* Scene 2: Product Showcase */}
      <Sequence from={150} durationInFrames={150}>
        <ShowcaseScene />
      </Sequence>

      {/* Scene 3: Features */}
      <Sequence from={300} durationInFrames={150}>
        <FeaturesScene />
      </Sequence>

      {/* Scene 4: CTA */}
      <Sequence from={450} durationInFrames={150}>
        <FinalCTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};

const IntroScene: React.FC = () => {
  return (
    <FadeTransition totalDuration={150} durationInFrames={20}>
      <ModernHero
        title="Future of Video"
        subtitle="Create stunning motion graphics with code."
        tagline="Powered by Remotion"
        background="radial-gradient(circle at center, #1a1a2e 0%, #000000 100%)"
      />
    </FadeTransition>
  );
};

const ShowcaseScene: React.FC = () => {
  return (
    <SlideTransition direction="up" totalDuration={150} durationInFrames={20}>
      <ProductShowcase
        animation="float"
        background="linear-gradient(135deg, #240b36 0%, #c31432 100%)"
      />
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: 80,
          pointerEvents: "none",
        }}
      >
        <h2
          style={{
            color: "white",
            fontSize: 40,
            fontWeight: 300,
            textShadow: "0 4px 20px rgba(0,0,0,0.5)",
          }}
        >
          <TextReveal
            text="Showcase your product in 3D"
            type="blur-in"
            delay={30}
          />
        </h2>
      </AbsoluteFill>
    </SlideTransition>
  );
};

const FeaturesScene: React.FC = () => {
  const features = [
    {
      icon: "🚀",
      title: "Fast Render",
      description: "Generate video in seconds, not hours.",
    },
    {
      icon: "🎨",
      title: "Stylable",
      description: "Use CSS, Canvas, or SVG for full control.",
    },
    {
      icon: "✨",
      title: "Reactive",
      description: "Data-driven videos that update automatically.",
    },
  ];

  return (
    <ScaleTransition totalDuration={150} durationInFrames={20}>
      <AbsoluteFill
        style={{
          background: "#0f0c29", // Fallback
          backgroundImage: "linear-gradient(to right, #24243e, #302b63, #0f0c29)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 30,
            maxWidth: 1400,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              index={index}
              {...feature}
            />
          ))}
        </div>
      </AbsoluteFill>
    </ScaleTransition>
  );
};

const FinalCTAScene: React.FC = () => {
  return (
    <FadeTransition totalDuration={150} durationInFrames={20}>
      <CTAScene
        headline="Start Building Today"
        buttonText="Get Started Free"
        background="linear-gradient(45deg, #11998e 0%, #38ef7d 100%)"
        accentColor="#ffffff"
        textColor="#ffffff"
      />
    </FadeTransition>
  );
};

export default DemoComposition;