/**
 * Node-side host for the Three.js render engine. Orchestrates a Puppeteer page
 * that runs sceneRuntime.ts in a browser (WebGL) context, drives it frame by
 * frame, screenshots each frame, and pipes MJPEG buffers to ffmpeg.
 *
 * The Node side never imports `three` — Three.js runs inside the browser page.
 * Optional libs (`postprocessing`, `troika-three-text`) are loaded from CDN
 * inside the page only when the spec uses them.
 */

import { spawn } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { spawnFfmpegVideo } from './muxer.js'
import type { SceneSpec } from './sceneRuntimeSpec.js'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

// Minimal local Puppeteer type stub. The real types come from the `puppeteer`
// package, but this render-service may ship without puppeteer installed in some
// offline build environments; this stub covers only the surface we use so
// `tsc --noEmit` passes without the dependency present. At runtime the real
// `puppeteer` module is imported normally.
interface PuppeteerPage {
  setContent(html: string, opts?: any): Promise<void>
  addScriptTag(opts: { url?: string; content?: string; type?: string }): Promise<void>
  evaluate<T = any>(fn: (...args: any[]) => Promise<T> | T, ...args: any[]): Promise<T>
  screenshot(opts: any): Promise<Buffer>
  close(): Promise<void>
  on(event: string, handler: (arg: any) => void): void
}
interface PuppeteerBrowser {
  newPage(): Promise<PuppeteerPage>
  close(): Promise<void>
}
interface PuppeteerLaunchOptions {
  executablePath?: string
  headless?: boolean | 'new'
  args?: string[]
  defaultViewport?: { width: number; height: number }
}
interface PuppeteerModule {
  launch(opts?: PuppeteerLaunchOptions): Promise<PuppeteerBrowser>
}

export interface RenderThreeSceneOptions {
  width: number
  height: number
  fps: number
  durationInFrames: number
  outputFormat: 'mp4' | 'webm'
  outputPath: string
  onProgress?: (progress: number) => void
}

export interface RenderThreeSceneResult {
  success: boolean
  localFilePath?: string
  error?: string
  renderTime?: number
}

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.175.0/build/three.min.js'
const POSTPROCESSING_CDN = 'https://cdn.jsdelivr.net/npm/postprocessing@6.36.5/build/index.js'
const TROIKA_CDN = 'https://cdn.jsdelivr.net/npm/troika-three-text@0.52.4/dist/troika-three-text.esm.js'

// Local fallbacks — read from node_modules at runtime so the page works
// without internet access (e.g. local testing, airgapped GPU nodes).
const THREE_LOCAL_PATH = join(__dirname, '..', '..', 'node_modules', 'three', 'build', 'three.module.js')
const THREE_CORE_LOCAL_PATH = join(__dirname, '..', '..', 'node_modules', 'three', 'build', 'three.core.js')
const POSTPROCESSING_LOCAL_PATH = join(__dirname, '..', '..', 'node_modules', 'postprocessing', 'build', 'index.js')
const TROIKA_LOCAL_PATH = join(__dirname, '..', '..', 'node_modules', 'troika-three-text', 'dist', 'troika-three-text.esm.js')
const TROIKA_UTILS_LOCAL_PATH = join(__dirname, '..', '..', 'node_modules', 'troika-three-utils', 'dist', 'troika-three-utils.esm.js')
// anime.js v4 + Three.js adapter, pre-bundled into a single ESM file by esbuild.
// The bundle is generated at build time from src/threeEngine/anime-entry.ts.
const ANIME_BUNDLE_PATH = join(__dirname, '..', '..', 'node_modules', '.cache', 'anime-bundle.js')
// Three.js addon modules (CSS3DRenderer, RGBELoader, GLTFLoader) — vanilla ESM
// that only imports from 'three' (resolved via the import map).
const THREE_ADDONS_BASE = join(__dirname, '..', '..', 'node_modules', 'three', 'examples', 'jsm')
const CSS3D_RENDERER_PATH = join(THREE_ADDONS_BASE, 'renderers', 'CSS3DRenderer.js')
const RGBE_LOADER_PATH = join(THREE_ADDONS_BASE, 'loaders', 'RGBELoader.js')
const GLTF_LOADER_PATH = join(THREE_ADDONS_BASE, 'loaders', 'GLTFLoader.js')

function loadLocalScript(absPath: string): string | null {
  try {
    if (existsSync(absPath)) {
      console.log(`[ThreeHost] loading local script: ${absPath}`)
      return readFileSync(absPath, 'utf-8')
    }
    console.log(`[ThreeHost] local script NOT found: ${absPath}`)
  } catch (e) {
    console.log(`[ThreeHost] local script read error: ${e}`)
  }
  return null
}

