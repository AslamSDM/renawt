import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile,
} from "remotion";
import React from "react";

/**
 * TEXT PANNING VIDEO
 *
 * Features:
 * - Long vertical text that pans/scrolls as you read
 * - Camera follows newly appearing text
 * - Premium typography and animations
 * - Background music from open source library
 */

// Type definitions for video sections
type SectionType = "hero" | "statement" | "paragraph" | "highlight" | "list" | "cta";

interface VideoSection {
  type: SectionType;
  text?: string;
  subtext?: string;
  items?: string[];
}

const VIDEO_DATA: {
  colors: {
    background: string;
    text: string;
    accent: string;
    secondary: string;
  };
  sections: VideoSection[];
} = {
  colors: {
    background: "#0a0a0a",
    text: "#ffffff",
    accent: "#3b82f6",
    secondary: "#64748b",
  },
  // Content sections - these will scroll by
  sections: [
    {
      type: "hero",
      text: "The Future\nis Here",
    },
    {
      type: "statement",
      text: "We are building something extraordinary.",
    },
    {
      type: "paragraph",
      text: "In a world of infinite possibilities, we chose to create. To innovate. To push the boundaries of what technology can achieve.",
    },
    {
      type: "highlight",
      text: "10 Million",
      subtext: "Users worldwide trust our platform",
    },
    {
      type: "paragraph",
      text: "Every line of code is crafted with precision. Every pixel is placed with purpose. Every interaction is designed to delight.",
    },
    {
      type: "statement",
      text: "This is not just another product.",
    },
    {
      type: "paragraph",
      text: "This is a revolution in how we think, work, and create. We have reimagined the entire experience from the ground up.",
    },
    {
      type: "highlight",
      text: "99.99%",
      subtext: "Uptime guaranteed",
    },
    {
      type: "list",
      items: [
        "⚡ Lightning fast performance",
        "🔒 Enterprise-grade security",
        "🌍 Global infrastructure",
        "🎨 Beautiful by default",
        "🚀 Ship faster than ever",
      ],
    },
    {
      type: "paragraph",
      text: "Our team of world-class engineers, designers, and visionaries work tirelessly to bring you the best experience possible.",
    },
    {
      type: "statement",
      text: "Join the movement.",
    },
    {
      type: "highlight",
      text: "150+",
      subtext: "Countries served",
    },
    {
      type: "paragraph",
      text: "From startups to Fortune 500 companies, from individual creators to massive teams — everyone finds a home here.",
    },
    {
      type: "cta",
      text: "Start Building Today",
      subtext: "The future awaits.",
    },
  ],
};

// Calculate total content height for scrolling
const SECTION_HEIGHTS = {
  hero: 600,
  statement: 300,
  paragraph: 350,
  highlight: 400,
  list: 500,
  cta: 500,
};

const getTotalHeight = () => {
  return VIDEO_DATA.sections.reduce((acc, section) => {
    return (
      acc +
      (SECTION_HEIGHTS[section.type as keyof typeof SECTION_HEIGHTS] || 300)
    );
  }, 200); // 200px padding at end
};

