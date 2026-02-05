/**
 * DYNAMIC CREATIVE RENDERER
 *
 * Renders the output from CreativeAgent with all the crazy animation effects.
 * This component interprets the agent's output and creates actual Remotion animations.
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type {
  CreativeScene,
  CreativeTextBlock,
  AnimationEffect,
  CreativeVideoScript,
} from "../../lib/agents/creativeAgent";

// ============================================================================
// ANIMATION IMPLEMENTATIONS
// ============================================================================

const BlurInAnimation: React.FC<{
  children: React.ReactNode;
  params: Record<string, any>;
  duration: number;
  delay: number;
}> = ({ children, params, duration, delay }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);

  const blurAmount = params.blurAmount || 15;
  const direction = params.direction || "up";

  const blur = interpolate(f, [0, duration], [blurAmount, 0], {
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(f, [0, duration], [0, 1], {
    extrapolateRight: "clamp",
  });

  let yOffset = 0;
  if (direction === "up")
    yOffset = interpolate(f, [0, duration], [50, 0], {
      extrapolateRight: "clamp",
    });
  if (direction === "down")
    yOffset = interpolate(f, [0, duration], [-50, 0], {
      extrapolateRight: "clamp",
    });

  return (
    <div
      style={{
        filter: `blur(${blur}px)`,
        opacity,
        transform: `translateY(${yOffset}px)`,
      }}
    >
      {children}
    </div>
  );
};

const ScaleBounceAnimation: React.FC<{
  children: React.ReactNode;
  params: Record<string, any>;
  duration: number;
  delay: number;
}> = ({ children, params, duration, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);

  const initialScale = params.initialScale || 0.3;
  const bounceIntensity = params.bounceIntensity || 2;

  const scale = spring({
    frame: f,
    fps,
    from: initialScale,
    to: 1,
    config: { damping: 8 / bounceIntensity, stiffness: 100 },
  });

  const opacity = interpolate(f, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ transform: `scale(${scale})`, opacity }}>{children}</div>
  );
};

const TypewriterAnimation: React.FC<{
  text: string;
  params: Record<string, any>;
  duration: number;
  delay: number;
  style: React.CSSProperties;
}> = ({ text, params, duration, delay, style }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);

  const speed =
    params.speed === "fast" ? 1.5 : params.speed === "slow" ? 0.5 : 1;
  const showCursor = params.cursor !== false;

  const charsToShow = Math.floor(f * speed);
  const displayText = text.slice(0, charsToShow);
  const cursorVisible = showCursor && Math.floor(f / 15) % 2 === 0;

  return (
    <span style={style}>
      {displayText}
      {cursorVisible && charsToShow < text.length && (
        <span style={{ opacity: 0.8 }}>|</span>
      )}
    </span>
  );
};

const GlitchAnimation: React.FC<{
  children: React.ReactNode;
  params: Record<string, any>;
  duration: number;
  delay: number;
}> = ({ children, params, duration, delay }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);

  const intensity = params.intensity || 3;
  const colorShift = params.colorShift !== false;

  // Glitch effect - random offsets
  const glitchActive =
    f < duration * 0.7 && Math.random() < (0.3 * intensity) / 5;
  const xOffset = glitchActive ? (Math.random() - 0.5) * intensity * 10 : 0;
  const yOffset = glitchActive ? (Math.random() - 0.5) * intensity * 5 : 0;

  const opacity = interpolate(f, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "relative", opacity }}>
      {colorShift && f < duration * 0.7 && (
        <>
          <div
            style={{
              position: "absolute",
              left: -2 * intensity,
              color: "#ff0000",
              opacity: glitchActive ? 0.7 : 0,
              mixBlendMode: "screen",
            }}
          >
            {children}
          </div>
          <div
            style={{
              position: "absolute",
              left: 2 * intensity,
              color: "#00ffff",
              opacity: glitchActive ? 0.7 : 0,
              mixBlendMode: "screen",
            }}
          >
            {children}
          </div>
        </>
      )}
      <div style={{ transform: `translate(${xOffset}px, ${yOffset}px)` }}>
        {children}
      </div>
    </div>
  );
};

const WaveAnimation: React.FC<{
  text: string;
  params: Record<string, any>;
  duration: number;
  delay: number;
  style: React.CSSProperties;
}> = ({ text, params, duration, delay, style }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);

  const amplitude = params.amplitude || 20;
  const frequency = params.frequency || 3;

  const opacity = interpolate(f, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <span style={{ ...style, display: "inline-flex", opacity }}>
      {text.split("").map((char, i) => {
        const wave = Math.sin((f / 10 + i / frequency) * Math.PI) * amplitude;
        const charOpacity = interpolate(f - i * 2, [0, 15], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <span
            key={i}
            style={{
              transform: `translateY(${wave}px)`,
              opacity: charOpacity,
              display: "inline-block",
            }}
          >
            {char === " " ? "\u00A0" : char}
          </span>
        );
      })}
    </span>
  );
};

const SplitRevealAnimation: React.FC<{
  children: React.ReactNode;
  params: Record<string, any>;
  duration: number;
  delay: number;
}> = ({ children, params, duration, delay }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);

  const direction = params.direction || "horizontal";

  const reveal = interpolate(f, [0, duration], [0, 100], {
    extrapolateRight: "clamp",
  });

  let clipPath = "";
  if (direction === "horizontal") {
    clipPath = `inset(0 ${100 - reveal}% 0 0)`;
  } else if (direction === "vertical") {
    clipPath = `inset(0 0 ${100 - reveal}% 0)`;
  } else {
    clipPath = `polygon(0 0, ${reveal}% 0, ${reveal}% 100%, 0 100%)`;
  }

  return <div style={{ clipPath }}>{children}</div>;
};

const ParticleFormAnimation: React.FC<{
  text: string;
  params: Record<string, any>;
  duration: number;
  delay: number;
  style: React.CSSProperties;
}> = ({ text, params, duration, delay, style }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);

  const particleCount = params.particleCount || 100;
  const disperseFirst = params.disperseFirst !== false;

  // Generate stable random positions
  const particles = React.useMemo(
    () =>
      Array.from({ length: particleCount }, (_, i) => ({
        x: (Math.sin(i * 7.3) + 1) * 50,
        y: (Math.cos(i * 11.7) + 1) * 50,
        size: 2 + (i % 5),
      })),
    [particleCount],
  );

  const formProgress = interpolate(f, [0, duration], [0, 1], {
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(f, [duration * 0.7, duration], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "relative" }}>
      {/* Particles */}
      {formProgress < 1 &&
        particles.map((p, i) => {
          const particleOpacity = interpolate(formProgress, [0.5, 1], [1, 0], {
            extrapolateRight: "clamp",
          });
          const moveToCenter = interpolate(formProgress, [0, 0.8], [0, 1], {
            extrapolateRight: "clamp",
          });
          const x = interpolate(moveToCenter, [0, 1], [p.x - 50, 0]);
          const y = interpolate(moveToCenter, [0, 1], [p.y - 50, 0]);

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: p.size,
                height: p.size,
                borderRadius: "50%",
                backgroundColor: "#ffffff",
                transform: `translate(${x}vw, ${y}vh)`,
                opacity: particleOpacity * 0.5,
              }}
            />
          );
        })}

      {/* Text appears as particles converge */}
      <span style={{ ...style, opacity }}>{text}</span>
    </div>
  );
};

