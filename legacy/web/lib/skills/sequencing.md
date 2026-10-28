---
title: Animation Sequencing
impact: MEDIUM
impactDescription: creates polished choreographed entrance animations
tags: sequencing, stagger, delay, choreography, timing
---

## Stagger Pattern

When animating multiple elements, use staggered delays for a polished effect.

```tsx
const STAGGER_DELAY = 5; // frames between each element

items.map((item, i) => {
  const delay = i * STAGGER_DELAY;
  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15 }
  });
  
  return (
    <div style={{ opacity: progress, transform: `translateY(${(1 - progress) * 20}px)` }}>
      {item}
    </div>
  );
});
```

## Sequential Scenes with Sequence Component

Use Remotion's Sequence component for scene-based timing.

```tsx
import { Sequence } from "remotion";

<Sequence from={0} durationInFrames={90}>
  <IntroScene />
</Sequence>

<Sequence from={90} durationInFrames={120}>
  <FeatureScene />
</Sequence>

<Sequence from={210} durationInFrames={90}>
  <CTAScene />
</Sequence>
```

## Exit Animations

Plan for exit animations by calculating time remaining in sequence.

```tsx
const { durationInFrames } = useVideoConfig();
const frame = useCurrentFrame();

// Start exit animation 30 frames before end
const exitStart = durationInFrames - 30;
const exitProgress = interpolate(
  frame,
  [exitStart, durationInFrames],
  [1, 0],
  { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
);

<div style={{ opacity: exitProgress }}>
  {/* Content */}
</div>
```

## Chain Animations

Trigger subsequent animations when previous ones complete.

```tsx
const FIRST_DURATION = 30;
const SECOND_DELAY = FIRST_DURATION + 10;

const firstProgress = interpolate(frame, [0, FIRST_DURATION], [0, 1]);
const secondProgress = interpolate(frame, [SECOND_DELAY, SECOND_DELAY + 30], [0, 1]);
```
