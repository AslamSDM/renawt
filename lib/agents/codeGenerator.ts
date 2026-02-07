import {
  chatWithKimi,
  CODE_GENERATOR_CONFIG,
} from "./model";
import { loadRemotionSkills, savePromptLog } from "./skills";
import type { VideoGenerationStateType } from "./state";

const CODE_GENERATOR_SYSTEM_PROMPT = `You are a PREMIUM Remotion developer creating polished product demo videos with discrete scenes and smooth transitions.

## VISUAL STYLE: "PREMIUM DEMO" (Aurora + Glass)
Generate a composition with:
- Discrete scenes using <Sequence> with smooth transitions
- Aurora gradient backgrounds (dark purple/pink and light variants, alternating)
- White glass morphism cards (rgba(255,255,255,0.95), backdrop-blur, rounded)
- Word-by-word blur text reveals (opacity 0→1, blur 10→0, translateY 30→0)
- Gradient accent text (purple #a855f7 → pink #ec4899)
- Scene progress dots at bottom center
- 3D perspective card entries

## CRITICAL RULES (MUST FOLLOW)
1. NEVER use CSS transitions or @keyframes
2. ALL animations use useCurrentFrame() + interpolate() or spring()
3. Use <Sequence> for discrete scenes with smooth entry/exit animations
4. Use AbsoluteFill for full-screen positioning
5. Always clamp: extrapolateRight: "clamp"
6. Export default composition

## AVAILABLE IMPORTS
\`\`\`tsx
import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  Audio,
  Img,
  interpolate,
  spring,
  Easing,
  staticFile,
} from 'remotion';
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const { fontFamily: montserrat } = loadMontserrat("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });
\`\`\`

## CRITICAL: TYPOGRAPHY & FONTS
Use ONLY Montserrat for all text:
- Headlines: Use montserrat variable, fontWeight: 600-700, fontSize: 48-72px, normal case (NOT uppercase)
- Body text: Use montserrat variable, fontWeight: 400-500, fontSize: 24-32px
- NEVER use Bebas Neue, system-ui, or sans-serif
- Line height: 1.2 for headlines, 1.5 for body text

## TEXT ANIMATION PATTERNS

1. WordByWordBlur - Word-by-word blur reveal (PRIMARY pattern):
   Each word: opacity 0→1, blur 10px→0, translateY 30→0 over 15 frames, staggered by 5 frames
   Specific words can have gradient text (purple→pink)

2. GradientAccentText - Purple→pink gradient text with scale entry:
   background: linear-gradient(135deg, #a855f7, #ec4899), WebkitBackgroundClip: 'text'
   Scale from 0.8→1 with spring, opacity 0→1

3. LogoWithGlow - Brand name with blurred gradient glow behind:
   White text + optional gradient suffix + animated glow (scale 0.5→1.5, blur 40px)

## WEBSITE SCREENSHOTS
If screenshots are provided, display them using the Img component:
- Use staticFile() to reference screenshots from the public/screenshots folder
- Animate screenshots with zoom, pan, fade effects using interpolate()
- Wrap in WhiteGlassCard for premium look

## AUDIO INTEGRATION (CRITICAL)
ALWAYS include audio in the composition:
\`\`\`tsx
// Add audio at the root level of your composition
<Audio src={staticFile("audio/audio1.mp3")} volume={1} />
\`\`\`

## BEAT-SYNCED ANIMATIONS
Calculate beat timing from BPM for sync effects:
\`\`\`tsx
const useBeatSync = (bpm: number = 120) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const framesPerBeat = (60 / bpm) * fps;
  const beatProgress = (frame % framesPerBeat) / framesPerBeat;
  const beatNumber = Math.floor(frame / framesPerBeat);
  const isOnBeat = beatProgress < 0.1; // First 10% of beat

  // Pulse effect that peaks at beat start
  const beatPulse = Math.exp(-beatProgress * 4);

  return { beatProgress, beatNumber, isOnBeat, beatPulse, framesPerBeat };
};
\`\`\`

## DEMO-STYLE COMPONENT PATTERNS

### Aurora Background (dark/light variants)
\`\`\`tsx
const AuroraBackground: React.FC<{ variant?: 'dark' | 'light'; fadeIn?: boolean }> = ({ variant = 'dark', fadeIn = false }) => {
  const frame = useCurrentFrame();
  const opacity = fadeIn ? interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }) : 1;

  if (variant === 'light') {
    return (
      <AbsoluteFill style={{
        opacity,
        background: \`
          radial-gradient(ellipse at 30% 30%, rgba(168, 85, 247, 0.2) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 70%, rgba(236, 72, 153, 0.2) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.15) 0%, transparent 60%),
          linear-gradient(135deg, #faf5ff 0%, #fff5f8 50%, #f5f0ff 100%)
        \`,
      }} />
    );
  }
  return (
    <AbsoluteFill style={{
      opacity,
      background: \`
        radial-gradient(ellipse at 20% 20%, rgba(168, 85, 247, 0.3) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(236, 72, 153, 0.3) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(139, 92, 246, 0.2) 0%, transparent 70%),
        #0a0a0f
      \`,
    }} />
  );
};
\`\`\`

### Word-by-Word Blur Reveal
\`\`\`tsx
const WordByWordBlur: React.FC<{ words: string[]; fontSize?: number; fontFamily?: string; fontWeight?: number | string; color?: string; delay?: number; staggerFrames?: number; gradientWordIndices?: number[] }> = ({ words, fontSize = 48, fontFamily = montserrat, fontWeight = 600, color = '#ffffff', delay = 0, staggerFrames = 5, gradientWordIndices = [] }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3em', justifyContent: 'center' }}>
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * staggerFrames);
        const op = interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
        const blur = interpolate(f, [0, 15], [10, 0], { extrapolateRight: 'clamp' });
        const ty = interpolate(f, [0, 15], [30, 0], { extrapolateRight: 'clamp' });
        const isGradient = gradientWordIndices.includes(i);
        return (
          <span key={i} style={{
            fontSize, fontFamily, fontWeight, opacity: op,
            filter: \`blur(\${blur}px)\`, transform: \`translateY(\${ty}px)\`,
            display: 'inline-block',
            ...(isGradient ? { background: 'linear-gradient(135deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color }),
          }}>{word}</span>
        );
      })}
    </div>
  );
};
\`\`\`

### White Glass Card
\`\`\`tsx
const WhiteGlassCard: React.FC<{ children: React.ReactNode; maxWidth?: number; delay?: number; entryAnimation?: 'slide-up' | 'perspective' | 'scale'; padding?: number }> = ({ children, maxWidth = 800, delay = 0, entryAnimation = 'slide-up', padding = 48 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  let transform = '';
  if (entryAnimation === 'perspective') {
    const rx = interpolate(f, [0, 30], [-20, 0], { extrapolateRight: 'clamp' });
    const ty = interpolate(f, [0, 30], [100, 0], { extrapolateRight: 'clamp' });
    transform = \`perspective(1000px) rotateX(\${rx}deg) translateY(\${ty}px)\`;
  } else if (entryAnimation === 'scale') {
    const s = spring({ frame: f, fps, from: 0.8, to: 1, config: { damping: 12, stiffness: 100 } });
    transform = \`scale(\${s})\`;
  } else {
    const ty = interpolate(f, [0, 25], [60, 0], { extrapolateRight: 'clamp' });
    const s = spring({ frame: f, fps, from: 0.95, to: 1, config: { damping: 15, stiffness: 100 } });
    transform = \`translateY(\${ty}px) scale(\${s})\`;
  }
  return (
    <div style={{
      maxWidth, width: '100%',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
      borderRadius: 24, boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
      padding, opacity, transform, transformOrigin: 'center bottom',
    }}>{children}</div>
  );
};
\`\`\`

### Gradient Accent Text
\`\`\`tsx
const GradientAccentText: React.FC<{ text: string; fontSize?: number; delay?: number }> = ({ text, fontSize = 64, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const scale = spring({ frame: f, fps, from: 0.8, to: 1, config: { damping: 15, stiffness: 100 } });
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <span style={{ fontSize, fontFamily: montserrat, fontWeight: 700, display: 'inline-block',
      background: 'linear-gradient(135deg, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      opacity, transform: \`scale(\${scale})\`,
    }}>{text}</span>
  );
};
\`\`\`

### Logo With Glow
\`\`\`tsx
const LogoWithGlow: React.FC<{ brandName: string; fontSize?: number; delay?: number }> = ({ brandName, fontSize = 96, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const textOpacity = interpolate(f, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const textScale = spring({ frame: f, fps, from: 0.8, to: 1, config: { damping: 15, stiffness: 100 } });
  const glowScale = interpolate(f, [0, 40], [0.5, 1.5], { extrapolateRight: 'clamp' });
  const glowOpacity = interpolate(f, [0, 20, 40], [0, 0.6, 0.4], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', width: '120%', height: '200%', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.6), rgba(236, 72, 153, 0.6))', filter: 'blur(40px)', borderRadius: '50%', opacity: glowOpacity, transform: \`scale(\${glowScale})\`, pointerEvents: 'none' }} />
      <span style={{ position: 'relative', zIndex: 1, fontSize, fontFamily: montserrat, fontWeight: 700, color: '#ffffff', opacity: textOpacity, transform: \`scale(\${textScale})\`, display: 'inline-block' }}>{brandName}</span>
    </div>
  );
};
\`\`\`

### Scene Progress Dots
\`\`\`tsx
const SceneProgressDots: React.FC<{ totalScenes: number; sceneBoundaries: number[] }> = ({ totalScenes, sceneBoundaries }) => {
  const frame = useCurrentFrame();
  let currentScene = 0;
  for (let i = sceneBoundaries.length - 1; i >= 0; i--) {
    if (frame >= sceneBoundaries[i]) { currentScene = i; break; }
  }
  return (
    <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 100 }}>
      {Array.from({ length: totalScenes }, (_, i) => (
        <div key={i} style={{ width: i === currentScene ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === currentScene ? '#a855f7' : i < currentScene ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.3)' }} />
      ))}
    </div>
  );
};
\`\`\`

## COMPOSITION STRUCTURE (CRITICAL)
Use <Sequence> for discrete scenes with VARIABLE TIMING:
- Intro (first scene): ~90 frames (3s) — slow, dramatic
- Middle scenes: ~45 frames (1.5s) — fast, punchy
- Feature card scenes: ~60 frames (2s) — slightly longer for readability
- Screenshot scenes: ~75 frames (2.5s) — enough to see the product
- CTA (ALWAYS last scene): ~90 frames (3s) — slow, dramatic close

Snap scene boundaries to beat timing when BPM is provided.

\`\`\`tsx
const ProductVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }}>
      {/* Intro: 3s, slow reveal */}
      <Sequence from={0} durationInFrames={90}>
        <AbsoluteFill>
          <AuroraBackground variant="dark" />
          <LogoWithGlow brandName="Product" fontSize={72} delay={0} />
        </AbsoluteFill>
      </Sequence>
      {/* Middle: 1.5s, fast */}
      <Sequence from={90} durationInFrames={45}>
        <AbsoluteFill>
          <AuroraBackground variant="light" />
          <WordByWordBlur words={["Build", "Something", "Amazing"]} fontSize={64} color="#0a0a0f" delay={0} staggerFrames={4} />
        </AbsoluteFill>
      </Sequence>
      {/* Screenshot: 2.5s */}
      <Sequence from={135} durationInFrames={75}>
        <AbsoluteFill>
          <AuroraBackground variant="light" />
          <WhiteGlassCard entryAnimation="perspective" padding={16}>
            <Img src={staticFile("screenshots/hero.png")} style={{ width: '100%', borderRadius: 12 }} />
          </WhiteGlassCard>
        </AbsoluteFill>
      </Sequence>
      {/* CTA: 3s, slow close - ALWAYS LAST */}
      <Sequence from={210} durationInFrames={90}>
        <AbsoluteFill>
          <AuroraBackground variant="dark" />
          <WordByWordBlur words={["Get", "Started", "Today"]} fontSize={64} color="#ffffff" delay={5} gradientWordIndices={[1, 2]} />
        </AbsoluteFill>
      </Sequence>
      <SceneProgressDots totalScenes={4} sceneBoundaries={[0, 90, 135, 210]} />
    </AbsoluteFill>
  );
};
\`\`\`

## SCREENSHOTS
If screenshots are provided, display them using:
\`\`\`tsx
import { Img, staticFile } from 'remotion';
// For local screenshots:
<Img src={staticFile("screenshots/hero.png")} style={{ width: '100%', borderRadius: 12 }} />
// For R2/remote URLs:
<Img src="https://..." style={{ width: '100%', borderRadius: 12 }} />
\`\`\`
Wrap screenshots in WhiteGlassCard for a premium framed look.

## STYLE REQUIREMENTS
- Background uses AuroraBackground with dark/light alternation per scene
- Text-heavy scenes on dark aurora, card scenes on light aurora
- White glass cards (rgba(255,255,255,0.95)) instead of transparent glass
- Word-by-word blur reveals for all text
- Gradient accent text (purple→pink) for emphasis
- Montserrat ONLY (never Bebas Neue, system-ui, or sans-serif)
- Purple/pink color scheme: #a855f7, #ec4899, dark bg #0a0a0f
- Card text: #111827 (gray-900), #4b5563 (gray-600)
- 3D perspective card entries
- Scene progress dots at bottom center
- LAST SCENE MUST ALWAYS BE A CTA

## OUTPUT
Generate COMPLETE TypeScript/TSX code. No markdown. Single file with export default.`;

