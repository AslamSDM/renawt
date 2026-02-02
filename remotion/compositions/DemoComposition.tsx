import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { TextReveal } from "../components/TextReveal";
import { FadeTransition, SlideTransition } from "../components/Transitions";
import { CTAScene } from "../components/ProductShowcase";

// Demo composition to showcase the animation components
export const DemoComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#0f0f1a" }}>
      {/* Scene 1: Intro */}
      <Sequence from={0} durationInFrames={90}>
        <IntroScene />
      </Sequence>

      {/* Scene 2: Features */}
      <Sequence from={90} durationInFrames={120}>
        <FeaturesScene />
      </Sequence>

      {/* Scene 3: CTA */}
      <Sequence from={210} durationInFrames={90}>
        <CTAScene
          headline="Start Creating Today"
          buttonText="Try Free"
          background="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          textColor="#ffffff"
        />
      </Sequence>
    </AbsoluteFill>
  );
};

const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const subtitleOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <FadeTransition totalDuration={90} durationInFrames={15}>
      <AbsoluteFill
        style={{
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              color: "#ffffff",
              fontSize: 72,
              fontWeight: "bold",
              margin: 0,
              transform: `scale(${titleScale})`,
            }}
          >
            <TextReveal text="Create Stunning Videos" type="word-by-word" duration={40} />
          </h1>
          <p
            style={{
              color: "#a0a0a0",
              fontSize: 28,
              marginTop: 24,
              opacity: subtitleOpacity,
            }}
          >
            Powered by AI and Remotion
          </p>
        </div>
      </AbsoluteFill>
    </FadeTransition>
  );
};

const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();

  const features = [
    { icon: "🚀", title: "Lightning Fast", color: "#667eea" },
    { icon: "🎨", title: "Beautiful Design", color: "#764ba2" },
    { icon: "🤖", title: "AI Powered", color: "#f093fb" },
  ];

  return (
    <SlideTransition direction="up" totalDuration={120} durationInFrames={20}>
      <AbsoluteFill
        style={{
          background: "#0f0f1a",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 40,
          }}
        >
          {features.map((feature, index) => {
            const delay = index * 15;
            const cardFrame = Math.max(0, frame - delay);

            const opacity = interpolate(cardFrame, [0, 20], [0, 1], {
              extrapolateRight: "clamp",
            });
            const translateY = interpolate(cardFrame, [0, 20], [40, 0], {
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={index}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 20,
                  padding: "40px 50px",
                  textAlign: "center",
                  opacity,
                  transform: `translateY(${translateY}px)`,
                  border: `2px solid ${feature.color}40`,
                }}
              >
                <div style={{ fontSize: 56, marginBottom: 16 }}>{feature.icon}</div>
                <h3
                  style={{
                    color: "#ffffff",
                    fontSize: 24,
                    margin: 0,
                  }}
                >
                  {feature.title}
                </h3>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </SlideTransition>
  );
};

export default DemoComposition;
