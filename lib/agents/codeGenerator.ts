import {
  getAnthropicModel,
  chatWithOpenRouter,
  isUsingOpenRouter,
  CODE_GENERATOR_CONFIG,
} from "./model";
import { loadRemotionSkills, savePromptLog } from "./skills";
import type { VideoScript } from "../types";
import type { VideoGenerationStateType } from "./state";

const CODE_GENERATOR_SYSTEM_PROMPT = `You are a PREMIUM Remotion developer. Generate stunning React/Remotion code for motion graphics videos.

## CRITICAL RULES (MUST FOLLOW)
1. NEVER use CSS transitions or @keyframes - causes flickering during render
2. ALL animations MUST use useCurrentFrame() + interpolate() or spring()
3. Use <Sequence> for scene timing with from and durationInFrames props
4. Use AbsoluteFill for full-screen positioning
5. Clamp interpolate outputs with extrapolateRight: "clamp"
6. All components must be React functional components
7. Export a main composition component as default

## AVAILABLE IMPORTS
\`\`\`tsx
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
\`\`\`

## PREMIUM ANIMATION PATTERNS

### Blur-In Effect (for headlines)
\`\`\`tsx
const BlurInText: React.FC<{text: string, delay?: number}> = ({text, delay = 0}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const blur = interpolate(f, [0, 25], [15, 0], { extrapolateRight: 'clamp' });
  const y = interpolate(f, [0, 25], [25, 0], { extrapolateRight: 'clamp' });
  return (
    <span style={{
      opacity,
      filter: \`blur(\${blur}px)\`,
      transform: \`translateY(\${y}px)\`,
      display: 'inline-block',
    }}>
      {text}
    </span>
  );
};
\`\`\`

### Stagger Words (for taglines)
\`\`\`tsx
const StaggerWords: React.FC<{text: string, staggerDelay?: number}> = ({text, staggerDelay = 4}) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3em', justifyContent: 'center' }}>
      {words.map((word, i) => {
        const f = Math.max(0, frame - i * staggerDelay);
        const opacity = interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
        const y = interpolate(f, [0, 15], [20, 0], { extrapolateRight: 'clamp' });
        return <span key={i} style={{ opacity, transform: \`translateY(\${y}px)\` }}>{word}</span>;
      })}
    </div>
  );
};
\`\`\`

### Glassmorphic Card (for features)
\`\`\`tsx
const GlassCard: React.FC<{children: React.ReactNode, delay?: number}> = ({children, delay = 0}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const scale = spring({ frame: f, fps, from: 0.9, to: 1, config: { damping: 15 } });
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(20px)',
      borderRadius: 20,
      border: '1px solid rgba(255, 255, 255, 0.15)',
      padding: 32,
      opacity,
      transform: \`scale(\${scale})\`,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    }}>
      {children}
    </div>
  );
};
\`\`\`

### Animated Counter (for stats)
\`\`\`tsx
const AnimatedCounter: React.FC<{value: number, suffix?: string, label: string, delay?: number}> = ({value, suffix = '', label, delay = 0}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const animatedValue = interpolate(f, [0, 45], [0, value], { extrapolateRight: 'clamp' });
  const scale = spring({ frame: f, fps, from: 0.5, to: 1, config: { damping: 12 } });
  return (
    <div style={{ textAlign: 'center', transform: \`scale(\${scale})\` }}>
      <div style={{ fontSize: 72, fontWeight: 800 }}>{Math.floor(animatedValue).toLocaleString()}{suffix}</div>
      <div style={{ fontSize: 20, opacity: 0.7, marginTop: 8 }}>{label}</div>
    </div>
  );
};
\`\`\`

### Gradient Mesh Background
\`\`\`tsx
const GradientBackground: React.FC<{colors: string[]}> = ({colors}) => {
  const frame = useCurrentFrame();
  const offset = (frame * 0.5) % 100;
  return (
    <AbsoluteFill style={{
      background: \`
        radial-gradient(ellipse 80% 80% at \${20 + offset * 0.3}% \${30 + offset * 0.2}%, \${colors[0]}40 0%, transparent 50%),
        radial-gradient(ellipse 60% 60% at \${70 - offset * 0.2}% \${60 + offset * 0.1}%, \${colors[1]}40 0%, transparent 45%),
        linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%)
      \`,
    }} />
  );
};
\`\`\`

### Page Scroll Transition
For scroll-vertical transitions, use this composition pattern:
\`\`\`tsx
const ScrollContainer: React.FC<{children: React.ReactNode, scrollSpeed?: number}> = ({children, scrollSpeed = 6}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();
  const scrollY = frame * scrollSpeed;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <div style={{ transform: \`translateY(-\${scrollY}px)\` }}>
        {React.Children.map(children, (child, i) => (
          <div key={i} style={{ height, width: '100%' }}>{child}</div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
\`\`\`

## STYLING REQUIREMENTS
- Use GRADIENT backgrounds: linear-gradient(135deg, primary 0%, secondary 100%)
- Use brand colors from the script - NEVER plain black/white
- Use glassmorphism for cards: rgba backgrounds + backdrop-filter: blur()
- Add subtle shadows for depth
- Use modern fonts: system-ui, sans-serif
- Large headline text: 72-96px, bold
- Subtext: 28-36px, lighter weight

## OUTPUT
Generate COMPLETE TypeScript/TSX code. No markdown blocks, no explanations.
Single file that exports default composition.`;

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

