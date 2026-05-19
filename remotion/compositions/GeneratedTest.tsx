import React from "react";
import {
  AbsoluteFill,
  Sequence,
  Audio,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
} from "remotion";
import {
  TransitionSeries,
  linearTiming,
  springTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";


function ease(t: number): number { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }
function applyAnim(animation: string, localFrame: number, fps: number) {
  if (animation === "none") return { opacity: 1, transform: "none", filter: "none" };
  const dur = Math.max(1, Math.round(fps * 0.5));
  const t = Math.min(1, Math.max(0, localFrame / dur));
  const e = ease(t);
  if (animation === "fade") return { opacity: e, transform: "none", filter: "none" };
  if (animation === "slide-up") return { opacity: e, transform: `translateY(${(1-e)*40}px)`, filter: "none" };
  if (animation === "slide-down") return { opacity: e, transform: `translateY(${(1-e)*-40}px)`, filter: "none" };
  if (animation === "scale") {
    const s = spring({ frame: localFrame, fps, config: { damping: 14 } });
    return { opacity: e, transform: `scale(${s})`, filter: "none" };
  }
  if (animation === "blur-in") return { opacity: e, transform: "none", filter: `blur(${(1-e)*16}px)` };
  return { opacity: 1, transform: "none", filter: "none" };
}

// ============= REGISTRY COMPONENTS =============

function GradientBg({ from = "#0f172a", to = "#1e293b", angle = 135 }) {
  return <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }} />;
}

