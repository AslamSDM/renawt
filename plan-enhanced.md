# Motion Graphic Video Generation Platform - Enhanced Implementation Plan

## Overview

A platform that generates **high-energy, professional product videos** from website URLs or descriptions using AI agents, Remotion for rendering, and dynamic animation systems.

---

## Key Enhancements for Dynamic Videos

### 1. Dynamic Background System

#### Background Types

| Type | Description | Use Case |
|------|-------------|----------|
| **Animated Gradients** | Moving gradient meshes, color shifts | Modern tech products |
| **Particle Systems** | Floating dots, connected networks | AI/Data products |
| **Video Backgrounds** | Looping abstract motion graphics | High-end presentations |
| **Geometric Patterns** | Moving shapes, grids, lines | Professional/business |
| **Gradient Mesh** | Organic color blobs that morph | Creative/artistic brands |
| **Noise/Grain** | Animated texture overlays | Edgy/startup aesthetic |
| **3D Depth** | Parallax layers, moving planes | Premium feel |

#### Implementation

```tsx
// lib/remotion/backgrounds/GradientMesh.tsx
import { useCurrentFrame, interpolate, useVideoConfig } from 'remotion';

export const GradientMesh: React.FC<{
  colors: string[];
  speed?: number;
}> = ({ colors, speed = 1 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  
  // Animate gradient positions
  const t = (frame / durationInFrames) * speed;
  
  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(circle at ${30 + Math.sin(t * Math.PI * 2) * 20}% ${30 + Math.cos(t * Math.PI * 2) * 20}%, ${colors[0]} 0%, transparent 50%),
          radial-gradient(circle at ${70 + Math.cos(t * Math.PI * 2) * 20}% ${70 + Math.sin(t * Math.PI * 2) * 20}%, ${colors[1]} 0%, transparent 50%),
          ${colors[2]}
        `,
      }}
    />
  );
};
```

```tsx
// lib/remotion/backgrounds/ParticleField.tsx
import { useCurrentFrame, random } from 'remotion';

export const ParticleField: React.FC<{
  particleCount?: number;
  color?: string;
  speed?: number;
}> = ({ particleCount = 50, color = '#ffffff', speed = 1 }) => {
  const frame = useCurrentFrame();
  
  const particles = Array.from({ length: particleCount }, (_, i) => ({
    id: i,
    x: random(`x-${i}`) * 100,
    y: random(`y-${i}`) * 100,
    size: random(`size-${i}`) * 4 + 1,
    speed: random(`speed-${i}`) * 0.5 + 0.2,
  }));
  
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${(p.y + (frame * p.speed * speed)) % 100}%`,
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: color,
            opacity: 0.3,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
```

### 2. Fast-Paced Animation System

#### Animation Timing Guidelines

| Animation Type | Duration (frames @ 30fps) | Easing |
|----------------|---------------------------|--------|
| Text entrance | 15-20 frames (0.5-0.7s) | spring({ damping: 12 }) |
| Text exit | 10-15 frames (0.3-0.5s) | spring({ damping: 15 }) |
| Scene transitions | 10-20 frames (0.3-0.7s) | linear or easeOut |
| Beat sync pulse | 5-8 frames (0.15-0.25s) | spring({ damping: 8 }) |
| Background shifts | 60-90 frames (2-3s) | smooth |

#### High-Energy Text Animations

```tsx
// lib/remotion/components/KineticText.tsx
import { useCurrentFrame, spring, useVideoConfig, interpolate } from 'remotion';

export const KineticText: React.FC<{
  text: string;
  startFrame: number;
  style?: React.CSSProperties;
}> = ({ text, startFrame, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const delay = frame - startFrame;
  
  // Quick spring entrance
  const scale = spring({
    frame: delay,
    fps,
    config: { mass: 0.8, damping: 12, stiffness: 200 },
  });
  
  // Staggered character animation
  return (
    <div style={{ display: 'flex', ...style }}>
      {text.split('').map((char, i) => {
        const charDelay = delay - i * 2;
        const charY = spring({
          frame: charDelay,
          fps,
          config: { mass: 0.5, damping: 15, stiffness: 300 },
        });
        
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translateY(${(1 - charY) * 50}px) scale(${charY})`,
              opacity: charY,
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        );
      })}
    </div>
  );
};
```

#### Glitch Effect for Impact

```tsx
// lib/remotion/components/GlitchText.tsx
import { useCurrentFrame, interpolate, random } from 'remotion';

