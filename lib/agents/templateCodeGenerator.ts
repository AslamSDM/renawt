/**
 * Template-based Video Code Generator
 * Generates Remotion code deterministically from video scripts using pre-built templates.
 * This approach eliminates LLM hallucination and ensures consistent premium animations.
 *
 * Available Styles:
 * - "aurora": aurora gradient backgrounds, white glass morphism cards,
 *   word-by-word blur text reveals, gradient accent text, 3D perspective card entries,
 *   Montserrat font, scene progress dots.
 *
 * - "floating-glass": dark gradient backgrounds with purple/violet accents,
 *   floating glass morphism UI cards, typewriter text animations,
 *   product mockup components, scene transitions with fade effects,
 *   Inter font, progress rings and checkmarks.
 *
 * - "blue-clean": clean white backgrounds with blue accents,
 *   floating UI mockup cards with subtle shadows, typewriter text animations,
 *   progress indicator dots, corporate SaaS aesthetic,
 *   Inter font, clean minimal design.
 */

import type { VideoScript, VideoScene } from "../types";
import type { VideoGenerationStateType } from "./state";
import { savePromptLog } from "./skills";
import { generateCursorOverlayCode } from "./cursorOverlayGenerator";

function getSceneType(
  scene: VideoScene,
): "intro" | "feature" | "cta" | "testimonial" | "screenshot" | "recording" {
  const type = scene.type;
  if (type === "intro") return "intro";
  if (type === "cta") return "cta";
  if (type === "recording") return "recording";
  if (type === "testimonial") return "testimonial";
  if (type === "screenshot" || scene.content.image) return "screenshot";
  return "feature";
}

