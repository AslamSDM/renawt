import { codeGeneratorModel } from "./model";
import type { VideoScript } from "../types";
import type { VideoGenerationStateType } from "./state";

const model = codeGeneratorModel();

const CODE_GENERATOR_SYSTEM_PROMPT = `You are a Remotion developer. Generate React/Remotion code for product marketing videos.

CRITICAL RULES:
1. NEVER use CSS transitions or @keyframes - causes flickering during render
2. ALL animations MUST use useCurrentFrame() + interpolate() or spring()
3. Use <Sequence> for scene timing with from and durationInFrames props
4. Use AbsoluteFill for full-screen positioning
5. Clamp interpolate outputs with extrapolateRight: "clamp"
6. All components must be React functional components
7. Export a main composition component as default

Available imports:
- remotion: useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence, Img, interpolate, spring
- react: React

Animation Patterns:

Fade In:
const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

Slide Up:
const translateY = interpolate(frame, [0, 30], [50, 0], { extrapolateRight: "clamp" });

Scale (spring):
const scale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });

Typewriter:
const text = "Hello";
const charsToShow = Math.floor(interpolate(frame, [0, text.length * 3], [0, text.length], { extrapolateRight: "clamp" }));
const displayText = text.slice(0, charsToShow);

Output ONLY the complete TypeScript/TSX code. No markdown, no explanations.
The code should be a single file that can be saved and used directly.`;

const CODE_TEMPLATE = `
// This is an example of the expected output structure:
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

// Scene Components
const IntroScene: React.FC<{ headline: string; subtext?: string; background: string; textColor: string }> = ({
  headline,
  subtext,
  background,
  textColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' });
  const subtextOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ textAlign: 'center', padding: '0 60px' }}>
        <h1 style={{
          color: textColor,
          fontSize: 72,
          fontWeight: 'bold',
          opacity: titleOpacity,
          transform: \`translateY(\${titleY}px)\`,
          margin: 0,
        }}>
          {headline}
        </h1>
        {subtext && (
          <p style={{
            color: textColor,
            fontSize: 32,
            opacity: subtextOpacity,
            marginTop: 20,
          }}>
            {subtext}
          </p>
        )}
      </div>
    </AbsoluteFill>
  );
};

// Main composition - this pattern should be followed
const ProductVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={90}>
        <IntroScene headline="Welcome" background="#1a1a2e" textColor="#ffffff" />
      </Sequence>
    </AbsoluteFill>
  );
};

export default ProductVideo;
`;

export async function codeGeneratorNode(
  state: VideoGenerationStateType
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

    const response = await model.invoke([
      { role: "system", content: CODE_GENERATOR_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Generate a complete Remotion composition for this video script.

Video Script JSON:
${JSON.stringify(videoScript, null, 2)}

Requirements:
1. Create a scene component for each scene type (intro, feature, testimonial, cta)
2. Use the exact colors, text, and timing from the script
3. Apply the specified animations (${videoScript.scenes.map((s) => s.animation.enter).join(", ")})
4. Total duration: ${videoScript.totalDuration} frames
5. Frame rate: 30fps

Reference structure (follow this pattern):
${CODE_TEMPLATE}

Generate the COMPLETE code. Include all scene components and the main composition.
Output ONLY TypeScript/TSX code, no markdown code blocks.`,
      },
    ]);

    const rawContent = response.content;
    let codeText: string =
      typeof rawContent === "string"
        ? rawContent
        : Array.isArray(rawContent) && rawContent[0]?.type === "text"
          ? (rawContent[0] as { type: "text"; text: string }).text
          : "";

    // Clean up the code - remove markdown code blocks if present
    codeText = codeText
      .replace(/^```(?:tsx?|typescript|javascript)?\n?/gm, "")
      .replace(/```$/gm, "")
      .trim();

    // Validate the code has required imports
    if (!codeText.includes("remotion") || !codeText.includes("useCurrentFrame")) {
      throw new Error("Generated code missing required Remotion imports");
    }

    console.log(`[CodeGenerator] Generated ${codeText.length} chars of code`);

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
