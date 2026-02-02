/**
 * Template-based Video Code Generator
 * Generates Remotion code deterministically from video scripts using pre-built templates.
 * This approach eliminates LLM hallucination and ensures consistent premium animations.
 */

import type { VideoScript, VideoScene } from "../types";
import type { VideoGenerationStateType } from "./state";
import { savePromptLog } from "./skills";

// Map scene animation types to their implementations
const ANIMATION_IMPLEMENTATIONS: Record<string, string> = {
  "blur-in": "BlurInText",
  "blur-in-up": "BlurInText",
  "stagger-words": "StaggerWords",
  "stagger-chars": "StaggerWords",
  "encrypted-text": "BlurInText",
  "slide-up": "SlideIn",
  scale: "ScaleIn",
  fade: "FadeIn",
};

function getSceneType(
  scene: VideoScene,
): "intro" | "feature" | "cta" | "testimonial" {
  const type = scene.type;
  if (type === "intro") return "intro";
  if (type === "cta") return "cta";
  if (type === "testimonial") return "testimonial";
  // feature, transition, stats all render as feature
  return "feature";
}

function extractGradientColors(background: string): {
  primary: string;
  secondary: string;
} {
  // Extract colors from gradient strings like "linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)"
  const hexMatches = background.match(/#[0-9A-Fa-f]{6}/g);
  if (hexMatches && hexMatches.length >= 2) {
    return { primary: hexMatches[0], secondary: hexMatches[1] };
  }
  if (hexMatches && hexMatches.length === 1) {
    return { primary: hexMatches[0], secondary: hexMatches[0] };
  }
  return { primary: "#1E40AF", secondary: "#3B82F6" };
}

function generateSceneComponent(scene: VideoScene, index: number): string {
  const sceneType = getSceneType(scene);
  const colors = extractGradientColors(scene.style?.background || "");
  const headline = scene.content.headline || "";
  const subtext = scene.content.subtext || "";
  const icon = scene.content.icon || "";
  const features = scene.content.features || [];

  const componentName = `Scene${index + 1}`;
  const duration = scene.endFrame - scene.startFrame;

  // Generate feature cards if present
  let featuresJSX = "";
  if (features.length > 0) {
    featuresJSX = `
        <div style={{ display: 'flex', gap: 30, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1000 }}>
          ${features
            .map(
              (f, i) => `
          <GlassCard delay={${40 + i * 15}}>
            <div style={{ textAlign: 'center', color: '#ffffff', fontFamily: 'system-ui' }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>${f.icon || "✨"}</div>
              <div style={{ fontSize: 24, fontWeight: 'bold' }}>${f.title}</div>
              <div style={{ fontSize: 16, opacity: 0.8, marginTop: 8 }}>${f.description}</div>
            </div>
          </GlassCard>`,
            )
            .join("")}
        </div>`;
  }

  if (sceneType === "intro") {
    return `
const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 80,
    }}>
      <GradientMeshBackground primary="${colors.primary}" secondary="${colors.secondary}" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        ${icon ? `<ScaleIn delay={0}><div style={{ fontSize: 80, marginBottom: 20 }}>${icon}</div></ScaleIn>` : ""}
        <BlurInText text="${headline}" fontSize={84} delay={5} />
        <div style={{ marginTop: 30 }}>
          <StaggerWords text="${subtext}" fontSize={32} delay={20} />
        </div>
      </div>
    </AbsoluteFill>
  );
};`;
  }

  if (sceneType === "cta") {
    return `
const ${componentName}: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame / 15) * 0.05;
  
  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 80,
    }}>
      <GradientMeshBackground primary="${colors.secondary}" secondary="${colors.primary}" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        ${icon ? `<ScaleIn delay={0}><div style={{ fontSize: 100, marginBottom: 30, transform: \`scale(\${pulse})\` }}>${icon}</div></ScaleIn>` : ""}
        <BlurInText text="${headline}" fontSize={78} delay={10} />
        <div style={{ marginTop: 30 }}>
          <StaggerWords text="${subtext}" fontSize={36} delay={30} staggerDelay={6} />
        </div>
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Feature scene
  return `
const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill style={{
      background: 'linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 60,
    }}>
      <GradientMeshBackground primary="${colors.primary}" secondary="${colors.secondary}" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%' }}>
        ${icon ? `<ScaleIn delay={0}><div style={{ fontSize: 70, marginBottom: 20 }}>${icon}</div></ScaleIn>` : ""}
        <BlurInText text="${headline}" fontSize={72} delay={5} />
        <div style={{ marginTop: 20, marginBottom: 40 }}>
          <StaggerWords text="${subtext}" fontSize={28} delay={20} />
        </div>
        ${featuresJSX}
      </div>
    </AbsoluteFill>
  );
};`;
}

function generateFullCode(videoScript: VideoScript): string {
  const scenes = videoScript.scenes;

  // Generate scene components
  const sceneComponents = scenes
    .map((scene, i) => generateSceneComponent(scene, i))
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

  return `// Auto-generated Premium Remotion Video
// Generated at: ${new Date().toISOString()}
import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
} from 'remotion';

// ============================================================================
// ANIMATION PRIMITIVES
// ============================================================================

const BlurInText: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  color?: string;
}> = ({ text, fontSize = 72, delay = 0, color = '#ffffff' }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const blur = interpolate(f, [0, 25], [15, 0], { extrapolateRight: 'clamp' });
  const y = interpolate(f, [0, 25], [30, 0], { extrapolateRight: 'clamp' });
  
  return (
    <span style={{
      fontSize,
      fontWeight: 'bold',
      fontFamily: 'system-ui, sans-serif',
      color,
      opacity,
      filter: \`blur(\${blur}px)\`,
      transform: \`translateY(\${y}px)\`,
      display: 'inline-block',
    }}>
      {text}
    </span>
  );
};

const StaggerWords: React.FC<{
  text: string;
  fontSize?: number;
  delay?: number;
  staggerDelay?: number;
  color?: string;
}> = ({ text, fontSize = 32, delay = 0, staggerDelay = 4, color = '#ffffff' }) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  
  return (
    <div style={{ 
      display: 'flex', 
      flexWrap: 'wrap', 
      gap: '0.3em', 
      justifyContent: 'center',
      fontSize,
      fontFamily: 'system-ui, sans-serif',
      color,
    }}>
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * staggerDelay);
        const opacity = interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
        const y = interpolate(f, [0, 15], [20, 0], { extrapolateRight: 'clamp' });
        return (
          <span key={i} style={{ opacity, transform: \`translateY(\${y}px)\` }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

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

const GradientMeshBackground: React.FC<{
  primary: string;
  secondary: string;
}> = ({ primary, secondary }) => {
  const frame = useCurrentFrame();
  const offset = (frame * 0.5) % 100;
  
  return (
    <AbsoluteFill style={{
      background: \`
        radial-gradient(ellipse 80% 80% at \${20 + offset * 0.3}% \${30}%, \${primary}40 0%, transparent 50%),
        radial-gradient(ellipse 60% 60% at \${80 - offset * 0.2}% \${70}%, \${secondary}40 0%, transparent 45%),
        linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)
      \`,
    }} />
  );
};

const GlassCard: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const scale = spring({ frame: f, fps, from: 0.9, to: 1, config: { damping: 15, stiffness: 100 } });
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 24,
      border: '1px solid rgba(255, 255, 255, 0.15)',
      padding: 40,
      opacity,
      transform: \`scale(\${scale})\`,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    }}>
      {children}
    </div>
  );
};

// ============================================================================
// SCENE COMPONENTS
// ============================================================================
${sceneComponents}

// ============================================================================
// MAIN COMPOSITION
// ============================================================================

const ProductVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0f0f1a' }}>
${sequenceRenders}
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

    console.log(
      `[TemplateCodeGenerator] Processing ${videoScript.scenes.length} scenes...`,
    );

    // Generate code deterministically from templates
    const generatedCode = generateFullCode(videoScript);

    console.log(
      `[TemplateCodeGenerator] Generated ${generatedCode.length} chars of code`,
    );

    // Validate the generated code
    const hasRemotion = generatedCode.includes("remotion");
    const hasUseCurrentFrame = generatedCode.includes("useCurrentFrame");
    const hasInterpolate = generatedCode.includes("interpolate");
    const hasBlurAnimation =
      generatedCode.includes("blur") && generatedCode.includes("filter");
    const hasGradient =
      generatedCode.includes("gradient") || generatedCode.includes("Gradient");

    console.log("[TemplateCodeGenerator] Validation:");
    console.log("  - Has remotion import:", hasRemotion);
    console.log("  - Has useCurrentFrame:", hasUseCurrentFrame);
    console.log("  - Has interpolate:", hasInterpolate);
    console.log("  - Has blur animation:", hasBlurAnimation);
    console.log("  - Has gradient:", hasGradient);

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