// Subtle animated background
const AnimatedBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const gradientPos = interpolate(frame, [0, durationInFrames], [0, 100]);

  return (
    <AbsoluteFill
      style={{
        background: VIDEO_DATA.colors.background,
      }}
    >
      {/* Subtle gradient overlay that moves */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(ellipse at ${30 + gradientPos * 0.4}% ${gradientPos}%, ${VIDEO_DATA.colors.accent}08 0%, transparent 50%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(ellipse at ${70 - gradientPos * 0.3}% ${100 - gradientPos}%, #8b5cf608 0%, transparent 50%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// Hero section component
const HeroSection: React.FC<{ y: number; frame: number }> = ({ y, frame }) => {
  // Fade in when section comes into view
  const visibility = interpolate(y, [-400, -200], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lines = VIDEO_DATA.sections[0]?.text?.split("\n") || [];

  return (
    <div
      style={{
        height: SECTION_HEIGHTS.hero,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        opacity: visibility,
      }}
    >
      {lines.map((line, i) => {
        const delay = i * 15;
        const lineFrame = Math.max(0, frame - delay);
        const blur = interpolate(lineFrame, [0, 30], [20, 0], {
          extrapolateRight: "clamp",
        });
        const opacity = interpolate(lineFrame, [0, 30], [0, 1], {
          extrapolateRight: "clamp",
        });

        return (
          <h1
            key={i}
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 160,
              fontWeight: 900,
              color: VIDEO_DATA.colors.text,
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: "-5px",
              filter: `blur(${blur}px)`,
              opacity,
              textAlign: "center",
            }}
          >
            {line}
          </h1>
        );
      })}
    </div>
  );
};

// Statement component (bold single line)
const StatementSection: React.FC<{ text: string; y: number }> = ({
  text,
  y,
}) => {
  const visibility = interpolate(y, [-200, 0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(y, [-200, 0], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        height: SECTION_HEIGHTS.statement,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: visibility,
        transform: `scale(${scale})`,
      }}
    >
      <h2
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 64,
          fontWeight: 700,
          color: VIDEO_DATA.colors.text,
          margin: 0,
          textAlign: "center",
          maxWidth: 1200,
        }}
      >
        {text}
      </h2>
    </div>
  );
};

// Paragraph component
const ParagraphSection: React.FC<{ text: string; y: number }> = ({
  text,
  y,
}) => {
  const visibility = interpolate(y, [-250, -50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const xOffset = interpolate(y, [-250, -50], [-50, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        height: SECTION_HEIGHTS.paragraph,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        opacity: visibility,
        transform: `translateX(${xOffset}px)`,
        padding: "0 200px",
      }}
    >
      <p
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 42,
          fontWeight: 400,
          color: VIDEO_DATA.colors.secondary,
          margin: 0,
          textAlign: "center",
          lineHeight: 1.6,
          maxWidth: 1400,
        }}
      >
        {text}
      </p>
    </div>
  );
};

