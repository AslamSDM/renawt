import React from "react";
import { useCurrentFrame } from "remotion";

// ============================================
// SCENE PROGRESS DOTS
// Bottom-center dots showing current scene position
// ============================================
interface SceneProgressDotsProps {
  totalScenes: number;
  sceneBoundaries: number[]; // frame boundaries for each scene start
}

export const SceneProgressDots: React.FC<SceneProgressDotsProps> = ({
  totalScenes,
  sceneBoundaries,
}) => {
  const frame = useCurrentFrame();

  // Calculate current scene index from frame
  let currentScene = 0;
  for (let i = sceneBoundaries.length - 1; i >= 0; i--) {
    if (frame >= sceneBoundaries[i]) {
      currentScene = i;
      break;
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 40,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 8,
        alignItems: "center",
        zIndex: 100,
      }}
    >
      {Array.from({ length: totalScenes }, (_, i) => {
        const isActive = i === currentScene;
        const isPast = i < currentScene;

        return (
          <div
            key={i}
            style={{
              width: isActive ? 24 : 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: isActive
                ? "#a855f7"
                : isPast
                  ? "rgba(168, 85, 247, 0.5)"
                  : "rgba(255, 255, 255, 0.3)",
              transition: "none", // Remotion doesn't support CSS transitions
            }}
          />
        );
      })}
    </div>
  );
};
