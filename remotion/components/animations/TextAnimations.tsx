import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from "remotion";

// ============================================
// BLUR IN TEXT
// Text fades in with blur effect (Magic UI style)
// ============================================
interface BlurInTextProps {
  text: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  duration?: number;
  delay?: number;
  direction?: "up" | "down" | "none";
}

export const BlurInText: React.FC<BlurInTextProps> = ({
  text,
  fontSize = 64,
  color = "#ffffff",
  fontFamily = "system-ui, sans-serif",
  fontWeight = "bold",
  duration = 30,
  delay = 0,
  direction = "up",
}) => {
  const frame = useCurrentFrame();
  const actualFrame = Math.max(0, frame - delay);

  const opacity = interpolate(actualFrame, [0, duration], [0, 1], {
    extrapolateRight: "clamp",
  });

  const blur = interpolate(actualFrame, [0, duration], [20, 0], {
    extrapolateRight: "clamp",
  });

  const translateY =
    direction === "none"
      ? 0
      : interpolate(
          actualFrame,
          [0, duration],
          [direction === "up" ? 30 : -30, 0],
          { extrapolateRight: "clamp" },
        );

  return (
    <span
      style={{
        fontSize,
        color,
        fontFamily,
        fontWeight,
        opacity,
        filter: `blur(${blur}px)`,
        transform: `translateY(${translateY}px)`,
        display: "inline-block",
      }}
    >
      {text}
    </span>
  );
};

// ============================================
// STAGGER WORDS
// Words animate in one by one with spring
// ============================================
interface StaggerWordsProps {
  text: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  staggerDelay?: number; // frames between each word
  wordDuration?: number;
  animation?: "fade" | "slide-up" | "blur" | "scale";
}

