/**
 * REMOTION TRANSLATOR AGENT
 *
 * Converts a VideoScript directly into Remotion composition code.
 * Single-step generation — no intermediate React page.
 *
 * Uses modular skill injection: only the relevant style + animation
 * skills are injected per generation, keeping prompt size under 20KB.
 */

import { chatWithGeminiPro } from "./model";
import type { VideoGenerationStateType } from "./state";
import {
  analyzeRecording,
  type RecordingAnalysisResult,
} from "./recordingAnalyzer";
import type { BrandStyle } from "./brandAnalyser";

// ============================================================================
// MODULAR REMOTION SKILLS - Only inject relevant sections per generation
// ============================================================================

// Core skills always included (~3KB) — essential Remotion patterns
const SKILL_CORE = `
## REMOTION CORE RULES

### ANIMATIONS (CRITICAL)
All animations MUST use \`useCurrentFrame()\` + \`interpolate()\` or \`spring()\`.
⚠️ CSS transitions/animations are FORBIDDEN — they flicker in Remotion rendering.
⚠️ Tailwind animation classes are FORBIDDEN.
⚠️ NO Math.random(), Date.now(), backdrop-filter, WebkitBackdropFilter, setTimeout, setInterval.

### ANTI-FLICKER (CRITICAL)
Remotion renders frames concurrently in parallel browser tabs. Any non-deterministic or sub-pixel operation causes flicker:
- NEVER use \`backdropFilter\` or \`WebkitBackdropFilter\` — use solid semi-transparent backgrounds instead (\`rgba()\`)
- Round ALL computed pixel values: \`Math.round(interpolate(...))\` for transforms/positions
- NEVER use \`filter: blur()\` with values above 60px — large blurs (80px+) flicker badly. Use solid semi-transparent \`rgba()\` backgrounds or subtle gradients instead.
- For soft glow/bokeh effects, use \`radial-gradient()\` with transparent edges instead of blur filters.
- Avoid per-word \`filter: blur()\` animations — use opacity + translateY only for word reveals.
- Keep \`textShadow\` to max 2 layers — large multi-layer glow shadows flicker
- CRITICAL: After entry animations complete, SNAP to exact final values. \`interpolate\` and \`spring\` produce floating-point micro-variations that cause jitter on static elements:

\`\`\`tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
const frame = useCurrentFrame();
const { fps } = useVideoConfig();
const ENTRY_DUR = 20;
const done = frame >= ENTRY_DUR; // snap after animation
const opacity = done ? 1 : interpolate(frame, [0, ENTRY_DUR], [0, 1], { extrapolateRight: "clamp" });
const scale = done ? 1 : spring({ frame, fps, config: { damping: 200 } });
// Use transform: 'none' when done — removes sub-pixel jitter
const style = { opacity, transform: done ? 'none' : \\\`scale(\\\${scale})\\\` };
\`\`\`
- Remove \`willChange\` after animation completes — it forces GPU compositing which amplifies sub-pixel jitter on static elements

### SEQUENCING
Use \`<Sequence>\` with premountFor. Overlap sequences for continuous motion:
\`\`\`tsx
<Sequence from={0} durationInFrames={90} premountFor={15}><Scene1 /></Sequence>
<Sequence from={75} durationInFrames={90} premountFor={15}><Scene2 /></Sequence>
\`\`\`

### TRANSITIONS
\`\`\`tsx
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
\`\`\`

### FONTS
\`\`\`tsx
import { loadFont } from "@remotion/google-fonts/Montserrat";
const { fontFamily } = loadFont("normal", { weights: ["400","600","700","800","900"], subsets: ["latin"] });
\`\`\`
Call loadFont at TOP LEVEL (module scope), never inside a component.

### TEXT SPACING (CRITICAL)
Word-by-word \`<span>\` elements MUST use parent: display:'flex', flexWrap:'wrap', gap:'0.3em'.

### STRICTLY FORBIDDEN
- NO CSS transitions/animations, NO Tailwind animation classes
- NO setTimeout/setInterval, NO Math.random(), NO Date.now()
- NO backdrop-filter (flickers), NO CSS background-image for URLs (use <Img>)
- NO relative imports (render service has no local files)
- NO useFrame from @react-three/fiber
- MUST have export default VideoComposition;
`;

// Text animation skills (~3KB)
const SKILL_TEXT_ANIMATIONS = `
### TEXT ANIMATIONS — LANDING PAGE TYPOGRAPHY

Think like a top-tier landing page designer. Text is NOT just information — it's a visual element. Use scale, weight, spacing, and timing to create hierarchy and drama.

#### WordByWord (staggered word reveal — primary headline animation):
\`\`\`tsx
const WordByWord: React.FC<{ words: string[]; fontSize?: number; color?: string; delay?: number; staggerFrames?: number }> = ({
  words, fontSize = 48, color = '#ffffff', delay = 0, staggerFrames = 5,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: Math.round(fontSize * 0.3), justifyContent: 'center' }}>
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * staggerFrames);
        const done = f >= 15;
        const op = done ? 1 : interpolate(f, [0, 15], [0, 1], { extrapolateRight: "clamp" });
        const ty = done ? 0 : Math.round(interpolate(f, [0, 15], [30, 0], { extrapolateRight: "clamp" }));
        return (
          <span key={i} style={{
            fontSize, fontWeight: 600, opacity: op,
            transform: done ? 'none' : \\\`translateY(\\\${ty}px)\\\`,
            display: 'inline-block', ...(color ? { color } : {}),
          }}>{word}{' '}</span>
        );
      })}
    </div>
  );
};
\`\`\`

#### Typography patterns to use:
- **Hero headlines**: 120-180px, tight letter-spacing (-3 to -6px), font-weight 900. Split into 2 lines with accent color on key words.
- **Accent text**: Use \`background: linear-gradient(...)\` + \`WebkitBackgroundClip: 'text'\` + \`WebkitTextFillColor: 'transparent'\` for gradient text on key phrases.
- **Counters/stats**: Oversized numbers (80-120px, weight 900) with small uppercase labels below (14-18px, letter-spacing 4-6px, weight 600, rgba(255,255,255,0.5)).
- **Subtext**: 24-32px, weight 400, rgba(255,255,255,0.6), line-height 1.6. Never same size as headline.
- **SweepLine**: Thin 2-3px accent line that animates width 0→200px. Use between headline and subtext.
- **Clip-path reveal**: Reveal text with \`clipPath: 'inset(0 '+pct+'% 0 0)'\` animating from 100% to 0%.
`;

// Camera movement skills (~2.5KB)
const SKILL_CAMERA = `
### CINEMATIC CAMERA & SCENE CONTINUITY (MANDATORY)

Every scene MUST have continuous motion — nothing should ever be static. Think of the camera as always moving, like a Steadicam dolly shot in a film. Alternate between these techniques per scene:

#### 1. Ken Burns (slow zoom — hero/CTA scenes):
\`\`\`tsx
const camScale = interpolate(frame, [0, duration], [1.0, 1.12], { extrapolateRight: 'clamp' });
style={{ transform: 'scale(' + camScale + ')', transformOrigin: 'center center' }}
\`\`\`

#### 2. Parallax Layers (depth — feature scenes):
Create 2-3 layers moving at different speeds. Background moves slow, foreground moves fast:
\`\`\`tsx
const bgX = Math.round(interpolate(frame, [0, dur], [0, -40], { extrapolateRight: 'clamp' }));
const midX = Math.round(interpolate(frame, [0, dur], [0, -90], { extrapolateRight: 'clamp' }));
const fgX = Math.round(interpolate(frame, [0, dur], [0, -160], { extrapolateRight: 'clamp' }));
// Apply to 3 stacked AbsoluteFill layers
\`\`\`

#### 3. Reveal Pan (content slides into frame):
Content starts off-screen and pans into view. Great for feature cards and text blocks:
\`\`\`tsx
const slideX = Math.round(interpolate(frame, [0, 25], [200, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }));
\`\`\`

#### 4. Diagonal Drift (ambient background motion):
Background elements drift on diagonal paths. Creates depth without being distracting:
\`\`\`tsx
const driftX = Math.round(Math.sin(frame / 60) * 30);
const driftY = Math.round(Math.cos(frame / 80) * 20);
\`\`\`

#### 5. Scale-to-Reveal (dramatic entrances):
Element starts scaled up large and zooms out to reveal context:
\`\`\`tsx
const revealScale = interpolate(frame, [0, 30], [2.5, 1.0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.expo) });
\`\`\`

#### Scene-to-Scene Flow:
- Scene 1 (intro): Ken Burns zoom IN + diagonal drift background
- Scene 2 (tagline): Ken Burns zoom OUT + parallax pan
- Scene 3 (feature): Pan LEFT reveal + parallax layers
- Scene 4 (feature): Pan RIGHT reveal + parallax layers (mirror)
- Scene 5 (demo/stats): Scale-to-reveal + floating elements
- Scene 6 (CTA): Slow Ken Burns zoom IN + drift
- Overlap sequences by 15 frames for crossfade continuity
`;

// Style-specific skills — only ONE injected per generation
// IMPORTANT: No hardcoded colors here — all colors come from the BRAND constant
// which is populated from the actual website's extracted color palette.
const STYLE_SKILLS: Record<string, string> = {
  "dark-cinematic": `
### STYLE: DARK CINEMATIC

**Visual Language:**
- Background: use BRAND.bg (dark from website). NEVER pure black. Add subtle noise texture via repeating-linear-gradient with 1px lines at 0.02 opacity.
- Gradient mesh backgrounds: 2-3 large radial-gradient circles (800-1200px), using BRAND.primary and BRAND.secondary at 0.08-0.15 opacity, slowly drifting via Math.sin/cos.
- Accent elements: thin horizontal lines (2px height, 100-300px width, BRAND gradient fill) that sweep in from left.

**Typography (Premium Feel):**
- Hero text: 140-180px, weight 900, letter-spacing -5px, line-height 0.9. Split across 2 lines. First line BRAND.text color, second line gradient (BRAND.primary → BRAND.secondary).
- Feature headlines: 64-80px, weight 800, letter-spacing -2px.
- Body/subtext: 24-28px, weight 400, BRAND.textMuted color, line-height 1.6.
- Stats: 80-120px weight 900 number + 16px uppercase label below with letter-spacing 4px.

**Layout (Landing Page Grid):**
- Generous whitespace — padding: 80-120px on sides. Content should breathe.
- Feature scenes: split layout — text on left (60%), visual on right (40%), or centered with card below.
- Stat scenes: 3-4 stats in a row with equal spacing, centered.
- CTA: centered, stacked — small label → big headline → accent line → button.

**Cards:**
- Background: BRAND.primary at 0.03-0.06 opacity with 1px border at 0.06 opacity.
- Subtle inner glow: boxShadow with BRAND.primary at low opacity for top edge highlight.
- Entry: scale 0.95→1 + translateY 30→0 over 20 frames, snap to final.
`,
  "vibrant-brand": `
### STYLE: VIBRANT BRAND

**Visual Language:**
- Background: bold BRAND color fills. Use BRAND.primary as full-bleed background for some scenes.
- Alternate scenes between BRAND.bg and BRAND.primary backgrounds for visual variety.
- Geometric shapes: large rounded rectangles, circles, diagonal color blocks using BRAND colors. Animate them (slide in, scale up, rotate).

**Typography:**
- MASSIVE headlines: 160-220px, weight 900, fills the viewport. Text IS the design.
- High contrast: BRAND.text on BRAND.primary, or white on BRAND.bg. Never grey on grey.
- Short punchy copy: 3-5 words max per headline. Let each word breathe.

**Animation Energy:**
- Faster cuts: 2-3 second scenes, punchy timing.
- Scale pop entrances: spring with damping:8 stiffness:200 for snappy feel.
- Wipe reveals: clipPath 'inset(0 100% 0 0)' → 'inset(0 0% 0 0)' for bold reveals.
- Color block transitions: BRAND-colored div slides across to reveal next scene.
`,
  "editorial-clean": `
### STYLE: EDITORIAL CLEAN

**Visual Language:**
- Background: use BRAND.bg (light backgrounds work best for this style). Never pure white.
- Accent: BRAND.accent used sparingly — thin lines, small dots, text highlights.
- Minimal decoration: no glows, no heavy gradients. Clean flat surfaces using BRAND colors.

**Typography:**
- Clean font feel. Large numerics (96-140px) in BRAND.primary, paired with small labels in BRAND.textMuted.
- Text columns: left-aligned, max-width 800px, generous line-height (1.7).
- Small caps for category labels: 14px, weight 600, letter-spacing 6px, text-transform uppercase.

**Animation:**
- Subtle: gentle fades (25-30 frames), minimal scale change (1.0→1.03 max).
- Horizontal wipes for transitions. Vertical reveals for text.
- Clean spacing: 80-120px margins. Content area centered, max 1200px wide.
`,
  "neon-glow": `
### STYLE: NEON GLOW

**Visual Language:**
- Background: BRAND.bg with subtle scan lines via repeating-linear-gradient(0deg, transparent 0, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 3px).
- Glow effects: textShadow with 2 layers — inner glow (0 0 10px BRAND.accent) + outer glow (0 0 40px BRAND.accent at 0.3 opacity). Max 2 layers.
- Neon accents: borders with boxShadow using BRAND.accent at 0.4 and 0.1 opacity.
- Grid lines: thin 1px lines in a grid pattern at 0.03 opacity using BRAND.primary.

**Typography:**
- Sharp, technical: weight 700-900, tight tracking. Numbers look great in this style.
- Glow on key words only — not every element. Glow color = BRAND.accent.

**Animation:**
- Quick, sharp: damping:6 stiffness:300 for snappy springs.
- Glitch-style reveals: rapid opacity flicker over 5 frames then settle.
- Aggressive camera: zoom ranges 1.0→1.15, faster pans.
`,
};

// Beat sync skills — injected when audio BPM is available
const SKILL_BEAT_SYNC = `
### BEAT SYNC
Use beat timing for scene transitions and motion timing — NOT for pulsing static elements:
\`\`\`tsx
const useBeatSync = (bpm: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const framesPerBeat = (60 / bpm) * fps;
  const beatProgress = (frame % framesPerBeat) / framesPerBeat;
  const beatPulse = Math.exp(-beatProgress * 4);
  return { beatPulse, beatProgress, framesPerBeat };
};
\`\`\`

**CORRECT uses of beatPulse:**
- Scene transition timing: start sequences on beat boundaries
- Camera movement speed: vary dolly/orbit speed on beats
- Element entry timing: stagger card/word entries to beat subdivisions (1/2, 1/4 beat)
- Moving elements: floating meshes, cursor speed, particle drift

**WRONG uses (causes visible flicker/jitter):**
- ❌ Scale text by \`(1 + beatPulse * 0.015)\` — makes words visibly jitter
- ❌ Pulse opacity of static text/cards — creates strobe effect
- ❌ Any beatPulse on elements that should be still after entry animation
- ❌ Beat-driven glow/shadow changes on text

Snap scene durations to beat boundaries. Align stagger delays to beat subdivisions.
`;

