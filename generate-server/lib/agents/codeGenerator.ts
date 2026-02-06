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
import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

// Load fonts at module level
const { fontFamily: bebasNeue } = loadBebasNeue("normal", { weights: ["400"], subsets: ["latin"] });
const { fontFamily: montserrat } = loadMontserrat("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });
\`\`\`

## CRITICAL: TYPOGRAPHY & FONTS
You MUST use Bebas Neue and Montserrat for all text:
- Headlines: Use bebasNeue variable, fontSize: 96-200px, textTransform: "uppercase", letterSpacing: "0.05em"
- Body text: Use montserrat variable, fontWeight: 500-700, fontSize: 24-36px
- NEVER use system fonts like 'system-ui' or 'sans-serif'
- Line height: 1.1 for headlines, 1.5 for body text
- Headlines should be BIG and fill 30-40% of screen

## TEXT ANIMATION REQUIREMENTS
You MUST include these animation components with continuous effects:

1. TypingText - Character-by-character typing with cursor:
   const charsToShow = Math.floor(f / 2);
   const displayText = text.slice(0, charsToShow);
   Show cursor | when not complete

2. BlurInText - Blur + scale animation using spring():
   Use spring({ frame, fps, config: { damping: 15, stiffness: 100 } })
   Scale from 0.8 to 1, blur from 20px to 0

3. WordReveal - Split text by spaces, animate each word:
   words.map((word, i) => animate with delay based on i * 8 frames)
   Use spring for scale effect

4. BodyText - Clean fade-in with translateY

## CRITICAL: WEBSITE SCREENSHOT USAGE
You MUST include website screenshots in the video using the Img component:
- Use staticFile() to reference screenshots from the public/screenshots folder
- Example: <Img src={staticFile("screenshots/hero-screenshot.png")} />
- Animate screenshots with zoom, pan, fade effects using interpolate()
- Show at least 2-3 different screenshot sections (hero, features, pricing, etc.)

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

### Camera Wrapper (Zoom + Pan)
\`\`\`tsx
const CameraWrapper: React.FC<{children: React.ReactNode, zoomRange?: [number, number], panX?: [number, number], panY?: [number, number]}> = ({children, zoomRange = [1, 1.15], panX = [0, 0], panY = [0, 0]}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], zoomRange, { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const tx = interpolate(frame, [0, durationInFrames], panX, { extrapolateRight: 'clamp' });
  const ty = interpolate(frame, [0, durationInFrames], panY, { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ transform: \`scale(\${scale}) translate(\${tx}px, \${ty}px)\`, transformOrigin: 'center center' }}>
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

### Two-Color Radial Gradient Background
\`\`\`tsx
const DualRadialGradient: React.FC<{color1: string, color2: string, speed?: number}> = ({color1, color2, speed = 1}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const g1X = interpolate(frame, [0, durationInFrames], [25, 55], { extrapolateRight: 'clamp' }) + Math.sin(frame * 0.015 * speed) * 10;
  const g1Y = interpolate(frame, [0, durationInFrames], [30, 50], { extrapolateRight: 'clamp' }) + Math.cos(frame * 0.012 * speed) * 12;
  const g1Size = interpolate(frame, [0, durationInFrames], [40, 55], { extrapolateRight: 'clamp' });
  const g2X = interpolate(frame, [0, durationInFrames], [70, 45], { extrapolateRight: 'clamp' }) + Math.sin(frame * 0.018 * speed + 2) * 10;
  const g2Y = interpolate(frame, [0, durationInFrames], [65, 50], { extrapolateRight: 'clamp' }) + Math.cos(frame * 0.014 * speed + 1.5) * 12;
  const g2Size = interpolate(frame, [0, durationInFrames], [35, 50], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#050510', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: \`radial-gradient(ellipse \${g1Size}% \${g1Size}% at \${g1X}% \${g1Y}%, \${color1}, transparent)\`, opacity: 0.45 + Math.sin(frame * 0.02 * speed) * 0.08, filter: 'blur(60px)', transform: 'scale(1.4)' }} />
      <AbsoluteFill style={{ background: \`radial-gradient(ellipse \${g2Size}% \${g2Size}% at \${g2X}% \${g2Y}%, \${color2}, transparent)\`, opacity: 0.4 + Math.cos(frame * 0.025 * speed) * 0.08, filter: 'blur(60px)', transform: 'scale(1.4)' }} />
    </AbsoluteFill>
  );
};
\`\`\`

### Abstract Texture Overlay (on top of background)
\`\`\`tsx
const TextureOverlay: React.FC<{opacity?: number}> = ({opacity = 0.04}) => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame * 0.3) % 1000;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id={\`noise-\${seed}\`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" seed={seed} stitchTiles="stitch" />
        </filter>
      </svg>
      <AbsoluteFill style={{ opacity, filter: \`url(#noise-\${seed})\`, mixBlendMode: 'overlay' }} />
    </AbsoluteFill>
  );
};
\`\`\`

### Device Mockups (for website screenshots)
\`\`\`tsx
const IPhoneMockup: React.FC<{children: React.ReactNode, delay?: number, width?: number}> = ({children, delay = 0, width = 300}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const height = width * 2.16;
  const enterScale = spring({ frame: f, fps, from: 0.85, to: 1, config: { damping: 15 } });
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const bobY = Math.sin(frame * 0.03) * 12;
  return (
    <div style={{ position: 'relative', width, height, opacity, transform: \`translateY(\${bobY}px) scale(\${enterScale})\` }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: width * 0.14, background: 'linear-gradient(145deg, #2a2a2a, #1a1a1a)', boxShadow: '0 25px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)' }} />
      <div style={{ position: 'absolute', top: width * 0.04, left: width * 0.04, right: width * 0.04, bottom: width * 0.04, borderRadius: width * 0.12, overflow: 'hidden', background: '#000' }}>
        {children}
        <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', width: width * 0.3, height: width * 0.08, borderRadius: width * 0.04, background: '#000', zIndex: 10 }} />
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: width * 0.35, height: 5, borderRadius: 2.5, background: 'rgba(255,255,255,0.3)', zIndex: 10 }} />
      </div>
    </div>
  );
};

const MacBookMockup: React.FC<{children: React.ReactNode, delay?: number, width?: number}> = ({children, delay = 0, width = 800}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const screenHeight = width * 0.625;
  const enterScale = spring({ frame: f, fps, from: 0.9, to: 1, config: { damping: 18 } });
  const opacity = interpolate(f, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const enterY = interpolate(f, [0, 35], [50, 0], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'relative', width, opacity, transform: \`perspective(1500px) translateY(\${enterY}px) scale(\${enterScale})\` }}>
      <div style={{ width: '100%', height: screenHeight, borderRadius: '12px 12px 0 0', background: 'linear-gradient(180deg, #2d2d2d, #1a1a1a)', padding: '24px 10px 10px 10px' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden', background: '#000' }}>{children}</div>
      </div>
      <div style={{ width: '100%', height: 4, background: 'linear-gradient(180deg, #333, #1a1a1a)' }} />
      <div style={{ width: 'calc(100% + 20px)', marginLeft: -10, height: 14, borderRadius: '0 0 8px 8px', background: 'linear-gradient(180deg, #c0c0c0, #a8a8a8)' }} />
    </div>
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
      {/* Two-color radial gradient background */}
      <DualRadialGradient color1="#667eea" color2="#764ba2" />
      {/* Abstract texture overlay */}
      <TextureOverlay opacity={0.04} />

      {/* Camera zoom + pan */}
      <CameraWrapper zoomRange={[1, 1.15]} panY={[0, -15]}>
        {/* Content that flows in and out */}
        {content.map((item, i) => (
          <FloatingElement key={i} enterFrame={item.enterFrame} exitFrame={item.exitFrame}>
            <WarpingText text={item.text} enterFrame={item.enterFrame} exitFrame={item.exitFrame} />
          </FloatingElement>
        ))}
      </CameraWrapper>
    </AbsoluteFill>
  );
};
\`\`\`

## STYLE REQUIREMENTS
- Background ALWAYS uses DualRadialGradient with 2 brand colors
- TextureOverlay on top of background for premium grain effect
- Beat-synced pulses and flickers
- Headlines use bebasNeue (Bebas Neue), body uses montserrat - NEVER system-ui
- Headlines should be BIG: 96-200px, uppercase, with letter-spacing 0.05em
- Glow effects that breathe
- Use IPhoneMockup or MacBookMockup when displaying website screenshots
- CameraWrapper wraps all content for continuous zoom + pan
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
  Easing,
} from 'remotion';
import { loadFont as loadBebasNeue } from "@remotion/google-fonts/BebasNeue";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const { fontFamily: bebasNeue } = loadBebasNeue("normal", { weights: ["400"], subsets: ["latin"] });
const { fontFamily: montserrat } = loadMontserrat("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

// Two-color radial gradient background
const DualRadialGradient: React.FC<{color1: string, color2: string}> = ({color1, color2}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const g1X = interpolate(frame, [0, durationInFrames], [25, 55], { extrapolateRight: 'clamp' }) + Math.sin(frame * 0.015) * 10;
  const g1Y = interpolate(frame, [0, durationInFrames], [30, 50], { extrapolateRight: 'clamp' }) + Math.cos(frame * 0.012) * 12;
  const g1Size = interpolate(frame, [0, durationInFrames], [40, 55], { extrapolateRight: 'clamp' });
  const g2X = interpolate(frame, [0, durationInFrames], [70, 45], { extrapolateRight: 'clamp' }) + Math.sin(frame * 0.018 + 2) * 10;
  const g2Y = interpolate(frame, [0, durationInFrames], [65, 50], { extrapolateRight: 'clamp' }) + Math.cos(frame * 0.014 + 1.5) * 12;
  const g2Size = interpolate(frame, [0, durationInFrames], [35, 50], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#050510', overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: \`radial-gradient(ellipse \${g1Size}% \${g1Size}% at \${g1X}% \${g1Y}%, \${color1}, transparent)\`, opacity: 0.45 + Math.sin(frame * 0.02) * 0.08, filter: 'blur(60px)', transform: 'scale(1.4)' }} />
      <AbsoluteFill style={{ background: \`radial-gradient(ellipse \${g2Size}% \${g2Size}% at \${g2X}% \${g2Y}%, \${color2}, transparent)\`, opacity: 0.4 + Math.cos(frame * 0.025) * 0.08, filter: 'blur(60px)', transform: 'scale(1.4)' }} />
    </AbsoluteFill>
  );
};

// Abstract texture overlay
const TextureOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame * 0.3) % 1000;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id={\`n-\${seed}\`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" seed={seed} stitchTiles="stitch" />
        </filter>
      </svg>
      <AbsoluteFill style={{ opacity: 0.04, filter: \`url(#n-\${seed})\`, mixBlendMode: 'overlay' }} />
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
      fontFamily: bebasNeue,
      fontWeight: 'bold',
      color: '#ffffff',
      opacity,
      filter: \`blur(\${blur}px)\`,
      transform: \`translateY(\${y}px)\`,
      display: 'inline-block',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
    }}>
      {text}
    </span>
  );
};

// Camera wrapper
const CameraWrapper: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.15], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const ty = interpolate(frame, [0, durationInFrames], [0, -15], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ transform: \`scale(\${scale}) translateY(\${ty}px)\`, transformOrigin: 'center center' }}>
      {children}
    </AbsoluteFill>
  );
};

// Intro scene
const IntroScene: React.FC<{headline: string, subtext?: string, primary: string, secondary: string}> = ({
  headline, subtext, primary, secondary
}) => {
  const frame = useCurrentFrame();
  const subtextOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill>
      <DualRadialGradient color1={primary} color2={secondary} />
      <TextureOverlay />
      <CameraWrapper>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', padding: '0 80px' }}>
            <BlurInText text={headline} fontSize={140} />
            {subtext && (
              <p style={{
                color: 'rgba(255,255,255,0.8)',
                fontFamily: montserrat,
                fontSize: 32,
                fontWeight: 500,
                marginTop: 24,
                opacity: subtextOpacity,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                {subtext}
              </p>
            )}
          </div>
        </AbsoluteFill>
      </CameraWrapper>
    </AbsoluteFill>
  );
};

// Main composition
const ProductVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: '#050510' }}>
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
  return `No screenshots are available. Do NOT use <Img> or staticFile("screenshots/...") — the file does not exist and will break the render. Use text-only scenes with DualRadialGradient backgrounds instead.`;
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
