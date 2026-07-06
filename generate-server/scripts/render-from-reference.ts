/**
 * REFERENCE-COPY PIPELINE — vision-analyze a reference video with kimi-k2.6:cloud
 * then drive the threeDirector to recreate it as a 3D SceneSpec, then render.
 *
 *   npx tsx scripts/render-from-reference.ts \
 *     --reference /Users/aslam/Desktop/reference.mp4 \
 *     --out out/copy.mp4 \
 *     --duration 24
 *
 * Env (set in shell, NOT .env, so model.ts picks them up at load time):
 *   LLM_PROVIDER=ollama
 *   OLLAMA_MODEL=kimi-k2.6:cloud
 *   OLLAMA_NUM_CTX=32768
 *   THREE_HEADLESS=0   (macOS can't do WebGL headless)
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from "fs"
import { resolve, dirname, join } from "path"
import { spawnSync } from "child_process"

// Static imports — env vars must be set in the shell BEFORE tsx starts.
import { chatWithOllamaVision } from "../lib/agents/model"
import { generateThreeVideo } from "../lib/agents/threeDirector"
import { applyThreeCritique } from "../lib/agents/threeCritic"
import { validateSceneSpec } from "../lib/video/sceneSpec"

interface Args {
  reference: string
  out: string
  duration: number
  frames: number
}

function parseArgs(argv: string[]): Args {
  const out: Args = { reference: "", out: "out/copy.mp4", duration: 24, frames: 8 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--reference") out.reference = argv[++i]
    else if (a === "--out") out.out = argv[++i]
    else if (a === "--duration") out.duration = Number(argv[++i])
    else if (a === "--frames") out.frames = Number(argv[++i])
  }
  return out
}

function extractFrames(videoPath: string, count: number, outDir: string): string[] {
  if (!existsSync(videoPath)) throw new Error(`reference video not found: ${videoPath}`)
  mkdirSync(outDir, { recursive: true })
  // Clear old frames
  for (const f of readdirSync(outDir)) {
    if (f.endsWith(".jpg")) unlinkSync(join(outDir, f))
  }
  // One frame every (duration / count) seconds, scaled to 960px wide for the
  // vision model (keeps token count reasonable while preserving detail).
  const interval = Math.max(1, Math.floor(args.duration / count))
  const result = spawnSync("ffmpeg", [
    "-y", "-i", videoPath,
    "-vf", `fps=1/${interval},scale=960:-1`,
    "-frames:v", String(count),
    join(outDir, "frame-%02d.jpg"),
  ], { encoding: "utf-8", stdio: "pipe" })
  if (result.status !== 0) {
    throw new Error(`ffmpeg frame extraction failed: ${result.stderr?.slice(0, 500)}`)
  }
  const frames = readdirSync(outDir)
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((f) => join(outDir, f))
  console.log(`[ref-copy] extracted ${frames.length} frames from ${videoPath}`)
  return frames
}

function toBase64(filePath: string): string {
  return readFileSync(filePath).toString("base64")
}

const VISION_SYSTEM_PROMPT = `You are a senior motion-design analyst watching keyframes from a reference video. You will produce a DETAILED shot-by-shot description that another AI will use to recreate the video EXACTLY in Three.js.

For EACH frame, describe:
1. SHOT TYPE: establishing / close-up / medium / wide / over-shoulder / macro
2. CAMERA: angle (high/low/eye-level), movement (static / pan-left / pan-right / dolly-in / dolly-out / orbit / crane-up / handheld), speed (slow/medium/fast)
3. COMPOSITION: rule-of-thirds / centered / symmetric / asymmetric, where the focal point is
4. COLORS: exact hex codes for background, foreground, accent, text (sample from the frame)
5. LIGHTING: bright / dim / moody / high-key / low-key / rim-lit / backlit, light direction
6. TEXT ON SCREEN: verbatim, with approximate position (center / top-left / bottom-center etc.), font style (bold sans / serif / mono / display), size (small / medium / large / hero)
7. 3D OBJECTS: what shapes are visible (planes / boxes / spheres / particles / text), their positions, materials (matte / glossy / metallic / glass / neon), animations (rotating / floating / scaling-in / sliding)
8. TRANSITIONS to next frame: cut / fade / dissolve / wipe / slide / scale-pop
9. POST FX: bloom / depth-of-field / vignette / chromatic-aberration / grain / glow
10. PACING: how fast elements animate, energy level 1-10

Return ONLY a JSON array — one object per frame — with this shape:
[
  {
    "frame": 1,
    "timecode": "0s",
    "shotType": "...",
    "camera": { "angle": "...", "movement": "...", "speed": "..." },
    "composition": "...",
    "colors": { "background": "#hex", "foreground": "#hex", "accent": "#hex", "text": "#hex" },
    "lighting": "...",
    "onScreenText": [ { "text": "...", "position": "...", "style": "...", "size": "..." } ],
    "objects3D": [ { "shape": "...", "position": "...", "material": "...", "animation": "..." } ],
    "transition": "...",
    "postFX": ["..."],
    "pacing": 1
  }
]

RULES:
- Be PRECISE and EXACT — the goal is a faithful 1:1 recreation.
- All colors as #RRGGBB hex.
- If text is too small to read, write "[illegible]".
- Describe what you ACTUALLY SEE, not what you guess the product is.`

const DIRECTOR_SYSTEM_INJECTION = `You are recreating a reference video EXACTLY. Below is a frame-by-frame vision analysis of the reference. Your SceneSpec MUST match it shot-for-shot: same colors, same camera movements, same text, same object shapes, same pacing, same post FX. Do NOT improvise or "improve" — copy the reference faithfully.

REFERENCE VISION ANALYSIS (frame by frame):
%s

Recreate this as a Three.js SceneSpec. Use the same number of beats as frames, each beat matching one frame's description.`

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.reference) {
    console.error("Usage: --reference <path> --out <path> --duration <seconds>")
    process.exit(1)
  }

  const model = process.env.OLLAMA_MODEL || "kimi-k2.6:cloud"
  console.log("=== Reference-Copy Pipeline ===")
  console.log(`Model:      ${model}`)
  console.log(`Reference:  ${args.reference}`)
  console.log(`Duration:   ${args.duration}s`)
  console.log(`Output:     ${args.out}`)
  console.log("")

  // --- Stage 1: extract keyframes ---
  const framesDir = join(__dirname, "..", "tmp", "ref-frames")
  const frames = extractFrames(args.reference, args.frames, framesDir)
  if (frames.length === 0) throw new Error("no frames extracted")

  // --- Stage 2: vision-analyze each frame with kimi ---
  console.log(`\n[1/3] Vision-analyzing ${frames.length} frames with ${model}…`)
  const frameAnalyses: any[] = []
  for (let i = 0; i < frames.length; i++) {
    const framePath = frames[i]
    const timecode = `${Math.round((i * args.duration) / frames.length)}s`
    console.log(`  frame ${i + 1}/${frames.length} (${timecode})…`)
    const resp = await chatWithOllamaVision(
      { type: "image", path: framePath },
      `This is frame ${i + 1} of ${frames.length} from a ${args.duration}s reference video (timecode ~${timecode}). Analyze it per the system prompt.`,
      VISION_SYSTEM_PROMPT,
      { temperature: 0.2, maxTokens: 8000 },
    )
    // Extract the JSON array from the response
    let parsed: any
    try {
      const text = resp.content
      const start = text.indexOf("[")
      const end = text.lastIndexOf("]")
      if (start === -1 || end === -1) throw new Error("no JSON array in response")
      parsed = JSON.parse(text.slice(start, end + 1))
      if (Array.isArray(parsed) && parsed.length > 0) {
        frameAnalyses.push(parsed[0])
      } else {
        frameAnalyses.push({ frame: i + 1, timecode, raw: resp.content.slice(0, 500) })
      }
    } catch (e) {
      console.warn(`  frame ${i + 1}: JSON parse failed, using raw text`)
      frameAnalyses.push({ frame: i + 1, timecode, raw: resp.content.slice(0, 1000) })
    }
  }
  console.log(`  ✓ analyzed ${frameAnalyses.length} frames`)

  // Save the analysis for debugging
  const analysisPath = join(__dirname, "..", "tmp", "reference-analysis.json")
  writeFileSync(analysisPath, JSON.stringify(frameAnalyses, null, 2))
  console.log(`  analysis saved: ${analysisPath}`)

  // --- Stage 3: drive threeDirector with the vision analysis as the brief ---
  console.log(`\n[2/3] Driving threeDirector to recreate the reference…`)
  const visionBrief = JSON.stringify(frameAnalyses, null, 2)
  const description = `Recreate this reference video EXACTLY in 3D. ${visionBrief}`
  const result = await generateThreeVideo({
    description,
    brandHint: undefined, // let the director infer from the reference
    durationSeconds: args.duration,
    width: 1920,
    height: 1080,
    fps: 30,
    jobId: `ref-copy-${Date.now()}`,
  })
  if (result.criticIssues.length > 0) {
    applyThreeCritique(result.spec, { issues: result.criticIssues })
  }
  // Validate
  try {
    validateSceneSpec(result.spec)
  } catch (e) {
    console.error("SceneSpec invalid:", e instanceof Error ? e.message : e)
    process.exit(1)
  }
  const specPath = join(__dirname, "..", "tmp", "copy-spec.json")
  writeFileSync(specPath, JSON.stringify(result.spec, null, 2))
  console.log(`  ✓ spec built — ${result.spec.objects.length} objects, ${result.spec.beats.length} beats, ${result.spec.durationInFrames} frames`)
  console.log(`  spec saved: ${specPath}`)

  // --- Stage 4: render ---
  console.log(`\n[3/3] Rendering to ${args.out}…`)
  const outPath = resolve(args.out)
  mkdirSync(dirname(outPath), { recursive: true })

  // macOS Chrome auto-detection
  if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
    const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    if (existsSync(chrome)) process.env.PUPPETEER_EXECUTABLE_PATH = chrome
  }

  // Dynamically import the render-service sceneHost (sibling package).
  const renderServiceRoot = resolve(__dirname, "..", "..", "services", "render-service")
  const sceneHostPath = join(renderServiceRoot, "src", "threeEngine", "sceneHost.ts")
  const { renderThreeScene } = await import(sceneHostPath)

  const t0 = Date.now()
  const renderResult = await renderThreeScene(result.spec as any, {
    width: result.spec.width,
    height: result.spec.height,
    fps: result.spec.fps,
    durationInFrames: result.spec.durationInFrames,
    outputFormat: "mp4",
    outputPath: outPath,
    onProgress: (p: number) => {
      const pct = Math.round(p * 100)
      if (pct % 10 === 0) console.log(`  render: ${pct}%`)
    },
  })
  const ms = Date.now() - t0

  if (renderResult.success) {
    console.log(`\n✓ DONE in ${(ms / 1000).toFixed(1)}s — ${renderResult.localFilePath}`)
    const probe = spawnSync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration,size:stream=width,height,codec_name,nb_frames",
      "-of", "default=noprint_wrappers=1",
      renderResult.localFilePath!,
    ], { encoding: "utf-8" })
    if (probe.stdout) console.log(`ffprobe:\n${probe.stdout.trim()}`)
    process.exit(0)
  } else {
    console.error(`\n✗ render failed: ${renderResult.error}`)
    process.exit(1)
  }
}

const args = parseArgs(process.argv.slice(2))

main().catch((err) => {
  console.error("[ref-copy] fatal:", err)
  process.exit(1)
})