const LiquidMorphAnimation: React.FC<{
  children: React.ReactNode;
  params: Record<string, any>;
  duration: number;
  delay: number;
}> = ({ children, params, duration, delay }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);

  const viscosity = params.viscosity || 5;

  const morphProgress = interpolate(f, [0, duration], [0, 1], {
    extrapolateRight: "clamp",
  });
  const scaleX = interpolate(
    morphProgress,
    [0, 0.3, 0.6, 1],
    [0.1, 1.2, 0.95, 1],
  );
  const scaleY = interpolate(
    morphProgress,
    [0, 0.3, 0.6, 1],
    [0.1, 0.8, 1.1, 1],
  );
  const opacity = interpolate(f, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Wobble effect
  const wobble = Math.sin(f / viscosity) * (1 - morphProgress) * 0.1;

  return (
    <div
      style={{
        transform: `scale(${scaleX + wobble}, ${scaleY - wobble})`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};

// ============================================================================
// ANIMATED TEXT RENDERER
// ============================================================================

const AnimatedText: React.FC<{
  block: CreativeTextBlock;
}> = ({ block }) => {
  const baseStyle: React.CSSProperties = {
    fontFamily: "system-ui, sans-serif",
    fontSize: block.fontSize,
    fontWeight:
      block.style === "hero" || block.style === "shout"
        ? 900
        : block.style === "whisper"
          ? 300
          : 700,
    color: block.color,
    textAlign: "center",
    letterSpacing: block.style === "tech" ? "5px" : "-2px",
    fontStyle: block.style === "poetic" ? "italic" : "normal",
    textTransform: block.style === "shout" ? "uppercase" : "none",
  };

  const animation = block.animation;

  switch (animation.type) {
    case "blur-in":
      return (
        <BlurInAnimation
          params={animation.params}
          duration={animation.duration}
          delay={animation.delay}
        >
          <span style={baseStyle}>{block.content}</span>
        </BlurInAnimation>
      );

    case "scale-bounce":
      return (
        <ScaleBounceAnimation
          params={animation.params}
          duration={animation.duration}
          delay={animation.delay}
        >
          <span style={baseStyle}>{block.content}</span>
        </ScaleBounceAnimation>
      );

    case "typewriter":
      return (
        <TypewriterAnimation
          text={block.content}
          params={animation.params}
          duration={animation.duration}
          delay={animation.delay}
          style={baseStyle}
        />
      );

    case "glitch":
      return (
        <GlitchAnimation
          params={animation.params}
          duration={animation.duration}
          delay={animation.delay}
        >
          <span style={baseStyle}>{block.content}</span>
        </GlitchAnimation>
      );

    case "wave":
      return (
        <WaveAnimation
          text={block.content}
          params={animation.params}
          duration={animation.duration}
          delay={animation.delay}
          style={baseStyle}
        />
      );

    case "split-reveal":
      return (
        <SplitRevealAnimation
          params={animation.params}
          duration={animation.duration}
          delay={animation.delay}
        >
          <span style={baseStyle}>{block.content}</span>
        </SplitRevealAnimation>
      );

    case "particle-form":
      return (
        <ParticleFormAnimation
          text={block.content}
          params={animation.params}
          duration={animation.duration}
          delay={animation.delay}
          style={baseStyle}
        />
      );

    case "liquid-morph":
      return (
        <LiquidMorphAnimation
          params={animation.params}
          duration={animation.duration}
          delay={animation.delay}
        >
          <span style={baseStyle}>{block.content}</span>
        </LiquidMorphAnimation>
      );

    default:
      return <span style={baseStyle}>{block.content}</span>;
  }
};

// ============================================================================
// BACKGROUND RENDERERS
// ============================================================================

const GradientBackground: React.FC<{ colors: string[] }> = ({ colors }) => {
  const frame = useCurrentFrame();
  const angle = 135 + frame * 0.3;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${angle}deg, ${colors.join(", ")})`,
      }}
    />
  );
};

const ParticlesBackground: React.FC<{ colors: string[] }> = ({ colors }) => {
  const frame = useCurrentFrame();

  const particles = React.useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 6,
        speed: 0.2 + Math.random() * 0.5,
      })),
    [],
  );

  return (
    <AbsoluteFill style={{ background: colors[0] || "#0a0a0a" }}>
      {particles.map((p, i) => {
        const y = (p.y + frame * p.speed * 0.1) % 100;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${y}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              backgroundColor: colors[1] || "#ffffff",
              opacity: 0.3,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const AuroraBackground: React.FC<{ colors: string[] }> = ({ colors }) => {
  const frame = useCurrentFrame();
  const time = frame / 60;

  return (
    <AbsoluteFill
      style={{ background: colors[0] || "#0a0a0a", overflow: "hidden" }}
    >
      {colors.slice(1).map((color, i) => {
        const x = 30 + Math.sin(time * 0.5 + i) * 30;
        const y = 30 + Math.cos(time * 0.3 + i * 2) * 30;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: 800,
              height: 800,
              background: `radial-gradient(ellipse at center, ${color}50 0%, transparent 70%)`,
              transform: "translate(-50%, -50%)",
              filter: "blur(60px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const MeshBackground: React.FC<{ colors: string[] }> = ({ colors }) => {
  const frame = useCurrentFrame();
  const offset = (frame * 0.5) % 100;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 80% 80% at ${20 + offset * 0.3}% 30%, ${colors[1] || "#3b82f6"}40 0%, transparent 50%),
          radial-gradient(ellipse 60% 60% at ${80 - offset * 0.2}% 70%, ${colors[2] || "#8b5cf6"}40 0%, transparent 45%),
          linear-gradient(135deg, ${colors[0] || "#0f0f1a"} 0%, #1a1a2e 100%)
        `,
      }}
    />
  );
};

