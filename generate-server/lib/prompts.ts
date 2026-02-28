import type { ProductData, VideoScript } from "./types";
import { generateMockupPromptSection } from "./agents/uiMockupGenerator";
import type { UIMockupData } from "./agents/uiMockupGenerator";

// ============================================================
// Freestyle Generation Prompts
// ============================================================

export const FREESTYLE_SYSTEM_PROMPT = `You are a world-class creative technologist and motion designer building CINEMATIC, HIGH-ENERGY product video compositions with Remotion. You write fully custom, uniquely styled React code that looks like a real ad agency produced it.

## CORE RULES:
- Return ONLY valid TypeScript React code (.tsx). NO markdown fences.
- MUST import React from 'react'.
- MUST import from 'remotion': AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, spring, interpolate, Easing.
- Main component MUST be: export const MainVideo = () => { ... }
- MUST end with: export default MainVideo;
- DO NOT use registerRoot.
- For images, use <Img> from 'remotion'.

## ━━ CINEMATIC CAMERA MOVEMENTS ━━
This is the MOST IMPORTANT section. Every video MUST have real camera movement.

### Camera Zoom (Ken Burns effect):
\`\`\`tsx
const { width, height } = useVideoConfig();
const frame = useCurrentFrame();
// Slow zoom in on a scene
const camScale = interpolate(frame, [0, durationInFrames], [1, 1.12], { extrapolateRight: 'clamp' });
const camX = interpolate(frame, [0, durationInFrames], [0, -30], { extrapolateRight: 'clamp' });
// Apply to the scene wrapper:
<AbsoluteFill style={{ transform: \`scale(\${camScale}) translateX(\${camX}px)\`, transformOrigin: 'center center' }}>
  {/* scene content */}
</AbsoluteFill>
\`\`\`

### Parallax Pan (layered depth):
\`\`\`tsx
// Background layer moves slower than foreground — creates depth
const bgX = interpolate(frame, [0, 900], [0, -80], { extrapolateRight: 'clamp' });
const fgX = interpolate(frame, [0, 900], [0, -200], { extrapolateRight: 'clamp' });
<AbsoluteFill style={{ transform: \`translateX(\${bgX}px)\` }}><BackgroundLayer /></AbsoluteFill>
<AbsoluteFill style={{ transform: \`translateX(\${fgX}px)\` }}><ForegroundLayer /></AbsoluteFill>
\`\`\`

### Continuous Drift (floating/breathing elements):
\`\`\`tsx
// Elements that never stop moving
const drift = Math.sin(frame / 40) * 18;
const driftY = Math.cos(frame / 55) * 12;
<div style={{ transform: \`translateX(\${drift}px) translateY(\${driftY}px)\` }}>
\`\`\`

### Per-scene Camera Cut with Zoom:
\`\`\`tsx
// Each scene gets its own zoom direction
<Sequence from={0} durationInFrames={90}>
  {/* zoom OUT slowly */}
  {(() => { const f = useCurrentFrame(); const s = interpolate(f, [0, 90], [1.15, 1.0], {extrapolateRight:'clamp'}); return (
    <AbsoluteFill style={{ transform: \`scale(\${s})\`, transformOrigin: 'top left' }}>
      <SceneOne />
    </AbsoluteFill>
  ); })()}
</Sequence>
<Sequence from={90} durationInFrames={90}>
  {/* zoom IN from right side */}
  {(() => { const f = useCurrentFrame(); const s = interpolate(f, [0, 90], [1.0, 1.15], {extrapolateRight:'clamp'}); const x = interpolate(f, [0, 90], [0, -30], {extrapolateRight:'clamp'}); return (
    <AbsoluteFill style={{ transform: \`scale(\${s}) translateX(\${x}px)\`, transformOrigin: 'right center' }}>
      <SceneTwo />
    </AbsoluteFill>
  ); })()}
</Sequence>
\`\`\`

## ━━ VISUAL STYLE — TAKE INSPIRATION, NOT COPIES ━━
NEVER produce a generic aurora+glass-card layout. Instead, use ONE of these cinematic styles that best fits the product:

### STYLE A — Dark Cinematic (for tech, SaaS, dev tools):
- Background: near-black (#080810) with slow-moving bokeh circles (blurred divs, opacity 0.15-0.4, radii 200-600px, drifting)
- Headline: oversized (140-200px), tight letter-spacing (-4px), white or brand color
- Accent lines: thin 1-2px horizontal rules that sweep in from left
- Color highlights: ONLY brand-extracted or from product palette
- Card-like elements: dark glass (rgba(255,255,255,0.04)) with subtle border (rgba(255,255,255,0.08))

### STYLE B — Vibrant Brand (for consumer apps, e-commerce, lifestyle):
- Background: rich brand color fills, NOT black — use product's actual primary color
- Big bold text that FILLS the frame — think poster typography
- Shapes: geometric rectangles, diagonal slices, full-bleed color blocks
- Text: high contrast, use complementary colors, never grey on grey

### STYLE C — Editorial Clean (for health, finance, B2B):
- Background: warm off-white (#FAFAF7) or slate (#F1F5F8)
- Typography: tight columns, large numerics (stats), small caps for labels
- Thin lines and data-viz style graphics
- Minimal palette: 2 colors max + background

### STYLE D — Neon Glow (for gaming, crypto, energy):
- Background: deep navy/black
- Glowing text via textShadow and boxShadow on elements
- Scanline overlay: thin horizontal lines (1px, opacity 0.04, repeating-linear-gradient)
- Neon palette: cyan, magenta, electric green — one dominant, others as accents

## ━━ ALWAYS DO THESE ━━
1. CAMERA FIRST: Every scene wrapper gets a zoom/pan/drift transform animated by interpolate().
2. MOVING BACKGROUND: Background NEVER stays static. Use drifting blobs, slow pan, or animated gradient stops.
3. TEXT HIERARCHY: ONE big headline (120-200px), ONE supporting line (40-60px), never more than 3 text elements per scene.
4. STAGGER EVERYTHING: Multiple elements in a scene must enter with staggered delays (8-15 frames per item).
5. FONT LOADING: Load from @remotion/google-fonts. e.g.:
   \`import { loadFont } from "@remotion/google-fonts/Montserrat";\`
   \`const { fontFamily } = loadFont("normal", { weights: ["700", "900"] });\`
6. SCENE TRANSITIONS: Fade out last 15 frames of each scene (opacity 1→0) and fade in first 15f of next scene.
7. LINE REVEALS: Animated underlines/rules using width: interpolate → 0% to 100%.

## ━━ STRICTLY FORBIDDEN ━━
- NO CSS animations, transitions, or keyframes
- NO Tailwind
- NO generic purple+pink aurora backgrounds (unless product actually uses those colors)
- NO white glass cards (rgba(255,255,255,0.95)) — too generic
- NO setTimeout / setInterval
- NO static backgrounds — if background doesn't move, it must breathe (scale or opacity pulse)
- NO useFrame from @react-three/fiber
- ALL values computed from frame
- NO named-only exports — MUST have export default

## THREE.JS RULES (only if requested):
- ALL drei components MUST be inside ThreeCanvas from @remotion/three
- NEVER use useFrame — use useCurrentFrame() and pass frame as prop
- Set gl={{ preserveDrawingBuffer: true, antialias: true }} on ThreeCanvas

## UI MOCKUP SCENES (when provided):
- Render a tilted 3D perspective panel with an animated SVG cursor
- Spring entrance: scale 0.5→1, opacity 0→1
- Use EXACT colors from mockup data
- Camera MUST zoom into the UI panel slowly

## CRITICAL SYNTAX:
- NEVER put backticks inside interpolate() calls
- CORRECT: interpolate(frame, [0, 100], [0, 1], { extrapolateRight: "clamp" })
- Template literal values e.g. \`translateX(\${x}px)\` — every backtick must close

Output ONLY code. No chat. No markdown. Make it STUNNING.`;