export const GlitchText: React.FC<{
  text: string;
  triggerFrame: number;
  duration?: number;
}> = ({ text, triggerFrame, duration = 10 }) => {
  const frame = useCurrentFrame();
  const delay = frame - triggerFrame;
  
  const isGlitching = delay >= 0 && delay < duration;
  
  const glitchOffset = isGlitching
    ? {
        x: random(`${frame}-x`) * 10 - 5,
        y: random(`${frame}-y`) * 4 - 2,
      }
    : { x: 0, y: 0 };
    
  const opacity = isGlitching
    ? interpolate(delay, [0, duration / 2, duration], [1, 0.8, 1])
    : 1;
  
  return (
    <div style={{ position: 'relative' }}>
      {/* Main text */}
      <div style={{ opacity }}>{text}</div>
      
      {/* Glitch layers */}
      {isGlitching && (
        <>
          <div
            style={{
              position: 'absolute',
              top: glitchOffset.y,
              left: glitchOffset.x,
              color: '#ff0000',
              mixBlendMode: 'screen',
              opacity: 0.8,
              clipPath: `inset(${random(`${frame}-clip`) * 100}% 0 ${random(`${frame}-clip2`) * 100}% 0)`,
            }}
          >
            {text}
          </div>
          <div
            style={{
              position: 'absolute',
              top: -glitchOffset.y,
              left: -glitchOffset.x,
              color: '#00ffff',
              mixBlendMode: 'screen',
              opacity: 0.8,
              clipPath: `inset(${random(`${frame}-clip3`) * 100}% 0 ${random(`${frame}-clip4`) * 100}% 0)`,
            }}
          >
            {text}
          </div>
        </>
      )}
    </div>
  );
};
```

### 3. Beat-Synced Animation System

#### Enhanced Beat Detection

```typescript
// lib/audio/beatDetector.ts
interface BeatMap {
  bpm: number;
  beats: number[];        // All beat positions
  downbeats: number[];    // First beat of each bar (stronger)
  drops: number[];        // Build-up and drop points
  energy: number[];       // Energy level per frame (0-1)
}

async function analyzeAudio(audioUrl: string): Promise<BeatMap> {
  const audioContext = new AudioContext();
  const response = await fetch(audioUrl);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // Use Meyda or Essentia.js for advanced analysis
  const essentia = new Essentia(EssentiaWASM);
  
  // Beat tracking
  const beatTracker = essentia.BeatTrackerMultiFeature(audioBuffer);
  const beats = beatTracker.ticks.map((t) => Math.round(t * 30));
  
  // Spectral analysis for energy
  const energy = analyzeEnergy(audioBuffer, 30); // 30fps
  
  // Detect drops (energy spikes)
  const drops = detectDrops(energy, beats);
  
  return {
    bpm: beatTracker.bpm,
    beats,
    downbeats: beats.filter((_, i) => i % 4 === 0),
    drops,
    energy,
  };
}
```

#### Beat-Reactive Components

```tsx
// lib/remotion/components/BeatSync.tsx
import { useCurrentFrame, spring, useVideoConfig } from 'remotion';
import { useBeatMap } from '../hooks/useBeatMap';