const SceneBackground: React.FC<{ scene: CreativeScene }> = ({ scene }) => {
  switch (scene.background.type) {
    case "particles":
      return <ParticlesBackground colors={scene.background.colors} />;
    case "aurora":
      return <AuroraBackground colors={scene.background.colors} />;
    case "mesh":
      return <MeshBackground colors={scene.background.colors} />;
    default:
      return <GradientBackground colors={scene.background.colors} />;
  }
};

// ============================================================================
// SCENE RENDERER
// ============================================================================

const SceneRenderer: React.FC<{ scene: CreativeScene }> = ({ scene }) => {
  const frame = useCurrentFrame();

  // Scene transition opacity
  const enterDuration = 20;
  const exitStart = scene.duration - 20;

  const enterOpacity = interpolate(frame, [0, enterDuration], [0, 1], {
    extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [exitStart, scene.duration], [1, 0], {
    extrapolateLeft: "clamp",
  });
  const opacity = Math.min(enterOpacity, exitOpacity);

  return (
    <AbsoluteFill style={{ opacity }}>
      <SceneBackground scene={scene} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 40,
          padding: 80,
        }}
      >
        {scene.textBlocks.map((block) => (
          <AnimatedText key={block.id} block={block} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ============================================================================
// MAIN COMPOSITION
// ============================================================================

export const DynamicCreativeVideo: React.FC<{
  script: CreativeVideoScript;
}> = ({ script }) => {
  let cumulativeFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {script.scenes.map((scene, index) => {
        const from = cumulativeFrame;
        cumulativeFrame += scene.duration;

        return (
          <Sequence
            key={scene.id}
            from={from}
            durationInFrames={scene.duration}
          >
            <SceneRenderer scene={scene} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export default DynamicCreativeVideo;
