/**
 * REMOTION TRANSLATOR AGENT
 *
 * Takes a React page component and translates it into Remotion code.
 * This is step 2 of the two-step code generation process.
 *
 * Enhanced with Remotion Best Practices from .agent/skills/remotion/
 */

import { chatWithGeminiPro, chatWithFastModel } from "./model";
import type { VideoGenerationStateType } from "./state";

// ============================================================================
// REMOTION SKILLS - Best practices embedded in prompt
// ============================================================================

const REMOTION_SKILLS = `
## REMOTION BEST PRACTICES - FOLLOW THESE EXACTLY

### CRITICAL: FAST-PACED VIDEO REQUIREMENTS
- Each text element: MAX 2 seconds (60 frames at 30fps)
- Rapid sequences - text appears and disappears quickly
- Multiple text elements on screen simultaneously
- NO long static displays - everything moves constantly

### 1. ANIMATIONS (CRITICAL)
All animations MUST be driven by \`useCurrentFrame()\` hook.
Write animations in seconds and multiply by \`fps\` from \`useVideoConfig()\`.

\`\`\`tsx
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export const FadeIn = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame, [0, 2 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  return <div style={{ opacity }}>Hello World!</div>;
};
\`\`\`

⚠️ CSS transitions or animations are FORBIDDEN - they will not render correctly.
⚠️ Tailwind animation class names are FORBIDDEN - they will not render correctly.

### 2. INTERPOLATION & TIMING

Linear interpolation:
\`\`\`tsx
const opacity = interpolate(frame, [0, 100], [0, 1], {
  extrapolateRight: "clamp",
  extrapolateLeft: "clamp",
});
\`\`\`

Spring animations (natural motion):
\`\`\`tsx
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

const frame = useCurrentFrame();
const { fps } = useVideoConfig();

const scale = spring({ frame, fps });
\`\`\`

Spring configurations:
\`\`\`tsx
const smooth = { damping: 200 };                    // Smooth, no bounce (subtle reveals)
const snappy = { damping: 20, stiffness: 200 };    // Snappy, minimal bounce (UI elements)
const bouncy = { damping: 8 };                      // Bouncy entrance (playful animations)
const heavy = { damping: 15, stiffness: 80, mass: 2 }; // Heavy, slow, small bounce
\`\`\`

Easing options:
\`\`\`tsx
import { interpolate, Easing } from "remotion";

const value = interpolate(frame, [0, 100], [0, 1], {
  easing: Easing.inOut(Easing.quad),
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});
\`\`\`

### 3. SEQUENCING - FAST PACED

Use \`<Sequence>\` with SHORT durations (max 2 seconds):
\`\`\`tsx
import { Sequence } from "remotion";

const { fps } = useVideoConfig();

// Text appears for only 2 seconds max!
<Sequence from={0 * fps} durationInFrames={2 * fps} premountFor={0.5 * fps}>
  <Text1 />
</Sequence>
<Sequence from={1.5 * fps} durationInFrames={2 * fps} premountFor={0.5 * fps}>
  <Text2 />
</Sequence>
<Sequence from={3 * fps} durationInFrames={2 * fps} premountFor={0.5 * fps}>
  <Text3 />
</Sequence>
\`\`\`

⚠️ Always premount any \`<Sequence>\`!
⚠️ Overlap sequences for continuous motion!

Use \`<Series>\` when elements play one after another:
\`\`\`tsx
import { Series } from "remotion";

<Series>
  <Series.Sequence durationInFrames={45}>
    <Intro />
  </Series.Sequence>
  <Series.Sequence durationInFrames={60}>
    <MainContent />
  </Series.Sequence>
</Series>
\`\`\`

Inside a Sequence, \`useCurrentFrame()\` returns local frame (starting from 0).

### 4. TRANSITIONS

Use TransitionSeries for crossfades, slides, wipes:
\`\`\`tsx
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";

<TransitionSeries>
  <TransitionSeries.Sequence durationInFrames={60}>
    <SceneA />
  </TransitionSeries.Sequence>
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: 15 })}
  />
  <TransitionSeries.Sequence durationInFrames={60}>
    <SceneB />
  </TransitionSeries.Sequence>
</TransitionSeries>
\`\`\`

Available transitions: fade, slide, wipe, flip, clockWipe
Slide directions: "from-left", "from-right", "from-top", "from-bottom"

### 5. TEXT ANIMATIONS - DEMO STYLE

#### WORD-BY-WORD BLUR REVEAL (Primary text animation):
\`\`\`tsx
const WordByWordBlur: React.FC<{ words: string[]; fontSize?: number; color?: string; delay?: number; staggerFrames?: number; gradientWordIndices?: number[] }> = ({
  words, fontSize = 48, color = '#ffffff', delay = 0, staggerFrames = 5, gradientWordIndices = []
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3em', justifyContent: 'center' }}>
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * staggerFrames);
        const op = interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp" });
        const blur = interpolate(f, [0, 15], [10, 0], { extrapolateRight: "clamp" });
        const ty = interpolate(f, [0, 15], [30, 0], { extrapolateRight: "clamp" });
        const isGradient = gradientWordIndices.includes(i);
        return (
          <span key={i} style={{
            fontSize, fontFamily: montserrat, fontWeight: 600,
            opacity: op, filter: \`blur(\${blur}px)\`, transform: \`translateY(\${ty}px)\`,
            display: 'inline-block',
            ...(isGradient ? { background: 'linear-gradient(135deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color }),
          }}>{word}</span>
        );
      })}
    </div>
  );
};
\`\`\`

#### LOGO WITH GLOW:
\`\`\`tsx
const LogoWithGlow: React.FC<{ brandName: string; accentSuffix?: string; fontSize?: number; delay?: number }> = ({
  brandName, accentSuffix, fontSize = 80, delay = 0,
}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const glowScale = interpolate(f, [0, 30], [0.5, 1.5], { extrapolateRight: "clamp" });
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity }}>
      <div style={{
        position: 'absolute', width: '120%', height: '120%',
        background: 'linear-gradient(135deg, rgba(168,85,247,0.4), rgba(236,72,153,0.4))',
        filter: 'blur(40px)', borderRadius: '50%',
        transform: \`scale(\${glowScale})\`, opacity: 0.6,
      }} />
      <span style={{ fontFamily: montserrat, fontWeight: 700, fontSize, color: '#fff', position: 'relative', zIndex: 1 }}>{brandName}</span>
      {accentSuffix && (
        <span style={{ fontFamily: montserrat, fontWeight: 700, fontSize, position: 'relative', zIndex: 1, marginLeft: 12, background: 'linear-gradient(135deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{accentSuffix}</span>
      )}
    </div>
  );
};
\`\`\`

### 6. AURORA BACKGROUNDS

Dark aurora (for logo, CTA, and card scenes):
\`\`\`tsx
const AuroraBackground: React.FC<{ variant?: 'dark' | 'light' }> = ({ variant = 'dark' }) => {
  if (variant === 'light') {
    return (
      <AbsoluteFill style={{
        background: 'radial-gradient(ellipse at 30% 30%, rgba(168, 85, 247, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(236, 72, 153, 0.2) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 60%), linear-gradient(135deg, #faf5ff 0%, #fff5f8 50%, #f5f0ff 100%)',
      }} />
    );
  }
  return (
    <AbsoluteFill style={{
      background: 'radial-gradient(ellipse at 20% 20%, rgba(168, 85, 247, 0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(236, 72, 153, 0.3) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.2) 0%, transparent 70%), #0a0a0f',
    }} />
  );
};
\`\`\`

White glass card with 3D perspective entry:
\`\`\`tsx
const WhiteGlassCard: React.FC<{ children: React.ReactNode; maxWidth?: number; delay?: number; entryAnimation?: 'slide-up' | 'perspective' | 'scale'; padding?: number }> = ({
  children, maxWidth = 800, delay = 0, entryAnimation = 'perspective', padding = 48,
}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const progress = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const opacity = interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  let transform = '';
  if (entryAnimation === 'perspective') {
    const rotateX = interpolate(progress, [0, 1], [-20, 0]);
    const ty = interpolate(progress, [0, 1], [100, 0]);
    transform = "perspective(1000px) rotateX(" + rotateX + "deg) translateY(" + ty + "px)";
  } else if (entryAnimation === 'slide-up') {
    const ty = interpolate(progress, [0, 1], [80, 0]);
    transform = "translateY(" + ty + "px)";
  } else {
    const s = interpolate(progress, [0, 1], [0.8, 1]);
    transform = "scale(" + s + ")";
  }
  return (
    <div style={{
      maxWidth, padding, opacity, transform,
      background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(24px)',
      borderRadius: 24, boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      border: '1px solid rgba(255,255,255,0.3)',
    }}>{children}</div>
  );
};
\`\`\`

Gradient accent text (purple → pink):
\`\`\`tsx
const GradientAccentText: React.FC<{ text: string; fontSize?: number; delay?: number }> = ({
  text, fontSize = 56, delay = 0,
}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(f, [0, 15], [0.9, 1], { extrapolateRight: "clamp" });
  return (
    <span style={{
      display: 'inline-block', fontSize, fontFamily: montserrat, fontWeight: 700,
      background: 'linear-gradient(135deg, #a855f7, #ec4899)',
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      opacity, transform: \`scale(\${scale})\`,
    }}>{text}</span>
  );
};
\`\`\`

Scene progress dots:
\`\`\`tsx
const SceneProgressDots: React.FC<{ totalScenes: number; sceneBoundaries: number[] }> = ({
  totalScenes, sceneBoundaries,
}) => {
  const frame = useCurrentFrame();
  let currentScene = 0;
  for (let i = 0; i < sceneBoundaries.length; i++) {
    if (frame >= sceneBoundaries[i]) currentScene = i;
  }
  return (
    <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 100 }}>
      {Array.from({ length: totalScenes }).map((_, i) => (
        <div key={i} style={{
          height: 8, borderRadius: 4,
          width: i === currentScene ? 24 : 8,
          background: i === currentScene ? '#a855f7' : i < currentScene ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.3)',
        }} />
      ))}
    </div>
  );
};
\`\`\`

### 7. SCREEN RECORDING PLAYBACK

For scenes with screen recordings, use the \`<Video>\` component from Remotion:
\`\`\`tsx
import { Video } from 'remotion';

// Recording scene with feature label overlay
const RecordingScene: React.FC<{ videoUrl: string; featureName: string }> = ({ videoUrl, featureName }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const labelOpacity = interpolate(frame, [0, 30, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }}>
      <Video src={videoUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: labelOpacity, zIndex: 10 }}>
        <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', borderRadius: 12, padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #ec4899)' }} />
          <span style={{ fontFamily: montserrat, fontWeight: 600, fontSize: 20, color: '#ffffff' }}>{featureName}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
\`\`\`

### 8. DEMO-STYLE COMPOSITION STRUCTURE

Create discrete scenes with aurora backgrounds alternating dark/light:
\`\`\`tsx
const VideoComposition: React.FC = () => {
  const { fps } = useVideoConfig();
  const sceneDuration = 2;
  const sceneBoundaries = [0, 2 * fps, 4 * fps, 6 * fps, 8 * fps, 10 * fps];

  return (
    <AbsoluteFill>
      <Audio src={/* audio src provided at generation time */} volume={1} />

      {/* Scene 1: Logo on dark aurora */}
      <Sequence from={0} durationInFrames={sceneDuration * fps}>
        <AbsoluteFill>
          <AuroraBackground variant="dark" />
          <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LogoWithGlow brandName="ProductName" fontSize={80} delay={5} />
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Tagline on light aurora */}
      <Sequence from={2 * fps} durationInFrames={sceneDuration * fps}>
        <AbsoluteFill>
          <AuroraBackground variant="light" />
          <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
            <WordByWordBlur words={["The", "Future", "of", "Innovation"]} fontSize={64} color="#0a0a0f" delay={5} gradientWordIndices={[1, 3]} />
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Feature card on dark aurora */}
      <Sequence from={4 * fps} durationInFrames={sceneDuration * fps}>
        <AbsoluteFill>
          <AuroraBackground variant="dark" />
          <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WhiteGlassCard delay={5} entryAnimation="perspective">
              <GradientAccentText text="Powerful Features" fontSize={48} delay={10} />
            </WhiteGlassCard>
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      <SceneProgressDots totalScenes={6} sceneBoundaries={sceneBoundaries} />
    </AbsoluteFill>
  );
};
\`\`\`

### 9. CINEMATIC CAMERA MOVEMENTS (MANDATORY IN EVERY SCENE)

EVERY scene wrapper MUST have an interpolated camera transform. Use variety across scenes.

#### Ken Burns Zoom In:
\`\`\`tsx
const frame = useCurrentFrame();
const duration = 90; // scene length
const camScale = interpolate(frame, [0, duration], [1.0, 1.12], { extrapolateRight: 'clamp' });
const camX = interpolate(frame, [0, duration], [0, -20], { extrapolateRight: 'clamp' });
<AbsoluteFill style={{ transform: "scale(" + camScale + ") translateX(" + camX + "px)", transformOrigin: 'center center' }}>
  {/* content */}
</AbsoluteFill>
\`\`\`

#### Ken Burns Zoom Out (alternate scenes):
\`\`\`tsx
const camScale = interpolate(frame, [0, duration], [1.14, 1.0], { extrapolateRight: 'clamp' });
const camY = interpolate(frame, [0, duration], [30, 0], { extrapolateRight: 'clamp' });
<AbsoluteFill style={{ transform: "scale(" + camScale + ") translateY(" + camY + "px)", transformOrigin: 'top left' }}>
\`\`\`

#### Parallax Pan (multi-layer depth):
\`\`\`tsx
// Background moves slower than foreground
const bgX = interpolate(frame, [0, 450], [0, -60], { extrapolateRight: 'clamp' });
const fgX = interpolate(frame, [0, 450], [0, -160], { extrapolateRight: 'clamp' });
// Apply bgX to bg layer, fgX to text/fg layer
\`\`\`

#### Continuous Drift (background elements):
\`\`\`tsx
// Background blobs / bokeh circles that never stop moving
const drift = Math.sin(frame / 40) * 18;
const driftY = Math.cos(frame / 60) * 12;
<div style={{ transform: "translateX(" + drift + "px) translateY(" + driftY + "px)" }}>
\`\`\`
`;

