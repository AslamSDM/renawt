"use client";

import React, { useCallback, useState, useMemo, useEffect } from "react";
import { Player, PlayerRef, CallbackListener } from "@remotion/player";
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
} from "remotion";
import type { VideoScript } from "@/lib/types";

interface VideoPlayerProps {
  script?: VideoScript;
  code?: string;
  className?: string;
}

// Dynamically render scenes based on VideoScript
const DynamicComposition: React.FC<{ script: VideoScript }> = ({ script }) => {
  return (
    <AbsoluteFill>
      {script.scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.endFrame - scene.startFrame}
        >
          <SceneRenderer scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const SceneRenderer: React.FC<{ scene: VideoScript["scenes"][0] }> = ({
  scene,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = scene.endFrame - scene.startFrame;

  // Animation calculations based on scene.animation.enter
  const getEnterAnimation = () => {
    switch (scene.animation.enter) {
      case "fade":
        return {
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: "none",
        };
      case "slide-up":
        return {
          opacity: interpolate(frame, [0, 20], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `translateY(${interpolate(frame, [0, 20], [50, 0], { extrapolateRight: "clamp" })}px)`,
        };
      case "scale":
        const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
        return {
          opacity: interpolate(frame, [0, 15], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: `scale(${scale})`,
        };
      case "reveal":
        return {
          opacity: 1,
          clipPath: `inset(0 ${interpolate(frame, [0, 25], [100, 0], { extrapolateRight: "clamp" })}% 0 0)`,
          transform: "none",
        };
      case "typewriter":
      default:
        return {
          opacity: interpolate(frame, [0, 15], [0, 1], {
            extrapolateRight: "clamp",
          }),
          transform: "none",
        };
    }
  };

  // Exit animation
  const getExitAnimation = () => {
    const exitStart = duration - 15;
    if (frame < exitStart) return {};

    switch (scene.animation.exit) {
      case "fade":
        return {
          opacity: interpolate(frame, [exitStart, duration], [1, 0], {
            extrapolateLeft: "clamp",
          }),
        };
      case "slide-down":
        return {
          transform: `translateY(${interpolate(frame, [exitStart, duration], [0, 50], { extrapolateLeft: "clamp" })}px)`,
          opacity: interpolate(frame, [exitStart, duration], [1, 0], {
            extrapolateLeft: "clamp",
          }),
        };
      case "scale-out":
        return {
          transform: `scale(${interpolate(frame, [exitStart, duration], [1, 0.8], { extrapolateLeft: "clamp" })})`,
          opacity: interpolate(frame, [exitStart, duration], [1, 0], {
            extrapolateLeft: "clamp",
          }),
        };
      default:
        return {};
    }
  };

  const enterStyle = getEnterAnimation();
  const exitStyle = getExitAnimation();
  const combinedStyle = { ...enterStyle, ...exitStyle };

  const getFontSize = () => {
    switch (scene.style.fontSize) {
      case "large":
        return { headline: 64, subtext: 28 };
      case "medium":
        return { headline: 48, subtext: 22 };
      case "small":
        return { headline: 36, subtext: 18 };
    }
  };

  const fontSize = getFontSize();

  return (
    <AbsoluteFill
      style={{
        background: scene.style.background,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: "80%",
          ...combinedStyle,
        }}
      >
        {scene.content.headline && (
          <h1
            style={{
              color: scene.style.textColor,
              fontSize: fontSize.headline,
              fontWeight: "bold",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {scene.animation.enter === "typewriter"
              ? scene.content.headline.slice(
                  0,
                  Math.floor(
                    interpolate(
                      frame,
                      [0, scene.content.headline.length * 2],
                      [0, scene.content.headline.length],
                      { extrapolateRight: "clamp" }
                    )
                  )
                )
              : scene.content.headline}
          </h1>
        )}
        {scene.content.subtext && (
          <p
            style={{
              color: scene.style.textColor,
              fontSize: fontSize.subtext,
              marginTop: 20,
              opacity: interpolate(frame, [20, 40], [0, 0.8], {
                extrapolateRight: "clamp",
                extrapolateLeft: "clamp",
              }),
            }}
          >
            {scene.content.subtext}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Fallback composition when no script is provided
const PlaceholderComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          textAlign: "center",
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        <div style={{ fontSize: 72, marginBottom: 20 }}>🎬</div>
        <h1
          style={{
            color: "#ffffff",
            fontSize: 42,
            fontWeight: "bold",
            margin: 0,
          }}
        >
          Generate a Video
        </h1>
        <p
          style={{
            color: "#a0a0a0",
            fontSize: 20,
            marginTop: 16,
          }}
        >
          Enter a URL or description to get started
        </p>
      </div>
    </AbsoluteFill>
  );
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  script,
  className = "",
}) => {
  const playerRef = React.useRef<PlayerRef>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);

  const totalDuration = script?.totalDuration || 300;

  const CompositionComponent = useMemo(() => {
    if (script) {
      return () => <DynamicComposition script={script} />;
    }
    return PlaceholderComposition;
  }, [script]);

  // Set up event listeners
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handlePlay: CallbackListener<"play"> = () => {
      setIsPlaying(true);
    };

    const handlePause: CallbackListener<"pause"> = () => {
      setIsPlaying(false);
    };

    const handleFrameUpdate: CallbackListener<"frameupdate"> = (e) => {
      setCurrentFrame(e.detail.frame);
    };

    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);
    player.addEventListener("frameupdate", handleFrameUpdate);

    return () => {
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
      player.removeEventListener("frameupdate", handleFrameUpdate);
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pause();
      } else {
        playerRef.current.play();
      }
    }
  }, [isPlaying]);

  const handleSeek = useCallback((frame: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(frame);
    }
  }, []);

  const formatTime = (frames: number, fps: number = 30) => {
    const seconds = Math.floor(frames / fps);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Video Player */}
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        <Player
          ref={playerRef}
          component={CompositionComponent}
          durationInFrames={totalDuration}
          fps={30}
          compositionWidth={1920}
          compositionHeight={1080}
          style={{ width: "100%", height: "100%" }}
          controls={false}
          loop
          autoPlay={false}
          clickToPlay={false}
        />
      </div>

      {/* Controls */}
      <div className="mt-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-4">
          {/* Play/Pause Button */}
          <button
            onClick={handlePlayPause}
            className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Timeline */}
          <div className="flex-1">
            <input
              type="range"
              min={0}
              max={totalDuration}
              value={currentFrame}
              onChange={(e) => handleSeek(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Time Display */}
          <div className="text-sm text-gray-600 dark:text-gray-400 font-mono min-w-[80px] text-right">
            {formatTime(currentFrame)} / {formatTime(totalDuration)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
