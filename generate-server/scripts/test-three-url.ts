/**
 * Generate a 3D motion-graphics video for a URL (like Apple MacBook Pro page).
 * Mirrors the test-jitter.ts pattern: capture the page → generate → render.
 *
 *   tsx generate-server/scripts/test-three-url.ts https://www.apple.com/in/macbook-pro/
 *   tsx generate-server/scripts/test-three-url.ts https://example.com --duration 30 --out out/url-video.mp4
 *
 * Pipeline:
 *   1. Puppeteer captures a screenshot of the URL + extracts on-page text
 *   2. threeDirector agent (via Ollama kimi-k2.6:cloud) generates a SceneSpec
 *      from the screenshot + extracted brand text
 *   3. threeCritic applies fixes
 *   4. renderThreeScene renders the spec to MP4 (visible Chrome on macOS)
 *
 * Env (set in shell, NOT .env):
 *   LLM_PROVIDER=ollama OLLAMA_MODEL=kimi-k2.6:cloud OLLAMA_NUM_CTX=32768
 *   THREE_HEADLESS=0  (macOS can't do WebGL headless)
 *   PUPPETEER_EXECUTABLE_PATH (auto-detected Chrome)
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: resolve(process.cwd(), '../.env') })
dotenv.config({ path: resolve(process.cwd(), '.env') })

import { generateThreeVideo } from '../lib/agents/threeDirector'
import { applyThreeCritique } from '../lib/agents/threeCritic'
import { validateSceneSpec } from '../lib/video/sceneSpec'

interface Args {
  url: string
  out: string
  duration: number
  width: number
  height: number
}

function parseArgs(argv: string[]): Args {
  const out: Args = {
    url: '',
    out: 'out/url-video.mp4',
    duration: 20,
    width: 1920,
    height: 1080,
  }
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

async function capturePage(url: string, width: number, height: number): Promise<{ screenshotPath: string; text: string; title: string }> {
  console.log(`[three-url] Capturing ${url}…`)
  const puppeteer = (await import('puppeteer')).default ?? (await import('puppeteer'))
  const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const browser = await puppeteer.launch({
    executablePath: existsSync(chromePath) ? chromePath : undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width, height },
  })
  const page = await browser.newPage()
  await page.setViewport({ width, height, deviceScaleFactor: 1 })
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
  } catch (e) {
    console.warn(`[three-url] goto timeout (continuing with partial load): ${e}`)
  }
  // Wait a bit for fonts/images
  await new Promise((r) => setTimeout(r, 2000))

  // Extract on-page text for the brand hint
  const text = await page.evaluate(() => {
    const els = document.querySelectorAll('h1, h2, h3, p, .hero-copy, .headline, .typography-headline')
    return Array.from(els).slice(0, 50).map((e) => (e.textContent || '').trim()).filter((t) => t.length > 10 && t.length < 300).join('\n')
  })
  const title = await page.title()

  const outDir = join(__dirname, '..', 'tmp', 'captures')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const screenshotPath = join(outDir, `capture-${Date.now()}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: false, type: 'png' })
  await browser.close()
  console.log(`[three-url] Screenshot saved: ${screenshotPath} (${text.length} chars extracted)`)
  return { screenshotPath, text, title }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.url) {
    console.error('Usage: tsx test-three-url.ts <url> [--out path] [--duration secs]')
    console.error('Example: tsx test-three-url.ts https://www.apple.com/in/macbook-pro/ --duration 20')
    process.exit(1)
  }

  const model = process.env.OLLAMA_MODEL || 'kimi-k2.6:cloud'
  console.log('=== 3D URL Video Generator ===')
  console.log(`URL:      ${args.url}`)
  console.log(`Model:    ${model}`)
  console.log(`Duration: ${args.duration}s`)
  console.log(`Output:   ${args.out}`)
  console.log('')

  // --- Stage 1: Capture the page ---
  const { screenshotPath, text, title } = await capturePage(args.url, args.width, args.height)
  console.log(`[three-url] Page title: "${title}"`)
  console.log(`[three-url] Extracted text preview:\n${text.slice(0, 500)}\n`)

  // --- Stage 2: Build brand hint from extracted text ---
  const brandHint = {
    productName: title.replace(/\s*[|\-–—].*$/, '').trim() || 'MacBook Pro',
    tagline: text.split('\n').find((l) => l.length > 20 && l.length < 80) || 'The most powerful MacBook Pro ever',
    features: text
      .split('\n')
      .filter((l) => l.length > 10 && l.length < 120)
      .slice(0, 5)
      .map((l) => ({ title: l.slice(0, 60), description: '' })),
    cta: 'Learn more',
  }
  console.log('[three-url] Brand hint:', JSON.stringify(brandHint, null, 2).slice(0, 600))

  // --- Stage 3: Generate SceneSpec via threeDirector ---
  console.log(`\n[1/3] Generating SceneSpec with ${model}…`)
  const t0 = Date.now()
  const result = await generateThreeVideo({
    description: `Create a cinematic 3D product video for the following webpage. Use the page's actual colors, text, and features. The video should feel premium and Apple-like — minimal, elegant, with smooth camera movements and clean typography. Page content:\n\n${text}\n\nScreenshot: ${screenshotPath}`,
    brandHint,
    durationSeconds: args.duration,
    width: args.width,
    height: args.height,
    fps: 30,
    images: [screenshotPath],
    jobId: `three-url-${Date.now()}`,
  })
  console.log(`  ✓ spec built in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${result.spec.objects.length} objects, ${result.spec.beats.length} beats`)

  // --- Stage 4: Apply critic ---
  console.log('\n[2/3] Applying critic…')
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
  const specPath = join(__dirname, '..', 'tmp', 'url-spec.json')
  writeFileSync(specPath, JSON.stringify(result.spec, null, 2))
  console.log(`  spec saved: ${specPath}`)

  // --- Stage 5: Render ---
  console.log(`\n[3/3] Rendering to ${args.out}…`)
  const outPath = resolve(args.out)
  mkdirSync(dirname(outPath), { recursive: true })

  if (!process.env.PUPPETEER_EXECUTABLE_PATH) {
    const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    if (existsSync(chrome)) process.env.PUPPETEER_EXECUTABLE_PATH = chrome
  }

  const renderServiceRoot = resolve(__dirname, '..', '..', 'services', 'render-service')
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

  if (renderResult.success) {
    console.log(`\n✓ DONE in ${(renderMs / 1000).toFixed(1)}s — ${renderResult.localFilePath}`)
    const { spawnSync } = await import('child_process')
    const probe = spawnSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration,size:stream=width,height,codec_name,nb_frames',
      '-of', 'default=noprint_wrappers=1',
      renderResult.localFilePath!,
    ], { encoding: 'utf-8' })
    if (probe.stdout) console.log(`ffprobe:\n${probe.stdout.trim()}`)
    process.exit(0)
  } else {
    console.error(`\n✗ render failed: ${renderResult.error}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[three-url] FAILED:', err)
  process.exit(1)
})