const REMOTION_TRANSLATOR_SYSTEM_PROMPT = `You are a Remotion expert who converts React components into polished product demo video compositions with a cinematic, brand-matched style.

${REMOTION_SKILLS}

---

## YOUR TASK

Take a React page component and translate it into a Remotion video with a style that MATCHES the brand — not a generic template.

## CRITICAL: CINEMATIC STYLE REQUIREMENTS

1. **MANDATORY CAMERA MOVEMENT**: Every scene wrapper MUST include an interpolated zoom or pan (see §9 above). Alternate zoom in / zoom out / pan left / pan right across scenes.

2. **MANDATORY FONT - Montserrat ONLY via @remotion/google-fonts**:
   \`\`\`tsx
   import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
   const { fontFamily: montserrat } = loadMontserrat("normal", { weights: ["400", "600", "700", "800", "900"], subsets: ["latin"] });
   \`\`\`
   - Headlines: 100-180px, fontWeight 700-900, letterSpacing -2 to -4px
   - Supporting: 36-60px, fontWeight 400-500
   - Max 3 text elements per scene

3. **BRAND-MATCHED COLORS**: Extract dominant colors from the source component and build the visual language around them. Do NOT default to purple+pink unless the brand actually uses them.

4. **MOVING BACKGROUND (MANDATORY)**: Every background MUST move:
   - Bokeh circles: blurred divs (filter: blur(80-200px)), drifting via Math.sin/cos
   - Slow gradient pan: translate the background layer
   - Pulsing opacity: interpolate opacity in a sine wave pattern

5. **SCENE TRANSITIONS**: Each scene fades out (opacity 1→0) over last 12 frames. Each scene fades in (opacity 0→1) over first 12 frames.

6. **TEXT ANIMATIONS**:
   - WordByWordBlur: staggered word-by-word reveal (blur 10→0, translateY 30→0)
   - Line sweep: width 0→100% on a color bar under a headline
   - Scale pop: spring() for bouncy entrances

7. **SCENE STRUCTURE**: Use <Sequence> for discrete scenes. Each scene gets its own camera direction.

## CRITICAL TRANSLATION RULES

1. CONVERT EVERY CSS ANIMATION:
   - CSS transition/animation → interpolate() with useCurrentFrame()
   - transform animations → spring() for bouncy, interpolate() for smooth

2. REQUIRED IMPORTS:
   \`\`\`tsx
   import React from 'react';
   import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
   \`\`\`

3. STRUCTURE:
   - Main component uses AbsoluteFill as root
   - Use <Sequence> for discrete scenes with smooth entry/exit animations
   - ALWAYS use premountFor on Sequences
   - Camera transform on EVERY scene wrapper

4. OUTPUT FORMAT (CRITICAL):
   - Return complete Remotion composition in a code block
   - Main component MUST be named "VideoComposition"
   - MUST end with: export default VideoComposition;

5. STRICTLY FORBIDDEN:
   - NO CSS animations or transitions
   - NO Tailwind animation classes
   - NO setTimeout or setInterval
   - NO generic purple+pink aurora (unless brand uses those colors)
   - NO white glass cards (rgba(255,255,255,0.95)) — too generic
   - ALL values computed from frame
   - NO named exports only — MUST have export default
   - NO useFrame from @react-three/fiber

6. TEMPLATE LITERAL SYNTAX (CRITICAL):
   When using template literals in style objects, ALWAYS close them properly:

   CORRECT:
   \`\`\`tsx
   style={{ filter: \`blur(\${blur}px)\`, transform: \`translateY(\${y}px)\` }}
   \`\`\`

   WRONG (will cause syntax errors):
   \`\`\`tsx
   style={{ filter: \`blur(\${blur}px), transform: \`translateY(\${y}px)\` }}
   \`\`\`

   RULES:
   - Every opening backtick \` MUST have a closing backtick \`
   - Template literals inside style objects must be complete before the comma
   - Never split template literals across multiple properties`;