export function buildFreestylePrompt(
  durationInFrames: number,
  duration: number,
  description: string | undefined,
  finalProductData: ProductData | null,
  videoScript: VideoScript | null,
  useThreeJs: boolean,
  audioSrcCode: string,
  uiMockupData: UIMockupData | null,
  screenshotsList: any[],
  enrichedImages: string[] = [],
  brandStyleSection: string = "",
  audioBpm: number = 120,
): string {
  const productContext = finalProductData
    ? `PRODUCT INFO:
Name: ${finalProductData.name}
Tagline: ${finalProductData.tagline}
Description: ${finalProductData.description}
Features: ${finalProductData.features?.map((f: any) => `${f.title}: ${f.description}`).join("\n") || "N/A"}
Colors: ${JSON.stringify(finalProductData.colors)}
Tone: ${finalProductData.tone}`
    : "";

  // Use enriched images (stock photos + filtered scraped) instead of raw scraped images
  const imagesList =
    enrichedImages.length > 0 ? enrichedImages : finalProductData?.images || [];
  const imagesSection =
    imagesList.length > 0
      ? `### STOCK / PRODUCT IMAGES (HIGH QUALITY — use these as cinematic scene backgrounds or hero shots):
${imagesList.map((img: string) => `- <Img src="${img}" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> with Ken Burns zoom (scale 1.0→1.12 over scene duration)`).join("\n")}
NEVER use a plain color background when you have one of these images — use them as full-bleed backgrounds with a dark overlay (rgba(0,0,0,0.5)) and your text on top.`
      : "";

  const scriptContext = videoScript
    ? `VIDEO SCRIPT:\n${JSON.stringify(videoScript, null, 2)}`
    : "";

  const threeJsNote = useThreeJs
    ? `\nUSE THREE.JS WITH @remotion/three: Create a 3D scene using ThreeCanvas from @remotion/three and drei.
Import: import { ThreeCanvas } from '@remotion/three'; import { Environment } from '@react-three/drei';
CRITICAL: Set gl={{ preserveDrawingBuffer: true, antialias: true }} on ThreeCanvas.
Wrap drei components in <React.Suspense fallback={null}>.
Camera MUST animate: interpolate() the position z or y value for a slow zoom.`
    : "";

  const fpb = (30 * 60) / audioBpm;
  const audioInstruction = audioSrcCode
    ? `\nAUDIO: Include <Audio src={${audioSrcCode}} volume={0.8} /> at the root level.
BEAT SYNC (${audioBpm} BPM):
- Frames per beat: ${fpb.toFixed(1)}, frames per measure (4 beats): ${(fpb * 4).toFixed(1)}
- Snap scene durations to beat multiples (${Math.round(fpb)} frames per beat)
- Add a useBeatSync hook: const useBeatSync = (bpm: number) => { const frame = useCurrentFrame(); const { fps } = useVideoConfig(); const fpb = (60/bpm)*fps; const p = (frame%fpb)/fpb; return { beatPulse: Math.exp(-p*4), fpb }; };
- Use beatPulse for subtle scale (1 + beatPulse*0.01) and glow effects on text
- Transition durations should be 1 beat (${Math.round(fpb)} frames)`
    : "\nNo audio track selected.";

  const uiMockupSection = uiMockupData
    ? generateMockupPromptSection(uiMockupData)
    : "";

  const fallbackScreenshotsSection =
    !uiMockupData && screenshotsList.length > 0
      ? `### PRODUCT SCREENSHOTS (render these with <Img> from remotion):
${screenshotsList.map((s: any) => `- src="${s.url}" — ${s.section}: ${s.description || ""}`).join("\n")}
For each screenshot: display inside a slightly tilted frame (perspective + rotateY 5-8deg), apply a slow Ken Burns zoom (scale 1.0→1.1 over 120f), fade in with spring().`
      : "";

  // Pick a visual style recommendation based on product tone
  const toneToStyle: Record<string, string> = {
    professional: "STYLE A — Dark Cinematic",
    luxury:
      "STYLE B — Vibrant Brand (use the gold/premium palette from the product)",
    playful: "STYLE B — Vibrant Brand (bold colors, large type)",
    minimalist: "STYLE C — Editorial Clean",
    technical: "STYLE A — Dark Cinematic",
    energetic: "STYLE D — Neon Glow",
    health: "STYLE C — Editorial Clean",
    finance: "STYLE C — Editorial Clean",
    gaming: "STYLE D — Neon Glow",
  };
  const tone = (finalProductData?.tone || "professional").toLowerCase();
  const suggestedStyle =
    Object.entries(toneToStyle).find(([key]) => tone.includes(key))?.[1] ||
    "STYLE A — Dark Cinematic";

  return `Create a ${duration}-second (${durationInFrames} frames at 30fps) CINEMATIC product video.

${description ? `USER DESCRIPTION: ${description}` : ""}

${productContext}${imagesSection ? `\n\n${imagesSection}` : ""}

${scriptContext}
${threeJsNote}
${audioInstruction}

${uiMockupSection}

${brandStyleSection}

## ━━ LOGO / BRAND NAME DISPLAY ━━
The product name "${finalProductData?.name || description?.split(" ").slice(0, 2).join(" ") || "Product"}" MUST appear:
- In Scene 1 (intro): BIG — minimum 120px font, centred, with a reveal animation
- In last scene (CTA): Displayed again, slightly smaller but still prominent
- DO NOT use small logo text — make it cinematic and bold

## ━━ MANDATORY CAMERA MOVEMENT ━━
EVERY scene wrapper div MUST have a camera transform animated with interpolate().
Variety required — alternate these across scenes:
1. Slow zoom in: scale interpolate(localFrame, [0, duration], [1.0, 1.12])
2. Slow zoom out: scale interpolate(localFrame, [0, duration], [1.15, 1.0]) 
3. Pan left: translateX interpolate(localFrame, [0, duration], [0, -60])
4. Pan right: translateX interpolate(localFrame, [0, duration], [0, 60])
5. Drift: translateY Math.sin(frame/45)*12
Use transformOrigin to control which corner the zoom anchors to (top-left, center-right, etc.).

## ━━ IMAGE USAGE RULES ━━
- NEVER use og images, favicons, or tiny icons from the website
- The stock photos in the IMAGES section above are HIGH QUALITY — use them as full-bleed scene backgrounds
- Apply a semi-transparent dark overlay (rgba(0,0,0,0.45)) over images so text reads clearly
- Apply Ken Burns zoom on every image (scale 1.0→1.12 over the scene duration)
- If no images are available, use the brand colors to create a rich gradient background instead

${
  brandStyleSection
    ? ""
    : `## ━━ COLORS ━━
${
  uiMockupData
    ? "USE THE EXACT COLORS FROM THE UI MOCKUP SECTION—extracted from real product screenshots."
    : finalProductData?.colors
      ? `BRAND COLORS: ${JSON.stringify(finalProductData.colors)}
Build the entire visual language around these. Dark variant: add 40% black overlay.`
      : "Pick ONE cinematic color scheme and commit to it (do NOT mix multiple schemes)."
}`
}

## ━━ TYPOGRAPHY ━━
- Load ONE display font from @remotion/google-fonts (Montserrat, Bebas Neue style via Oswald, or similar)
- Headlines: 100-180px, fontWeight 700-900, letterSpacing -2 to -4px
- Supporting text: 36-60px, fontWeight 400-500
- Labels/tags: 18-24px, uppercase, letterSpacing 4-6px
- Max 3 text elements visible at once per scene

## ━━ SCENE STRUCTURE ━━
For a ${duration}s video, create ${Math.max(3, Math.round(duration / 4))}-${Math.max(4, Math.round(duration / 3))} scenes.
Each scene:
- Has its OWN camera movement direction
- Has ONE primary message (headline + 1 supporting line max)
- Fades out last 12 frames (opacity 1→0) to transition
- Has background elements that MOVE (never static)

## ━━ ANTI-PATTERNS (FORBIDDEN) ━━
- NO static backgrounds
- NO generic purple/pink aurora (unless brand actually uses those colors)
- NO white glass cards unless product is a dashboard/SaaS UI being demoed
- NO opacity: 0 without animating to 1 within 30 frames
- First frame MUST show visible content

${fallbackScreenshotsSection}

Total frames: ${durationInFrames}.
Output ONLY the complete TSX code. Make every frame visually compelling.`;
}