function generateSceneComponent(scene: VideoScene, index: number, totalScenes: number, recordings?: Array<{
  id: string;
  videoUrl: string;
  zoomPoints?: Array<{ time: number; x: number; y: number; scale: number; duration: number }>;
  cursorData?: Array<{ x: number; y: number; timestamp: number; type: string }>;
  cursorStyle?: "normal" | "hand";
}>): string {
  const sceneType = getSceneType(scene);
  const headline = scene.content.headline || "";
  const subtext = scene.content.subtext || "";
  const icon = scene.content.icon || "";
  const features = scene.content.features || [];

  const componentName = `Scene${index + 1}`;
  // Alternate aurora background: even = dark, odd = light
  const auroraVariant = index % 2 === 0 ? "dark" : "light";
  // Text color depends on variant
  const headlineColor = auroraVariant === "dark" ? "#ffffff" : "#111827";
  const subtextColor = auroraVariant === "dark" ? "rgba(255,255,255,0.8)" : "#4b5563";
  const cardTextColor = "#111827";
  const cardSubtextColor = "#4b5563";

  // Split headline into words for blur reveal
  const headlineWords = headline.split(" ").filter(Boolean);
  const subtextWords = subtext.split(" ").filter(Boolean);

  if (sceneType === "intro") {
    return `
const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <AuroraBackground variant="dark" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <LogoWithGlow brandName="${headline}" fontSize={72} delay={0} />
        ${subtextWords.length > 0 ? `<div style={{ marginTop: 20 }}>
          <WordByWordBlur
            words={${JSON.stringify(subtextWords)}}
            fontSize={32}
            fontFamily={montserrat}
            fontWeight={500}
            color="rgba(255,255,255,0.8)"
            delay={20}
            staggerFrames={5}
          />
        </div>` : ""}
      </div>
    </AbsoluteFill>
  );
};`;
  }

  if (sceneType === "cta") {
    return `
const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <AuroraBackground variant="dark" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <WordByWordBlur
          words={${JSON.stringify(headlineWords)}}
          fontSize={56}
          fontFamily={montserrat}
          fontWeight={700}
          color="#ffffff"
          delay={5}
          staggerFrames={5}
          gradientWordIndices={[${headlineWords.length > 2 ? headlineWords.length - 1 : 0}]}
        />
        ${subtextWords.length > 0 ? `<div style={{ marginTop: 16 }}>
          <GradientAccentText
            text="${subtext}"
            fontSize={36}
            fontFamily={montserrat}
            delay={${10 + headlineWords.length * 5}}
          />
        </div>` : ""}
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Screenshot scene - show product UI in a glass card with 3D perspective
  if (sceneType === "screenshot" && scene.content.image) {
    const imgUrl = scene.content.image;
    const isR2 = imgUrl.startsWith("http");
    const imgSrc = isR2 ? `"${imgUrl}"` : `staticFile("${imgUrl.replace(/^\//, "")}")`;
    return `
const ${componentName}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  
  // 3D perspective animation
  const perspectiveProgress = Math.min(frame / 30, 1);
  const rotateX = interpolate(frame, [0, 20], [15, 0], { extrapolateRight: 'clamp' });
  const rotateY = interpolate(frame, [0, 20], [-10, 0], { extrapolateRight: 'clamp' });
  const scale = spring({ frame, fps, from: 0.8, to: 1, config: { damping: 12, stiffness: 100 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  
  // Add subtle floating animation
  const floatY = interpolate(frame, [0, durationInFrames], [0, -10], { extrapolateRight: 'extend' });
  
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 60,
      perspective: '1200px',
      perspectiveOrigin: 'center center',
    }}>
      <AuroraBackground variant="${auroraVariant}" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        ${headlineWords.length > 0 ? `<WordByWordBlur
          words={${JSON.stringify(headlineWords)}}
          fontSize={36}
          fontFamily={montserrat}
          fontWeight={600}
          color="${headlineColor}"
          delay={0}
          staggerFrames={4}
        />` : ""}
        <div style={{
          transform: \`perspective(1200px) rotateX(\${rotateX}deg) rotateY(\${rotateY}deg) scale(\${scale}) translateY(\${floatY}px)\`,
          transformStyle: 'preserve-3d',
          opacity,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          borderRadius: 16,
        }}>
          <WhiteGlassCard delay={${headlineWords.length > 0 ? 10 : 0}} maxWidth={900} entryAnimation="none" padding={16}>
            <Img src={${imgSrc}} style={{
              width: '100%',
              height: 'auto',
              maxHeight: 500,
              objectFit: 'cover',
              borderRadius: 12,
            }} />
          </WhiteGlassCard>
        </div>
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Recording scene - play back screen recording with mockup frame on aurora background
  if (sceneType === "recording") {
    const videoUrl = (scene.content as any).recordingVideoUrl || "";
    const featureName = (scene.content as any).featureName || headline;
    const mockupFrame = (scene.content as any).mockupFrame || "minimal";
    const recordingId = (scene.content as any).recordingId || "";
    const isR2Video = videoUrl.startsWith("http");
    const videoSrc = isR2Video ? `"${videoUrl}"` : `staticFile("${videoUrl.replace(/^\//, "")}")`;

    // Choose mockup wrapper based on mockupFrame type
    let mockupOpen = "";
    let mockupClose = "";
    if (mockupFrame === "browser") {
      mockupOpen = `<BrowserMockup>`;
      mockupClose = `</BrowserMockup>`;
    } else if (mockupFrame === "macbook") {
      mockupOpen = `<MacBookMockup>`;
      mockupClose = `</MacBookMockup>`;
    } else {
      mockupOpen = `<MinimalMockup>`;
      mockupClose = `</MinimalMockup>`;
    }

    // Look up zoom points and cursor data from recordings
    const recording = recordings?.find(r => r.id === recordingId);
    const zoomPoints = recording?.zoomPoints || [];
    const cursorData = recording?.cursorData || [];
    const cursorStyle = recording?.cursorStyle || "hand";
    
    // Generate cursor overlay code
    const { cursorCode, cursorRenderCode } = generateCursorOverlayCode(cursorData, cursorStyle, "  ");

    // Generate zoom interpolation code
    let zoomCode = "";
    let videoStyle = `style={{ width: '100%', height: '100%', objectFit: 'cover' }}`;
    if (zoomPoints.length > 0) {
      const zoomInputFrames = [0];
      const zoomScaleValues = [1];
      const zoomXValues = [0];
      const zoomYValues = [0];
      for (const zp of zoomPoints) {
        const startFrame = Math.round(zp.time * 30);
        const endFrame = Math.round((zp.time + zp.duration) * 30);
        zoomInputFrames.push(startFrame);
        zoomScaleValues.push(1);
        zoomXValues.push(0);
        zoomYValues.push(0);
        zoomInputFrames.push(startFrame + 15);
        zoomScaleValues.push(zp.scale);
        zoomXValues.push(-(zp.x - 0.5) * 100 * (zp.scale - 1));
        zoomYValues.push(-(zp.y - 0.5) * 100 * (zp.scale - 1));
        zoomInputFrames.push(endFrame - 15);
        zoomScaleValues.push(zp.scale);
        zoomXValues.push(-(zp.x - 0.5) * 100 * (zp.scale - 1));
        zoomYValues.push(-(zp.y - 0.5) * 100 * (zp.scale - 1));
        zoomInputFrames.push(endFrame);
        zoomScaleValues.push(1);
        zoomXValues.push(0);
        zoomYValues.push(0);
      }
      zoomCode = `
  const zoomScale = interpolate(frame, ${JSON.stringify(zoomInputFrames)}, ${JSON.stringify(zoomScaleValues.map(v => Math.round(v * 100) / 100))}, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const zoomX = interpolate(frame, ${JSON.stringify(zoomInputFrames)}, ${JSON.stringify(zoomXValues.map(v => Math.round(v * 10) / 10))}, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const zoomY = interpolate(frame, ${JSON.stringify(zoomInputFrames)}, ${JSON.stringify(zoomYValues.map(v => Math.round(v * 10) / 10))}, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });`;
      videoStyle = "style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoomScale}) translate(${zoomX}%, ${zoomY}%)` }}";
    }

    return `
const ${componentName}: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();${cursorCode}
  // Scale-in animation for the mockup
  const mockupScale = spring({ frame, fps, from: 0.85, to: 1, config: { damping: 15, stiffness: 100 } });
  const mockupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  // Label fade in over first 3 seconds, fade out in last 1 second
  const labelOpacity = interpolate(frame, [0, 30, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });${zoomCode}
  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <AuroraBackground variant="${auroraVariant}" />
      <div style={{ position: 'relative', zIndex: 1, width: '85%', maxWidth: 1000, transform: \`scale(\${mockupScale})\`, opacity: mockupOpacity }}>
        ${mockupOpen}
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Video src=${videoSrc} ${videoStyle} />${cursorRenderCode}
          </div>
        ${mockupClose}
      </div>
      <div style={{
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: labelOpacity,
        zIndex: 10,
      }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
          borderRadius: 12,
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
          }} />
          <span style={{
            fontFamily: montserrat,
            fontWeight: 600,
            fontSize: 20,
            color: '#ffffff',
          }}>${featureName}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Feature / testimonial scene
  if (features.length > 0) {
    // Card-based feature layout
    return `
const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 60,
    }}>
      <AuroraBackground variant="${auroraVariant}" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
        <WordByWordBlur
          words={${JSON.stringify(headlineWords)}}
          fontSize={48}
          fontFamily={montserrat}
          fontWeight={700}
          color="${headlineColor}"
          delay={5}
          staggerFrames={5}
        />
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 1000 }}>
          ${features
            .map(
              (f, i) => `<WhiteGlassCard delay={${20 + i * 12}} maxWidth={280} entryAnimation="${i % 2 === 0 ? 'perspective' : 'slide-up'}" padding={32}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>${f.icon || "✨"}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '${cardTextColor}', fontFamily: montserrat }}>${f.title}</div>
              <div style={{ fontSize: 16, color: '${cardSubtextColor}', marginTop: 8, fontFamily: montserrat, fontWeight: 400 }}>${f.description}</div>
            </div>
          </WhiteGlassCard>`,
            )
            .join("\n          ")}
        </div>
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Text-focused feature scene (no feature cards)
  return `
const ${componentName}: React.FC = () => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 80,
    }}>
      <AuroraBackground variant="${auroraVariant}" />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        ${icon ? `<ScaleIn delay={0}><div style={{ fontSize: 72, marginBottom: 8 }}>${icon}</div></ScaleIn>` : ""}
        <WordByWordBlur
          words={${JSON.stringify(headlineWords)}}
          fontSize={56}
          fontFamily={montserrat}
          fontWeight={700}
          color="${headlineColor}"
          delay={5}
          staggerFrames={5}
        />
        ${subtextWords.length > 0 ? `<div style={{ marginTop: 16 }}>
          <WordByWordBlur
            words={${JSON.stringify(subtextWords)}}
            fontSize={28}
            fontFamily={montserrat}
            fontWeight={400}
            color="${subtextColor}"
            delay={${10 + headlineWords.length * 5}}
            staggerFrames={4}
          />
        </div>` : ""}
      </div>
    </AbsoluteFill>
  );
};`;
}

/** Snap a target frame count to the nearest beat boundary */
function snapToBeats(targetFrames: number, framesPerBeat: number): number {
  const beats = Math.max(1, Math.round(targetFrames / framesPerBeat));
  return Math.round(beats * framesPerBeat);
}

// ============================================================================
// BLUE-CLEAN STYLE SCENE COMPONENTS
// ============================================================================