// ============================================================================
// CODE VALIDATION AND FIXING
// ============================================================================

/**
 * Validates and fixes common syntax errors in LLM-generated code
 */
export function validateAndFixCode(code: string): {
  code: string;
  issues: string[];
} {
  const issues: string[] = [];
  let fixedCode = code;

  // Fix 1: Fix unterminated template literals
  // Count backticks - should be even
  const backtickCount = (fixedCode.match(/`/g) || []).length;
  if (backtickCount % 2 !== 0) {
    issues.push("Fixed: Unterminated template literal");
    // Try to find and close unclosed template literals
    fixedCode = fixedCode.replace(/`([^`]*?)$/gm, "`$1`");
  }

  // Fix 2: Fix broken filter: blur syntax inside template literals
  // Pattern: filter: `blur(${...}px) should be filter: `blur(${...}px)`
  fixedCode = fixedCode.replace(
    /filter:\s*`blur\(\$\{([^}]+)\}px\)(?!`)/g,
    "filter: `blur(${$1}px)`",
  );

  // Fix 3: Fix broken transform template literals
  fixedCode = fixedCode.replace(
    /transform:\s*`([^`]+)(?!`)\s*,/g,
    "transform: `$1`,",
  );

  // Fix 4: Fix common pattern where template literal is broken mid-line
  // Look for lines ending with ${ and not closed
  const lines = fixedCode.split("\n");
  const fixedLines: string[] = [];
  let inTemplateLiteral = false;
  let templateLiteralDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Track template literal state
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const prevChar = j > 0 ? line[j - 1] : "";

      if (char === "`" && prevChar !== "\\") {
        inTemplateLiteral = !inTemplateLiteral;
      }
      if (inTemplateLiteral && char === "$" && line[j + 1] === "{") {
        templateLiteralDepth++;
      }
      if (inTemplateLiteral && char === "}" && templateLiteralDepth > 0) {
        templateLiteralDepth--;
      }
    }

    // If line ends while in template literal but not in ${}, might need closing backtick
    if (inTemplateLiteral && templateLiteralDepth === 0) {
      // Check if next line starts with continuation
      const nextLine = lines[i + 1] || "";
      if (
        !nextLine.trim().startsWith("`") &&
        line.includes("${") &&
        line.includes("}")
      ) {
        // This line might need a closing backtick
        const lastBraceIndex = line.lastIndexOf("}");
        if (
          lastBraceIndex > -1 &&
          !line.substring(lastBraceIndex).includes("`")
        ) {
          // Find where to insert the closing backtick
          if (
            line.trim().endsWith(",") ||
            line.trim().endsWith(";") ||
            line.trim().endsWith(")")
          ) {
            const endChar = line.trim().slice(-1);
            line =
              line.slice(
                0,
                -endChar.length - (line.length - line.trimEnd().length),
              ) +
              "`" +
              endChar;
            issues.push(`Fixed: Added missing backtick at line ${i + 1}`);
            inTemplateLiteral = false;
          }
        }
      }
    }

    fixedLines.push(line);
  }

  fixedCode = fixedLines.join("\n");

  // Fix 5: Fix style objects with broken template literals
  // Match style={{ ... filter: `blur(${...}px ... }} without closing backtick
  fixedCode = fixedCode.replace(
    /style=\{\{([^}]*?)filter:\s*`blur\(\$\{([^}]+)\}px\)([^`]*?)\}\}/g,
    (match, before, blurVar, after) => {
      if (!after.includes("`")) {
        issues.push("Fixed: Style object with broken blur template");
        return `style={{${before}filter: \`blur(\${${blurVar}}px)\`${after}}}`;
      }
      return match;
    },
  );

  // Fix 6: Ensure all interpolate calls have proper syntax
  fixedCode = fixedCode.replace(
    /interpolate\s*\(\s*([^,]+)\s*,\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]\s*,?\s*(\{[^}]*\})?\s*\)/g,
    (match, frame, inputRange, outputRange, config) => {
      // Validate and clean up interpolate calls
      const cleanConfig = config || "{ extrapolateRight: 'clamp' }";
      return `interpolate(${frame.trim()}, [${inputRange.trim()}], [${outputRange.trim()}], ${cleanConfig})`;
    },
  );

  // Fix 7: Fix common 'blur' appearing after a number without backtick closure
  fixedCode = fixedCode.replace(/(\d+)\s*blur/g, (match, num) => {
    issues.push("Fixed: Number followed by 'blur' without proper syntax");
    return `${num}}px)\``;
  });

  // Fix 8: Fix broken transform template literals like `translate(${x}px`, ${y}px)`
  // Pattern: `...(${var}px`, ${var}px)` -> `...(${var}px, ${var}px)`
  fixedCode = fixedCode.replace(
    /`([^`]*\$\{[^}]+\}px)`\s*,\s*\$\{([^}]+)\}px\)`/g,
    (match, before, afterVar) => {
      issues.push(
        "Fixed: Broken transform template literal with extra backtick",
      );
      return `\`${before}, \${${afterVar}}px)\``;
    },
  );

  // Fix 9: Fix nested template literals in transform that have broken syntax
  // Pattern: `translate(${x1}px`, ${y1}px)` should be `translate(${x1}px, ${y1}px)`
  fixedCode = fixedCode.replace(
    /transform:\s*`([^`]+)\$\{([^}]+)\}px`\s*,\s*\$\{([^}]+)\}px\)`/g,
    (match, prefix, var1, var2) => {
      issues.push("Fixed: Broken transform syntax with misplaced backtick");
      return `transform: \`${prefix}\${${var1}}px, \${${var2}}px)\``;
    },
  );

  // Fix 10: Fix backtick appearing mid-interpolate call inside template literal
  // Pattern: `translateY(${interpolate(f, [a, b], [c, d]`, { ... })}px)`
  // Should be: `translateY(${interpolate(f, [a, b], [c, d], { ... })}px)`
  fixedCode = fixedCode.replace(
    /\$\{(interpolate\([^}]*?\])`\s*,\s*(\{[^}]*?\})\)/g,
    (match, interpCall, config) => {
      issues.push(
        "Fixed: Backtick inside interpolate call in template literal",
      );
      return `\${${interpCall}, ${config})}`;
    },
  );

  // Fix 10b: More aggressive fix for interpolate with backtick after bracket
  // Pattern: interpolate(frame, [0, 100], [0, 1]`, { ... })
  // Should be: interpolate(frame, [0, 100], [0, 1], { ... })
  fixedCode = fixedCode.replace(
    /interpolate\s*\(\s*([^,]+)\s*,\s*\[([^\]]*)\]\s*,\s*\[([^\]]*)\]`\s*,/g,
    (match, frame, input, output) => {
      issues.push("Fixed: Backtick after interpolate output array");
      return `interpolate(${frame.trim()}, [${input}], [${output}],`;
    },
  );

  // Fix 10c: Fix interpolate with broken bracket syntax
  // Pattern: interpolate(frame, [0, 100], [0, 1]`, {...})` - backtick after bracket inside template
  fixedCode = fixedCode.replace(
    /\$\{interpolate\(([^)]+)\]\s*`\s*,\s*(\{[^}]+\})\s*\)\s*\}/g,
    (match, args, config) => {
      issues.push("Fixed: Interpolate with backtick after bracket");
      return `\${interpolate(${args}], ${config})}`;
    },
  );

  // Fix 10d: Fix broken template literal with backtick inside ${...}
  // Pattern: `...${something` more}...` - backtick inside interpolation
  fixedCode = fixedCode.replace(
    /\$\{([^}]*)`([^}]*)\}/g,
    (match, before, after) => {
      // Only fix if it looks like a broken interpolate call
      if (before.includes("interpolate") || before.includes("[")) {
        issues.push("Fixed: Backtick inside ${...} interpolation");
        return `\${${before}${after}}`;
      }
      return match;
    },
  );

  // Fix 10e: Fix transform with multiple backtick-separated segments
  // Pattern: `translateX(${x}px` `translateY(${y}px)` -> `translateX(${x}px) translateY(${y}px)`
  fixedCode = fixedCode.replace(
    /`([^`]*)\$\{([^}]+)\}([^`]*)`\s*`/g,
    (match, before, varName, after) => {
      if (
        before.includes("translate") ||
        before.includes("rotate") ||
        before.includes("scale")
      ) {
        issues.push("Fixed: Multiple backticks in transform");
        return `\`${before}\${${varName}}${after}`;
      }
      return match;
    },
  );

  // Fix 10f: Fix broken pattern }{ that causes "Expected } but found {"
  // This can happen when previous fixes create invalid brace sequences
  fixedCode = fixedCode.replace(/\}\s*\{/g, (match) => {
    // Check if this is inside a template literal interpolation
    // ${something}{...} might be valid (object literal)
    // but }{ at end of interpolation is likely broken
    if (match === "}{") {
      issues.push("Fixed: Broken }{ brace sequence");
      return "}";
    }
    return match;
  });

  // Fix 10g: Fix double {{ that might be created accidentally
  fixedCode = fixedCode.replace(/\{\{/g, (match, offset, str) => {
    // Check context - {{ might be intentional (object in template)
    const before = str.slice(Math.max(0, offset - 10), offset);
    if (before.includes("${")) {
      return "{"; // Likely broken interpolation
    }
    return match;
  });

  // Fix 11: Remove useFrame from @react-three/fiber — incompatible with Remotion SSR
  // useFrame runs in R3F's render loop which doesn't exist in Remotion's frame-by-frame rendering.
  // Replace with useCurrentFrame()-based logic or just remove the calls.
  if (fixedCode.includes("useFrame")) {
    issues.push(
      "Fixed: Removed useFrame calls (incompatible with Remotion SSR)",
    );

    // Remove useFrame(...) call blocks — matches useFrame((state) => { ... });
    // Handle nested braces by counting them
    let result = "";
    let i = 0;
    while (i < fixedCode.length) {
      const useFrameMatch = fixedCode.substring(i).match(/^useFrame\s*\(/);
      if (useFrameMatch) {
        // Skip the entire useFrame(...) call including its body
        let depth = 0;
        let j = i + useFrameMatch[0].length - 1; // start at the opening (
        for (; j < fixedCode.length; j++) {
          if (fixedCode[j] === "(") depth++;
          else if (fixedCode[j] === ")") {
            depth--;
            if (depth === 0) break;
          }
        }
        // Skip past the closing ) and optional ;
        j++;
        if (fixedCode[j] === ";") j++;
        if (fixedCode[j] === "\n") j++;
        i = j;
        continue;
      }
      result += fixedCode[i];
      i++;
    }
    fixedCode = result;

    // Remove useFrame from the fiber import
    fixedCode = fixedCode.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]@react-three\/fiber['"]/g,
      (match, imports) => {
        const cleaned = imports
          .split(",")
          .map((s: string) => s.trim())
          .filter((s: string) => s && s !== "useFrame")
          .join(", ");
        if (!cleaned) return ""; // No imports left
        return `import { ${cleaned} } from '@react-three/fiber'`;
      },
    );
  }

  // Fix 12: Detect @react-three/drei components used outside <Canvas>
  // Common drei components that MUST be inside Canvas
  const dreiComponents = [
    "Environment",
    "Stars",
    "OrbitControls",
    "PerspectiveCamera",
    "Float",
    "Text3D",
    "Center",
    "MeshDistortMaterial",
    "MeshWobbleMaterial",
    "Sky",
    "Cloud",
    "ContactShadows",
    "Sparkles",
  ];
  const usedDreiComponents = dreiComponents.filter((c) =>
    fixedCode.includes(`<${c}`),
  );

  if (usedDreiComponents.length > 0 && !fixedCode.includes("<Canvas")) {
    // drei components used but no Canvas — strip drei imports and components entirely
    issues.push(
      `Fixed: Removed drei components (${usedDreiComponents.join(", ")}) — no <Canvas> wrapper found`,
    );

    // Remove drei import line
    fixedCode = fixedCode.replace(
      /import\s+\{[^}]*\}\s+from\s+['"]@react-three\/drei['"];?\n?/g,
      "",
    );
    // Remove fiber import line
    fixedCode = fixedCode.replace(
      /import\s+\{[^}]*\}\s+from\s+['"]@react-three\/fiber['"];?\n?/g,
      "",
    );
    // Remove three import
    fixedCode = fixedCode.replace(
      /import\s+\*\s+as\s+THREE\s+from\s+['"]three['"];?\n?/g,
      "",
    );

    // Remove self-closing drei component tags
    for (const comp of usedDreiComponents) {
      fixedCode = fixedCode.replace(new RegExp(`<${comp}\\b[^/>]*/>`, "g"), "");
      // Remove paired tags too
      fixedCode = fixedCode.replace(
        new RegExp(`<${comp}\\b[^>]*>[\\s\\S]*?</${comp}>`, "g"),
        "",
      );
    }
  }

  if (issues.length > 0) {
    console.log("[CodeValidator] Fixed issues:", issues);
  }

  return { code: fixedCode, issues };
}

/**
 * Run validateAndFixCode in a loop until no more fixes are needed or max attempts reached
 */
export function validateAndFixCodeWithRetry(
  code: string,
  maxAttempts = 5,
): { code: string; issues: string[] } {
  let currentCode = code;
  let allIssues: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = validateAndFixCode(currentCode);

    if (result.issues.length === 0) {
      // No more fixes needed
      break;
    }

    allIssues = [...allIssues, ...result.issues];
    currentCode = result.code;

    console.log(
      `[CodeValidator] Attempt ${attempt} fixed ${result.issues.length} issues`,
    );
  }

  return { code: currentCode, issues: allIssues };
}

/**
 * More aggressive syntax fixer for broken template literals
 */
export function fixBrokenTemplateLiterals(code: string): string {
  let fixedCode = code;

  // Fix pattern: interpolate with backtick before config object
  // ${interpolate(frame, [0, 100], [0, 1]` { ... })} -> ${interpolate(frame, [0, 100], [0, 1], { ... })}
  fixedCode = fixedCode.replace(
    /\$\{interpolate\s*\(\s*([^,]+)\s*,\s*\[([^\]]*)\]\s*,\s*\[([^\]]*)\]`\s*,\s*(\{[^}]*\})\s*\)\s*\}/g,
    (match, frame, input, output, config) => {
      console.log(
        "[FixTemplate] Fixed interpolate with backtick before config",
      );
      return `\${interpolate(${frame.trim()}, [${input}], [${output}], ${config})}`;
    },
  );

  // Fix pattern: }{ adjacent braces (broken from previous fixes)
  fixedCode = fixedCode.replace(/\}\s*\{/g, (match, offset, str) => {
    const before = str.slice(Math.max(0, offset - 5), offset);
    // If preceded by ) or ] or }, it's likely closing something
    if (/[)\]\}]\s*$/.test(before)) {
      return "}";
    }
    return match;
  });

  // Fix pattern: }}{ at end of interpolation
  fixedCode = fixedCode.replace(/\}\}\s*\{/g, "}}");

  // Fix pattern: double {{ at start
  fixedCode = fixedCode.replace(/\{\{/g, (match, offset, str) => {
    const before = str.slice(Math.max(0, offset - 10), offset);
    if (/\$\{[^}]*$/.test(before)) {
      return "{";
    }
    return match;
  });

  // Fix pattern: ${...}{{...}} - interpolation with double braces
  fixedCode = fixedCode.replace(/\$\{([^}]+)\}\{\{/g, (match, inner) => {
    return `\${${inner}}{`;
  });

  // Fix broken transform patterns
  // `translateX(${x}px` ${y})` -> `translateX(${x}px, ${y})`
  fixedCode = fixedCode.replace(
    /`([^`]*)\$\{([^}]+)\}([^`]*)`\s*\$\{/g,
    (match, before, varName, after, offset, str) => {
      if (before.includes("translate") || before.includes("rotate")) {
        return `\`${before}\${${varName}}${after}, \${`;
      }
      return match;
    },
  );

  return fixedCode;
}

/**
 * Basic TypeScript syntax validation
 */
export function hasBasicSyntaxErrors(code: string): string[] {
  const errors: string[] = [];

  // Check for balanced braces
  const braces = { "{": 0, "[": 0, "(": 0, "<": 0 };
  const closingBraces: Record<string, keyof typeof braces> = {
    "}": "{",
    "]": "[",
    ")": "(",
    ">": "<",
  };

  let inString = false;
  let stringChar = "";
  let inTemplateString = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const prevChar = i > 0 ? code[i - 1] : "";

    // Track string state
    if ((char === '"' || char === "'") && prevChar !== "\\") {
      if (!inString && !inTemplateString) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
      }
    }

    if (char === "`" && prevChar !== "\\") {
      inTemplateString = !inTemplateString;
    }

    // Only count braces outside strings
    if (!inString && !inTemplateString) {
      if (char in braces) {
        braces[char as keyof typeof braces]++;
      } else if (char in closingBraces) {
        braces[closingBraces[char]]--;
      }
    }
  }

  // Check for unbalanced braces
  if (braces["{"] !== 0)
    errors.push(`Unbalanced curly braces: ${braces["{"]} extra {`);
  if (braces["["] !== 0)
    errors.push(`Unbalanced square brackets: ${braces["["]} extra [`);
  if (braces["("] !== 0)
    errors.push(`Unbalanced parentheses: ${braces["("]} extra (`);

  // Check for unclosed template strings
  if (inTemplateString) errors.push("Unclosed template string");
  if (inString) errors.push("Unclosed string literal");

  return errors;
}

/**
 * Detect if code appears to be truncated
 */
export function isCodeTruncated(code: string): boolean {
  // Check if code has export default (required for Remotion)
  if (!code.includes("export default")) {
    return true;
  }

  // Check if code ends abruptly (mid-line without semicolon or closing brace)
  const trimmedCode = code.trim();
  const lastChar = trimmedCode.slice(-1);
  const validEndings = [";", "}", ")", "]", "`", '"', "'"];
  if (!validEndings.includes(lastChar)) {
    return true;
  }

  // Check for severely unbalanced braces (likely truncation)
  const openBraces = (code.match(/{/g) || []).length;
  const closeBraces = (code.match(/}/g) || []).length;
  if (Math.abs(openBraces - closeBraces) > 3) {
    return true;
  }

  return false;
}

/**
 * Generate fallback composition code when LLM output is truncated or invalid
 */
export function generateFallbackComposition(
  productName: string = "Product",
  audioUrl: string = "audio/audio1.mp3",
  bpm: number = 120,
  recordings?: Array<{
    id: string;
    videoUrl: string;
    duration: number;
    featureName: string;
    description: string;
  }>,
): string {
  // Determine audio src based on URL type
  const isR2Audio = audioUrl.startsWith("http");
  const audioSrcCode = isR2Audio
    ? `"${audioUrl}"`
    : `staticFile("${audioUrl.replace(/^\//, "")}")`;

  // Beat-snap scene durations
  const framesPerBeat = (60 / bpm) * 30;
  const snapToBeats = (target: number) => {
    const beats = Math.max(1, Math.round(target / framesPerBeat));
    return Math.round(beats * framesPerBeat);
  };
  const introFrames = snapToBeats(90);
  const fastFrames = snapToBeats(45);
  const cardFrames = snapToBeats(60);
  const ctaFrames = snapToBeats(90);

  const hasRecordings = recordings && recordings.length > 0;

  // Beat-relative timing values for scene animations
  const halfBeat = Math.round(framesPerBeat * 0.5);
  const quarterBeat = Math.round(framesPerBeat * 0.25);
  const sixteenthBeat = Math.round(framesPerBeat / 4);

  return `import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Audio,${hasRecordings ? " Video," : ""} staticFile } from 'remotion';
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const { fontFamily: mont } = loadMontserrat("normal", { weights: ["400", "600", "700", "800", "900"], subsets: ["latin"] });

// CINEMATIC COLOR PALETTE
const C = {
  bg: '#08080f',
  text: '#ffffff',
  sub: 'rgba(255,255,255,0.65)',
  accent: '#3b82f6',  // default blue — overridden per-brand
  accentAlt: '#06b6d4',
  line: 'rgba(255,255,255,0.15)',
};

// CINEMATIC BOKEH BACKGROUND — drifting blurred circles, never static
const CineBg: React.FC<{ seed?: number }> = ({ seed = 0 }) => {
  const frame = useCurrentFrame();
  const blobs = [
    { x: 15, y: 20, r: 400, color: 'rgba(59,130,246,0.18)' },
    { x: 75, y: 70, r: 500, color: 'rgba(6,182,212,0.12)' },
    { x: 50, y: 45, r: 350, color: 'rgba(139,92,246,0.10)' },
    { x: 20, y: 80, r: 300, color: 'rgba(59,130,246,0.08)' },
  ];
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      {blobs.map((b, i) => {
        const drift = Math.sin((frame + seed * 30 + i * 40) / (50 + i * 10)) * 30;
        const driftY = Math.cos((frame + seed * 30 + i * 25) / (60 + i * 12)) * 20;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: b.x + '%', top: b.y + '%',
            width: b.r, height: b.r,
            borderRadius: '50%',
            background: b.color,
            filter: 'blur(120px)',
            transform: 'translate(-50%,-50%) translateX(' + drift + 'px) translateY(' + driftY + 'px)',
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

// FADE WRAPPER — fades in and out at scene edges
const FadeWrapper: React.FC<{ children: React.ReactNode; duration: number; fadeFrames?: number }> = ({ children, duration, fadeFrames = 12 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, fadeFrames, duration - fadeFrames, duration], [0, 1, 1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

// WORD BY WORD REVEAL
const WordReveal: React.FC<{ words: string[]; fontSize?: number; color?: string; delay?: number; stagger?: number }> = ({
  words, fontSize = 80, color = '#ffffff', delay = 0, stagger = 8,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25em', justifyContent: 'center', alignItems: 'center' }}>
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * stagger);
        const op = interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
        const blur = interpolate(f, [0, 15], [12, 0], { extrapolateRight: 'clamp' });
        const ty = interpolate(f, [0, 15], [40, 0], { extrapolateRight: 'clamp' });
        return (
          <span key={i} style={{
            fontFamily: mont, fontWeight: 800, fontSize, color,
            letterSpacing: '-3px', lineHeight: 1,
            display: 'inline-block',
            opacity: op, filter: 'blur(' + blur + 'px)', transform: 'translateY(' + ty + 'px)',
          }}>{word}</span>
        );
      })}
    </div>
  );
};

// SWEEP LINE — width animates left to right
const SweepLine: React.FC<{ delay?: number; color?: string; width?: number | string }> = ({ delay = 0, color = C.accent, width = 120 }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const w = interpolate(f, [0, 20], [0, typeof width === 'number' ? width : 120], { extrapolateRight: 'clamp' });
  return <div style={{ height: 3, width: w, background: color, borderRadius: 2, marginTop: 16 }} />;
};


// SCENE 1: Logo intro — zoom IN slowly
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const camScale = interpolate(frame, [0, ${introFrames}], [1.0, 1.10], { extrapolateRight: 'clamp' });
  const camX = interpolate(frame, [0, ${introFrames}], [0, -15], { extrapolateRight: 'clamp' });
  const titleOp = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const subOp = interpolate(Math.max(0, frame - 18), [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const lineW = interpolate(Math.max(0, frame - 12), [0, 25], [0, 260], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <CineBg seed={0} />
      <FadeWrapper duration={${introFrames}}>
        <AbsoluteFill style={{ transform: 'scale(' + camScale + ') translateX(' + camX + 'px)', transformOrigin: 'center center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ opacity: titleOp }}>
            <div style={{ fontFamily: mont, fontWeight: 900, fontSize: 140, color: C.text, letterSpacing: '-5px', lineHeight: 0.95, textAlign: 'center' }}>
              ${productName}
            </div>
          </div>
          <div style={{ height: 3, width: lineW, background: C.accent, borderRadius: 2 }} />
          <div style={{ opacity: subOp, fontFamily: mont, fontWeight: 400, fontSize: 32, color: C.sub, letterSpacing: '6px', textTransform: 'uppercase', marginTop: 8 }}>
            The future is now
          </div>
        </AbsoluteFill>
      </FadeWrapper>
    </AbsoluteFill>
  );
};

// SCENE 2: Tagline — zoom OUT from top-left
const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const camScale = interpolate(frame, [0, ${fastFrames}], [1.12, 1.0], { extrapolateRight: 'clamp' });
  const camY = interpolate(frame, [0, ${fastFrames}], [20, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <CineBg seed={1} />
      <FadeWrapper duration={${fastFrames}}>
        <AbsoluteFill style={{ transform: 'scale(' + camScale + ') translateY(' + camY + 'px)', transformOrigin: 'top left', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 100 }}>
          <WordReveal words={['Built', 'for', 'Speed']} fontSize={120} delay={8} stagger={10} />
        </AbsoluteFill>
      </FadeWrapper>
    </AbsoluteFill>
  );
};

// SCENE 3: Feature — pan left slowly
const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const camX = interpolate(frame, [0, ${cardFrames}], [0, -50], { extrapolateRight: 'clamp' });
  const bgX = interpolate(frame, [0, ${cardFrames}], [0, -20], { extrapolateRight: 'clamp' });
  const labelOp = interpolate(Math.max(0, frame - 8), [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const labelTy = interpolate(Math.max(0, frame - 8), [0, 15], [30, 0], { extrapolateRight: 'clamp' });
  const lineW = interpolate(Math.max(0, frame - 18), [0, 20], [0, 180], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: 'translateX(' + bgX + 'px)' }}><CineBg seed={2} /></AbsoluteFill>
      <FadeWrapper duration={${cardFrames}}>
        <AbsoluteFill style={{ transform: 'translateX(' + camX + 'px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '0 120px' }}>
          <div style={{ opacity: labelOp, transform: 'translateY(' + labelTy + 'px)' }}>
            <div style={{ fontFamily: mont, fontWeight: 400, fontSize: 22, color: C.sub, letterSpacing: '5px', textTransform: 'uppercase', marginBottom: 20 }}>Feature 01</div>
            <div style={{ fontFamily: mont, fontWeight: 800, fontSize: 100, color: C.text, letterSpacing: '-3px', lineHeight: 0.95 }}>Powerful</div>
            <div style={{ fontFamily: mont, fontWeight: 800, fontSize: 100, color: C.accent, letterSpacing: '-3px', lineHeight: 0.95 }}>Features</div>
            <div style={{ height: 3, width: lineW, background: C.accent, borderRadius: 2, marginTop: 20 }} />
            <div style={{ fontFamily: mont, fontWeight: 400, fontSize: 28, color: C.sub, marginTop: 20, maxWidth: 500, lineHeight: 1.5 }}>Built for performance, designed for simplicity.</div>
          </div>
        </AbsoluteFill>
      </FadeWrapper>
    </AbsoluteFill>
  );
};

// SCENE 4: Value prop — zoom IN from right
const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const camScale = interpolate(frame, [0, ${fastFrames}], [1.0, 1.10], { extrapolateRight: 'clamp' });
  const camX = interpolate(frame, [0, ${fastFrames}], [30, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <CineBg seed={3} />
      <FadeWrapper duration={${fastFrames}}>
        <AbsoluteFill style={{ transform: 'scale(' + camScale + ') translateX(' + camX + 'px)', transformOrigin: 'right center', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 100 }}>
          <WordReveal words={['Build', 'Something', 'Amazing']} fontSize={110} delay={8} stagger={10} />
        </AbsoluteFill>
      </FadeWrapper>
    </AbsoluteFill>
  );
};

// SCENE 5: Feature 2 — pan right
const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const camX = interpolate(frame, [0, ${cardFrames}], [0, 50], { extrapolateRight: 'clamp' });
  const bgX = interpolate(frame, [0, ${cardFrames}], [0, 20], { extrapolateRight: 'clamp' });
  const labelOp = interpolate(Math.max(0, frame - 8), [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const labelTy = interpolate(Math.max(0, frame - 8), [0, 15], [30, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: 'translateX(' + bgX + 'px)' }}><CineBg seed={4} /></AbsoluteFill>
      <FadeWrapper duration={${cardFrames}}>
        <AbsoluteFill style={{ transform: 'translateX(' + camX + 'px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', padding: '0 120px', textAlign: 'right' }}>
          <div style={{ opacity: labelOp, transform: 'translateY(' + labelTy + 'px)' }}>
            <div style={{ fontFamily: mont, fontWeight: 400, fontSize: 22, color: C.sub, letterSpacing: '5px', textTransform: 'uppercase', marginBottom: 20 }}>Feature 02</div>
            <div style={{ fontFamily: mont, fontWeight: 800, fontSize: 100, color: C.text, letterSpacing: '-3px', lineHeight: 0.95 }}>Seamless</div>
            <div style={{ fontFamily: mont, fontWeight: 800, fontSize: 100, color: C.accentAlt, letterSpacing: '-3px', lineHeight: 0.95 }}>Experience</div>
            <div style={{ fontFamily: mont, fontWeight: 400, fontSize: 28, color: C.sub, marginTop: 20, maxWidth: 500, lineHeight: 1.5 }}>Every detail crafted with care.</div>
          </div>
        </AbsoluteFill>
      </FadeWrapper>
    </AbsoluteFill>
  );
};

// SCENE 6: CTA — slow dramatic zoom IN
const Scene6: React.FC = () => {
  const frame = useCurrentFrame();
  const camScale = interpolate(frame, [0, ${ctaFrames}], [1.0, 1.08], { extrapolateRight: 'clamp' });
  const labelOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const subOp = interpolate(Math.max(0, frame - 20), [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const lineW = interpolate(Math.max(0, frame - 15), [0, 20], [0, 320], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <CineBg seed={5} />
      <FadeWrapper duration={${ctaFrames}}>
        <AbsoluteFill style={{ transform: 'scale(' + camScale + ')', transformOrigin: 'center center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ opacity: labelOp, fontFamily: mont, fontWeight: 400, fontSize: 22, color: C.sub, letterSpacing: '6px', textTransform: 'uppercase' }}>Get Started Today</div>
          <div style={{ fontFamily: mont, fontWeight: 900, fontSize: 130, color: C.text, letterSpacing: '-4px', lineHeight: 0.9, textAlign: 'center', opacity: labelOp }}>
            ${productName}
          </div>
          <div style={{ height: 3, width: lineW, background: 'linear-gradient(90deg, ' + C.accent + ', ' + C.accentAlt + ')', borderRadius: 2 }} />
          <div style={{ opacity: subOp, fontFamily: mont, fontWeight: 400, fontSize: 28, color: C.sub, marginTop: 8 }}>Try it free — no credit card required</div>
        </AbsoluteFill>
      </FadeWrapper>
    </AbsoluteFill>
  );
};

${
  hasRecordings
    ? recordings!
        .map((rec, i) => {
          const isR2 = rec.videoUrl.startsWith("http");
          const videoSrc = isR2
            ? `"${rec.videoUrl}"`
            : `staticFile("${rec.videoUrl.replace(/^\//, "")}")`;
          return `
// RECORDING SCENE ${i + 1}: ${rec.featureName}
const RecordingScene${i + 1}: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { beatPulse } = useBeatSync(${bpm});
  const entryScale = interpolate(frame, [0, ${halfBeat}], [0.85, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const entryOpacity = interpolate(frame, [0, ${quarterBeat}], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const labelOpacity = interpolate(frame, [0, 30, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }}>
      <div style={{ width: '100%', height: '100%', transform: "scale(" + (entryScale * (1 + beatPulse * 0.008)) + ")", opacity: entryOpacity }}>
        <Video src={${videoSrc}} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: labelOpacity, zIndex: 10 }}>
        <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', borderRadius: 12, padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #a855f7, #ec4899)' }} />
          <span style={{ fontFamily: montserrat, fontWeight: 600, fontSize: 20, color: '#ffffff' }}>${rec.featureName}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};`;
        })
        .join("\n")
    : ""
}

// BEAT SYNC HOOK
const useBeatSync = (bpm: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const framesPerBeat = (60 / bpm) * fps;
  const beatProgress = (frame % framesPerBeat) / framesPerBeat;
  const beatPulse = Math.exp(-beatProgress * 4);
  return { beatProgress, beatPulse, framesPerBeat };
};

const VideoComposition: React.FC = () => {
  // Beat-snapped scene durations (BPM: ${bpm})
  const introFrames = ${introFrames};
  const fastFrames = ${fastFrames};
  const cardFrames = ${cardFrames};
  const ctaFrames = ${ctaFrames};

  const s1Start = 0;
  const s2Start = s1Start + introFrames;
  const s3Start = s2Start + fastFrames;
  const s4Start = s3Start + cardFrames;
  const s5Start = s4Start + fastFrames;
  let nextStart = s5Start + cardFrames;
${
  hasRecordings
    ? recordings!
        .map((rec, i) => {
          const recFrames = Math.round(rec.duration * 30);
          return `  const rec${i + 1}Start = nextStart;
  const rec${i + 1}Frames = ${recFrames};
  nextStart = rec${i + 1}Start + rec${i + 1}Frames;`;
        })
        .join("\n")
    : ""
}
  const s6Start = nextStart;

  return (
    <AbsoluteFill>
      <Audio src={${audioSrcCode}} volume={0.8} />

      {/* Scene 1: Logo intro — zoom in */}
      <Sequence from={s1Start} durationInFrames={introFrames}>
        <Scene1 />
      </Sequence>

      {/* Scene 2: Tagline — zoom out */}
      <Sequence from={s2Start} durationInFrames={fastFrames}>
        <Scene2 />
      </Sequence>

      {/* Scene 3: Feature — pan left */}
      <Sequence from={s3Start} durationInFrames={cardFrames}>
        <Scene3 />
      </Sequence>

      {/* Scene 4: Value prop — zoom in from right */}
      <Sequence from={s4Start} durationInFrames={fastFrames}>
        <Scene4 />
      </Sequence>

      {/* Scene 5: Feature 2 — pan right */}
      <Sequence from={s5Start} durationInFrames={cardFrames}>
        <Scene5 />
      </Sequence>

${
  hasRecordings
    ? recordings!
        .map(
          (rec, i) => `      {/* Recording: ${rec.featureName} */}
      <Sequence from={rec${i + 1}Start} durationInFrames={rec${i + 1}Frames}>
        <RecordingScene${i + 1} />
      </Sequence>
`,
        )
        .join("\n")
    : ""
}
      {/* Scene 6: CTA — dramatic zoom in */}
      <Sequence from={s6Start} durationInFrames={ctaFrames}>
        <Scene6 />
      </Sequence>
    </AbsoluteFill>
  );
};

export default VideoComposition;
`;
}

export async function remotionTranslatorNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log(
    "[RemotionTranslator] Starting translation to Remotion with skills...",
  );

  const reactCode = state.reactPageCode;
  if (!reactCode) {
    return {
      errors: [...state.errors, "No React page code available for translation"],
      currentStep: "error",
    };
  }

  const script = state.videoScript;
  const totalDuration = script?.totalDuration || 300;

  // Compute audio source early so it can be injected into the prompt
  const rawAudioUrl = state.userPreferences?.audio?.url || "";
  const audioUrl = rawAudioUrl.startsWith("http")
    ? rawAudioUrl
    : rawAudioUrl.replace(/^\//, "");
  const isR2Audio = audioUrl.startsWith("http");
  const audioSrcCode = audioUrl
    ? isR2Audio
      ? `"${audioUrl}"`
      : `staticFile("${audioUrl}")`
    : `staticFile("audio/audio1.mp3")`;
  const audioBpm =
    state.userPreferences?.audio?.bpm || state.videoScript?.music?.tempo || 120;

  const prompt = `${REMOTION_TRANSLATOR_SYSTEM_PROMPT}

---

## TRANSLATE THIS REACT PAGE TO REMOTION

\`\`\`tsx
${reactCode}
\`\`\`

## VIDEO SPECIFICATIONS
- Total duration: ${totalDuration} frames (${Math.round(totalDuration / 30)} seconds)
- FPS: 30
- Resolution: 1920x1080

## REQUIREMENTS - PREMIUM DEMO STYLE VIDEO
1. **VARIABLE SCENE TIMING**:
   - Intro (first): ~90 frames (3s) — slow, dramatic
   - Middle scenes: ~45 frames (1.5s) — fast, punchy
   - Feature cards: ~60 frames (2s) — readable
   - Screenshots: ~75 frames (2.5s) — see the product
   - CTA (ALWAYS last): ~90 frames (3s) — slow, dramatic close
2. **DISCRETE SCENES**: Use separate Sequence components with smooth entry animations
3. **AURORA BACKGROUNDS**: Alternate dark/light aurora backgrounds between scenes
   - Dark aurora: logo scenes, CTA scenes, card scenes
   - Light aurora: text reveal scenes, tagline scenes, screenshot scenes
4. **TEXT ANIMATIONS**:
   - Use WordByWordBlur for headlines and taglines (with gradientWordIndices for emphasis)
   - Use GradientAccentText for highlighted/accent text
   - Use LogoWithGlow for brand name/logo scenes
5. **WHITE GLASS CARDS**: Use WhiteGlassCard with perspective/slide-up entry for feature content
   - Card text: #111827 (dark gray), card subtext: #4b5563
6. **SCENE PROGRESS DOTS**: Add SceneProgressDots overlay at the root level
7. **FONT**: Montserrat only (400-800 weights), normal case (NOT uppercase)
8. **COLOR PALETTE**: Purple #a855f7, Pink #ec4899, Dark #0a0a0f
9. **CTA**: The LAST scene MUST always be a call-to-action
10. Convert ALL CSS animations to interpolate() or spring()
11. CRITICAL: Include Audio component at root level with the EXACT src provided:
    \`\`\`tsx
    import { Audio${!isR2Audio ? ", staticFile" : ""} } from 'remotion';
    // Inside VideoComposition:
    <Audio src={${audioSrcCode}} volume={1} />
    \`\`\`
    DO NOT use staticFile("audio/audio1.mp3") — use the exact audio source shown above.

## MANDATORY: USE WEBSITE SCREENSHOT
The website screenshot MUST be displayed in the video:
${(() => {
  const screenshots = (state.productData as any)?.screenshots || [];
  const heroShot = screenshots.find((s: any) => s.section === "hero");
  const primaryShot = heroShot || screenshots[0];
  if (primaryShot) {
    const isR2 = primaryShot.url.startsWith("http");
    const imgSrc = isR2
      ? `"${primaryShot.url}"`
      : `staticFile("${primaryShot.url.replace(/^\//, "")}")`;
    return `- Available screenshots:
${screenshots
  .map((s: any) => {
    const sIsR2 = s.url.startsWith("http");
    return `  - ${s.section}: ${sIsR2 ? `"${s.url}"` : `staticFile("${s.url.replace(/^\//, "")}")`} — ${s.description}`;
  })
  .join("\n")}
- Import Img from remotion: import { Img${!isR2 ? ", staticFile" : ""} } from 'remotion';
- Primary screenshot: <Img src={${imgSrc}} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
- Display at least one screenshot in the video with animations (zoom, pan, fade, scale)`;
  }
  return `- No screenshots available — skip Img usage, use text-only scenes instead`;
})()}
- Can be used as background with overlay, or as a featured element
- Apply effects like: scale, blur, opacity changes using interpolate()
- If no screenshot file exists, do NOT use <Img> — use text and gradient backgrounds instead

## SCREEN RECORDINGS
${(() => {
  const recordings = state.recordings || [];
  if (recordings.length > 0) {
    return `Screen recordings are available. Include them as Video playback scenes:
${recordings
  .map((r) => {
    const isR2 = r.videoUrl.startsWith("http");
    const src = isR2
      ? `"${r.videoUrl}"`
      : `staticFile("${r.videoUrl.replace(/^\//, "")}")`;
    return `- "${r.featureName}": <Video src={${src}} /> — ${r.duration}s, ${r.description}`;
  })
  .join("\n")}
- Import Video from remotion: import { Video } from 'remotion';
- Each recording scene should show the video with a feature label overlay
- Duration per recording = recording duration × 30 frames`;
  }
  return `- No recordings available — skip Video usage`;
})()}

Output the complete Remotion composition code with FAST-PACED text animations. MUST include Audio component, text effects, and the website screenshot!`;

  try {
    console.log("[RemotionTranslator] Calling Gemini Pro...");
    const response = await chatWithGeminiPro(
      [{ role: "user", content: prompt }],
      {
        temperature: 0.5,
        maxTokens: 16000, // Increased to prevent truncation
      },
    );

    // Extract code from response using regex for code blocks
    // Use RegExp constructor with proper escaping for backticks
    const backtick = String.fromCharCode(96);
    const codeBlockPattern = new RegExp(
      backtick +
        backtick +
        backtick +
        "(?:tsx?|jsx?|javascript)?\\s*([\\s\\S]*?)" +
        backtick +
        backtick +
        backtick,
    );
    const codeMatch = response.content.match(codeBlockPattern);
    let remotionCode = codeMatch ? codeMatch[1].trim() : response.content;

    // Ensure there's a default export
    if (!remotionCode.includes("export default")) {
      // Try to find VideoComposition or any PascalCase component
      if (
        remotionCode.includes("const VideoComposition") ||
        remotionCode.includes("function VideoComposition")
      ) {
        remotionCode += "\n\nexport default VideoComposition;";
      } else {
        const componentMatch = remotionCode.match(
          /(?:const|function)\s+([A-Z][a-zA-Z0-9]*)/,
        );
        if (componentMatch) {
          remotionCode += "\n\nexport default " + componentMatch[1] + ";";
        }
      }
    }

    console.log(
      "[RemotionTranslator] Generated Remotion code:",
      remotionCode.length,
      "chars",
    );

    // Check for truncation first
    if (isCodeTruncated(remotionCode)) {
      console.warn(
        "[RemotionTranslator] Code appears truncated! Using fallback...",
      );
      const productName = state.productData?.name || "Product";
      remotionCode = generateFallbackComposition(
        productName,
        audioUrl,
        audioBpm,
        state.recordings,
      );
      console.log("[RemotionTranslator] Using fallback composition");
    }

    // Replace any hardcoded audio paths the LLM may have used
    if (audioUrl) {
      remotionCode = remotionCode.replace(
        /staticFile\(["']audio\/audio1\.mp3["']\)/g,
        audioSrcCode,
      );
    }

    // Validate and fix common syntax errors
    console.log("[RemotionTranslator] Validating and fixing code...");
    const { code: validatedCode, issues } = validateAndFixCode(remotionCode);

    if (issues.length > 0) {
      console.log("[RemotionTranslator] Fixed issues:", issues);
    }

    // Check for remaining syntax errors
    let finalCode = validatedCode;
    const syntaxErrors = hasBasicSyntaxErrors(validatedCode);
    if (syntaxErrors.length > 0) {
      console.warn(
        "[RemotionTranslator] Remaining syntax issues:",
        syntaxErrors,
      );
      // If there are severe syntax errors, ask LLM to fix them
      if (
        syntaxErrors.some(
          (e) => e.includes("Unclosed") || e.includes("Unbalanced"),
        )
      ) {
        console.log("[RemotionTranslator] Asking LLM to fix syntax errors...");

        // Escape backticks in the code to prevent breaking the template literal
        const backtickChar = String.fromCharCode(96);
        const escapedCode = validatedCode.replace(
          new RegExp(backtickChar, "g"),
          "\\\\" + backtickChar,
        );

        // Build prompt using string concatenation to avoid backtick issues
        const fixPrompt =
          "You are a TypeScript/React expert. Fix the syntax errors in this Remotion code.\n\n" +
          "## SYNTAX ERRORS TO FIX:\n" +
          syntaxErrors.map((e) => "- " + e).join("\n") +
          "\n\n## CURRENT CODE (with errors):\n" +
          backtickChar +
          backtickChar +
          backtickChar +
          "tsx\n" +
          escapedCode +
          "\n" +
          backtickChar +
          backtickChar +
          backtickChar +
          "\n\n" +
          "## REQUIREMENTS:\n" +
          "1. Fix ALL syntax errors listed above\n" +
          "2. Ensure all braces {}, brackets [], and parentheses () are balanced\n" +
          "3. Ensure all template literals are properly closed\n" +
          "4. Ensure all strings are properly closed\n" +
          "5. Keep the functionality and logic exactly the same\n" +
          "6. Return ONLY the fixed code in a code block\n" +
          "7. MUST end with: export default VideoComposition;";

        try {
          const fixResponse = await chatWithFastModel(
            [{ role: "user", content: fixPrompt }],
            {
              temperature: 0.2,
              maxTokens: 16000,
            },
          );

          const fixedCodeBlockPattern = new RegExp(
            backtickChar +
              backtickChar +
              backtickChar +
              "(?:tsx?|jsx?|javascript)?\\s*([\\s\\S]*?)" +
              backtickChar +
              backtickChar +
              backtickChar,
          );
          const fixedCodeMatch = fixResponse.content.match(
            fixedCodeBlockPattern,
          );
          const fixedCode = fixedCodeMatch
            ? fixedCodeMatch[1].trim()
            : fixResponse.content;

          // Validate the fixed code - must be non-trivial (at least 100 chars)
          const remainingErrors = hasBasicSyntaxErrors(fixedCode);
          if (fixedCode.length < 100) {
            console.warn(
              "[RemotionTranslator] Fix returned empty/trivial code, using fallback",
            );
            finalCode = generateFallbackComposition(
              state.productData?.name || "Product",
              audioUrl,
              audioBpm,
              state.recordings,
            );
          } else if (remainingErrors.length === 0) {
            console.log(
              "[RemotionTranslator] Syntax errors fixed successfully",
            );
            finalCode = fixedCode;
          } else {
            console.warn(
              "[RemotionTranslator] Fix attempt failed, remaining errors:",
              remainingErrors,
            );
            // Try one more time with more specific instructions
            const secondFixPrompt =
              "Fix these specific syntax errors in the Remotion code:\n\n" +
              "ERRORS: " +
              remainingErrors.join(", ") +
              "\n\n" +
              "CODE:\n" +
              backtickChar +
              backtickChar +
              backtickChar +
              "tsx\n" +
              fixedCode +
              "\n" +
              backtickChar +
              backtickChar +
              backtickChar +
              "\n\n" +
              "Return ONLY valid TypeScript/React code with ALL errors fixed. Ensure perfect syntax.";

            const secondResponse = await chatWithFastModel(
              [{ role: "user", content: secondFixPrompt }],
              {
                temperature: 0.2,
                maxTokens: 16000,
              },
            );

            const secondFixedBlockPattern = new RegExp(
              backtickChar +
                backtickChar +
                backtickChar +
                "(?:tsx?|jsx?|javascript)?\\s*([\\s\\S]*?)" +
                backtickChar +
                backtickChar +
                backtickChar,
            );
            const secondFixedMatch = secondResponse.content.match(
              secondFixedBlockPattern,
            );
            const secondFixed = secondFixedMatch
              ? secondFixedMatch[1].trim()
              : secondResponse.content;

            const finalCheck = hasBasicSyntaxErrors(secondFixed);
            if (secondFixed.length < 100) {
              console.warn(
                "[RemotionTranslator] Second fix returned empty/trivial code, using fallback",
              );
              finalCode = generateFallbackComposition(
                state.productData?.name || "Product",
                audioUrl,
                audioBpm,
                state.recordings,
              );
            } else if (finalCheck.length === 0) {
              console.log(
                "[RemotionTranslator] Syntax errors fixed on second attempt",
              );
              finalCode = secondFixed;
            } else {
              console.warn(
                "[RemotionTranslator] Could not fix syntax errors, using fallback",
              );
              finalCode = generateFallbackComposition(
                state.productData?.name || "Product",
                audioUrl,
                audioBpm,
                state.recordings,
              );
            }
          }
        } catch (fixError) {
          console.error(
            "[RemotionTranslator] Error during syntax fix:",
            fixError,
          );
          finalCode = generateFallbackComposition(
            state.productData?.name || "Product",
            audioUrl,
            audioBpm,
            state.recordings,
          );
        }
      }
    }

    console.log(
      "[RemotionTranslator] Final code length:",
      finalCode.length,
      "chars",
    );

    return {
      remotionCode: finalCode,
      currentStep: "complete",
    };
  } catch (error) {
    console.error("[RemotionTranslator] Error:", error);
    return {
      errors: [...state.errors, `Remotion translation failed: ${error}`],
      currentStep: "error",
    };
  }
}
