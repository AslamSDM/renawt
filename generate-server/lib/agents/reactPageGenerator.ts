/**
 * REACT PAGE GENERATOR AGENT
 *
 * Takes a video script and generates a single-page React component.
 * This is pure React - no Remotion-specific code.
 * The output can be previewed as a static page before conversion to Remotion.
 */

import { chatWithKimi } from "./model";
import type { VideoGenerationStateType } from "./state";
import type { VideoScene } from "../types";

const REACT_PAGE_SYSTEM_PROMPT = `You are a React expert creating TEXT-HEAVY, FAST-PACED animated pages with DISPLAY FONTS and COLOR THEORY.

Convert a video script into a SINGLE React component with CONTINUOUS text animations.

## CRITICAL: DISPLAY FONTS & HUGE TEXT (30-40% of composition)
- Use DISPLAY fonts only: Impact, Bebas Neue, Oswald, Anton, Playfair Display, Montserrat Black, etc.
- NEVER use generic sans-serif fonts
- Text must be MASSIVE - fontSize should be 120px-200px for headlines
- Text should take up 30-40% of the screen width/height
- Bold, condensed, or black font weights preferred

## LIMITED COLOR PALETTE - USE ONLY 2-3 COLORS PER VIDEO:
Pick ONE color scheme and use ONLY those colors throughout the entire video:

Scheme 1 - Gold & Navy (Elegant):
- Background: #0a0a1a (deep navy)
- Primary Text: #fbbf24 (gold)
- Secondary: #ffffff (white)

Scheme 2 - Cyan & Purple (Modern):
- Background: #2e1065 (rich purple)
- Primary Text: #22d3ee (cyan)
- Secondary: #ffffff (white)

Scheme 3 - Pink & Charcoal (Bold):
- Background: #0c0a09 (charcoal)
- Primary Text: #f472b6 (hot pink)
- Secondary: #fbbf24 (gold accent)

Scheme 4 - Blue & Navy (Professional):
- Background: #0f172a (dark navy)
- Primary Text: #60a5fa (bright blue)
- Secondary: #22d3ee (cyan accent)

**CRITICAL**: Choose ONE scheme and ONLY use colors from that scheme. Do NOT mix colors from different schemes!

## CRITICAL: FAST-PACED TEXT (MAX 2 SECONDS PER TEXT)
- Each text element appears for MAX 2 seconds (≈60 frames at 30fps)
- Rapid text sequences - one after another quickly
- Multiple text elements on screen simultaneously
- NO long static text displays

## TEXT ANIMATION REQUIREMENTS - RANDOM EFFECTS:
Mix and match these effects randomly across different text elements:
1. **Typing + Cursor** - Text types with blinking cursor (character by character)
2. **Color Fill Wipe** - Text fills with gradient color from left to right
3. **Typing + Color Fill** - Text types AND simultaneously fills with color
4. **Scale Pop** - Text pops in with scale animation from 0 to 1
5. **Slide In + Fade** - Text slides in from off-screen with fade
6. **Glitch Effect** - Text has RGB split/glitch animation
7. **Stroke Draw** - Text stroke/outline draws around the text

## BACKGROUND MOVING ELEMENTS:
- Floating shapes around text using approved accent colors
- Rotating geometric elements
- Pulsing glows behind text with gradients
- Moving gradients using color theory palette
- Particle-like floating dots
- Animated borders around text containers

## STRUCTURE:
- Break content into MANY short text segments (3-8 words each)
- Each segment has its own RANDOM animation effect
- Layer text with different animation timings
- Background elements continuously moving
- Use color contrast: Dark bg + bright text OR vice versa

RULES:
1. Use ONLY React and inline CSS
2. CSS keyframes for ALL animations
3. FAST timing (1-2 seconds per animation)
4. Maximum text density with HUGE fonts
5. Multiple simultaneous animations
6. Background elements always moving
7. DISPLAY FONTS only - no generic sans-serif
8. Follow color theory for accessibility and aesthetics

OUTPUT FORMAT:
Return complete React component in code block.

Example FAST-PACED TEXT patterns:
\`\`\`tsx
import React from 'react';

const keyframes = \`
  @keyframes typing {
    from { width: 0; }
    to { width: 100%; }
  }
  
  @keyframes blink {
    50% { border-color: transparent; }
  }
  
  @keyframes colorFill {
    0% { background-size: 0% 100%; }
    100% { background-size: 100% 100%; }
  }
  
  @keyframes retype {
    0%, 45% { content: "First Text"; }
    50%, 95% { content: "Second Text"; }
    100% { content: "First Text"; }
  }
  
  @keyframes floatAround {
    0% { transform: translate(0, 0) rotate(0deg); }
    25% { transform: translate(20px, -20px) rotate(90deg); }
    50% { transform: translate(0, -40px) rotate(180deg); }
    75% { transform: translate(-20px, -20px) rotate(270deg); }
    100% { transform: translate(0, 0) rotate(360deg); }
  }
  
  @keyframes pulseGlow {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.2); }
  }
\`;

// Typing effect component
const TypingText = ({ text, delay = 0 }) => (
  <div style={{
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    animation: \`typing 1.5s steps(\${text.length}) \${delay}s forwards, blink 0.5s step-end infinite alternate\`,
    borderRight: '3px solid white',
    width: 0,
  }}>
    {text}
  </div>
);

// Color fill effect
const ColorFillText = ({ text, fromColor, toColor, delay = 0 }) => (
  <span style={{
    background: \`linear-gradient(to right, \${toColor} 50%, \${fromColor} 50%)\`,
    backgroundSize: '0% 100%',
    backgroundPosition: 'left',
    backgroundRepeat: 'no-repeat',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    animation: \`colorFill 1s ease-out \${delay}s forwards\`,
    fontWeight: 'bold',
  }}>
    {text}
  </span>
);

// Retyping effect (text changes)
const RetypingText = ({ texts, interval = 2 }) => (
  <div style={{ position: 'relative', height: '1.2em' }}>
    {texts.map((text, i) => (
      <span
        key={i}
        style={{
          position: 'absolute',
          animation: \`fadeInOut \${interval * texts.length}s \${i * interval}s infinite\`,
          opacity: 0,
        }}
      >
        {text}
      </span>
    ))}
  </div>
);

// Background floating element
const FloatingElement = ({ size, color, duration, delay }) => (
  <div style={{
    position: 'absolute',
    width: size,
    height: size,
    background: color,
    borderRadius: '50%',
    filter: 'blur(20px)',
    animation: \`floatAround \${duration}s ease-in-out \${delay}s infinite, pulseGlow 3s ease-in-out infinite\`,
  }} />
);
\`\`\`

IMPORTANT:
- MAX 2 seconds per text element
- Break long text into multiple short segments
- Use typing, color-fill, and retyping effects
- Background elements always floating/moving
- Layer multiple animations
- Fast, energetic pacing`;

