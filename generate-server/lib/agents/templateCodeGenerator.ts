/**
 * Template-based Video Code Generator
 * Generates Remotion code deterministically from video scripts using pre-built templates.
 * This approach eliminates LLM hallucination and ensures consistent premium animations.
 *
 * Style: "remotion demo" — aurora gradient backgrounds, white glass morphism cards,
 * word-by-word blur text reveals, gradient accent text, 3D perspective card entries,
 * Montserrat font, scene progress dots.
 */

import type { VideoScript, VideoScene } from "../types";
import type { VideoGenerationStateType } from "./state";
import { savePromptLog } from "./skills";

function getSceneType(
  scene: VideoScene,
): "intro" | "feature" | "cta" | "testimonial" | "screenshot" {
  const type = scene.type;
  if (type === "intro") return "intro";
  if (type === "cta") return "cta";
  if (type === "testimonial") return "testimonial";
  if (type === "screenshot" || scene.content.image) return "screenshot";
  return "feature";
}

function generateSceneComponent(scene: VideoScene, index: number, totalScenes: number): string {
  const sceneType = getSceneType(scene);
  const headline = scene.content.headline || "";
  const subtext = scene.content.subtext || "";
  const icon = scene.content.icon || "";
  const features = scene.content.features || [];

  const componentName = `Scene${index + 1}`;
  // Alternate aurora background: even = dark, odd = light
  const auroraVariant = index % 2 === 0 ? "dark" : "light";
  // Text color depends on variant
  const headlineColor = auroraVariant === "dark" ? "#ffffff" : "#111827";
  const subtextColor = auroraVariant === "dark" ? "rgba(255,255,255,0.8)" : "#4b5563";
  const cardTextColor = "#111827";
  const cardSubtextColor = "#4b5563";

  // Split headline into words for blur reveal
  const headlineWords = headline.split(" ").filter(Boolean);
  const subtextWords = subtext.split(" ").filter(Boolean);

  if (sceneType === "intro") {
    return `
const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <AuroraBackground variant="dark" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <LogoWithGlow brandName="${headline}" fontSize={72} delay={0} />
        ${subtextWords.length > 0 ? `<div style={{ marginTop: 20 }}>
          <WordByWordBlur
            words={${JSON.stringify(subtextWords)}}
            fontSize={32}
            fontFamily={montserrat}
            fontWeight={500}
            color="rgba(255,255,255,0.8)"
            delay={20}
            staggerFrames={5}
          />
        </div>` : ""}
      </div>
    </AbsoluteFill>
  );
};`;
  }

  if (sceneType === "cta") {
    return `
const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <AuroraBackground variant="dark" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <WordByWordBlur
          words={${JSON.stringify(headlineWords)}}
          fontSize={56}
          fontFamily={montserrat}
          fontWeight={700}
          color="#ffffff"
          delay={5}
          staggerFrames={5}
          gradientWordIndices={[${headlineWords.length > 2 ? headlineWords.length - 1 : 0}]}
        />
        ${subtextWords.length > 0 ? `<div style={{ marginTop: 16 }}>
          <GradientAccentText
            text="${subtext}"
            fontSize={36}
            fontFamily={montserrat}
            delay={${10 + headlineWords.length * 5}}
          />
        </div>` : ""}
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Screenshot scene - show product UI in a glass card
  if (sceneType === "screenshot" && scene.content.image) {
    const imgUrl = scene.content.image;
    const isR2 = imgUrl.startsWith("http");
    const imgSrc = isR2 ? `"${imgUrl}"` : `staticFile("${imgUrl.replace(/^\//, "")}")`;
    return `
const ${componentName}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 60,
    }}>
      <AuroraBackground variant="${auroraVariant}" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        ${headlineWords.length > 0 ? `<WordByWordBlur
          words={${JSON.stringify(headlineWords)}}
          fontSize={36}
          fontFamily={montserrat}
          fontWeight={600}
          color="${headlineColor}"
          delay={0}
          staggerFrames={4}
        />` : ""}
        <WhiteGlassCard delay={${headlineWords.length > 0 ? 10 : 0}} maxWidth={900} entryAnimation="perspective" padding={16}>
          <Img src={${imgSrc}} style={{
            width: '100%',
            height: 'auto',
            maxHeight: 500,
            objectFit: 'cover',
            borderRadius: 12,
          }} />
        </WhiteGlassCard>
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Feature / testimonial scene
  if (features.length > 0) {
    // Card-based feature layout
    return `
const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 60,
    }}>
      <AuroraBackground variant="${auroraVariant}" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
        <WordByWordBlur
          words={${JSON.stringify(headlineWords)}}
          fontSize={48}
          fontFamily={montserrat}
          fontWeight={700}
          color="${headlineColor}"
          delay={5}
          staggerFrames={5}
        />
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1000 }}>
          ${features
            .map(
              (f, i) => `<WhiteGlassCard delay={${20 + i * 12}} maxWidth={280} entryAnimation="${i % 2 === 0 ? 'perspective' : 'slide-up'}" padding={32}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>${f.icon || "✨"}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '${cardTextColor}', fontFamily: montserrat }}>${f.title}</div>
              <div style={{ fontSize: 16, color: '${cardSubtextColor}', marginTop: 8, fontFamily: montserrat, fontWeight: 400 }}>${f.description}</div>
            </div>
          </WhiteGlassCard>`,
            )
            .join("\n          ")}
        </div>
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Text-focused feature scene (no feature cards)
  return `
