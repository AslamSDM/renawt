/**
 * Recording Scene Component for Remotion
 * Plays recorded video with cursor overlay and zoom effects
 */

import React from "react";
import { AbsoluteFill, Video, useVideoConfig, useCurrentFrame, interpolate } from "remotion";
import { CursorOverlay } from "./CursorOverlay";
import { ZoomEffect } from "./ZoomEffect";
import { getCursorAtTime, getZoomAtTime } from "@/lib/recording/cursorTracker";
import type { CursorEvent } from "@/lib/recording/cursorTracker";

interface RecordingSceneProps {
  videoUrl: string;
  cursorData: CursorEvent[];
  zoomPoints: Array<{
    time: number;
    x: number;
    y: number;
    scale: number;
    duration: number;
  }>;
  trimStart: number;
  trimEnd: number;
  cursorStyle: "normal" | "hand";
  featureName?: string;
  description?: string;
}

// Feature label overlay shown at start
const FeatureLabel: React.FC<{
  name: string;
  description?: string;
  visible: boolean;
}> = ({ name, description, visible }) => {
  if (!visible) return null;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        padding: 60,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          backdropFilter: "blur(10px)",
          padding: "24px 32px",
          borderRadius: 12,
          border: "1px solid rgba(255, 255, 255, 0.1)",
          maxWidth: 600,
        }}
      >
        <h3
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "white",
            marginBottom: description ? 8 : 0,
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {name}
        </h3>
        {description && (
          <p
            style={{
              fontSize: 16,
              color: "rgba(255, 255, 255, 0.7)",
              lineHeight: 1.5,
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {description}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};

// 3D perspective container that applies skew during zoom
const PerspectiveContainer: React.FC<{
  children: React.ReactNode;
  zoom: any;
  frame: number;
  fps: number;
}> = ({ children, zoom, frame, fps }) => {
  // Calculate 3D skew based on zoom level
  // When zooming in, tilt the video to give it depth
  const skewX = zoom ? interpolate(
    frame,
    [zoom.startFrame, zoom.startFrame + zoom.duration * fps * 0.3],
    [0, -5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  ) : 0;

  const skewY = zoom ? interpolate(
    frame,
    [zoom.startFrame, zoom.startFrame + zoom.duration * fps * 0.3],
    [0, 3],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  ) : 0;

  const rotateX = zoom ? interpolate(
    frame,
    [zoom.startFrame, zoom.startFrame + zoom.duration * fps * 0.3],
    [0, 8],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  ) : 0;

  const rotateY = zoom ? interpolate(
    frame,
    [zoom.startFrame, zoom.startFrame + zoom.duration * fps * 0.3],
    [0, -5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  ) : 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        perspective: "1200px",
        perspectiveOrigin: "center center",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transform: `
            perspective(1200px)
            rotateX(${rotateX}deg)
            rotateY(${rotateY}deg)
            skewX(${skewX}deg)
            skewY(${skewY}deg)
          `,
          transformStyle: "preserve-3d",
          transition: "transform 0.1s ease-out",
          boxShadow: zoom ? "0 25px 50px -12px rgba(0, 0, 0, 0.5)" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const RecordingScene: React.FC<RecordingSceneProps> = ({
  videoUrl,
  cursorData,
  zoomPoints,
  trimStart,
  trimEnd,
  cursorStyle,
  featureName,
  description,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Calculate actual frame (with trim)
  const actualFrame = frame + Math.round(trimStart * fps);

  // Calculate current time in milliseconds
  const currentTimeMs = (actualFrame / fps) * 1000;

  // Get interpolated cursor position
  const cursor = getCursorAtTime(cursorData, currentTimeMs);

  // Get current zoom settings
  const currentTimeSec = actualFrame / fps;
  const zoom = getZoomAtTime(zoomPoints, currentTimeSec);

  // Show feature label for first 3 seconds (90 frames at 30fps)
  const showLabel = frame < fps * 3;

  // Calculate video duration
  const videoDuration = trimEnd > 0 ? trimEnd - trimStart : undefined;

  return (
    <AbsoluteFill style={{ 
      backgroundColor: "black",
      perspective: "1200px",
    }}>
      {/* Video layer with 3D zoom effect */}
      <PerspectiveContainer zoom={zoom} frame={frame} fps={fps}>
        <ZoomEffect zoomPoints={zoomPoints} trimStart={trimStart}>
          <Video
            src={videoUrl}
            startFrom={Math.round(trimStart * fps)}
            endAt={trimEnd > 0 ? Math.round(trimEnd * fps) : undefined}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </ZoomEffect>
      </PerspectiveContainer>

      {/* Cursor overlay */}
      {cursor && (
        <CursorOverlay
          x={cursor.x}
          y={cursor.y}
          isClick={cursor.type === "click"}
          style={cursorStyle}
        />
      )}

      {/* Feature label */}
      {featureName && (
        <FeatureLabel
          name={featureName}
          description={description}
          visible={showLabel}
        />
      )}
    </AbsoluteFill>
  );
};

export default RecordingScene;
