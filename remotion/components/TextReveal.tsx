import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

interface TextRevealProps {
  text: string;
  style?: React.CSSProperties;
  type?: "typewriter" | "word-by-word" | "fade" | "slide-up" | "scale" | "blur-in";
  delay?: number;
  duration?: number;
}

export const TextReveal: React.FC<TextRevealProps> = ({
  text,
  style = {},
  type = "fade",
  delay = 0,
  duration = 30,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const adjustedFrame = Math.max(0, frame - delay);

  if (type === "blur-in") {
    const opacity = interpolate(adjustedFrame, [0, duration * 0.6], [0, 1], {
      extrapolateRight: "clamp",
    });
    const blur = interpolate(adjustedFrame, [0, duration * 0.6], [10, 0], {
      extrapolateRight: "clamp",
    });
    const translateY = interpolate(adjustedFrame, [0, duration * 0.6], [20, 0], {
      extrapolateRight: "clamp",
    });

    return (
      <span
        style={{
          ...style,
          display: "inline-block",
          opacity,
          transform: `translateY(${translateY}px)`,
          filter: `blur(${blur}px)`,
        }}
      >
        {text}
      </span>
    );
  }

  if (type === "typewriter") {
    const charsToShow = Math.floor(
      interpolate(adjustedFrame, [0, duration], [0, text.length], {
        extrapolateRight: "clamp",
      })
    );
    const displayText = text.slice(0, charsToShow);
    const showCursor = adjustedFrame < duration || adjustedFrame % 30 < 15;

    return (
      <span style={style}>
        {displayText}
        {showCursor && <span style={{ opacity: 0.7 }}>|</span>}
      </span>
    );
  }

  if (type === "word-by-word") {
    const words = text.split(" ");
    const wordsToShow = Math.floor(
      interpolate(adjustedFrame, [0, duration], [0, words.length], {
        extrapolateRight: "clamp",
      })
    );

    return (
      <span style={style}>
        {words.slice(0, wordsToShow).map((word, i) => {
          const wordDelay = (i / words.length) * duration;
          const wordFrame = Math.max(0, adjustedFrame - wordDelay);
          const wordOpacity = interpolate(wordFrame, [0, 10], [0, 1], {
            extrapolateRight: "clamp",
          });
          const wordY = interpolate(wordFrame, [0, 10], [10, 0], {
            extrapolateRight: "clamp",
          });

          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: wordOpacity,
                transform: `translateY(${wordY}px)`,
                marginRight: "0.3em",
              }}
            >
              {word}
            </span>
          );
        })}
      </span>
    );
  }

  if (type === "slide-up") {
    const opacity = interpolate(adjustedFrame, [0, duration * 0.6], [0, 1], {
      extrapolateRight: "clamp",
    });
    const translateY = interpolate(adjustedFrame, [0, duration * 0.6], [40, 0], {
      extrapolateRight: "clamp",
    });

    return (
      <span
        style={{
          ...style,
          display: "inline-block",
          opacity,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {text}
      </span>
    );
  }

  if (type === "scale") {
    const scale = spring({
      frame: adjustedFrame,
      fps,
      config: {
        damping: 12,
        stiffness: 100,
        mass: 0.5,
      },
    });
    const opacity = interpolate(adjustedFrame, [0, 15], [0, 1], {
      extrapolateRight: "clamp",
    });

    return (
      <span
        style={{
          ...style,
          display: "inline-block",
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        {text}
      </span>
    );
  }

  // Default: fade
  const opacity = interpolate(adjustedFrame, [0, duration * 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <span style={{ ...style, opacity }}>
      {text}
    </span>
  );
};

// Character stagger animation
interface CharacterStaggerProps {
  text: string;
  style?: React.CSSProperties;
  staggerDelay?: number;
  charDuration?: number;
}

export const CharacterStagger: React.FC<CharacterStaggerProps> = ({
  text,
  style = {},
  staggerDelay = 2,
  charDuration = 15,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <span style={style}>
      {text.split("").map((char, i) => {
        const charDelay = i * staggerDelay;
        const charFrame = Math.max(0, frame - charDelay);

        const scale = spring({
          frame: charFrame,
          fps,
          config: {
            damping: 10,
            stiffness: 200,
          },
        });

        const opacity = interpolate(charFrame, [0, charDuration * 0.3], [0, 1], {
          extrapolateRight: "clamp",
        });

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              transform: `scale(${scale})`,
              whiteSpace: char === " " ? "pre" : "normal",
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
};

export default TextReveal;
