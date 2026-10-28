---
title: Spring Physics
impact: HIGH
impactDescription: creates natural, organic motion with proper damping
tags: spring, physics, bounce, elastic, damping
---

## Spring Configuration

Spring physics create natural, organic motion. Key parameters:

| Parameter | Default | Effect |
|-----------|---------|--------|
| `mass` | 1 | Higher = slower, more momentum |
| `damping` | 10 | Higher = less bounce, settles faster |
| `stiffness` | 100 | Higher = more bouncy, snaps faster |
| `overshootClamping` | false | true = prevents bouncing past target |

## Basic Spring Entrance

Use spring for element entrances that feel natural.

```tsx
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const scale = spring({
  frame,
  fps,
  config: {
    damping: 12,
    stiffness: 100,
    mass: 0.8,
  },
});

<div style={{ transform: `scale(${scale})` }}>
  Content
</div>
```

## Delayed Spring

Trigger spring animation after a delay.

```tsx
const DELAY = 15;
const progress = spring({
  frame: frame - DELAY,
  fps,
  config: { damping: 15 },
});
```

## Spring for Scale

Bouncy scale effect for emphasis.

```tsx
const bounceScale = spring({
  frame,
  fps,
  config: {
    damping: 8,
    stiffness: 150,
    mass: 1,
  },
});

// Scale from 0 to 1 with overshoot
const scale = interpolate(bounceScale, [0, 1], [0, 1.2]);
```

## When to Use Spring vs Interpolate

**Use spring() for:**
- Entrance animations
- Button presses
- Toggle states
- Natural movement

**Use interpolate() for:**
- Progress bars
- Scroll-based animations
- Continuous rotation
- Linear fades
