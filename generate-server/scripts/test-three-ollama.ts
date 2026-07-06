/**
 * TEST: 3D rendering flow end-to-end via OLLAMA backend.
 *
 * Forces LLM_PROVIDER=ollama (gemma4:e4b by default — override with
 * OLLAMA_MODEL), runs the threeDirector agent on a SHORT 20-second brief
 * (so the test is fast), applies the critic, validates the SceneSpec
 * round-trips through zod, and optionally submits a render to the Three.js
 * render engine if THREE_RENDER_SERVICE_URL is reachable.
 *
 *   tsx generate-server/scripts/test-three-ollama.ts                # agent + critic + spec validation
 *   tsx generate-server/scripts/test-three-ollama.ts --render       # also attempt a render
 *   tsx generate-server/scripts/test-three-ollama.ts --duration 60   # override duration (seconds)
 *   tsx generate-server/scripts/test-three-ollama.ts --json         # machine-readable
 *
 * Env (all optional — defaults below):
 *   LLM_PROVIDER=ollama              (forced by this script if unset)
 *   OLLAMA_MODEL=gemma4:e4b          (or gemma4:12b-mlx for higher quality)
 *   OLLAMA_BASE_URL=http://localhost:11434/v1
 *   THREE_RENDER_SERVICE_URL         (if set + reachable, --render will submit)
 *
 * Exit codes:
 *   0 — all stages passed (agent + critic + spec valid; render attempted + completed OR skipped)
 *   1 — agent/critic/spec validation failed
 *   2 — render attempted but failed
 */

import { writeFileSync, existsSync, statSync, mkdirSync } from "fs";
import { resolve } from "path";
import * as dotenv from "dotenv";

// Load env BEFORE forcing ollama vars so process.env picks them up.
dotenv.config({ path: resolve(process.cwd(), "../.env") });
dotenv.config({ path: resolve(process.cwd(), ".env") });

// Force Ollama backend + cloud model. MUST run before any import that touches
// model.ts (which reads OLLAMA_MODEL at module-load time). Static imports below
// are hoisted, so we read+patch env first, then do the dynamic import.
if (!process.env.LLM_PROVIDER) {
  process.env.LLM_PROVIDER = "ollama";
}
if (!process.env.OLLAMA_MODEL) {
  process.env.OLLAMA_MODEL = "kimi-k2.6:cloud";
}
if (!process.env.OLLAMA_NUM_CTX) {
  process.env.OLLAMA_NUM_CTX = "24576";
}

// Static imports (hoisted) — model.ts reads OLLAMA_MODEL at load time, so the
// env var MUST be set BEFORE tsx starts. Either export it in the shell, or
// use `tsx --env-file=.env.test scripts/test-three-ollama.ts`. The defaults
// below only apply if the env var is still unset at module-load.
import { generateThreeVideo } from "../lib/agents/threeDirector";
import { applyThreeCritique } from "../lib/agents/threeCritic";
import { validateSceneSpec, type SceneSpec } from "../lib/video/sceneSpec";
import { THREE_COMPONENT_NAMES } from "../lib/video/threeRegistry";
import { routeRender } from "../lib/render/renderRouter";
import { isThreeRenderServiceAvailable } from "../lib/render/renderClient";

interface TestArgs {
  render: boolean;
  json: boolean;
  durationSeconds: number;
}

function parseArgs(argv: string[]): TestArgs {
  const durationIdx = argv.indexOf("--duration");
  const durationSeconds =
    durationIdx !== -1 ? Number(argv[durationIdx + 1] || 20) : 20;
  return {
    render: argv.includes("--render"),
    json: argv.includes("--json"),
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 20,
  };
}

function log(label: string, msg: string) {
  if (!process.env.TEST_QUIET) console.log(`[test-three-ollama] ${label} ${msg}`);
}

