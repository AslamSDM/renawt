---
title: Social Media Content
impact: MEDIUM
impactDescription: optimized layouts for social media formats
tags: social-media, instagram, tiktok, stories, vertical
---

## Vertical Video Format

Social media content typically uses 9:16 aspect ratio.

```tsx
const { width, height } = useVideoConfig();

// 1080x1920 for stories/shorts
<AbsoluteFill style={{ 
  width: "100%", 
  height: "100%",
  backgroundColor: "#000",
}}>
  {/* Content optimized for vertical viewing */}
</AbsoluteFill>
```

## Safe Zones

Keep critical content away from edges for platform UI overlays.

```tsx
const SAFE_MARGIN = 60;

<div style={{ 
  padding: SAFE_MARGIN,
  width: "100%",
  height: "100%",
}}>
  {/* Critical content here */}
</div>
```

## Story Progress Indicator

Show progress through story segments.

```tsx
const SEGMENTS = 5;
const SEGMENT_DURATION = 90;

// Calculate which segment is active
const currentSegment = Math.floor(frame / SEGMENT_DURATION);
const segmentProgress = (frame % SEGMENT_DURATION) / SEGMENT_DURATION;

<div style={{ display: "flex", gap: 4, padding: 10 }}>
  {Array.from({ length: SEGMENTS }).map((_, i) => (
    <div key={i} style={{ flex: 1, height: 3, background: "#333" }}>
      <div style={{
        width: i < currentSegment ? "100%" : i === currentSegment ? `${segmentProgress * 100}%` : "0%",
        height: "100%",
        background: "#fff",
      }} />
    </div>
  ))}
</div>
```

## Text Readability on Mobile

Use larger fonts for mobile viewing.

```tsx
// Minimum readable sizes for mobile
const MOBILE_FONT_SIZES = {
  headline: 48,
  subtext: 28,
  caption: 20,
};
```
