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

### 5. TEXT ANIMATIONS - FAST PACED WITH EFFECTS

#### TYPING EFFECT (Character by character):
\`\`\`tsx
const TypingText: React.FC<{ text: string; delay?: number; duration?: number }> = ({ 
  text, 
  delay = 0, 
  duration = 1 // 1 second typing
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const charsPerSecond = text.length / duration;
  const f = Math.max(0, frame - delay);
  const charIndex = Math.min(text.length, Math.floor((f / fps) * charsPerSecond));
  const displayText = text.slice(0, charIndex);
  const cursorOpacity = Math.floor(f / 10) % 2; // Blinking cursor
  
  return (
    <span style={{ fontFamily: 'monospace' }}>
      {displayText}
      <span style={{ opacity: cursorOpacity }}>|</span>
    </span>
  );
};
\`\`\`

#### RETYPING EFFECT (Text changes):
\`\`\`tsx
const RetypingText: React.FC<{ 
  texts: string[]; 
  delay?: number;
  displayDuration?: number; // How long each text shows
}> = ({ 
  texts, 
  delay = 0, 
  displayDuration = 1.5 
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  
  const cycleDuration = displayDuration * fps;
  const currentIndex = Math.floor(f / cycleDuration) % texts.length;
  const progressInCycle = (f % cycleDuration) / fps;
  
  const currentText = texts[currentIndex];
  const charsPerSecond = currentText.length / (displayDuration * 0.6);
  const charIndex = Math.min(currentText.length, Math.floor(progressInCycle * charsPerSecond));
  
  // Delete and retype effect
  const isDeleting = progressInCycle > displayDuration * 0.6;
  const deleteProgress = isDeleting 
    ? (progressInCycle - displayDuration * 0.6) / (displayDuration * 0.3)
    : 0;
  const finalCharIndex = isDeleting 
    ? Math.max(0, Math.floor(charIndex * (1 - deleteProgress)))
    : charIndex;
  
  return <span>{currentText.slice(0, finalCharIndex)}</span>;
};
\`\`\`

#### COLOR FILL EFFECT (Gradient wipe):
\`\`\`tsx
const ColorFillText: React.FC<{ 
  text: string; 
  fromColor?: string;
  toColor?: string;
  delay?: number;
  duration?: number;
}> = ({ 
  text, 
  fromColor = "#666", 
  toColor = "#fff",
  delay = 0,
  duration = 1
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const progress = interpolate(f, [0, duration * fps], [0, 100], {
    extrapolateRight: "clamp",
  });
  
  return (
    <span style={{ 
      position: 'relative',
      display: 'inline-block',
    }}>
      {/* Background text (dimmed) */}
      <span style={{ color: fromColor }}>{text}</span>
      {/* Foreground text (color fill) */}
      <span style={{
        position: 'absolute',
        left: 0,
        top: 0,
        color: toColor,
        clipPath: \`inset(0 \${100 - progress}% 0 0)\`,
      }}>
        {text}
      </span>
    </span>
  );
};
\`\`\`

#### WORD-BY-WORD REVEAL:
\`\`\`tsx
const WordReveal: React.FC<{ 
  text: string; 
  delay?: number;
  stagger?: number;
}> = ({ 
  text, 
  delay = 0, 
  stagger = 3 // frames between words
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3em" }}>
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * stagger);
        const opacity = interpolate(f, [0, 8], [0, 1], { extrapolateRight: "clamp" });
        const y = interpolate(f, [0, 8], [20, 0], { extrapolateRight: "clamp" });
        const scale = interpolate(f, [0, 8], [0.5, 1], { extrapolateRight: "clamp" });
        
        return (
          <span key={i} style={{ 
            opacity, 
            transform: \`translateY(\${y}px) scale(\${scale})\`,
            display: "inline-block",
            fontWeight: 'bold',
          }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};
\`\`\`

#### STAGGERED LINES:
\`\`\`tsx
const StaggerLines: React.FC<{ 
  lines: string[]; 
  delay?: number;
  stagger?: number;
}> = ({ 
  lines, 
  delay = 0, 
  stagger = 10 
}) => {
  const frame = useCurrentFrame();
  
  return (
    <div>
      {lines.map((line, i) => {
        const f = Math.max(0, frame - delay - i * stagger);
        const opacity = interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp" });
        const x = interpolate(f, [0, 15], [-50, 0], { extrapolateRight: "clamp" });
        
        return (
          <div key={i} style={{ 
            opacity, 
            transform: \`translateX(\${x}px)\`,
            marginBottom: '0.5em',
          }}>
            {line}
          </div>
        );
      })}
    </div>
  );
};
\`\`\`

### 6. BACKGROUND MOVING ELEMENTS

Floating shapes around text:
\`\`\`tsx
const FloatingShape: React.FC<{
  size: number;
  color: string;
  x: number;
  y: number;
  duration: number;
  delay?: number;
}> = ({ size, color, x, y, duration, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  
  // Circular motion around text
  const angle = (f / (duration * fps)) * Math.PI * 2;
  const orbitRadius = 150;
  const offsetX = Math.cos(angle) * orbitRadius;
  const offsetY = Math.sin(angle) * orbitRadius * 0.5; // Elliptical
  
  const scale = 1 + Math.sin(angle * 2) * 0.2;
  const opacity = 0.3 + Math.sin(angle * 3) * 0.2;
  
  return (
    <div style={{
      position: 'absolute',
      left: x + offsetX,
      top: y + offsetY,
      width: size,
      height: size,
      background: color,
      borderRadius: '50%',
      filter: 'blur(30px)',
      transform: \`scale(\${scale})\`,
      opacity,
    }} />
  );
};
\`\`\`

Animated gradient background:
\`\`\`tsx
const MovingGradientBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const x1 = Math.sin(frame * 0.02) * 100;
  const y1 = Math.cos(frame * 0.02) * 50;
  const x2 = Math.sin(frame * 0.015 + 1) * 100;
  const y2 = Math.cos(frame * 0.015 + 1) * 50;
  
  return (
    <AbsoluteFill style={{ background: '#0a0a0f', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        width: 600,
        height: 600,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
        top: '20%',
        left: '20%',
        transform: \`translate(\${x1}px, \${y1}px)\`,
        filter: 'blur(60px)',
      }} />
      <div style={{
        position: 'absolute',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(236,72,153,0.3) 0%, transparent 70%)',
        bottom: '20%',
        right: '20%',
        transform: \`translate(\${x2}px, \${y2}px)\`,
        filter: 'blur(60px)',
      }} />
    </AbsoluteFill>
  );
};
\`\`\`

Rotating geometric elements:
\`\`\`tsx
const RotatingElement: React.FC<{
  size: number;
  color: string;
  x: number;
  y: number;
  duration: number;
  delay?: number;
}> = ({ size, color, x, y, duration, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  
  const rotation = (f / (duration * fps)) * 360;
  const scale = 1 + Math.sin(f * 0.05) * 0.1;
  
  return (
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      width: size,
      height: size,
      border: \`2px solid \${color}\`,
      transform: \`rotate(\${rotation}deg) scale(\${scale})\`,
      opacity: 0.5,
    }} />
  );
};
\`\`\`

### 7. FAST-PACED STRUCTURE

Create many short sequences (1-2 seconds each):
\`\`\`tsx
const VideoComposition: React.FC = () => {
  const { fps } = useVideoConfig();
  
  return (
    <AbsoluteFill>
      <Audio src={staticFile("audio/audio1.mp3")} volume={1} />
      
      <MovingGradientBackground />
      
      {/* Scene 1: 2 seconds */}
      <Sequence from={0} durationInFrames={2 * fps} premountFor={0.5 * fps}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <WordReveal text="Welcome to the Future" delay={0} />
        </div>
        <FloatingShape size={100} color="rgba(99,102,241,0.5)" x={200} y={200} duration={3} />
      </Sequence>
      
      {/* Scene 2: 2 seconds */}
      <Sequence from={2 * fps} durationInFrames={2 * fps} premountFor={0.5 * fps}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TypingText text="Innovation" duration={1} />
        </div>
      </Sequence>
      
      {/* Scene 3: 2 seconds */}
      <Sequence from={4 * fps} durationInFrames={2 * fps} premountFor={0.5 * fps}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ColorFillText text="Experience" fromColor="#666" toColor="#fff" duration={1} />
        </div>
      </Sequence>
      
      {/* More scenes... */}
    </AbsoluteFill>
  );
};
\`\`\`
`;

