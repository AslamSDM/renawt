/**
 * RECORDING ANALYZER AGENT
 *
 * Sends screen recording videos to Gemini Pro Vision to generate
 * Remotion component code that recreates the UI with cursor/click animations,
 * instead of embedding raw <Video> elements.
 */

import { chatWithGeminiProVision } from "./model";

const RECORDING_ANALYZER_SYSTEM_PROMPT = `You are a Remotion expert who analyzes screen recording videos and generates React/Remotion code that RECREATES the UI shown in the recording with animated cursor movements and click effects.

## YOUR TASK
Given a screen recording video of a product UI, generate a Remotion component that:
1. Recreates the key UI elements visible in the recording (layouts, buttons, text, cards)
2. Animates a cursor that moves to interactive elements and clicks them
3. Shows click effects (ripples, button press animations) at the recorded click points
4. Uses interpolate() and spring() for all animations (NO CSS transitions)

## CRITICAL RULES
- Use only Remotion primitives: AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring
- Import from 'remotion' only (no external UI libraries)
- All animations driven by useCurrentFrame()
- Include an SVG cursor component that moves smoothly between click targets
- Recreate the UI layout approximately — it doesn't need to be pixel-perfect
- Use clean, modern styling that matches the recording's color scheme
- Component must be named RecordingScene_[ID] where ID is provided
- Must accept no props (all data baked in)
- Do NOT use <Video> — the whole point is to RECREATE the UI, not embed the video

## SVG CURSOR COMPONENT
\`\`\`tsx
const Cursor: React.FC<{ x: number; y: number; clicking: boolean }> = ({ x, y, clicking }) => (
  <div style={{ position: 'absolute', left: x, top: y, zIndex: 200, transform: clicking ? 'scale(0.85)' : 'scale(1)' }}>
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M5.5 3.21V20.8C5.5 21.46 6.26 21.84 6.78 21.43L11.64 17.65C11.83 17.5 12.07 17.42 12.31 17.42H18.73C19.39 17.42 19.76 16.65 19.34 16.15L6.68 3.12C6.23 2.65 5.5 2.97 5.5 3.21Z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  </div>
);
\`\`\`

## CLICK RIPPLE EFFECT
\`\`\`tsx
const ClickRipple: React.FC<{ x: number; y: number; startFrame: number }> = ({ x, y, startFrame }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - startFrame);
  const scale = interpolate(f, [0, 20], [0, 2], { extrapolateRight: 'clamp' });
  const opacity = interpolate(f, [0, 20], [0.6, 0], { extrapolateRight: 'clamp' });
  if (f < 0 || f > 25) return null;
  return (
    <div style={{
      position: 'absolute', left: x - 20, top: y - 20, width: 40, height: 40,
      borderRadius: '50%', border: '2px solid rgba(59, 130, 246, 0.8)',
      transform: 'scale(' + scale + ')', opacity, zIndex: 150,
    }} />
  );
};
\`\`\`

## OUTPUT FORMAT
Return ONLY the complete React component code (no markdown, no explanation).
The component should be self-contained and ready to use inside a <Sequence>.`;

export interface RecordingAnalysisResult {
  componentCode: string;
  componentName: string;
  success: boolean;
  error?: string;
}

/**
 * Analyze a screen recording and generate a Remotion component that recreates the UI.
 */
export async function analyzeRecording(
  recording: {
    id: string;
    videoUrl: string;
    duration: number;
    featureName: string;
    description: string;
  },
): Promise<RecordingAnalysisResult> {
  const componentName = `RecordingScene_${recording.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const durationFrames = Math.round(recording.duration * 30);

  console.log(`[RecordingAnalyzer] Analyzing recording: ${recording.featureName} (${recording.duration}s)`);

  try {
    const textPrompt = `Analyze this screen recording and generate a Remotion component that recreates the UI shown.

## RECORDING INFO
- Feature: ${recording.featureName}
- Description: ${recording.description}
- Duration: ${recording.duration} seconds (${durationFrames} frames at 30fps)
- Component name: ${componentName}

## INSTRUCTIONS
1. Study the UI layout, colors, buttons, text, and interactive elements in the recording
2. Identify where clicks/interactions happen and at what timestamps
3. Generate a Remotion component that:
   - Recreates the UI layout with styled divs
   - Has an animated cursor that moves to click targets
   - Shows click ripple effects at interaction points
   - Fades in at the start and fades out at the end
   - Total duration: ${durationFrames} frames

Return ONLY the component code. Name it: ${componentName}`;

    const response = await chatWithGeminiProVision(
      {
        type: "video",
        path: recording.videoUrl,
      },
      textPrompt,
      RECORDING_ANALYZER_SYSTEM_PROMPT,
      { temperature: 0.5, maxTokens: 8000 },
    );

    let code = response.content;

    // Extract code block if wrapped in markdown
    const codeBlockMatch = code.match(/```(?:tsx?|jsx?|javascript)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1].trim();
    }

    // Validate the code has minimum requirements
    if (!code.includes("useCurrentFrame") || !code.includes(componentName)) {
      console.warn("[RecordingAnalyzer] Generated code missing required elements, using fallback");
      return {
        componentCode: generateFallbackRecordingComponent(recording, componentName, durationFrames),
        componentName,
        success: false,
        error: "Generated code missing required elements",
      };
    }

    // Ensure export
    if (!code.includes(`export default ${componentName}`) && !code.includes("export default")) {
      code += `\nexport default ${componentName};`;
    }

    console.log(`[RecordingAnalyzer] Generated component: ${componentName} (${code.length} chars)`);

    return {
      componentCode: code,
      componentName,
      success: true,
    };
  } catch (error) {
    console.error(`[RecordingAnalyzer] Error analyzing recording ${recording.id}:`, error);

    return {
      componentCode: generateFallbackRecordingComponent(recording, componentName, durationFrames),
      componentName,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Generate a fallback component that uses <Video> embed when analysis fails
 */
function generateFallbackRecordingComponent(
  recording: { videoUrl: string; featureName: string },
  componentName: string,
  durationFrames: number,
): string {
  const isR2 = recording.videoUrl.startsWith("http");
  const videoSrc = isR2
    ? `"${recording.videoUrl}"`
    : `staticFile("${recording.videoUrl.replace(/^\//, "")}")`;

  return `import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Video, staticFile } from 'remotion';

const ${componentName}: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const entryOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const exitOpacity = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(entryOpacity, exitOpacity);
  const labelOpacity = interpolate(frame, [0, 30, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f', opacity }}>
      <Video src={${videoSrc}} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: labelOpacity, zIndex: 10 }}>
        <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', borderRadius: 12, padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }} />
          <span style={{ fontWeight: 600, fontSize: 20, color: '#ffffff' }}>${recording.featureName}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default ${componentName};`;
}