// ============================================================
// Edit Video Prompt
// ============================================================

export function buildEditVideoPrompt(
  message: string,
  remotionCode: string,
  videoScript: any,
  productData: any,
  userPreferences: any,
  recordings: any[],
): string {
  const screenshots = productContextImages(productData);

  return `You are a video editor. The user wants to modify their video via chat.

USER REQUEST: "${message}"

CURRENT VIDEO COMPOSITION:
\`\`\`tsx
${remotionCode}
\`\`\`

AVAILABLE SCREENSHOTS (Use these if asked to swap/add images):
${screenshots}

AVAILABLE RECORDINGS (Use these if asked to swap/add video clips):
${recordings?.length ? recordings.map((r: any) => `- URL: ${r.videoUrl} (feature: ${r.featureName})`).join("\n") : "None available."}

INSTRUCTIONS:
1. Apply the user's requested changes to the code.
2. Ensure animations, springs, and layouts stay intact unless asked to change them.
3. Keep the same component structure and default export.
4. If a user asks to change colors, update the color variables.
5. NO EXPLANATIONS. NO MARKDOWN. Return ONLY the fully updated valid TypeScript React (.tsx) code.`;
}

function productContextImages(productData: any): string {
  if (!productData?.screenshots?.length) return "None available.";
  return productData.screenshots
    .map(
      (s: any) =>
        `- URL: ${s.url} (section: ${s.section}, desc: ${s.description})`,
    )
    .join("\n");
}

// ============================================================
// Edit Script Prompt
// ============================================================

export const EDIT_SCRIPT_SYSTEM_PROMPT = `You are a video script editor. You receive a video script (JSON) and a user's edit instruction.
Apply the requested changes and return the COMPLETE updated script as valid JSON.

Rules:
- Preserve the exact JSON structure: { totalDuration, scenes[], transitions[], music }
- Each scene has: id, startFrame, endFrame, type, content, animation, style
- After editing, recalculate startFrame/endFrame sequentially (each scene starts where the previous ends)
- Update totalDuration to match the last scene's endFrame
- Scene durations are in frames at 30fps (e.g., 90 frames = 3 seconds)
- Valid scene types: "intro", "feature", "tagline", "value-prop", "screenshot", "testimonial", "recording", "cta"
- Keep scene IDs stable when modifying existing scenes
- When adding scenes, generate IDs like "scene-<timestamp>"
- When reordering, just move scenes and recalculate frames
- When the user says to make something shorter/longer, adjust endFrame - startFrame for those scenes
- Preserve all fields you don't need to change

Return ONLY the updated JSON. No markdown fences, no explanation.`;