// Highlight stat component
const HighlightSection: React.FC<{
  text: string;
  subtext: string;
  y: number;
  frame: number;
}> = ({ text, subtext, y, frame }) => {
  const visibility = interpolate(y, [-300, -100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Parse number from text for counting animation
  const numMatch = text.match(/[\d.]+/);
  const numValue = numMatch ? parseFloat(numMatch[0]) : 0;
  const suffix = text.replace(/[\d.]+/, "");

  // Animate count from 0 when visible
  const countProgress = interpolate(y, [-300, 0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const displayValue = Math.floor(numValue * countProgress);

  return (
    <div
      style={{
        height: SECTION_HEIGHTS.highlight,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        opacity: visibility,
      }}
    >
      <span
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 180,
          fontWeight: 900,
          background: `linear-gradient(135deg, ${VIDEO_DATA.colors.accent}, #8b5cf6)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          margin: 0,
        }}
      >
        {numValue >= 1
          ? displayValue.toLocaleString()
          : (numValue * countProgress).toFixed(2)}
        {suffix}
      </span>
      <span
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 32,
          color: VIDEO_DATA.colors.secondary,
          marginTop: 20,
        }}
      >
        {subtext}
      </span>
    </div>
  );
};

// List component
const ListSection: React.FC<{ items: string[]; y: number }> = ({
  items,
  y,
}) => {
  return (
    <div
      style={{
        height: SECTION_HEIGHTS.list,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 25,
      }}
    >
      {items.map((item, i) => {
        const itemY = y + i * 60;
        const visibility = interpolate(
          itemY,
          [-350 + i * 30, -150 + i * 30],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const xOffset = interpolate(
          itemY,
          [-350 + i * 30, -150 + i * 30],
          [100, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        return (
          <div
            key={i}
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 40,
              color: VIDEO_DATA.colors.text,
              opacity: visibility,
              transform: `translateX(${xOffset}px)`,
            }}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
};

// CTA component
const CTASection: React.FC<{
  text: string;
  subtext: string;
  y: number;
  frame: number;
}> = ({ text, subtext, y, frame }) => {
  const visibility = interpolate(y, [-400, -150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bounce = Math.sin(frame / 15) * 8;

  return (
    <div
      style={{
        height: SECTION_HEIGHTS.cta,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        opacity: visibility,
      }}
    >
      <div
        style={{
          padding: "35px 80px",
          background: `linear-gradient(135deg, ${VIDEO_DATA.colors.accent}, #8b5cf6)`,
          borderRadius: 60,
          transform: `translateY(${bounce}px)`,
          boxShadow: `0 20px 60px ${VIDEO_DATA.colors.accent}44`,
        }}
      >
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 48,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {text} →
        </span>
      </div>
      <span
        style={{
          fontFamily: "system-ui, sans-serif",
          fontSize: 28,
          color: VIDEO_DATA.colors.secondary,
          marginTop: 30,
        }}
      >
        {subtext}
      </span>
    </div>
  );
};

// Main scrolling content
const ScrollingContent: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames, height } = useVideoConfig();

  const totalHeight = getTotalHeight();

  // Camera/scroll position - moves down over time
  // Start at 0, end at totalHeight - viewportHeight
  const scrollY = interpolate(
    frame,
    [0, durationInFrames - 60], // Leave 2s at end
    [0, totalHeight - height],
    { extrapolateRight: "clamp" },
  );

  // Track cumulative Y position for each section
  let cumulativeY = 0;

  return (
    <div
      style={{
        transform: `translateY(${-scrollY}px)`,
        paddingTop: height / 2 - 200, // Start content in middle of screen
      }}
    >
      {VIDEO_DATA.sections.map((section, index) => {
        const sectionY = cumulativeY - scrollY;
        const sectionHeight =
          SECTION_HEIGHTS[section.type as keyof typeof SECTION_HEIGHTS] || 300;
        cumulativeY += sectionHeight;

        switch (section.type) {
          case "hero":
            return <HeroSection key={index} y={sectionY} frame={frame} />;
          case "statement":
            return (
              <StatementSection key={index} text={section.text || ""} y={sectionY} />
            );
          case "paragraph":
            return (
              <ParagraphSection key={index} text={section.text || ""} y={sectionY} />
            );
          case "highlight":
            return (
              <HighlightSection
                key={index}
                text={section.text || ""}
                subtext={section.subtext || ""}
                y={sectionY}
                frame={frame}
              />
            );
          case "list":
            return (
              <ListSection
                key={index}
                items={section.items || []}
                y={sectionY}
              />
            );
          case "cta":
            return (
              <CTASection
                key={index}
                text={section.text || ""}
                subtext={section.subtext || ""}
                y={sectionY}
                frame={frame}
              />
            );
          default:
            return null;
        }
      })}
    </div>
  );
};

// Main composition
export const TextPanningVideo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: VIDEO_DATA.colors.background,
        overflow: "hidden",
      }}
    >
      <AnimatedBackground />
      <ScrollingContent />

      {/*
       * OPEN SOURCE MUSIC OPTIONS:
       *
       * Free music sources:
       * 1. Pixabay Music: https://pixabay.com/music/
       * 2. Free Music Archive: https://freemusicarchive.org/
       * 3. Incompetech: https://incompetech.com/music/
       * 4. Bensound: https://www.bensound.com/
       *
       * Download a track and place in /public/audio/
       * Then uncomment below:
       */}
      {/* <Audio src={staticFile('audio/ambient-corporate.mp3')} volume={0.5} /> */}
    </AbsoluteFill>
  );
};

export default TextPanningVideo;