// Screen recording skills — only injected when recordings exist
const SKILL_RECORDINGS = `
### SCREEN RECORDING PLAYBACK
\`\`\`tsx
import { Video } from 'remotion';
const RecordingScene: React.FC<{ videoUrl: string; featureName: string }> = ({ videoUrl, featureName }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const labelOpacity = interpolate(frame, [0, 30, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }}>
      <Video src={videoUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: labelOpacity, zIndex: 10 }}>
        <div style={{ background: 'rgba(0,0,0,0.7)', borderRadius: 12, padding: '12px 28px' }}>
          <span style={{ fontWeight: 600, fontSize: 20, color: '#ffffff' }}>{featureName}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
\`\`\`
`;

// Cursor animation skills — optional, for demo-style videos
const SKILL_CURSOR = `
### ANIMATED CURSOR WITH CLICK EFFECTS (MUST include in at least 1 scene)

Inline these SVG cursor components and use them for a demo-like feel:

\`\`\`tsx
// --- MAC CURSOR SVG (paste at module level) --- a classic Mac arrow pointer
const MacCursorSVG = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8.5 2.5L8.5 22.5L13.5 17.5L18.5 25.5L22.5 23.5L17.5 15.5L24.5 14.5L8.5 2.5Z" fill="white" stroke="black" strokeWidth="1.5"/>
  </svg>
);

// --- CLICK RIPPLE (paste at module level) ---
const ClickRipple: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  const rings = [
    { delay: 0, maxScale: 1.5, dur: 15, color: 'rgba(255,255,255,0.9)', sw: 3 },
    { delay: 3, maxScale: 2.2, dur: 20, color: 'rgba(255,107,157,0.7)', sw: 2.5 },
    { delay: 6, maxScale: 3.0, dur: 25, color: 'rgba(59,130,246,0.5)', sw: 2 },
  ];
  return (<>{rings.map((r, i) => {
    const f = Math.max(0, frame - r.delay);
    const s = spring({ frame: f, fps, config: { damping: 12, stiffness: 80 } });
    const o = Math.max(0, 1 - f / r.dur);
    return (<div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: 40, height: 40, marginLeft: -20, marginTop: -20, borderRadius: '50%', border: r.sw + 'px solid ' + r.color, transform: 'scale(' + (1 + s * (r.maxScale - 1)) + ')', opacity: o, pointerEvents: 'none' }} />);
  })}</>);
};

// --- USAGE in a scene: cursor moves to button then clicks ---
const CursorDemo: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - startFrame);
  // Move: frames 0-30, Pause: 30-40, Click: 40+
  const moveEnd = 30;
  const clickFrame = 40;
  const cx = Math.round(interpolate(f, [0, moveEnd], [200, 960], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }));
  const cy = Math.round(interpolate(f, [0, moveEnd], [700, 540], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }));
  const isClick = f >= clickFrame;
  const clickScale = isClick ? spring({ frame: f - clickFrame, fps: 30, config: { damping: 8, stiffness: 200 } }) : 1;
  return (
    <div style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-10px,-10px) scale(' + clickScale + ')', zIndex: 100, filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.25))' }}>
      <MacCursorSVG />
      {isClick && <ClickRipple frame={f - clickFrame} fps={30} />}
    </div>
  );
};
\`\`\`

**Rules**:
- Add cursor animation in at least ONE scene (CTA or feature demo)
- Cursor should move from off-screen or corner → towards a CTA button → click with ripple
- Use \`Easing.out(Easing.cubic)\` for natural cursor movement
- Round all cursor positions with \`Math.round()\` to avoid sub-pixel flicker
`;

const SKILL_3D = `
### 3D SCENE BACKGROUNDS (use ThreeCanvas for hero/intro/CTA scenes)

Use \`@remotion/three\` + \`three\` for 3D floating geometry backgrounds. Inline these components:

\`\`\`tsx
import { ThreeCanvas } from '@remotion/three';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

// --- 3D SCENE WRAPPER (module level) ---
const ThreeScene: React.FC<{ children?: React.ReactNode; cameraPosition?: [number,number,number]; cameraFov?: number }> = ({ children, cameraPosition = [0,2,8], cameraFov = 50 }) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas orthographic={false} width={width} height={height}
      camera={{ position: cameraPosition, fov: cameraFov }}
      style={{ position: 'absolute', top: 0, left: 0 }}
      gl={{ alpha: true }}>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -5, 5]} intensity={0.4} color="#8888ff" />
      {children}
    </ThreeCanvas>
  );
};

// --- ANIMATED CAMERA (inside ThreeScene) ---
const AnimatedCamera: React.FC<{ orbitSpeed?: number; dollyRange?: [number,number] }> = ({ orbitSpeed = 0.5, dollyRange = [8, 5] }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { camera } = useThree();
  const progress = frame / durationInFrames;
  const angle = progress * Math.PI * 2 * orbitSpeed;
  const radius = interpolate(frame, [0, durationInFrames], dollyRange, { extrapolateRight: 'clamp' });
  camera.position.x = Math.sin(angle) * radius;
  camera.position.z = Math.cos(angle) * radius;
  camera.position.y = interpolate(progress, [0, 1], [1.5, 2.5], { extrapolateRight: 'clamp' });
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  camera.updateProjectionMatrix();
  return null;
};

// --- FLOATING 3D SHAPES (inside ThreeScene) ---
const FloatingMesh: React.FC<{ geo: 'torus'|'icosahedron'|'octahedron'|'torusKnot'; pos: [number,number,number]; color: string; scale?: number; wireframe?: boolean; idx?: number }> = ({ geo, pos, color, scale = 0.6, wireframe = false, idx = 0 }) => {
  const frame = useCurrentFrame();
  const rx = frame * 0.015 * (1 + idx * 0.3);
  const ry = frame * 0.01 * (1 + idx * 0.2);
  const dx = Math.sin(frame * 0.02 + idx * 2) * 0.4;
  const dy = Math.cos(frame * 0.016 + idx * 1.5) * 0.3;
  const breathe = 1 + Math.sin(frame * 0.03 + idx) * 0.08;
  const Geo = geo === 'torus' ? <torusGeometry args={[1, 0.4, 16, 32]} />
    : geo === 'torusKnot' ? <torusKnotGeometry args={[0.8, 0.3, 64, 16]} />
    : geo === 'octahedron' ? <octahedronGeometry args={[1, 0]} />
    : <icosahedronGeometry args={[1, 0]} />;
  return (
    <mesh position={[pos[0]+dx, pos[1]+dy, pos[2]]} rotation={[rx, ry, 0]} scale={[scale*breathe, scale*breathe, scale*breathe]}>
      {Geo}
      <meshStandardMaterial color={color} wireframe={wireframe} transparent opacity={0.65} roughness={0.3} metalness={0.6} />
    </mesh>
  );
};
\`\`\`

**Usage in a scene** (layer 3D behind 2D text):
\`\`\`tsx
<Sequence from={0} durationInFrames={90}>
  <AbsoluteFill>
    <ThreeScene>
      <AnimatedCamera orbitSpeed={0.3} dollyRange={[10, 6]} />
      <FloatingMesh geo="torus" pos={[-3,1,0]} color={C.accent} idx={0} />
      <FloatingMesh geo="icosahedron" pos={[3,-1,2]} color={C.accentAlt} wireframe idx={1} />
      <FloatingMesh geo="torusKnot" pos={[0,2,-2]} color={C.accent} scale={0.4} idx={2} />
    </ThreeScene>
    {/* 2D overlay text on top */}
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
      <h1 style={{ fontSize: 120, color: '#fff', fontWeight: 800 }}>Your Brand</h1>
    </div>
  </AbsoluteFill>
</Sequence>
\`\`\`

**Rules**:
- Use 3D scenes for intro/hero and CTA scenes (1-2 scenes per video, NOT every scene)
- NEVER use \`useFrame\` from @react-three/fiber — use \`useCurrentFrame()\` from remotion
- Layer: ThreeScene behind, 2D text/cards on top with zIndex
- 3-5 floating meshes max per scene to keep render fast
- Mix wireframe and solid meshes for variety
`;

const SKILL_COMPONENTS = `
### UI COMPONENTS — LANDING PAGE QUALITY (inline these)

Design every scene like a section on a $50K landing page. NO plain divs with text — every content block should have structure, depth, and polish.

\`\`\`tsx
// --- SPOTLIGHT CARD (moving gradient spotlight — for feature highlights) ---
const SpotlightCard: React.FC<{ children: React.ReactNode; width?: number; height?: number; delay?: number }> = ({ children, width = 600, height = 400, delay = 0 }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const done = f >= 20;
  const angle = (f / 60) * Math.PI * 2;
  const spotX = Math.round(50 + Math.cos(angle) * 30);
  const spotY = Math.round(50 + Math.sin(angle) * 30);
  const opacity = done ? 1 : interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const ty = done ? 0 : Math.round(interpolate(f, [0, 20], [40, 0], { extrapolateRight: 'clamp' }));
  return (
    <div style={{ width, height, borderRadius: 24, background: 'rgba(255,255,255,0.02)', position: 'relative', overflow: 'hidden', opacity, transform: done ? 'none' : 'translateY('+ty+'px)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle 250px at '+spotX+'% '+spotY+'%, rgba(var(--brandRgb), 0.12), transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'relative', zIndex: 1, padding: 48, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{children}</div>
    </div>
  );
};

// --- TILT CARD (continuous 3D perspective — for hero content) ---
const TiltCard: React.FC<{ children: React.ReactNode; width?: number; height?: number; maxTilt?: number; delay?: number }> = ({ children, width = 600, height = 400, maxTilt = 8, delay = 0 }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const t = f / 50;
  const rotY = Math.round(Math.sin(t) * maxTilt);
  const rotX = Math.round(Math.sin(t * 2) * (maxTilt / 2));
  const done = f >= 25;
  const opacity = done ? 1 : interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const s = done ? 1 : interpolate(f, [0, 25], [0.85, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ perspective: '1200px' }}>
      <div style={{ width, height, borderRadius: 24, background: 'linear-gradient(145deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))', transform: 'rotateX('+rotX+'deg) rotateY('+rotY+'deg)' + (done ? '' : ' scale('+s+')'), opacity, padding: 48, border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  );
};

// --- FEATURE ROW (icon + title + description — horizontal layout) ---
const FeatureRow: React.FC<{ icon: string; title: string; desc: string; color: string; delay?: number }> = ({ icon, title, desc, color, delay = 0 }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const done = f >= 20;
  const op = done ? 1 : interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const tx = done ? 0 : Math.round(interpolate(f, [0, 20], [60, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) }));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: op, transform: done ? 'none' : 'translateX('+tx+'px)' }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: 'linear-gradient(135deg, '+color+', '+color+'80)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', fontFamily }}>{title}</div>
        <div style={{ fontSize: 18, fontWeight: 400, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontFamily, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
};

// --- STAT COUNTER (animated number with snap) ---
const StatCounter: React.FC<{ value: number; label: string; suffix?: string; color?: string; delay?: number }> = ({ value, label, suffix = '', color = '#ffffff', delay = 0 }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const done = f >= 45;
  const num = done ? value : interpolate(f, [0, 45], [0, value], { extrapolateRight: 'clamp' });
  const op = f >= 15 ? 1 : interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ textAlign: 'center', opacity: op }}>
      <div style={{ fontSize: 96, fontWeight: 900, fontFamily, color, letterSpacing: '-3px' }}>{Math.floor(num).toLocaleString()}{suffix}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 5, marginTop: 12, fontFamily }}>{label}</div>
    </div>
  );
};

// --- PILL BADGE (small label above headlines) ---
const PillBadge: React.FC<{ text: string; color: string; delay?: number }> = ({ text, color, delay = 0 }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const done = f >= 15;
  const op = done ? 1 : interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const ty = done ? 0 : Math.round(interpolate(f, [0, 15], [15, 0], { extrapolateRight: 'clamp' }));
  return (
    <div style={{ display: 'inline-flex', padding: '8px 20px', borderRadius: 100, border: '1px solid '+color+'40', background: color+'15', opacity: op, transform: done ? 'none' : 'translateY('+ty+'px)', marginBottom: 24 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: color, textTransform: 'uppercase', letterSpacing: 3, fontFamily }}>{text}</span>
    </div>
  );
};
\`\`\`

**Scene Composition Rules (landing page design):**
- Every feature scene: PillBadge label → Large headline → SweepLine → Subtext. Stagger entries by 10-15 frames.
- Feature cards: SpotlightCard with FeatureRow items inside, staggered by 8 frames.
- Stats scene: 3-4 StatCounters in a horizontal flexbox, gap: 80-120px, staggered by 10 frames.
- CTA: PillBadge → Big headline → accent line → gradient button with cursor click.
- NEVER use plain text without a visual container — always wrap in cards, use accent lines, or pair with icons.
`;

/**
 * Build a focused prompt by selecting only relevant skills for this generation.
 * Reduces prompt from ~86KB to ~8-15KB depending on features used.
 */
function buildSkillsPrompt(state: VideoGenerationStateType): string {
  const parts: string[] = [SKILL_CORE];

  // Always include text animations and camera
  parts.push(SKILL_TEXT_ANIMATIONS);
  parts.push(SKILL_CAMERA);

  // Select style-specific skills based on brand analysis or user preference
  const brandStyle = (state.productData as any)?.brandStyle as BrandStyle | undefined;
  const tone = brandStyle?.mood?.tone || (state.productData as any)?.tone || state.userPreferences?.style || "professional";
  const designInsights = ((state.productData as any)?.designInsights || "").toLowerCase();
  const videoType = state.userPreferences?.videoType || "creative";

  // Prefer brandStyle.videoStyle.recommended if available
  let styleKey = "dark-cinematic"; // default
  const recommended = brandStyle?.videoStyle?.recommended?.toLowerCase() || "";
  if (recommended.includes("vibrant") || recommended.includes("style b")) {
    styleKey = "vibrant-brand";
  } else if (recommended.includes("editorial") || recommended.includes("style c")) {
    styleKey = "editorial-clean";
  } else if (recommended.includes("neon") || recommended.includes("style d")) {
    styleKey = "neon-glow";
  } else if (recommended.includes("cinematic") || recommended.includes("style a")) {
    styleKey = "dark-cinematic";
  } else if (tone === "playful" || tone === "bold" || tone === "energetic" || videoType === "fast-paced") {
    styleKey = "vibrant-brand";
  } else if (tone === "minimal" || designInsights.includes("editorial") || designInsights.includes("clean")) {
    styleKey = "editorial-clean";
  } else if (designInsights.includes("neon") || designInsights.includes("glow") || designInsights.includes("gaming")) {
    styleKey = "neon-glow";
  }
  parts.push(STYLE_SKILLS[styleKey]);
  console.log(`[RemotionTranslator] Selected style: ${styleKey} (recommended: ${recommended || "none"})`);

  // Beat sync — always useful when audio is present
  if (state.userPreferences?.audio?.bpm) {
    parts.push(SKILL_BEAT_SYNC);
  }

  // Recordings — only when recordings exist
  if (state.recordings && state.recordings.length > 0) {
    parts.push(SKILL_RECORDINGS);
  }

  // Cursor — include for all video types (adds demo polish)
  parts.push(SKILL_CURSOR);

  // 3D backgrounds — for cinematic/creative/bold videos
  if (videoType !== "demo" || tone === "bold" || tone === "playful" || styleKey === "dark-cinematic" || styleKey === "neon-glow") {
    parts.push(SKILL_3D);
  }

  // UI components — always include for polished card/stat scenes
  parts.push(SKILL_COMPONENTS);

  const combined = parts.join("\n");
  console.log(`[RemotionTranslator] Skills prompt size: ${(combined.length / 1024).toFixed(1)}KB (was ~86KB)`);
  return combined;
}

