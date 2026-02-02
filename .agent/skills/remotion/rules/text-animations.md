---
name: text-animations
description: Typography and text animation patterns for Remotion.
metadata:
  tags: typography, text, typewriter, highlighter
---

## Text animations

Based on `useCurrentFrame()`, reduce the string character by character to create a typewriter effect.

## Typewriter Effect

```tsx
import { useCurrentFrame, useVideoConfig } from "remotion";

const Typewriter: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Characters per second
  const charsPerSecond = 20;
  const charIndex = Math.floor((frame / fps) * charsPerSecond);
  const displayText = text.slice(0, charIndex);

  return <span>{displayText}</span>;
};
```

Always use string slicing for typewriter effects. Never use per-character opacity.

## Blur-In Text Effect

```tsx
import { useCurrentFrame, interpolate } from "remotion";

const BlurInText: React.FC<{ text: string; delay?: number }> = ({
  text,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);

  const opacity = interpolate(f, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const blur = interpolate(f, [0, 25], [15, 0], { extrapolateRight: "clamp" });
  const y = interpolate(f, [0, 25], [30, 0], { extrapolateRight: "clamp" });

  return (
    <span
      style={{
        opacity,
        filter: `blur(${blur}px)`,
        transform: `translateY(${y}px)`,
        display: "inline-block",
      }}
    >
      {text}
    </span>
  );
};
```

## Stagger Words Effect

```tsx
import { useCurrentFrame, interpolate } from "remotion";

const StaggerWords: React.FC<{ text: string; staggerDelay?: number }> = ({
  text,
  staggerDelay = 4,
}) => {
  const frame = useCurrentFrame();
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
      {words.map((word, i) => {
        const f = Math.max(0, frame - i * staggerDelay);
        const opacity = interpolate(f, [0, 15], [0, 1], {
          extrapolateRight: "clamp",
        });
        const y = interpolate(f, [0, 15], [20, 0], {
          extrapolateRight: "clamp",
        });
        return (
          <span key={i} style={{ opacity, transform: `translateY(${y}px)` }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};
```