const GPU_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--use-gl=desktop',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--disable-gpu-sandbox',
  '--enable-unsafe-swiftshader',
]

// Allow overriding GPU args + headless mode via env for local testing.
const HEADLESS_MODE = process.env.THREE_HEADLESS !== '0' ? 'new' as const : false

const HARD_TIMEOUT_MS = 20 * 60 * 1000

function specUsesPostprocessing(spec: SceneSpec): boolean {
  return !!spec.postFX && !!(
    spec.postFX.bloom || spec.postFX.dof || spec.postFX.vignette
  )
}

function specUsesTroika(spec: SceneSpec): boolean {
  return spec.objects.some((o) => o.kind === 'text')
}

function specUsesGltf(spec: SceneSpec): boolean {
  return spec.objects.some((o) => o.kind === 'gltf')
}

/**
 * Tiny static HTTP server that serves three.js (and optional postprocessing /
 * troika) from local node_modules so the headless page can import them as
 * proper ESM modules. Returns the server handle with an `origin` string and
 * a `close()` method. Call `close()` when the render finishes.
 */
async function startAssetServer(spec: SceneSpec, threeSource: string): Promise<{ origin: string; close: () => Promise<void> }> {
  const http = await import('http')
  const postprocessingSrc = specUsesPostprocessing(spec) ? loadLocalScript(POSTPROCESSING_LOCAL_PATH) : null
  const troikaSrc = specUsesTroika(spec) ? loadLocalScript(TROIKA_LOCAL_PATH) : null
  const troikaUtilsSrc = specUsesTroika(spec) ? loadLocalScript(TROIKA_UTILS_LOCAL_PATH) : null
  // three.module.js imports from './three.core.js' — serve that too.
  const threeCoreSrc = loadLocalScript(THREE_CORE_LOCAL_PATH)
  // anime.js bundle (main + three adapter in one ESM file)
  const animeBundleSrc = loadLocalScript(ANIME_BUNDLE_PATH)
  // Three.js addons for CSS3DRenderer, RGBELoader, GLTFLoader
  const css3dSrc = loadLocalScript(CSS3D_RENDERER_PATH)
  const rgbeSrc = loadLocalScript(RGBE_LOADER_PATH)
  const gltfSrc = loadLocalScript(GLTF_LOADER_PATH)

  const assets: Record<string, string> = {
    '/three.js': threeSource,
    '/three.core.js': threeCoreSrc || '',
    '/bridge.js': `import * as THREE from './three.js'; window.THREE = THREE;`,
  }
  if (postprocessingSrc) assets['/postprocessing.js'] = postprocessingSrc
  if (troikaSrc) assets['/troika.js'] = troikaSrc
  if (troikaUtilsSrc) assets['/troika-utils.js'] = troikaUtilsSrc
  if (animeBundleSrc) assets['/anime.js'] = animeBundleSrc
  if (css3dSrc) assets['/CSS3DRenderer.js'] = css3dSrc
  if (rgbeSrc) assets['/RGBELoader.js'] = rgbeSrc
  if (gltfSrc) assets['/GLTFLoader.js'] = gltfSrc

  const server = http.createServer((req, res) => {
    const url = (req.url || '').split('?')[0]
    const body = assets[url]
    if (!body) {
      res.writeHead(404, { 'Access-Control-Allow-Origin': '*' })
      res.end('not found')
      return
    }
    res.writeHead(200, {
      'Content-Type': 'text/javascript',
      'Access-Control-Allow-Origin': '*',
    })
    res.end(body)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  }
}

function buildPageHtml(spec: SceneSpec, assetOrigin?: string): string {
  // When assetOrigin is set (local asset server), inject an import map so
  // bare specifiers like `from 'three'` / `from 'troika-three-utils'` in
  // troika-three-text resolve to the local server. When unset (CDN mode),
  // fall back to CDN script tags.
  if (assetOrigin) {
    const imports: Record<string, string> = {
      three: `${assetOrigin}/three.js`,
      'troika-three-text': `${assetOrigin}/troika.js`,
      'troika-three-utils': `${assetOrigin}/troika-utils.js`,
      animejs: `${assetOrigin}/anime.js`,
      'animejs/adapters/three': `${assetOrigin}/anime.js`,
      'three/addons/renderers/CSS3DRenderer.js': `${assetOrigin}/CSS3DRenderer.js`,
      'three/addons/loaders/RGBELoader.js': `${assetOrigin}/RGBELoader.js`,
      'three/addons/loaders/GLTFLoader.js': `${assetOrigin}/GLTFLoader.js`,
    }
    if (specUsesPostprocessing(spec)) {
      imports.postprocessing = `${assetOrigin}/postprocessing.js`
    }
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; padding: 0; background: #000; overflow: hidden; }
  canvas { display: block; }
</style>
<script type="importmap">
{ "imports": ${JSON.stringify(imports)} }
</script>
</head>
<body></body>
</html>`
  }
  // CDN fallback
  const needPost = specUsesPostprocessing(spec)
  const postScriptTag = needPost
    ? `<script src="${POSTPROCESSING_CDN}" onerror="console.warn('postprocessing CDN failed')"></script>`
    : ''
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; padding: 0; background: #000; overflow: hidden; }
  canvas { display: block; }
</style>
<script src="${THREE_CDN}" onerror="console.error('three CDN failed')"></script>
${postScriptTag}
</head>
<body></body>
</html>`
}

function getSceneRuntimeSource(): string {
  const candidate = join(__dirname, 'sceneRuntime.js')
  if (existsSync(candidate)) {
    return readFileSync(candidate, 'utf-8')
  }
  const tsCandidate = join(__dirname, 'sceneRuntime.ts')
  if (existsSync(tsCandidate)) {
    const raw = readFileSync(tsCandidate, 'utf-8')
    return transpileWithEsbuild(raw)
  }
  throw new Error('sceneRuntime source not found next to sceneHost')
}

/**
 * Transpile TypeScript to browser-ready JS using esbuild (available via tsx).
 * Strips types, down-levels to ES2020, and IIFEs the result so it runs as a
 * classic script in the headless page. Much more reliable than regex stripping.
 */
function transpileWithEsbuild(src: string): string {
  try {
    const esbuild = require('esbuild') as typeof import('esbuild')
    const result = esbuild.transformSync(src, {
      loader: 'ts',
      target: 'es2020',
      format: 'iife',
      platform: 'browser',
      supported: { 'top-level-await': false },
    })
    return result.code
  } catch (e) {
    console.warn('[ThreeHost] esbuild transpile failed, falling back to regex strip:', e)
    return stripTypeScript(src)
  }
}

function stripTypeScript(src: string): string {
  let out = src
  out = out.replace(/^\s*\/\*[\s\S]*?\*\//g, '')
  out = out.replace(/^\s*\/\/.*$/gm, '')
  out = out.replace(/:\s*[A-Za-z_$][\w$<>[\]|& ,\.]*?(?=\s*[=,)\{;])/g, '')
  out = out.replace(/declare\s+global\s*\{[\s\S]*?\}/g, '')
  out = out.replace(/export\s+interface\s+\w+\s*\{[\s\S]*?\}/g, '')
  out = out.replace(/export\s+interface\s+\w+[^\n]*\{[\s\S]*?\}/g, '')
  out = out.replace(/export\s+type\s+\w+[^\n;]*;/g, '')
  out = out.replace(/export\s+type\s+\w+\s*=[\s\S]*?;/g, '')
  out = out.replace(/export\s*\{\s*\}/g, '')
  out = out.replace(/\binterface\s+\w+\s*\{[\s\S]*?\}/g, '')
  out = out.replace(/\btype\s+\w+\s*=[\s\S]*?;/g, '')
  out = out.replace(/import[^;]*;/g, '')
  out = out.replace(/import[^;]*?from[^;]*;/g, '')
  out = out.replace(/import\s*type[^;]*;/g, '')
  return out
}

async function importPuppeteer(): Promise<PuppeteerModule> {
  const mod: any = await import('puppeteer')
  return mod.default ?? mod
}

/**
 * Render a Three.js SceneSpec to a silent video file. Single Puppeteer page for
 * the whole render (one renderer, one scene) for full scene continuity. Frame
 * buffers are streamed to ffmpeg's stdin via image2pipe.
 */
export async function renderThreeScene(
  spec: SceneSpec,
  opts: RenderThreeSceneOptions,
): Promise<RenderThreeSceneResult> {
  const startTime = Date.now()
  const outDir = dirname(opts.outputPath)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  let browser: PuppeteerBrowser | null = null
  let page: PuppeteerPage | null = null
  let ffmpeg: any = null
  let assetServer: { origin: string; close: () => Promise<void> } | null = null
  let timedOut = false
  const cleanup = async () => {
    try { if (ffmpeg?.stdin && !ffmpeg.stdin.destroyed) ffmpeg.stdin.end() } catch {}
    try { if (page) await page.close() } catch {}
    try { if (browser) await browser.close() } catch {}
    try { if (assetServer) await assetServer.close() } catch {}
  }

  const timeoutHandle = setTimeout(() => {
    timedOut = true
    console.error('[ThreeHost] Hard timeout reached, killing render')
    try { ffmpeg?.kill('SIGKILL') } catch {}
    try { browser?.close?.() } catch {}
  }, HARD_TIMEOUT_MS)

  try {
    const puppeteer = await importPuppeteer()
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      headless: HEADLESS_MODE,
      args: GPU_ARGS,
      defaultViewport: { width: opts.width, height: opts.height },
    })
    page = await browser.newPage()
    // Capture page console + errors for debugging script-load failures.
    page.on('console', (msg: any) => console.log(`[page:console] ${msg.text()}`))
    page.on('pageerror', (err: any) => console.log(`[page:error] ${err.message}`))
    page.on('requestfailed', (req: any) => console.log(`[page:reqfail] ${req.url()} — ${req.failure()?.errorText}`))

    // Load three.js — prefer a local static server over CDN (works offline).
    const threeLocal = loadLocalScript(THREE_LOCAL_PATH)
    if (threeLocal) {
      // Serve three.module.js (+ optional postprocessing/troika) from a tiny
      // local HTTP server so the headless page can import them as ESM with
      // proper URLs. This avoids fragile script-tag hacks and works offline.
      assetServer = await startAssetServer(spec, threeLocal)
      const html = buildPageHtml(spec, assetServer.origin)
      await page.setContent(html, { waitUntil: 'domcontentloaded' })
      // Load three as ESM + bridge to window.THREE.
      await page.addScriptTag({ url: `${assetServer.origin}/bridge.js`, type: 'module' })
    } else {
      const html = buildPageHtml(spec)
      await page.setContent(html, { waitUntil: 'domcontentloaded' })
      await page.addScriptTag({ url: THREE_CDN })
    }
    await page.evaluate(new Function('return new Promise((resolve, reject) => { const t0 = Date.now(); const check = () => { if (window.THREE) resolve(); else if (Date.now() > t0 + 30000) reject(new Error("THREE load timeout")); else setTimeout(check, 20); }; check(); })') as () => Promise<void>)

    const runtimeSrc = getSceneRuntimeSource()
    await page.addScriptTag({ content: runtimeSrc })
    await page.evaluate(new Function('return new Promise((resolve, reject) => { const check = () => { if (window.__sceneRuntime) resolve(); else if (Date.now() > globalThis.__t0 + 30000) reject(new Error("sceneRuntime init timeout")); else setTimeout(check, 20); }; globalThis.__t0 = Date.now(); check(); })') as () => Promise<void>)

    await page.evaluate(new Function('spec', 'opts', 'return window.__sceneRuntime.init(spec, opts)') as (s: SceneSpec, o: { width: number; height: number; fps: number }) => Promise<void>, spec, { width: opts.width, height: opts.height, fps: opts.fps })

    ffmpeg = spawnFfmpegVideo(opts.outputPath, opts.fps, opts.width, opts.height, opts.outputFormat)
    ffmpeg.on('error', (err: any) => { console.error('[ThreeHost] ffmpeg error:', err) })

    const ffmpegExit = new Promise<number>((resolve) => {
      ffmpeg.on('exit', (code: number) => resolve(code ?? 0))
    })

    for (let f = 0; f < opts.durationInFrames; f++) {
      if (timedOut) throw new Error('Render timed out')
      await page.evaluate(new Function('frame', 'return window.__sceneRuntime.renderFrame(frame)') as (frame: number) => void, f)
      const buf: Buffer = await page.screenshot({
        type: 'jpeg',
        quality: 95,
        clip: { x: 0, y: 0, width: opts.width, height: opts.height },
        omitBackground: false,
      })
      await new Promise<void>((resolve, reject) => {
        if (!ffmpeg.stdin || ffmpeg.stdin.destroyed) return resolve()
        ffmpeg.stdin.write(buf, (err?: Error | null) => err ? reject(err) : resolve())
      })
      if (opts.onProgress) {
        opts.onProgress((f + 1) / opts.durationInFrames)
      }
    }

    try { if (ffmpeg.stdin && !ffmpeg.stdin.destroyed) ffmpeg.stdin.end() } catch {}
    const code = await ffmpegExit
    if (code !== 0) throw new Error(`ffmpeg exited with status ${code}`)

    const renderTime = Date.now() - startTime
    return { success: true, localFilePath: opts.outputPath, renderTime }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown Three render error'
    console.error('[ThreeHost] render failed:', msg)
    return { success: false, error: msg, renderTime: Date.now() - startTime }
  } finally {
    clearTimeout(timeoutHandle)
    await cleanup()
  }
}