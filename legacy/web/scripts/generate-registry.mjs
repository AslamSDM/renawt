#!/usr/bin/env node
/**
 * Generates real .tsx files for each registry component from the source
 * strings in lib/video/registry.ts. Output goes to remotion/components/registry/.
 *
 * Run after editing the registry source strings to keep the bundle in sync.
 *   node scripts/generate-registry.mjs
 */

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");

// Bundle the registry module so we can import it in node
const tmpBundle = path.join(root, "_registry-bundle.mjs");
await build({
  entryPoints: [path.join(root, "generate-server/lib/video/registry.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["zod"],
  outfile: tmpBundle,
  logLevel: "warning",
});

const { BUILTIN_COMPONENTS, SHARED_HELPERS } = await import(tmpBundle + "?t=" + Date.now());
rmSync(tmpBundle);

const outDir = path.join(root, "remotion/components/registry");
mkdirSync(outDir, { recursive: true });

const HELPER_FILE = path.join(outDir, "_helpers.tsx");
// Convert function decls to exports + add minimal typing
const helperBody = SHARED_HELPERS.trim()
  .replace(/^function ease\(t\)/m, "export function ease(t: number): number")
  .replace(
    /^function applyAnim\(animation, localFrame, fps\)/m,
    "export function applyAnim(animation: string, localFrame: number, fps: number): { opacity: number; transform: string; filter: string }",
  );

writeFileSync(
  HELPER_FILE,
  `// AUTO-GENERATED — edit SHARED_HELPERS in generate-server/lib/video/registry.ts
import { spring } from "remotion";

${helperBody}
`,
);

const IMPORTS = `// AUTO-GENERATED — do not edit by hand. See scripts/generate-registry.mjs.
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
import { applyAnim } from "./_helpers";
`;

const names = Object.keys(BUILTIN_COMPONENTS);

for (const name of names) {
  const meta = BUILTIN_COMPONENTS[name];
  let body = meta.source.trim();
  // Source strings declare `function Name(...) { ... }` — we add `export ` and
  // type the destructured props as `any` to satisfy strict TS.
  body = body.replace(/^function\s+/, "export function ");
  body = body.replace(
    new RegExp(`(export function ${name}\\()(\\{[\\s\\S]*?\\})\\)`),
    "$1$2: any)",
  );
  // Some components have no destructure (none in current set), but keep safe:
  if (!body.includes(": any)")) {
    body = body.replace(
      new RegExp(`(export function ${name}\\()([^)]*)\\)`),
      (_, a, b) => (b.trim() === "" ? `${a}props: any)` : `${a}${b}: any)`),
    );
  }
  const file = path.join(outDir, `${name}.tsx`);
  writeFileSync(file, `${IMPORTS}\n${body}\n`);
}

const indexBody = `${IMPORTS}
${names.map((n) => `import { ${n} } from "./${n}";`).join("\n")}

export const REGISTRY: Record<string, React.FC<any>> = {
${names.map((n) => `  ${n},`).join("\n")}
};

export type RegistryName = keyof typeof REGISTRY;
`;
writeFileSync(path.join(outDir, "index.ts"), indexBody);

console.log(`Generated ${names.length} components in remotion/components/registry/`);
console.log("  + _helpers.tsx + index.ts");
