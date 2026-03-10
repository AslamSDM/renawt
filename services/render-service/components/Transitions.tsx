import React from "react";
import { useCurrentFrame, interpolate, AbsoluteFill } from "remotion";

interface FadeTransitionProps {
  children: React.ReactNode;
  durationInFrames?: number;
  type?: "in" | "out" | "both";
  totalDuration: number;
}

export const FadeTransition: React.FC<FadeTransitionProps> = ({
  children,
  durationInFrames = 15,
  type = "both",
  totalDuration,
}) => {
  const frame = useCurrentFrame();

  let opacity = 1;

  if (type === "in" || type === "both") {
    const fadeIn = interpolate(frame, [0, durationInFrames], [0, 1], {
      extrapolateRight: "clamp",
    });
    opacity = Math.min(opacity, fadeIn);
  }

  if (type === "out" || type === "both") {
    const fadeOut = interpolate(
      frame,
      [totalDuration - durationInFrames, totalDuration],
      [1, 0],
      { extrapolateLeft: "clamp" }
    );
    opacity = Math.min(opacity, fadeOut);
  }

  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

interface SlideTransitionProps {
  children: React.ReactNode;
  direction?: "up" | "down" | "left" | "right";
  durationInFrames?: number;
  type?: "in" | "out" | "both";
  totalDuration: number;
}

export const SlideTransition: React.FC<SlideTransitionProps> = ({
  children,
  direction = "up",
  durationInFrames = 20,
  type = "both",
  totalDuration,
}) => {
  const frame = useCurrentFrame();

  const getTransform = () => {
    const distance = 100;
    let translateX = 0;
    let translateY = 0;

    // Entry animation
    if (type === "in" || type === "both") {
      const progress = interpolate(frame, [0, durationInFrames], [1, 0], {
        extrapolateRight: "clamp",
      });

      switch (direction) {
        case "up":
          translateY = progress * distance;
          break;
        case "down":
          translateY = -progress * distance;
          break;
        case "left":
          translateX = progress * distance;
          break;
        case "right":
          translateX = -progress * distance;
          break;
      }
    }

    // Exit animation
    if (type === "out" || type === "both") {
      const exitProgress = interpolate(
        frame,
        [totalDuration - durationInFrames, totalDuration],
        [0, 1],
        { extrapolateLeft: "clamp" }
      );

      switch (direction) {
        case "up":
          translateY -= exitProgress * distance;
          break;
        case "down":
          translateY += exitProgress * distance;
          break;
        case "left":
          translateX -= exitProgress * distance;
          break;
        case "right":
          translateX += exitProgress * distance;
          break;
      }
    }

    return `translate(${translateX}px, ${translateY}px)`;
  };

  const opacity =
    type === "both"
      ? interpolate(
          frame,
          [0, durationInFrames, totalDuration - durationInFrames, totalDuration],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      : type === "in"
        ? interpolate(frame, [0, durationInFrames], [0, 1], {
            extrapolateRight: "clamp",
          })
        : interpolate(
            frame,
            [totalDuration - durationInFrames, totalDuration],
            [1, 0],
            { extrapolateLeft: "clamp" }
          );

  return (
    <AbsoluteFill style={{ transform: getTransform(), opacity }}>
      {children}
    </AbsoluteFill>
  );
};

interface ScaleTransitionProps {
  children: React.ReactNode;
  durationInFrames?: number;
  type?: "in" | "out" | "both";
  totalDuration: number;
  from?: number;
  to?: number;
}

export const ScaleTransition: React.FC<ScaleTransitionProps> = ({
  children,
  durationInFrames = 20,
  type = "both",
  totalDuration,
  from = 0.8,
  to = 1,
}) => {
  const frame = useCurrentFrame();

  let scale = to;
  let opacity = 1;

  if (type === "in" || type === "both") {
    scale = interpolate(frame, [0, durationInFrames], [from, to], {
      extrapolateRight: "clamp",
    });
    opacity = interpolate(frame, [0, durationInFrames], [0, 1], {
      extrapolateRight: "clamp",
    });
  }

  if (type === "out" || type === "both") {
    const exitScale = interpolate(
      frame,
      [totalDuration - durationInFrames, totalDuration],
      [to, from],
      { extrapolateLeft: "clamp" }
    );
    const exitOpacity = interpolate(
      frame,
      [totalDuration - durationInFrames, totalDuration],
      [1, 0],
      { extrapolateLeft: "clamp" }
    );

    if (type === "both") {
      scale = frame > totalDuration - durationInFrames ? exitScale : scale;
      opacity = Math.min(opacity, exitOpacity);
    } else {
      scale = exitScale;
      opacity = exitOpacity;
    }
  }

  return (
    <AbsoluteFill style={{ transform: `scale(${scale})`, opacity }}>
      {children}
    </AbsoluteFill>
  );
};

interface WipeTransitionProps {
  children: React.ReactNode;
  direction?: "left" | "right" | "up" | "down";
  durationInFrames?: number;
  color?: string;
}

export const WipeTransition: React.FC<WipeTransitionProps> = ({
  children,
  direction = "right",
  durationInFrames = 20,
  color = "#000000",
}) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateRight: "clamp",
  });

  const getClipPath = () => {
    switch (direction) {
      case "right":
        return `inset(0 ${100 - progress}% 0 0)`;
      case "left":
        return `inset(0 0 0 ${100 - progress}%)`;
      case "down":
        return `inset(0 0 ${100 - progress}% 0)`;
      case "up":
        return `inset(${100 - progress}% 0 0 0)`;
    }
  };

  return (
    <>
      <AbsoluteFill style={{ backgroundColor: color }} />
      <AbsoluteFill style={{ clipPath: getClipPath() }}>{children}</AbsoluteFill>
    </>
  );
};

interface FlashTransitionProps {
  color?: string;
  durationInFrames?: number;
}

export const FlashTransition: React.FC<FlashTransitionProps> = ({
  color = "#ffffff",
  durationInFrames = 6,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, durationInFrames], [1, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: color,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

export default {
  FadeTransition,
  SlideTransition,
  ScaleTransition,
  WipeTransition,
  FlashTransition,
};