export const StaggerWords: React.FC<StaggerWordsProps> = ({
  text,
  fontSize = 48,
  color = "#ffffff",
  fontFamily = "system-ui, sans-serif",
  fontWeight = "bold",
  staggerDelay = 5,
  wordDuration = 20,
  animation = "slide-up",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.3em",
        justifyContent: "center",
      }}
    >
      {words.map((word, index) => {
        const wordDelay = index * staggerDelay;
        const actualFrame = Math.max(0, frame - wordDelay);

        let opacity = 1;
        let transform = "";
        let filter = "";

        switch (animation) {
          case "fade":
            opacity = interpolate(actualFrame, [0, wordDuration], [0, 1], {
              extrapolateRight: "clamp",
            });
            break;
          case "slide-up":
            opacity = interpolate(actualFrame, [0, wordDuration], [0, 1], {
              extrapolateRight: "clamp",
            });
            const y = interpolate(actualFrame, [0, wordDuration], [30, 0], {
              extrapolateRight: "clamp",
            });
            transform = `translateY(${y}px)`;
            break;
          case "blur":
            opacity = interpolate(actualFrame, [0, wordDuration], [0, 1], {
              extrapolateRight: "clamp",
            });
            const blur = interpolate(actualFrame, [0, wordDuration], [10, 0], {
              extrapolateRight: "clamp",
            });
            filter = `blur(${blur}px)`;
            break;
          case "scale":
            const scale = spring({
              frame: actualFrame,
              fps,
              config: { damping: 12, stiffness: 100 },
            });
            opacity = interpolate(actualFrame, [0, 10], [0, 1], {
              extrapolateRight: "clamp",
            });
            transform = `scale(${scale})`;
            break;
        }

        return (
          <span
            key={index}
            style={{
              fontSize,
              color,
              fontFamily,
              fontWeight,
              opacity,
              transform,
              filter,
              display: "inline-block",
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ============================================
// STAGGER CHARACTERS
// Characters fly in one by one
// ============================================
interface StaggerCharsProps {
  text: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  charDelay?: number;
  charDuration?: number;
  animation?: "fade" | "slide-up" | "slide-left" | "scale";
}

export const StaggerChars: React.FC<StaggerCharsProps> = ({
  text,
  fontSize = 72,
  color = "#ffffff",
  fontFamily = "system-ui, sans-serif",
  fontWeight = "bold",
  charDelay = 2,
  charDuration = 15,
  animation = "slide-up",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chars = text.split("");

  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      {chars.map((char, index) => {
        const delay = index * charDelay;
        const actualFrame = Math.max(0, frame - delay);

        let opacity = 1;
        let transform = "";

        switch (animation) {
          case "fade":
            opacity = interpolate(actualFrame, [0, charDuration], [0, 1], {
              extrapolateRight: "clamp",
            });
            break;
          case "slide-up":
            opacity = interpolate(actualFrame, [0, charDuration], [0, 1], {
              extrapolateRight: "clamp",
            });
            const y = interpolate(actualFrame, [0, charDuration], [50, 0], {
              extrapolateRight: "clamp",
            });
            transform = `translateY(${y}px)`;
            break;
          case "slide-left":
            opacity = interpolate(actualFrame, [0, charDuration], [0, 1], {
              extrapolateRight: "clamp",
            });
            const x = interpolate(actualFrame, [0, charDuration], [30, 0], {
              extrapolateRight: "clamp",
            });
            transform = `translateX(${x}px)`;
            break;
          case "scale":
            const scale = spring({
              frame: actualFrame,
              fps,
              config: { damping: 10, stiffness: 200 },
            });
            opacity = interpolate(actualFrame, [0, 8], [0, 1], {
              extrapolateRight: "clamp",
            });
            transform = `scale(${scale})`;
            break;
        }

        return (
          <span
            key={index}
            style={{
              fontSize,
              color,
              fontFamily,
              fontWeight,
              opacity,
              transform,
              display: "inline-block",
              whiteSpace: "pre",
            }}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
};

// ============================================
// ENCRYPTED TEXT
// Matrix-style scramble reveal
// ============================================
interface EncryptedTextProps {
  text: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  duration?: number;
  scrambleChars?: string;
}

const DEFAULT_SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

export const EncryptedText: React.FC<EncryptedTextProps> = ({
  text,
  fontSize = 48,
  color = "#00ff00",
  fontFamily = "monospace",
  fontWeight = "bold",
  duration = 60,
  scrambleChars = DEFAULT_SCRAMBLE,
}) => {
  const frame = useCurrentFrame();

  const getDisplayText = () => {
    const progress = Math.min(1, frame / duration);
    const revealedCount = Math.floor(text.length * progress);

    return text.split("").map((char, index) => {
      if (index < revealedCount) {
        return char;
      }
      // Still scrambling
      if (char === " ") return " ";
      const randomIndex = Math.floor(
        (frame * (index + 1)) % scrambleChars.length,
      );
      return scrambleChars[randomIndex];
    });
  };

  const displayChars = getDisplayText();

  return (
    <div
      style={{
        fontSize,
        color,
        fontFamily,
        fontWeight,
        display: "flex",
        justifyContent: "center",
      }}
    >
      {displayChars.map((char, index) => {
        const isRevealed = index < Math.floor((text.length * frame) / duration);
        return (
          <span
            key={index}
            style={{
              opacity: isRevealed ? 1 : 0.7,
              display: "inline-block",
              whiteSpace: "pre",
            }}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
};

// ============================================
// GRADIENT TEXT
// Animated gradient sweep across text
// ============================================
interface GradientTextProps {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  colors?: string[];
  animationDuration?: number;
}

export const GradientText: React.FC<GradientTextProps> = ({
  text,
  fontSize = 72,
  fontFamily = "system-ui, sans-serif",
  fontWeight = "bold",
  colors = ["#667eea", "#764ba2", "#f093fb", "#667eea"],
  animationDuration = 90,
}) => {
  const frame = useCurrentFrame();

  const gradientPosition = interpolate(
    frame,
    [0, animationDuration],
    [0, 100],
    { extrapolateRight: "extend" },
  );

  const gradient = `linear-gradient(
    90deg,
    ${colors.join(", ")}
  )`;

  return (
    <span
      style={{
        fontSize,
        fontFamily,
        fontWeight,
        background: gradient,
        backgroundSize: "200% 100%",
        backgroundPosition: `${gradientPosition}% 0`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
    >
      {text}
    </span>
  );
};

// ============================================
// TYPEWRITER PRO
// Enhanced typewriter with cursor
// ============================================
interface TypewriterProProps {
  text: string;
  fontSize?: number;
  color?: string;
  cursorColor?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  charsPerFrame?: number;
  showCursor?: boolean;
}

export const TypewriterPro: React.FC<TypewriterProProps> = ({
  text,
  fontSize = 48,
  color = "#ffffff",
  cursorColor = "#ffffff",
  fontFamily = "monospace",
  fontWeight = "normal",
  charsPerFrame = 0.5,
  showCursor = true,
}) => {
  const frame = useCurrentFrame();

  const visibleChars = Math.min(text.length, Math.floor(frame * charsPerFrame));
  const displayText = text.slice(0, visibleChars);
  const cursorVisible = frame % 30 < 15; // Blink every 0.5s at 30fps

  return (
    <div
      style={{
        fontSize,
        color,
        fontFamily,
        fontWeight,
        display: "flex",
        alignItems: "center",
      }}
    >
      <span>{displayText}</span>
      {showCursor && (
        <span
          style={{
            width: "0.1em",
            height: "1em",
            backgroundColor: cursorColor,
            marginLeft: "2px",
            opacity: cursorVisible ? 1 : 0,
          }}
        />
      )}
    </div>
  );
};

// ============================================
// FLIP TEXT
// 3D flip reveal animation
// ============================================
interface FlipTextProps {
  text: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  fontWeight?: number | string;
  duration?: number;
  delay?: number;
}

export const FlipText: React.FC<FlipTextProps> = ({
  text,
  fontSize = 64,
  color = "#ffffff",
  fontFamily = "system-ui, sans-serif",
  fontWeight = "bold",
  duration = 30,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const actualFrame = Math.max(0, frame - delay);

  const rotateX = spring({
    frame: actualFrame,
    fps,
    from: -90,
    to: 0,
    config: { damping: 15, stiffness: 100 },
  });

  const opacity = interpolate(actualFrame, [0, duration * 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        perspective: "1000px",
        transformStyle: "preserve-3d",
      }}
    >
      <span
        style={{
          fontSize,
          color,
          fontFamily,
          fontWeight,
          display: "inline-block",
          transform: `rotateX(${rotateX}deg)`,
          opacity,
          transformOrigin: "bottom center",
        }}
      >
        {text}
      </span>
    </div>
  );
};

// Export all components
export default {
  BlurInText,
  StaggerWords,
  StaggerChars,
  EncryptedText,
  GradientText,
  TypewriterPro,
  FlipText,
};
