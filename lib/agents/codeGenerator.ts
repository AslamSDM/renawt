import {
  chatWithKimi,
  CODE_GENERATOR_CONFIG,
} from "./model";
import { loadRemotionSkills, savePromptLog } from "./skills";
import type { VideoGenerationStateType } from "./state";

const CODE_GENERATOR_SYSTEM_PROMPT = `You are a PREMIUM Remotion developer creating CONTINUOUS MOTION videos with NO SCENE CUTS.

## CRITICAL: CONTINUOUS MOTION PHILOSOPHY
Generate ONE CONTINUOUS composition where:
- NO <Sequence> cuts or hard transitions
- Elements FLOW in and out naturally using interpolate
- Camera CONTINUOUSLY moves (zoom, pan, orbit)
- Background CONSTANTLY morphs and pulses
- Everything MOVES - nothing is static

## CRITICAL RULES (MUST FOLLOW)
1. NEVER use CSS transitions or @keyframes
2. ALL animations use useCurrentFrame() + interpolate() or spring()
3. DO NOT use <Sequence> for scene cuts - use staggered delays instead
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
  Audio,
  Img,
  interpolate,
  spring,
  Easing,
  staticFile,
} from 'remotion';
\`\`\`

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

## CONTINUOUS MOTION PATTERNS

### Continuous Camera Zoom
\`\`\`tsx
const ContinuousZoom: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Continuous zoom throughout video
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.3], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ transform: \`scale(\${scale})\` }}>
      {children}
    </AbsoluteFill>
  );
};
\`\`\`

### Floating Element (enters, drifts, exits)
\`\`\`tsx
const FloatingElement: React.FC<{
  children: React.ReactNode,
  enterFrame: number,
  exitFrame: number,
  direction?: 'left' | 'right'
}> = ({children, enterFrame, exitFrame, direction = 'left'}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  // Enter from side
  const enterProgress = interpolate(frame, [enterFrame, enterFrame + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Exit to opposite side
  const exitProgress = interpolate(frame, [exitFrame, exitFrame + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Continuous drift while visible
  const drift = interpolate(frame, [enterFrame, exitFrame], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const startX = direction === 'left' ? -width : width;
  const endX = direction === 'left' ? width : -width;

  const x = interpolate(enterProgress, [0, 1], [startX, 0]) +
            interpolate(exitProgress, [0, 1], [0, endX]) +
            drift * (direction === 'left' ? 1 : -1);

  const opacity = enterProgress * (1 - exitProgress);

  return (
    <div style={{
      position: 'absolute',
      transform: \`translateX(\${x}px)\`,
      opacity,
    }}>
      {children}
    </div>
  );
};
\`\`\`

### Beat-Synced Background
\`\`\`tsx
const PulsingBackground: React.FC<{colors: string[], bpm?: number}> = ({colors, bpm = 120}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate beat timing
  const framesPerBeat = (60 / bpm) * fps;
  const beatProgress = (frame % framesPerBeat) / framesPerBeat;

  // Pulse on each beat
  const pulse = Math.sin(beatProgress * Math.PI) * 0.15;
  const flicker = Math.random() > 0.95 ? 0.1 : 0; // Random flicker

  // Continuous movement
  const x1 = 30 + Math.sin(frame / 60) * 20;
  const y1 = 40 + Math.cos(frame / 50) * 20;
  const x2 = 70 + Math.sin(frame / 70) * -20;
  const y2 = 60 + Math.cos(frame / 40) * 20;

  return (
    <AbsoluteFill style={{ background: '#050510', overflow: 'hidden' }}>
      {/* Moving gradient blobs */}
      <AbsoluteFill style={{
        background: \`radial-gradient(circle at \${x1}% \${y1}%, \${colors[0]}50, transparent 45%)\`,
        filter: 'blur(80px)',
        transform: \`scale(\${1.3 + pulse})\`,
        opacity: 0.8 + flicker,
      }} />
      <AbsoluteFill style={{
        background: \`radial-gradient(circle at \${x2}% \${y2}%, \${colors[1]}50, transparent 45%)\`,
        filter: 'blur(80px)',
        transform: \`scale(\${1.3 + pulse * 0.5})\`,
        opacity: 0.8,
      }} />
      {/* Grid overlay */}
      <AbsoluteFill style={{
        opacity: 0.1 + pulse * 0.1,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)',
      }} />
    </AbsoluteFill>
  );
};
\`\`\`

### Warping Text
\`\`\`tsx
const WarpingText: React.FC<{text: string, enterFrame: number, exitFrame: number}> = ({text, enterFrame, exitFrame}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const f = Math.max(0, frame - enterFrame);
  const exitF = Math.max(0, frame - exitFrame);

  // Enter animation
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const blur = interpolate(f, [0, 20], [20, 0], { extrapolateRight: 'clamp' });
  const scale = spring({ frame: f, fps, from: 0.8, to: 1, config: { damping: 12 } });

  // Continuous subtle warp
  const warpX = Math.sin(frame / 30) * 2;
  const warpY = Math.cos(frame / 25) * 1;

  // Exit animation
  const exitOpacity = interpolate(exitF, [0, 15], [1, 0], { extrapolateRight: 'clamp' });
  const exitScale = interpolate(exitF, [0, 15], [1, 1.2], { extrapolateRight: 'clamp' });

  return (
    <span style={{
      display: 'inline-block',
      opacity: opacity * exitOpacity,
      filter: \`blur(\${blur}px)\`,
      transform: \`scale(\${scale * exitScale}) translate(\${warpX}px, \${warpY}px)\`,
    }}>
      {text}
    </span>
  );
};
\`\`\`

### Continuous Parallax Layers
\`\`\`tsx
const ParallaxLayer: React.FC<{children: React.ReactNode, speed: number, depth: number}> = ({children, speed, depth}) => {
  const frame = useCurrentFrame();

  // Continuous movement based on depth
  const x = frame * speed * 0.5;
  const y = Math.sin(frame / 100) * 10 * depth;
  const scale = 1 + (depth * 0.1);
  const opacity = 1 - (depth * 0.2);

  return (
    <AbsoluteFill style={{
      transform: \`translate(\${x}px, \${y}px) scale(\${scale})\`,
      opacity,
    }}>
      {children}
    </AbsoluteFill>
  );
};
\`\`\`

### Glowing Glass Card (floats continuously)
\`\`\`tsx
const GlowingCard: React.FC<{children: React.ReactNode, enterFrame: number, exitFrame: number}> = ({children, enterFrame, exitFrame}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const f = Math.max(0, frame - enterFrame);
  const exitF = Math.max(0, frame - exitFrame);

  // Floating bob motion
  const bobY = Math.sin(frame / 20) * 5;
  const bobX = Math.cos(frame / 25) * 3;

  // Enter
  const enterScale = spring({ frame: f, fps, from: 0.9, to: 1, config: { damping: 15 } });
  const enterOpacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // Exit
  const exitOpacity = interpolate(exitF, [0, 20], [1, 0], { extrapolateRight: 'clamp' });
  const exitScale = interpolate(exitF, [0, 20], [1, 0.9], { extrapolateRight: 'clamp' });

  // Pulsing glow
  const glowIntensity = 0.3 + Math.sin(frame / 15) * 0.1;

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(20px)',
      borderRadius: 24,
      border: '1px solid rgba(255, 255, 255, 0.2)',
      padding: 40,
      opacity: enterOpacity * exitOpacity,
      transform: \`scale(\${enterScale * exitScale}) translate(\${bobX}px, \${bobY}px)\`,
      boxShadow: \`0 0 60px rgba(100, 150, 255, \${glowIntensity}), 0 20px 40px rgba(0,0,0,0.3)\`,
    }}>
      {children}
    </div>
  );
};
\`\`\`

## COMPOSITION STRUCTURE (CRITICAL)
Instead of Sequences, use a timeline-based approach:
\`\`\`tsx
const ProductVideo: React.FC = () => {
  const frame = useCurrentFrame();

  // Define content timing (no hard cuts!)
  const content = [
    { text: "Headline", enterFrame: 0, exitFrame: 90 },
    { text: "Feature 1", enterFrame: 60, exitFrame: 150 },
    { text: "Feature 2", enterFrame: 120, exitFrame: 210 },
    { text: "CTA", enterFrame: 180, exitFrame: 300 },
  ];

  return (
    <AbsoluteFill>
      {/* Continuous background */}
      <PulsingBackground colors={['#667eea', '#764ba2']} bpm={120} />

      {/* Continuous camera zoom */}
      <ContinuousZoom>
        {/* Content that flows in and out */}
        {content.map((item, i) => (
          <FloatingElement key={i} enterFrame={item.enterFrame} exitFrame={item.exitFrame}>
            <WarpingText text={item.text} enterFrame={item.enterFrame} exitFrame={item.exitFrame} />
          </FloatingElement>
        ))}
      </ContinuousZoom>
    </AbsoluteFill>
  );
};
\`\`\`

## STYLE REQUIREMENTS
- Background ALWAYS moving (gradients, particles)
- Beat-synced pulses and flickers
- Subtle continuous warping on text
- Glow effects that breathe
- Elements float and drift, never static
- Use brand colors - NEVER plain black/white

## OUTPUT
Generate COMPLETE TypeScript/TSX code. No markdown. Single file with export default.`;

