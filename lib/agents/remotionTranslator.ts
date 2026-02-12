/**
 * REMOTION TRANSLATOR AGENT
 *
 * Takes a React page component and translates it into Remotion code.
 * This is step 2 of the two-step code generation process.
 *
 * Enhanced with Remotion Best Practices from .agent/skills/remotion/
 */

import { chatWithKimi } from "./model";
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
      <Audio src={staticFile("audio/audio1.mp3")} volume={1} />

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
`;

const REMOTION_TRANSLATOR_SYSTEM_PROMPT = `You are a Remotion expert who converts React components into polished product demo video compositions with the "Premium Demo" style.

${REMOTION_SKILLS}

---

## YOUR TASK

Take a React page component and translate it into a Remotion video with the "Premium Demo" style: aurora gradients, white glass cards, word-by-word blur reveals, gradient accent text, and scene progress dots.

## CRITICAL: DEMO STYLE REQUIREMENTS

1. **MANDATORY FONT - Montserrat ONLY**: Load font using @remotion/google-fonts:
   \`\`\`tsx
   import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
   const { fontFamily: montserrat } = loadMontserrat("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });
   \`\`\`
   - Headlines: montserrat, fontWeight 600-700, fontSize 48-72px, normal case (NOT uppercase)
   - Body: montserrat, fontWeight 400-500, fontSize 24-32px
   - NEVER use Bebas Neue, system-ui, sans-serif, Impact, or other fonts
2. **AURORA BACKGROUNDS**: Use dark/light aurora gradient backgrounds, alternating per scene:
   - Dark: radial-gradient ellipses (purple rgba(168,85,247,0.3), pink rgba(236,72,153,0.3), violet rgba(139,92,246,0.2)) over #0a0a0f
   - Light: Same ellipses at lower opacity over linear-gradient(135deg, #faf5ff, #fff5f8, #f5f0ff)
3. **COLOR PALETTE - Purple/Pink only**:
   - Purple: #a855f7, Pink: #ec4899, Dark BG: #0a0a0f
   - Card text: #111827 (gray-900), #4b5563 (gray-600)
   - White glass cards: rgba(255,255,255,0.95)
4. **TEXT ANIMATIONS**:
   - WordByWordBlur: Word-by-word blur reveal (opacity 0→1, blur 10→0, translateY 30→0, staggered by 5 frames)
   - GradientAccentText: Purple→pink gradient text with scale entry
   - LogoWithGlow: Brand name with blurred gradient glow behind
5. **CARD STYLE**:
   - WhiteGlassCard: background rgba(255,255,255,0.95), backdropFilter blur(24px), borderRadius 24, boxShadow 0 25px 50px rgba(0,0,0,0.25)
   - 3D perspective entry: rotateX(-20→0), translateY(100→0) with perspective(1000px)
6. **SCENE STRUCTURE**: Use <Sequence> for discrete scenes (2-4 seconds each)
7. **SCENE PROGRESS DOTS**: Show active/past/future dots at bottom center

## IMPORTANT TRANSLATION RULES

1. CONVERT EVERY CSS ANIMATION:
   - CSS animation-delay → Sequence from={delay * fps}
   - CSS transition/animation → interpolate() with useCurrentFrame()
   - CSS keyframes → interpolate() with multiple output values
   - transform animations → spring() for bouncy effects

2. REQUIRED IMPORTS:
   \`\`\`tsx
   import React from 'react';
   import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
   \`\`\`

3. STRUCTURE:
   - Main component uses AbsoluteFill as root
   - Use <Sequence> for discrete scenes with smooth entry/exit animations
   - ALWAYS use premountFor on Sequences
   - useCurrentFrame() in each animated component

4. TEXT ANIMATION PATTERNS:
   - WordByWordBlur: Split text into words, each word fades in with blur + translateY, staggered
   - GradientAccentText: Purple→pink gradient text with scale+opacity entry
   - LogoWithGlow: White text + gradient glow behind

5. BACKGROUND ELEMENTS:
   - AuroraBackground: Dark/light variant with purple/pink radial gradients
   - Alternate dark/light per scene

6. OUTPUT FORMAT (CRITICAL):
   - Return complete Remotion composition in a code block
   - Main component MUST be named "VideoComposition"
   - MUST end with: export default VideoComposition;
   - Include SceneProgressDots as persistent overlay

7. STRICTLY FORBIDDEN:
   - NO CSS animations, transitions, or keyframes
   - NO Tailwind animation classes
   - NO setTimeout or setInterval
   - NO Bebas Neue font
   - NO DualRadialGradient, TextureOverlay, or CameraWrapper
   - NO transparent glass cards (use white glass: rgba(255,255,255,0.95))
   - ALL values must be computed from frame
   - NO named exports only - MUST have export default

8. TEMPLATE LITERAL SYNTAX (CRITICAL):
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
export function validateAndFixCode(code: string): { code: string; issues: string[] } {
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
    "filter: `blur(${$1}px)`"
  );

  // Fix 3: Fix broken transform template literals
  fixedCode = fixedCode.replace(
    /transform:\s*`([^`]+)(?!`)\s*,/g,
    "transform: `$1`,"
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
      if (!nextLine.trim().startsWith("`") && line.includes("${") && line.includes("}")) {
        // This line might need a closing backtick
        const lastBraceIndex = line.lastIndexOf("}");
        if (lastBraceIndex > -1 && !line.substring(lastBraceIndex).includes("`")) {
          // Find where to insert the closing backtick
          if (line.trim().endsWith(",") || line.trim().endsWith(";") || line.trim().endsWith(")")) {
            const endChar = line.trim().slice(-1);
            line = line.slice(0, -endChar.length - (line.length - line.trimEnd().length)) + "`" + endChar;
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
    }
  );

  // Fix 6: Ensure all interpolate calls have proper syntax
  fixedCode = fixedCode.replace(
    /interpolate\s*\(\s*([^,]+)\s*,\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]\s*,?\s*(\{[^}]*\})?\s*\)/g,
    (match, frame, inputRange, outputRange, config) => {
      // Validate and clean up interpolate calls
      const cleanConfig = config || "{ extrapolateRight: 'clamp' }";
      return `interpolate(${frame.trim()}, [${inputRange.trim()}], [${outputRange.trim()}], ${cleanConfig})`;
    }
  );

  // Fix 7: Fix common 'blur' appearing after a number without backtick closure
  fixedCode = fixedCode.replace(
    /(\d+)\s*blur/g,
    (match, num) => {
      issues.push("Fixed: Number followed by 'blur' without proper syntax");
      return `${num}}px)\``;
    }
  );

  // Fix 8: Fix broken transform template literals like `translate(${x}px`, ${y}px)`
  // Pattern: `...(${var}px`, ${var}px)` -> `...(${var}px, ${var}px)`
  fixedCode = fixedCode.replace(
    /`([^`]*\$\{[^}]+\}px)`\s*,\s*\$\{([^}]+)\}px\)`/g,
    (match, before, afterVar) => {
      issues.push("Fixed: Broken transform template literal with extra backtick");
      return `\`${before}, \${${afterVar}}px)\``;
    }
  );

  // Fix 9: Fix nested template literals in transform that have broken syntax
  // Pattern: `translate(${x1}px`, ${y1}px)` should be `translate(${x1}px, ${y1}px)`
  fixedCode = fixedCode.replace(
    /transform:\s*`([^`]+)\$\{([^}]+)\}px`\s*,\s*\$\{([^}]+)\}px\)`/g,
    (match, prefix, var1, var2) => {
      issues.push("Fixed: Broken transform syntax with misplaced backtick");
      return `transform: \`${prefix}\${${var1}}px, \${${var2}}px)\``;
    }
  );

  // Fix 10: Fix backtick appearing mid-interpolate call inside template literal
  // Pattern: `translateY(${interpolate(f, [a, b], [c, d]`, { ... })}px)`
  // Should be: `translateY(${interpolate(f, [a, b], [c, d], { ... })}px)`
  fixedCode = fixedCode.replace(
    /\$\{(interpolate\([^}]*?\])`\s*,\s*(\{[^}]*?\})\)/g,
    (match, interpCall, config) => {
      issues.push("Fixed: Backtick inside interpolate call in template literal");
      return `\${${interpCall}, ${config})}`;
    }
  );

  if (issues.length > 0) {
    console.log("[CodeValidator] Fixed issues:", issues);
  }

  return { code: fixedCode, issues };
}

/**
 * Basic TypeScript syntax validation
 */
export function hasBasicSyntaxErrors(code: string): string[] {
  const errors: string[] = [];

  // Check for balanced braces
  const braces = { "{": 0, "[": 0, "(": 0, "<": 0 };
  const closingBraces: Record<string, keyof typeof braces> = { "}": "{", "]": "[", ")": "(", ">": "<" };

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
  if (braces["{"] !== 0) errors.push(`Unbalanced curly braces: ${braces["{"]} extra {`);
  if (braces["["] !== 0) errors.push(`Unbalanced square brackets: ${braces["["]} extra [`);
  if (braces["("] !== 0) errors.push(`Unbalanced parentheses: ${braces["("]} extra (`);

  // Check for unclosed template strings
  if (inTemplateString) errors.push("Unclosed template string");
  if (inString) errors.push("Unclosed string literal");

  return errors;
}

/**
 * Detect if code appears to be truncated
 */
function isCodeTruncated(code: string): boolean {
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
function generateFallbackComposition(productName: string = "Product", audioUrl: string = "audio/audio1.mp3", bpm: number = 120, recordings?: Array<{ id: string; videoUrl: string; duration: number; featureName: string; description: string; mockupFrame?: "browser" | "macbook" | "minimal"; zoomPoints?: Array<{ time: number; x: number; y: number; scale: number; duration: number }>; }>, logoUrl?: string): string {
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

  return `import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Audio,${hasRecordings ? ' Video,' : ''} staticFile } from 'remotion';
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const { fontFamily: montserrat } = loadMontserrat("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });

// DEMO-STYLE COLOR PALETTE
const COLORS = {
  purple: '#a855f7',
  pink: '#ec4899',
  darkBg: '#0a0a0f',
  cardText: '#111827',
  cardSubtext: '#4b5563',
  dark: '#0a0a0f',
};


// AURORA BACKGROUND
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

// WORD BY WORD BLUR REVEAL
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
            opacity: op, filter: "blur(" + blur + "px)", transform: "translateY(" + ty + "px)",
            display: 'inline-block',
            ...(isGradient ? { background: 'linear-gradient(135deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color }),
          }}>{word}</span>
        );
      })}
    </div>
  );
};