const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 80,
    }}>
      <AuroraBackground variant="${auroraVariant}" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        ${icon ? `<ScaleIn delay={0}><div style={{ fontSize: 72, marginBottom: 8 }}>${icon}</div></ScaleIn>` : ""}
        <WordByWordBlur
          words={${JSON.stringify(headlineWords)}}
          fontSize={56}
          fontFamily={montserrat}
          fontWeight={700}
          color="${headlineColor}"
          delay={5}
          staggerFrames={5}
        />
        ${subtextWords.length > 0 ? `<div style={{ marginTop: 16 }}>
          <WordByWordBlur
            words={${JSON.stringify(subtextWords)}}
            fontSize={28}
            fontFamily={montserrat}
            fontWeight={400}
            color="${subtextColor}"
            delay={${10 + headlineWords.length * 5}}
            staggerFrames={4}
          />
        </div>` : ""}
      </div>
    </AbsoluteFill>
  );
};`;
}

/** Snap a target frame count to the nearest beat boundary */
function snapToBeats(targetFrames: number, framesPerBeat: number): number {
  const beats = Math.max(1, Math.round(targetFrames / framesPerBeat));
  return Math.round(beats * framesPerBeat);
}

interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

function generateFullCode(videoScript: VideoScript, screenshots?: any[], audioUrl?: string, bpm?: number, targetDurationSeconds?: number, brandColors?: BrandColors): string {
  const scenes = videoScript.scenes;
  const effectiveBpm = bpm || 120;
  const framesPerBeat = (60 / effectiveBpm) * 30; // at 30fps

  // Brand color theming — fall back to default purple/pink
  const primary = brandColors?.primary || '#a855f7';
  const secondary = brandColors?.secondary || '#ec4899';
  const accent = brandColors?.accent || '#8b5cf6';

  // Check if any scene uses screenshots/images
  const hasImages = scenes.some(s => s.content.image) || (screenshots && screenshots.length > 0);

  // Snap scene durations to beat boundaries
  let currentFrame = 0;
  for (const scene of scenes) {
    const originalDuration = scene.endFrame - scene.startFrame;
    const snappedDuration = snapToBeats(originalDuration, framesPerBeat);
    scene.startFrame = currentFrame;
    scene.endFrame = currentFrame + snappedDuration;
    currentFrame += snappedDuration;
  }
  videoScript.totalDuration = currentFrame;

  // =========================================================================
  // DURATION ENFORCEMENT (post beat-snap)
  // =========================================================================
  if (targetDurationSeconds && targetDurationSeconds >= 10) {
    const targetFrames = targetDurationSeconds * 30;
    if (videoScript.totalDuration < targetFrames * 0.8) {
      console.log(
        `[TemplateCodeGenerator] Duration too short after beat-snap: ${videoScript.totalDuration} frames vs target ${targetFrames}. Scaling...`,
      );

      // Scale scene durations proportionally
      const scaleFactor = targetFrames / videoScript.totalDuration;
      for (const scene of scenes) {
        const duration = scene.endFrame - scene.startFrame;
        const scaled = Math.round(duration * scaleFactor);
        // Clamp between 1 beat and 10 seconds, then re-snap to beats
        const clamped = Math.max(framesPerBeat, Math.min(300, scaled));
        scene.endFrame = scene.startFrame + snapToBeats(clamped, framesPerBeat);
      }

      // Recalculate sequential positions
      let frame = 0;
      for (const scene of scenes) {
        const duration = scene.endFrame - scene.startFrame;
        scene.startFrame = frame;
        scene.endFrame = frame + duration;
        frame += duration;
      }
      videoScript.totalDuration = frame;
      console.log(
        `[TemplateCodeGenerator] Adjusted duration: ${videoScript.totalDuration} frames (${(videoScript.totalDuration / 30).toFixed(1)}s)`,
      );
    }
  }

  // Generate scene components
  const sceneComponents = scenes
    .map((scene, i) => generateSceneComponent(scene, i, scenes.length))
    .join("\n");

  // Generate sequence renders
  const sequenceRenders = scenes
    .map((scene, i) => {
      const componentName = `Scene${i + 1}`;
      const duration = scene.endFrame - scene.startFrame;
      return `      <Sequence from={${scene.startFrame}} durationInFrames={${duration}}>
        <${componentName} />
      </Sequence>`;
    })
    .join("\n");

  // Scene boundaries for progress dots
  const sceneBoundaries = scenes.map((s) => s.startFrame);

  // Audio element — use URL directly for R2, staticFile for local
  const isR2Audio = audioUrl && audioUrl.startsWith("http");
  const audioSrc = audioUrl
    ? (isR2Audio ? `"${audioUrl}"` : `staticFile("${audioUrl.replace(/^\//, "")}")`)
    : `staticFile("audio/audio1.mp3")`;

  // Helper: convert hex to r,g,b for rgba usage in template
  const hexToRgb = (hex: string) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) || 168;
    const g = parseInt(h.substring(2, 4), 16) || 85;
    const b = parseInt(h.substring(4, 6), 16) || 247;
    return `${r}, ${g}, ${b}`;
  };
  const pRgb = hexToRgb(primary);
  const sRgb = hexToRgb(secondary);
  const aRgb = hexToRgb(accent);

  return `// Auto-generated Premium Remotion Video (Demo Style)