function generateBlueCleanSceneComponent(scene: VideoScene, index: number, totalScenes: number, recordings?: Array<{
  id: string;
  videoUrl: string;
  zoomPoints?: Array<{ time: number; x: number; y: number; scale: number; duration: number }>;
  cursorData?: Array<{ x: number; y: number; timestamp: number; type: string }>;
  cursorStyle?: "normal" | "hand";
}>): string {
  const sceneType = getSceneType(scene);
  const headline = scene.content.headline || "";
  const subtext = scene.content.subtext || "";
  const icon = scene.content.icon || "";
  const features = scene.content.features || [];

  const componentName = `Scene${index + 1}`;
  
  // BLUE-CLEAN: Clean white backgrounds with blue accents
  const backgroundColor = "#ffffff";
  const textColor = "#111827";
  const subtextColor = "#4b5563";
  const accentColor = "#3b82f6"; // blue-500

  // Split text for typewriter effect
  const headlineText = headline;
  const subtextText = subtext;

  if (sceneType === "intro") {
    return `
const ${componentName}: React.FC<{ frame: number }> = ({ frame }) => {
  // Floating UI cards data - positioned around edges
  const cards = [
    { x: 50, y: 80, width: 200, height: 140, delay: 30, type: "menu" },
    { x: 1400, y: 60, width: 220, height: 120, delay: 45, type: "chat" },
    { x: 100, y: 550, width: 240, height: 130, delay: 60, type: "tickets" },
    { x: 1200, y: 600, width: 200, height: 100, delay: 75, type: "spinner" },
  ];

  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '${backgroundColor}',
    }}>
      {/* Floating UI Cards */}
      {cards.map((card, i) => {
        const cardOpacity = interpolate(frame - card.delay, [0, 20], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const cardScale = interpolate(frame - card.delay, [0, 20], [0.9, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        });
        const floatY = Math.sin((frame + card.delay) * 0.02) * 5;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: card.x,
              top: card.y + floatY,
              width: card.width,
              height: card.height,
              background: 'white',
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
              opacity: cardOpacity,
              transform: \`scale(\${cardScale})\`,
              overflow: 'hidden',
              padding: 16,
            }}
          >
            {card.type === 'menu' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#9ca3af' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>Categories</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12 }}>📋</span>
                    <span style={{ fontSize: 12, color: '#4b5563' }}>Tickets</span>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#ef4444', fontWeight: 600 }}>89</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12 }}>⏰</span>
                    <span style={{ fontSize: 12, color: '#4b5563' }}>Snoozed</span>
                  </div>
                </div>
              </>
            )}
            {card.type === 'chat' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e5e7eb' }} />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>Order Ticket</p>
                      <p style={{ fontSize: 10, color: '#6b7280' }}>Facing login issue...</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e5e7eb' }} />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>Delivery Issue</p>
                      <p style={{ fontSize: 10, color: '#6b7280' }}>Order has not been...</p>
                    </div>
                  </div>
                </div>
              </>
            )}
            {card.type === 'tickets' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ padding: 8, background: '#f3f4f6', borderRadius: 6 }}>
                    <p style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>Dashboard Ticket</p>
                    <p style={{ fontSize: 9, color: '#6b7280' }}>I need the following features...</p>
                  </div>
                  <div style={{ padding: 8, background: '#f3f4f6', borderRadius: 6 }}>
                    <p style={{ fontSize: 10, fontWeight: 500, color: '#374151' }}>Support Ticket</p>
                    <p style={{ fontSize: 9, color: '#6b7280' }}>Facing login issue while...</p>
                  </div>
                </div>
              </>
            )}
            {card.type === 'spinner' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  border: '3px solid #e5e7eb',
                  borderTop: '3px solid ${accentColor}',
                  borderRadius: '50%',
                  animation: 'spin 2s linear infinite',
                }} />
              </div>
            )}
          </div>
        );
      })}

      {/* Main Text */}
      <div style={{
        textAlign: 'center',
        zIndex: 10,
        position: 'relative',
        maxWidth: 800,
      }}>
        <div style={{
          fontSize: 56,
          fontWeight: 500,
          color: '${textColor}',
          lineHeight: 1.2,
        }}>
          <TypewriterText text="${headlineText}" frame={frame} speed={2} />
        </div>
        {subtextText && (
          <div style={{
            fontSize: 24,
            color: '${subtextColor}',
            marginTop: 24,
            opacity: interpolate(frame, [60, 80], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          }}>
            {subtextText}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};`;
  }

  if (sceneType === "cta") {
    return `
const ${componentName}: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '${backgroundColor}',
    }}>
      <div style={{
        fontSize: 48,
        fontWeight: 600,
        color: '${textColor}',
        textAlign: 'center',
        opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: \`translateY(\${interpolate(frame, [0, 20], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)\`,
      }}>
        <TypewriterText text="${headlineText}" frame={frame} speed={2} />
      </div>
      
      {subtextText && (
        <div style={{
          fontSize: 24,
          color: '${subtextColor}',
          textAlign: 'center',
          marginTop: 24,
          opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          {subtextText}
        </div>
      )}
    </AbsoluteFill>
  );
};`;
  }

  // Screenshot scene with clean card
  if (sceneType === "screenshot" && scene.content.image) {
    const imgUrl = scene.content.image;
    const isR2 = imgUrl.startsWith("http");
    const imgSrc = isR2 ? `"${imgUrl}"` : `staticFile("${imgUrl.replace(/^\//, "")}")`;
    
    return `
const ${componentName}: React.FC<{ frame: number }> = ({ frame }) => {
  const scale = spring({ frame, fps: 30, from: 0.9, to: 1, config: { damping: 15, stiffness: 100 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '${backgroundColor}',
      padding: 60,
    }}>
      {headlineText && (
        <div style={{
          fontSize: 40,
          fontWeight: 600,
          color: '${textColor}',
          marginBottom: 40,
          textAlign: 'center',
          opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <TypewriterText text="${headlineText}" frame={frame} speed={2} />
        </div>
      )}

      <div style={{
        transform: \`scale(\${scale})\`,
        opacity,
        boxShadow: '0 25px 50px rgba(0,0,0,0.15)',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'white',
        border: '1px solid #e5e7eb',
      }}>
        <Img src={${imgSrc}} style={{
          width: '100%',
          height: 'auto',
          maxHeight: 500,
          objectFit: 'cover',
        }} />
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Feature scene with cards
  if (features.length > 0) {
    return `
const ${componentName}: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '${backgroundColor}',
      padding: 60,
    }}>
      <div style={{
        fontSize: 40,
        fontWeight: 600,
        color: '${textColor}',
        marginBottom: 40,
        textAlign: 'center',
        opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        <TypewriterText text="${headlineText}" frame={frame} speed={2} />
      </div>

      <div style={{
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 1200,
      }}>
        ${features.map((f, i) => `
        <div key={${i}} style={{
          width: 280,
          background: 'white',
          borderRadius: 16,
          border: '1px solid #e5e7eb',
          padding: 32,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          opacity: interpolate(frame, [${20 + i * 10}, ${35 + i * 10}], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          transform: \`translateY(\${interpolate(frame, [${20 + i * 10}, ${35 + i * 10}], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)\`,
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>${f.icon || "✨"}</div>
          <div style={{ fontSize: 20, fontWeight: 600, color: '${textColor}' }}>${f.title}</div>
          <div style={{ fontSize: 15, color: '${subtextColor}', marginTop: 8, lineHeight: 1.5 }}>${f.description}</div>
        </div>
        `).join('\n        ')}
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Default text-focused feature scene
  return `
const ${componentName}: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '${backgroundColor}',
      padding: 80,
    }}>
      ${icon ? `<div style={{
        fontSize: 64,
        marginBottom: 24,
        opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: \`scale(\${spring({ frame, fps: 30, from: 0, to: 1, config: { damping: 15 } })})\`,
      }}>${icon}</div>` : ""}

      <div style={{
        fontSize: 48,
        fontWeight: 600,
        color: '${textColor}',
        textAlign: 'center',
        opacity: interpolate(frame, [5, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        <TypewriterText text="${headlineText}" frame={frame} startFrame={5} speed={2} />
      </div>

      ${subtextText ? `<div style={{
        fontSize: 24,
        color: '${subtextColor}',
        textAlign: 'center',
        marginTop: 24,
        opacity: interpolate(frame, [${10 + headlineText.split(' ').length * 5}, ${25 + headlineText.split(' ').length * 5}], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        ${subtextText}
      </div>` : ""}
    </AbsoluteFill>
  );
};`;
}

// ============================================================================
// FLOATING-GLASS STYLE SCENE COMPONENTS
// ============================================================================

function generateFloatingGlassSceneComponent(scene: VideoScene, index: number, totalScenes: number, recordings?: Array<{
  id: string;
  videoUrl: string;
  zoomPoints?: Array<{ time: number; x: number; y: number; scale: number; duration: number }>;
  cursorData?: Array<{ x: number; y: number; timestamp: number; type: string }>;
  cursorStyle?: "normal" | "hand";
}>): string {
  const sceneType = getSceneType(scene);
  const headline = scene.content.headline || "";
  const subtext = scene.content.subtext || "";
  const icon = scene.content.icon || "";
  const features = scene.content.features || [];

  const componentName = `Scene${index + 1}`;
  
  // SAAS-DEMO: Dark gradient backgrounds with floating UI elements
  const backgroundGradient = index % 2 === 0 
    ? "linear-gradient(180deg, #0a0a0f 0%, #1a0a2e 50%, #0a0a0f 100%)"
    : "linear-gradient(180deg, #0f0a1a 0%, #1a0f2e 50%, #0a0a0f 100%)";

  // Split text for typewriter effect
  const headlineText = headline;
  const subtextText = subtext;

  if (sceneType === "intro") {
    return `
const ${componentName}: React.FC<{ frame: number }> = ({ frame }) => {
  // Floating UI cards data
  const cards = [
    { x: 50, y: 80, width: 280, height: 120, delay: 0 },
    { x: 750, y: 50, width: 320, height: 140, delay: 10 },
    { x: 1400, y: 100, width: 260, height: 100, delay: 20 },
    { x: 200, y: 600, width: 300, height: 130, delay: 15 },
    { x: 1000, y: 650, width: 340, height: 150, delay: 25 },
    { x: 1550, y: 580, width: 280, height: 110, delay: 5 },
  ];

  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '${backgroundGradient}',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: 800,
        height: 400,
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
        filter: 'blur(60px)',
        opacity: interpolate(frame % 60, [0, 30, 60], [0.7, 1, 0.7], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }} />

      {/* Floating UI Cards */}
      {cards.map((card, i) => {
        const cardOpacity = interpolate(frame - card.delay, [0, 30], [0, 0.7], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const cardScale = interpolate(frame - card.delay, [0, 30], [0.8, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        });
        const floatY = Math.sin((frame + card.delay) * 0.03) * 8;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: card.x,
              top: card.y + floatY,
              width: card.width,
              height: card.height,
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(10px)',
              borderRadius: 16,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              opacity: cardOpacity,
              transform: \`scale(\${cardScale})\`,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: 16, height: '100%' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ width: 80, height: 8, background: 'rgba(139, 92, 246, 0.5)', borderRadius: 4 }} />
                <div style={{ width: 40, height: 8, background: 'rgba(255, 255, 255, 0.2)', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ width: '90%', height: 6, background: 'rgba(255, 255, 255, 0.15)', borderRadius: 3 }} />
                <div style={{ width: '70%', height: 6, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 3 }} />
                <div style={{ width: '85%', height: 6, background: 'rgba(255, 255, 255, 0.12)', borderRadius: 3 }} />
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', gap: 8, paddingTop: 12 }}>
                <div style={{ width: 60, height: 24, background: 'rgba(139, 92, 246, 0.3)', borderRadius: 4 }} />
                <div style={{ width: 60, height: 24, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 4 }} />
              </div>
            </div>
          </div>
        );
      })}

      {/* Main Text with Typewriter Effect */}
      <div style={{
        textAlign: 'center',
        zIndex: 10,
        position: 'relative',
      }}>
        <div style={{
          fontSize: 72,
          fontWeight: 500,
          color: 'white',
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
        }}>
          <TypewriterText text="${headlineText}" frame={frame} speed={1.5} />
        </div>
        {subtextText && (
          <div style={{
            fontSize: 72,
            fontWeight: 500,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
            marginTop: 8,
            background: 'linear-gradient(90deg, #a78bfa 0%, #c084fc 50%, #e879f9 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            <TypewriterText text="${subtextText}" frame={frame} startFrame={45} speed={1.5} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};`;
  }

  if (sceneType === "cta") {
    return `
const ${componentName}: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '${backgroundGradient}',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: 600,
        height: 300,
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.5) 0%, transparent 70%)',
        filter: 'blur(60px)',
        opacity: interpolate(frame % 60, [0, 30, 60], [0.7, 1, 0.7], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }} />

      <div style={{
        fontSize: 56,
        fontWeight: 600,
        color: 'white',
        textAlign: 'center',
        opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: \`translateY(\${interpolate(frame, [0, 20], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)\`,
      }}>
        <TypewriterText text="${headlineText}" frame={frame} speed={2} />
      </div>
      
      {subtextText && (
        <div style={{
          fontSize: 28,
          color: 'rgba(255,255,255,0.8)',
          textAlign: 'center',
          marginTop: 24,
          opacity: interpolate(frame, [20, 40], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          {subtextText}
        </div>
      )}
    </AbsoluteFill>
  );
};`;
  }

  // Screenshot scene with 3D perspective card
  if (sceneType === "screenshot" && scene.content.image) {
    const imgUrl = scene.content.image;
    const isR2 = imgUrl.startsWith("http");
    const imgSrc = isR2 ? `"${imgUrl}"` : `staticFile("${imgUrl.replace(/^\//, "")}")`;
    
    return `
const ${componentName}: React.FC<{ frame: number }> = ({ frame }) => {
  const rotateX = interpolate(frame, [0, 20], [15, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rotateY = interpolate(frame, [0, 20], [-10, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scale = spring({ frame, fps: 30, from: 0.8, to: 1, config: { damping: 12, stiffness: 100 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '${backgroundGradient}',
      padding: 60,
      perspective: '1200px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: 700,
        height: 350,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
        filter: 'blur(60px)',
      }} />

      {headlineText && (
        <div style={{
          fontSize: 48,
          fontWeight: 600,
          color: 'white',
          marginBottom: 40,
          textAlign: 'center',
          opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        }}>
          <TypewriterText text="${headlineText}" frame={frame} speed={2} />
        </div>
      )}

      <div style={{
        transform: \`perspective(1200px) rotateX(\${rotateX}deg) rotateY(\${rotateY}deg) scale(\${scale})\`,
        transformStyle: 'preserve-3d',
        opacity,
        boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        <Img src={${imgSrc}} style={{
          width: '100%',
          height: 'auto',
          maxHeight: 500,
          objectFit: 'cover',
          borderRadius: 12,
        }} />
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Recording scene
  if (sceneType === "recording") {
    const videoUrl = (scene.content as any).recordingVideoUrl || "";
    const featureName = (scene.content as any).featureName || headline;
    const recordingId = (scene.content as any).recordingId || "";
    const isR2Video = videoUrl.startsWith("http");
    const videoSrc = isR2Video ? `"${videoUrl}"` : `staticFile("${videoUrl.replace(/^\//, "")}")`;

    const recording = recordings?.find(r => r.id === recordingId);
    const cursorData = recording?.cursorData || [];
    const { cursorCode, cursorRenderCode } = generateCursorOverlayCode(cursorData, recording?.cursorStyle || "hand", "  ");

    return `
const ${componentName}: React.FC<{ frame: number }> = ({ frame }) => {
  const { fps, durationInFrames } = useVideoConfig();
  ${cursorCode}
  const mockupScale = spring({ frame, fps, from: 0.85, to: 1, config: { damping: 15, stiffness: 100 } });
  const mockupOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const labelOpacity = interpolate(frame, [0, 30, durationInFrames - 30, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '${backgroundGradient}',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: 800,
        height: 400,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
        filter: 'blur(60px)',
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '85%',
        maxWidth: 1000,
        transform: \`scale(\${mockupScale})\`,
        opacity: mockupOpacity,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 25px 80px rgba(0,0,0,0.4)',
      }}>
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <Video src=${videoSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ${cursorRenderCode}
        </div>
      </div>

      <div style={{
        position: 'absolute',
        bottom: 60,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: labelOpacity,
        zIndex: 10,
      }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(12px)',
          borderRadius: 12,
          padding: '12px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #a855f7, #ec4899)',
          }} />
          <span style={{
            fontWeight: 600,
            fontSize: 20,
            color: '#ffffff',
          }}>${featureName}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Feature scene with cards
  if (features.length > 0) {
    return `
const ${componentName}: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '${backgroundGradient}',
      padding: 60,
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: 700,
        height: 350,
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%)',
        filter: 'blur(60px)',
      }} />

      <div style={{
        fontSize: 48,
        fontWeight: 600,
        color: 'white',
        marginBottom: 40,
        textAlign: 'center',
        opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        <TypewriterText text="${headlineText}" frame={frame} speed={2} />
      </div>

      <div style={{
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 1200,
      }}>
        ${features.map((f, i) => `
        <div key={${i}} style={{
          width: 280,
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: 32,
          opacity: interpolate(frame, [${20 + i * 10}, ${35 + i * 10}], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
          transform: \`translateY(\${interpolate(frame, [${20 + i * 10}, ${35 + i * 10}], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}px)\`,
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>${f.icon || "✨"}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>${f.title}</div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>${f.description}</div>
        </div>
        `).join('\n        ')}
      </div>
    </AbsoluteFill>
  );
};`;
  }

  // Default text-focused feature scene
  return `
const ${componentName}: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '${backgroundGradient}',
      padding: 80,
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        width: 600,
        height: 300,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%)',
        filter: 'blur(60px)',
        opacity: interpolate(frame % 60, [0, 30, 60], [0.7, 1, 0.7], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }} />

      ${icon ? `<div style={{
        fontSize: 72,
        marginBottom: 24,
        opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        transform: \`scale(\${spring({ frame, fps: 30, from: 0, to: 1, config: { damping: 15 } })})\`,
      }}>${icon}</div>` : ""}

      <div style={{
        fontSize: 56,
        fontWeight: 600,
        color: 'white',
        textAlign: 'center',
        opacity: interpolate(frame, [5, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        <TypewriterText text="${headlineText}" frame={frame} startFrame={5} speed={2} />
      </div>

      ${subtextText ? `<div style={{
        fontSize: 28,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        marginTop: 24,
        opacity: interpolate(frame, [${10 + headlineText.split(' ').length * 5}, ${25 + headlineText.split(' ').length * 5}], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
      }}>
        ${subtextText}
      </div>` : ""}
    </AbsoluteFill>
  );
};`;
}

// TypewriterText component for floating-glass style
const typewriterTextComponent = `
const TypewriterText: React.FC<{
  text: string;
  frame: number;
  startFrame?: number;
  speed?: number;
  style?: React.CSSProperties;
  showCursor?: boolean;
}> = ({ text, frame, startFrame = 0, speed = 2, style = {}, showCursor = true }) => {
  const adjustedFrame = Math.max(0, frame - startFrame);
  const charsToShow = Math.floor(adjustedFrame / speed);
  const displayedText = text.slice(0, charsToShow);
  const isComplete = charsToShow >= text.length;
  
  const cursorOpacity = isComplete 
    ? interpolate(frame % 30, [0, 15, 30], [1, 0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 1;

  return (
    <span style={{ ...style, display: 'inline-flex', alignItems: 'center' }}>
      {displayedText}
      {showCursor && (
        <span
          style={{
            display: 'inline-block',
            width: '3px',
            height: '1em',
            background: style.color || 'white',
            marginLeft: '2px',
            opacity: cursorOpacity,
          }}
        />
      )}
    </span>
  );
};
`;

interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

function generateFullCode(
  videoScript: VideoScript,
  screenshots?: any[],
  audioUrl?: string,
  bpm?: number,
  targetDurationSeconds?: number,
  brandColors?: BrandColors,
  recordings?: Array<{
    id: string;
    videoUrl: string;
    zoomPoints?: Array<{ time: number; x: number; y: number; scale: number; duration: number }>;
    cursorData?: Array<{ x: number; y: number; timestamp: number; type: string }>;
    cursorStyle?: "normal" | "hand";
  }>,
  style: "aurora" | "floating-glass" | "blue-clean" = "aurora"
): string {
  const scenes = videoScript.scenes;
  const effectiveBpm = bpm || 120;
  const framesPerBeat = (60 / effectiveBpm) * 30; // at 30fps

  // Brand color theming — fall back to default purple/pink
  const primary = brandColors?.primary || '#a855f7';
  const secondary = brandColors?.secondary || '#ec4899';
  const accent = brandColors?.accent || '#8b5cf6';

  // Check if any scene uses screenshots/images
  const hasImages = scenes.some(s => s.content.image) || (screenshots && screenshots.length > 0);

  // Check if any scene uses recordings
  const hasRecordings = scenes.some(s => s.type === "recording");

  // Snap scene durations to beat boundaries
  let currentFrame = 0;
  for (const scene of scenes) {
    const originalDuration = scene.endFrame - scene.startFrame;
    const snappedDuration = snapToBeats(originalDuration, framesPerBeat);
    scene.startFrame = currentFrame;
    scene.endFrame = currentFrame + snappedDuration;
    currentFrame += snappedDuration;
  }
  videoScript.totalDuration = currentFrame;

  // =========================================================================
  // DURATION ENFORCEMENT (post beat-snap)
  // =========================================================================
  if (targetDurationSeconds && targetDurationSeconds >= 10) {
    const targetFrames = targetDurationSeconds * 30;
    if (videoScript.totalDuration < targetFrames * 0.8) {
      console.log(
        `[TemplateCodeGenerator] Duration too short after beat-snap: ${videoScript.totalDuration} frames vs target ${targetFrames}. Scaling...`,
      );

      // Scale scene durations proportionally
      const scaleFactor = targetFrames / videoScript.totalDuration;
      for (const scene of scenes) {
        const duration = scene.endFrame - scene.startFrame;
        const scaled = Math.round(duration * scaleFactor);
        // Clamp between 1 beat and 10 seconds, then re-snap to beats
        const clamped = Math.max(framesPerBeat, Math.min(300, scaled));
        scene.endFrame = scene.startFrame + snapToBeats(clamped, framesPerBeat);
      }

      // Recalculate sequential positions
      let frame = 0;
      for (const scene of scenes) {
        const duration = scene.endFrame - scene.startFrame;
        scene.startFrame = frame;
        scene.endFrame = frame + duration;
        frame += duration;
      }
      videoScript.totalDuration = frame;
      console.log(
        `[TemplateCodeGenerator] Adjusted duration: ${videoScript.totalDuration} frames (${(videoScript.totalDuration / 30).toFixed(1)}s)`,
      );
    }
  }

  // Generate scene components based on style
  const sceneGenerator = style === "floating-glass" 
    ? generateFloatingGlassSceneComponent 
    : style === "blue-clean"
    ? generateBlueCleanSceneComponent
    : generateSceneComponent;
  const sceneComponents = scenes
    .map((scene, i) => sceneGenerator(scene, i, scenes.length, recordings))
    .join("\n");

  // Generate sequence renders
  const sequenceRenders = scenes
    .map((scene, i) => {
      const componentName = `Scene${i + 1}`;
      const duration = scene.endFrame - scene.startFrame;
      const frameProp = style === "floating-glass" || style === "blue-clean" ? " frame={useCurrentFrame()}" : "";
      return `      <Sequence from={${scene.startFrame}} durationInFrames={${duration}}>
        <${componentName}${frameProp} />
      </Sequence>`;
    })
    .join("\n");

  // Scene boundaries for progress dots
  const sceneBoundaries = scenes.map((s) => s.startFrame);

  // Audio element — use URL directly for R2, staticFile for local
  const isR2Audio = audioUrl && audioUrl.startsWith("http");
  const audioSrc = audioUrl
    ? (isR2Audio ? `"${audioUrl}"` : `staticFile("${audioUrl.replace(/^\//, "")}")`)
    : `staticFile("audio/audio1.mp3")`;

  // Helper: convert hex to r,g,b for rgba usage in template
  const hexToRgb = (hex: string) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16) || 168;
    const g = parseInt(h.substring(2, 4), 16) || 85;
    const b = parseInt(h.substring(4, 6), 16) || 247;
    return `${r}, ${g}, ${b}`;
  };
  const pRgb = hexToRgb(primary);
  const sRgb = hexToRgb(secondary);
  const aRgb = hexToRgb(accent);

  // Style-specific component selection
  const isFloatingGlass = style === "floating-glass";
  const isBlueClean = style === "blue-clean";
  const fontImport = isFloatingGlass || isBlueClean
    ? `import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
const { fontFamily: inter } = loadInter("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });`
    : `import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
const { fontFamily: montserrat } = loadMontserrat("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] });`;

  return `// Auto-generated Premium Remotion Video (${style} Style)
// Generated at: ${new Date().toISOString()}
import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  Sequence,
  Audio,
  interpolate,
  spring,${isFloatingGlass || isBlueClean ? `
  Easing,` : ""}${hasImages ? `
  Img,` : ""}${hasRecordings ? `
  Video,` : ""}
  staticFile,
} from 'remotion';
${fontImport}

${isFloatingGlass || isBlueClean ? typewriterTextComponent : `
// ============================================================================
// AURORA BACKGROUND
// ============================================================================

const AuroraBackground: React.FC<{
  variant?: 'dark' | 'light';
  fadeIn?: boolean;
}> = ({ variant = 'dark', fadeIn = false }) => {
  const frame = useCurrentFrame();
  const opacity = fadeIn ? interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' }) : 1;

  if (variant === 'light') {
    return (
      <AbsoluteFill style={{
        opacity,
        background: \`
          radial-gradient(ellipse at 30% 30%, rgba(${pRgb}, 0.2) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 70%, rgba(${sRgb}, 0.2) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 50%, rgba(${aRgb}, 0.15) 0%, transparent 60%),
          linear-gradient(135deg, #faf5ff 0%, #fff5f8 50%, #f5f0ff 100%)
        \`,
      }} />
    );
  }

  return (
    <AbsoluteFill style={{
      opacity,
      background: \`
        radial-gradient(ellipse at 20% 20%, rgba(${pRgb}, 0.3) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(${sRgb}, 0.3) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(${aRgb}, 0.2) 0%, transparent 70%),
        #0a0a0f
      \`,
    }} />
  );
};`}

// ============================================================================
// WORD BY WORD BLUR REVEAL
// ============================================================================

const WordByWordBlur: React.FC<{
  words: string[];
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  color?: string;
  delay?: number;
  staggerFrames?: number;
  gradientWordIndices?: number[];
}> = ({ words, fontSize = 48, fontFamily = montserrat, fontWeight = 600, color = '#ffffff', delay = 0, staggerFrames = 5, gradientWordIndices = [] }) => {
  const frame = useCurrentFrame();

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
      {words.map((word, i) => {
        const wordStart = delay + i * staggerFrames;
        const f = Math.max(0, frame - wordStart);
        const op = interpolate(f, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
        const blur = interpolate(f, [0, 15], [10, 0], { extrapolateRight: 'clamp' });
        const ty = interpolate(f, [0, 15], [30, 0], { extrapolateRight: 'clamp' });
        const isGradient = gradientWordIndices.includes(i);

        return (
          <span key={i} style={{
            fontSize,
            fontFamily,
            fontWeight,
            opacity: op,
            filter: \`blur(\${blur}px)\`,
            transform: \`translateY(\${ty}px)\`,
            display: 'inline-block',
            marginRight: i < words.length - 1 ? '0.8em' : 0,
            ...(isGradient ? {
              background: 'linear-gradient(135deg, ${primary}, ${secondary})',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            } : { color }),
          }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ============================================================================
// WHITE GLASS CARD
// ============================================================================

const WhiteGlassCard: React.FC<{
  children: React.ReactNode;
  maxWidth?: number;
  delay?: number;
  entryAnimation?: 'slide-up' | 'perspective' | 'scale';
  padding?: number;
}> = ({ children, maxWidth = 800, delay = 0, entryAnimation = 'slide-up', padding = 48 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  let transform = '';
  if (entryAnimation === 'slide-up') {
    const ty = interpolate(f, [0, 25], [60, 0], { extrapolateRight: 'clamp' });
    const s = spring({ frame: f, fps, from: 0.95, to: 1, config: { damping: 15, stiffness: 100 } });
    transform = \`translateY(\${ty}px) scale(\${s})\`;
  } else if (entryAnimation === 'perspective') {
    const rx = interpolate(f, [0, 30], [-20, 0], { extrapolateRight: 'clamp' });
    const ty = interpolate(f, [0, 30], [100, 0], { extrapolateRight: 'clamp' });
    transform = \`perspective(1000px) rotateX(\${rx}deg) translateY(\${ty}px)\`;
  } else {
    const s = spring({ frame: f, fps, from: 0.8, to: 1, config: { damping: 12, stiffness: 100 } });
    transform = \`scale(\${s})\`;
  }

  return (
    <div style={{
      maxWidth,
      width: '100%',
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderRadius: 24,
      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
      padding,
      opacity,
      transform,
      transformOrigin: 'center bottom',
    }}>
      {children}
    </div>
  );
};

// ============================================================================
// GRADIENT ACCENT TEXT
// ============================================================================

const GradientAccentText: React.FC<{
  text: string;
  fontSize?: number;
  fontFamily?: string;
  delay?: number;
}> = ({ text, fontSize = 64, fontFamily = montserrat, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const scale = spring({ frame: f, fps, from: 0.8, to: 1, config: { damping: 15, stiffness: 100 } });
  const opacity = interpolate(f, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <span style={{
      fontSize,
      fontFamily,
      fontWeight: 700,
      display: 'inline-block',
      background: 'linear-gradient(135deg, ${primary}, ${secondary})',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      opacity,
      transform: \`scale(\${scale})\`,
    }}>
      {text}
    </span>
  );
};

// ============================================================================
// LOGO WITH GLOW
// ============================================================================

const LogoWithGlow: React.FC<{
  brandName: string;
  accentSuffix?: string;
  fontSize?: number;
  delay?: number;
}> = ({ brandName, accentSuffix, fontSize = 96, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - delay);
  const textOpacity = interpolate(f, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const textScale = spring({ frame: f, fps, from: 0.8, to: 1, config: { damping: 15, stiffness: 100 } });
  const glowScale = interpolate(f, [0, 40], [0.5, 1.5], { extrapolateRight: 'clamp' });
  const glowOpacity = interpolate(f, [0, 20, 40], [0, 0.6, 0.4], { extrapolateRight: 'clamp' });

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        position: 'absolute',
        width: '120%',
        height: '200%',
        background: 'linear-gradient(135deg, rgba(${pRgb}, 0.6), rgba(${sRgb}, 0.6))',
        filter: 'blur(40px)',
        borderRadius: '50%',
        opacity: glowOpacity,
        transform: \`scale(\${glowScale})\`,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.15em',
        opacity: textOpacity,
        transform: \`scale(\${textScale})\`,
      }}>
        <span style={{ fontSize, fontFamily: montserrat, fontWeight: 700, color: '#ffffff' }}>
          {brandName}
        </span>
        {accentSuffix && (
          <span style={{
            fontSize,
            fontFamily: montserrat,
            fontWeight: 700,
            background: 'linear-gradient(135deg, ${primary}, ${secondary})',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {accentSuffix}
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SCALE IN HELPER
// ============================================================================

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

// ============================================================================
// DEVICE MOCKUP FRAMES
// ============================================================================
${hasRecordings ? `
const BrowserMockup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)' }}>
    <div style={{ background: '#2d2d2d', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e' }} />
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840' }} />
      </div>
      <div style={{ flex: 1, marginLeft: 12 }}>
        <div style={{ background: '#1e1e1e', borderRadius: 6, padding: '4px 12px', fontSize: 12, color: '#888', fontFamily: montserrat }}>
          app.example.com
        </div>
      </div>
    </div>
    <div style={{ background: '#1e1e1e', aspectRatio: '16/9', overflow: 'hidden' }}>{children}</div>
  </div>
);

const MacBookMockup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
    <div style={{ width: '100%', border: '2px solid #333', borderRadius: '12px 12px 0 0', overflow: 'hidden', background: '#1a1a1a' }}>
      <div style={{ background: '#2d2d2d', padding: '6px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#555' }} />
      </div>
      <div style={{ aspectRatio: '16/10', overflow: 'hidden' }}>{children}</div>
    </div>
    <div style={{ width: '110%', height: 14, background: 'linear-gradient(180deg, #555 0%, #333 100%)', borderRadius: '0 0 8px 8px' }} />
  </div>
);

const MinimalMockup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.1)' }}>
    <div style={{ aspectRatio: '16/9', overflow: 'hidden' }}>{children}</div>
  </div>
);
` : ''}
// ============================================================================
// SCENE PROGRESS DOTS
// ============================================================================

const SceneProgressDots: React.FC<{
  totalScenes: number;
  sceneBoundaries: number[];
  beatPulse?: number;
}> = ({ totalScenes, sceneBoundaries, beatPulse = 0 }) => {
  const frame = useCurrentFrame();
  let currentScene = 0;
  for (let i = sceneBoundaries.length - 1; i >= 0; i--) {
    if (frame >= sceneBoundaries[i]) {
      currentScene = i;
      break;
    }
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: 40,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 8,
      alignItems: 'center',
      zIndex: 100,
    }}>
      {Array.from({ length: totalScenes }, (_, i) => {
        const isActive = i === currentScene;
        const isPast = i < currentScene;
        const dotScale = isActive ? 1 + beatPulse * 0.15 : 1;
        return (
          <div key={i} style={{
            width: isActive ? 24 : 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: isActive ? '${primary}' : isPast ? 'rgba(${pRgb}, 0.5)' : 'rgba(255, 255, 255, 0.3)',
            transform: \`scale(\${dotScale})\`,
          }} />
        );
      })}
    </div>
  );
};

// ============================================================================
// BEAT SYNC HOOK
// ============================================================================

const useBeatSync = (bpm: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const framesPerBeat = (60 / bpm) * fps;
  const beatProgress = (frame % framesPerBeat) / framesPerBeat;
  const beatPulse = Math.exp(-beatProgress * 4);
  return { beatProgress, beatPulse, framesPerBeat };
};

// ============================================================================
// SCENE COMPONENTS
// ============================================================================
${sceneComponents}

// ============================================================================
// MAIN COMPOSITION
// ============================================================================

const ProductVideo: React.FC = () => {
  ${isFloatingGlass ? '' : `const { beatPulse } = useBeatSync(${effectiveBpm});`}
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0f' }}>
      <Audio src=${audioSrc} volume={1} />
${sequenceRenders}
      ${isFloatingGlass ? '' : `<SceneProgressDots
        totalScenes={${scenes.length}}
        sceneBoundaries={${JSON.stringify(sceneBoundaries)}}
        beatPulse={beatPulse}
      />`}
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
    const screenshots = (state.productData as any)?.screenshots || [];

    // Ensure the last scene is always a CTA
    const lastScene = videoScript.scenes[videoScript.scenes.length - 1];
    if (lastScene && lastScene.type !== "cta") {
      const ctaDuration = 90; // 3 seconds
      videoScript.scenes.push({
        id: `cta-${Date.now()}`,
        startFrame: lastScene.endFrame,
        endFrame: lastScene.endFrame + ctaDuration,
        type: "cta",
        content: {
          headline: state.productData?.tagline || "Get Started Today",
          subtext: state.productData?.name || "",
        },
        animation: { enter: "blur-reveal", staggerDelay: 5 },
        style: { auroraVariant: "dark", textColor: "#ffffff", fontSize: "large", layout: "centered", cardStyle: "none" },
      } as any);
      videoScript.totalDuration = lastScene.endFrame + ctaDuration;
    }

    // Inject screenshot URLs into scenes that reference images or add screenshot scenes
    if (screenshots.length > 0) {
      let screenshotInjected = 0;
      for (const scene of videoScript.scenes) {
        if ((scene.type as string) === "screenshot" && !scene.content.image && screenshotInjected < screenshots.length) {
          scene.content.image = screenshots[screenshotInjected].url;
          screenshotInjected++;
        }
      }
      // If no screenshot scenes exist, inject one before the CTA
      if (screenshotInjected === 0) {
        const heroShot = screenshots.find((s: any) => s.section === "hero") || screenshots[0];
        if (heroShot) {
          const ctaIndex = videoScript.scenes.findIndex(s => s.type === "cta");
          if (ctaIndex > 0) {
            const prevScene = videoScript.scenes[ctaIndex - 1];
            const shotDuration = 75; // 2.5 seconds
            const shotScene = {
              id: `screenshot-${Date.now()}`,
              startFrame: prevScene.endFrame,
              endFrame: prevScene.endFrame + shotDuration,
              type: "screenshot",
              content: { headline: "See it in action", image: heroShot.url },
              animation: { enter: "perspective-card", staggerDelay: 5 },
              style: { auroraVariant: "light", textColor: "#0a0a0f", fontSize: "medium", layout: "card", cardStyle: "white-glass" },
            } as any;
            // Shift CTA and update total duration
            const ctaScene = videoScript.scenes[ctaIndex];
            const ctaDuration = ctaScene.endFrame - ctaScene.startFrame;
            ctaScene.startFrame = shotScene.endFrame;
            ctaScene.endFrame = shotScene.endFrame + ctaDuration;
            videoScript.scenes.splice(ctaIndex, 0, shotScene);
            videoScript.totalDuration = ctaScene.endFrame;
          }
        }
      }
    }

    // Extract audio config from state
    const audioUrl = state.userPreferences?.audio?.url || undefined;
    const audioBpm = state.userPreferences?.audio?.bpm || videoScript.music?.tempo || 120;

    console.log(
      `[TemplateCodeGenerator] Processing ${videoScript.scenes.length} scenes (BPM: ${audioBpm}, audio: ${audioUrl || 'default'})...`,
    );

    const targetDurationSeconds = state.userPreferences?.duration || undefined;
    const colors = state.productData?.colors || undefined;
    const templateStyle = state.userPreferences?.templateStyle || "aurora";
    const generatedCode = generateFullCode(videoScript, screenshots, audioUrl, audioBpm, targetDurationSeconds, colors, state.recordings, templateStyle);

    console.log(
      `[TemplateCodeGenerator] Generated ${generatedCode.length} chars of code`,
    );

    // Validate the generated code
    const hasRemotion = generatedCode.includes("remotion");
    const hasUseCurrentFrame = generatedCode.includes("useCurrentFrame");
    const hasInterpolate = generatedCode.includes("interpolate");
    const hasAurora = templateStyle === "aurora" ? generatedCode.includes("AuroraBackground") : true;
    const hasWordBlur = templateStyle === "aurora" ? generatedCode.includes("WordByWordBlur") : true;
    const hasTypewriter = templateStyle === "floating-glass" ? generatedCode.includes("TypewriterText") : true;
    const hasFont = templateStyle === "aurora" ? generatedCode.includes("Montserrat") : generatedCode.includes("Inter");

    console.log("[TemplateCodeGenerator] Validation:");
    console.log("  - Has remotion import:", hasRemotion);
    console.log("  - Has useCurrentFrame:", hasUseCurrentFrame);
    console.log("  - Has interpolate:", hasInterpolate);
    console.log(`  - Template Style: ${templateStyle}`);
    if (templateStyle === "aurora") {
      console.log("  - Has aurora background:", hasAurora);
      console.log("  - Has word blur reveal:", hasWordBlur);
    } else {
      console.log("  - Has typewriter text:", hasTypewriter);
    }
    console.log("  - Has font import:", hasFont);

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