// Gradient background component
const GradientBackground: React.FC<{primary: string, secondary: string}> = ({primary, secondary}) => {
  const frame = useCurrentFrame();
  const offset = (frame * 0.5) % 100;
  return (
    <AbsoluteFill style={{
      background: \`
        radial-gradient(ellipse 80% 80% at \${20 + offset * 0.3}% \${30}%, \${primary}30 0%, transparent 50%),
        radial-gradient(ellipse 60% 60% at \${80 - offset * 0.2}% \${70}%, \${secondary}30 0%, transparent 45%),
        linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)
      \`,
    }} />
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
  const subtextOpacity = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: 'clamp' });
  
  return (
    <AbsoluteFill>
      <GradientBackground primary={primary} secondary={secondary} />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: '0 80px' }}>
          <h1 style={{ margin: 0, color: '#ffffff', fontFamily: 'system-ui, sans-serif' }}>
            <BlurInText text={headline} fontSize={84} />
          </h1>
          {subtext && (
            <p style={{
              color: 'rgba(255,255,255,0.7)',
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

    // Build a more explicit prompt that REQUIRES premium animations
    const userPrompt = `Generate a STUNNING, PREMIUM Remotion composition. This is NOT a basic video - it must have ADVANCED animations.

VIDEO SCRIPT:
${JSON.stringify(videoScript, null, 2)}

PRODUCT INFO:
${productData ? JSON.stringify(productData, null, 2) : "No product data"}

## MANDATORY REQUIREMENTS (YOU MUST INCLUDE ALL OF THESE):

### 1. GRADIENT ANIMATED BACKGROUND
Use this EXACT component:
const GradientBackground: React.FC<{primary: string, secondary: string}> = ({primary, secondary}) => {
  const frame = useCurrentFrame();
  const offset = (frame * 0.5) % 100;
  return (
    <AbsoluteFill style={{
      background: \`
        radial-gradient(ellipse 80% 80% at \${20 + offset * 0.3}% \${30}%, \${primary}30 0%, transparent 50%),
        radial-gradient(ellipse 60% 60% at \${80 - offset * 0.2}% \${70}%, \${secondary}30 0%, transparent 45%),
        linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)
      \`,
    }} />
  );
};

### 2. BLUR-IN TEXT ANIMATION (for headlines)
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

### 3. STAGGER WORDS ANIMATION (for subtitles)
const StaggerWords: React.FC<{text: string, delay?: number}> = ({text, delay = 0}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3em', justifyContent: 'center' }}>
      {text.split(' ').map((word, i) => {
        const f = Math.max(0, frame - delay - i * 4);
        const opacity = interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
        const y = interpolate(f, [0, 15], [20, 0], { extrapolateRight: 'clamp' });
        return <span key={i} style={{ opacity, transform: \`translateY(\${y}px)\` }}>{word} </span>;
      })}
    </div>
  );
};

### 4. GLASSMORPHIC CARD (for features)
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

### 5. SCENE STRUCTURE
- Create separate scene components: IntroScene, FeatureScene, CTAScene
- Each scene MUST use the animated components above
- Use <Sequence> with correct from and durationInFrames
- Brand colors: primary="${productData?.colors?.primary || "#667eea"}", secondary="${productData?.colors?.secondary || "#764ba2"}"

### 6. STYLING
- NEVER use black or white backgrounds
- Use gradient backgrounds with brand colors
- Large text: 72-96px, font-weight: bold
- Subtext: 28-36px, lighter
- Font: system-ui, sans-serif
- Text color: #ffffff

Total duration: ${videoScript.totalDuration} frames at 30fps

OUTPUT: Complete TypeScript/TSX code ONLY. No markdown. No explanations. Just code.`;

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

    if (isUsingOpenRouter()) {
      // Use Gemini for development
      console.log("[CodeGenerator] Using Gemini for development");
      const response = await chatWithOpenRouter(
        [
          { role: "system", content: enhancedSystemPrompt },
          { role: "user", content: userPrompt },
        ],
        CODE_GENERATOR_CONFIG,
      );
      codeText = response.content;
    } else {
      // Use Anthropic for production
      console.log("[CodeGenerator] Using Anthropic for production");
      const model = getAnthropicModel(CODE_GENERATOR_CONFIG);
      const response = await model.invoke([
        { role: "system", content: enhancedSystemPrompt },
        { role: "user", content: userPrompt },
      ]);

      const rawContent = response.content;
      codeText =
        typeof rawContent === "string"
          ? rawContent
          : Array.isArray(rawContent) && rawContent[0]?.type === "text"
            ? (rawContent[0] as { type: "text"; text: string }).text
            : "";
    }

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