// WHITE GLASS CARD with entry animations
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
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(24px)',
      borderRadius: 24,
      boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
      border: '1px solid rgba(255,255,255,0.3)',
    }}>
      {children}
    </div>
  );
};

// GRADIENT ACCENT TEXT (purple -> pink)
const GradientAccentText: React.FC<{ text: string; fontSize?: number; fontWeight?: number; delay?: number }> = ({
  text, fontSize = 56, fontWeight = 700, delay = 0,
}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(f, [0, 15], [0.9, 1], { extrapolateRight: "clamp" });

  return (
    <span style={{
      display: 'inline-block', fontSize, fontFamily: montserrat, fontWeight,
      background: 'linear-gradient(135deg, #a855f7, #ec4899)',
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      opacity, transform: "scale(" + scale + ")",
    }}>
      {text}
    </span>
  );
};

// LOGO WITH GLOW effect
const LogoWithGlow: React.FC<{ brandName: string; accentSuffix?: string; fontSize?: number; delay?: number }> = ({
  brandName, accentSuffix, fontSize = 80, delay = 0,
}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const glowScale = interpolate(f, [0, 30], [0.5, 1.5], { extrapolateRight: "clamp" });

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity }}>
      {/* Glow behind */}
      <div style={{
        position: 'absolute', width: '120%', height: '120%',
        background: 'linear-gradient(135deg, rgba(168,85,247,0.4), rgba(236,72,153,0.4))',
        filter: 'blur(40px)', borderRadius: '50%',
        transform: "scale(" + glowScale + ")", opacity: 0.6,
      }} />
      <span style={{ fontFamily: montserrat, fontWeight: 700, fontSize, color: '#fff', position: 'relative', zIndex: 1 }}>
        {brandName}
      </span>
      {accentSuffix && (
        <span style={{
          fontFamily: montserrat, fontWeight: 700, fontSize, position: 'relative', zIndex: 1, marginLeft: 12,
          background: 'linear-gradient(135deg, #a855f7, #ec4899)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          {accentSuffix}
        </span>
      )}
    </div>
  );
};