const REMOTION_TRANSLATOR_SYSTEM_PROMPT = `You are a Remotion expert who converts React components into FAST-PACED Remotion video compositions.

${REMOTION_SKILLS}

---

## YOUR TASK

Take a React page component and translate it into a FAST-PACED Remotion code with LOTS OF TEXT animations.

## CRITICAL: DISPLAY FONTS, LIMITED COLOR PALETTE (2-3 COLORS) & FAST-PACED REQUIREMENTS

1. **DISPLAY FONTS ONLY**: Use Impact, Bebas Neue, Oswald, Anton, Playfair Display, Montserrat Black - NEVER generic sans-serif
2. **HUGE TEXT SIZE**: fontSize must be 120px-200px, text should take 30-40% of screen composition
3. **STRICT COLOR PALETTE - USE ONLY 2-3 COLORS TOTAL**:
   - Pick ONE scheme and use ONLY those colors throughout the entire video:
   - Scheme 1 (Gold & Navy): Background #0a0a1a, Primary #fbbf24, White #ffffff
   - Scheme 2 (Cyan & Purple): Background #2e1065, Primary #22d3ee, White #ffffff  
   - Scheme 3 (Pink & Charcoal): Background #0c0a09, Primary #f472b6, Gold #fbbf24
   - Scheme 4 (Blue & Navy): Background #0f172a, Primary #60a5fa, Cyan #22d3ee
   - **CRITICAL**: Once you pick a scheme, ONLY use colors from that scheme. No random colors!
4. **MAX 2 SECONDS PER TEXT**: Each text element appears for maximum 60 frames (2 seconds at 30fps)
5. **LOTS OF TEXT**: Break content into MANY short text segments (3-8 words each)
6. **RAPID SEQUENCES**: Use many short Sequence components with quick timing
7. **RANDOM TEXT EFFECTS - Mix and match per element**:
   - TypingText: Character-by-character typing with proper cursor
   - TypingColorFillText: Typing + color fill simultaneously
   - ColorFillText: Gradient wipe color fill only
   - ScalePopText: Scale from 0 to 1 with bounce
   - SlideFadeText: Slide in from off-screen with fade
   - WordReveal: Word-by-word appearance
   - RetypingText: Text that changes/deletes
8. **BACKGROUND MOVEMENT**: Floating shapes with color theory accents, rotating elements, moving gradients
9. **NO STATIC ELEMENTS**: Everything must be animated continuously

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

3. STRUCTURE - FAST PACED:
   - Main component uses AbsoluteFill as root
   - Create MANY Sequence components (max 2 seconds each)
   - Overlap sequences for continuous flow
   - ALWAYS use premountFor on Sequences
   - useCurrentFrame() in each animated component

4. TEXT ANIMATION PATTERNS (USE THESE - Pick randomly per text element):
   - TypingText: Character-by-character typing with blinking cursor
   - TypingColorFillText: Typing + gradient color fill simultaneously  
   - ColorFillText: Gradient wipe color fill from left to right
   - ScalePopText: Scale from 0 to 1 with bouncy easing
   - SlideFadeText: Slide in from left/right/top/bottom with fade
   - WordReveal: Word-by-word appearance with stagger
   - RetypingText: Text that deletes and retypes with new content
   
   IMPORTANT: Use DIFFERENT effects for different text elements in the same scene!

5. BACKGROUND ELEMENTS (USE THESE):
   - FloatingShape: Orbs floating around text
   - MovingGradientBackground: Animated gradient backdrop
   - RotatingElement: Geometric shapes rotating

6. OUTPUT FORMAT (CRITICAL):
   - Return complete Remotion composition in a code block
   - Main component MUST be named "VideoComposition"
   - MUST end with: export default VideoComposition;
   - Create separate components for text effects

7. STRICTLY FORBIDDEN:
   - NO CSS animations
   - NO CSS transitions
   - NO CSS keyframes
   - NO Tailwind animation classes
   - NO setTimeout or setInterval
   - NO text without animation
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
   style={{ filter: \`blur(\${blur}px), transform: \`translateY(\${y}px)\` }}  // Missing closing backtick!
   \`\`\`

   RULES:
   - Every opening backtick \` MUST have a closing backtick \`
   - Template literals inside style objects must be complete before the comma
   - Never split template literals across multiple properties
   - Example: filter: \`blur(\${value}px)\` - note the \` before the comma`;