export const BeatPulse: React.FC<{
  children: React.ReactNode;
  intensity?: number;
}> = ({ children, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beatMap = useBeatMap();
  
  // Find nearest beat
  const nearestBeat = beatMap.beats.find((b) => Math.abs(b - frame) < 5);
  const distance = nearestBeat ? Math.abs(nearestBeat - frame) : 10;
  
  // Pulse scale based on beat proximity
  const pulseIntensity = Math.max(0, 1 - distance / 5) * intensity;
  const scale = 1 + pulseIntensity * 0.1;
  
  // Also react to downbeats more strongly
  const nearestDownbeat = beatMap.downbeats.find((b) => Math.abs(b - frame) < 8);
  const downbeatDistance = nearestDownbeat ? Math.abs(nearestDownbeat - frame) : 15;
  const downbeatPulse = Math.max(0, 1 - downbeatDistance / 8) * intensity * 0.5;
  
  const totalScale = scale + downbeatPulse;
  
  return (
    <div style={{ transform: `scale(${totalScale})` }}>
      {children}
    </div>
  );
};

export const BeatFlash: React.FC<{
  color?: string;
  intensity?: number;
}> = ({ color = 'rgba(255,255,255,0.3)', intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beatMap = useBeatMap();
  
  // Flash on every beat
  const isBeat = beatMap.beats.some((b) => Math.abs(b - frame) < 2);
  const isDownbeat = beatMap.downbeats.some((b) => Math.abs(b - frame) < 3);
  
  const flashOpacity = isDownbeat ? 0.5 * intensity : isBeat ? 0.3 * intensity : 0;
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: color,
        opacity: flashOpacity,
        pointerEvents: 'none',
      }}
    />
  );
};
```

#### Audio-Reactive Background

```tsx
// lib/remotion/backgrounds/AudioReactiveGradient.tsx
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { useBeatMap } from '../hooks/useBeatMap';

