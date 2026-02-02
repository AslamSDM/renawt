import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  AbsoluteFill,
} from "remotion";

// BeatMap interface (inline to avoid path issues)
export interface BeatMap {
  bpm: number;
  framesPerBeat: number;
  beats: number[];
  measures: number[];
  totalDuration: number;
}

// ============================================
// useBeatSync Hook
// Returns beat-related info for current frame
// ============================================
interface BeatSyncInfo {
  isOnBeat: boolean;
  isOnMeasure: boolean;
  beatProgress: number;
  measureProgress: number;
  currentBeatIndex: number;
  currentMeasureIndex: number;
}

export function useBeatSync(
  beatMap: BeatMap,
  tolerance: number = 3,
): BeatSyncInfo {
  const frame = useCurrentFrame();

  // Find current beat index
  let currentBeatIndex = 0;
  for (let i = 0; i < beatMap.beats.length; i++) {
    if (beatMap.beats[i] <= frame) {
      currentBeatIndex = i;
    } else {
      break;
    }
  }

  // Find current measure index
  let currentMeasureIndex = 0;
  for (let i = 0; i < beatMap.measures.length; i++) {
    if (beatMap.measures[i] <= frame) {
      currentMeasureIndex = i;
    } else {
      break;
    }
  }

  // Check if on beat
  const isOnBeat = beatMap.beats.some(
    (beat: number) => Math.abs(frame - beat) <= tolerance,
  );

  // Check if on measure
  const isOnMeasure = beatMap.measures.some(
    (measure: number) => Math.abs(frame - measure) <= tolerance,
  );

  // Calculate beat progress (0-1)
  const currentBeatStart = beatMap.beats[currentBeatIndex] || 0;
  const framesSinceBeat = frame - currentBeatStart;
  const beatProgress = Math.min(1, framesSinceBeat / beatMap.framesPerBeat);

  // Calculate measure progress (0-1)
  const currentMeasureStart = beatMap.measures[currentMeasureIndex] || 0;
  const framesPerMeasure = beatMap.framesPerBeat * 4;
  const framesSinceMeasure = frame - currentMeasureStart;
  const measureProgress = Math.min(1, framesSinceMeasure / framesPerMeasure);

  return {
    isOnBeat,
    isOnMeasure,
    beatProgress,
    measureProgress,
    currentBeatIndex,
    currentMeasureIndex,
  };
}

// ============================================
// BeatFlash Component
// Flash effect on each beat
// ============================================
interface BeatFlashProps {
  beatMap: BeatMap;
  color?: string;
  intensity?: number;
  decayFrames?: number;
}