const CODE_TEMPLATE = `
// Premium video template with modern animations
import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  Img,
  interpolate,
  spring,
} from 'remotion';

// Dynamic fluid background component
const DynamicBackground: React.FC<{primary: string, secondary: string}> = ({primary, secondary}) => {
  const frame = useCurrentFrame();
  
  const x1 = Math.sin(frame / 60) * 20 + 30;
  const y1 = Math.cos(frame / 50) * 20 + 40;
  
  const x2 = Math.sin(frame / 70) * -20 + 70;
  const y2 = Math.cos(frame / 40) * 20 + 60;

  return (
    <AbsoluteFill style={{ background: '#050505', overflow: 'hidden' }}>
      <AbsoluteFill style={{
        background: \`radial-gradient(circle at \${x1}% \${y1}%, \${primary}50, transparent 40%)\`,
        filter: 'blur(80px)',
        transform: 'scale(1.5)',
      }} />
      <AbsoluteFill style={{
        background: \`radial-gradient(circle at \${x2}% \${y2}%, \${secondary}50, transparent 40%)\`,
        filter: 'blur(80px)',
        transform: 'scale(1.5)',
      }} />
      <AbsoluteFill style={{
        opacity: 0.15,
        backgroundImage: \`linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)\`,
        backgroundSize: '50px 50px',
        maskImage: 'radial-gradient(circle at center, black 30%, transparent 80%)',
      }} />
    </AbsoluteFill>
  );
};

// Blur-in text animation
const BlurInText: React.FC<{text: string, fontSize?: number, delay?: number}> = ({text, fontSize = 72, delay = 0}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const blur = interpolate(f, [0, 25], [15, 0], { extrapolateRight: 'clamp' });
  const y = interpolate(f, [0, 25], [30, 0], { extrapolateRight: 'clamp' });
  return (
    <span style={{
      fontSize,
      fontWeight: 'bold',
      opacity,
      filter: \`blur(\${blur}px)\`,
      transform: \`translateY(\${y}px)\`,
      display: 'inline-block',
    }}>
      {text}
    </span>
  );
};

// Glassmorphic card
const GlassCard: React.FC<{children: React.ReactNode, delay?: number}> = ({children, delay = 0}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const scale = spring({ frame: f, fps, from: 0.9, to: 1, config: { damping: 15, stiffness: 100 } });
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(20px)',
      borderRadius: 24,
      border: '1px solid rgba(255, 255, 255, 0.15)',
      padding: 40,
      opacity,
      transform: \`scale(\${scale})\`,
    }}>
      {children}
    </div>
  );
};

// Intro scene with blur-in animation
const IntroScene: React.FC<{headline: string, subtext?: string, primary: string, secondary: string}> = ({
  headline, subtext, primary, secondary
}) => {
  const frame = useCurrentFrame();
  const subtextOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' });
  
  return (
    <AbsoluteFill>
      <DynamicBackground primary={primary} secondary={secondary} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: '0 80px' }}>
          <h1 style={{ margin: 0, color: '#ffffff', fontFamily: 'system-ui, sans-serif' }}>
            <BlurInText text={headline} fontSize={84} />
          </h1>
          {subtext && (
            <p style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 32,
              marginTop: 24,
              opacity: subtextOpacity,
              fontFamily: 'system-ui, sans-serif',
            }}>
              {subtext}
            </p>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Main composition
const ProductVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#0f0f1a' }}>
      <Sequence from={0} durationInFrames={120}>
        <IntroScene
          headline="Your Product Name"
          subtext="The future of innovation"
          primary="#667eea"
          secondary="#764ba2"
        />
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
    const audioUrl = audioConfig?.url || "/audio/audio1.mp3";
    const audioBpm = audioConfig?.bpm || videoScript.music?.tempo || 120;

    // Build a prompt emphasizing CONTINUOUS MOTION with no scene cuts
    const userPrompt = `Generate a CONTINUOUS MOTION Remotion composition with NO SCENE CUTS.