// Keep legacy REMOTION_SKILLS reference for backward compatibility (used in system prompt)
const REMOTION_SKILLS = `(Skills injected dynamically per generation — see buildSkillsPrompt)`;

const REMOTION_SKILLS_PLACEHOLDER = REMOTION_SKILLS; // suppress unused warning

// NOTE: Old monolithic REMOTION_SKILLS content was removed.
// Skills are now modularly injected via buildSkillsPrompt().

// Old content from lines 270-690 deleted (aurora backgrounds, glass cards,
// recording playback, cursor animation code examples, camera movements).
// These patterns are now in the modular SKILL_* constants above.

/**
 * Build the system prompt dynamically with only relevant skills injected.
 * This reduces prompt size from ~86KB to ~8-15KB per call.
 */
function buildSystemPrompt(skills: string, brandStyle?: BrandStyle): string {
  const brandDesignGuidance = brandStyle ? `

## BRAND STYLE GUIDE (extracted from the actual website — follow this closely)

### COLORS (use these EXACTLY in the BRAND constant — do NOT invent colors):
\`\`\`tsx
const BRAND = {
  primary: '${brandStyle.colors.primary}',
  secondary: '${brandStyle.colors.secondary}',
  accent: '${brandStyle.colors.accent}',
  bg: '${brandStyle.colors.background}',
  text: '${brandStyle.colors.text}',
  textMuted: '${brandStyle.colors.textMuted}',${brandStyle.colors.gradient ? `\n  gradient: '${brandStyle.colors.gradient}',` : ""}
};
\`\`\`

### TYPOGRAPHY:
- Load "${brandStyle.videoStyle.fontRecommendation || brandStyle.typography.primaryFont}" from @remotion/google-fonts
- Heading weight: ${brandStyle.typography.headingWeight}
- Letter spacing: ${brandStyle.typography.letterSpacing === "tight" ? "-2 to -4px" : brandStyle.typography.letterSpacing === "wide" ? "2-4px" : "normal"}
- Text transform: ${brandStyle.typography.textTransform}

### DESIGN LANGUAGE (match the website's actual design):
- Design style: ${brandStyle.design.style}${brandStyle.design.usesGradients ? " with gradients" : ""}
- Dark mode: ${brandStyle.design.usesDarkMode ? "yes — use dark backgrounds" : "no — use light backgrounds"}
- Corner radius: ${brandStyle.design.cornerRadius}
- Shadows: ${brandStyle.design.shadowStyle}
- Dominant shapes: ${brandStyle.design.dominantShapes}

### MOOD & ENERGY:
- Tone: ${brandStyle.mood.tone}, Energy: ${brandStyle.mood.energy}
- Keywords: ${brandStyle.mood.keywords.join(", ")}

### VIDEO DIRECTION:
- Camera: ${brandStyle.videoStyle.cameraMovement}
- Text style: ${brandStyle.videoStyle.textStyle}
- Background approach: ${brandStyle.videoStyle.backgroundApproach}

**CRITICAL: The video must look like it was made BY the brand's own design team. Match the website's colors, typography feel, and visual personality. Every video should look UNIQUE to the brand.**
` : "";

  return `You are a Remotion expert who creates premium product videos that look like they were designed by each brand's own creative team.

CRITICAL DESIGN PHILOSOPHY:
- Every video must look DIFFERENT — tailored to the specific brand's visual identity.
- Extract the design DNA from the brand's colors, typography, and mood. Mirror their website's aesthetic.
- Do NOT fall back to generic purple/pink gradients or cookie-cutter layouts.
- Use the BRAND constant colors throughout — backgrounds, text, accents, gradients, glows, cards.
- If the brand uses light backgrounds, the video should use light backgrounds. If dark, use dark. Match them.

${skills}
${brandDesignGuidance}
---

## YOUR TASK

Create a Remotion video from a VideoScript that looks like the brand's OWN marketing video — not a generic template. Study the brand colors, typography, and design patterns provided, then create something that feels native to that brand.

## REQUIREMENTS

1. **BRAND-MATCHED COLORS**: Define a BRAND constant at top of file using the EXACT colors from the brand guide above:
   \`\`\`tsx
   const BRAND = { primary: '#...', secondary: '#...', accent: '#...', bg: '#...', text: '#...', textMuted: '#...' };
   \`\`\`
   ALL visual elements must use BRAND colors. No hardcoded generic colors.

2. **MOVING BACKGROUND (MANDATORY)**: Every background MUST move (gradient drift, mesh animation, or organic motion). Use BRAND colors for all background elements.

3. **SCENE TRANSITIONS**: Fade in/out over 12 frames at scene edges.

4. **REQUIRED IMPORTS**:
   \`\`\`tsx
   import React from 'react';
   import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from 'remotion';
   \`\`\`

5. **OUTPUT FORMAT**: Main component = "VideoComposition". MUST end with: export default VideoComposition;

6. **TEMPLATE LITERAL SYNTAX**: Every opening backtick MUST have a closing backtick. Complete template literals before commas in style objects.`;
}

// ============================================================================
// CODE VALIDATION AND FIXING
// ============================================================================

/**
 * Validates and fixes common syntax errors in LLM-generated code
 */