export const BeatFlash: React.FC<BeatFlashProps> = ({
  beatMap,
  color = "rgba(255, 255, 255, 0.3)",
  intensity = 0.5,
  decayFrames = 8,
}) => {
  const frame = useCurrentFrame();

  // Find how far we are from the last beat
  let framesSinceLastBeat = frame;
  for (const beat of beatMap.beats) {
    if (beat <= frame) {
      framesSinceLastBeat = frame - beat;
    } else {
      break;
    }
  }

  const opacity = interpolate(
    framesSinceLastBeat,
    [0, decayFrames],
    [intensity, 0],
    { extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: color,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

// ============================================
// BeatPulse Component
// Scale pulse on each beat
// ============================================
interface BeatPulseProps {
  children: React.ReactNode;
  beatMap: BeatMap;
  pulseAmount?: number;
  decayFrames?: number;
}

export const BeatPulse: React.FC<BeatPulseProps> = ({
  children,
  beatMap,
  pulseAmount = 0.05,
  decayFrames = 10,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find how far we are from the last beat
  let framesSinceLastBeat = frame;
  for (const beat of beatMap.beats) {
    if (beat <= frame) {
      framesSinceLastBeat = frame - beat;
    } else {
      break;
    }
  }

  const pulse = spring({
    frame: framesSinceLastBeat,
    fps,
    from: 1 + pulseAmount,
    to: 1,
    config: { damping: 10, stiffness: 100 },
  });

  return (
    <div
      style={{
        transform: `scale(${pulse})`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  );
};

// ============================================
// BeatWave Component
// Wave animation synced to beats
// ============================================
interface BeatWaveProps {
  beatMap: BeatMap;
  color?: string;
  height?: number;
}

export const BeatWave: React.FC<BeatWaveProps> = ({
  beatMap,
  color = "#667eea",
  height = 100,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  // Generate wave points based on beat progress
  const wavePoints: string[] = [];
  const segments = 20;

  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * width;
    const phase = (i / segments) * Math.PI * 4;
    const beatFactor = Math.sin((frame / beatMap.framesPerBeat) * Math.PI * 2);
    const y =
      height / 2 +
      Math.sin(phase + frame * 0.1) * (height / 4) * (1 + beatFactor * 0.3);
    wavePoints.push(`${x},${y}`);
  }

  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", bottom: 0 }}
    >
      <defs>
        <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <polyline
        points={wavePoints.join(" ")}
        fill="none"
        stroke="url(#waveGradient)"
        strokeWidth="3"
      />
    </svg>
  );
};

// ============================================
// MeasureIndicator Component
// Visual indicator showing measure progress
// ============================================
interface MeasureIndicatorProps {
  beatMap: BeatMap;
  color?: string;
  size?: number;
}

export const MeasureIndicator: React.FC<MeasureIndicatorProps> = ({
  beatMap,
  color = "#00d4ff",
  size = 12,
}) => {
  const { measureProgress, currentMeasureIndex } = useBeatSync(beatMap);

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      {[0, 1, 2, 3].map((beatInMeasure) => {
        const beatProgress = measureProgress * 4;
        const isActive = beatProgress >= beatInMeasure;
        const isCurrent =
          beatProgress >= beatInMeasure && beatProgress < beatInMeasure + 1;

        return (
          <div
            key={beatInMeasure}
            style={{
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: isActive ? color : "rgba(255, 255, 255, 0.2)",
              transform: isCurrent ? "scale(1.3)" : "scale(1)",
              transition: "none",
              boxShadow: isActive
                ? `0 0 10px ${color}, 0 0 20px ${color}50`
                : "none",
            }}
          />
        );
      })}
    </div>
  );
};

// ============================================
// BeatSyncedText Component
// Text that animates with beat timing
// ============================================
interface BeatSyncedTextProps {
  text: string;
  beatMap: BeatMap;
  animationType?: "scale" | "color" | "glow";
  fontSize?: number;
  color?: string;
  accentColor?: string;
}

export const BeatSyncedText: React.FC<BeatSyncedTextProps> = ({
  text,
  beatMap,
  animationType = "scale",
  fontSize = 48,
  color = "#ffffff",
  accentColor = "#00d4ff",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isOnBeat, beatProgress } = useBeatSync(beatMap);

  // Find frames since last beat
  let framesSinceLastBeat = frame;
  for (const beat of beatMap.beats) {
    if (beat <= frame) {
      framesSinceLastBeat = frame - beat;
    } else {
      break;
    }
  }

  let style: React.CSSProperties = {
    fontSize,
    color,
    fontWeight: "bold",
    fontFamily: "system-ui, sans-serif",
  };

  switch (animationType) {
    case "scale":
      const scale = spring({
        frame: framesSinceLastBeat,
        fps,
        from: 1.1,
        to: 1,
        config: { damping: 10, stiffness: 150 },
      });
      style.transform = `scale(${scale})`;
      break;

    case "color":
      const colorOpacity = interpolate(framesSinceLastBeat, [0, 10], [1, 0], {
        extrapolateRight: "clamp",
      });
      style.color = colorOpacity > 0.5 ? accentColor : color;
      break;

    case "glow":
      const glowIntensity = interpolate(framesSinceLastBeat, [0, 15], [20, 0], {
        extrapolateRight: "clamp",
      });
      style.textShadow = `0 0 ${glowIntensity}px ${accentColor}`;
      break;
  }

  return <span style={style}>{text}</span>;
};

export default {
  useBeatSync,
  BeatFlash,
  BeatPulse,
  BeatWave,
  MeasureIndicator,
  BeatSyncedText,
};
