/**
 * Generate a proper PRODUCT DEMO video for a URL using the 3D engine.
 * Combines jitter's content intelligence (brand analysis, music, beat sync,
 * screenshots) with the three.js render engine.
 *
 *   tsx generate-server/scripts/test-product-demo.ts https://www.apple.com/in/macbook-pro/
 *   tsx generate-server/scripts/test-product-demo.ts https://example.com --duration 30
 *
 * Pipeline:
 *   1. Puppeteer captures screenshot of the URL
 *   2. Vision model (kimi-k2.6:cloud) analyzes brand: product name, tagline,
 *      features, colors, CTA — verbatim from the page
 *   3. Music is picked from the DB (mood + BPM)
 *   4. Beat map is generated (beat frames for the duration)
 *   5. threeDirector generates a SceneSpec with STRICT instructions:
 *      - Use the screenshot as a 3D textured plane (product showcase)
 *      - Show verbatim product text (headlines, features, CTA)
 *      - Cut scenes on beat boundaries
 *      - Camera moves that showcase the product (orbit, dolly, pan)
 *      - Apple-like minimal premium aesthetic
 *   6. threeCritic applies fixes
 *   7. Three.js engine renders the video
 *   8. ffmpeg muxes the music track into the final MP4
 *
 * Env (set in shell):
 *   LLM_PROVIDER=ollama OLLAMA_MODEL=kimi-k2.6:cloud OLLAMA_NUM_CTX=32768
 *   THREE_HEADLESS=0  (macOS needs visible Chrome for WebGL)
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { spawnSync } from 'child_process'
import * as dotenv from 'dotenv'

dotenv.config({ path: resolve(process.cwd(), '../.env') })
dotenv.config({ path: resolve(process.cwd(), '.env') })

import { chatWithOllamaVision, chatWithGeminiPro, CODE_GENERATOR_CONFIG } from '../lib/agents/model'
import { generateThreeVideo } from '../lib/agents/threeDirector'
import { applyThreeCritique } from '../lib/agents/threeCritic'
import { validateSceneSpec, type SceneSpec } from '../lib/video/sceneSpec'
import { generateBeatMap, type BeatMap } from '../lib/audio/beatSync'
import { pickTrack, moodToMusicKeyword, type PickedTrack } from '../lib/audio/musicPicker'

interface Args {
  url: string
  out: string
  duration: number
  width: number
  height: number
}

function parseArgs(argv: string[]): Args {
  const out: Args = { url: '', out: 'out/product-demo.mp4', duration: 20, width: 1920, height: 1080 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--out') out.out = argv[++i]
    else if (a === '--duration') out.duration = Number(argv[++i])
    else if (a === '--width') out.width = Number(argv[++i])
    else if (a === '--height') out.height = Number(argv[++i])
    else if (!a.startsWith('--') && !out.url) out.url = a
  }
  return out
}

interface BrandReport {
  productName: string
  tagline: string
  headlines: string[]
  features: Array<{ title: string; description?: string }>
  cta: string
  brand: {
    primary: string
    background: string
    textColor: string
    accent: string
    fontFamily: string
    mood: string
  }
  heroDescription: string
}

const BRAND_VISION_PROMPT = `You are a senior brand analyst. Given a screenshot of a product page, extract a STRUCTURED brand report. Return ONLY JSON — no markdown, no commentary:

{
  "productName": "string — exact product name from the page",
  "tagline": "string — the most prominent short marketing phrase",
  "headlines": ["string — verbatim H1/H2 text from the page, in order"],
  "features": [{ "title": "string — verbatim feature name", "description": "string — one-line description from the page" }],
  "cta": "string — the call-to-action button text",
  "brand": {
    "primary": "#hex — dominant brand color",
    "background": "#hex — page background color",
    "textColor": "#hex — primary text color",
    "accent": "#hex — accent/highlight color",
    "fontFamily": "string — best guess font family (Inter, SF Pro, Roboto, etc.)",
    "mood": "minimal|premium|techy|bold|playful|warm"
  },
  "heroDescription": "string — 1-2 sentence description of the hero visual / product image"
}

RULES:
- Extract VERBATIM text — do not paraphrase. The video must show the actual product copy.
- All colors as #RRGGBB hex sampled from the screenshot.
- features: extract 3-5 actual features from the page, not made-up ones.
- If the page is a product page, the productName is the product being sold.`

async function captureScreenshot(url: string, width: number, height: number): Promise<string> {
  console.log(`[demo] Capturing ${url}…`)
  const puppeteer = (await import('puppeteer')).default ?? (await import('puppeteer'))
  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const browser = await puppeteer.launch({
    executablePath: existsSync(chromePath) ? chromePath : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--hide-scrollbars'],
    defaultViewport: { width, height },
  })
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
  } catch (e) {
    console.warn(`[demo] goto timeout (continuing): ${e}`)
  }
  await new Promise((r) => setTimeout(r, 2500))

  const outDir = join(process.cwd(), 'tmp', 'captures')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const screenshotPath = join(outDir, `demo-${Date.now()}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: false, type: 'png' })
  await browser.close()
  console.log(`[demo] Screenshot: ${screenshotPath}`)
  return screenshotPath
}

async function analyzeBrand(screenshotPath: string, url: string): Promise<BrandReport> {
  console.log('[demo] Analyzing brand from screenshot…')
  const resp = await chatWithOllamaVision(
    { type: 'image', path: screenshotPath },
    `Analyze this product page screenshot. URL: ${url}. Return the brand report JSON per the system prompt.`,
    BRAND_VISION_PROMPT,
    { temperature: 0.2, maxTokens: 12000 },
  )
  // Extract JSON from response
  const text = resp.content
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON in brand analysis response')
  const brand = JSON.parse(text.slice(start, end + 1))
  console.log(`[demo] Brand: ${brand.productName} | mood: ${brand.brand?.mood} | features: ${brand.features?.length}`)
  return brand
}

function buildScript(brand: BrandReport, durationSec: number, beatMap: BeatMap): string {
  // Build a detailed video script that the threeDirector must follow.
  // The script specifies exact beats, text on screen, camera moves, and
  // which frame each scene starts/ends (aligned to beat boundaries).
  const measures = beatMap.measures
  const beats = beatMap.beats
  const totalFrames = durationSec * 30

  // Divide duration into sections aligned to measures
  const sectionCount = Math.min(5, Math.max(3, Math.floor(durationSec / 4)))
  const framesPerSection = Math.floor(totalFrames / sectionCount)
  // Snap each section boundary to the nearest beat
  const sections: Array<{ name: string; startFrame: number; endFrame: number; text: string; camera: string }> = []

  // Section 1: Hook — product name + tagline (hero shot)
  sections.push({
    name: 'hook',
    startFrame: 0,
    endFrame: snapToBeat(framesPerSection, beats),
    text: `${brand.productName}\n${brand.tagline || ''}`.trim(),
    camera: 'slow orbit around center, showing the screenshot as a 3D plane floating in space',
  })

  // Section 2-N: Feature showcase — each feature gets its own beat
  const featureCount = Math.min(brand.features.length, sectionCount - 2)
  for (let i = 0; i < featureCount; i++) {
    const f = brand.features[i]
    sections.push({
      name: `feature-${i + 1}`,
      startFrame: snapToBeat(framesPerSection * (1 + i), beats),
      endFrame: snapToBeat(framesPerSection * (2 + i), beats),
      text: `${f.title}\n${f.description || ''}`.trim(),
      camera: i % 2 === 0 ? 'slow dolly-in toward the text' : 'gentle pan left to right revealing the text',
    })
  }

  // Last section: CTA
  sections.push({
    name: 'cta',
    startFrame: snapToBeat(framesPerSection * (sectionCount - 1), beats),
    endFrame: totalFrames,
    text: `${brand.cta || 'Learn more'}\n${brand.productName}`,
    camera: 'pull back to reveal full scene, slow zoom out',
  })

  // Build the script text for the director
  const scriptLines = sections.map((s, i) => {
    return `SCENE ${i + 1} "${s.name}" (frames ${s.startFrame}-${s.endFrame}, ${((s.endFrame - s.startFrame) / 30).toFixed(1)}s):
  ON-SCREEN TEXT: "${s.text.replace(/\n/g, ' / ')}"
  CAMERA: ${s.camera}
  VISUAL: ${i === 0 ? 'Show the product screenshot as a 3D plane with the product name text' : i === sections.length - 1 ? 'CTA text large and centered, product name below' : 'Feature title text large, description smaller below, on a glass card'}`
  })

  return `VIDEO SCRIPT (MUST FOLLOW EXACTLY):
${scriptLines.join('\n\n')}

PRODUCT: ${brand.productName}
TAGLINE: ${brand.tagline || '(none)'}
BRAND COLORS: primary=${brand.brand.primary}, background=${brand.brand.background}, text=${brand.brand.textColor}, accent=${brand.brand.accent}
FONT: ${brand.brand.fontFamily}
MOOD: ${brand.brand.mood}
SCREENSHOT URL: (local file — use as texture on a 3D plane for the hero shot)
MUSIC BPM: ${beatMap.bpm} (scenes MUST cut on beat boundaries: frames ${beats.slice(0, 20).join(', ')}…)

REQUIREMENTS:
1. Use kind="html" objects (CSS3DRenderer) for ALL text — real DOM with the brand font, brand colors, proper typography. NOT abstract 3D text.
2. The hero shot (scene 1) MUST show the product screenshot as a textured plane in 3D space.
3. Each scene's text MUST be the EXACT text from the script above — do NOT paraphrase.
4. Scene cuts MUST happen at the exact frame numbers specified (aligned to beats).
5. Camera MUST move continuously — no static shots. Use "curve" or "path" camera rigs.
6. Use the brand's actual colors as the background and accent colors.
7. Add particles or a subtle gradient background for depth.
8. PostFX: bloom (subtle) + vignette. NO chromatic aberration (Apple-like = clean).`
}

function snapToBeat(frame: number, beats: number[]): number {
  if (!beats.length) return frame
  let closest = beats[0]
  let minDiff = Math.abs(frame - closest)
  for (const b of beats) {
    const d = Math.abs(frame - b)
    if (d < minDiff) {
      minDiff = d
      closest = b
    }
  }
  return closest
}

async function muxAudio(videoPath: string, audioUrl: string, outputPath: string): Promise<void> {
  console.log(`[demo] Muxing audio from ${audioUrl}…`)
  // Download audio to temp file
  const audioTmp = join(process.cwd(), 'tmp', 'demo-audio.mp3')
  if (!existsSync(dirname(audioTmp))) mkdirSync(dirname(audioTmp), { recursive: true })
  const resp = await fetch(audioUrl)
  if (!resp.ok) throw new Error(`Failed to download audio: ${resp.status}`)
  const buf = Buffer.from(await resp.arrayBuffer())
  writeFileSync(audioTmp, buf)
  // Mux with ffmpeg
  const result = spawnSync('ffmpeg', [
    '-y', '-i', videoPath, '-i', audioTmp,
    '-c:v', 'copy', '-c:a', 'aac', '-shortest',
    outputPath,
  ], { encoding: 'utf-8', stdio: 'pipe' })
  if (result.status !== 0) {
    console.error(`[demo] ffmpeg mux failed: ${result.stderr?.slice(0, 500)}`)
    throw new Error('audio mux failed')
  }
  console.log(`[demo] Audio muxed → ${outputPath}`)
}

function dirname(p: string): string {
  const idx = p.lastIndexOf('/')
  return idx > 0 ? p.slice(0, idx) : '.'
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.url) {
    console.error('Usage: tsx test-product-demo.ts <url> [--out path] [--duration secs]')
    console.error('Example: tsx test-product-demo.ts https://www.apple.com/in/macbook-pro/ --duration 20')
    process.exit(1)
  }

  const model = process.env.OLLAMA_MODEL || 'kimi-k2.6:cloud'
  console.log('=== Product Demo Generator ===')
  console.log(`URL:      ${args.url}`)
  console.log(`Model:    ${model}`)
  console.log(`Duration: ${args.duration}s`)
  console.log(`Output:   ${args.out}`)
  console.log('')

  // --- Stage 1: Capture screenshot ---
  const screenshotPath = await captureScreenshot(args.url, args.width, args.height)

  // --- Stage 2: Brand analysis ---
  const brand = await analyzeBrand(screenshotPath, args.url)
  console.log('[demo] Brand report:', JSON.stringify(brand, null, 2).slice(0, 800))

  // --- Stage 3: Pick music ---
  let music: PickedTrack | null = null
  try {
    const mood = moodToMusicKeyword(brand.brand.mood)
    music = await pickTrack({ mood, preferredBpm: 124 })
    console.log(`[demo] Music: "${music.title}" @ ${music.bpm} BPM`)
  } catch (e) {
    console.warn(`[demo] Music pick failed (continuing without): ${e}`)
  }

  // --- Stage 4: Generate beat map ---
  const fps = 30
  const totalFrames = args.duration * fps
  const beatMap = generateBeatMap({
    bpm: music?.bpm ?? 124,
    totalDurationFrames: totalFrames,
    fps,
  })
  console.log(`[demo] Beat map: ${beatMap.beats.length} beats, ${beatMap.measures.length} measures`)

  // --- Stage 5: Build script ---
  const script = buildScript(brand, args.duration, beatMap)
  const scriptPath = join(process.cwd(), 'tmp', 'demo-script.txt')
  writeFileSync(scriptPath, script)
  console.log(`[demo] Script saved: ${scriptPath}`)

  // --- Stage 6: Generate SceneSpec via threeDirector ---
  console.log(`\n[1/4] Generating SceneSpec with ${model}…`)
  const t0 = Date.now()
  const result = await generateThreeVideo({
    description: script,
    brandHint: {
      productName: brand.productName,
      tagline: brand.tagline,
      features: brand.features,
      cta: brand.cta,
    },
    durationSeconds: args.duration,
    width: args.width,
    height: args.height,
    fps,
    images: [screenshotPath],
    jobId: `demo-${Date.now()}`,
  })
  console.log(`  ✓ spec built in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${result.spec.objects.length} objects, ${result.spec.beats.length} beats`)

  // --- Stage 7: Apply critic ---
  console.log('\n[2/4] Applying critic…')
  const applied = applyThreeCritique(result.spec, { issues: result.criticIssues })
  console.log(`  rewritten=${applied.rewritten} dropped=${applied.dropped}`)

  // Validate
  try {
    validateSceneSpec(result.spec)
    console.log('  ✓ spec valid')
  } catch (e) {
    console.error('  ✗ spec invalid:', e instanceof Error ? e.message : e)
    process.exit(1)
  }

  // Save spec
  const specPath = join(process.cwd(), 'tmp', 'demo-spec.json')
  writeFileSync(specPath, JSON.stringify(result.spec, null, 2))

  // --- Stage 8: Render ---
  console.log(`\n[3/4] Rendering to ${args.out}…`)
  const outPath = resolve(args.out)
  mkdirSync(dirname(outPath), { recursive: true })

  if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    if (existsSync(chrome)) process.env.PUPPETEER_EXECUTABLE_PATH = chrome
  }

  const renderServiceRoot = resolve(process.cwd(), '..', 'services', 'render-service')
  const sceneHostPath = join(renderServiceRoot, 'src', 'threeEngine', 'sceneHost.ts')
  const { renderThreeScene } = await import(sceneHostPath)

  const tR = Date.now()
  const renderResult = await renderThreeScene(result.spec as any, {
    width: result.spec.width,
    height: result.spec.height,
    fps: result.spec.fps,
    durationInFrames: result.spec.durationInFrames,
    outputFormat: 'mp4',
    outputPath: outPath,
    onProgress: (p: number) => {
      const pct = Math.round(p * 100)
      if (pct % 10 === 0) console.log(`  render: ${pct}%`)
    },
  })
  const renderMs = Date.now() - tR

  if (!renderResult.success) {
    console.error(`\n✗ render failed: ${renderResult.error}`)
    process.exit(1)
  }
  console.log(`  ✓ rendered in ${(renderMs / 1000).toFixed(1)}s`)

  // --- Stage 9: Mux music ---
  if (music) {
    console.log(`\n[4/4] Muxing music…`)
    const muxedPath = outPath.replace(/\.mp4$/, '-with-audio.mp4')
    try {
      await muxAudio(outPath, music.url, muxedPath)
      console.log(`\n✓ DONE — ${muxedPath}`)
      const probe = spawnSync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration,size:stream=codec_name',
        '-of', 'default=noprint_wrappers=1',
        muxedPath,
      ], { encoding: 'utf-8' })
      if (probe.stdout) console.log(`ffprobe:\n${probe.stdout.trim()}`)
      process.exit(0)
    } catch (e) {
      console.warn(`[demo] Audio mux failed, using silent video: ${e}`)
      console.log(`\n✓ DONE (no audio) — ${outPath}`)
      process.exit(0)
    }
  } else {
    console.log(`\n✓ DONE (no music) — ${outPath}`)
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('[demo] FAILED:', err)
  process.exit(1)
})