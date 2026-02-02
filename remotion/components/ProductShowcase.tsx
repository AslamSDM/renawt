import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Img,
  interpolate,
  spring,
} from "remotion";

interface ProductShowcaseProps {
  imageUrl?: string;
  background?: string;
  animation?: "rotate" | "zoom" | "float" | "pulse";
}

export const ProductShowcase: React.FC<ProductShowcaseProps> = ({
  imageUrl,
  background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  animation = "float",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const getTransform = () => {
    switch (animation) {
      case "rotate":
        const rotation = interpolate(frame, [0, 300], [0, 360], {
          extrapolateRight: "extend",
        });
        return `rotateY(${rotation}deg)`;

      case "zoom":
        const scale = spring({
          frame,
          fps,
          config: { damping: 15, stiffness: 80 },
        });
        return `scale(${0.8 + scale * 0.2})`;

      case "float":
        const floatY = Math.sin(frame / 20) * 10;
        const floatRotate = Math.sin(frame / 30) * 2;
        return `translateY(${floatY}px) rotate(${floatRotate}deg)`;

      case "pulse":
        const pulseScale = 1 + Math.sin(frame / 15) * 0.05;
        return `scale(${pulseScale})`;

      default:
        return "none";
    }
  };

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background,
        justifyContent: "center",
        alignItems: "center",
        perspective: "1000px",
      }}
    >
      {imageUrl ? (
        <div
          style={{
            opacity,
            transform: getTransform(),
            transformStyle: "preserve-3d",
            maxWidth: "60%",
            maxHeight: "60%",
          }}
        >
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: 12,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            width: 300,
            height: 300,
            background: "rgba(255,255,255,0.2)",
            borderRadius: 20,
            opacity,
            transform: getTransform(),
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: 48,
            color: "white",
          }}
        >
          📦
        </div>
      )}
    </AbsoluteFill>
  );
};

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: string;
  index?: number;
  background?: string;
  textColor?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon = "✨",
  index = 0,
  background = "#ffffff",
  textColor = "#000000",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delay = index * 10;
  const adjustedFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const opacity = interpolate(adjustedFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(adjustedFrame, [0, 20], [30, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        background,
        borderRadius: 16,
        padding: "30px 40px",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        maxWidth: 400,
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <h3
        style={{
          color: textColor,
          fontSize: 28,
          fontWeight: "bold",
          margin: "0 0 12px 0",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: textColor,
          fontSize: 18,
          opacity: 0.8,
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        {description}
      </p>
    </div>
  );
};

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  background?: string;
  textColor?: string;
}

export const TestimonialCard: React.FC<TestimonialCardProps> = ({
  quote,
  author,
  role,
  background = "#1a1a2e",
  textColor = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          textAlign: "center",
          maxWidth: 800,
        }}
      >
        <div
          style={{
            fontSize: 80,
            color: textColor,
            opacity: 0.3,
            marginBottom: -20,
          }}
        >
          "
        </div>
        <p
          style={{
            color: textColor,
            fontSize: 32,
            fontStyle: "italic",
            lineHeight: 1.5,
            margin: "0 0 30px 0",
          }}
        >
          {quote}
        </p>
        <p
          style={{
            color: textColor,
            fontSize: 20,
            fontWeight: "bold",
            margin: 0,
          }}
        >
          {author}
        </p>
        <p
          style={{
            color: textColor,
            fontSize: 16,
            opacity: 0.7,
            margin: "8px 0 0 0",
          }}
        >
          {role}
        </p>
      </div>
    </AbsoluteFill>
  );
};

interface CTASceneProps {
  headline: string;
  buttonText?: string;
  background?: string;
  textColor?: string;
  accentColor?: string;
}

export const CTAScene: React.FC<CTASceneProps> = ({
  headline,
  buttonText = "Get Started",
  background = "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  textColor = "#ffffff",
  accentColor = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const headlineY = interpolate(frame, [0, 20], [30, 0], {
    extrapolateRight: "clamp",
  });

  const buttonScale = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 10, stiffness: 150 },
  });

  const buttonPulse = 1 + Math.sin((frame - 30) / 10) * 0.03;

  return (
    <AbsoluteFill
      style={{
        background,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1
          style={{
            color: textColor,
            fontSize: 56,
            fontWeight: "bold",
            margin: "0 0 40px 0",
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          {headline}
        </h1>
        <div
          style={{
            background: accentColor,
            color: background.includes("gradient") ? "#667eea" : textColor,
            fontSize: 24,
            fontWeight: "bold",
            padding: "16px 48px",
            borderRadius: 50,
            display: "inline-block",
            transform: `scale(${buttonScale * buttonPulse})`,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          }}
        >
          {buttonText}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default {
  ProductShowcase,
  FeatureCard,
  TestimonialCard,
  CTAScene,
};
