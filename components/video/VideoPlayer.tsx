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
import type { VideoScript, VideoScene } from "@/lib/types";

interface VideoPlayerProps {
  script?: VideoScript;
  code?: string;
  className?: string;
}

// ============================================================================
// PREMIUM ANIMATION PRIMITIVES
// ============================================================================

const BlurInText: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  color?: string;
}> = ({ text, fontSize = 72, delay = 0, color = "#ffffff" }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 25], [0, 1], {
    extrapolateRight: "clamp",
  });
  const blur = interpolate(f, [0, 25], [15, 0], { extrapolateRight: "clamp" });
  const y = interpolate(f, [0, 25], [30, 0], { extrapolateRight: "clamp" });

  return (
    <span
      style={{
        fontSize,
        fontWeight: "bold",
        fontFamily: "system-ui, sans-serif",
        color,
        opacity,
        filter: `blur(${blur}px)`,
        transform: `translateY(${y}px)`,
        display: "inline-block",
      }}
    >
      {text}
    </span>
  );
};

const StaggerWords: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  staggerDelay?: number;
  color?: string;
}> = ({
  text,
  fontSize = 32,
  delay = 0,
  staggerDelay = 4,
  color = "#ffffff",
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.3em",
        justifyContent: "center",
        fontSize,
        fontFamily: "system-ui, sans-serif",
        color,
      }}
    >
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * staggerDelay);
        const opacity = interpolate(f, [0, 15], [0, 1], {
          extrapolateRight: "clamp",
        });
        const y = interpolate(f, [0, 15], [20, 0], {
          extrapolateRight: "clamp",
        });
        return (
          <span key={i} style={{ opacity, transform: `translateY(${y}px)` }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

const ScaleIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const scale = spring({
    frame: f,
    fps,
    from: 0,
    to: 1,
    config: { damping: 15 },
  });
  const opacity = interpolate(f, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ transform: `scale(${scale})`, opacity }}>{children}</div>
  );
};

