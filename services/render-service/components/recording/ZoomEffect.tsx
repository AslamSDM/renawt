/**
 * Zoom Effect Component for Remotion
 * Applies smooth zoom transforms to video content
 */

import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

interface ZoomEffectProps {
  zoomPoints: Array<{
    time: number; // seconds
    x: number; // normalized 0-1
    y: number;
    scale: number;
    duration: number; // seconds
  }>;
  trimStart: number; // seconds
  children: React.ReactNode;
}

export const ZoomEffect: React.FC<ZoomEffectProps> = ({
  zoomPoints,
  trimStart,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate current time in seconds (adjusted for trim)
  const currentTime = frame / fps + trimStart;

  // Find active zoom point
  const activeZoom = zoomPoints.find((zoom) => {
    const start = zoom.time;
    const end = zoom.time + zoom.duration;
    return currentTime >= start && currentTime <= end;
  });

  // Default: no zoom, centered
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  if (activeZoom) {
    const zoomStart = activeZoom.time;
    const zoomEnd = activeZoom.time + activeZoom.duration;
    const progress = (currentTime - zoomStart) / activeZoom.duration;

    // Smooth easing function
    const easeInOut = (t: number): number => {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    };

    // Calculate scale with easing
    if (progress < 0.15) {
      // Ease in (first 15%)
      const easedProgress = easeInOut(progress / 0.15);
      scale = 1 + (activeZoom.scale - 1) * easedProgress;
    } else if (progress > 0.85) {
      // Ease out (last 15%)
      const easedProgress = easeInOut((1 - progress) / 0.15);
      scale = 1 + (activeZoom.scale - 1) * easedProgress;
    } else {
      // Full zoom (middle 70%)
      scale = activeZoom.scale;
    }

    // Calculate translation to center zoom point
    // When scaling up, we need to shift the view to keep the zoom point centered
    const zoomPointX = activeZoom.x; // 0-1 normalized
    const zoomPointY = activeZoom.y;

    // Calculate translation percentages
    // If zoom point is at 0.5 (center), no translation needed
    // If zoom point is at 0 (left), we need to translate right
    translateX = (0.5 - zoomPointX) * (scale - 1) * 100;
    translateY = (0.5 - zoomPointY) * (scale - 1) * 100;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
        transformOrigin: "center center",
        transition: "none", // Remotion handles frame-by-frame
      }}
    >
      {children}
    </div>
  );
};

export default ZoomEffect;