// Generated at: ${new Date().toISOString()}
import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  Audio,
  interpolate,
  spring,${hasImages ? `\n  Img,` : ""}
  staticFile,
} from 'remotion';
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const { fontFamily: montserrat } = loadMontserrat("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });

// ============================================================================
// AURORA BACKGROUND
// ============================================================================

const AuroraBackground: React.FC<{
  variant?: 'dark' | 'light';
  fadeIn?: boolean;
}> = ({ variant = 'dark', fadeIn = false }) => {
  const frame = useCurrentFrame();
  const opacity = fadeIn ? interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }) : 1;

  if (variant === 'light') {
    return (
      <AbsoluteFill style={{
        opacity,
        background: \`
          radial-gradient(ellipse at 30% 30%, rgba(${pRgb}, 0.2) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 70%, rgba(${sRgb}, 0.2) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(${aRgb}, 0.15) 0%, transparent 60%),
          linear-gradient(135deg, #faf5ff 0%, #fff5f8 50%, #f5f0ff 100%)
        \`,
      }} />
    );
  }

  return (
    <AbsoluteFill style={{
      opacity,
      background: \`
        radial-gradient(ellipse at 20% 20%, rgba(${pRgb}, 0.3) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(${sRgb}, 0.3) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(${aRgb}, 0.2) 0%, transparent 70%),
        #0a0a0f
      \`,
    }} />
  );
};

// ============================================================================
// WORD BY WORD BLUR REVEAL
// ============================================================================

const WordByWordBlur: React.FC<{
  words: string[];
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  color?: string;
  delay?: number;
  staggerFrames?: number;
  gradientWordIndices?: number[];
}> = ({ words, fontSize = 48, fontFamily = montserrat, fontWeight = 600, color = '#ffffff', delay = 0, staggerFrames = 5, gradientWordIndices = [] }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
      {words.map((word, i) => {
        const wordStart = delay + i * staggerFrames;
        const f = Math.max(0, frame - wordStart);
        const op = interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
        const blur = interpolate(f, [0, 15], [10, 0], { extrapolateRight: 'clamp' });
        const ty = interpolate(f, [0, 15], [30, 0], { extrapolateRight: 'clamp' });
        const isGradient = gradientWordIndices.includes(i);

        return (
          <span key={i} style={{
            fontSize,
            fontFamily,
            fontWeight,
            opacity: op,
            filter: \`blur(\${blur}px)\`,
            transform: \`translateY(\${ty}px)\`,
            display: 'inline-block',
            marginRight: i < words.length - 1 ? '0.3em' : 0,
            ...(isGradient ? {
              background: 'linear-gradient(135deg, ${primary}, ${secondary})',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            } : { color }),
          }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ============================================================================
// WHITE GLASS CARD
// ============================================================================

const WhiteGlassCard: React.FC<{
  children: React.ReactNode;
  maxWidth?: number;
  delay?: number;
  entryAnimation?: 'slide-up' | 'perspective' | 'scale';
  padding?: number;
}> = ({ children, maxWidth = 800, delay = 0, entryAnimation = 'slide-up', padding = 48 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  let transform = '';
  if (entryAnimation === 'slide-up') {
    const ty = interpolate(f, [0, 25], [60, 0], { extrapolateRight: 'clamp' });
    const s = spring({ frame: f, fps, from: 0.95, to: 1, config: { damping: 15, stiffness: 100 } });
    transform = \`translateY(\${ty}px) scale(\${s})\`;
  } else if (entryAnimation === 'perspective') {
    const rx = interpolate(f, [0, 30], [-20, 0], { extrapolateRight: 'clamp' });
    const ty = interpolate(f, [0, 30], [100, 0], { extrapolateRight: 'clamp' });
    transform = \`perspective(1000px) rotateX(\${rx}deg) translateY(\${ty}px)\`;
  } else {
    const s = spring({ frame: f, fps, from: 0.8, to: 1, config: { damping: 12, stiffness: 100 } });
    transform = \`scale(\${s})\`;
  }

  return (
    <div style={{
      maxWidth,
      width: '100%',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRadius: 24,
      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
      padding,
      opacity,
      transform,
      transformOrigin: 'center bottom',
    }}>
      {children}
    </div>
  );
};

// ============================================================================
// GRADIENT ACCENT TEXT
// ============================================================================

const GradientAccentText: React.FC<{
  text: string;
  fontSize?: number;
  fontFamily?: string;
  delay?: number;
}> = ({ text, fontSize = 64, fontFamily = montserrat, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const scale = spring({ frame: f, fps, from: 0.8, to: 1, config: { damping: 15, stiffness: 100 } });
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <span style={{
      fontSize,
      fontFamily,
      fontWeight: 700,
      display: 'inline-block',
      background: 'linear-gradient(135deg, ${primary}, ${secondary})',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      opacity,
      transform: \`scale(\${scale})\`,
    }}>
      {text}
    </span>
  );
};

// ============================================================================
// LOGO WITH GLOW
// ============================================================================

const LogoWithGlow: React.FC<{
  brandName: string;
  accentSuffix?: string;
  fontSize?: number;
  delay?: number;
}> = ({ brandName, accentSuffix, fontSize = 96, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const textOpacity = interpolate(f, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const textScale = spring({ frame: f, fps, from: 0.8, to: 1, config: { damping: 15, stiffness: 100 } });
  const glowScale = interpolate(f, [0, 40], [0.5, 1.5], { extrapolateRight: 'clamp' });
  const glowOpacity = interpolate(f, [0, 20, 40], [0, 0.6, 0.4], { extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        position: 'absolute',
        width: '120%',
        height: '200%',
        background: 'linear-gradient(135deg, rgba(${pRgb}, 0.6), rgba(${sRgb}, 0.6))',
        filter: 'blur(40px)',
        borderRadius: '50%',
        opacity: glowOpacity,
        transform: \`scale(\${glowScale})\`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.15em',
        opacity: textOpacity,
        transform: \`scale(\${textScale})\`,
      }}>
        <span style={{ fontSize, fontFamily: montserrat, fontWeight: 700, color: '#ffffff' }}>
          {brandName}
        </span>
        {accentSuffix && (
          <span style={{
            fontSize,
            fontFamily: montserrat,
            fontWeight: 700,
            background: 'linear-gradient(135deg, ${primary}, ${secondary})',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {accentSuffix}
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SCALE IN HELPER
// ============================================================================

const ScaleIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const scale = spring({ frame: f, fps, from: 0, to: 1, config: { damping: 15 } });
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{ transform: \`scale(\${scale})\`, opacity }}>
      {children}
    </div>
  );
};

// ============================================================================
// SCENE PROGRESS DOTS
// ============================================================================

const SceneProgressDots: React.FC<{
  totalScenes: number;
  sceneBoundaries: number[];
  beatPulse?: number;
}> = ({ totalScenes, sceneBoundaries, beatPulse = 0 }) => {
  const frame = useCurrentFrame();
  let currentScene = 0;
  for (let i = sceneBoundaries.length - 1; i >= 0; i--) {
    if (frame >= sceneBoundaries[i]) {
      currentScene = i;
      break;
    }
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 40,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      zIndex: 100,
    }}>
      {Array.from({ length: totalScenes }, (_, i) => {
        const isActive = i === currentScene;
        const isPast = i < currentScene;
        const dotScale = isActive ? 1 + beatPulse * 0.15 : 1;
        return (
          <div key={i} style={{
            width: isActive ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: isActive ? '${primary}' : isPast ? 'rgba(${pRgb}, 0.5)' : 'rgba(255, 255, 255, 0.3)',
            transform: \`scale(\${dotScale})\`,
          }} />
        );
      })}
    </div>
  );
};

// ============================================================================
// BEAT SYNC HOOK
// ============================================================================

const useBeatSync = (bpm: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const framesPerBeat = (60 / bpm) * fps;
  const beatProgress = (frame % framesPerBeat) / framesPerBeat;
  const beatPulse = Math.exp(-beatProgress * 4);
  return { beatProgress, beatPulse, framesPerBeat };
};

// ============================================================================
// SCENE COMPONENTS
// ============================================================================
${sceneComponents}

// ============================================================================
// MAIN COMPOSITION
// ============================================================================

const ProductVideo: React.FC = () => {
  const { beatPulse } = useBeatSync(${effectiveBpm});
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }}>
      <Audio src={${audioSrc}} volume={1} />
${sequenceRenders}
      <SceneProgressDots
        totalScenes={${scenes.length}}
        sceneBoundaries={${JSON.stringify(sceneBoundaries)}}
        beatPulse={beatPulse}
      />
    </AbsoluteFill>
  );
};

export default ProductVideo;
`;
}

export async function templateCodeGeneratorNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log(
    "[TemplateCodeGenerator] Starting template-based code generation...",
  );

  if (!state.videoScript) {
    return {
      errors: ["No video script available for code generation"],
      currentStep: "error",
    };
  }

  try {
    const videoScript = state.videoScript;
    const screenshots = (state.productData as any)?.screenshots || [];

    // Ensure the last scene is always a CTA
    const lastScene = videoScript.scenes[videoScript.scenes.length - 1];
    if (lastScene && lastScene.type !== "cta") {
      const ctaDuration = 90; // 3 seconds
      videoScript.scenes.push({
        id: `cta-${Date.now()}`,
        startFrame: lastScene.endFrame,
        endFrame: lastScene.endFrame + ctaDuration,
        type: "cta",
        content: {
          headline: state.productData?.tagline || "Get Started Today",
          subtext: state.productData?.name || "",
        },
        animation: { enter: "blur-reveal", staggerDelay: 5 },
        style: { auroraVariant: "dark", textColor: "#ffffff", fontSize: "large", layout: "centered", cardStyle: "none" },
      } as any);
      videoScript.totalDuration = lastScene.endFrame + ctaDuration;
    }

    // Inject screenshot URLs into scenes that reference images or add screenshot scenes
    if (screenshots.length > 0) {
      let screenshotInjected = 0;
      for (const scene of videoScript.scenes) {
        if ((scene.type as string) === "screenshot" && !scene.content.image && screenshotInjected < screenshots.length) {
          scene.content.image = screenshots[screenshotInjected].url;
          screenshotInjected++;
        }
      }
      // If no screenshot scenes exist, inject one before the CTA
      if (screenshotInjected === 0) {
        const heroShot = screenshots.find((s: any) => s.section === "hero") || screenshots[0];
        if (heroShot) {
          const ctaIndex = videoScript.scenes.findIndex(s => s.type === "cta");
          if (ctaIndex > 0) {
            const prevScene = videoScript.scenes[ctaIndex - 1];
            const shotDuration = 75; // 2.5 seconds
            const shotScene = {
              id: `screenshot-${Date.now()}`,
              startFrame: prevScene.endFrame,
              endFrame: prevScene.endFrame + shotDuration,
              type: "screenshot",
              content: { headline: "See it in action", image: heroShot.url },
              animation: { enter: "perspective-card", staggerDelay: 5 },
              style: { auroraVariant: "light", textColor: "#0a0a0f", fontSize: "medium", layout: "card", cardStyle: "white-glass" },
            } as any;
            // Shift CTA and update total duration
            const ctaScene = videoScript.scenes[ctaIndex];
            const ctaDuration = ctaScene.endFrame - ctaScene.startFrame;
            ctaScene.startFrame = shotScene.endFrame;
            ctaScene.endFrame = shotScene.endFrame + ctaDuration;
            videoScript.scenes.splice(ctaIndex, 0, shotScene);
            videoScript.totalDuration = ctaScene.endFrame;
          }
        }
      }
    }

    // Extract audio config from state
    const audioUrl = state.userPreferences?.audio?.url || undefined;
    const audioBpm = state.userPreferences?.audio?.bpm || videoScript.music?.tempo || 120;

    console.log(
      `[TemplateCodeGenerator] Processing ${videoScript.scenes.length} scenes (BPM: ${audioBpm}, audio: ${audioUrl || 'default'})...`,
    );

    const targetDurationSeconds = state.userPreferences?.duration || undefined;
    const colors = state.productData?.colors || undefined;
    const generatedCode = generateFullCode(videoScript, screenshots, audioUrl, audioBpm, targetDurationSeconds, colors);

    console.log(
      `[TemplateCodeGenerator] Generated ${generatedCode.length} chars of code`,
    );

    // Validate the generated code
    const hasRemotion = generatedCode.includes("remotion");
    const hasUseCurrentFrame = generatedCode.includes("useCurrentFrame");
    const hasInterpolate = generatedCode.includes("interpolate");
    const hasAurora = generatedCode.includes("AuroraBackground");
    const hasWordBlur = generatedCode.includes("WordByWordBlur");
    const hasMontserrat = generatedCode.includes("Montserrat");

    console.log("[TemplateCodeGenerator] Validation:");
    console.log("  - Has remotion import:", hasRemotion);
    console.log("  - Has useCurrentFrame:", hasUseCurrentFrame);
    console.log("  - Has interpolate:", hasInterpolate);
    console.log("  - Has aurora background:", hasAurora);
    console.log("  - Has word blur reveal:", hasWordBlur);
    console.log("  - Has Montserrat font:", hasMontserrat);

    // Save the generated code to logs
    savePromptLog(
      "templateCodeGenerator",
      "TEMPLATE-BASED (no LLM)",
      `Video Script: ${JSON.stringify(videoScript, null, 2)}`,
      generatedCode,
    );

    console.log(
      "[TemplateCodeGenerator] Successfully generated premium video code!",
    );

    return {
      remotionCode: generatedCode,
      currentStep: "complete",
    };
  } catch (error) {
    console.error("[TemplateCodeGenerator] Error:", error);
    return {
      errors: [
        `Template code generator error: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      currentStep: "error",
    };
  }
}

// Export both generators for flexibility
export { templateCodeGeneratorNode as codeGeneratorNodeV2 };