type TitleProps = {
  text: string; color?: string; size?: number; weight?: number; font?: string;
  animation?: string; delay?: number; align?: React.CSSProperties["textAlign"];
  x?: string; y?: string; maxWidth?: string;
};
function Title({ text, color = "#fff", size = 96, weight = 800, font = "Inter, sans-serif", animation = "slide-up", delay = 0, align = "center", x = "50%", y = "50%", maxWidth = "80%" }: TitleProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const a = applyAnim(animation, localFrame, fps);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{
        position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) ${a.transform}`,
        color, fontSize: size, fontWeight: weight, fontFamily: font, textAlign: align,
        opacity: a.opacity, filter: a.filter, maxWidth, lineHeight: 1.05,
      }}>{text}</div>
    </AbsoluteFill>
  );
}

type SubtitleProps = {
  text: string; color?: string; size?: number; weight?: number; font?: string;
  animation?: string; delay?: number; x?: string; y?: string; maxWidth?: string;
};
function Subtitle({ text, color = "rgba(255,255,255,0.75)", size = 36, weight = 500, font = "Inter, sans-serif", animation = "fade", delay = 8, x = "50%", y = "60%", maxWidth = "70%" }: SubtitleProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = Math.max(0, frame - delay);
  const a = applyAnim(animation, localFrame, fps);
  return (
    <AbsoluteFill>
      <div style={{
        position: "absolute", left: x, top: y, transform: `translate(-50%, -50%) ${a.transform}`,
        color, fontSize: size, fontWeight: weight, fontFamily: font, textAlign: "center",
        opacity: a.opacity, filter: a.filter, maxWidth, lineHeight: 1.3,
      }}>{text}</div>
    </AbsoluteFill>
  );
}

// ============= CUSTOM COMPONENTS =============
function IntroScene() { const frame = useCurrentFrame(); const op1 = interpolate(frame, [5, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const y1 = interpolate(frame, [5, 20], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const op2 = interpolate(frame, [18, 33], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const y2 = interpolate(frame, [18, 33], [30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const op3 = interpolate(frame, [30, 45], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); const y3 = interpolate(frame, [30, 45], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <AbsoluteFill style={{ fontFamily: 'SF Pro Display' }}><div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(160deg, #F9FAFB 0%, #60A5FA 100%)' }} /><div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}><div style={{ opacity: op1, transform: `translateY(${y1}px)`, textAlign: 'center', marginBottom: 16 }}><div style={{ fontSize: 96, fontWeight: 800, color: '#111827' }}>MacBook Neo</div></div><div style={{ opacity: op2, transform: `translateY(${y2}px)`, textAlign: 'center', marginBottom: 8 }}><div style={{ fontSize: 36, fontWeight: 400, color: '#111827' }}>Apple's lightest laptop ever</div></div><div style={{ opacity: op3, transform: `translateY(${y3}px)`, textAlign: 'center' }}><div style={{ fontSize: 24, fontWeight: 600, color: '#3B82F6' }}>18-hour battery · M5 chip · 180° hinge</div></div></div></AbsoluteFill>; }

// ============= REGISTRY MAP =============
const REGISTRY: Record<string, React.FC<any>> = {
  GradientBg,
  Title,
  Subtitle,
  IntroScene
};

// ============= VIDEO JSON =============
const VIDEO_JSON = {
  "fps": 30,
  "width": 1920,
  "height": 1080,
  "audio": null,
  "scenes": [
    {
      "id": "intro",
      "durationInFrames": 90,
      "layers": [
        {
          "component": "GradientBg",
          "props": {
            "from": "#F0F9FF",
            "to": "#F9FAFB",
            "angle": 135
          }
        },
        {
          "component": "Title",
          "props": {
            "text": "MacBook Neo",
            "delay": 5,
            "fontSize": 88,
            "fontWeight": 800,
            "color": "#0F172A",
            "fontFamily": "SF Pro Display",
            "x": "50%",
            "y": "40%"
          }
        },
        {
          "component": "Subtitle",
          "props": {
            "text": "Apple's lightest laptop ever",
            "delay": 18,
            "fontSize": 36,
            "fontWeight": 400,
            "color": "#475569",
            "fontFamily": "SF Pro Display",
            "x": "50%",
            "y": "52%"
          }
        },
        {
          "component": "Subtitle",
          "props": {
            "text": "18-hour battery  •  M5 chip  •  180° hinge",
            "delay": 32,
            "fontSize": 20,
            "fontWeight": 400,
            "color": "#64748B",
            "fontFamily": "SF Pro Display",
            "x": "50%",
            "y": "60%"
          }
        }
      ],
      "transitionIn": {
        "type": "none",
        "durationInFrames": 0
      }
    },
    {
      "id": "feature1",
      "durationInFrames": 120,
      "layers": [
        {
          "component": "GradientBg",
          "props": {
            "from": "#111827",
            "to": "#3B82F6",
            "angle": 180
          }
        },
        {
          "component": "Title",
          "props": {
            "text": "Unmatched Performance",
            "x": "50%",
            "y": "40%",
            "delay": 15,
            "color": "#F9FAFB",
            "fontSize": 72,
            "fontWeight": 800
          }
        },
        {
          "component": "Subtitle",
          "props": {
            "text": "Experience the key benefit of your product.",
            "x": "50%",
            "y": "55%",
            "delay": 30,
            "color": "#F9FAFB",
            "fontSize": 32,
            "fontWeight": 400
          }
        }
      ],
      "transitionIn": {
        "type": "slide",
        "durationInFrames": 15
      }
    },
    {
      "id": "feature2",
      "durationInFrames": 120,
      "layers": [
        {
          "component": "GradientBg",
          "props": {
            "from": "#EFF6FF",
            "to": "#F9FAFB",
            "angle": 135
          }
        },
        {
          "component": "Title",
          "props": {
            "text": "Advanced Features",
            "fontFamily": "SF Pro Display",
            "color": "#111827",
            "fontSize": 72,
            "fontWeight": 800,
            "x": "50%",
            "y": "40%",
            "delay": 15,
            "animation": "slide-up"
          }
        },
        {
          "component": "Subtitle",
          "props": {
            "text": "Discover another important feature of MacBook Neo",
            "fontFamily": "SF Pro Display",
            "color": "#3B82F6",
            "fontSize": 32,
            "fontWeight": 400,
            "x": "50%",
            "y": "52%",
            "delay": 30,
            "animation": "slide-up"
          }
        }
      ],
      "transitionIn": {
        "type": "slide",
        "durationInFrames": 15
      }
    },
    {
      "id": "feature3",
      "durationInFrames": 120,
      "layers": [
        {
          "component": "GradientBg",
          "props": {
            "from": "#EFF6FF",
            "to": "#F9FAFB",
            "angle": 135
          }
        },
        {
          "component": "Title",
          "props": {
            "text": "Unique Design",
            "delay": 18,
            "color": "#111827",
            "fontFamily": "SF Pro Display",
            "fontSize": 80,
            "fontWeight": 800,
            "x": "50%",
            "y": "40%"
          }
        },
        {
          "component": "Subtitle",
          "props": {
            "text": "Redesigned hinge for 180° lay-flat use",
            "delay": 35,
            "color": "#3B82F6",
            "fontFamily": "SF Pro Display",
            "fontSize": 36,
            "fontWeight": 400,
            "x": "50%",
            "y": "52%"
          }
        }
      ],
      "transitionIn": {
        "type": "slide",
        "durationInFrames": 15
      }
    },
    {
      "id": "outro",
      "durationInFrames": 150,
      "layers": [
        {
          "component": "IntroScene",
          "props": {}
        }
      ],
      "transitionIn": {
        "type": "fade",
        "durationInFrames": 20
      }
    }
  ]
};

// ============= TRANSITION HELPERS =============
type AnyTransition = ReturnType<typeof fade>;
function pickPresentation(type: string): AnyTransition {
  if (type === "slide") return slide() as unknown as AnyTransition;
  if (type === "wipe") return wipe() as unknown as AnyTransition;
  return fade();
}

type SceneLayer = { component: string; props?: Record<string, unknown> };
function SceneLayers({ layers }: { layers: SceneLayer[] }) {
  return (
    <AbsoluteFill>
      {layers.map((layer: SceneLayer, j: number) => {
        const Comp = REGISTRY[layer.component];
        if (!Comp) {
          return (
            <AbsoluteFill key={j} style={{ backgroundColor: "#400", color: "#fff", padding: 40, fontFamily: "monospace" }}>
              Unknown component: {layer.component}
            </AbsoluteFill>
          );
        }
        return <Comp key={j} {...layer.props} />;
      })}
    </AbsoluteFill>
  );
}

// ============= JSON RENDERER =============
function JsonComposition() {
  const hasTransitions = VIDEO_JSON.scenes.some(
    (s, i) => i > 0 && s.transitionIn && s.transitionIn.type && s.transitionIn.type !== "none",
  );

  if (hasTransitions) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#000" }}>

        <TransitionSeries>
          {VIDEO_JSON.scenes.flatMap((scene, i) => {
            const blocks = [];
            if (i > 0 && scene.transitionIn && scene.transitionIn.type && scene.transitionIn.type !== "none") {
              const dur = Math.max(1, scene.transitionIn.durationInFrames || 12);
              blocks.push(
                <TransitionSeries.Transition
                  key={`t-${i}`}
                  presentation={pickPresentation(scene.transitionIn.type)}
                  timing={linearTiming({ durationInFrames: dur })}
                />,
              );
            }
            blocks.push(
              <TransitionSeries.Sequence
                key={scene.id || `s-${i}`}
                durationInFrames={scene.durationInFrames}
              >
                <SceneLayers layers={scene.layers} />
              </TransitionSeries.Sequence>,
            );
            return blocks;
          })}
        </TransitionSeries>
      </AbsoluteFill>
    );
  }

  let frameCursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>

      {VIDEO_JSON.scenes.map((scene, i) => {
        const from = frameCursor;
        frameCursor += scene.durationInFrames;
        return (
          <Sequence key={scene.id || i} from={from} durationInFrames={scene.durationInFrames}>
            <SceneLayers layers={scene.layers} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

const VideoComposition = JsonComposition;
export default VideoComposition;