## CRITICAL: AUDIO SYNC
You MUST include audio in the composition:
\`\`\`tsx
<Audio src={staticFile("${audioUrl.replace('/audio/', 'audio/')}")} volume={1} />
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

AUDIO CONFIG:
- File: ${audioUrl}
- BPM: ${audioBpm}
- Duration: ${audioConfig?.duration || Math.ceil(videoScript.totalDuration / 30)} seconds

## MANDATORY: INCLUDE AUDIO COMPONENT
At the root of your composition, include:
\`\`\`tsx
<Audio src={staticFile("${audioUrl.replace('/audio/', 'audio/')}")} volume={1} />
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

## MANDATORY CONTINUOUS MOTION PATTERNS:

### 1. BACKGROUND (Beat-Synced)
- Use PulsingBackground with beat-synced flickers
- Use useBeatSync() hook for pulse timing
- Gradient blobs that continuously move
- Grid overlay that pulses on beat
- BPM: ${audioBpm}

### 2. CAMERA
- ContinuousZoom that scales from 1 to 1.3 throughout
- Or continuous pan movement
- Never static camera

### 3. CONTENT FLOW (NOT SCENE CUTS)
- Each content item has enterFrame and exitFrame
- Elements FloatingElement in from sides
- Content overlaps - new enters before old exits
- Use WarpingText for all headlines

### 4. ELEMENT MOTION (Beat-Synced)
- Use beatPulse for scale pulsing on elements
- Everything has subtle continuous motion (bob, drift, warp)
- GlowingCard with pulsing glow synced to beat
- ParallaxLayers for depth (background moves slower)

### 5. BEAT SYNC EFFECTS
- Background pulses on each beat using beatPulse
- Scale pulses: 1 + beatPulse * 0.03
- Glow intensity: 0.3 + beatPulse * 0.2
- Random flickers for energy

### 6. STYLING
- **COLORS**: primary="${productData?.colors?.primary || "#667eea"}", secondary="${productData?.colors?.secondary || "#764ba2"}"
- Glassmorphic floating cards with glow
- Large bold text with warp effects
- Dark backgrounds with neon accents

### 7. TIMING STRUCTURE
Instead of Sequences, define content timeline:
\`\`\`
const timeline = [
  { content: "intro", enterFrame: 0, exitFrame: 90 },
  { content: "feature1", enterFrame: 60, exitFrame: 150 },
  // Overlap for smooth flow
];
\`\`\`

Total duration: ${videoScript.totalDuration} frames at 30fps

OUTPUT: Complete TypeScript/TSX code ONLY. No markdown. No explanations. Just code.
REMEMBER: Include <Audio src={staticFile("${audioUrl.replace('/audio/', 'audio/')}")} /> at the root!`;

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
