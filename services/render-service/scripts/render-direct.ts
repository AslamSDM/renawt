/**
 * DIRECT RENDER — no Redis/BullMQ/Express. Loads a SceneSpec JSON from disk
 * (or generates one via the threeDirector agent) and renders it straight to
 * an MP4 using the Three.js engine. Use this for local testing on macOS.
 *
 *   npx tsx scripts/render-direct.ts --spec path/to/spec.json --out out.mp4
 *   npx tsx scripts/render-direct.ts --generate --brief "..." --out out.mp4
 *
 * Env:
 *   PUPPETEER_EXECUTABLE_PATH (default: auto-detected Chrome on macOS)
 *   LLM_PROVIDER=ollama OLLAMA_MODEL=kimi-k2.6:cloud (for --generate)
 */

import { readFileSync, existsSync, mkdirSync } from "fs"
import { resolve, dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
import { renderThreeScene } from "../src/threeEngine/sceneHost"
import type { SceneSpec } from "../src/threeEngine/sceneRuntimeSpec"
import { spawnSync } from "child_process"

function parseArgs(argv: string[]) {
  const out: { spec?: string; out: string; generate: boolean; brief?: string; duration: number } = {
    out: "out/three-render.mp4",
    generate: false,
    duration: 20,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--spec") out.spec = argv[++i]
    else if (a === "--out") out.out = argv[++i]
    else if (a === "--generate") out.generate = true
    else if (a === "--brief") out.brief = argv[++i]
    else if (a === "--duration") out.duration = Number(argv[++i])
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.spec && !args.generate) {
    console.error("Provide --spec <path> or --generate --brief <text>")
    process.exit(1)
  }

  let spec: SceneSpec
  if (args.generate) {
    console.log("[render-direct] generating spec via threeDirector agent (Ollama)…")
    // Import generate-server modules. These live in a sibling dir; use a
    // relative path that tsx can resolve at runtime.
    const dir = await import("../../generate-server/lib/agents/threeDirector")
    const builder = await import("../../generate-server/lib/video/sceneBuilder")
    const critic = await import("../../generate-server/lib/agents/threeCritic")
    const result = await dir.generateThreeVideo({
      description: args.brief || "A cinematic 3D product video for Nimbus cloud monitoring. Hook wordmark, features, CTA.",
      brandHint: {
        productName: "Nimbus",
        tagline: "See everything. Miss nothing.",
        features: [
          { title: "Real-time dashboards", description: "Live metrics from every region." },
          { title: "AI anomaly detection", description: "40% fewer incidents." },
          { title: "Instant alerts", description: "PagerDuty + Slack in 5s." },
        ],
        cta: "Start free at nimbus.dev",
      },
      durationSeconds: args.duration,
      width: 1280,
      height: 720,
      fps: 30,
      jobId: `render-direct-${Date.now()}`,
    })
    if (result.criticIssues.length > 0) {
      critic.applyThreeCritique(result.spec, { issues: result.criticIssues })
    }
    spec = result.spec as unknown as SceneSpec
    console.log(`[render-direct] spec built — ${spec.objects.length} objects, ${spec.durationInFrames} frames`)
  } else {
    const specPath = resolve(args.spec!)
    if (!existsSync(specPath)) {
      console.error(`spec not found: ${specPath}`)
      process.exit(1)
    }
    spec = JSON.parse(readFileSync(specPath, "utf-8")) as SceneSpec
    console.log(`[render-direct] loaded spec from ${specPath} — ${spec.objects.length} objects, ${spec.durationInFrames} frames`)
  }

  // Sanitize spec for local rendering: strip features that need optional
  // deps (postprocessing, troika-three-text) if those packages aren't
  // installed locally. This keeps the render working for testing purposes.
  const hasPostprocessing = existsSync(join(__dirname, "..", "node_modules", "postprocessing", "build", "index.js"))
  const hasTroika = existsSync(join(__dirname, "..", "node_modules", "troika-three-text", "dist", "troika-three-text.esm.js"))
  if (!hasPostprocessing && spec.postFX) {
    console.log(`[render-direct] stripping postFX (postprocessing not installed)`)
    spec.postFX = undefined
  }
  if (!hasTroika) {
    const textCount = spec.objects.filter((o: any) => o.kind === "text").length
    if (textCount > 0) {
      console.log(`[render-direct] replacing ${textCount} text objects with boxes (troika not installed)`)
      for (const o of spec.objects) {
        if (o.kind === "text") {
          ;(o as any).kind = "box"
          ;(o as any).props = { ...(o as any).props, color: ((o as any).props?.color) || "#ffffff" }
        }
      }
      // Also fix children
      function fixChildren(arr: any[]) {
        for (const o of arr) {
          if (o.children) {
            for (const c of o.children) {
              if (c.kind === "text") {
                c.kind = "box"
                c.props = { ...c.props, color: c.props?.color || "#ffffff" }
              }
            }
            fixChildren(o.children)
          }
        }
      }
      fixChildren(spec.objects)
    }
  }

  const outPath = resolve(args.out)
  mkdirSync(dirname(outPath), { recursive: true })

  // macOS Chrome auto-detection if PUPPETEER_EXECUTABLE_PATH not set
  if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
    const chrome =
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if (existsSync(chrome)) {
      process.env.PUPPETEER_EXECUTABLE_PATH = chrome
      console.log(`[render-direct] using Chrome at ${chrome}`)
    }
  }

  console.log(`[render-direct] rendering to ${outPath}…`)
  const t0 = Date.now()
  const result = await renderThreeScene(spec, {
    width: spec.width,
    height: spec.height,
    fps: spec.fps,
    durationInFrames: spec.durationInFrames,
    outputFormat: "mp4",
    outputPath: outPath,
    onProgress: (p) => {
      if (Math.round(p * 100) % 10 === 0) {
        console.log(`[render-direct] progress: ${Math.round(p * 100)}%`)
      }
    },
  })
  const ms = Date.now() - t0

  if (result.success) {
    console.log(`[render-direct] ✓ done in ${(ms / 1000).toFixed(1)}s — ${result.localFilePath}`)
    // Probe the output
    const probe = spawnSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration,size:stream=width,height,codec_name",
      "-of", "default=noprint_wrappers=1",
      result.localFilePath!,
    ], { encoding: "utf-8" })
    if (probe.stdout) console.log(`[render-direct] ffprobe:\n${probe.stdout.trim()}`)
    process.exit(0)
  } else {
    console.error(`[render-direct] ✗ failed: ${result.error}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error("[render-direct] fatal:", err)
  process.exit(1)
})