export function validateAndFixCode(code: string): {
  code: string;
  issues: string[];
} {
  const issues: string[] = [];
  let fixedCode = code;

  // Fix 0: Auto-add missing 3D imports
  // If code uses useThree/useFrame but doesn't import them, add import
  const firstImportEnd = fixedCode.indexOf("from 'remotion';") || fixedCode.indexOf('from "remotion";');
  if (firstImportEnd > 0) {
    const importSection = fixedCode.slice(0, fixedCode.indexOf('\n\n', firstImportEnd) || firstImportEnd + 100);

    if (fixedCode.includes('useThree') && !importSection.includes("'@react-three/fiber'") && !importSection.includes('"@react-three/fiber"')) {
      const insertPos = fixedCode.indexOf("from '@remotion/three';") || fixedCode.indexOf('from "@remotion/three";');
      if (insertPos > 0) {
        const lineEnd = fixedCode.indexOf('\n', insertPos);
        fixedCode = fixedCode.slice(0, lineEnd + 1) + "import { useThree } from '@react-three/fiber';\n" + fixedCode.slice(lineEnd + 1);
        issues.push("Fixed: Added missing useThree import from @react-three/fiber");
      }
    }

    if (fixedCode.includes('THREE.') && !importSection.includes("* as THREE")) {
      const insertPos = fixedCode.indexOf("from '@remotion/three';") || fixedCode.indexOf('from "@remotion/three";');
      if (insertPos > 0) {
        const lineEnd = fixedCode.indexOf('\n', insertPos);
        fixedCode = fixedCode.slice(0, lineEnd + 1) + "import * as THREE from 'three';\n" + fixedCode.slice(lineEnd + 1);
        issues.push("Fixed: Added missing THREE import from three");
      }
    }

    if ((fixedCode.includes('useFrame(') || fixedCode.includes('useFrame ')) && !importSection.includes('useFrame') && !importSection.includes("'@react-three/fiber'")) {
      const insertPos = fixedCode.indexOf("from '@remotion/three';") || fixedCode.indexOf('from "@remotion/three";');
      if (insertPos > 0) {
        const lineEnd = fixedCode.indexOf('\n', insertPos);
        fixedCode = fixedCode.slice(0, lineEnd + 1) + "import { useFrame } from '@react-three/fiber';\n" + fixedCode.slice(lineEnd + 1);
        issues.push("Fixed: Added missing useFrame import from @react-three/fiber");
      }
    }
  }

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
    "filter: `blur(${$1}px)`",
  );

  // Fix 2b: Fix broken backtick inside CSS values like translate(-10px`,-10px) → translate(-10px, -10px)
  // The LLM inserts a backtick mid-value, splitting the template literal
  fixedCode = fixedCode.replace(
    /(-?\d+px)`,\s*(-?\d+px?\)?)/g,
    (match, before, after) => {
      issues.push("Fixed: Stray backtick inside CSS translate value");
      return `${before}, ${after}`;
    },
  );
  // Also fix: `translate(-10px`, -10px) scale(...)` → `translate(-10px, -10px) scale(...)`
  // Pattern: backtick followed by comma and a CSS continuation then backtick at end
  fixedCode = fixedCode.replace(
    /`(translate[^`]*?)`,\s*([^`]*?)`/g,
    (match, part1, part2) => {
      // Only fix if part2 looks like a CSS continuation (not a new template)
      if (part2.includes('translate') || part2.includes('scale') || part2.includes('rotate') || /^-?\d/.test(part2)) {
        issues.push("Fixed: Broken template literal in CSS transform");
        return `\`${part1}, ${part2}\``;
      }
      return match;
    },
  );

  // Fix 3: Fix broken transform template literals
  fixedCode = fixedCode.replace(
    /transform:\s*`([^`]+)(?!`)\s*,/g,
    "transform: `$1`,",
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
      if (
        !nextLine.trim().startsWith("`") &&
        line.includes("${") &&
        line.includes("}")
      ) {
        // This line might need a closing backtick
        const lastBraceIndex = line.lastIndexOf("}");
        if (
          lastBraceIndex > -1 &&
          !line.substring(lastBraceIndex).includes("`")
        ) {
          // Find where to insert the closing backtick
          if (
            line.trim().endsWith(",") ||
            line.trim().endsWith(";") ||
            line.trim().endsWith(")")
          ) {
            const endChar = line.trim().slice(-1);
            line =
              line.slice(
                0,
                -endChar.length - (line.length - line.trimEnd().length),
              ) +
              "`" +
              endChar;
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
    },
  );

  // Fix 6: Ensure all interpolate calls have proper syntax
  fixedCode = fixedCode.replace(
    /interpolate\s*\(\s*([^,]+)\s*,\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]\s*,?\s*(\{[^}]*\})?\s*\)/g,
    (match, frame, inputRange, outputRange, config) => {
      // Validate and clean up interpolate calls
      const cleanConfig = config || "{ extrapolateRight: 'clamp' }";
      return `interpolate(${frame.trim()}, [${inputRange.trim()}], [${outputRange.trim()}], ${cleanConfig})`;
    },
  );

  // Fix 7: Fix common 'blur' appearing after a number without backtick closure
  fixedCode = fixedCode.replace(/(\d+)\s*blur/g, (match, num) => {
    issues.push("Fixed: Number followed by 'blur' without proper syntax");
    return `${num}}px)\``;
  });

  // Fix 8: Fix broken transform template literals like `translate(${x}px`, ${y}px)`
  // Pattern: `...(${var}px`, ${var}px)` -> `...(${var}px, ${var}px)`
  fixedCode = fixedCode.replace(
    /`([^`]*\$\{[^}]+\}px)`\s*,\s*\$\{([^}]+)\}px\)`/g,
    (match, before, afterVar) => {
      issues.push(
        "Fixed: Broken transform template literal with extra backtick",
      );
      return `\`${before}, \${${afterVar}}px)\``;
    },
  );

  // Fix 9: Fix nested template literals in transform that have broken syntax
  // Pattern: `translate(${x1}px`, ${y1}px)` should be `translate(${x1}px, ${y1}px)`
  fixedCode = fixedCode.replace(
    /transform:\s*`([^`]+)\$\{([^}]+)\}px`\s*,\s*\$\{([^}]+)\}px\)`/g,
    (match, prefix, var1, var2) => {
      issues.push("Fixed: Broken transform syntax with misplaced backtick");
      return `transform: \`${prefix}\${${var1}}px, \${${var2}}px)\``;
    },
  );

  // Fix 10: Fix backtick appearing mid-interpolate call inside template literal
  // Pattern: `translateY(${interpolate(f, [a, b], [c, d]`, { ... })}px)`
  // Should be: `translateY(${interpolate(f, [a, b], [c, d], { ... })}px)`
  fixedCode = fixedCode.replace(
    /\$\{(interpolate\([^}]*?\])`\s*,\s*(\{[^}]*?\})\)/g,
    (match, interpCall, config) => {
      issues.push(
        "Fixed: Backtick inside interpolate call in template literal",
      );
      return `\${${interpCall}, ${config})}`;
    },
  );

  // Fix 10b: More aggressive fix for interpolate with backtick after bracket
  // Pattern: interpolate(frame, [0, 100], [0, 1]`, { ... })
  // Should be: interpolate(frame, [0, 100], [0, 1], { ... })
  fixedCode = fixedCode.replace(
    /interpolate\s*\(\s*([^,]+)\s*,\s*\[([^\]]*)\]\s*,\s*\[([^\]]*)\]`\s*,/g,
    (match, frame, input, output) => {
      issues.push("Fixed: Backtick after interpolate output array");
      return `interpolate(${frame.trim()}, [${input}], [${output}],`;
    },
  );

  // Fix 10c: Fix interpolate with broken bracket syntax
  // Pattern: interpolate(frame, [0, 100], [0, 1]`, {...})` - backtick after bracket inside template
  fixedCode = fixedCode.replace(
    /\$\{interpolate\(([^)]+)\]\s*`\s*,\s*(\{[^}]+\})\s*\)\s*\}/g,
    (match, args, config) => {
      issues.push("Fixed: Interpolate with backtick after bracket");
      return `\${interpolate(${args}], ${config})}`;
    },
  );

  // Fix 10d: Fix broken template literal with backtick inside ${...}
  // Pattern: `...${something` more}...` - backtick inside interpolation
  fixedCode = fixedCode.replace(
    /\$\{([^}]*)`([^}]*)\}/g,
    (match, before, after) => {
      // Only fix if it looks like a broken interpolate call
      if (before.includes("interpolate") || before.includes("[")) {
        issues.push("Fixed: Backtick inside ${...} interpolation");
        return `\${${before}${after}}`;
      }
      return match;
    },
  );

  // Fix 10e: Fix transform with multiple backtick-separated segments
  // Pattern: `translateX(${x}px` `translateY(${y}px)` -> `translateX(${x}px) translateY(${y}px)`
  fixedCode = fixedCode.replace(
    /`([^`]*)\$\{([^}]+)\}([^`]*)`\s*`/g,
    (match, before, varName, after) => {
      if (
        before.includes("translate") ||
        before.includes("rotate") ||
        before.includes("scale")
      ) {
        issues.push("Fixed: Multiple backticks in transform");
        return `\`${before}\${${varName}}${after}`;
      }
      return match;
    },
  );

  // Fix 10f: Fix broken pattern }{ that causes "Expected } but found {"
  // This can happen when previous fixes create invalid brace sequences
  fixedCode = fixedCode.replace(/\}\s*\{/g, (match) => {
    // Check if this is inside a template literal interpolation
    // ${something}{...} might be valid (object literal)
    // but }{ at end of interpolation is likely broken
    if (match === "}{") {
      issues.push("Fixed: Broken }{ brace sequence");
      return "}";
    }
    return match;
  });

  // Fix 10g: Fix double {{ that might be created accidentally
  fixedCode = fixedCode.replace(/\{\{/g, (match, offset, str) => {
    // Check context - {{ might be intentional (object in template)
    const before = str.slice(Math.max(0, offset - 10), offset);
    if (before.includes("${")) {
      return "{"; // Likely broken interpolation
    }
    return match;
  });

  // Fix 11: Remove useFrame from @react-three/fiber — incompatible with Remotion SSR
  // useFrame runs in R3F's render loop which doesn't exist in Remotion's frame-by-frame rendering.
  // Replace with useCurrentFrame()-based logic or just remove the calls.
  if (fixedCode.includes("useFrame")) {
    issues.push(
      "Fixed: Removed useFrame calls (incompatible with Remotion SSR)",
    );

    // Remove useFrame(...) call blocks — matches useFrame((state) => { ... });
    // Handle nested braces by counting them
    let result = "";
    let i = 0;
    while (i < fixedCode.length) {
      const useFrameMatch = fixedCode.substring(i).match(/^useFrame\s*\(/);
      if (useFrameMatch) {
        // Skip the entire useFrame(...) call including its body
        let depth = 0;
        let j = i + useFrameMatch[0].length - 1; // start at the opening (
        for (; j < fixedCode.length; j++) {
          if (fixedCode[j] === "(") depth++;
          else if (fixedCode[j] === ")") {
            depth--;
            if (depth === 0) break;
          }
        }
        // Skip past the closing ) and optional ;
        j++;
        if (fixedCode[j] === ";") j++;
        if (fixedCode[j] === "\n") j++;
        i = j;
        continue;
      }
      result += fixedCode[i];
      i++;
    }
    fixedCode = result;

    // Remove useFrame from the fiber import
    fixedCode = fixedCode.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]@react-three\/fiber['"]/g,
      (match, imports) => {
        const cleaned = imports
          .split(",")
          .map((s: string) => s.trim())
          .filter((s: string) => s && s !== "useFrame")
          .join(", ");
        if (!cleaned) return ""; // No imports left
        return `import { ${cleaned} } from '@react-three/fiber'`;
      },
    );
  }

  // Fix 12: Detect @react-three/drei components used outside <Canvas>
  // Common drei components that MUST be inside Canvas
  const dreiComponents = [
    "Environment",
    "Stars",
    "OrbitControls",
    "PerspectiveCamera",
    "Float",
    "Text3D",
    "Center",
    "MeshDistortMaterial",
    "MeshWobbleMaterial",
    "Sky",
    "Cloud",
    "ContactShadows",
    "Sparkles",
  ];
  const usedDreiComponents = dreiComponents.filter((c) =>
    fixedCode.includes(`<${c}`),
  );

  if (usedDreiComponents.length > 0 && !fixedCode.includes("<Canvas")) {
    // drei components used but no Canvas — strip drei imports and components entirely
    issues.push(
      `Fixed: Removed drei components (${usedDreiComponents.join(", ")}) — no <Canvas> wrapper found`,
    );

    // Remove drei import line
    fixedCode = fixedCode.replace(
      /import\s+\{[^}]*\}\s+from\s+['"]@react-three\/drei['"];?\n?/g,
      "",
    );
    // Remove fiber import line
    fixedCode = fixedCode.replace(
      /import\s+\{[^}]*\}\s+from\s+['"]@react-three\/fiber['"];?\n?/g,
      "",
    );
    // Remove three import
    fixedCode = fixedCode.replace(
      /import\s+\*\s+as\s+THREE\s+from\s+['"]three['"];?\n?/g,
      "",
    );

    // Remove self-closing drei component tags
    for (const comp of usedDreiComponents) {
      fixedCode = fixedCode.replace(new RegExp(`<${comp}\\b[^/>]*/>`, "g"), "");
      // Remove paired tags too
      fixedCode = fixedCode.replace(
        new RegExp(`<${comp}\\b[^>]*>[\\s\\S]*?</${comp}>`, "g"),
        "",
      );
    }
  }

  // Fix 13: Cap large blur values to prevent flicker (blur > 60px causes rendering inconsistency)
  fixedCode = fixedCode.replace(
    /filter:\s*['"`]blur\((\d+)px\)['"`]/g,
    (match, val) => {
      const num = parseInt(val);
      if (num > 60) {
        issues.push(`Fixed: Capped blur(${num}px) to blur(60px) to prevent flicker`);
        return match.replace(`blur(${val}px)`, `blur(60px)`);
      }
      return match;
    },
  );

  // Also cap dynamic blur template literals: filter: `blur(${expr}px)`
  // Replace per-word blur animations with opacity-only (blur on many elements flickers)
  fixedCode = fixedCode.replace(
    /filter:\s*`blur\(\$\{([^}]+)\}px\)`/g,
    (match, expr) => {
      // If it's a simple interpolate/variable for text reveal blur, remove it
      if (expr.includes("interpolate") || expr.includes("blur")) {
        issues.push("Fixed: Removed dynamic blur filter (causes flicker) — use opacity instead");
        return "filter: 'none'";
      }
      return match;
    },
  );

  // Fix 14: Replace HandCursorSVG with MacCursorSVG if the LLM used the wrong name
  if (fixedCode.includes("HandCursorSVG") && !fixedCode.includes("const HandCursorSVG")) {
    // LLM referenced HandCursorSVG but didn't define it — rename to MacCursorSVG
    fixedCode = fixedCode.replace(/HandCursorSVG/g, "MacCursorSVG");
    issues.push("Fixed: Renamed HandCursorSVG to MacCursorSVG");
  }

  // Fix 15: Fix JSX expressions like {displayNum}suffix} → {displayNum}{suffix}
  // LLM sometimes forgets to wrap adjacent text in JSX curly braces
  fixedCode = fixedCode.replace(
    /\{(\w+)\}(\w+)\}/g,
    (match, expr, text) => {
      issues.push(`Fixed: Broken JSX expression {${expr}}${text}} → {${expr}}{${text}}`);
      return `{${expr}}{${text}}`;
    },
  );

  // Fix 15b: Fix pattern like {value}suffix where suffix has no closing } — wrap suffix
  // This catches: {displayNum}suffix → {displayNum}{suffix}  (when inside JSX text)
  fixedCode = fixedCode.replace(
    /(\{[^}]+\})([a-zA-Z_]\w*)\b(?!\s*[{=:(.])/g,
    (match, expr, ident) => {
      // Only fix if this looks like it's in JSX content (not in JS code)
      // Check if ident is a known JSX/variable pattern, not a keyword
      if (['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'export', 'from', 'true', 'false', 'null', 'undefined'].includes(ident)) {
        return match;
      }
      issues.push(`Fixed: Unwrapped JSX text after expression: ${expr}${ident} → ${expr}{${ident}}`);
      return `${expr}{${ident}}`;
    },
  );

  if (issues.length > 0) {
    console.log("[CodeValidator] Fixed issues:", issues);
  }

  return { code: fixedCode, issues };
}

/**
 * Run validateAndFixCode in a loop until no more fixes are needed or max attempts reached
 */
export function validateAndFixCodeWithRetry(
  code: string,
  maxAttempts = 5,
): { code: string; issues: string[] } {
  let currentCode = code;
  let allIssues: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = validateAndFixCode(currentCode);

    if (result.issues.length === 0) {
      // No more fixes needed
      break;
    }

    allIssues = [...allIssues, ...result.issues];
    currentCode = result.code;

    console.log(
      `[CodeValidator] Attempt ${attempt} fixed ${result.issues.length} issues`,
    );
  }

  return { code: currentCode, issues: allIssues };
}

// ============================================================================
// PRE-RENDER STATIC ANALYSIS — Catches forbidden patterns before render
// ============================================================================

interface StaticAnalysisResult {
  valid: boolean;
  errors: string[];    // Must-fix issues (will cause render failure)
  warnings: string[];  // May cause issues (flicker, inconsistency)
  autoFixed: string;   // Code with auto-fixable issues resolved
}

/**
 * Pre-render static analysis that catches forbidden patterns BEFORE
 * submitting to the render service. Much faster than a render round-trip.
 *
 * Catches: relative imports, CSS transitions, Tailwind, setTimeout,
 * Math.random, Date.now, backdrop-filter, missing export default.
 */
export function validateBeforeRender(code: string): StaticAnalysisResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let fixedCode = code;

  // ---- ERRORS (will definitely fail render) ----

  // 1. Missing export default
  const codeWithoutComments = code.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
  if (!codeWithoutComments.includes("export default")) {
    errors.push("Missing 'export default' — required by Remotion render service");
    // Auto-fix: prefer known names, then main composition patterns, then first PascalCase
    const knownNames = ["VideoComposition", "MainComposition", "Composition", "MyVideo", "Video"];
    let exportName: string | null = null;
    for (const name of knownNames) {
      if (code.includes(`const ${name}`) || code.includes(`function ${name}`)) {
        exportName = name;
        break;
      }
    }
    if (!exportName) {
      // Look for components that return JSX with <AbsoluteFill> or <Sequence> at root
      const mainCompMatch = code.match(/(?:const|export const)\s+([A-Z][a-zA-Z0-9]*)\s*(?::\s*React\.FC)?\s*=\s*\(\)\s*(?::\s*\w+)?\s*(?:=>|{)/g);
      if (mainCompMatch && mainCompMatch.length > 0) {
        // Pick the last no-props component (most likely the composition)
        const last = mainCompMatch[mainCompMatch.length - 1];
        const nameMatch = last.match(/(?:const|export const)\s+([A-Z][a-zA-Z0-9]*)/);
        if (nameMatch) exportName = nameMatch[1];
      }
    }
    if (!exportName) {
      const componentMatch = code.match(/(?:const|function)\s+([A-Z][a-zA-Z0-9]*)/);
      if (componentMatch) exportName = componentMatch[1];
    }
    if (exportName) {
      fixedCode += `\n\nexport default ${exportName};`;
    }
  }

  // 2. Relative imports (render service has no local files)
  const relativeImportPattern = /import\s+(?:type\s+)?(?:\{[^}]*\}|\w+)\s+from\s+['"](?:\.\.\/|\.\/)[^'"]*['"]/g;
  const relativeImports = code.match(relativeImportPattern);
  if (relativeImports) {
    errors.push(`Relative imports found (${relativeImports.length}) — render service has no local files`);
    // Auto-fix: strip relative imports
    fixedCode = fixedCode.replace(/import\s+(?:type\s+)?(?:\{[^}]*\}|\w+)\s+from\s+['"](?:\.\.|\.\/)[^'"]*['"]\s*;?\n?/g, "");
  }

  // 3. useFrame from @react-three/fiber (incompatible with Remotion SSR)
  if (code.includes("useFrame") && code.includes("@react-three/fiber")) {
    errors.push("useFrame from @react-three/fiber — incompatible with Remotion SSR rendering");
  }

  // ---- WARNINGS (may cause flicker or inconsistency) ----

  // 4. CSS transition property
  const cssTransitionPattern = /transition\s*:\s*['"`][^'"`]*['"`]/g;
  const cssTransitions = code.match(cssTransitionPattern);
  if (cssTransitions) {
    warnings.push(`CSS 'transition' property found (${cssTransitions.length}) — time-based, causes flicker in Remotion`);
    // Auto-fix: remove transition properties from style objects
    fixedCode = fixedCode.replace(/,?\s*transition\s*:\s*['"`][^'"`]*['"`]\s*,?/g, (match) => {
      return match.startsWith(",") && match.endsWith(",") ? "," : "";
    });
  }

  // 5. CSS animation property
  const cssAnimationPattern = /animation\s*:\s*['"`][^'"`]*['"`]/g;
  if (cssAnimationPattern.test(code)) {
    warnings.push("CSS 'animation' property found — use interpolate()/spring() instead");
  }

  // 6. Math.random() — non-deterministic, causes flicker
  if (/Math\.random\s*\(/.test(code)) {
    warnings.push("Math.random() found — non-deterministic across render tabs, causes flicker. Use frame-based or index-based values.");
  }

  // 7. Date.now() / new Date() — non-deterministic
  if (/Date\.now\s*\(|new Date\s*\(/.test(code)) {
    warnings.push("Date.now()/new Date() found — non-deterministic, causes flicker");
  }

  // 8. setTimeout / setInterval
  if (/setTimeout\s*\(|setInterval\s*\(/.test(code)) {
    warnings.push("setTimeout/setInterval found — use frame-based timing instead");
  }

  // 9. backdrop-filter — biggest flicker cause with concurrent rendering
  if (/backdrop-?[Ff]ilter/.test(code)) {
    warnings.push("backdrop-filter found — renders inconsistently across concurrent tabs, causes flicker");
    // Auto-fix: strip backdropFilter and WebkitBackdropFilter
    fixedCode = fixedCode.replace(/,?\s*backdropFilter\s*:\s*['"`][^'"`]*['"`]\s*,?/g, (match) => {
      return match.startsWith(",") && match.endsWith(",") ? "," : "";
    });
    fixedCode = fixedCode.replace(/,?\s*WebkitBackdropFilter\s*:\s*['"`][^'"`]*['"`]\s*,?/g, (match) => {
      return match.startsWith(",") && match.endsWith(",") ? "," : "";
    });
  }

  // 10. Tailwind animation classes
  if (/className=.*(?:animate-|transition-)/g.test(code)) {
    warnings.push("Tailwind animation classes found — not supported in Remotion");
  }

  // 10b. filter: blur() on elements (not backdrop) — can cause sub-pixel flicker with concurrency
  // Only warn, don't auto-fix as it's often intentional
  const blurFilterCount = (code.match(/filter\s*:\s*['\"`]blur\(/g) || []).length;
  if (blurFilterCount > 5) {
    warnings.push(`Excessive blur filters (${blurFilterCount}) — may cause flicker with concurrent rendering`);
  }

  // 11. loadFont inside component (should be module-level)
  const loadFontInsideComponent = /(?:const|function)\s+[A-Z][\s\S]*?loadFont\s*\(/;
  if (loadFontInsideComponent.test(code)) {
    warnings.push("loadFont() called inside component — move to module scope for consistent rendering");
  }

  // 11b. CSS kebab-case properties in style objects → camelCase
  // LLM generates e.g. `font-size: 16` instead of `fontSize: 16` — causes esbuild "Expected identifier but found '-'"
  const kebabCssProps: Record<string, string> = {
    "font-size": "fontSize", "font-weight": "fontWeight", "font-family": "fontFamily",
    "font-style": "fontStyle", "line-height": "lineHeight", "letter-spacing": "letterSpacing",
    "text-align": "textAlign", "text-decoration": "textDecoration", "text-transform": "textTransform",
    "text-shadow": "textShadow", "word-spacing": "wordSpacing", "word-break": "wordBreak",
    "white-space": "whiteSpace", "overflow-wrap": "overflowWrap",
    "background-color": "backgroundColor", "background-image": "backgroundImage",
    "background-size": "backgroundSize", "background-position": "backgroundPosition",
    "background-repeat": "backgroundRepeat", "background-clip": "backgroundClip",
    "border-radius": "borderRadius", "border-color": "borderColor", "border-width": "borderWidth",
    "border-style": "borderStyle", "border-top": "borderTop", "border-bottom": "borderBottom",
    "border-left": "borderLeft", "border-right": "borderRight",
    "border-top-left-radius": "borderTopLeftRadius", "border-top-right-radius": "borderTopRightRadius",
    "border-bottom-left-radius": "borderBottomLeftRadius", "border-bottom-right-radius": "borderBottomRightRadius",
    "box-shadow": "boxShadow", "box-sizing": "boxSizing",
    "margin-top": "marginTop", "margin-bottom": "marginBottom",
    "margin-left": "marginLeft", "margin-right": "marginRight",
    "padding-top": "paddingTop", "padding-bottom": "paddingBottom",
    "padding-left": "paddingLeft", "padding-right": "paddingRight",
    "max-width": "maxWidth", "max-height": "maxHeight",
    "min-width": "minWidth", "min-height": "minHeight",
    "object-fit": "objectFit", "object-position": "objectPosition",
    "z-index": "zIndex", "flex-direction": "flexDirection",
    "flex-wrap": "flexWrap", "flex-grow": "flexGrow", "flex-shrink": "flexShrink",
    "align-items": "alignItems", "align-self": "alignSelf",
    "justify-content": "justifyContent", "justify-self": "justifySelf",
    "gap": "gap", "row-gap": "rowGap", "column-gap": "columnGap",
    "grid-template-columns": "gridTemplateColumns", "grid-template-rows": "gridTemplateRows",
    "grid-column": "gridColumn", "grid-row": "gridRow",
    "backdrop-filter": "backdropFilter", "clip-path": "clipPath",
    "mix-blend-mode": "mixBlendMode", "pointer-events": "pointerEvents",
    "transform-origin": "transformOrigin", "animation-delay": "animationDelay",
    "transition-duration": "transitionDuration",
  };
  for (const [kebab, camel] of Object.entries(kebabCssProps)) {
    // Match kebab-case property as an object key (not inside a string)
    const kebabRegex = new RegExp(`(?<=[{,;\\s])${kebab.replace(/-/g, "\\-")}\\s*:`, "g");
    if (kebabRegex.test(fixedCode)) {
      fixedCode = fixedCode.replace(kebabRegex, `${camel}:`);
      errors.push(`Auto-fixed: Converted CSS '${kebab}' to '${camel}'`);
    }
  }

  // 12. Bracket/syntax validation — catch unbalanced braces before render
  const syntaxErrors = hasBasicSyntaxErrors(fixedCode);
  if (syntaxErrors.length > 0) {
    const trimmedEnd = fixedCode.trimEnd();
    const looksComplete = /export\s+default\s+\w+;?\s*$/.test(trimmedEnd);

    if (!looksComplete) {
      // Auto-balance unclosed brackets
      for (const err of syntaxErrors) {
        if (err.includes("Unclosed template")) {
          fixedCode += "\n`";
          errors.push("Auto-fixed: Closed unclosed template string");
        }
        const extraCurly = err.match(/Unbalanced curly braces: (\d+) extra/);
        if (extraCurly) {
          const n = parseInt(extraCurly[1]);
          fixedCode += "\n" + "}".repeat(n);
          errors.push(`Auto-fixed: Closed ${n} unclosed curly braces`);
        }
        const extraParen = err.match(/Unbalanced parentheses: (\d+) extra/);
        if (extraParen) {
          const n = parseInt(extraParen[1]);
          fixedCode += ")".repeat(n);
          errors.push(`Auto-fixed: Closed ${n} unclosed parentheses`);
        }
        const extraBracket = err.match(/Unbalanced square brackets: (\d+) extra/);
        if (extraBracket) {
          const n = parseInt(extraBracket[1]);
          fixedCode += "]".repeat(n);
          errors.push(`Auto-fixed: Closed ${n} unclosed square brackets`);
        }
      }
      // Re-check — if still broken, flag as error (LLM fix loop will handle it)
      const remaining = hasBasicSyntaxErrors(fixedCode);
      if (remaining.length > 0) {
        errors.push(...remaining.map(e => `Syntax: ${e}`));
      }
    } else {
      // Code ends cleanly but checker reports errors — likely false positives
      warnings.push(...syntaxErrors.map(e => `Possible syntax issue (code ends cleanly): ${e}`));
    }
  }

  const valid = errors.length === 0;

  if (errors.length > 0 || warnings.length > 0) {
    console.log(`[StaticAnalysis] ${errors.length} errors, ${warnings.length} warnings`);
    errors.forEach(e => console.log(`  ERROR: ${e}`));
    warnings.forEach(w => console.log(`  WARN: ${w}`));
  }

  return { valid, errors, warnings, autoFixed: fixedCode };
}

