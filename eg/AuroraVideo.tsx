import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import React from "react";

// --- Data ---

const VIDEO_DATA = {
  title: "AURORA",
  tagline: "AI-Powered Creative Suite",
  colors: {
    primary: "#ec4899", // pink 500
    secondary: "#f97316", // orange 500
    accent: "#a855f7", // purple 500
    background: "#09090b", // zinc 950
    text: "#ffffff",
    textSecondary: "#a1a1aa", // zinc 400
  },
  features: [
    {
      icon: "✨",
      title: "AI Generation",
      desc: "Create stunning visuals with natural language prompts.",
    },
    {
      icon: "🎨",
      title: "Smart Editing",
      desc: "Intelligent tools that understand your creative intent.",
    },
    {
      icon: "🚀",
      title: "Instant Export",
      desc: "Render 4K content in seconds, not hours.",
    },
  ],
  stats: [
    { label: "Creations", value: 2500000, suffix: "+" },
    { label: "Time Saved", value: 85, suffix: "%" },
    { label: "Happy Users", value: 150000, suffix: "" },
  ],
  testimonial: {
    quote:
      "Aurora transformed our entire creative workflow. What took days now takes minutes.",
    author: "Sarah Chen",
    role: "Creative Director, Spotify",
  },
};

// --- Components ---

const AuroraBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Multiple animated aurora blobs
  const time = frame / 60;
  const blob1X = 30 + Math.sin(time * 0.5) * 20;
  const blob1Y = 20 + Math.cos(time * 0.3) * 15;
  const blob2X = 70 + Math.cos(time * 0.4) * 25;
  const blob2Y = 60 + Math.sin(time * 0.6) * 20;
  const blob3X = 50 + Math.sin(time * 0.7) * 15;
  const blob3Y = 80 + Math.cos(time * 0.5) * 10;

  return (
    <AbsoluteFill
      style={{
        background: VIDEO_DATA.colors.background,
        overflow: "hidden",
      }}
    >
      {/* Aurora blob 1 - Pink */}
      <div
        style={{
          position: "absolute",
          left: `${blob1X}%`,
          top: `${blob1Y}%`,
          width: 800,
          height: 800,
          background: `radial-gradient(ellipse at center, ${VIDEO_DATA.colors.primary}40 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          filter: "blur(80px)",
        }}
      />
      {/* Aurora blob 2 - Orange */}
      <div
        style={{
          position: "absolute",
          left: `${blob2X}%`,
          top: `${blob2Y}%`,
          width: 600,
          height: 600,
          background: `radial-gradient(ellipse at center, ${VIDEO_DATA.colors.secondary}35 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          filter: "blur(60px)",
        }}
      />
      {/* Aurora blob 3 - Purple */}
      <div
        style={{
          position: "absolute",
          left: `${blob3X}%`,
          top: `${blob3Y}%`,
          width: 700,
          height: 700,
          background: `radial-gradient(ellipse at center, ${VIDEO_DATA.colors.accent}30 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          filter: "blur(70px)",
        }}
      />
      {/* Noise overlay for texture */}
      <AbsoluteFill
        style={{
          background:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
          opacity: 0.03,
          mixBlendMode: "overlay",
        }}
      />
    </AbsoluteFill>
  );
};

const FloatingOrbs: React.FC = () => {
  const frame = useCurrentFrame();

  const orbs = React.useMemo(() => {
    return new Array(6).fill(0).map((_, i) => ({
      x: 15 + i * 15,
      y: 20 + (i % 3) * 30,
      size: 8 + Math.random() * 8,
      hue: i * 60,
      speed: 0.5 + Math.random() * 0.5,
    }));
  }, []);

  return (
    <AbsoluteFill>
      {orbs.map((orb, i) => {
        const yOffset = Math.sin(((frame + i * 20) * orb.speed) / 30) * 30;
        const xOffset = Math.cos(((frame + i * 30) * orb.speed) / 40) * 20;
        const pulse = 1 + Math.sin(frame / 15 + i) * 0.3;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${orb.x + xOffset / 5}%`,
              top: `${orb.y + yOffset / 3}%`,
              width: orb.size * pulse,
              height: orb.size * pulse,
              borderRadius: "50%",
              background: `hsl(${orb.hue + frame * 0.5}, 80%, 60%)`,
              boxShadow: `0 0 20px hsl(${orb.hue + frame * 0.5}, 80%, 50%)`,
              opacity: 0.6,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Staggered letter animation for title
  const letters = VIDEO_DATA.title.split("");

  const taglineOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineBlur = interpolate(frame, [40, 60], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Animated underline
  const underlineWidth = interpolate(frame, [60, 90], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      {/* Animated Title Letters */}
      <div style={{ display: "flex", gap: 8 }}>
        {letters.map((letter, i) => {
          const delay = i * 5;
          const letterFrame = Math.max(0, frame - delay);

          const y = spring({
            frame: letterFrame,
            fps,
            from: -100,
            to: 0,
            config: { damping: 12, stiffness: 100 },
          });

          const opacity = interpolate(letterFrame, [0, 15], [0, 1], {
            extrapolateRight: "clamp",
          });
          const rotation = interpolate(letterFrame, [0, 20], [45, 0], {
            extrapolateRight: "clamp",
          });

          return (
            <span
              key={i}
              style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: 200,
                fontWeight: 900,
                color: "transparent",
                background: `linear-gradient(135deg, ${VIDEO_DATA.colors.primary}, ${VIDEO_DATA.colors.secondary}, ${VIDEO_DATA.colors.accent})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                opacity,
                transform: `translateY(${y}px) rotate(${rotation}deg)`,
                display: "inline-block",
                letterSpacing: "-10px",
              }}
            >
              {letter}
            </span>
          );
        })}
      </div>

      {/* Tagline with blur-in effect */}
      <h2
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 48,
          fontWeight: 400,
          color: VIDEO_DATA.colors.textSecondary,
          marginTop: 30,
          opacity: taglineOpacity,
          filter: `blur(${taglineBlur}px)`,
          letterSpacing: "2px",
        }}
      >
        {VIDEO_DATA.tagline}
      </h2>

      {/* Animated underline */}
      <div
        style={{
          width: `${underlineWidth * 4}px`,
          height: 4,
          background: `linear-gradient(90deg, ${VIDEO_DATA.colors.primary}, ${VIDEO_DATA.colors.accent})`,
          marginTop: 20,
          borderRadius: 2,
        }}
      />
    </AbsoluteFill>
  );
};

const BentoFeatureCard: React.FC<{
  feature: (typeof VIDEO_DATA.features)[0];
  index: number;
  size: "large" | "small";
}> = ({ feature, index, size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delay = 20 + index * 25;
  const actualFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: actualFrame,
    fps,
    from: 0.8,
    to: 1,
    config: { damping: 15, stiffness: 100 },
  });

  const opacity = interpolate(actualFrame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const rotate = interpolate(actualFrame, [0, 30], [-5, 0], {
    extrapolateRight: "clamp",
  });

  const cardStyle =
    size === "large"
      ? {
          gridColumn: "span 2",
          gridRow: "span 2",
          padding: 60,
        }
      : {
          gridColumn: "span 1",
          gridRow: "span 1",
          padding: 40,
        };

  return (
    <div
      style={{
        ...cardStyle,
        background: "rgba(255, 255, 255, 0.03)",
        backdropFilter: "blur(20px)",
        borderRadius: 30,
        border: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: size === "large" ? "flex-start" : "center",
        textAlign: size === "large" ? "left" : "center",
        opacity,
        transform: `scale(${scale}) rotate(${rotate}deg)`,
        boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
      }}
    >
      <div
        style={{
          fontSize: size === "large" ? 80 : 50,
          marginBottom: size === "large" ? 30 : 20,
          filter: "drop-shadow(0 0 20px rgba(236, 72, 153, 0.5))",
        }}
      >
        {feature.icon}
      </div>
      <h3
        style={{
          color: VIDEO_DATA.colors.text,
          fontSize: size === "large" ? 48 : 32,
          fontWeight: 700,
          marginBottom: 15,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {feature.title}
      </h3>
      <p
        style={{
          color: VIDEO_DATA.colors.textSecondary,
          fontSize: size === "large" ? 26 : 20,
          lineHeight: 1.5,
          fontFamily: "system-ui, sans-serif",
          maxWidth: size === "large" ? 400 : 300,
        }}
      >
        {feature.desc}
      </p>
    </div>
  );
};

const BentoFeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      <h2
        style={{
          position: "absolute",
          top: 80,
          color: VIDEO_DATA.colors.text,
          fontFamily: "system-ui, sans-serif",
          fontSize: 64,
          fontWeight: 700,
          opacity: titleOpacity,
        }}
      >
        What Makes Us{" "}
        <span style={{ color: VIDEO_DATA.colors.primary }}>Different</span>
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 300px)",
          gridTemplateRows: "repeat(2, 250px)",
          gap: 30,
          marginTop: 60,
        }}
      >
        <BentoFeatureCard
          feature={VIDEO_DATA.features[0]}
          index={0}
          size="large"
        />
        <BentoFeatureCard
          feature={VIDEO_DATA.features[1]}
          index={1}
          size="small"
        />
        <BentoFeatureCard
          feature={VIDEO_DATA.features[2]}
          index={2}
          size="small"
        />
      </div>
    </AbsoluteFill>
  );
};

const CircularStat: React.FC<{
  stat: (typeof VIDEO_DATA.stats)[0];
  index: number;
}> = ({ stat, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delay = index * 20;
  const actualFrame = Math.max(0, frame - delay);

  const value = interpolate(actualFrame, [0, 60], [0, stat.value], {
    extrapolateRight: "clamp",
  });

  const ringProgress = interpolate(actualFrame, [0, 60], [0, 75], {
    extrapolateRight: "clamp",
  });

  const scale = spring({
    frame: actualFrame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 12, stiffness: 80 },
  });

  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference - (ringProgress / 100) * circumference;

  const formatValue = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
    return Math.floor(val).toString();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        margin: "0 50px",
        transform: `scale(${scale})`,
      }}
    >
      <svg width={200} height={200} style={{ transform: "rotate(-90deg)" }}>
        {/* Background ring */}
        <circle
          cx={100}
          cy={100}
          r={80}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={8}
        />
        {/* Progress ring */}
        <circle
          cx={100}
          cy={100}
          r={80}
          fill="none"
          stroke={`url(#gradient-${index})`}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
        <defs>
          <linearGradient id={`gradient-${index}`}>
            <stop offset="0%" stopColor={VIDEO_DATA.colors.primary} />
            <stop offset="100%" stopColor={VIDEO_DATA.colors.accent} />
          </linearGradient>
        </defs>
      </svg>

      <div
        style={{
          position: "absolute",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 52,
            fontWeight: 800,
            fontFamily: "system-ui, sans-serif",
            color: VIDEO_DATA.colors.text,
          }}
        >
          {formatValue(value)}
          {stat.suffix}
        </span>
      </div>

      <span
        style={{
          fontSize: 24,
          color: VIDEO_DATA.colors.textSecondary,
          fontFamily: "system-ui, sans-serif",
          marginTop: 15,
          fontWeight: 500,
        }}
      >
        {stat.label}
      </span>
    </div>
  );
};

const StatsScene: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "row" }}>
        {VIDEO_DATA.stats.map((stat, i) => (
          <CircularStat key={i} stat={stat} index={i} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

const TestimonialScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const quoteScale = spring({
    frame,
    fps,
    from: 0.9,
    to: 1,
    config: { damping: 15 },
  });

  const quoteOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const authorOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: "clamp",
  });
  const authorY = interpolate(frame, [30, 50], [20, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: 120,
      }}
    >
      {/* Large quote mark */}
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 150,
          fontSize: 300,
          color: VIDEO_DATA.colors.primary,
          opacity: 0.15,
          fontFamily: "Georgia, serif",
        }}
      >
        &ldquo;
      </div>

      <p
        style={{
          fontSize: 56,
          fontFamily: "system-ui, sans-serif",
          color: VIDEO_DATA.colors.text,
          textAlign: "center",
          lineHeight: 1.4,
          maxWidth: 1200,
          fontWeight: 300,
          opacity: quoteOpacity,
          transform: `scale(${quoteScale})`,
          fontStyle: "italic",
        }}
      >
        {VIDEO_DATA.testimonial.quote}
      </p>

      <div
        style={{
          marginTop: 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: authorOpacity,
          transform: `translateY(${authorY}px)`,
        }}
      >
        <span
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: VIDEO_DATA.colors.text,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {VIDEO_DATA.testimonial.author}
        </span>
        <span
          style={{
            fontSize: 24,
            color: VIDEO_DATA.colors.primary,
            fontFamily: "system-ui, sans-serif",
            marginTop: 8,
          }}
        >
          {VIDEO_DATA.testimonial.role}
        </span>
      </div>
    </AbsoluteFill>
  );
};

const ClosingCTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bounce = Math.sin(frame / 10) * 5;

  const titleScale = spring({
    frame,
    fps,
    from: 0.5,
    to: 1,
    config: { damping: 10, stiffness: 80 },
  });

  const buttonOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: "clamp",
  });
  const buttonScale = spring({
    frame: Math.max(0, frame - 30),
    fps,
    from: 0.8,
    to: 1,
    config: { damping: 12 },
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <h2
        style={{
          fontSize: 120,
          fontFamily: "system-ui, sans-serif",
          fontWeight: 900,
          color: VIDEO_DATA.colors.text,
          textAlign: "center",
          lineHeight: 1.1,
          transform: `scale(${titleScale})`,
        }}
      >
        Create Without
        <br />
        <span
          style={{
            background: `linear-gradient(135deg, ${VIDEO_DATA.colors.primary}, ${VIDEO_DATA.colors.secondary})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Limits
        </span>
      </h2>

      <div
        style={{
          marginTop: 60,
          padding: "30px 80px",
          background: `linear-gradient(135deg, ${VIDEO_DATA.colors.primary}, ${VIDEO_DATA.colors.secondary})`,
          borderRadius: 60,
          color: VIDEO_DATA.colors.text,
          fontSize: 42,
          fontWeight: 700,
          fontFamily: "system-ui, sans-serif",
          boxShadow: `0 20px 60px ${VIDEO_DATA.colors.primary}66`,
          opacity: buttonOpacity,
          transform: `scale(${buttonScale}) translateY(${bounce}px)`,
          cursor: "pointer",
        }}
      >
        Start Free Trial →
      </div>
    </AbsoluteFill>
  );
};

// --- Main Composition ---

export const AuroraCreativeVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: VIDEO_DATA.colors.background }}>
      {/* Shared background across all scenes */}
      <AuroraBackground />
      <FloatingOrbs />

      {/* Scene 1: Hero Intro (0-5s = 0-150 frames) */}
      <Sequence from={0} durationInFrames={150}>
        <HeroScene />
      </Sequence>

      {/* Scene 2: Bento Features (5-13s = 150-390 frames) */}
      <Sequence from={150} durationInFrames={240}>
        <BentoFeaturesScene />
      </Sequence>

      {/* Scene 3: Stats (13-20s = 390-600 frames) */}
      <Sequence from={390} durationInFrames={210}>
        <StatsScene />
      </Sequence>

      {/* Scene 4: Testimonial (20-26s = 600-780 frames) */}
      <Sequence from={600} durationInFrames={180}>
        <TestimonialScene />
      </Sequence>

      {/* Scene 5: Closing CTA (26-30s = 780-900 frames) */}
      <Sequence from={780} durationInFrames={120}>
        <ClosingCTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};

export default AuroraCreativeVideo;
