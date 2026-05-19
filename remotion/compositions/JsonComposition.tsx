import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { REGISTRY } from "../components/registry";

export interface VideoJsonInputProps {
  fps: number;
  width: number;
  height: number;
  audio?: { url: string; bpm?: number; volume?: number } | null;
  scenes: Array<{
    id: string;
    durationInFrames: number;
    layers: Array<{ component: string; props?: Record<string, unknown> }>;
  }>;
  /** Custom components are not supported on Lambda — must be in REGISTRY. */
  customComponents?: unknown;
}

export const JsonComposition: React.FC<VideoJsonInputProps> = ({
  audio,
  scenes,
}) => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {audio?.url ? (
        <Audio
          src={audio.url.startsWith("http") ? audio.url : staticFile(audio.url.replace(/^\//, ""))}
          volume={audio.volume ?? 1}
        />
      ) : null}
      {scenes.map((scene, i) => {
        const from = cursor;
        cursor += scene.durationInFrames;
        return (
          <Sequence
            key={scene.id || i}
            from={from}
            durationInFrames={scene.durationInFrames}
          >
            <AbsoluteFill>
              {scene.layers.map((layer, j) => {
                const Comp = REGISTRY[layer.component];
                if (!Comp) {
                  return (
                    <AbsoluteFill
                      key={j}
                      style={{
                        backgroundColor: "#400",
                        color: "#fff",
                        padding: 40,
                        fontFamily: "monospace",
                      }}
                    >
                      Unknown component: {layer.component}
                    </AbsoluteFill>
                  );
                }
                return <Comp key={j} {...(layer.props || {})} />;
              })}
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

export default JsonComposition;
