import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  AbsoluteFill,
  Easing,
} from "remotion";

interface CameraWrapperProps {
  children: React.ReactNode;
  zoomRange?: [number, number];
  panX?: [number, number];
  panY?: [number, number];
  rotateRange?: [number, number];
  easing?: "linear" | "ease-in-out";
}

export const CameraWrapper: React.FC<CameraWrapperProps> = ({
  children,
  zoomRange = [1, 1.15],
  panX = [0, 0],
  panY = [0, 0],
  rotateRange = [0, 0],
  easing = "ease-in-out",
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const easingFn =
    easing === "ease-in-out" ? Easing.inOut(Easing.quad) : undefined;

  const scale = interpolate(frame, [0, durationInFrames], zoomRange, {
    extrapolateRight: "clamp",
    easing: easingFn,
  });

  const translateX = interpolate(frame, [0, durationInFrames], panX, {
    extrapolateRight: "clamp",
    easing: easingFn,
  });

  const translateY = interpolate(frame, [0, durationInFrames], panY, {
    extrapolateRight: "clamp",
    easing: easingFn,
  });

  const rotate = interpolate(frame, [0, durationInFrames], rotateRange, {
    extrapolateRight: "clamp",
    easing: easingFn,
  });

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale}) translate(${translateX}px, ${translateY}px) rotate(${rotate}deg)`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

export default CameraWrapper;