/**
 * Enforce that Sequences fill the full target duration.
 * Parses `<Sequence from={N} durationInFrames={N}>` and scales them to fill targetFrames.
 */
export function enforceDuration(code: string, targetFrames: number): string {
  // Find all Sequence tags with numeric from/durationInFrames
  const seqPattern = /<Sequence\s+from=\{(\d+)\}\s+durationInFrames=\{(\d+)\}/g;
  const sequences: Array<{ from: number; dur: number; match: string }> = [];
  let m;
  while ((m = seqPattern.exec(code)) !== null) {
    sequences.push({ from: parseInt(m[1]), dur: parseInt(m[2]), match: m[0] });
  }

  if (sequences.length === 0) return code;

  // Compute the last frame covered by any sequence
  const lastFrame = Math.max(...sequences.map(s => s.from + s.dur));
  const coverage = lastFrame / targetFrames;

  // If within 5% of target, no fix needed
  if (coverage >= 0.95 && coverage <= 1.05) return code;

  console.log(
    `[DurationEnforce] Content covers ${lastFrame} frames but target is ${targetFrames} (${(coverage * 100).toFixed(0)}%). Scaling...`,
  );

  const scaleFactor = targetFrames / lastFrame;

  // Scale all from/durationInFrames proportionally
  let fixedCode = code;
  let frameAccumulator = 0;

  // Sort by from to process in order
  const sorted = [...sequences].sort((a, b) => a.from - b.from);
  for (let i = 0; i < sorted.length; i++) {
    const seq = sorted[i];
    const newFrom = Math.round(seq.from * scaleFactor);
    const isLast = i === sorted.length - 1;
    const newDur = isLast
      ? targetFrames - newFrom // Last sequence fills remaining frames exactly
      : Math.max(15, Math.round(seq.dur * scaleFactor)); // Min 0.5s
    const replacement = `<Sequence from={${newFrom}} durationInFrames={${newDur}}`;
    fixedCode = fixedCode.replace(seq.match, replacement);
  }

  console.log(`[DurationEnforce] Scaled ${sorted.length} sequences to fill ${targetFrames} frames`);
  return fixedCode;
}

/**
 * More aggressive syntax fixer for broken template literals
 */
