import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Img,
  interpolate,
  spring,
} from "remotion";

// --- Types ---

interface ProductShowcaseProps {
  imageUrl?: string;
  background?: string;
  animation?: "rotate" | "zoom" | "float" | "pulse";
}

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: string;
  index?: number;
  background?: string;
  textColor?: string;
}

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  background?: string;
  textColor?: string;
}

interface CTASceneProps {
  headline: string;
  buttonText?: string;
  background?: string;
  textColor?: string;
  accentColor?: string;
}

interface ModernHeroProps {
  title: string;
  subtitle: string;
  background?: string;
  textColor?: string;
  tagline?: string;
}

// --- Components ---

export const ProductShowcase: React.FC<ProductShowcaseProps> = ({
  imageUrl,
  background = "linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%)",
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
        const floatY = Math.sin(frame / 40) * 15;
        const floatRotate = Math.sin(frame / 60) * 3;
        return `translateY(${floatY}px) rotate(${floatRotate}deg)`;

      case "pulse":
        const pulseScale = 1 + Math.sin(frame / 20) * 0.03;
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
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background: "radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.3) 100%)",
          zIndex: 0,
        }}
      />
      {imageUrl ? (
        <div
          style={{
            opacity,
            transform: getTransform(),
            transformStyle: "preserve-3d",
            maxWidth: "60%",
            maxHeight: "60%",
            zIndex: 1,
            position: "relative",
          }}
        >
          <Img
            src={imageUrl}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: 16,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
          />
        </div>
      ) : (
        <div
          style={{
            width: 350,
            height: 350,
            background: "linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))",
            backdropFilter: "blur(10px)",
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.1)",
            opacity,
            transform: getTransform(),
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: 64,
            color: "white",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            zIndex: 1,
          }}
        >
          📦
        </div>
      )}
    </AbsoluteFill>
  );
};

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon = "✨",
  index = 0,
  background = "rgba(255, 255, 255, 0.05)",
  textColor = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delay = index * 5;
  const adjustedFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: adjustedFrame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const opacity = interpolate(adjustedFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(adjustedFrame, [0, 20], [50, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        background,
        borderRadius: 20,
        padding: "40px 40px",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.3)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(4px)",
        maxWidth: 380,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      <div
        style={{
          fontSize: 42,
          background: "rgba(255,255,255,0.1)",
          width: 80,
          height: 80,
          borderRadius: "50%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        {icon}
      </div>
      <h3
        style={{
          color: textColor,
          fontSize: 28,
          fontWeight: 700,
          margin: 0,
          letterSpacing: "-0.02em",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: textColor,
          fontSize: 18,
          opacity: 0.7,
          margin: 0,
          lineHeight: 1.6,
          fontWeight: 400,
        }}
      >
        {description}
      </p>
    </div>
  );
};

export const TestimonialCard: React.FC<TestimonialCardProps> = ({
  quote,
  author,
  role,
  background = "#0f0f1a",
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
          maxWidth: 900,
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -60,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 120,
            color: textColor,
            opacity: 0.05,
            fontFamily: "serif",
          }}
        >
          “
        </div>
        <p
          style={{
            color: textColor,
            fontSize: 42,
            fontWeight: 300,
            lineHeight: 1.4,
            margin: "0 0 40px 0",
            letterSpacing: "-0.01em",
          }}
        >
          {quote}
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <p
            style={{
              color: textColor,
              fontSize: 24,
              fontWeight: 700,
              margin: 0,
            }}
          >
            {author}
          </p>
          <div
            style={{
              width: 40,
              height: 2,
              background: textColor,
              opacity: 0.3,
            }}
          />
          <p
            style={{
              color: textColor,
              fontSize: 16,
              opacity: 0.6,
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {role}
          </p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const CTAScene: React.FC<CTASceneProps> = ({
  headline,
  buttonText = "Get Started",
  background = "linear-gradient(135deg, #111 0%, #333 100%)",
  textColor = "#ffffff",
  accentColor = "#3b82f6",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const headlineY = interpolate(frame, [0, 20], [40, 0], {
    extrapolateRight: "clamp",
  });

  const buttonScale = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  return (
    <AbsoluteFill
      style={{
        background,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center", zIndex: 1 }}>
        <h1
          style={{
            color: textColor,
            fontSize: 72,
            fontWeight: 800,
            margin: "0 0 48px 0",
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
          }}
        >
          {headline}
        </h1>
        <div
          style={{
            background: accentColor,
            color: "#ffffff",
            fontSize: 28,
            fontWeight: 600,
            padding: "20px 60px",
            borderRadius: 100,
            display: "inline-block",
            transform: `scale(${buttonScale})`,
            boxShadow: `0 20px 40px -10px ${accentColor}80`,
            cursor: "pointer",
          }}
        >
          {buttonText}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const ModernHero: React.FC<ModernHeroProps> = ({
  title,
  subtitle,
  background = "#000",
  textColor = "#fff",
  tagline,
}) => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [10, 30], [0, 1]);
  const titleY = interpolate(frame, [10, 30], [50, 0], {
    extrapolateRight: "clamp",
  });

  const subOpacity = interpolate(frame, [25, 45], [0, 1]);
  const subY = interpolate(frame, [25, 45], [30, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background,
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "120%",
          height: "120%",
          background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 50%)",
          zIndex: 0,
        }}
      />
      
      <div style={{ textAlign: "center", zIndex: 1, padding: "0 40px" }}>
        {tagline && (
          <div
            style={{
              fontSize: 20,
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              color: textColor,
              opacity: 0.6,
              marginBottom: 20,
            }}
          >
            {tagline}
          </div>
        )}
        <h1
          style={{
            fontSize: 90,
            fontWeight: 900,
            color: textColor,
            margin: "0 0 20px 0",
            lineHeight: 1,
            letterSpacing: "-0.04em",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 32,
            color: textColor,
            opacity: subOpacity,
            transform: `translateY(${subY}px)`,
            fontWeight: 300,
            maxWidth: 800,
            margin: "0 auto",
          }}
        >
          {subtitle}
        </p>
      </div>
    </AbsoluteFill>
  );
};

const ProductShowcaseComponents = {
  ProductShowcase,
  FeatureCard,
  TestimonialCard,
  CTAScene,
  ModernHero,
};

export default ProductShowcaseComponents;