import { BUILTIN_COMPONENTS, SHARED_HELPERS } from "./registry";
import type { VideoJson } from "./videoJson";

const REMOTION_IMPORTS = `import React from "react";
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
} from "remotion";`;

function collectUsedComponents(json: VideoJson): Set<string> {
  const used = new Set<string>();
  for (const scene of json.scenes) {
    for (const layer of scene.layers) {
      used.add(layer.component);
    }
  }
  return used;
}

function jsonStringifyWithFunctions(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Build a self-contained Remotion TSX wrapper from a Video JSON.
 * Inlines only the registry components actually referenced + any
 * AI-authored custom components, then mounts JsonComposition with
 * the JSON literal embedded.
 */
export function buildRemotionCode(json: VideoJson): string {
  const used = collectUsedComponents(json);
  const customNames = new Set(json.customComponents.map((c) => c.name));

  // Emit only registry components actually used (smaller bundle, fewer collisions)
  const registrySources: string[] = [];
  const registryNames: string[] = [];
  for (const name of used) {
    if (customNames.has(name)) continue; // custom shadows builtin
    const meta = BUILTIN_COMPONENTS[name];
    if (!meta) continue; // unknown name — validation should reject earlier
    registrySources.push(meta.source);
    registryNames.push(name);
  }

  const customSources = json.customComponents.map((c) => c.source);
  const allRegisteredNames = [...registryNames, ...customNames];

  const audioBlock = json.audio
    ? `      <Audio src={${
        json.audio.url.startsWith("http")
          ? JSON.stringify(json.audio.url)
          : `staticFile(${JSON.stringify(json.audio.url.replace(/^\//, ""))})`
      }}${
        json.audio.volume !== undefined ? ` volume={${json.audio.volume}}` : ""
      } />`
    : "";

  return `${REMOTION_IMPORTS}

${SHARED_HELPERS}

// ============= REGISTRY COMPONENTS =============
${registrySources.join("\n")}

// ============= CUSTOM COMPONENTS =============
${customSources.join("\n")}

// ============= REGISTRY MAP =============
const REGISTRY = {
${allRegisteredNames.map((n) => `  ${n}`).join(",\n")}
};

// ============= VIDEO JSON =============
const VIDEO_JSON = ${jsonStringifyWithFunctions({
    fps: json.fps,
    width: json.width,
    height: json.height,
    audio: json.audio ?? null,
    scenes: json.scenes,
  })};

// ============= JSON RENDERER =============
function JsonComposition() {
  let frameCursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
${audioBlock}
      {VIDEO_JSON.scenes.map((scene, i) => {
        const from = frameCursor;
        frameCursor += scene.durationInFrames;
        return (
          <Sequence key={scene.id || i} from={from} durationInFrames={scene.durationInFrames}>
            <AbsoluteFill>
              {scene.layers.map((layer, j) => {
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
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

const VideoComposition = JsonComposition;
export default VideoComposition;
`;
}