const GradientMeshBackground: React.FC<{
  primary: string;
  secondary: string;
}> = ({ primary, secondary }) => {
  const frame = useCurrentFrame();
  const offset = (frame * 0.5) % 100;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 80% 80% at ${20 + offset * 0.3}% ${30}%, ${primary}40 0%, transparent 50%),
          radial-gradient(ellipse 60% 60% at ${80 - offset * 0.2}% ${70}%, ${secondary}40 0%, transparent 45%),
          linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)
        `,
      }}
    />
  );
};

const GlassCard: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const scale = spring({
    frame: f,
    fps,
    from: 0.9,
    to: 1,
    config: { damping: 15, stiffness: 100 },
  });
  const opacity = interpolate(f, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRadius: 24,
        border: "1px solid rgba(255, 255, 255, 0.15)",
        padding: 40,
        opacity,
        transform: `scale(${scale})`,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
      }}
    >
      {children}
    </div>
  );
};

// ============================================================================
// PREMIUM SCENE RENDERERS
// ============================================================================

const extractGradientColors = (
  background: string,
): { primary: string; secondary: string } => {
  const hexMatches = background.match(/#[0-9A-Fa-f]{6}/g);
  if (hexMatches && hexMatches.length >= 2) {
    return { primary: hexMatches[0], secondary: hexMatches[1] };
  }
  if (hexMatches && hexMatches.length === 1) {
    return { primary: hexMatches[0], secondary: hexMatches[0] };
  }
  return { primary: "#1E40AF", secondary: "#3B82F6" };
};

const PremiumSceneRenderer: React.FC<{ scene: VideoScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = extractGradientColors(scene.style?.background || "");

  const headline = scene.content.headline || "";
  const subtext = scene.content.subtext || "";
  const icon = scene.content.icon || "";
  const features = scene.content.features || [];

  // Calculate exit animation
  const duration = scene.endFrame - scene.startFrame;
  const exitStart = duration - 20;
  const exitOpacity =
    frame > exitStart
      ? interpolate(frame, [exitStart, duration], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  const sceneType = scene.type;

  // Intro Scene with premium animations
  if (sceneType === "intro") {
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
          opacity: exitOpacity,
        }}
      >
        <GradientMeshBackground
          primary={colors.primary}
          secondary={colors.secondary}
        />
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 80,
            zIndex: 1,
          }}
        >
          {icon && (
            <ScaleIn delay={0}>
              <div style={{ fontSize: 80, marginBottom: 20 }}>{icon}</div>
            </ScaleIn>
          )}
          <BlurInText
            text={headline}
            fontSize={84}
            delay={5}
            color={scene.style.textColor}
          />
          <div style={{ marginTop: 30 }}>
            <StaggerWords
              text={subtext}
              fontSize={32}
              delay={20}
              color={scene.style.textColor}
            />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // CTA Scene with pulsing animation
  if (sceneType === "cta") {
    const pulse = 1 + Math.sin(frame / 15) * 0.05;

    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
          opacity: exitOpacity,
        }}
      >
        <GradientMeshBackground
          primary={colors.secondary}
          secondary={colors.primary}
        />
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 80,
            zIndex: 1,
          }}
        >
          {icon && (
            <ScaleIn delay={0}>
              <div
                style={{
                  fontSize: 100,
                  marginBottom: 30,
                  transform: `scale(${pulse})`,
                }}
              >
                {icon}
              </div>
            </ScaleIn>
          )}
          <BlurInText
            text={headline}
            fontSize={78}
            delay={10}
            color={scene.style.textColor}
          />
          <div style={{ marginTop: 30 }}>
            <StaggerWords
              text={subtext}
              fontSize={36}
              delay={30}
              staggerDelay={6}
              color={scene.style.accentColor || scene.style.textColor}
            />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  // Feature Scene with glass cards
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
        opacity: exitOpacity,
      }}
    >
      <GradientMeshBackground
        primary={colors.primary}
        secondary={colors.secondary}
      />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
          zIndex: 1,
        }}
      >
        {icon && (
          <ScaleIn delay={0}>
            <div style={{ fontSize: 70, marginBottom: 20 }}>{icon}</div>
          </ScaleIn>
        )}
        <BlurInText
          text={headline}
          fontSize={72}
          delay={5}
          color={scene.style.textColor}
        />
        <div style={{ marginTop: 20, marginBottom: 40 }}>
          <StaggerWords
            text={subtext}
            fontSize={28}
            delay={20}
            color={scene.style.textColor}
          />
        </div>

        {/* Feature Cards */}
        {features.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 30,
              flexWrap: "wrap",
              justifyContent: "center",
              maxWidth: 1000,
            }}
          >
            {features.map((feature, i) => (
              <GlassCard key={i} delay={40 + i * 15}>
                <div
                  style={{
                    textAlign: "center",
                    color: scene.style.textColor,
                    fontFamily: "system-ui",
                  }}
                >
                  <div style={{ fontSize: 48, marginBottom: 10 }}>
                    {feature.icon || "✨"}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: "bold" }}>
                    {feature.title}
                  </div>
                  <div style={{ fontSize: 16, opacity: 0.8, marginTop: 8 }}>
                    {feature.description}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// DYNAMIC COMPOSITION - Uses Premium Animations
// ============================================================================

const DynamicComposition: React.FC<{ script: VideoScript }> = ({ script }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0f0f1a" }}>
      {script.scenes.map((scene) => (
        <Sequence
          key={scene.id}
          from={scene.startFrame}
          durationInFrames={scene.endFrame - scene.startFrame}
        >
          <PremiumSceneRenderer scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// Fallback composition when no script is provided
const PlaceholderComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
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
      <GradientMeshBackground primary="#667eea" secondary="#764ba2" />
      <div
        style={{
          textAlign: "center",
          opacity,
          transform: `scale(${scale})`,
          zIndex: 1,
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

// ============================================================================
// VIDEO PLAYER COMPONENT
// ============================================================================

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
              <svg
                className="w-5 h-5 ml-0.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
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