// SCENE PROGRESS DOTS
const SceneProgressDots: React.FC<{ totalScenes: number; sceneBoundaries: number[] }> = ({
  totalScenes, sceneBoundaries,
}) => {
  const frame = useCurrentFrame();
  let currentScene = 0;
  for (let i = 0; i < sceneBoundaries.length; i++) {
    if (frame >= sceneBoundaries[i]) currentScene = i;
  }

  return (
    <div style={{
      position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: 8, zIndex: 100,
    }}>
      {Array.from({ length: totalScenes }).map((_, i) => (
        <div key={i} style={{
          height: 8, borderRadius: 4,
          width: i === currentScene ? 24 : 8,
          background: i === currentScene ? COLORS.purple : i < currentScene ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.3)',
          transition: 'width 0.3s, background 0.3s',
        }} />
      ))}
    </div>
  );
};


// SCENE 1: Logo intro on dark aurora
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const entryProgress = interpolate(frame, [0, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const entryScale = interpolate(frame, [0, 30], [0.7, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const entryOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  
  return (
    <AbsoluteFill>
      <AuroraBackground variant="dark" />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        ${logoUrl ? `
        {/* Logo Image - Large and centered on background */}
        <div style={{ 
          transform: \`scale(\${entryScale})\`,
          opacity: entryOpacity,
          filter: 'drop-shadow(0 0 60px rgba(168, 85, 247, 0.6))'
        }}>
          <Img src={${logoUrl}} style={{ width: 500, height: 'auto', maxHeight: 300, objectFit: 'contain' }} />
        </div>` : `<LogoWithGlow brandName="${productName}" fontSize={120} delay={5} />`}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// SCENE 2: Tagline on light aurora
const Scene2: React.FC = () => {
  return (
    <AbsoluteFill>
      <AuroraBackground variant="light" />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
        <WordByWordBlur
          words={["The", "Future", "of", "Innovation"]}
          fontSize={64} color={COLORS.dark}
          delay={5} staggerFrames={5}
          gradientWordIndices={[1, 3]}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// SCENE 3: Feature card on dark aurora
const Scene3: React.FC = () => {
  return (
    <AbsoluteFill>
      <AuroraBackground variant="dark" />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <WhiteGlassCard delay={5} entryAnimation="perspective" maxWidth={700}>
          <GradientAccentText text="Powerful Features" fontSize={48} delay={10} />
          <p style={{ fontFamily: montserrat, fontWeight: 400, fontSize: 28, color: '#4b5563', marginTop: 16, lineHeight: 1.5 }}>
            Built for performance, designed for simplicity.
          </p>
        </WhiteGlassCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// SCENE 4: Value prop text on light aurora
const Scene4: React.FC = () => {
  return (
    <AbsoluteFill>
      <AuroraBackground variant="light" />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
        <WordByWordBlur
          words={["Build", "Something", "Amazing"]}
          fontSize={72} color={COLORS.dark}
          delay={5} staggerFrames={6}
          gradientWordIndices={[2]}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// SCENE 5: Feature card on dark aurora
const Scene5: React.FC = () => {
  return (
    <AbsoluteFill>
      <AuroraBackground variant="dark" />
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <WhiteGlassCard delay={5} entryAnimation="slide-up" maxWidth={700}>
          <GradientAccentText text="Seamless Experience" fontSize={48} delay={10} />
          <p style={{ fontFamily: montserrat, fontWeight: 400, fontSize: 28, color: '#4b5563', marginTop: 16, lineHeight: 1.5 }}>
            Every detail crafted with care.
          </p>
        </WhiteGlassCard>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// SCENE 6: CTA on dark aurora
const Scene6: React.FC = () => {
  return (
    <AbsoluteFill>
      <AuroraBackground variant="dark" />
      <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <WordByWordBlur
          words={["Get", "Started", "Today"]}
          fontSize={72} color="#ffffff"
          delay={5} staggerFrames={6}
          gradientWordIndices={[1, 2]}
        />
        <GradientAccentText text="${productName}" fontSize={56} delay={25} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

${hasRecordings ? recordings!.map((rec, i) => {
  const isR2 = rec.videoUrl.startsWith("http");
  const videoSrc = isR2 ? `"${rec.videoUrl}"` : `staticFile("${rec.videoUrl.replace(/^\//, "")}")`;
  
  // Generate zoom points interpolation if available
  const zoomPoints = rec.zoomPoints || [];
  let zoomCode = '';
  if (zoomPoints.length > 0) {
    const zoomInputFrames = [0];
    const zoomScaleValues = [1];
    const zoomXValues = [0];
    const zoomYValues = [0];
    
    for (const zp of zoomPoints) {
      const startFrame = Math.round(zp.time * 30);
      const endFrame = Math.round((zp.time + zp.duration) * 30);
      
      zoomInputFrames.push(startFrame);
      zoomScaleValues.push(1);
      zoomXValues.push(0);
      zoomYValues.push(0);
      
      zoomInputFrames.push(startFrame + 15);
      zoomScaleValues.push(zp.scale);
      zoomXValues.push(-(zp.x - 0.5) * 100 * (zp.scale - 1));
      zoomYValues.push(-(zp.y - 0.5) * 100 * (zp.scale - 1));
      
      zoomInputFrames.push(endFrame - 15);
      zoomScaleValues.push(zp.scale);
      zoomXValues.push(-(zp.x - 0.5) * 100 * (zp.scale - 1));
      zoomYValues.push(-(zp.y - 0.5) * 100 * (zp.scale - 1));
      
      zoomInputFrames.push(endFrame);
      zoomScaleValues.push(1);
      zoomXValues.push(0);
      zoomYValues.push(0);
    }
    
    zoomCode = `
  // Zoom interpolation based on zoom points
  const zoomScale = interpolate(frame, ${JSON.stringify(zoomInputFrames)}, ${JSON.stringify(zoomScaleValues)}, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const zoomX = interpolate(frame, ${JSON.stringify(zoomInputFrames)}, ${JSON.stringify(zoomXValues)}, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const zoomY = interpolate(frame, ${JSON.stringify(zoomInputFrames)}, ${JSON.stringify(zoomYValues)}, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });`;
  }
  
  // Choose mockup frame style
  const mockupFrame = rec.mockupFrame || 'minimal';
  let mockupCode = '';
  
  if (mockupFrame === 'browser') {
    mockupCode = `
      {/* Browser Mockup Frame */}
      <div style={{ 
        width: '90%', 
        maxWidth: 1200, 
        borderRadius: 12, 
        overflow: 'hidden', 
        boxShadow: '0 25px 80px rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.1)',
        background: '#1e1e1e'
      }}>
        {/* Browser Header */}
        <div style={{ 
          background: '#2d2d2d', 
          padding: '12px 16px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
          </div>
          <div style={{ flex: 1, marginLeft: 12 }}>
            <div style={{ 
              background: '#1e1e1e', 
              borderRadius: 6, 
              padding: '6px 12px', 
              fontSize: 12, 
              color: '#888', 
              fontFamily: montserrat 
            }}>
              app.example.com
            </div>
          </div>
        </div>
        {/* Video Content */}
        <div style={{ position: 'relative', aspectRatio: '16/10', overflow: 'hidden' }}>
          <Video 
            src=${videoSrc} 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              transform: \`scale(\${zoomScale}) translate(\${zoomX}%, \${zoomY}%)\`
            }} 
          />
        </div>
      </div>`;
  } else if (mockupFrame === 'macbook') {
    mockupCode = `
      {/* MacBook Mockup Frame */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        transform: 'perspective(1000px) rotateX(5deg)',
        transformStyle: 'preserve-3d'
      }}>
        {/* Screen */}
        <div style={{ 
          width: 800, 
          border: '2px solid #333', 
          borderRadius: '12px 12px 0 0', 
          overflow: 'hidden', 
          background: '#1a1a1a',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.5)'
        }}>
          <div style={{ 
            background: '#2d2d2d', 
            padding: '8px 0', 
            display: 'flex', 
            justifyContent: 'center' 
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#555' }} />
          </div>
          <div style={{ aspectRatio: '16/10', overflow: 'hidden' }}>
            <Video 
              src=${videoSrc} 
              style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                transform: \`scale(\${zoomScale}) translate(\${zoomX}%, \${zoomY}%)\`
              }} 
            />
          </div>
        </div>
        {/* MacBook Base */}
        <div style={{ 
          width: '110%', 
          height: 14, 
          background: 'linear-gradient(180deg, #555 0%, #333 100%)', 
          borderRadius: '0 0 8px 8px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        }} />
      </div>`;
  } else {
    // Minimal mockup
    mockupCode = `
      {/* Minimal Mockup Frame */}
      <div style={{ 
        width: '85%', 
        maxWidth: 1100,
        borderRadius: 16, 
        overflow: 'hidden', 
        boxShadow: '0 25px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
        transform: \`perspective(1200px) rotateX(2deg) rotateY(-1deg)\`,
        transformStyle: 'preserve-3d'
      }}>
        <div style={{ position: 'relative', aspectRatio: '16/9' }}>
          <Video 
            src=${videoSrc} 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              transform: \`scale(\${zoomScale}) translate(\${zoomX}%, \${zoomY}%)\`
            }} 
          />
        </div>
      </div>`;
  }
  
  return `
// RECORDING SCENE ${i + 1}: ${rec.featureName}
const RecordingScene${i + 1}: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  ${zoomCode}
  
  // Entry animation
  const entryProgress = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const entryScale = interpolate(frame, [0, 20], [0.85, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const entryOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  
  // Label animation
  const labelOpacity = interpolate(frame, [0, 30, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  
  return (
    <AbsoluteFill style={{ 
      backgroundColor: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      perspective: '1200px'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: 800,
        height: 400,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
        filter: 'blur(60px)',
        opacity: 0.5
      }} />
      
      {/* Recording Container with 3D effect */}
      <div style={{
        transform: \`scale(\${entryScale})\`,
        opacity: entryOpacity,
        transition: 'none'
      }}>
        ${mockupCode}
      </div>
      
      {/* Feature Label */}
      <div style={{ 
        position: 'absolute', 
        bottom: 60, 
        left: 0, 
        right: 0, 
        display: 'flex', 
        justifyContent: 'center', 
        opacity: labelOpacity, 
        zIndex: 10 
      }}>
        <div style={{ 
          background: 'rgba(0,0,0,0.7)', 
          backdropFilter: 'blur(12px)', 
          borderRadius: 12, 
          padding: '12px 28px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            background: 'linear-gradient(135deg, #a855f7, #ec4899)' 
          }} />
          <span style={{ 
            fontFamily: montserrat, 
            fontWeight: 600, 
            fontSize: 20, 
            color: '#ffffff' 
          }}>${rec.featureName}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};`;
}).join('\n') : ''}

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
  const { beatPulse } = useBeatSync(${bpm});
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
${hasRecordings ? recordings!.map((rec, i) => {
  const recFrames = Math.round(rec.duration * 30);
  return `  const rec${i + 1}Start = nextStart;
  const rec${i + 1}Frames = ${recFrames};
  nextStart = rec${i + 1}Start + rec${i + 1}Frames;`;
}).join('\n') : ''}
  const s6Start = nextStart;

  const sceneBoundaries = [s1Start, s2Start, s3Start, s4Start, s5Start, ${hasRecordings ? recordings!.map((_, i) => `rec${i + 1}Start`).join(', ') + ', ' : ''}s6Start];
  const totalScenes = ${6 + (hasRecordings ? recordings!.length : 0)};

  return (
    <AbsoluteFill>
      <Audio src={${audioSrcCode}} volume={1} />

      {/* Scene 1: Logo intro */}
      <Sequence from={s1Start} durationInFrames={introFrames}>
        <Scene1 />
      </Sequence>

      {/* Scene 2: Tagline — fast */}
      <Sequence from={s2Start} durationInFrames={fastFrames}>
        <Scene2 />
      </Sequence>

      {/* Scene 3: Feature card */}
      <Sequence from={s3Start} durationInFrames={cardFrames}>
        <Scene3 />
      </Sequence>

      {/* Scene 4: Value prop — fast */}
      <Sequence from={s4Start} durationInFrames={fastFrames}>
        <Scene4 />
      </Sequence>

      {/* Scene 5: Feature card */}
      <Sequence from={s5Start} durationInFrames={cardFrames}>
        <Scene5 />
      </Sequence>

${hasRecordings ? recordings!.map((rec, i) => `      {/* Recording: ${rec.featureName} */}
      <Sequence from={rec${i + 1}Start} durationInFrames={rec${i + 1}Frames}>
        <RecordingScene${i + 1} />
      </Sequence>
`).join('\n') : ''}
      {/* Scene 6: CTA */}
      <Sequence from={s6Start} durationInFrames={ctaFrames}>
        <Scene6 />
      </Sequence>

      {/* Progress dots overlay */}
      <SceneProgressDots totalScenes={totalScenes} sceneBoundaries={sceneBoundaries} />
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

  // Get audio configuration for the prompt
  const rawAudioUrl = state.userPreferences?.audio?.url || "audio/audio1.mp3";
  const isR2Audio = rawAudioUrl.startsWith("http");
  const audioSrcCode = isR2Audio ? `"${rawAudioUrl}"` : `staticFile("${rawAudioUrl.replace(/^\//, '')}")`;
  const audioImportCode = isR2Audio ? "{ Audio }" : "{ Audio, staticFile }";

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

## TEMPLATE STYLE: ${state.userPreferences.templateStyle || "aurora"}

## REQUIREMENTS - ADAPT TO TEMPLATE STYLE

${state.userPreferences.templateStyle === "blue-clean" ? `**BLUE-CLEAN TEMPLATE SPECIFICATIONS:**
1. **BACKGROUNDS**: Clean white (#ffffff) backgrounds throughout
   - Light scenes: White bg with subtle gray borders
   - Use soft shadows instead of glows
2. **COLOR PALETTE**: Blue #3b82f6, Dark gray #111827, Light gray #4b5563, White #ffffff
3. **UI MOCKUPS**: Floating card components with:
   - White backgrounds
   - Gray borders (1px solid #e5e7eb)
   - Soft shadows (0 10px 40px rgba(0,0,0,0.1))
   - Rounded corners (12px border-radius)
   - Mock menu items, chat interfaces, ticket lists
4. **TEXT ANIMATIONS**: Typewriter effect with cursor blink
5. **FONT**: Inter (400-700 weights)
6. **PROGRESS**: Progress indicator dots at bottom (blue for active)` : state.userPreferences.templateStyle === "floating-glass" ? `**FLOATING-GLASS TEMPLATE SPECIFICATIONS:**
1. **BACKGROUNDS**: Dark gradient backgrounds
   - Deep navy/black with purple/violet accents
   - Radial gradient glows
2. **COLOR PALETTE**: Purple #8b5cf6, Violet #a78bfa, Dark #0a0a0f
3. **UI MOCKUPS**: Glass morphism cards with:
   - Semi-transparent backgrounds (rgba(255,255,255,0.1))
   - Backdrop blur effects
   - Subtle borders (rgba(255,255,255,0.1))
   - Stronger shadows
4. **TEXT ANIMATIONS**: Typewriter effect with cursor
5. **FONT**: Inter (400-700 weights)
6. **PROGRESS**: Progress rings and checkmarks` : `**AURORA TEMPLATE SPECIFICATIONS (DEFAULT):**
1. **BACKGROUNDS**: Aurora gradient backgrounds
   - Dark aurora: logo scenes, CTA scenes, card scenes (purples/pinks on dark)
   - Light aurora: text reveal scenes, tagline scenes, screenshot scenes
2. **COLOR PALETTE**: Purple #a855f7, Pink #ec4899, Dark #0a0a0f
3. **UI CARDS**: White glass morphism cards
   - White backgrounds with blur
   - Purple/pink glows
   - 3D perspective entries
4. **TEXT ANIMATIONS**: WordByWordBlur for headlines, GradientAccentText for accents
5. **FONT**: Montserrat (400-800 weights)
6. **PROGRESS**: SceneProgressDots overlay at root level`}

**COMMON REQUIREMENTS FOR ALL TEMPLATES:**
1. **VARIABLE SCENE TIMING**:
   - Intro (first): ~90 frames (3s) — slow, dramatic
   - Middle scenes: ~45 frames (1.5s) — fast, punchy
   - Feature cards: ~60 frames (2s) — readable
   - Screenshots: ~75 frames (2.5s) — see the product
   - CTA (ALWAYS last): ~90 frames (3s) — slow, dramatic close
2. **DISCRETE SCENES**: Use separate Sequence components with smooth entry animations
3. **CTA**: The LAST scene MUST always be a call-to-action
4. Convert ALL CSS animations to interpolate() or spring()
11. CRITICAL: Include Audio component at root level with THIS EXACT audio:
    \`\`\`tsx
    import ${audioImportCode} from 'remotion';
    // Inside VideoComposition:
    <Audio src=${audioSrcCode} volume={1} />
    \`\`\`

## MANDATORY: USE WEBSITE SCREENSHOT
The website screenshot MUST be displayed in the video:
${(() => {
  const screenshots = (state.productData as any)?.screenshots || [];
  const heroShot = screenshots.find((s: any) => s.section === "hero");
  const primaryShot = heroShot || screenshots[0];
  if (primaryShot) {
    const isR2 = primaryShot.url.startsWith("http");
    const imgSrc = isR2 ? `"${primaryShot.url}"` : `staticFile("${primaryShot.url.replace(/^\//, '')}")`;
    return `- Available screenshots:
${screenshots.map((s: any) => {
  const sIsR2 = s.url.startsWith("http");
  return `  - ${s.section}: ${sIsR2 ? `"${s.url}"` : `staticFile("${s.url.replace(/^\//, '')}")`} — ${s.description}`;
}).join('\n')}
- Import Img from remotion: import { Img${!isR2 ? ', staticFile' : ''} } from 'remotion';
- Primary screenshot: <Img src={${imgSrc}} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
- Display at least one screenshot in the video with animations (zoom, pan, fade, scale)`;
  }
  return `- No screenshots available — skip Img usage, use text-only scenes instead`;
})()}
- Can be used as background with overlay, or as a featured element
- Apply effects like: scale, blur, opacity changes using interpolate()
- If no screenshot file exists, do NOT use <Img> — use text and gradient backgrounds instead

## LOGO USAGE
${(() => {
  const logos = (state.productData as any)?.logos || [];
  if (logos.length > 0) {
    const bestLogo = logos.sort((a: any, b: any) => b.confidence - a.confidence)[0];
    const isR2 = bestLogo.url.startsWith("http");
    const logoSrc = isR2 ? `"${bestLogo.url}"` : `staticFile("${bestLogo.url.replace(/^\//, '')}")`;
    return `LOGO AVAILABLE — USE IN VIDEO:
- Best logo: ${bestLogo.url} (confidence: ${bestLogo.confidence}, source: ${bestLogo.source})
- Import: import { Img${!isR2 ? ', staticFile' : ''} } from 'remotion';
- Usage: <Img src={${logoSrc}} style={{ width: 120, height: 'auto' }} />
- Display logo prominently in intro scene
- Animate with scale, opacity, or glow effects
- Can be used as brand identifier throughout video`;
  }
  return `NO LOGO EXTRACTED — USE TEXT INSTEAD:
- No logo image available
- Use product name as text in intro scene
- Apply text animations (LogoWithGlow component)`;
})()}

## SCREEN RECORDINGS
${(() => {
  const recordings = state.recordings || [];
  if (recordings.length > 0) {
    return `Screen recordings are available. Include them as Video playback scenes:
${recordings.map((r) => {
  const isR2 = r.videoUrl.startsWith("http");
  const src = isR2 ? `"${r.videoUrl}"` : `staticFile("${r.videoUrl.replace(/^\//, '')}")`;
  return `- "${r.featureName}": <Video src={${src}} /> — ${r.duration}s, ${r.description}`;
}).join('\n')}
- Import Video from remotion: import { Video } from 'remotion';
- Each recording scene should show the video with a feature label overlay
- Duration per recording = recording duration × 30 frames`;
  }
  return `- No recordings available — skip Video usage`;
})()}

Output the complete Remotion composition code with FAST-PACED text animations. MUST include Audio component, text effects, and the website screenshot!`;

  try {
    console.log("[RemotionTranslator] Calling Kimi K2.5...");
    const response = await chatWithKimi([{ role: "user", content: prompt }], {
      temperature: 0.5,
      maxTokens: 16000, // Increased to prevent truncation
    });

    // Extract code from response using regex for code blocks
    // Use RegExp constructor with proper escaping for backticks
    const backtick = String.fromCharCode(96);
    const codeBlockPattern = new RegExp(backtick + backtick + backtick + "(?:tsx?|jsx?|javascript)?\\s*([\\s\\S]*?)" + backtick + backtick + backtick);
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
        const componentMatch = remotionCode.match(/(?:const|function)\s+([A-Z][a-zA-Z0-9]*)/);
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

    // Get audio URL and BPM from preferences
    const rawAudioUrl = state.userPreferences?.audio?.url || "audio/audio1.mp3";
    // For local paths, strip leading slash for staticFile usage
    const audioUrl = rawAudioUrl.startsWith("http") ? rawAudioUrl : rawAudioUrl.replace(/^\//, '');
    const audioBpm = state.userPreferences?.audio?.bpm || state.videoScript?.music?.tempo || 120;

    console.log(`[RemotionTranslator] Using audio: ${audioUrl} (BPM: ${audioBpm})`);
    
    // Get best logo URL if available
    const logos = (state.productData as any)?.logos || [];
    const bestLogo = logos.length > 0 ? logos.sort((a: any, b: any) => b.confidence - a.confidence)[0] : null;
    const logoUrl = bestLogo ? (bestLogo.url.startsWith("http") ? `"${bestLogo.url}"` : `staticFile("${bestLogo.url.replace(/^\//, '')}")`) : undefined;

    // Check for truncation first
    if (isCodeTruncated(remotionCode)) {
      console.warn("[RemotionTranslator] Code appears truncated! Using fallback...");
      const productName = state.productData?.name || "Product";
      remotionCode = generateFallbackComposition(productName, audioUrl, audioBpm, state.recordings, logoUrl);
      console.log("[RemotionTranslator] Using fallback composition");
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
      console.warn("[RemotionTranslator] Remaining syntax issues:", syntaxErrors);
      // If there are severe syntax errors, ask LLM to fix them
      if (syntaxErrors.some(e => e.includes("Unclosed") || e.includes("Unbalanced"))) {
        console.log("[RemotionTranslator] Asking LLM to fix syntax errors...");
        
        // Escape backticks in the code to prevent breaking the template literal
        const backtickChar = String.fromCharCode(96);
        const escapedCode = validatedCode.replace(new RegExp(backtickChar, "g"), "\\\\" + backtickChar);
        
        // Build prompt using string concatenation to avoid backtick issues
        const fixPrompt = "You are a TypeScript/React expert. Fix the syntax errors in this Remotion code.\n\n" +
          "## SYNTAX ERRORS TO FIX:\n" +
          syntaxErrors.map(e => "- " + e).join("\n") +
          "\n\n## CURRENT CODE (with errors):\n" +
          backtickChar + backtickChar + backtickChar + "tsx\n" +
          escapedCode + "\n" +
          backtickChar + backtickChar + backtickChar + "\n\n" +
          "## REQUIREMENTS:\n" +
          "1. Fix ALL syntax errors listed above\n" +
          "2. Ensure all braces {}, brackets [], and parentheses () are balanced\n" +
          "3. Ensure all template literals are properly closed\n" +
          "4. Ensure all strings are properly closed\n" +
          "5. Keep the functionality and logic exactly the same\n" +
          "6. Return ONLY the fixed code in a code block\n" +
          "7. MUST end with: export default VideoComposition;";

        try {
          const fixResponse = await chatWithKimi([{ role: "user", content: fixPrompt }], {
            temperature: 0.3,
            maxTokens: 16000,
          });
          
          const fixedCodeBlockPattern = new RegExp(backtickChar + backtickChar + backtickChar + "(?:tsx?|jsx?|javascript)?\\s*([\\s\\S]*?)" + backtickChar + backtickChar + backtickChar);
          const fixedCodeMatch = fixResponse.content.match(fixedCodeBlockPattern);
          const fixedCode = fixedCodeMatch ? fixedCodeMatch[1].trim() : fixResponse.content;
          
          // Validate the fixed code - must be non-trivial (at least 100 chars)
          const remainingErrors = hasBasicSyntaxErrors(fixedCode);
          if (fixedCode.length < 100) {
            console.warn("[RemotionTranslator] Fix returned empty/trivial code, using fallback");
            finalCode = generateFallbackComposition(state.productData?.name || "Product", audioUrl, audioBpm, state.recordings, logoUrl);
          } else if (remainingErrors.length === 0) {
            console.log("[RemotionTranslator] Syntax errors fixed successfully");
            finalCode = fixedCode;
          } else {
            console.warn("[RemotionTranslator] Fix attempt failed, remaining errors:", remainingErrors);
            // Try one more time with more specific instructions
            const secondFixPrompt = "Fix these specific syntax errors in the Remotion code:\n\n" +
              "ERRORS: " + remainingErrors.join(', ') + "\n\n" +
              "CODE:\n" +
              backtickChar + backtickChar + backtickChar + "tsx\n" +
              fixedCode + "\n" +
              backtickChar + backtickChar + backtickChar + "\n\n" +
              "Return ONLY valid TypeScript/React code with ALL errors fixed. Ensure perfect syntax.";
            
            const secondResponse = await chatWithKimi([{ role: "user", content: secondFixPrompt }], {
              temperature: 0.2,
              maxTokens: 16000,
            });
            
            const secondFixedBlockPattern = new RegExp(backtickChar + backtickChar + backtickChar + "(?:tsx?|jsx?|javascript)?\\s*([\\s\\S]*?)" + backtickChar + backtickChar + backtickChar);
            const secondFixedMatch = secondResponse.content.match(secondFixedBlockPattern);
            const secondFixed = secondFixedMatch ? secondFixedMatch[1].trim() : secondResponse.content;
            
            const finalCheck = hasBasicSyntaxErrors(secondFixed);
            if (secondFixed.length < 100) {
              console.warn("[RemotionTranslator] Second fix returned empty/trivial code, using fallback");
              finalCode = generateFallbackComposition(state.productData?.name || "Product", audioUrl, audioBpm, state.recordings, logoUrl);
            } else if (finalCheck.length === 0) {
              console.log("[RemotionTranslator] Syntax errors fixed on second attempt");
              finalCode = secondFixed;
            } else {
              console.warn("[RemotionTranslator] Could not fix syntax errors, using fallback");
              finalCode = generateFallbackComposition(state.productData?.name || "Product", audioUrl, audioBpm, state.recordings, logoUrl);
            }
          }
        } catch (fixError) {
          console.error("[RemotionTranslator] Error during syntax fix:", fixError);
          finalCode = generateFallbackComposition(state.productData?.name || "Product", audioUrl, audioBpm, state.recordings, logoUrl);
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