// ============================================================================
// CODE VALIDATION AND FIXING
// ============================================================================

/**
 * Validates and fixes common syntax errors in LLM-generated code
 */
function validateAndFixCode(code: string): { code: string; issues: string[] } {
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

  if (issues.length > 0) {
    console.log("[CodeValidator] Fixed issues:", issues);
  }

  return { code: fixedCode, issues };
}

/**
 * Basic TypeScript syntax validation
 */
function hasBasicSyntaxErrors(code: string): string[] {
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
function generateFallbackComposition(productName: string = "Product", audioUrl: string = "audio/audio1.mp3"): string {
  return `import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, Audio, staticFile } from 'remotion';

// COLOR THEORY - LIMITED TO 2-3 COLORS PER VIDEO
// Predefined color schemes (each video uses ONE scheme only)
const COLOR_SCHEMES = [
  // Scheme 1: Gold & Navy
  {
    background: '#0a0a1a',
    primary: '#fbbf24',    // Gold
    secondary: '#ffffff',  // White
    accent: '#fbbf24',     // Gold
  },
  // Scheme 2: Cyan & Purple
  {
    background: '#2e1065',
    primary: '#22d3ee',    // Cyan
    secondary: '#ffffff',  // White
    accent: '#a78bfa',     // Light purple
  },
  // Scheme 3: Pink & Charcoal
  {
    background: '#0c0a09',
    primary: '#f472b6',    // Pink
    secondary: '#ffffff',  // White
    accent: '#fbbf24',     // Gold accent
  },
  // Scheme 4: Blue & Deep Navy
  {
    background: '#0f172a',
    primary: '#60a5fa',    // Blue
    secondary: '#ffffff',  // White
    accent: '#22d3ee',     // Cyan accent
  },
];

// Pick ONE color scheme for the entire video (call once at top level)
const VIDEO_COLOR_SCHEME = COLOR_SCHEMES[Math.floor(Math.random() * COLOR_SCHEMES.length)];

// DISPLAY FONTS - Bold, Impactful
const DISPLAY_FONTS = [
  "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
  "'Bebas Neue', sans-serif",
  "Oswald, sans-serif",
  "Anton, sans-serif",
  "'Playfair Display', serif",
  "Montserrat, sans-serif",
];

// Get random display font
const getRandomFont = () => DISPLAY_FONTS[Math.floor(Math.random() * DISPLAY_FONTS.length)];

// Get primary color (consistent throughout video)
const getPrimaryColor = () => VIDEO_COLOR_SCHEME.primary;

// Get secondary color
const getSecondaryColor = () => VIDEO_COLOR_SCHEME.secondary;

// Get accent color for floating shapes
const getAccentColor = () => VIDEO_COLOR_SCHEME.accent;

// TYPING EFFECT - Fixed cursor alignment
const TypingText: React.FC<{ text: string; delay?: number; duration?: number; style?: React.CSSProperties }> = ({ 
  text, delay = 0, duration = 1, style 
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const charsPerSecond = text.length / duration;
  const f = Math.max(0, frame - delay);
  const charIndex = Math.min(text.length, Math.floor((f / fps) * charsPerSecond));
  const cursorOpacity = interpolate(f % 15, [0, 15], [1, 1], { extrapolateRight: "clamp" });
  
  return (
    <div style={{ 
      display: 'inline-flex', 
      alignItems: 'center',
      fontFamily: getRandomFont(),
      fontWeight: 'bold',
      fontSize: 140,
      letterSpacing: '0.02em',
      ...style 
    }}>
      <span>{text.slice(0, charIndex)}</span>
      <span style={{ 
        opacity: cursorOpacity,
        borderRight: '6px solid currentColor',
        height: '1em',
        marginLeft: '4px',
        animation: 'blink 0.5s step-end infinite',
      }} />
    </div>
  );
};

// COLOR FILL EFFECT with Display Font
const ColorFillText: React.FC<{ text: string; fromColor?: string; toColor?: string; delay?: number; duration?: number; style?: React.CSSProperties }> = ({ 
  text, fromColor = "#444", toColor, delay = 0, duration = 1, style 
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const progress = interpolate(f, [0, duration * fps], [0, 100], { extrapolateRight: "clamp" });
  const finalToColor = toColor || getPrimaryColor();
  
  return (
    <span style={{ 
      position: 'relative', 
      display: 'inline-block', 
      fontFamily: getRandomFont(),
      fontWeight: 'bold',
      fontSize: 140,
      letterSpacing: '0.02em',
      ...style 
    }}>
      <span style={{ color: fromColor }}>{text}</span>
      <span style={{
        position: 'absolute',
        left: 0,
        top: 0,
        color: finalToColor,
        clipPath: "inset(0 " + (100 - progress) + "% 0 0)",
      }}>
        {text}
      </span>
    </span>
  );
};

// TYPING + COLOR FILL COMBO EFFECT
const TypingColorFillText: React.FC<{ text: string; delay?: number; duration?: number; style?: React.CSSProperties }> = ({ 
  text, delay = 0, duration = 1.2, style 
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const charsPerSecond = text.length / (duration * 0.7);
  const charIndex = Math.min(text.length, Math.floor((f / fps) * charsPerSecond));
  const fillProgress = interpolate(f, [duration * 0.3 * fps, duration * fps], [0, 100], { extrapolateRight: "clamp" });
  const cursorOpacity = interpolate(f % 15, [0, 15], [1, 1], { extrapolateRight: "clamp" });
  const toColor = getPrimaryColor();
  
  return (
    <div style={{ 
      display: 'inline-flex', 
      alignItems: 'center',
      fontFamily: getRandomFont(),
      fontWeight: 'bold',
      fontSize: 140,
      letterSpacing: '0.02em',
      position: 'relative',
      ...style 
    }}>
      <span style={{ color: '#444' }}>{text.slice(0, charIndex)}</span>
      <span style={{
        position: 'absolute',
        left: 0,
        top: 0,
        color: toColor,
        clipPath: "inset(0 " + (100 - fillProgress) + "% 0 0)",
      }}>
        {text.slice(0, charIndex)}
      </span>
      <span style={{ 
        opacity: cursorOpacity,
        borderRight: '6px solid currentColor',
        height: '1em',
        marginLeft: '4px',
      }} />
    </div>
  );
};

// SCALE POP EFFECT
const ScalePopText: React.FC<{ text: string; delay?: number; style?: React.CSSProperties }> = ({ 
  text, delay = 0, style 
}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const scale = interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.back(1.7)) });
  const opacity = interpolate(f, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  
  return (
    <span style={{ 
      display: 'inline-block',
      fontFamily: getRandomFont(),
      fontWeight: 'bold',
      fontSize: 140,
      color: getPrimaryColor(),
      letterSpacing: '0.02em',
      transform: "scale(" + scale + ")",
      opacity,
      ...style 
    }}>
      {text}
    </span>
  );
};

// SLIDE IN + FADE EFFECT
const SlideFadeText: React.FC<{ text: string; delay?: number; direction?: 'left' | 'right' | 'top' | 'bottom'; style?: React.CSSProperties }> = ({ 
  text, delay = 0, direction = 'left', style 
}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const progress = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const opacity = progress;
  
  let translateX = 0;
  let translateY = 0;
  const distance = 200;
  
  switch(direction) {
    case 'left': translateX = -distance * (1 - progress); break;
    case 'right': translateX = distance * (1 - progress); break;
    case 'top': translateY = -distance * (1 - progress); break;
    case 'bottom': translateY = distance * (1 - progress); break;
  }
  
  return (
    <span style={{ 
      display: 'inline-block',
      fontFamily: getRandomFont(),
      fontWeight: 'bold',
      fontSize: 140,
      color: getPrimaryColor(),
      letterSpacing: '0.02em',
      transform: "translate(" + translateX + "px, " + translateY + "px)",
      opacity,
      ...style 
    }}>
      {text}
    </span>
  );
};

// WORD-BY-WORD REVEAL with Display Font
const WordReveal: React.FC<{ text: string; delay?: number; stagger?: number; style?: React.CSSProperties }> = ({ 
  text, delay = 0, stagger = 3, style 
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");
  const fontFamily = getRandomFont();
  const color = getPrimaryColor();
  
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3em", justifyContent: 'center', ...style }}>
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * stagger);
        const opacity = interpolate(f, [0, 8], [0, 1], { extrapolateRight: "clamp" });
        const y = interpolate(f, [0, 8], [20, 0], { extrapolateRight: "clamp" });
        const scale = interpolate(f, [0, 8], [0.5, 1], { extrapolateRight: "clamp" });
        return (
          <span key={i} style={{ 
            opacity, 
            transform: "translateY(" + y + "px) scale(" + scale + ")",
            display: "inline-block",
            fontFamily,
            fontWeight: 'bold',
            fontSize: 140,
            color,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

// RETYPING EFFECT with Display Font
const RetypingText: React.FC<{ texts: string[]; delay?: number; displayDuration?: number; style?: React.CSSProperties }> = ({ 
  texts, delay = 0, displayDuration = 1.5, style 
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const cycleDuration = displayDuration * fps;
  const currentIndex = Math.floor(f / cycleDuration) % texts.length;
  const progressInCycle = (f % cycleDuration) / fps;
  const currentText = texts[currentIndex];
  const charsPerSecond = currentText.length / (displayDuration * 0.6);
  const charIndex = Math.min(currentText.length, Math.floor(progressInCycle * charsPerSecond));
  const isDeleting = progressInCycle > displayDuration * 0.6;
  const deleteProgress = isDeleting ? (progressInCycle - displayDuration * 0.6) / (displayDuration * 0.3) : 0;
  const finalCharIndex = isDeleting ? Math.max(0, Math.floor(charIndex * (1 - deleteProgress))) : charIndex;
  const cursorOpacity = interpolate(f % 15, [0, 15], [1, 1], { extrapolateRight: "clamp" });
  
  return (
    <div style={{ 
      display: 'inline-flex', 
      alignItems: 'center',
      fontFamily: getRandomFont(),
      fontWeight: 'bold',
      fontSize: 140,
      color: getPrimaryColor(),
      letterSpacing: '0.02em',
      ...style 
    }}>
      <span>{currentText.slice(0, finalCharIndex)}</span>
      <span style={{ 
        opacity: cursorOpacity,
        borderRight: '6px solid currentColor',
        height: '1em',
        marginLeft: '4px',
      }} />
    </div>
  );
};

// BACKGROUND: MOVING GRADIENTS with Consistent Color Scheme
const MovingGradientBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const x1 = Math.sin(frame * 0.02) * 100;
  const y1 = Math.cos(frame * 0.02) * 50;
  const x2 = Math.sin(frame * 0.015 + 1) * 100;
  const y2 = Math.cos(frame * 0.015 + 1) * 50;
  
  // Convert hex to rgba for gradients
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
  };
  
  const primaryRgba = hexToRgba(VIDEO_COLOR_SCHEME.primary, 0.25);
  const accentRgba = hexToRgba(VIDEO_COLOR_SCHEME.accent, 0.2);
  
  return (
    <AbsoluteFill style={{ background: VIDEO_COLOR_SCHEME.background, overflow: 'hidden' }}>
      <div style={{
        position: 'absolute',
        width: 800,
        height: 800,
        borderRadius: '50%',
        background: "radial-gradient(circle, " + primaryRgba + " 0%, transparent 70%)",
        top: '10%',
        left: '10%',
        transform: "translate(" + x1 + "px, " + y1 + "px)",
        filter: 'blur(80px)',
      }} />
      <div style={{
        position: 'absolute',
        width: 700,
        height: 700,
        borderRadius: '50%',
        background: "radial-gradient(circle, " + accentRgba + " 0%, transparent 70%)",
        bottom: '10%',
        right: '10%',
        transform: "translate(" + x2 + "px, " + y2 + "px)",
        filter: 'blur(80px)',
      }} />
    </AbsoluteFill>
  );
};

// FLOATING SHAPE AROUND TEXT with Color Theory
const FloatingShape: React.FC<{ size: number; color?: string; x: number; y: number; duration: number; delay?: number }> = ({ 
  size, color, x, y, duration, delay = 0 
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const angle = (f / (duration * fps)) * Math.PI * 2;
  const orbitRadius = 150;
  const offsetX = Math.cos(angle) * orbitRadius;
  const offsetY = Math.sin(angle) * orbitRadius * 0.5;
  const scale = 1 + Math.sin(angle * 2) * 0.2;
  const opacity = 0.3 + Math.sin(angle * 3) * 0.2;
  
  const shapeColor = color || getAccentColor();
  
  return (
    <div style={{
      position: 'absolute',
      left: x + offsetX,
      top: y + offsetY,
      width: size,
      height: size,
      background: shapeColor,
      borderRadius: '50%',
      filter: 'blur(30px)',
      transform: "scale(" + scale + ")",
      opacity,
    }} />
  );
};

// RANDOM EFFECT SELECTOR - Returns a random text effect component
const getRandomTextEffect = () => {
  const effects = ['typing', 'colorFill', 'typingColorFill', 'scalePop', 'slideFade', 'wordReveal'];
  return effects[Math.floor(Math.random() * effects.length)];
};

// FAST-PACED SCENES with HUGE Display Text (30-40% of composition)
const Scene1: React.FC = () => {
  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <WordReveal 
        text="WELCOME TO ${productName}" 
        delay={0} 
      />
      <FloatingShape size={200} x={100} y={200} duration={3} delay={0} />
      <FloatingShape size={150} x={1500} y={600} duration={2.5} delay={10} />
      <FloatingShape size={100} x={800} y={100} duration={4} delay={5} />
    </AbsoluteFill>
  );
};

const Scene2: React.FC = () => {
  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <TypingColorFillText 
        text="INNOVATE" 
        duration={1}
      />
      <FloatingShape size={180} x={200} y={500} duration={3} delay={5} />
      <FloatingShape size={120} x={1600} y={300} duration={2.8} delay={8} />
    </AbsoluteFill>
  );
};

const Scene3: React.FC = () => {
  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ScalePopText 
        text="CREATE" 
        delay={0}
      />
      <FloatingShape size={160} x={300} y={200} duration={3.5} delay={3} />
      <FloatingShape size={140} x={1400} y={700} duration={2.2} delay={12} />
    </AbsoluteFill>
  );
};

const Scene4: React.FC = () => {
  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <TypingText 
        text="BUILD" 
        duration={0.8}
      />
      <FloatingShape size={190} x={100} y={600} duration={2.5} delay={6} />
      <FloatingShape size={110} x={1700} y={200} duration={3.2} delay={4} />
    </AbsoluteFill>
  );
};

const Scene5: React.FC = () => {
  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <SlideFadeText 
        text="LAUNCH" 
        delay={0}
        direction="left"
      />
      <FloatingShape size={170} x={400} y={150} duration={2.8} delay={2} />
      <FloatingShape size={130} x={1500} y={550} duration={3.5} delay={7} />
    </AbsoluteFill>
  );
};

const Scene6: React.FC = () => {
  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <RetypingText 
        texts={["SCALE", "GROW", "DOMINATE"]}
        displayDuration={1}
      />
      <FloatingShape size={200} x={250} y={650} duration={2.2} delay={0} />
      <FloatingShape size={100} x={1650} y={150} duration={4} delay={10} />
    </AbsoluteFill>
  );
};

const VideoComposition: React.FC = () => {
  const { fps } = useVideoConfig();
  
  return (
    <AbsoluteFill>
      <Audio src={staticFile("${audioUrl}")} volume={1} />
      <MovingGradientBackground />
      
      {/* Scene 1: 2 seconds */}
      <Sequence from={0} durationInFrames={2 * fps} premountFor={0.5 * fps}>
        <Scene1 />
      </Sequence>
      
      {/* Scene 2: 2 seconds */}
      <Sequence from={2 * fps} durationInFrames={2 * fps} premountFor={0.5 * fps}>
        <Scene2 />
      </Sequence>
      
      {/* Scene 3: 2 seconds */}
      <Sequence from={4 * fps} durationInFrames={2 * fps} premountFor={0.5 * fps}>
        <Scene3 />
      </Sequence>
      
      {/* Scene 4: 2 seconds */}
      <Sequence from={6 * fps} durationInFrames={2 * fps} premountFor={0.5 * fps}>
        <Scene4 />
      </Sequence>
      
      {/* Scene 5: 2 seconds */}
      <Sequence from={8 * fps} durationInFrames={2 * fps} premountFor={0.5 * fps}>
        <Scene5 />
      </Sequence>
      
      {/* Scene 6: 2 seconds */}
      <Sequence from={10 * fps} durationInFrames={2 * fps} premountFor={0.5 * fps}>
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

## REQUIREMENTS - FAST PACED TEXT VIDEO
1. **MAX 2 SECONDS PER SCENE**: Each Sequence durationInFrames must be 60 or less (2 seconds at 30fps)
2. **LOTS OF TEXT SEGMENTS**: Break content into many short phrases (3-8 words each)
3. **TEXT EFFECTS ON EVERYTHING**:
   - Use TypingText for headlines
   - Use RetypingText where text changes
   - Use ColorFillText for gradient wipe effect
   - Use WordReveal for word-by-word appearance
   - Use StaggerLines for multiple lines
4. **BACKGROUND MOVEMENT**: Add FloatingShape and MovingGradientBackground components
5. Convert ALL CSS animations to interpolate() or spring()
6. Wrap sections in Sequence components with SHORT timing (max 2 seconds)
7. Use useCurrentFrame() in each animated component
8. Keep the visual design but make it FAST and TEXT-HEAVY
9. Add premountFor to all Sequences
10. CRITICAL: Include Audio component at root level:
   \`\`\`tsx
   import { Audio, staticFile } from 'remotion';
   // Inside VideoComposition:
   <Audio src={staticFile("audio/audio1.mp3")} volume={1} />
   \`\`\`

Output the complete Remotion composition code with FAST-PACED text animations. MUST include Audio component and text effects!`;

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

    // Get audio URL from preferences
    const audioUrl = state.userPreferences?.audio?.url?.replace('/audio/', 'audio/') || "audio/audio1.mp3";

    // Check for truncation first
    if (isCodeTruncated(remotionCode)) {
      console.warn("[RemotionTranslator] Code appears truncated! Using fallback...");
      const productName = state.productData?.name || "Product";
      remotionCode = generateFallbackComposition(productName, audioUrl);
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
          
          // Validate the fixed code
          const remainingErrors = hasBasicSyntaxErrors(fixedCode);
          if (remainingErrors.length === 0) {
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
            if (finalCheck.length === 0) {
              console.log("[RemotionTranslator] Syntax errors fixed on second attempt");
              finalCode = secondFixed;
            } else {
              console.warn("[RemotionTranslator] Could not fix syntax errors, using fallback");
              finalCode = generateFallbackComposition(state.productData?.name || "Product", audioUrl);
            }
          }
        } catch (fixError) {
          console.error("[RemotionTranslator] Error during syntax fix:", fixError);
          finalCode = generateFallbackComposition(state.productData?.name || "Product", audioUrl);
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
