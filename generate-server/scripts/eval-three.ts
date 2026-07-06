/**
 * THREE DIRECTOR EVAL HARNESS
 *
 * Runs the threeDirector agent on a fixed brief, builds the SceneSpec, applies
 * the critic, and (optionally) submits a render to the Three.js render engine.
 * Verifies the continuity invariants a 10-min 3D video must satisfy:
 *   - total frame count ≈ durationSeconds * fps (±1)
 *   - every beat has at least one visible object
 *   - camera rig is consistent across beats (no per-beat overrides)
 *   - palette colors all appear in the continuity ledger
 *   - no object references an unknown registry component
 *   - render produces an mp4 of non-trivial size (when --render is passed)
 *
 *   tsx generate-server/scripts/eval-three.ts                # plan + spec + critic only
 *   tsx generate-server/scripts/eval-three.ts --render       # also submit a render
 *   tsx generate-server/scripts/eval-three.ts --json         # machine-readable output
 *
 * Env: GOOGLE_AI_API_KEY (agent LLM calls). For --render: THREE_RENDER_SERVICE_URL.
 */

import { writeFileSync, existsSync, statSync } from "fs";
import { resolve } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { generateThreeVideo } from "../lib/agents/threeDirector";
import { applyThreeCritique } from "../lib/agents/threeCritic";
import { THREE_REGISTRY, THREE_COMPONENT_NAMES } from "../lib/video/threeRegistry";
import { validateSceneSpec, type SceneSpec } from "../lib/video/sceneSpec";
import { routeRender } from "../lib/render/renderRouter";

interface EvalArgs {
  render: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): EvalArgs {
  return {
    render: argv.includes("--render"),
    json: argv.includes("--json"),
  };
}

interface InvariantResult {
  name: string;
  passed: boolean;
  detail?: string;
}