function buildSceneDescription(scene: VideoScene): string {
  const content = scene.content;
  return `
Scene ${scene.id} (${scene.type}):
- Headline: "${content.headline || "N/A"}"
- Subtext: "${content.subtext || "N/A"}"
- Background: ${scene.style.background}
- Animation: Enter=${scene.animation.enter}, Exit=${scene.animation.exit}
- Duration: ${scene.endFrame - scene.startFrame} frames`;
}

export async function reactPageGeneratorNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log("[ReactPageGenerator] Starting React page generation...");

  const script = state.videoScript;
  if (!script) {
    return {
      errors: [
        ...state.errors,
        "No video script available for React page generation",
      ],
      currentStep: "error",
    };
  }

  const sceneDescriptions = script.scenes.map(buildSceneDescription).join("\n");

  // Get product name from first scene or product data
  const productName =
    state.productData?.name || script.scenes[0]?.content.headline || "Product";

  const prompt = `${REACT_PAGE_SYSTEM_PROMPT}

---

Create a TEXT-HEAVY, FAST-PACED React page for this video script:

PRODUCT: ${productName}
STYLE: ${state.userPreferences.style}
TOTAL DURATION: ${script.totalDuration} frames (${Math.round(script.totalDuration / 30)}s)

SCENES:
${sceneDescriptions}

MUSIC MOOD: ${script.music?.mood || "energetic"}

Create a stunning single-page React component with:
1. MAXIMUM text content - break everything into short phrases
2. Each text displayed for 1-2 seconds MAXIMUM
3. Typing, retyping, and color-fill effects on ALL text
4. Background elements continuously floating around text
5. Fast, energetic pacing
6. Multiple text elements appearing simultaneously

Make it look like a high-energy kinetic typography video!`;

  try {
    console.log("[ReactPageGenerator] Calling Kimi K2.5...");
    const response = await chatWithKimi([{ role: "user", content: prompt }], {
      temperature: 0.7,
      maxTokens: 8000,
    });

    // Extract code from response
    const codeMatch = response.content.match(
      /```(?:tsx?|jsx?|javascript)?\s*([\s\S]*?)```/,
    );
    const reactCode = codeMatch ? codeMatch[1].trim() : response.content;

    console.log(
      "[ReactPageGenerator] Generated React page:",
      reactCode.length,
      "chars",
    );

    return {
      reactPageCode: reactCode,
      currentStep: "translating",
    };
  } catch (error) {
    console.error("[ReactPageGenerator] Error:", error);
    return {
      errors: [...state.errors, `React page generation failed: ${error}`],
      currentStep: "error",
    };
  }
}