const CODE_TEMPLATE = `
// Premium Demo-Style video template
import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
} from 'remotion';
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const { fontFamily: montserrat } = loadMontserrat("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });

// Main composition
const ProductVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }}>
      <Sequence from={0} durationInFrames={120}>
        <AbsoluteFill style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(ellipse at 20% 20%, rgba(168,85,247,0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(236,72,153,0.3) 0%, transparent 50%), #0a0a0f',
        }}>
          <span style={{ fontSize: 72, fontFamily: montserrat, fontWeight: 700, color: '#ffffff' }}>
            Your Product Name
          </span>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

export default ProductVideo;
`;

export async function codeGeneratorNode(
  state: VideoGenerationStateType,
): Promise<Partial<VideoGenerationStateType>> {
  console.log("[CodeGenerator] Starting code generator node...");

  if (!state.videoScript) {
    return {
      errors: ["No video script available for code generation"],
      currentStep: "error",
    };
  }

  try {
    const videoScript = state.videoScript;
    const productData = state.productData;

    // Get audio configuration
    const audioConfig = state.userPreferences.audio;
    const audioUrl = audioConfig?.url || "https://pub-52c4f36ed495483b84403a8cbd2d2ff3.r2.dev/hitslab-product-launch-advertising-commercial-music-301409.mp3";
    const audioBpm = audioConfig?.bpm || videoScript.music?.tempo || 120;

    // Generate correct audio src code based on URL type
    const isR2Audio = audioUrl.startsWith("http");
    const audioSrcCode = isR2Audio
      ? `"${audioUrl}"`
      : `staticFile("${audioUrl.replace(/^\//, '')}")`;

    // Build a prompt emphasizing CONTINUOUS MOTION with no scene cuts
    const userPrompt = `Generate a CONTINUOUS MOTION Remotion composition with NO SCENE CUTS.

## CRITICAL: AUDIO SYNC
You MUST include audio in the composition:
\`\`\`tsx
<Audio src={${audioSrcCode}} volume={1} />
\`\`\`

## CRITICAL: CONTINUOUS FLOW
- ONE continuous shot - no <Sequence> cuts
- Elements FLOW in and out naturally (staggered timing)
- Camera CONTINUOUSLY zooms/pans throughout
- Background CONSTANTLY moves and pulses with beat
- Text warps and breathes with the music
- ALL animations sync to BPM: ${audioBpm}

VIDEO SCRIPT:
${JSON.stringify(videoScript, null, 2)}

PRODUCT INFO:
${productData ? JSON.stringify(productData, null, 2) : "No product data"}

## MANDATORY: USE WEBSITE SCREENSHOTS IN VIDEO
${(() => {
  const screenshots = productData && (productData as any).screenshots;
  if (screenshots && screenshots.length > 0) {
    const heroShot = screenshots.find((s: any) => s.section === "hero") || screenshots[0];
    const isR2 = heroShot.url.startsWith("http");
    const imgSrc = isR2 ? `"${heroShot.url}"` : `staticFile("${heroShot.url.replace(/^\//, '')}")`;
    return `The scraped website screenshots MUST be displayed in the video:
Available screenshots:
${screenshots.map((s: any) => {
  const sIsR2 = s.url.startsWith("http");
  return `- ${s.section}: ${sIsR2 ? `"${s.url}"` : `staticFile("${s.url.replace(/^\//, '')}")`} — ${s.description}`;
}).join('\n')}

USE AT LEAST 1-2 SCREENSHOTS in the video with these patterns:
1. Hero screenshot: Show at start with zoom/pan effects
2. Features screenshot: Display with slide-in animations

Import and use screenshots like this:
\\\`\\\`\\\`tsx
import { Img${!isR2 ? ', staticFile' : ''} } from 'remotion';

<Img
  src={${imgSrc}}
  style={{
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: \\\`scale(\\\${scale})\\\`,
  }}
/>
\\\`\\\`\\\``;
  }
  return `No screenshots are available. Do NOT use <Img> or staticFile("screenshots/...") — the file does not exist and will break the render. Use text-only scenes with AuroraBackground instead.`;
})()}