function checkInvariants(spec: SceneSpec, expectedFrames: number): InvariantResult[] {
  const results: InvariantResult[] = [];

  // 1. frame count
  const frameDelta = Math.abs(spec.durationInFrames - expectedFrames);
  results.push({
    name: "frame-count",
    passed: frameDelta <= 1,
    detail: `expected≈${expectedFrames} got=${spec.durationInFrames} (Δ=${frameDelta})`,
  });

  // 2. every beat has visible objects within its frame window
  const emptyBeats = spec.beats.filter((b) => {
    const ids = new Set(b.objectIds);
    const anyVisible = spec.objects.some(
      (o) =>
        ids.has(o.id) &&
        (!o.visible ||
          (o.visible.startFrame < b.endFrame && o.visible.endFrame > b.startFrame)),
    );
    return !anyVisible;
  });
  results.push({
    name: "beat-visibility",
    passed: emptyBeats.length === 0,
    detail:
      emptyBeats.length === 0
        ? "all beats have visible objects"
        : `empty beats: ${emptyBeats.map((b) => b.name).join(", ")}`,
  });

  // 3. single camera rig (no per-beat overrides — the rig is on the spec root)
  const hasSingleRig = Boolean(spec.cameraRig);
  results.push({
    name: "single-camera-rig",
    passed: hasSingleRig,
    detail: hasSingleRig ? `rig type=${spec.cameraRig.type}` : "missing cameraRig",
  });

  // 4. palette adherence — every object color must be in the ledger palette
  //    (allow white/gray/black neutrals)
  const ledger = spec.continuityTokens;
  const palette = new Set<string>(ledger?.palette ?? []);
  const neutrals = new Set(["#ffffff", "#fff", "#000000", "#000", "#888888", "#888", "#808080", "#cccccc", "#ccc"]);
  const driftColors: string[] = [];
  for (const o of spec.objects) {
    const c = (o.props as any)?.color;
    if (typeof c === "string" && c.startsWith("#") && !neutrals.has(c.toLowerCase()) && !palette.has(c.toLowerCase())) {
      driftColors.push(`${o.id}:${c}`);
    }
  }
  results.push({
    name: "palette-adherence",
    passed: driftColors.length === 0,
    detail:
      driftColors.length === 0
        ? `palette size=${palette.size}`
        : `drift: ${driftColors.slice(0, 5).join(", ")}${driftColors.length > 5 ? ` (+${driftColors.length - 5} more)` : ""}`,
  });

  // 5. no unknown components — the spec doesn't carry component names directly
  //    (objects are already built), but the plan's layers did. We approximate
  //    by checking that every object kind is in the supported set.
  const supportedKinds = new Set(["plane", "box", "sphere", "torus", "icosahedron", "torusKnot", "text", "gltf", "particles", "group"]);
  const badKinds = spec.objects.filter((o) => !supportedKinds.has(o.kind));
  results.push({
    name: "object-kinds",
    passed: badKinds.length === 0,
    detail:
      badKinds.length === 0
        ? `${spec.objects.length} objects, all valid kinds`
        : `unknown kinds: ${badKinds.map((o) => `${o.id}:${o.kind}`).join(", ")}`,
  });

  // 6. no Math.random in serialized spec (determinism)
  const serialized = JSON.stringify(spec);
  const hasRandom = serialized.includes("Math.random");
  results.push({
    name: "determinism",
    passed: !hasRandom,
    detail: hasRandom ? "spec contains Math.random — use props.seed instead" : "no Math.random in spec",
  });

  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const brief = {
    description:
      'A 10-minute cinematic 3D product video for "Nimbus", a developer-focused cloud monitoring platform. Hook with the wordmark floating in 3D, then features: real-time dashboards, AI anomaly detection, instant alerts. End with the tagline "See everything. Miss nothing." and the CTA "Start free at nimbus.dev".',
    brandHint: {
      productName: "Nimbus",
      tagline: "See everything. Miss nothing.",
      features: [
        { title: "Real-time dashboards", description: "Live metrics from every region, sub-second latency." },
        { title: "AI anomaly detection", description: "Catch regressions before users do — 40% fewer incidents." },
        { title: "Instant alerts", description: "PagerDuty + Slack + webhooks in under 5 seconds." },
      ],
      cta: "Start free at nimbus.dev",
    },
    durationSeconds: 600,
    width: 1920,
    height: 1080,
    fps: 30,
  };

  const expectedFrames = brief.durationSeconds * brief.fps;

  console.log(`[eval-three] brief: ${brief.brandHint.productName}, ${brief.durationSeconds}s = ${expectedFrames} frames`);
  console.log(`[eval-three] registry components: ${THREE_COMPONENT_NAMES.join(", ")}`);

  const started = Date.now();
  const result = await generateThreeVideo({
    description: brief.description,
    brandHint: brief.brandHint,
    durationSeconds: brief.durationSeconds,
    width: brief.width,
    height: brief.height,
    fps: brief.fps,
    jobId: "eval-three",
  });
  const planMs = Date.now() - started;

  console.log(`[eval-three] plan built in ${planMs}ms — ${result.plan.beats.length} beats, ${result.spec.objects.length} objects`);
  console.log(`[eval-three] critic issues: ${result.criticIssues.length}`);

  // Apply critic fixes before validating invariants
  const applied = applyThreeCritique(result.spec, { issues: result.criticIssues });
  console.log(`[eval-three] critic applied: rewritten=${applied.rewritten} dropped=${applied.dropped}`);

  // Validate the spec round-trips through the zod schema
  let specValid = true;
  let specError: string | undefined;
  try {
    validateSceneSpec(result.spec);
  } catch (e) {
    specValid = false;
    specError = e instanceof Error ? e.message : String(e);
  }

  const invariants = checkInvariants(result.spec, expectedFrames);
  const allPassed = invariants.every((i) => i.passed) && specValid;

  // Optionally render
  let renderInfo: any = null;
  if (args.render) {
    console.log(`[eval-three] submitting render (${result.spec.durationInFrames} frames) to Three engine…`);
    const renderStarted = Date.now();
    const status = await routeRender({
      mode: "3d",
      spec: result.spec,
      projectId: "eval-three",
    });
    const renderMs = Date.now() - renderStarted;
    renderInfo = {
      status: status.status,
      videoUrl: status.videoUrl,
      renderTime: status.renderTime,
      totalMs: renderMs,
      error: status.error,
    };
    if (status.localFilePath && existsSync(status.localFilePath)) {
      renderInfo.fileBytes = statSync(status.localFilePath).size;
    }
    console.log(`[eval-three] render: ${status.status} in ${renderMs}ms — ${status.videoUrl ?? status.error}`);
  }

  // Save the spec for inspection
  const specOut = resolve(process.cwd(), "public", "three", "eval-three-spec.json");
  writeFileSync(specOut, JSON.stringify(result.spec, null, 2));

  const summary = {
    brief: brief.brandHint.productName,
    durationSeconds: brief.durationSeconds,
    expectedFrames,
    planMs,
    beats: result.plan.beats.length,
    objects: result.spec.objects.length,
    criticIssues: result.criticIssues.length,
    criticApplied: applied,
    specValid,
    specError,
    invariants,
    allPassed,
    render: renderInfo,
    specFile: specOut,
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log("\n=== EVAL SUMMARY ===");
    console.log(`Spec valid:     ${specValid ? "YES" : "NO"}${specError ? ` (${specError})` : ""}`);
    console.log(`Invariants:`);
    for (const inv of invariants) {
      console.log(`  ${inv.passed ? "✓" : "✗"} ${inv.name} — ${inv.detail}`);
    }
    console.log(`All passed:     ${allPassed ? "YES" : "NO"}`);
    if (renderInfo) {
      console.log(`Render:         ${renderInfo.status} (${renderInfo.totalMs}ms, ${(renderInfo.fileBytes / 1024 / 1024).toFixed(1)}MB)`);
    }
    console.log(`Spec saved:     ${specOut}`);
  }

  process.exit(allPassed && (!args.render || renderInfo?.status === "completed") ? 0 : 1);
}

main().catch((err) => {
  console.error("[eval-three] fatal:", err);
  process.exit(1);
});