export const AudioReactiveGradient: React.FC<{
  baseColors: string[];
  accentColors: string[];
}> = ({ baseColors, accentColors }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beatMap = useBeatMap();
  
  // Get current energy level
  const energy = beatMap.energy[frame] || 0;
  
  // React to beats with color shifts
  const isBeat = beatMap.beats.some((b) => Math.abs(b - frame) < 3);
  const colorShift = isBeat ? 1 : interpolate(energy, [0, 1], [0, 0.5]);
  
  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(circle at 30% 30%, ${colorShift > 0.5 ? accentColors[0] : baseColors[0]} 0%, transparent 60%),
          radial-gradient(circle at 70% 70%, ${colorShift > 0.5 ? accentColors[1] : baseColors[1]} 0%, transparent 60%),
          ${baseColors[2]}
        `,
        transition: 'background 0.1s ease',
      }}
    />
  );
};
```

### 4. Scene Templates with High Energy

#### Template 1: Tech Product Launch (Fast-Paced)

```tsx
// templates/TechLaunch.tsx
export const TechLaunch: React.FC<{ data: ProductData }> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beatMap = useBeatMap();
  
  return (
    <AbsoluteFill>
      {/* Animated gradient background */}
      <GradientMesh colors={[data.colors.primary, data.colors.accent, data.colors.secondary]} speed={2} />
      
      {/* Beat flash overlay */}
      <BeatFlash color="rgba(255,255,255,0.15)" />
      
      <TransitionSeries>
        {/* Scene 1: Hook (0-3 seconds) */}
        <TransitionSeries.Sequence durationInFrames={90}>
          <GlitchText
            text={data.tagline}
            triggerFrame={0}
            duration={15}
            style={{
              fontSize: 80,
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          />
          <KineticText
            text="Introducing..."
            startFrame={30}
            style={{ fontSize: 40, marginTop: 20 }}
          />
        </TransitionSeries.Sequence>
        
        <TransitionSeries.Transition
          presentation={wipe({ direction: 'from-left' })}
          timing={linearTiming({ durationInFrames: 15 })}
        />
        
        {/* Scene 2: Product Reveal (3-8 seconds) */}
        <TransitionSeries.Sequence durationInFrames={150}>
          <BeatPulse intensity={1.5}>
            <ProductHero image={data.images[0]} />
          </BeatPulse>
          <KineticText
            text={data.name}
            startFrame={0}
            style={{ fontSize: 60, marginTop: 400 }}
          />
        </TransitionSeries.Sequence>
        
        {/* More scenes... */}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
```

#### Template 2: App Showcase (Rhythmic)

```tsx
// templates/AppShowcase.tsx
export const AppShowcase: React.FC<{ data: ProductData }> = ({ data }) => {
  const beatMap = useBeatMap();
  
  return (
    <AbsoluteFill>
      <ParticleField particleCount={30} color={data.colors.accent} speed={2} />
      <AudioReactiveGradient baseColors={['#1a1a2e', '#16213e']} accentColors={[data.colors.primary, data.colors.accent]} />
      
      <TransitionSeries>
        {data.features.map((feature, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={i === 0 ? 90 : 75}>
              <FeatureSlide
                feature={feature}
                index={i}
                beatSync={beatMap}
              />
            </TransitionSeries.Sequence>
            
            <TransitionSeries.Transition
              presentation={slide({ direction: 'from-bottom' })}
              timing={springTiming({ fps: 30, config: { damping: 15 } })}
            />
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
```

### 5. Updated VideoScript Schema

```typescript
interface VideoScript {
  totalDuration: number;
  tempo: 'fast' | 'medium' | 'slow' | 'custom';
  bpm: number;
  scenes: Array<{
    id: string;
    startFrame: number;
    endFrame: number;
    type: 'intro' | 'hook' | 'feature' | 'social-proof' | 'cta' | 'transition';
    content: {
      headline?: string;
      subtext?: string;
      images?: string[];
      videoBackground?: string;  // URL to motion background
    };
    style: {
      background: {
        type: 'gradient-mesh' | 'particles' | 'video' | 'geometric' | 'solid';
        colors: string[];
        speed?: number;
        videoUrl?: string;
      };
      textColor: string;
      fontFamily: string;
      textAnimation: 'kinetic' | 'typewriter' | 'glitch' | 'reveal' | 'slide';
    };
    animation: {
      enter: {
        type: string;
        duration: number;  // frames
        easing: 'spring' | 'linear' | 'easeIn' | 'easeOut';
        springConfig?: { mass: number; damping: number; stiffness: number };
      };
      exit: {
        type: string;
        duration: number;
        easing: 'spring' | 'linear' | 'easeIn' | 'easeOut';
      };
      beatSync: {
        enabled: boolean;
        intensity: number;  // 0-1
        triggers: 'all-beats' | 'downbeats' | 'drops' | 'energy-spikes';
      };
    };
  }>;
  transitions: Array<{
    afterScene: string;
    type: 'cut' | 'fade' | 'wipe' | 'slide' | 'zoom' | 'glitch' | 'beat-sync';
    duration: number;
    beatAligned: boolean;  // Sync to nearest beat
  }>;
  audio: {
    url?: string;
    bpm: number;
    volume: number;
    beatMarkers: number[];
    energyCurve: number[];
    syncAnimations: boolean;
  };
}
```

### 6. Enhanced AI Prompts for Dynamic Videos

#### Script Writer System Prompt (Updated)

```
You are a video scriptwriter specializing in HIGH-ENERGY, FAST-PACED product marketing videos.

Create scripts with these characteristics:
- PACING: Quick cuts, 15-30 frame transitions (0.5-1s)
- ENERGY: High tempo, punchy text, minimal downtime
- ANIMATIONS: Beat-synced, kinetic text, glitch effects on impact moments
- BACKGROUNDS: Dynamic (animated gradients, particles, subtle motion)

Scene Structure (60-second video):
1. HOOK (0-3s): Bold statement with GLITCH reveal
2. PROBLEM (3-8s): Fast cuts, kinetic text
3. SOLUTION (8-15s): Product hero shot with beat-pulsing background
4. FEATURES (15-35s): 3-4 quick feature cards (5s each), sliding transitions
5. SOCIAL PROOF (35-45s): Testimonials with wipe transitions
6. CTA (45-60s): Big impact, all elements pulse to beat

Include for each scene:
- Animation type (kinetic/glitch/reveal)
- Background type (gradient-mesh/particles/geometric)
- Beat sync intensity (0-1)
- Transition type and duration

Output as VideoScript JSON with enhanced style and animation specifications.
```

#### Code Generator System Prompt (Updated)

```
You are a Remotion developer specializing in HIGH-IMPACT video animations.

CRITICAL RULES:
1. NO CSS transitions - use useCurrentFrame() + interpolate/spring only
2. FAST animations: 15-20 frame entrances, 10-15 frame exits
3. Use aggressive spring configs: mass: 0.5-1, damping: 10-15, stiffness: 150-300
4. ALWAYS use beat-sync components when beatSync.enabled is true
5. Use dynamic backgrounds: GradientMesh, ParticleField, AudioReactiveGradient
6. Add BeatFlash overlay for impact moments
7. Use GlitchText for hook/important statements
8. ALL transitions must use TransitionSeries from @remotion/transitions

Include these imports:
- GradientMesh, ParticleField, AudioReactiveGradient
- KineticText, GlitchText, BeatPulse, BeatFlash
- useBeatMap hook

Generate fast-paced, energetic code that reacts to the beat map.
```

### 7. Music Library Integration

#### Curated High-Energy Tracks

```typescript
// lib/audio/musicLibrary.ts
interface MusicTrack {
  id: string;
  name: string;
  url: string;
  bpm: number;
  genre: 'electronic' | 'upbeat' | 'corporate' | 'dramatic';
  energy: 'high' | 'medium' | 'low';
  duration: number;
  mood: string[];
}

const musicLibrary: MusicTrack[] = [
  {
    id: 'upbeat-1',
    name: 'Tech Drive',
    url: '/music/tech-drive.mp3',
    bpm: 128,
    genre: 'electronic',
    energy: 'high',
    duration: 60,
    mood: ['energetic', 'modern', 'tech'],
  },
  {
    id: 'corporate-1',
    name: 'Business Rise',
    url: '/music/business-rise.mp3',
    bpm: 110,
    genre: 'corporate',
    energy: 'medium',
    duration: 60,
    mood: ['professional', 'motivational'],
  },
  // ... more tracks
];

export function getRecommendedTrack(productType: string, tempo: string): MusicTrack {
  // Match track to product type and desired tempo
  const matches = musicLibrary.filter(t => 
    (tempo === 'fast' && t.bpm >= 120) ||
    (tempo === 'medium' && t.bpm >= 100 && t.bpm < 120) ||
    (tempo === 'slow' && t.bpm < 100)
  );
  
  return matches[0] || musicLibrary[0];
}
```

### 8. Pre-rendered Video Backgrounds

For premium feel, include library of loopable motion backgrounds:

```
/public/video-backgrounds/
  - abstract-waves.mp4       (slow, elegant)
  - gradient-flow.mp4        (color shifting)
  - geometric-pulse.mp4      (shapes to beat)
  - particle-network.mp4     (connected dots)
  - noise-grain.mp4          (textured overlay)
```

```tsx
// lib/remotion/backgrounds/VideoBackground.tsx
import { Video, AbsoluteFill } from 'remotion';

export const VideoBackground: React.FC<{
  src: string;
  playbackRate?: number;
}> = ({ src, playbackRate = 1 }) => {
  return (
    <AbsoluteFill>
      <Video
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        playbackRate={playbackRate}
      />
    </AbsoluteFill>
  );
};
```

---

## Updated Implementation Order

### Week 1: Foundation + Backgrounds
- [ ] Set up Remotion in Next.js
- [ ] Create background components (GradientMesh, ParticleField, AudioReactiveGradient)
- [ ] Build high-energy animation components (KineticText, GlitchText, BeatPulse)
- [ ] Set up beat detection with Essentia.js

### Week 2: Audio & Beat Sync
- [ ] Implement audio analysis pipeline
- [ ] Create useBeatMap hook for components
- [ ] Build BeatFlash and BeatPulse components
- [ ] Add music library with 10-15 curated tracks

### Week 3: Templates & Fast Animations
- [ ] Create TechLaunch template with fast pacing
- [ ] Create AppShowcase template with rhythm
- [ ] Implement spring-based fast transitions
- [ ] Build TransitionSeries presets for quick cuts

### Week 4: AI Integration
- [ ] Update Script Writer to output dynamic backgrounds
- [ ] Update Code Generator to use beat-sync components
- [ ] Test full pipeline with different music tempos
- [ ] Add video background support

### Week 5: UI & Export
- [ ] Studio UI with audio waveform + beat markers
- [ ] Background selector (gradient/particles/video)
- [ ] Animation speed controls (fast/medium/slow)
- [ ] MP4 export with audio

---

## Key Performance Tips

1. **Frame-rate consistency**: Always calculate animations based on frame, not time
2. **Memoize random values**: Use random() with seeds to prevent flickering
3. **Limit particles**: Keep particle counts under 100 for smooth playback
4. **Optimize springs**: Use simpler spring configs for mobile preview
5. **Pre-render backgrounds**: Cache gradient calculations when possible

---

## Success Metrics

- Videos feel energetic and modern
- Animations sync visibly to audio beats
- Backgrounds are dynamic and engaging
- Total generation time < 60 seconds
- Users can select tempo (fast/medium/slow)
- Beat detection accuracy > 90%