export function fixBrokenTemplateLiterals(code: string): string {
  let fixedCode = code;

  // Fix pattern: interpolate with backtick before config object
  // ${interpolate(frame, [0, 100], [0, 1]` { ... })} -> ${interpolate(frame, [0, 100], [0, 1], { ... })}
  fixedCode = fixedCode.replace(
    /\$\{interpolate\s*\(\s*([^,]+)\s*,\s*\[([^\]]*)\]\s*,\s*\[([^\]]*)\]`\s*,\s*(\{[^}]*\})\s*\)\s*\}/g,
    (match, frame, input, output, config) => {
      console.log(
        "[FixTemplate] Fixed interpolate with backtick before config",
      );
      return `\${interpolate(${frame.trim()}, [${input}], [${output}], ${config})}`;
    },
  );

  // Fix pattern: }{ adjacent braces (broken from previous fixes)
  fixedCode = fixedCode.replace(/\}\s*\{/g, (match, offset, str) => {
    const before = str.slice(Math.max(0, offset - 5), offset);
    // If preceded by ) or ] or }, it's likely closing something
    if (/[)\]\}]\s*$/.test(before)) {
      return "}";
    }
    return match;
  });

  // Fix pattern: }}{ at end of interpolation
  fixedCode = fixedCode.replace(/\}\}\s*\{/g, "}}");

  // Fix pattern: double {{ at start
  fixedCode = fixedCode.replace(/\{\{/g, (match, offset, str) => {
    const before = str.slice(Math.max(0, offset - 10), offset);
    if (/\$\{[^}]*$/.test(before)) {
      return "{";
    }
    return match;
  });

  // Fix pattern: ${...}{{...}} - interpolation with double braces
  fixedCode = fixedCode.replace(/\$\{([^}]+)\}\{\{/g, (match, inner) => {
    return `\${${inner}}{`;
  });

  // Fix broken transform patterns
  // `translateX(${x}px` ${y})` -> `translateX(${x}px, ${y})`
  fixedCode = fixedCode.replace(
    /`([^`]*)\$\{([^}]+)\}([^`]*)`\s*\$\{/g,
    (match, before, varName, after, offset, str) => {
      if (before.includes("translate") || before.includes("rotate")) {
        return `\`${before}\${${varName}}${after}, \${`;
      }
      return match;
    },
  );

  return fixedCode;
}

/**
 * Basic TypeScript syntax validation
 */
export function hasBasicSyntaxErrors(code: string): string[] {
  const errors: string[] = [];

  // Only track braces that are reliable in JSX/TS (skip < > — too ambiguous)
  const braces = { "{": 0, "[": 0, "(": 0 };
  const closingBraces: Record<string, keyof typeof braces> = {
    "}": "{",
    "]": "[",
    ")": "(",
  };

  let inString = false;
  let stringChar = "";
  let inTemplateString = false;
  let templateDepth = 0; // Track ${} nesting inside template strings
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = i < code.length - 1 ? code[i + 1] : "";
    const prevChar = i > 0 ? code[i - 1] : "";

    // Handle newlines — end line comments
    if (char === "\n") {
      inLineComment = false;
      continue;
    }

    // Skip line comment content
    if (inLineComment) continue;

    // Handle block comments
    if (inBlockComment) {
      if (char === "*" && nextChar === "/") {
        inBlockComment = false;
        i++; // skip /
      }
      continue;
    }

    // Detect comment starts (only outside strings)
    if (!inString && !inTemplateString && char === "/") {
      if (nextChar === "/") { inLineComment = true; i++; continue; }
      if (nextChar === "*") { inBlockComment = true; i++; continue; }
    }

    // Track string state — only toggle when not already in the OTHER string type
    if ((char === '"' || char === "'") && prevChar !== "\\") {
      if (!inString && !inTemplateString) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
      }
      continue;
    }

    // Skip everything inside regular strings
    if (inString) continue;

    // Track template strings — but NOT when inside a regular string
    if (char === "`" && prevChar !== "\\") {
      inTemplateString = !inTemplateString;
      continue;
    }

    // Inside template strings, only track ${} expression braces
    if (inTemplateString) {
      if (char === "$" && nextChar === "{") {
        templateDepth++;
        braces["{"]++;
        i++; // skip {
      } else if (templateDepth > 0 && char === "}") {
        templateDepth--;
        braces["{"]--;
      }
      continue;
    }

    // Count braces outside all strings/comments
    if (char in braces) {
      braces[char as keyof typeof braces]++;
    } else if (char in closingBraces) {
      braces[closingBraces[char]]--;
    }
  }

  // Check for unbalanced braces
  if (braces["{"] !== 0)
    errors.push(`Unbalanced curly braces: ${braces["{"]} extra {`);
  if (braces["["] !== 0)
    errors.push(`Unbalanced square brackets: ${braces["["]} extra [`);
  if (braces["("] !== 0)
    errors.push(`Unbalanced parentheses: ${braces["("]} extra (`);

  // Check for unclosed template strings
  if (inTemplateString) errors.push("Unclosed template string");
  if (inString) errors.push("Unclosed string literal");

  return errors;
}

/**
 * Detect if code appears to be truncated
 */
export function isCodeTruncated(code: string): boolean {
  // Strip comments before checking — LLM sometimes puts "export default VideoComposition;"
  // in a comment, which would fool a naive string search
  const codeWithoutComments = code
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  // Check if code has export default (required for Remotion)
  if (!codeWithoutComments.includes("export default")) {
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
 * Convert a string to Title Case (capitalize first letter of each word)
 */
function toTitleCase(str: string): string {
  const minorWords = new Set([
    "a",
    "an",
    "the",
    "and",
    "but",
    "or",
    "for",
    "nor",
    "on",
    "at",
    "to",
    "by",
    "in",
    "of",
    "with",
    "is",
  ]);
  return str
    .split(" ")
    .map((word, i) => {
      if (i === 0 || !minorWords.has(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    })
    .join(" ");
}

/**
 * Extract text content from a VideoScript for use in fallback composition
 */
function extractScriptText(videoScript: any): {
  tagline: string;
  features: Array<{ title: string; description: string }>;
  ctaHeadline: string;
  ctaSubtext: string;
  introSubtext: string;
} {
  const defaults = {
    tagline: "Built for the Future",
    features: [
      {
        title: "Powerful Features",
        description: "Built for performance, designed for simplicity.",
      },
      {
        title: "Seamless Experience",
        description: "Every detail crafted with care.",
      },
    ],
    ctaHeadline: "Get Started Today",
    ctaSubtext: "Try it free — no credit card required",
    introSubtext: "The future is now",
  };

  if (!videoScript || !videoScript.scenes || videoScript.scenes.length === 0) {
    return defaults;
  }

  const scenes = videoScript.scenes;

  // Find tagline scene
  const taglineScene =
    scenes.find((s: any) => s.type === "tagline" || s.type === "value-prop") ||
    scenes[1];
  const tagline = taglineScene?.content?.headline || defaults.tagline;

  // Find intro subtext
  const introScene = scenes.find((s: any) => s.type === "intro") || scenes[0];
  const introSubtext = introScene?.content?.subtext || defaults.introSubtext;

  // Find feature scenes
  const featureScenes = scenes.filter((s: any) => s.type === "feature");
  const features =
    featureScenes.length > 0
      ? featureScenes.slice(0, 2).map((s: any) => ({
          title: s.content?.headline || "Feature",
          description: s.content?.subtext || "",
        }))
      : defaults.features;

  // Find CTA scene
  const ctaScene =
    scenes.find((s: any) => s.type === "cta") || scenes[scenes.length - 1];
  const ctaHeadline = ctaScene?.content?.headline || defaults.ctaHeadline;
  const ctaSubtext = ctaScene?.content?.subtext || defaults.ctaSubtext;

  return { tagline, features, ctaHeadline, ctaSubtext, introSubtext };
}

/**
 * Extract full brand color palette from state, merging brandStyle (7 colors) with basic scraper colors.
 */
function extractBrandColors(state: VideoGenerationStateType): {
  primary?: string; secondary?: string; accent?: string; dark?: string;
  background?: string; text?: string; textMuted?: string;
} {
  const brandStyle = (state.productData as any)?.brandStyle as BrandStyle | undefined;
  const basicColors = (state.productData as any)?.colors;
  if (brandStyle?.colors) {
    return {
      primary: brandStyle.colors.primary,
      secondary: brandStyle.colors.secondary,
      accent: brandStyle.colors.accent,
      dark: brandStyle.colors.background,
      background: brandStyle.colors.background,
      text: brandStyle.colors.text,
      textMuted: brandStyle.colors.textMuted,
    };
  }
  return basicColors || {};
}

/**
 * Generate fallback composition code when LLM output is truncated or invalid
 */
export function generateFallbackComposition(
  productName: string = "Product",
  audioUrl: string = "audio/audio1.mp3",
  bpm: number = 120,
  recordings?: Array<{
    id: string;
    videoUrl: string;
    duration: number;
    featureName: string;
    description: string;
  }>,
  brandColors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    dark?: string;
    background?: string;
    text?: string;
    textMuted?: string;
  },
  videoScript?: any,
): string {
  // Determine audio src based on URL type
  const isR2Audio = audioUrl.startsWith("http");
  const audioSrcCode = isR2Audio
    ? `"${audioUrl}"`
    : `staticFile("${audioUrl.replace(/^\//, "")}")`;

  // Beat-snap scene durations
  const framesPerBeat = (60 / bpm) * 30;
  const snapToBeats = (target: number) => {
    const beats = Math.max(1, Math.round(target / framesPerBeat));
    return Math.round(beats * framesPerBeat);
  };
  const introFrames = snapToBeats(90);
  const fastFrames = snapToBeats(45);
  const cardFrames = snapToBeats(60);
  const ctaFrames = snapToBeats(90);

  const hasRecordings = recordings && recordings.length > 0;

  // Extract text from video script (or use defaults)
  const scriptText = extractScriptText(videoScript);
  const taglineWords = toTitleCase(scriptText.tagline).split(" ");
  const feature1Title = toTitleCase(
    scriptText.features[0]?.title || "Powerful Features",
  );
  const feature1Desc =
    scriptText.features[0]?.description ||
    "Built for performance, designed for simplicity.";
  const feature2Title = toTitleCase(
    scriptText.features[1]?.title || "Seamless Experience",
  );
  const feature2Desc =
    scriptText.features[1]?.description || "Every detail crafted with care.";
  const ctaHeadline = toTitleCase(scriptText.ctaHeadline);
  const ctaSubtext = scriptText.ctaSubtext;
  const introSubtext = scriptText.introSubtext;

  // Beat-relative timing values for scene animations
  const halfBeat = Math.round(framesPerBeat * 0.5);
  const quarterBeat = Math.round(framesPerBeat * 0.25);
  const sixteenthBeat = Math.round(framesPerBeat / 4);

  return `import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig, interpolate, spring, Audio,${hasRecordings ? " Video," : ""} staticFile } from 'remotion';
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";

const { fontFamily: mont } = loadMontserrat("normal", { weights: ["400", "600", "700", "800", "900"], subsets: ["latin"] });

// BRAND COLOR PALETTE — extracted from the actual website
const C = {
  bg: '${brandColors?.dark || brandColors?.background || "#08080f"}',
  text: '${brandColors?.text || "#ffffff"}',
  sub: '${brandColors?.textMuted || "rgba(255,255,255,0.65)"}',
  accent: '${brandColors?.primary || "#3b82f6"}',
  accentAlt: '${brandColors?.secondary || "#06b6d4"}',
  line: 'rgba(255,255,255,0.15)',
};

// CINEMATIC BOKEH BACKGROUND — drifting blurred circles, never static
const CineBg: React.FC<{ seed?: number }> = ({ seed = 0 }) => {
  const frame = useCurrentFrame();
  const blobs = [
    { x: 15, y: 20, r: 400, color: C.accent + '2E' },
    { x: 75, y: 70, r: 500, color: C.accentAlt + '1F' },
    { x: 50, y: 45, r: 350, color: C.accent + '1A' },
    { x: 20, y: 80, r: 300, color: C.accentAlt + '14' },
  ];
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: 'hidden' }}>
      {blobs.map((b, i) => {
        const drift = Math.round(Math.sin((frame + seed * 30 + i * 40) / (50 + i * 10)) * 30);
        const driftY = Math.round(Math.cos((frame + seed * 30 + i * 25) / (60 + i * 12)) * 20);
        return (
          <div key={i} style={{
            position: 'absolute',
            left: b.x + '%', top: b.y + '%',
            width: b.r, height: b.r,
            borderRadius: '50%',
            background: b.color,
            filter: 'blur(120px)',
            willChange: 'transform',
            transform: 'translate(-50%,-50%) translate(' + drift + 'px,' + driftY + 'px)',
          }} />
        );
      })}
    </AbsoluteFill>
  );
};

// FADE WRAPPER — fades in and out at scene edges
const FadeWrapper: React.FC<{ children: React.ReactNode; duration: number; fadeFrames?: number }> = ({ children, duration, fadeFrames = 12 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, fadeFrames, duration - fadeFrames, duration], [0, 1, 1, 0], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

// WORD BY WORD REVEAL
const WordReveal: React.FC<{ words: string[]; fontSize?: number; color?: string; delay?: number; stagger?: number }> = ({
  words, fontSize = 80, color = '#ffffff', delay = 0, stagger = 8,
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25em', justifyContent: 'center', alignItems: 'center' }}>
      {words.map((word, i) => {
        const f = Math.max(0, frame - delay - i * stagger);
        const op = interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
        const blur = interpolate(f, [0, 15], [12, 0], { extrapolateRight: 'clamp' });
        const ty = interpolate(f, [0, 15], [40, 0], { extrapolateRight: 'clamp' });
        return (
          <span key={i} style={{
            fontFamily: mont, fontWeight: 800, fontSize, color,
            letterSpacing: '-3px', lineHeight: 1,
            display: 'inline-block',
            opacity: op, filter: 'blur(' + blur + 'px)', transform: 'translateY(' + ty + 'px)',
          }}>{word}</span>
        );
      })}
    </div>
  );
};

// SWEEP LINE — width animates left to right
const SweepLine: React.FC<{ delay?: number; color?: string; width?: number | string }> = ({ delay = 0, color = C.accent, width = 120 }) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - delay);
  const w = interpolate(f, [0, 20], [0, typeof width === 'number' ? width : 120], { extrapolateRight: 'clamp' });
  return <div style={{ height: 3, width: w, background: color, borderRadius: 2, marginTop: 16 }} />;
};


// SCENE 1: Logo intro — zoom IN slowly
const Scene1: React.FC = () => {
  const frame = useCurrentFrame();
  const camScale = interpolate(frame, [0, ${introFrames}], [1.0, 1.10], { extrapolateRight: 'clamp' });
  const camX = Math.round(interpolate(frame, [0, ${introFrames}], [0, -15], { extrapolateRight: 'clamp' }));
  const titleOp = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const subOp = interpolate(Math.max(0, frame - 18), [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const lineW = Math.round(interpolate(Math.max(0, frame - 12), [0, 25], [0, 260], { extrapolateRight: 'clamp' }));
  return (
    <AbsoluteFill>
      <CineBg seed={0} />
      <FadeWrapper duration={${introFrames}}>
        <AbsoluteFill style={{ transform: 'scale(' + camScale + ') translateX(' + camX + 'px)', transformOrigin: 'center center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ opacity: titleOp }}>
            <div style={{ fontFamily: mont, fontWeight: 900, fontSize: 140, color: C.text, letterSpacing: '-5px', lineHeight: 0.95, textAlign: 'center' }}>
              ${productName}
            </div>
          </div>
          <div style={{ height: 3, width: lineW, background: C.accent, borderRadius: 2 }} />
          <div style={{ opacity: subOp, fontFamily: mont, fontWeight: 400, fontSize: 32, color: C.sub, letterSpacing: '6px', textTransform: 'uppercase', marginTop: 8 }}>
            ${introSubtext}
          </div>
        </AbsoluteFill>
      </FadeWrapper>
    </AbsoluteFill>
  );
};

// SCENE 2: Tagline — zoom OUT from top-left
const Scene2: React.FC = () => {
  const frame = useCurrentFrame();
  const camScale = interpolate(frame, [0, ${fastFrames}], [1.12, 1.0], { extrapolateRight: 'clamp' });
  const camY = Math.round(interpolate(frame, [0, ${fastFrames}], [20, 0], { extrapolateRight: 'clamp' }));
  return (
    <AbsoluteFill>
      <CineBg seed={1} />
      <FadeWrapper duration={${fastFrames}}>
        <AbsoluteFill style={{ transform: 'scale(' + camScale + ') translateY(' + camY + 'px)', transformOrigin: 'top left', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 100 }}>
          <WordReveal words={[${taglineWords.map((w) => `'${w.replace(/'/g, "\\'")}'`).join(", ")}]} fontSize={120} delay={8} stagger={${Math.round(framesPerBeat / 3)}} />
        </AbsoluteFill>
      </FadeWrapper>
    </AbsoluteFill>
  );
};

// SCENE 3: Feature — pan left slowly
const Scene3: React.FC = () => {
  const frame = useCurrentFrame();
  const camX = interpolate(frame, [0, ${cardFrames}], [0, -50], { extrapolateRight: 'clamp' });
  const bgX = interpolate(frame, [0, ${cardFrames}], [0, -20], { extrapolateRight: 'clamp' });
  const labelOp = interpolate(Math.max(0, frame - 8), [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const labelTy = interpolate(Math.max(0, frame - 8), [0, 15], [30, 0], { extrapolateRight: 'clamp' });
  const lineW = interpolate(Math.max(0, frame - 18), [0, 20], [0, 180], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: 'translateX(' + bgX + 'px)' }}><CineBg seed={2} /></AbsoluteFill>
      <FadeWrapper duration={${cardFrames}}>
        <AbsoluteFill style={{ transform: 'translateX(' + camX + 'px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: '0 120px' }}>
          <div style={{ opacity: labelOp, transform: 'translateY(' + labelTy + 'px)' }}>
            <div style={{ fontFamily: mont, fontWeight: 400, fontSize: 22, color: C.sub, letterSpacing: '5px', textTransform: 'uppercase', marginBottom: 20 }}>Feature 01</div>
            <div style={{ fontFamily: mont, fontWeight: 800, fontSize: 100, color: C.text, letterSpacing: '-3px', lineHeight: 0.95 }}>${feature1Title
              .split(" ")
              .slice(0, Math.ceil(feature1Title.split(" ").length / 2))
              .join(" ")}</div>
            <div style={{ fontFamily: mont, fontWeight: 800, fontSize: 100, color: C.accent, letterSpacing: '-3px', lineHeight: 0.95 }}>${
              feature1Title
                .split(" ")
                .slice(Math.ceil(feature1Title.split(" ").length / 2))
                .join(" ") || feature1Title
            }</div>
            <div style={{ height: 3, width: lineW, background: C.accent, borderRadius: 2, marginTop: 20 }} />
            <div style={{ fontFamily: mont, fontWeight: 400, fontSize: 28, color: C.sub, marginTop: 20, maxWidth: 500, lineHeight: 1.5 }}>${feature1Desc}</div>
          </div>
        </AbsoluteFill>
      </FadeWrapper>
    </AbsoluteFill>
  );
};

// SCENE 4: Value prop — zoom IN from right
const Scene4: React.FC = () => {
  const frame = useCurrentFrame();
  const camScale = interpolate(frame, [0, ${fastFrames}], [1.0, 1.10], { extrapolateRight: 'clamp' });
  const camX = interpolate(frame, [0, ${fastFrames}], [30, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <CineBg seed={3} />
      <FadeWrapper duration={${fastFrames}}>
        <AbsoluteFill style={{ transform: 'scale(' + camScale + ') translateX(' + camX + 'px)', transformOrigin: 'right center', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 100 }}>
          <WordReveal words={[${feature2Title
            .split(" ")
            .map((w) => `'${w.replace(/'/g, "\\'")}'`)
            .join(", ")}]} fontSize={110} delay={8} stagger={10} />
        </AbsoluteFill>
      </FadeWrapper>
    </AbsoluteFill>
  );
};

// SCENE 5: Feature 2 — pan right
const Scene5: React.FC = () => {
  const frame = useCurrentFrame();
  const camX = interpolate(frame, [0, ${cardFrames}], [0, 50], { extrapolateRight: 'clamp' });
  const bgX = interpolate(frame, [0, ${cardFrames}], [0, 20], { extrapolateRight: 'clamp' });
  const labelOp = interpolate(Math.max(0, frame - 8), [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const labelTy = interpolate(Math.max(0, frame - 8), [0, 15], [30, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: 'translateX(' + bgX + 'px)' }}><CineBg seed={4} /></AbsoluteFill>
      <FadeWrapper duration={${cardFrames}}>
        <AbsoluteFill style={{ transform: 'translateX(' + camX + 'px)', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', padding: '0 120px', textAlign: 'right' }}>
          <div style={{ opacity: labelOp, transform: 'translateY(' + labelTy + 'px)' }}>
            <div style={{ fontFamily: mont, fontWeight: 400, fontSize: 22, color: C.sub, letterSpacing: '5px', textTransform: 'uppercase', marginBottom: 20 }}>Feature 02</div>
            <div style={{ fontFamily: mont, fontWeight: 800, fontSize: 100, color: C.text, letterSpacing: '-3px', lineHeight: 0.95 }}>${feature2Title
              .split(" ")
              .slice(0, Math.ceil(feature2Title.split(" ").length / 2))
              .join(" ")}</div>
            <div style={{ fontFamily: mont, fontWeight: 800, fontSize: 100, color: C.accentAlt, letterSpacing: '-3px', lineHeight: 0.95 }}>${
              feature2Title
                .split(" ")
                .slice(Math.ceil(feature2Title.split(" ").length / 2))
                .join(" ") || feature2Title
            }</div>
            <div style={{ fontFamily: mont, fontWeight: 400, fontSize: 28, color: C.sub, marginTop: 20, maxWidth: 500, lineHeight: 1.5 }}>${feature2Desc}</div>
          </div>
        </AbsoluteFill>
      </FadeWrapper>
    </AbsoluteFill>
  );
};

// SCENE 6: CTA — slow dramatic zoom IN
const Scene6: React.FC = () => {
  const frame = useCurrentFrame();
  const camScale = interpolate(frame, [0, ${ctaFrames}], [1.0, 1.08], { extrapolateRight: 'clamp' });
  const labelOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const subOp = interpolate(Math.max(0, frame - 20), [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const lineW = Math.round(interpolate(Math.max(0, frame - 15), [0, 20], [0, 320], { extrapolateRight: 'clamp' }));
  return (
    <AbsoluteFill>
      <CineBg seed={5} />
      <FadeWrapper duration={${ctaFrames}}>
        <AbsoluteFill style={{ transform: 'scale(' + camScale + ')', transformOrigin: 'center center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ opacity: labelOp, fontFamily: mont, fontWeight: 400, fontSize: 22, color: C.sub, letterSpacing: '6px', textTransform: 'uppercase' }}>${ctaHeadline}</div>
          <div style={{ fontFamily: mont, fontWeight: 900, fontSize: 130, color: C.text, letterSpacing: '-4px', lineHeight: 0.9, textAlign: 'center', opacity: labelOp, filter: 'drop-shadow(0 0 20px ' + C.accent + ')' }}>
            ${productName}
          </div>
          <div style={{ height: 3, width: lineW, background: 'linear-gradient(90deg, ' + C.accent + ', ' + C.accentAlt + ')', borderRadius: 2 }} />
          <div style={{ opacity: subOp, fontFamily: mont, fontWeight: 400, fontSize: 28, color: C.sub, marginTop: 8 }}>${ctaSubtext}</div>
        </AbsoluteFill>
      </FadeWrapper>
    </AbsoluteFill>
  );
};

${
  hasRecordings
    ? recordings!
        .map((rec, i) => {
          const isR2 = rec.videoUrl.startsWith("http");
          const videoSrc = isR2
            ? `"${rec.videoUrl}"`
            : `staticFile("${rec.videoUrl.replace(/^\//, "")}")`;
          return `
// RECORDING SCENE ${i + 1}: ${rec.featureName}
const RecordingScene${i + 1}: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const entryDone = frame >= ${halfBeat};
  const entryScale = entryDone ? 1 : interpolate(frame, [0, ${halfBeat}], [0.85, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const entryOpacity = entryDone ? 1 : interpolate(frame, [0, ${quarterBeat}], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const labelOpacity = interpolate(frame, [0, 30, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <div style={{ width: '100%', height: '100%', transform: entryDone ? 'none' : "scale(" + entryScale + ")", opacity: entryOpacity }}>
        <Video src={${videoSrc}} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <div style={{ position: 'absolute', bottom: 60, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: labelOpacity, zIndex: 10 }}>
        <div style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(12px)', borderRadius: 12, padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, ' + C.accent + ', ' + C.accentAlt + ')' }} />
          <span style={{ fontFamily: montserrat, fontWeight: 600, fontSize: 20, color: '#ffffff' }}>${rec.featureName}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};`;
        })
        .join("\n")
    : ""
}

// BEAT SYNC HOOK
const useBeatSync = (bpm: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const framesPerBeat = (60 / bpm) * fps;
  const beatProgress = (frame % framesPerBeat) / framesPerBeat;
  const beatPulse = Math.exp(-beatProgress * 4);
  return { beatProgress, beatPulse, framesPerBeat };
};

const VideoComposition: React.FC = () => {
  // Beat-snapped scene durations (BPM: ${bpm})
  const introFrames = ${introFrames};
  const fastFrames = ${fastFrames};
  const cardFrames = ${cardFrames};
  const ctaFrames = ${ctaFrames};

  const s1Start = 0;
  const s2Start = s1Start + introFrames;
  const s3Start = s2Start + fastFrames;
  const s4Start = s3Start + cardFrames;
  const s5Start = s4Start + fastFrames;
  let nextStart = s5Start + cardFrames;
${
  hasRecordings
    ? recordings!
        .map((rec, i) => {
          const recFrames = Math.round(rec.duration * 30);
          return `  const rec${i + 1}Start = nextStart;
  const rec${i + 1}Frames = ${recFrames};
  nextStart = rec${i + 1}Start + rec${i + 1}Frames;`;
        })
        .join("\n")
    : ""
}
  const s6Start = nextStart;

  return (
    <AbsoluteFill>
      <Audio src={${audioSrcCode}} volume={0.8} />

      {/* Scene 1: Logo intro — zoom in */}
      <Sequence from={s1Start} durationInFrames={introFrames}>
        <Scene1 />
      </Sequence>

      {/* Scene 2: Tagline — zoom out */}
      <Sequence from={s2Start} durationInFrames={fastFrames}>
        <Scene2 />
      </Sequence>

      {/* Scene 3: Feature — pan left */}
      <Sequence from={s3Start} durationInFrames={cardFrames}>
        <Scene3 />
      </Sequence>

      {/* Scene 4: Value prop — zoom in from right */}
      <Sequence from={s4Start} durationInFrames={fastFrames}>
        <Scene4 />
      </Sequence>

      {/* Scene 5: Feature 2 — pan right */}
      <Sequence from={s5Start} durationInFrames={cardFrames}>
        <Scene5 />
      </Sequence>

${
  hasRecordings
    ? recordings!
        .map(
          (rec, i) => `      {/* Recording: ${rec.featureName} */}
      <Sequence from={rec${i + 1}Start} durationInFrames={rec${i + 1}Frames}>
        <RecordingScene${i + 1} />
      </Sequence>
`,
        )
        .join("\n")
    : ""
}
      {/* Scene 6: CTA — dramatic zoom in */}
      <Sequence from={s6Start} durationInFrames={ctaFrames}>
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

  const script = state.videoScript;
  if (!script) {
    return {
      errors: [
        "No video script available for Remotion code generation",
      ],
      currentStep: "error",
    };
  }
  const totalDuration = script?.totalDuration || 300;

  // Compute resolution from aspect ratio
  const ASPECT_DIMS: Record<string, { width: number; height: number }> = {
    "16:9": { width: 1920, height: 1080 },
    "9:16": { width: 1080, height: 1920 },
    "1:1": { width: 1080, height: 1080 },
    "4:5": { width: 1080, height: 1350 },
  };
  const ar = (state.userPreferences as any)?.aspectRatio || "16:9";
  const { width: videoWidth, height: videoHeight } =
    ASPECT_DIMS[ar] || ASPECT_DIMS["16:9"];

  // Compute audio source early so it can be injected into the prompt
  const narrationUrl = (state.userPreferences as any)?.narration?.audioUrl || "";
  const rawAudioUrl = state.userPreferences?.audio?.url || "";
  const audioUrl = rawAudioUrl.startsWith("http")
    ? rawAudioUrl
    : rawAudioUrl.replace(/^\//, "");
  const isR2Audio = audioUrl.startsWith("http");
  const audioSrcCode = audioUrl
    ? isR2Audio
      ? `"${audioUrl}"`
      : `staticFile("${audioUrl}")`
    : `staticFile("audio/audio1.mp3")`;
  const audioBpm =
    state.userPreferences?.audio?.bpm || state.videoScript?.music?.tempo || 120;

  // Build source section directly from videoScript (single-step generation)
  const sourceSection = `## CREATE REMOTION VIDEO FROM THIS SCRIPT

**Product**: ${state.productData?.name || "Product"}
**Description**: ${state.productData?.description || state.description || ""}

### VIDEO SCRIPT (follow this scene structure):
\`\`\`json
${JSON.stringify(script, null, 2)}
\`\`\`

### PRODUCT DATA:
\`\`\`json
${JSON.stringify(state.productData || {}, null, 2)}
\`\`\`

Create a complete Remotion composition that follows the scene structure from the video script above.
Each scene in the script should become a \`<Sequence>\` with appropriate animations.
Use the product name, tagline, features, and description from the product data.`;

  // Build dynamic system prompt with only relevant skills
  const dynamicSkills = buildSkillsPrompt(state);
  const brandStyle = (state.productData as any)?.brandStyle as BrandStyle | undefined;
  const systemPrompt = buildSystemPrompt(dynamicSkills, brandStyle);

  const prompt = `${systemPrompt}

---

${sourceSection}

## VIDEO SPECIFICATIONS
- Total duration: ${totalDuration} frames (${Math.round(totalDuration / 30)} seconds)
- FPS: 30
- Resolution: ${videoWidth}x${videoHeight} (aspect ratio: ${ar})

## BEAT-SYNCED TIMING (BPM: ${audioBpm})
${(() => {
  const beatMap = state.beatMap;
  const fpb = (30 * 60) / audioBpm;
  if (beatMap && beatMap.beats.length > 0) {
    // Provide key beat frames for scene alignment
    const measures = beatMap.measures.slice(0, 20);
    return `- Frames per beat: ${fpb.toFixed(1)} (${audioBpm} BPM at 30fps)
- Frames per measure (4 beats): ${(fpb * 4).toFixed(1)}
- Measure start frames: [${measures.join(", ")}]
- SNAP all scene boundaries to the nearest measure frame from the list above
- Use beat timing for transitions and motion ONLY — NEVER pulse static text/cards with beatPulse (causes jitter)
- Transition effects (fade, slide) should last exactly 1 beat (${Math.round(fpb)} frames)`;
  }
  return `- Frames per beat: ${fpb.toFixed(1)} (${audioBpm} BPM at 30fps)
- Snap scene durations to multiples of ${Math.round(fpb)} frames (1 beat)
- Transitions should last 1 beat (${Math.round(fpb)} frames)`;
})()}

## LAYOUT — CRITICAL
- Resolution: ${videoWidth}x${videoHeight} (${ar})
- ${videoWidth > videoHeight ? "Landscape" : videoHeight > videoWidth ? "Portrait/vertical" : "Square"} format — design ALL layouts for this aspect ratio
- ${videoHeight > videoWidth ? "Portrait: use LARGER font sizes (headlines 80-120px), stack elements vertically, use full width. Do NOT center tiny text in a tall frame." : videoWidth > videoHeight ? "Landscape: standard layout, center content." : "Square: use moderate sizes, center content."}
- Use \`useVideoConfig()\` to get width/height if needed for responsive sizing

## SCENE DURATION — CRITICAL
The video MUST have content for the ENTIRE ${totalDuration} frames (${Math.round(totalDuration / 30)} seconds). The LAST Sequence MUST end at exactly frame ${totalDuration}. There must be NO empty/blank frames — every frame from 0 to ${totalDuration} must be covered by a Sequence.

**How to plan scenes**: Take the total duration (${totalDuration} frames) and divide it among your scenes. Verify that the last scene's \`from + durationInFrames = ${totalDuration}\`.

Example for ${totalDuration} frames with ${Math.max(5, Math.round(totalDuration / 120))} scenes:
${(() => {
  const numScenes = Math.max(5, Math.round(totalDuration / 120));
  const avgDuration = Math.floor(totalDuration / numScenes);
  let frame = 0;
  const lines: string[] = [];
  for (let i = 0; i < numScenes; i++) {
    const dur = i === numScenes - 1 ? totalDuration - frame : avgDuration;
    lines.push("  <Sequence from={" + frame + "} durationInFrames={" + dur + "}> /* scene " + (i + 1) + " */");
    frame += dur;
  }
  return lines.join("\n");
})()}

## REQUIREMENTS - PREMIUM CINEMATIC VIDEO
1. **VARIABLE SCENE TIMING** (beat-snapped):
   - Intro (first): ~${Math.round(((30 * 60) / audioBpm) * 6)} frames (${Math.round((60 / audioBpm) * 6)}s, 6 beats) — slow, dramatic
   - Middle scenes: ~${Math.round(((30 * 60) / audioBpm) * 3)} frames (${Math.round((60 / audioBpm) * 3)}s, 3 beats) — fast, punchy
   - Feature cards: ~${Math.round(((30 * 60) / audioBpm) * 4)} frames (${Math.round((60 / audioBpm) * 4)}s, 4 beats) — readable
   - Screenshots: ~${Math.round(((30 * 60) / audioBpm) * 5)} frames (${Math.round((60 / audioBpm) * 5)}s, 5 beats) — see the product
   - CTA (ALWAYS last): ~${Math.round(((30 * 60) / audioBpm) * 6)} frames (${Math.round((60 / audioBpm) * 6)}s, 6 beats) — slow, dramatic close
   - **SUM of all scene durations MUST equal ${totalDuration} frames exactly**
2. **DISCRETE SCENES**: Use separate Sequence components with smooth entry animations
3. **3D BACKGROUNDS**: Use ThreeScene with FloatingMesh for intro/hero AND CTA scenes (at least 2 scenes with 3D). Layer 2D text on top with zIndex.
   - Other scenes: use CineBg-style bokeh or gradient backgrounds
4. **TEXT ANIMATIONS**:
   - Use WordByWord for headlines and taglines (with gradientWordIndices for emphasis)
   - Use GradientAccentText for highlighted/accent text
   - Use LogoWithGlow for brand name/logo scenes
5. **UI COMPONENTS**: Use SpotlightCard or TiltCard for feature scenes, StatCounter for metrics, FloatingCard for secondary content. Do NOT use plain divs for feature content.
6. **CURSOR + CLICK**: Include animated cursor (HandCursorSVG + ClickRipple) in at least ONE scene — cursor moves to CTA button and clicks with ripple effect
7. **FONT**: ${(() => {
    if (brandStyle?.videoStyle?.fontRecommendation) {
      return `Use "${brandStyle.videoStyle.fontRecommendation}" from @remotion/google-fonts (400-900 weights), normal case (NOT uppercase)`;
    }
    return `Montserrat (400-800 weights), normal case (NOT uppercase)`;
  })()}
8. **COLOR PALETTE**: ${(() => {
    // Prefer full brandStyle with 7 colors + design context
    if (brandStyle?.colors) {
      return `Use the BRAND colors extracted from the website (EXACT values — do NOT modify):
   \`\`\`tsx
   const BRAND = {
     primary: '${brandStyle.colors.primary}',
     secondary: '${brandStyle.colors.secondary}',
     accent: '${brandStyle.colors.accent}',
     bg: '${brandStyle.colors.background}',
     text: '${brandStyle.colors.text}',
     textMuted: '${brandStyle.colors.textMuted}',
   };
   \`\`\`
   ${brandStyle.colors.gradient ? `Brand gradient: ${brandStyle.colors.gradient}` : ""}
   EVERY visual element must use BRAND colors. Backgrounds = BRAND.bg. Text = BRAND.text. Accents/glows/gradients = BRAND.primary/secondary/accent. NO generic purple/pink/blue.`;
    }
    // Fallback to basic 3-color palette from scraper
    const colors = (state.productData as any)?.colors;
    if (colors && (colors.primary || colors.secondary || colors.accent)) {
      return `Use the BRAND colors from the website:
   - Primary: ${colors.primary || "#a855f7"}
   - Secondary: ${colors.secondary || "#ec4899"}
   - Accent: ${colors.accent || colors.primary || "#3b82f6"}
   - Dark background: ${colors.dark || "#0a0a0f"}
   Use these colors for ALL visual elements. Do NOT use generic purple/pink unless those ARE the brand colors.`;
    }
    return `No brand colors extracted — analyze the product description and choose colors that match the brand's industry and tone. Do NOT default to purple/pink.`;
  })()}
9. **CTA**: The LAST scene MUST always be a call-to-action with cursor click animation
10. Convert ALL CSS animations to interpolate() or spring()
11. CRITICAL: Include Audio components at root level with the EXACT sources provided:
    \`\`\`tsx
    import { Audio${!isR2Audio && !narrationUrl ? ", staticFile" : ""} } from 'remotion';
    // Inside VideoComposition:
${narrationUrl ? `    <Audio src={"${narrationUrl}"} volume={0.9} />  {/* narration voice-over */}` : ""}
    <Audio src={${audioSrcCode}} volume={${narrationUrl ? "0.12" : "1"}} ${narrationUrl ? "loop " : ""}/>  {/* background music */}
    \`\`\`
    DO NOT use staticFile("audio/audio1.mp3") — use the exact audio sources shown above.
${narrationUrl ? "    IMPORTANT: Narration plays throughout the whole video — sync scene pacing to narration timing (≈2.5 words/sec)." : ""}

## IMAGES / SCREENSHOTS
${(() => {
  const useImages = (state.userPreferences as any)?.useImages === true;
  if (!useImages) {
    return `- Do NOT use any images, screenshots, or <Img> tags in this video.
- Use text-only scenes with gradient backgrounds, aurora effects, and animated typography instead.
- Do NOT import Img from remotion.`;
  }
  const screenshots = (state.productData as any)?.screenshots || [];
  const heroShot = screenshots.find((s: any) => s.section === "hero");
  const primaryShot = heroShot || screenshots[0];
  if (primaryShot) {
    const isR2 = primaryShot.url.startsWith("http");
    const imgSrc = isR2
      ? `"${primaryShot.url}"`
      : `staticFile("${primaryShot.url.replace(/^\//, "")}")`;
    return `- Available screenshots:
${screenshots
  .map((s: any) => {
    const sIsR2 = s.url.startsWith("http");
    return `  - ${s.section}: ${sIsR2 ? `"${s.url}"` : `staticFile("${s.url.replace(/^\//, "")}")`} — ${s.description}`;
  })
  .join("\n")}
- Import Img from remotion: import { Img${!isR2 ? ", staticFile" : ""} } from 'remotion';
- Primary screenshot: <Img src={${imgSrc}} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
- Display at least one screenshot in the video with animations (zoom, pan, fade, scale)
- Can be used as background with overlay, or as a featured element
- Apply effects like: scale, blur, opacity changes using interpolate()`;
  }
  return `- No screenshots available — skip Img usage, use text-only scenes instead`;
})()}
- If no screenshot file exists, do NOT use <Img> — use text and gradient backgrounds instead

## SCREEN RECORDINGS
${(() => {
  const recordings = state.recordings || [];
  if (recordings.length > 0) {
    return `Screen recordings are available. Include them as Video playback scenes:
${recordings
  .map((r) => {
    const isR2 = r.videoUrl.startsWith("http");
    const src = isR2
      ? `"${r.videoUrl}"`
      : `staticFile("${r.videoUrl.replace(/^\//, "")}")`;
    return `- "${r.featureName}": <Video src={${src}} /> — ${r.duration}s, ${r.description}`;
  })
  .join("\n")}
- Import Video from remotion: import { Video } from 'remotion';
- Each recording scene should show the video with a feature label overlay
- Duration per recording = recording duration × 30 frames`;
  }
  return `- No recordings available — skip Video usage`;
})()}

## FEATURE FLAGS
${(state.userPreferences as any)?.nanoBanana ? `- AI IMAGE GENERATION: Enabled. If scenes have "aiImagePrompt" in content, generate placeholder image URLs or use gradient backgrounds with the prompt text as overlay.` : `- AI Image Generation: Disabled.`}
${(state.userPreferences as any)?.stockImages ? `- STOCK IMAGES: Enabled. If scenes have "stockImageQuery" in content, you may use placeholder stock image URLs.` : `- Stock Images: Disabled. Do not use stock images.`}
${(state.userPreferences as any)?.animatedComponents === false ? `- ANIMATED COMPONENTS: Disabled. Use simpler animations — basic fade in/out, minimal spring effects. No complex stagger animations or 3D perspective entries.` : `- ANIMATED COMPONENTS: Enabled. Use rich animations — word-by-word reveals, spring entrances, perspective card entries, beat-synced pulses.`}

## CRITICAL: USE EXACT SCRIPT TEXT
- Every headline and subtext in the video MUST match the video script JSON exactly
- Do NOT invent, paraphrase, or use placeholder text like "Built for Speed" or "Powerful Features"
- Copy the exact headline and subtext strings from each scene in the video script
- Apply Title Case to headlines (capitalize first letter of major words)

Output the complete Remotion composition code with FAST-PACED text animations. MUST include Audio component and text effects!${(state.userPreferences as any)?.useImages ? " Include the website screenshot!" : " Do NOT use <Img> or any images."}`;

  // Analyze recordings with Gemini Pro Vision (if any)
  let analyzedRecordings: RecordingAnalysisResult[] = [];
  const recordings = state.recordings || [];
  if (recordings.length > 0) {
    console.log(
      `[RemotionTranslator] Analyzing ${recordings.length} recording(s) with Gemini Pro Vision...`,
    );
    const analysisPromises = recordings.map((rec) => analyzeRecording(rec));
    analyzedRecordings = await Promise.allSettled(analysisPromises).then(
      (results) =>
        results.map((r, i) => {
          if (r.status === "fulfilled") return r.value;
          console.warn(
            `[RemotionTranslator] Recording analysis failed for ${recordings[i].featureName}:`,
            r.reason,
          );
          return {
            componentCode: "",
            componentName: `RecordingScene_${recordings[i].id.replace(/[^a-zA-Z0-9]/g, "_")}`,
            success: false,
            error: String(r.reason),
          } as RecordingAnalysisResult;
        }),
    );
    const successCount = analyzedRecordings.filter((r) => r.success).length;
    console.log(
      `[RemotionTranslator] Recording analysis: ${successCount}/${recordings.length} succeeded`,
    );
  }

  try {
    console.log("[RemotionTranslator] Calling Gemini Pro...");
    // Dynamic temperature: conservative for professional, creative for bold/playful
    const styleTemp: Record<string, number> = {
      professional: 0.3,
      minimal: 0.3,
      bold: 0.6,
      playful: 0.6,
    };
    const temperature = styleTemp[state.userPreferences?.style || "professional"] || 0.5;
    console.log(`[RemotionTranslator] Using temperature ${temperature} for style "${state.userPreferences?.style}"`);

    const response = await chatWithGeminiPro(
      [{ role: "user", content: prompt }],
      {
        temperature,
        maxTokens: 16000,
      },
    );

    // Extract code from response using regex for code blocks
    // Use RegExp constructor with proper escaping for backticks
    const backtick = String.fromCharCode(96);
    const codeBlockPattern = new RegExp(
      backtick +
        backtick +
        backtick +
        "(?:tsx?|jsx?|javascript)?\\s*([\\s\\S]*?)" +
        backtick +
        backtick +
        backtick,
    );
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
        const componentMatch = remotionCode.match(
          /(?:const|function)\s+([A-Z][a-zA-Z0-9]*)/,
        );
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

    // Check for truncation first
    if (isCodeTruncated(remotionCode)) {
      console.warn(
        "[RemotionTranslator] Code appears truncated! Using fallback...",
      );
      const productName = state.productData?.name || "Product";
      remotionCode = generateFallbackComposition(
        productName,
        audioUrl,
        audioBpm,
        state.recordings,
        extractBrandColors(state),
        state.videoScript,
      );
      console.log("[RemotionTranslator] Using fallback composition");
    }

    // Replace any hardcoded audio paths the LLM may have used
    if (audioUrl) {
      remotionCode = remotionCode.replace(
        /staticFile\(["']audio\/audio1\.mp3["']\)/g,
        audioSrcCode,
      );
    }

    // Validate and fix common syntax errors
    console.log("[RemotionTranslator] Validating and fixing code...");
    const { code: validatedCode, issues } = validateAndFixCode(remotionCode);

    if (issues.length > 0) {
      console.log("[RemotionTranslator] Fixed issues:", issues);
    }

    // Check for remaining syntax errors
    let finalCode = validatedCode;
    let syntaxErrors = hasBasicSyntaxErrors(validatedCode);

    // Auto-balance: close unclosed template strings and braces before asking LLM
    // Safety: skip auto-balance if code already ends cleanly (export default + semicolon)
    const trimmedEnd = validatedCode.trimEnd();
    const looksComplete = /export\s+default\s+\w+;?\s*$/.test(trimmedEnd);
    if (syntaxErrors.length > 0 && !looksComplete) {
      let balanced = validatedCode;
      if (syntaxErrors.some(e => e.includes("Unclosed template"))) {
        balanced += "\n`";
        console.log("[RemotionTranslator] Auto-closed unclosed template string");
      }
      // Count and close unbalanced braces
      const recheck = hasBasicSyntaxErrors(balanced);
      for (const err of recheck) {
        const extraCurly = err.match(/Unbalanced curly braces: (\d+) extra/);
        if (extraCurly) {
          const n = parseInt(extraCurly[1]);
          balanced += "\n" + "}".repeat(n);
          console.log(`[RemotionTranslator] Auto-closed ${n} unclosed curly braces`);
        }
        const extraParen = err.match(/Unbalanced parentheses: (\d+) extra/);
        if (extraParen) {
          const n = parseInt(extraParen[1]);
          balanced += ")".repeat(n);
          console.log(`[RemotionTranslator] Auto-closed ${n} unclosed parentheses`);
        }
      }
      // Ensure export default is at the end
      if (!balanced.includes("export default")) {
        const compMatch = balanced.match(/(?:const|export const)\s+((?:Video|Main)?Composition|MyVideo)\b/);
        if (compMatch) {
          balanced += `\n\nexport default ${compMatch[1]};`;
        }
      }
      syntaxErrors = hasBasicSyntaxErrors(balanced);
      if (syntaxErrors.length === 0) {
        console.log("[RemotionTranslator] Auto-balance fixed all syntax errors");
        finalCode = balanced;
      } else {
        // Use the balanced version as input for LLM fix (closer to valid)
        finalCode = balanced;
      }
    } else if (syntaxErrors.length > 0 && looksComplete) {
      console.log("[RemotionTranslator] Code ends cleanly but syntax checker reports errors — likely false positives, skipping auto-balance");
      console.log("[RemotionTranslator] Reported errors:", syntaxErrors);
    }

    if (syntaxErrors.length > 0) {
      console.warn(
        "[RemotionTranslator] Remaining syntax issues:",
        syntaxErrors,
      );
      // If there are severe syntax errors, ask LLM to fix them
      if (
        syntaxErrors.some(
          (e) => e.includes("Unclosed") || e.includes("Unbalanced"),
        )
      ) {
        console.log("[RemotionTranslator] Asking LLM to fix syntax errors...");

        // Escape backticks in the code to prevent breaking the template literal
        const backtickChar = String.fromCharCode(96);
        const escapedCode = validatedCode.replace(
          new RegExp(backtickChar, "g"),
          "\\\\" + backtickChar,
        );

        // Build prompt using string concatenation to avoid backtick issues
        const fixPrompt =
          "You are a TypeScript/React expert. Fix the syntax errors in this Remotion code.\n\n" +
          "## SYNTAX ERRORS TO FIX:\n" +
          syntaxErrors.map((e) => "- " + e).join("\n") +
          "\n\n## CURRENT CODE (with errors):\n" +
          backtickChar +
          backtickChar +
          backtickChar +
          "tsx\n" +
          escapedCode +
          "\n" +
          backtickChar +
          backtickChar +
          backtickChar +
          "\n\n" +
          "## REQUIREMENTS:\n" +
          "1. Fix ALL syntax errors listed above\n" +
          "2. Ensure all braces {}, brackets [], and parentheses () are balanced\n" +
          "3. Ensure all template literals are properly closed\n" +
          "4. Ensure all strings are properly closed\n" +
          "5. Keep the functionality and logic exactly the same\n" +
          "6. Return ONLY the fixed code in a code block\n" +
          "7. MUST end with: export default VideoComposition;";

        try {
          const fixResponse = await chatWithGeminiPro(
            [{ role: "user", content: fixPrompt }],
            {
              temperature: 0.2,
              maxTokens: 16000,
            },
          );

          const fixedCodeBlockPattern = new RegExp(
            backtickChar +
              backtickChar +
              backtickChar +
              "(?:tsx?|jsx?|javascript)?\\s*([\\s\\S]*?)" +
              backtickChar +
              backtickChar +
              backtickChar,
          );
          const fixedCodeMatch = fixResponse.content.match(
            fixedCodeBlockPattern,
          );
          const fixedCode = fixedCodeMatch
            ? fixedCodeMatch[1].trim()
            : fixResponse.content;

          // Validate the fixed code - must be non-trivial and not drastically shorter
          const remainingErrors = hasBasicSyntaxErrors(fixedCode);
          const minAcceptableLength = Math.max(100, validatedCode.length * 0.4);
          if (fixedCode.length < minAcceptableLength) {
            console.warn(
              "[RemotionTranslator] Fix returned empty/trivial code, using fallback",
            );
            finalCode = generateFallbackComposition(
              state.productData?.name || "Product",
              audioUrl,
              audioBpm,
              state.recordings,
              extractBrandColors(state),
              state.videoScript,
            );
          } else if (remainingErrors.length === 0) {
            console.log(
              "[RemotionTranslator] Syntax errors fixed successfully",
            );
            finalCode = fixedCode;
          } else {
            console.warn(
              "[RemotionTranslator] Fix attempt failed, remaining errors:",
              remainingErrors,
            );
            // Try one more time with more specific instructions
            const secondFixPrompt =
              "Fix these specific syntax errors in the Remotion code:\n\n" +
              "ERRORS: " +
              remainingErrors.join(", ") +
              "\n\n" +
              "CODE:\n" +
              backtickChar +
              backtickChar +
              backtickChar +
              "tsx\n" +
              fixedCode +
              "\n" +
              backtickChar +
              backtickChar +
              backtickChar +
              "\n\n" +
              "Return ONLY valid TypeScript/React code with ALL errors fixed. Ensure perfect syntax.";

            const secondResponse = await chatWithGeminiPro(
              [{ role: "user", content: secondFixPrompt }],
              {
                temperature: 0.2,
                maxTokens: 16000,
              },
            );

            const secondFixedBlockPattern = new RegExp(
              backtickChar +
                backtickChar +
                backtickChar +
                "(?:tsx?|jsx?|javascript)?\\s*([\\s\\S]*?)" +
                backtickChar +
                backtickChar +
                backtickChar,
            );
            const secondFixedMatch = secondResponse.content.match(
              secondFixedBlockPattern,
            );
            const secondFixed = secondFixedMatch
              ? secondFixedMatch[1].trim()
              : secondResponse.content;

            const finalCheck = hasBasicSyntaxErrors(secondFixed);
            if (secondFixed.length < minAcceptableLength) {
              console.warn(
                "[RemotionTranslator] Second fix returned empty/trivial code, using fallback",
              );
              finalCode = generateFallbackComposition(
                state.productData?.name || "Product",
                audioUrl,
                audioBpm,
                state.recordings,
                extractBrandColors(state),
                state.videoScript,
              );
            } else if (finalCheck.length === 0) {
              console.log(
                "[RemotionTranslator] Syntax errors fixed on second attempt",
              );
              finalCode = secondFixed;
            } else {
              console.warn(
                "[RemotionTranslator] Could not fix syntax errors, using fallback",
              );
              finalCode = generateFallbackComposition(
                state.productData?.name || "Product",
                audioUrl,
                audioBpm,
                state.recordings,
                extractBrandColors(state),
                state.videoScript,
              );
            }
          }
        } catch (fixError) {
          console.error(
            "[RemotionTranslator] Error during syntax fix:",
            fixError,
          );
          finalCode = generateFallbackComposition(
            state.productData?.name || "Product",
            audioUrl,
            audioBpm,
            state.recordings,
            extractBrandColors(state),
            state.videoScript,
          );
        }
      }
    }

    // Inject analyzed recording components into the code
    if (analyzedRecordings.length > 0) {
      const successfulAnalyses = analyzedRecordings.filter(
        (r) => r.success && r.componentCode,
      );
      if (successfulAnalyses.length > 0) {
        console.log(
          `[RemotionTranslator] Injecting ${successfulAnalyses.length} analyzed recording component(s)`,
        );
        // Add recording components before the main VideoComposition
        const exportDefaultIndex = finalCode.lastIndexOf("export default");
        if (exportDefaultIndex > -1) {
          const injectedCode = successfulAnalyses
            .map(
              (r) =>
                `\n// --- Analyzed Recording Component ---\n${r.componentCode}`,
            )
            .join("\n");
          finalCode =
            finalCode.slice(0, exportDefaultIndex) +
            injectedCode +
            "\n\n" +
            finalCode.slice(exportDefaultIndex);
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
      errors: [ `Remotion translation failed: ${error}`],
      currentStep: "error",
    };
  }
}