Apply animations to screenshots (ONLY if screenshots are available):
- zoom: scale from 1 to 1.3 over time
- pan: translateX/Y movements
- fade: opacity transitions
- overlay: combine with text and gradients
- NEVER reference a screenshot file that doesn't exist

AUDIO CONFIG:
- File: ${audioUrl}
- BPM: ${audioBpm}
- Duration: ${audioConfig?.duration || Math.ceil(videoScript.totalDuration / 30)} seconds

## MANDATORY: INCLUDE AUDIO COMPONENT
At the root of your composition, include:
\`\`\`tsx
<Audio src={${audioSrcCode}} volume={1} />
\`\`\`

## MANDATORY: BEAT SYNC HOOK
Include this hook and use it for all beat-synced animations:
\`\`\`tsx
const useBeatSync = (bpm: number = ${audioBpm}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const framesPerBeat = (60 / bpm) * fps;
  const beatProgress = (frame % framesPerBeat) / framesPerBeat;
  const beatNumber = Math.floor(frame / framesPerBeat);
  const isOnBeat = beatProgress < 0.1;
  const beatPulse = Math.exp(-beatProgress * 4);
  return { beatProgress, beatNumber, isOnBeat, beatPulse, framesPerBeat };
};
\`\`\`

## MANDATORY DEMO-STYLE PATTERNS:

### 1. BACKGROUND
- Use AuroraBackground with dark/light variant alternation per scene
- Dark aurora: purple/pink radial gradients over #0a0a0f
- Light aurora: purple/pink radial gradients over linear-gradient(135deg, #faf5ff, #fff5f8, #f5f0ff)
- Even scenes: dark, odd scenes: light

### 2. SCENE STRUCTURE & TIMING
- Use <Sequence> for discrete scenes with smooth transitions
- **Intro (first)**: ~90 frames (3s) — slow, dramatic LogoWithGlow on dark aurora
- **Middle scenes**: ~45 frames (1.5s) — fast, punchy WordByWordBlur text reveals
- **Feature cards**: ~60 frames (2s) — WhiteGlassCard on alternating aurora
- **Screenshot scenes**: ~75 frames (2.5s) — product UI in WhiteGlassCard
- **CTA (ALWAYS last)**: ~90 frames (3s) — slow, dramatic close with WordByWordBlur + GradientAccentText on dark aurora
- Snap scene boundaries to beat timing (framesPerBeat = (60/BPM) * fps)

### 3. CARD STYLE
- White glass cards: background rgba(255,255,255,0.95), backdropFilter blur(24px), borderRadius 24, boxShadow 0 25px 50px rgba(0,0,0,0.25)
- 3D perspective entry: rotateX(-20→0), translateY(100→0) with perspective(1000px)

### 4. TEXT ANIMATIONS
- Word-by-word blur reveals (each word: opacity 0→1, blur 10→0, translateY 30→0, staggered by 5 frames)
- Gradient accent text for emphasis (purple #a855f7 → pink #ec4899)
- LogoWithGlow for brand names

### 5. STYLING
- **COLORS**: Purple #a855f7, Pink #ec4899, Dark #0a0a0f
- Card text: #111827 (gray-900), #4b5563 (gray-600)
- White glass cards instead of transparent glass
- Montserrat only — NO Bebas Neue

### 6. PROGRESS DOTS
- SceneProgressDots at bottom center showing current scene
- Active dot elongated (24px wide), purple; past dots light purple; future dots gray

Total duration: ${videoScript.totalDuration} frames at 30fps

OUTPUT: Complete TypeScript/TSX code ONLY. No markdown. No explanations. Just code.
REMEMBER: Include <Audio src={${audioSrcCode}} /> at the root!`;

    // Load Remotion skills and add to system prompt
    console.log("[CodeGenerator] Loading Remotion skills...");
    const skillsContent = loadRemotionSkills();
    const enhancedSystemPrompt = skillsContent
      ? `${CODE_GENERATOR_SYSTEM_PROMPT}\n\n## REMOTION BEST PRACTICES (FROM OFFICIAL SKILLS)\n${skillsContent}`
      : CODE_GENERATOR_SYSTEM_PROMPT;

    console.log(
      "[CodeGenerator] Skills loaded, enhanced prompt length:",
      enhancedSystemPrompt.length,
    );
    console.log("[CodeGenerator] User prompt length:", userPrompt.length);
    console.log("[CodeGenerator] Calling LLM...");

    // Save prompts to file for debugging
    savePromptLog("codeGenerator", enhancedSystemPrompt, userPrompt);

    let codeText: string;

    // Use Kimi K2.5 for code generation
    console.log("[CodeGenerator] Using Kimi K2.5...");
    const response = await chatWithKimi(
      [
        { role: "system", content: enhancedSystemPrompt },
        { role: "user", content: userPrompt },
      ],
      CODE_GENERATOR_CONFIG,
    );
    codeText = response.content;

    console.log("[CodeGenerator] Raw response length:", codeText.length);
    console.log(
      "[CodeGenerator] Response preview:",
      codeText.substring(0, 500),
    );

    // Clean up the code - remove markdown code blocks if present
    codeText = codeText
      .replace(/^```(?:tsx?|typescript|javascript)?\\n?/gm, "")
      .replace(/```$/gm, "")
      .trim();

    console.log("[CodeGenerator] Cleaned code length:", codeText.length);

    // Validate the code has required elements
    const hasRemotion = codeText.includes("remotion");
    const hasUseCurrentFrame = codeText.includes("useCurrentFrame");
    const hasInterpolate = codeText.includes("interpolate");
    const hasBlurAnimation =
      codeText.includes("blur") && codeText.includes("filter");
    const hasGradient =
      codeText.includes("gradient") || codeText.includes("Gradient");

    console.log("[CodeGenerator] Validation:");
    console.log("  - Has remotion import:", hasRemotion);
    console.log("  - Has useCurrentFrame:", hasUseCurrentFrame);
    console.log("  - Has interpolate:", hasInterpolate);
    console.log("  - Has blur animation:", hasBlurAnimation);
    console.log("  - Has gradient:", hasGradient);

    if (!hasRemotion || !hasUseCurrentFrame) {
      console.error("[CodeGenerator] Generated code missing required imports!");
      console.error("[CodeGenerator] Full code:", codeText.substring(0, 2000));
      throw new Error("Generated code missing required Remotion imports");
    }

    if (!hasInterpolate) {
      console.warn(
        "[CodeGenerator] WARNING: No interpolate found - animations may be missing!",
      );
    }

    console.log("[CodeGenerator] Successfully generated code with animations");

    return {
      remotionCode: codeText,
      currentStep: "complete",
    };
  } catch (error) {
    console.error("[CodeGenerator] Error:", error);
    return {
      errors: [
        `Code generator error: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      currentStep: "error",
    };
  }
}