function checkSpec(spec: SceneSpec, expectedFrames: number): { ok: boolean; checks: Array<{ name: string; ok: boolean; detail: string }> } {
  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  // 1. frame count
  const frameDelta = Math.abs(spec.durationInFrames - expectedFrames);
  checks.push({
    name: "frame-count",
    ok: frameDelta <= 1,
    detail: `expected≈${expectedFrames} got=${spec.durationInFrames} Δ=${frameDelta}`,
  });

  // 2. beats present
  checks.push({
    name: "beats-present",
    ok: spec.beats.length >= 1,
    detail: `${spec.beats.length} beat(s)`,
  });

  // 3. every beat has visible objects within its window
  const emptyBeats = spec.beats.filter((b) => {
    const ids = new Set(b.objectIds);
    return !spec.objects.some(
      (o) =>
        ids.has(o.id) &&
        (!o.visible ||
          (o.visible.startFrame < b.endFrame && o.visible.endFrame > b.startFrame)),
    );
  });
  checks.push({
    name: "beat-visibility",
    ok: emptyBeats.length === 0,
    detail:
      emptyBeats.length === 0
        ? "all beats have visible objects"
        : `empty: ${emptyBeats.map((b) => b.name).join(", ")}`,
  });

  // 4. camera rig set
  checks.push({
    name: "camera-rig",
    ok: Boolean(spec.cameraRig),
    detail: spec.cameraRig ? `type=${spec.cameraRig.type}` : "missing",
  });

  // 5. objects exist
  checks.push({
    name: "objects-present",
    ok: spec.objects.length >= 1,
    detail: `${spec.objects.length} object(s)`,
  });

  // 6. determinism — no Math.random in serialized spec
  const serialized = JSON.stringify(spec);
  checks.push({
    name: "determinism",
    ok: !serialized.includes("Math.random"),
    detail: serialized.includes("Math.random") ? "contains Math.random" : "clean",
  });

  // 7. every object kind is supported
  const supportedKinds = new Set(["plane", "box", "sphere", "torus", "icosahedron", "torusKnot", "text", "gltf", "particles", "group"]);
  const badKinds = spec.objects.filter((o) => !supportedKinds.has(o.kind));
  checks.push({
    name: "object-kinds",
    ok: badKinds.length === 0,
    detail:
      badKinds.length === 0
        ? "all valid"
        : `unknown: ${badKinds.map((o) => `${o.id}:${o.kind}`).join(", ")}`,
  });

  return { ok: checks.every((c) => c.ok), checks };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const model = process.env.OLLAMA_MODEL || "gemma4:e4b";
  const base = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";

  console.log("=== 3D Flow Test (Ollama backend) ===");
  console.log(`Model:     ${model}`);
  console.log(`Base URL:  ${base}`);
  console.log(`Duration:  ${args.durationSeconds}s`);
  console.log(`Render:    ${args.render ? "YES (if service reachable)" : "no (--render to enable)"}`);
  console.log(`Registry:  ${THREE_COMPONENT_NAMES.join(", ")}`);
  console.log("");

  // --- Stage 0: preflight — verify Ollama is reachable ---
  log("preflight:", "checking Ollama /api/tags …");
  const ollamaRoot = base.replace(/\/v1\/?$/, "");
  let ollamaOk = false;
  try {
    const r = await fetch(`${ollamaRoot}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const j = (await r.json()) as { models?: Array<{ name: string }> };
      const names = (j.models || []).map((m) => m.name);
      const hasModel = names.some((n) => n === model || n.startsWith(model.split(":")[0]));
      ollamaOk = true;
      if (hasModel) {
        log("preflight:", `OK — model ${model} available`);
      } else {
        log("preflight:", `WARN — model "${model}" not in list [${names.join(", ")}]; will attempt anyway`);
      }
    } else {
      log("preflight:", `FAIL — Ollama /api/tags returned ${r.status}`);
    }
  } catch (e) {
    log("preflight:", `FAIL — cannot reach Ollama at ${ollamaRoot}: ${e instanceof Error ? e.message : e}`);
  }
  if (!ollamaOk) {
    console.error("\nOllama not reachable. Start it with `ollama serve` and pull the model with `ollama pull ${model}`.");
    process.exit(1);
  }

  // --- Stage 1: run the threeDirector agent ---
  const brief = {
    description:
      'A cinematic 3D product video for "Nimbus", a developer-focused cloud monitoring platform. Hook with the wordmark floating in 3D, then features: real-time dashboards, AI anomaly detection, instant alerts. End with the tagline "See everything. Miss nothing." and the CTA "Start free at nimbus.dev".',
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
  };
  const expectedFrames = args.durationSeconds * 30;

  log("agent:", `running threeDirector (${args.durationSeconds}s = ${expectedFrames} frames)…`);
  const t0 = Date.now();
  let result;
  try {
    result = await generateThreeVideo({
      description: brief.description,
      brandHint: brief.brandHint,
      durationSeconds: args.durationSeconds,
      width: 1920,
      height: 1080,
      fps: 30,
      jobId: `test-three-ollama-${Date.now()}`,
    });
  } catch (e) {
    console.error("\n[agent] FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
  const agentMs = Date.now() - t0;
  log("agent:", `done in ${agentMs}ms — ${result.plan.beats.length} beats, ${result.spec.objects.length} objects, ${result.criticIssues.length} critic issues`);

  // --- Stage 2: apply critic ---
  log("critic:", "applying fixes …");
  const applied = applyThreeCritique(result.spec, { issues: result.criticIssues });
  log("critic:", `rewritten=${applied.rewritten} dropped=${applied.dropped}`);

  // --- Stage 3: validate SceneSpec ---
  let specValid = true;
  let specError: string | undefined;
  try {
    validateSceneSpec(result.spec);
    log("spec:", "valid (zod parse OK)");
  } catch (e) {
    specValid = false;
    specError = e instanceof Error ? e.message : String(e);
    log("spec:", `INVALID — ${specError}`);
  }

  // --- Stage 4: invariants ---
  const inv = checkSpec(result.spec, expectedFrames);
  for (const c of inv.checks) {
    log("invariant:", `${c.ok ? "✓" : "✗"} ${c.name} — ${c.detail}`);
  }
  log("invariants:", inv.ok ? "ALL PASS" : "SOME FAIL");

  // Save spec for inspection
  const specDir = resolve(process.cwd(), "public", "three");
  if (!existsSync(specDir)) mkdirSync(specDir, { recursive: true });
  const specPath = resolve(specDir, "test-three-ollama-spec.json");
  writeFileSync(specPath, JSON.stringify(result.spec, null, 2));
  log("spec:", `saved to ${specPath}`);

  const agentPassed = specValid && inv.ok;
  if (!agentPassed && !args.render) {
    console.error("\nAgent stage failed (spec invalid or invariants failed).");
    if (args.json) console.log(JSON.stringify({ agentMs, specValid, invariants: inv.checks, specFile: specPath }, null, 2));
    process.exit(1);
  }

  // --- Stage 5: render (optional) ---
  let renderInfo: any = null;
  if (args.render) {
    log("render:", "checking Three render service …");
    let reachable = false;
    try {
      reachable = await isThreeRenderServiceAvailable();
    } catch {
      reachable = false;
    }
    if (!reachable) {
      log("render:", "SKIP — Three render service not reachable (set THREE_RENDER_SERVICE_URL and start the GPU node)");
      renderInfo = { status: "skipped", reason: "service unreachable" };
    } else {
      log("render:", `service reachable — submitting ${result.spec.durationInFrames} frames …`);
      const tR = Date.now();
      try {
        const status = await routeRender({
          mode: "3d",
          spec: result.spec,
          projectId: "test-three-ollama",
        });
        const renderMs = Date.now() - tR;
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
        log("render:", `${status.status} in ${renderMs}ms — ${status.videoUrl ?? status.error ?? ""}`);
      } catch (e) {
        renderInfo = { status: "failed", error: e instanceof Error ? e.message : String(e), totalMs: Date.now() - tR };
        log("render:", `FAILED — ${renderInfo.error}`);
      }
    }
  }

  // --- Summary ---
  const summary = {
    backend: "ollama",
    model,
    ollamaBaseUrl: ollamaRoot,
    durationSeconds: args.durationSeconds,
    expectedFrames,
    agentMs,
    beats: result.plan.beats.length,
    objects: result.spec.objects.length,
    criticIssues: result.criticIssues.length,
    criticApplied: applied,
    specValid,
    specError,
    invariants: inv.checks,
    allInvariantsPassed: inv.ok,
    specFile: specPath,
    render: renderInfo,
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log("\n=== TEST SUMMARY ===");
    console.log(`Backend:        Ollama (${model})`);
    console.log(`Agent time:     ${(agentMs / 1000).toFixed(1)}s`);
    console.log(`Spec valid:     ${specValid ? "YES" : "NO"}${specError ? ` — ${specError.split("\n")[0]}` : ""}`);
    console.log(`Invariants:     ${inv.ok ? "ALL PASS" : "FAIL"}`);
    if (renderInfo) {
      console.log(`Render:         ${renderInfo.status}${renderInfo.totalMs ? ` (${(renderInfo.totalMs / 1000).toFixed(1)}s)` : ""}`);
      if (renderInfo.videoUrl) console.log(`  → ${renderInfo.videoUrl}`);
    }
    console.log(`Spec file:      ${specPath}`);
  }

  const renderFailed = renderInfo && renderInfo.status === "failed";
  const renderSkippedOrOk = !renderInfo || renderInfo.status === "skipped" || renderInfo.status === "completed";
  if (!specValid || !inv.ok) process.exit(1);
  if (renderFailed) process.exit(2);
  if (!renderSkippedOrOk) process.exit(2);
  process.exit(0);
}

main().catch((err) => {
  console.error("[test-three-ollama] fatal:", err);
  process.exit(1);
});