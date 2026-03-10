import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from "remotion";

// ============================================
// VERTICAL SCROLL COMPOSITION
// Scenes stack vertically and scroll up continuously
// ============================================
interface VerticalScrollProps {
  children: React.ReactNode[];
  scrollSpeed?: number; // pixels per frame
  overlap?: number; // frames of overlap between scenes
}

export const VerticalScrollComposition: React.FC<VerticalScrollProps> = ({
  children,
  scrollSpeed = 8,
  overlap = 30,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const scrollY = frame * scrollSpeed;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          transform: `translateY(-${scrollY}px)`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {React.Children.map(children, (child, index) => (
          <div
            key={index}
            style={{
              height,
              width: "100%",
              flexShrink: 0,
              position: "relative",
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// HORIZONTAL SCROLL COMPOSITION
// Scenes scroll horizontally like a carousel
// ============================================
interface HorizontalScrollProps {
  children: React.ReactNode[];
  scrollSpeed?: number;
}

export const HorizontalScrollComposition: React.FC<HorizontalScrollProps> = ({
  children,
  scrollSpeed = 10,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const scrollX = frame * scrollSpeed;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          transform: `translateX(-${scrollX}px)`,
          display: "flex",
          flexDirection: "row",
          height: "100%",
        }}
      >
        {React.Children.map(children, (child, index) => (
          <div
            key={index}
            style={{
              width,
              height: "100%",
              flexShrink: 0,
              position: "relative",
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// PAGE SCROLL TRANSITION
// Smooth scroll between two scenes (single transition)
// ============================================
interface PageScrollTransitionProps {
  children: React.ReactNode;
  nextScene: React.ReactNode;
  direction?: "up" | "down" | "left" | "right";
  transitionDuration: number;
  totalDuration: number;
}

export const PageScrollTransition: React.FC<PageScrollTransitionProps> = ({
  children,
  nextScene,
  direction = "up",
  transitionDuration,
  totalDuration,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const transitionStart = totalDuration - transitionDuration;
  const progress = interpolate(
    frame,
    [transitionStart, totalDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  let currentTransform = "";
  let nextTransform = "";

  switch (direction) {
    case "up":
      currentTransform = `translateY(-${progress * height}px)`;
      nextTransform = `translateY(${(1 - progress) * height}px)`;
      break;
    case "down":
      currentTransform = `translateY(${progress * height}px)`;
      nextTransform = `translateY(-${(1 - progress) * height}px)`;
      break;
    case "left":
      currentTransform = `translateX(-${progress * width}px)`;
      nextTransform = `translateX(${(1 - progress) * width}px)`;
      break;
    case "right":
      currentTransform = `translateX(${progress * width}px)`;
      nextTransform = `translateX(-${(1 - progress) * width}px)`;
      break;
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: currentTransform }}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ transform: nextTransform }}>
        {nextScene}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// ZOOM THROUGH TRANSITION
// Current scene zooms in as next scene fades in
// ============================================
interface ZoomThroughProps {
  children: React.ReactNode;
  nextScene: React.ReactNode;
  transitionDuration: number;
  totalDuration: number;
  zoomScale?: number;
}

export const ZoomThroughTransition: React.FC<ZoomThroughProps> = ({
  children,
  nextScene,
  transitionDuration,
  totalDuration,
  zoomScale = 3,
}) => {
  const frame = useCurrentFrame();

  const transitionStart = totalDuration - transitionDuration;
  const progress = interpolate(
    frame,
    [transitionStart, totalDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const currentScale = interpolate(progress, [0, 1], [1, zoomScale]);
  const currentOpacity = interpolate(progress, [0, 0.5], [1, 0], {
    extrapolateRight: "clamp",
  });
  const nextOpacity = interpolate(progress, [0.3, 1], [0, 1], {
    extrapolateLeft: "clamp",
  });

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `scale(${currentScale})`,
          opacity: currentOpacity,
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: nextOpacity }}>{nextScene}</AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// PARALLAX LAYERS
// Multi-layer parallax scrolling effect
// ============================================
interface ParallaxLayer {
  content: React.ReactNode;
  speed: number; // 0 = static, 1 = normal scroll, >1 = faster
  zIndex?: number;
}

interface ParallaxContainerProps {
  layers: ParallaxLayer[];
  scrollSpeed?: number;
  direction?: "vertical" | "horizontal";
}

export const ParallaxContainer: React.FC<ParallaxContainerProps> = ({
  layers,
  scrollSpeed = 5,
  direction = "vertical",
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      {layers.map((layer, index) => {
        const offset = frame * scrollSpeed * layer.speed;
        const transform =
          direction === "vertical"
            ? `translateY(-${offset}px)`
            : `translateX(-${offset}px)`;

        return (
          <AbsoluteFill
            key={index}
            style={{
              transform,
              zIndex: layer.zIndex ?? index,
            }}
          >
            {layer.content}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

// ============================================
// CROSSFADE TRANSITION
// Smooth opacity crossfade between scenes
// ============================================
interface CrossfadeProps {
  children: React.ReactNode;
  nextScene: React.ReactNode;
  transitionDuration: number;
  totalDuration: number;
}

export const CrossfadeTransition: React.FC<CrossfadeProps> = ({
  children,
  nextScene,
  transitionDuration,
  totalDuration,
}) => {
  const frame = useCurrentFrame();

  const transitionStart = totalDuration - transitionDuration;
  const progress = interpolate(
    frame,
    [transitionStart, totalDuration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - progress }}>{children}</AbsoluteFill>
      <AbsoluteFill style={{ opacity: progress }}>{nextScene}</AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================
// MORPH TRANSITION
// Scale + blur + fade combined effect
// ============================================
interface MorphTransitionProps {
  children: React.ReactNode;
  totalDuration: number;
  transitionInDuration?: number;
  transitionOutDuration?: number;
}

export const MorphTransition: React.FC<MorphTransitionProps> = ({
  children,
  totalDuration,
  transitionInDuration = 20,
  transitionOutDuration = 20,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entry animation
  const entryScale = spring({
    frame,
    fps,
    from: 0.8,
    to: 1,
    config: { damping: 15, stiffness: 100 },
  });

  const entryOpacity = interpolate(frame, [0, transitionInDuration], [0, 1], {
    extrapolateRight: "clamp",
  });

  const entryBlur = interpolate(frame, [0, transitionInDuration], [10, 0], {
    extrapolateRight: "clamp",
  });

  // Exit animation
  const exitStart = totalDuration - transitionOutDuration;
  const exitProgress = interpolate(frame, [exitStart, totalDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitScale = interpolate(exitProgress, [0, 1], [1, 1.2]);
  const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0]);
  const exitBlur = interpolate(exitProgress, [0, 1], [0, 10]);

  const scale = frame < exitStart ? entryScale : exitScale;
  const opacity = Math.min(entryOpacity, exitOpacity);
  const blur = frame < exitStart ? entryBlur : exitBlur;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        opacity,
        filter: `blur(${blur}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ============================================
// STICKY SCROLL SECTION
// Content scrolls while header remains sticky
// ============================================
interface StickyScrollProps {
  header: React.ReactNode;
  scrollContent: React.ReactNode[];
  headerHeight?: number;
  itemHeight?: number;
  scrollSpeed?: number;
}

export const StickyScrollSection: React.FC<StickyScrollProps> = ({
  header,
  scrollContent,
  headerHeight = 150,
  itemHeight = 400,
  scrollSpeed = 4,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const scrollY = frame * scrollSpeed;
  const contentHeight = height - headerHeight;

  return (
    <AbsoluteFill>
      {/* Sticky header */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: headerHeight,
          zIndex: 10,
        }}
      >
        {header}
      </div>

      {/* Scrolling content */}
      <div
        style={{
          position: "absolute",
          top: headerHeight,
          left: 0,
          right: 0,
          height: contentHeight,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            transform: `translateY(-${scrollY}px)`,
          }}
        >
          {scrollContent.map((item, index) => (
            <div
              key={index}
              style={{
                height: itemHeight,
                width: "100%",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default {
  VerticalScrollComposition,
  HorizontalScrollComposition,
  PageScrollTransition,
  ZoomThroughTransition,
  ParallaxContainer,
  CrossfadeTransition,
  MorphTransition,
  StickyScrollSection,
};
