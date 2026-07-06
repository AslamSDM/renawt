/**
 * Deterministic, frame-stepped Three.js runtime that runs INSIDE a Puppeteer
 * page (browser context). NO React, NO R3F. The scene stays alive across all
 * frames (one renderer, one scene) for full continuity and is driven externally
 * frame-by-frame — NO requestAnimationFrame loop.
 *
 * Animation is powered exclusively by anime.js v4. Animations are created with
 * `autoplay: false` at init() time and seeked to the exact frame time on each
 * renderFrame() call, giving fully deterministic output with no dependence on
 * the anime.js engine clock or wall-clock time.
 *
 * This file is inlined into the browser page by sceneHost.ts. It must therefore
 * be plain browser code: no Node imports, no TypeScript types that depend on
 * node_modules. It attaches itself to `window.__sceneRuntime`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

type Vec3 = [number, number, number]

interface AnimValue {
  value?: number
  ease?: string
}

interface StaggerSpec {
  amount?: number
  from?: 'first' | 'center' | 'last'
  grid?: [number, number]
  jitter?: number
}

interface AnimationSpec {
  target: 'self' | 'material' | 'camera' | 'light'
  props: Record<string, any>
  duration: number
  delay?: number
  ease?: string
  loop?: boolean | number
  direction?: 'normal' | 'alternate' | 'reverse'
  stagger?: StaggerSpec
}

interface SplitTextSpec {
  mode: 'chars' | 'words' | 'lines'
  stagger: number
  from?: 'first' | 'center' | 'last'
}

interface SceneObject {
  id: string
  kind: 'plane' | 'box' | 'sphere' | 'torus' | 'icosahedron' | 'torusKnot' | 'text' | 'gltf' | 'particles' | 'group' | 'html'
  props?: any
  position?: Vec3
  rotation?: Vec3
  scale?: number | Vec3
  visible?: { startFrame: number; endFrame: number }
  animation?: AnimationSpec[]
  children?: SceneObject[]
  castShadow?: boolean
  receiveShadow?: boolean
}

interface LightSpec {
  type: 'ambient' | 'directional' | 'point' | 'spot'
  intensity: number
  color?: string
  position?: Vec3
  castShadow?: boolean
  shadowMapSize?: number
}

interface CurveRig {
  type: 'curve'
  points: Vec3[]
  closed?: boolean
  tension?: number
  fov: number
  lookAt?: Vec3
}

interface CameraRig {
  type: 'path' | 'orbit' | 'curve'
  points?: Vec3[]
  lookAt?: Vec3
  fov: number
  center?: Vec3
  radius?: number
  speed?: number
  height?: number
  closed?: boolean
  tension?: number
}

interface FogSpec {
  type: 'linear' | 'exp2'
  color: string
  near?: number
  far?: number
  density?: number
}

interface PostFX {
  bloom?: { intensity: number; threshold: number; radius: number }
  dof?: { focus: number; aperture: number; maxBlur: number }
  vignette?: { offset: number; darkness: number }
}

export interface SceneSpec {
  width: number
  height: number
  fps: number
  durationInFrames: number
  bgColor?: string
  hdri?: string
  postFX?: PostFX
  cameraRig?: CameraRig
  lights?: LightSpec[]
  objects: SceneObject[]
  fog?: FogSpec
  shadows?: boolean
}

interface RuntimeOptions {
  width: number
  height: number
  fps: number
}

interface RegisteredObject {
  id: string
  object3D: any
  /** anime.js animations (autoplay:false) created at init. */
  animations: any[]
  visible?: { startFrame: number; endFrame: number }
}

declare global {
  interface Window {
    __sceneRuntime?: SceneRuntime
    THREE?: any
    anime?: any
    animeThree?: any
  }
}

/**
 * Convert an AnimationSpec props map + options into anime.js parameters.
 * Anime.js v4 accepts [from, to] pairs as `name: [from, to]` and { value, ease }
 * per-key overrides. Durations are in ms when timeUnit is ms (default).
 */
function toAnimeParams(spec: AnimationSpec, fps: number): any {
  const ms = (s: number) => Math.round(s * 1000)
  const params: any = {
    duration: ms(spec.duration),
    autoplay: false,
  }
  if (spec.delay !== undefined) params.delay = ms(spec.delay)
  if (spec.ease) params.ease = spec.ease
  if (spec.loop !== undefined) params.loop = spec.loop
  if (spec.direction) params.direction = spec.direction
  // Normalize prop values: { value, ease } -> anime's per-key form.
  for (const key of Object.keys(spec.props)) {
    const v = spec.props[key]
    if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in (v as any)) {
      const obj: any = { value: (v as any).value }
      if ((v as any).ease) obj.ease = (v as any).ease
      params[key] = obj
    } else {
      params[key] = v
    }
  }
  if (spec.stagger) {
    const s = spec.stagger
    // stagger() returns a function used as delay value in anime params.
    // We surface it on __stagger so buildAnimations can wrap with the adapter.
    ;(params as any).__stagger = s
  }
  return params
}

class SceneRuntime {
  private THREE: any
  private renderer: any
  private scene: any
  private camera: any
  private opts: RuntimeOptions = { width: 1920, height: 1080, fps: 30 }
  private spec: SceneSpec | null = null
  private registry: RegisteredObject[] = []
  private cameraLookAt: Vec3 | null = null
  private postComposer: any = null
  private pmremGenerator: any = null
  private pathPoints: any[] = []
  private orbitCenter: Vec3 = [0, 0, 0]
  private orbitRadius = 10
  private orbitSpeed = 0.2
  private orbitHeight = 5
  private curve: any = null
  private curveClosed = false
  private curveLookAt: Vec3 | null = null
  // CSS3D layer
  private cssRenderer: any = null
  private cssScene: any = null
  // anime.js handle
  private anime: any = null

  async init(spec: SceneSpec, opts: RuntimeOptions): Promise<void> {
    const THREE = (window as any).THREE
    if (!THREE) throw new Error('THREE is not loaded on window')
    this.THREE = THREE
    this.spec = spec
    this.opts = opts

    // Load anime.js + three adapter (registers three property resolvers).
    await this.loadAnime().catch((e) => {
      console.warn('[SceneRuntime] anime.js load failed:', e)
    })

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(opts.width, opts.height, false)
    renderer.setPixelRatio(1)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    if (spec.shadows) {
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }
    if (spec.bgColor) {
      renderer.setClearColor(new THREE.Color(spec.bgColor), 1)
    }
    const canvas = renderer.domElement
    canvas.style.width = opts.width + 'px'
    canvas.style.height = opts.height + 'px'
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    document.body.style.margin = '0'
    document.body.style.overflow = 'hidden'
    document.body.appendChild(canvas)
    this.renderer = renderer

    const scene = new THREE.Scene()
    if (spec.bgColor) scene.background = new THREE.Color(spec.bgColor)
    // Fog
    if (spec.fog) {
      const fog = spec.fog
      if (fog.type === 'linear') {
        scene.fog = new THREE.Fog(new THREE.Color(fog.color), fog.near ?? 1, fog.far ?? 1000)
      } else if (fog.type === 'exp2') {
        scene.fog = new THREE.FogExp2(new THREE.Color(fog.color), fog.density ?? 0.025)
      }
    }
    this.scene = scene

    const aspect = opts.width / opts.height
    const fov = spec.cameraRig?.fov ?? 50
    const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000)
    camera.position.set(0, 5, 10)
    scene.add(camera)
    this.camera = camera

    if (spec.cameraRig) {
      const rig = spec.cameraRig
      if (rig.type === 'path' && rig.points) {
        this.pathPoints = rig.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
        this.cameraLookAt = rig.lookAt ?? null
      } else if (rig.type === 'orbit') {
        this.orbitCenter = rig.center ?? [0, 0, 0]
        this.orbitRadius = rig.radius ?? 10
        this.orbitSpeed = rig.speed ?? 0.2
        this.orbitHeight = rig.height ?? 5
        this.cameraLookAt = this.orbitCenter
      } else if (rig.type === 'curve' && rig.points && rig.points.length >= 2) {
        const pts = rig.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
        this.curve = new THREE.CatmullRomCurve3(
          pts,
          rig.closed ?? false,
          'catmullrom',
          rig.tension ?? 0.5,
        )
        this.curveClosed = rig.closed ?? false
        this.curveLookAt = rig.lookAt ?? null
      }
    }

    if (spec.lights) {
      for (const l of spec.lights) {
        let light: any
        switch (l.type) {
          case 'ambient':
            light = new THREE.AmbientLight(l.color ? new THREE.Color(l.color) : 0xffffff, l.intensity)
            break
          case 'directional':
            light = new THREE.DirectionalLight(l.color ? new THREE.Color(l.color) : 0xffffff, l.intensity)
            break
          case 'point':
            light = new THREE.PointLight(l.color ? new THREE.Color(l.color) : 0xffffff, l.intensity)
            break
          case 'spot':
            light = new THREE.SpotLight(l.color ? new THREE.Color(l.color) : 0xffffff, l.intensity)
            break
          default:
            continue
        }
        if (l.position) light.position.set(l.position[0], l.position[1], l.position[2])
        if (spec.shadows && l.castShadow && light.castShadow !== undefined) {
          light.castShadow = true
          const size = l.shadowMapSize ?? 1024
          if (light.shadow?.mapSize?.set) light.shadow.mapSize.set(size, size)
          if (light.shadow?.camera) {
            // Reasonable defaults; can be tuned via light spec later.
            const sc = light.shadow.camera
            if (sc.near !== undefined) sc.near = 0.5
            if (sc.far !== undefined) sc.far = 500
            if (sc.left !== undefined) {
              sc.left = -50
              sc.right = 50
              sc.top = 50
              sc.bottom = -50
            }
          }
        }
        scene.add(light)
      }
    } else {
      scene.add(new THREE.AmbientLight(0xffffff, 0.6))
      const dir = new THREE.DirectionalLight(0xffffff, 1)
      dir.position.set(5, 10, 7)
      if (spec.shadows) {
        dir.castShadow = true
        if (dir.shadow?.mapSize?.set) dir.shadow.mapSize.set(1024, 1024)
      }
      scene.add(dir)
    }

    if (spec.hdri) {
      await this.loadHdri(spec.hdri).catch((e) => {
        console.warn('[SceneRuntime] HDRI load failed, falling back to gradient:', e)
      })
    }

    if (spec.postFX) {
      await this.setupPostFX(spec.postFX).catch((e) => {
        console.warn('[SceneRuntime] postprocessing setup failed:', e)
      })
    }

    // CSS3D layer is created lazily if any html objects exist.
    const usesCss3d = this.specUsesCss3d(spec)
    if (usesCss3d) {
      await this.setupCss3d().catch((e) => {
        console.warn('[SceneRuntime] CSS3DRenderer setup failed:', e)
      })
    }

    for (const objSpec of spec.objects) {
      const built = await this.buildObject(objSpec).catch((e) => {
        console.warn(`[SceneRuntime] Failed to build object ${objSpec.id}:`, e)
        return null
      })
      if (!built) continue
      // html objects go to cssScene; everything else to the WebGL scene.
      if (objSpec.kind === 'html' && this.cssScene) {
        this.cssScene.add(built)
      } else {
        scene.add(built)
      }
      this.registry.push({
        id: objSpec.id,
        object3D: built,
        animations: [],
        visible: objSpec.visible,
      })
      await this.buildAnimations(objSpec, built)
    }
  }

  private specUsesCss3d(spec: SceneSpec): boolean {
    const walk = (objs: SceneObject[]): boolean => {
      for (const o of objs) {
        if (o.kind === 'html') return true
        if (o.children && walk(o.children)) return true
      }
      return false
    }
    return walk(spec.objects)
  }

  private async loadAnime(): Promise<void> {
    if ((window as any).anime && (window as any).animeThree) {
      this.anime = (window as any).anime
      return
    }
    try {
      const mod: any = await (window as any).import('animejs')
      this.anime = mod
      ;(window as any).anime = mod
      // three adapter import has a side-effect: registers resolvers.
      const adapterMod: any = await (window as any).import('animejs/adapters/three')
      ;(window as any).animeThree = adapterMod
    } catch (e) {
      console.warn('[SceneRuntime] anime import failed:', e)
    }
  }

  private async setupCss3d(): Promise<void> {
    const THREE = this.THREE
    let CSS3DRenderer: any
    try {
      const mod: any = await (window as any).import('three/addons/renderers/CSS3DRenderer.js')
      CSS3DRenderer = mod.CSS3DRenderer ?? mod.default?.CSS3DRenderer ?? mod.default
    } catch (e) {
      console.warn('[SceneRuntime] CSS3DRenderer import failed:', e)
      return
    }
    if (!CSS3DRenderer) return
    const cssRenderer = new CSS3DRenderer()
    cssRenderer.setSize(this.opts.width, this.opts.height)
    const dom = cssRenderer.domElement
    dom.style.position = 'absolute'
    dom.style.top = '0'
    dom.style.left = '0'
    dom.style.pointerEvents = 'none'
    document.body.appendChild(dom)
    this.cssRenderer = cssRenderer
    this.cssScene = new THREE.Scene()
  }

  private async loadHdri(url: string): Promise<void> {
    const THREE = this.THREE
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer)
      pmrem.compileEquirectangularShader()
      this.pmremGenerator = pmrem
      const loader: any = await this.dynamicLoadModule('three/addons/loaders/RGBELoader.js', 'RGBELoader')
      if (!loader) return
      const rgbe = new loader()
      const tex: any = await new Promise((resolve, reject) => {
        rgbe.load(url, resolve, undefined, reject)
      })
      const envMap = pmrem.fromEquirectangular(tex).texture
      this.scene.environment = envMap
      this.scene.background = envMap
      tex.dispose()
    } catch (e) {
      console.warn('[SceneRuntime] HDRI error:', e)
    }
  }

  private async dynamicLoadModule(moduleUrl: string, _exportName: string): Promise<any> {
    try {
      const mod: any = await (window as any).import(/* @vite-ignore */ moduleUrl)
      return mod?.default ?? mod
    } catch {
      return null
    }
  }

  private async setupPostFX(fx: PostFX): Promise<void> {
    try {
      const mod: any = await (window as any).import('postprocessing')
      const post = mod.postprocessing ?? mod
      const composer = new post.EffectComposer(this.renderer)
      const passes: any[] = []
      passes.push(new post.RenderPass(this.scene, this.camera))
      if (fx.bloom) {
        const bloom = new post.BloomEffect({
          intensity: fx.bloom.intensity,
          luminanceThreshold: fx.bloom.threshold,
          luminanceSmoothing: 0.025,
          kernelSize: 2,
        })
        passes.push(new post.EffectPass(this.camera, bloom))
      }
      if (fx.dof) {
        const dof = new post.DepthOfFieldEffect(this.camera, {
          focusDistance: fx.dof.focus,
          focalLength: 0.05,
          bokehScale: fx.dof.aperture,
        })
        passes.push(new post.EffectPass(this.camera, dof))
      }
      if (fx.vignette) {
        const vig = new post.VignetteEffect({ offset: fx.vignette.offset, darkness: fx.vignette.darkness })
        passes.push(new post.EffectPass(this.camera, vig))
      }
      for (const p of passes) composer.addPass(p)
      this.postComposer = composer
    } catch (e) {
      console.warn('[SceneRuntime] postprocessing load failed, skipping:', e)
    }
  }

  private async buildObject(spec: SceneObject): Promise<any> {
    const THREE = this.THREE
    const props = spec.props || {}
    let mesh: any

    switch (spec.kind) {
      case 'plane': {
        const args = props.args || [props.width ?? 1, props.height ?? 1]
        const geo = new THREE.PlaneGeometry(args[0], args[1])
        mesh = new THREE.Mesh(geo, await this.makeMaterial(props))
        break
      }
      case 'box': {
        const args = props.args || [props.width ?? 1, props.height ?? 1, props.depth ?? 1]
        const geo = new THREE.BoxGeometry(args[0], args[1], args[2])
        mesh = new THREE.Mesh(geo, await this.makeMaterial(props))
        break
      }
      case 'sphere': {
        const args = props.args || [props.radius ?? 1, props.widthSegments ?? 32, props.heightSegments ?? 16]
        const geo = new THREE.SphereGeometry(args[0], args[1], args[2])
        mesh = new THREE.Mesh(geo, await this.makeMaterial(props))
        break
      }
      case 'torus': {
        const args = props.args || [props.radius ?? 1, props.tube ?? 0.4, props.radialSegments ?? 16, props.tubularSegments ?? 64]
        const geo = new THREE.TorusGeometry(args[0], args[1], args[2], args[3])
        mesh = new THREE.Mesh(geo, await this.makeMaterial(props))
        break
      }
      case 'icosahedron': {
        const args = props.args || [props.radius ?? 1, props.detail ?? 0]
        const geo = new THREE.IcosahedronGeometry(args[0], args[1])
        mesh = new THREE.Mesh(geo, await this.makeMaterial(props))
        break
      }
      case 'torusKnot': {
        const args = props.args || [props.radius ?? 1, props.tube ?? 0.4, props.tubularSegments ?? 64, props.radialSegments ?? 16]
        const geo = new THREE.TorusKnotGeometry(args[0], args[1], args[2], args[3])
        mesh = new THREE.Mesh(geo, await this.makeMaterial(props))
        break
      }
      case 'text': {
        mesh = await this.buildText(props)
        break
      }
      case 'gltf': {
        mesh = await this.loadGltf(props.src)
        break
      }
      case 'particles': {
        mesh = this.buildParticles(props)
        break
      }
      case 'group': {
        mesh = new THREE.Group()
        break
      }
      case 'html': {
        mesh = await this.buildHtmlObject(props)
        break
      }
      default:
        return null
    }

    if (spec.position) mesh.position.set(spec.position[0], spec.position[1], spec.position[2])
    if (spec.rotation) mesh.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2])
    if (spec.scale !== undefined) {
      if (typeof spec.scale === 'number') mesh.scale.setScalar(spec.scale)
      else mesh.scale.set(spec.scale[0], spec.scale[1], spec.scale[2])
    }
    // Shadows (WebGL meshes only — html/CSS3D objects have no shadow API).
    if (this.spec?.shadows && mesh.isObject3D && spec.kind !== 'html') {
      if (spec.castShadow) mesh.castShadow = true
      if (spec.receiveShadow) mesh.receiveShadow = true
    }

    // Children attach to any parent kind (plane-with-text, group, etc.).
    if (spec.children && spec.children.length > 0) {
      for (const childSpec of spec.children) {
        const child = await this.buildObject(childSpec).catch((e) => {
          console.warn(`[SceneRuntime] Failed to build child ${childSpec.id}:`, e)
          return null
        })
        if (!child) continue
        // html children render in CSS layer too; a WebGL parent can still
        // host an html child in the cssScene (positioning is world-space).
        if (childSpec.kind === 'html' && this.cssScene) {
          this.cssScene.add(child)
        } else {
          mesh.add(child)
        }
        this.registry.push({
          id: childSpec.id,
          object3D: child,
          animations: [],
          visible: childSpec.visible,
        })
        await this.buildAnimations(childSpec, child)
      }
    }
    return mesh
  }

  private async buildAnimations(spec: SceneObject, obj: any): Promise<void> {
    if (!spec.animation || spec.animation.length === 0) return
    const anime = this.anime
    if (!anime || !anime.animate) {
      console.warn('[SceneRuntime] anime.js not loaded; skipping animations for', spec.id)
      return
    }
    const reg = this.registry.find((r) => r.object3D === obj)
    if (!reg) return
    for (const animSpec of spec.animation) {
      const target = this.resolveAnimTarget(animSpec.target, obj)
      if (!target) continue
      const params = toAnimeParams(animSpec, this.opts.fps)
      // Apply stagger as a delay function if requested.
      if (animSpec.stagger && anime.stagger) {
        const s = animSpec.stagger
        const staggerParams: any = {}
        if (s.from) staggerParams.from = s.from
        if (s.grid) staggerParams.grid = s.grid
        if (s.jitter !== undefined) staggerParams.jitter = s.jitter
        const amount = s.amount ?? 50
        // stagger is applied per-target-element; for single Object3D targets
        // it has no effect, but works for arrays (e.g. splitText chars).
        params.delay = anime.stagger(amount, staggerParams)
      }
      try {
        const anim = anime.animate(target, params)
        reg.animations.push(anim)
      } catch (e) {
        console.warn(`[SceneRuntime] anime.animate failed for ${spec.id}:`, e)
      }
    }
  }

  private resolveAnimTarget(target: string, obj: any): any {
    switch (target) {
      case 'material':
        return obj.material ?? null
      case 'camera':
        return this.camera
      case 'light':
        return obj.isLight ? obj : (obj.children?.find?.((c: any) => c.isLight) ?? null)
      case 'self':
      default:
        return obj
    }
  }

  private async makeMaterial(props: any): Promise<any> {
    const THREE = this.THREE
    const matOpts: any = {
      color: props.color ? new THREE.Color(props.color) : 0xffffff,
      roughness: props.roughness ?? 1,
      metalness: props.metalness ?? 0,
    }
    if (props.emissive) matOpts.emissive = new THREE.Color(props.emissive)
    if (props.emissiveIntensity !== undefined) matOpts.emissiveIntensity = props.emissiveIntensity
    if (props.transparent !== undefined) matOpts.transparent = props.transparent
    if (props.opacity !== undefined) matOpts.opacity = props.opacity
    if (props.side !== undefined) matOpts.side = props.side
    if (props.src) {
      try {
        const loader = new THREE.TextureLoader()
        const tex: any = await new Promise((resolve, reject) => {
          loader.load(props.src, resolve, undefined, reject)
        })
        matOpts.map = tex
      } catch (e) {
        console.warn('[SceneRuntime] texture load failed:', e)
      }
    }
    return new THREE.MeshStandardMaterial(matOpts)
  }

  private async buildText(props: any): Promise<any> {
    try {
      const mod: any = await (window as any).import('troika-three-text')
      const TroikaText = mod.Text ?? mod.default?.Text ?? mod.default
      const text = new TroikaText()
      text.text = props.text ?? ''
      if (props.font !== undefined) text.font = props.font
      text.fontSize = props.fontSize ?? 1
      text.color = props.color ?? 0xffffff
      if (props.letterSpacing !== undefined) text.letterSpacing = props.letterSpacing
      if (props.lineHeight !== undefined) text.lineHeight = props.lineHeight
      if (props.textAlign !== undefined) text.textAlign = props.textAlign
      text.anchorX = props.anchorX ?? 'center'
      text.anchorY = props.anchorY ?? 'middle'
      if (props.maxWidth !== undefined) text.maxWidth = props.maxWidth
      if (props.whiteSpace !== undefined) text.whiteSpace = props.whiteSpace
      if (props.outlineWidth !== undefined) text.outlineWidth = props.outlineWidth
      if (props.outlineColor !== undefined) text.outlineColor = props.outlineColor
      if (props.strokeWidth !== undefined) text.strokeWidth = props.strokeWidth
      if (props.strokeColor !== undefined) text.strokeColor = props.strokeColor
      if (props.curveRadius !== undefined) text.curveRadius = props.curveRadius
      if (props.depthOffset !== undefined) text.depthOffset = props.depthOffset
      if (props.direction !== undefined) text.direction = props.direction
      text.sync()
      return text
    } catch (e) {
      console.warn('[SceneRuntime] troika-three-text load failed:', e)
      const THREE = this.THREE
      const fallback = new THREE.Group()
      return fallback
    }
  }

  private async loadGltf(src: string): Promise<any> {
    try {
      const mod: any = await (window as any).import('three/addons/loaders/GLTFLoader.js')
      const GLTFLoader = mod.GLTFLoader ?? mod.default?.GLTFLoader ?? mod.default
      const loader = new GLTFLoader()
      const gltf: any = await new Promise((resolve, reject) => {
        loader.load(src, resolve, undefined, reject)
      })
      return gltf.scene ?? gltf.scenes?.[0] ?? new this.THREE.Group()
    } catch (e) {
      console.warn('[SceneRuntime] glTF load failed:', e)
      return new this.THREE.Group()
    }
  }

  private buildParticles(props: any): any {
    const THREE = this.THREE
    const count = props.count ?? 1000
    const spread = props.spread ?? 10
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * spread
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: props.color ? new THREE.Color(props.color) : 0xffffff,
      size: props.size ?? 0.1,
      sizeAttenuation: true,
    })
    const pts = new THREE.Points(geo, mat)
    ;(pts as any).__driftSpeed = props.driftSpeed ?? 0.01
    return pts
  }

  private async buildHtmlObject(props: any): Promise<any> {
    const THREE = this.THREE
    const CSS3DObject = await this.getCss3dObjectCtor()
    if (!CSS3DObject) {
      console.warn('[SceneRuntime] CSS3DObject unavailable; html object skipped')
      return new THREE.Group()
    }
    const div = document.createElement('div')
    const w = props.width ?? 320
    const h = props.height ?? 240
    div.style.width = w + 'px'
    div.style.height = h + 'px'
    div.style.boxSizing = 'border-box'
    div.style.overflow = 'hidden'
    if (props.html !== undefined) div.innerHTML = props.html
    // Scope injected CSS by a unique class so multiple html objects don't clash.
    const scopeClass = 'css3d-' + Math.random().toString(36).slice(2, 10)
    div.classList.add(scopeClass)
    if (props.css) {
      const style = document.createElement('style')
      // Naively scope rules by prefixing selectors with the class.
      style.textContent = this.scopeCss(props.css, '.' + scopeClass)
      div.appendChild(style)
    }
    const obj = new CSS3DObject(div)
    ;(obj as any).__htmlEl = div

    // Optional per-char/word/line split text animation.
    if (props.splitText && this.anime?.splitText) {
      try {
        const sp = props.splitText as SplitTextSpec
        const result = this.anime.splitText(div, { mode: sp.mode })
        const segments = (result.chars && result.chars.length > 0)
          ? result.chars
          : (result.words && result.words.length > 0)
            ? result.words
            : (result.lines && result.lines.length > 0)
              ? result.lines
              : []
        ;(obj as any).__splitSegments = segments
        ;(obj as any).__splitSpec = sp
      } catch (e) {
        console.warn('[SceneRuntime] splitText failed:', e)
      }
    }
    return obj
  }

  private async getCss3dObjectCtor(): Promise<any> {
    try {
      const mod: any = await (window as any).import('three/addons/renderers/CSS3DRenderer.js')
      return mod.CSS3DObject ?? mod.default?.CSS3DObject ?? mod.CSS3DObject
    } catch (e) {
      console.warn('[SceneRuntime] CSS3DObject import failed:', e)
      return null
    }
  }

  /** Prefix every selector in a CSS string with a scope class. */
  private scopeCss(css: string, scope: string): string {
    return css.replace(/([^^{}]+)(\{)/g, (_m: string, sel: string, brace: string) => {
      const selectors = sel.split(',').map((s) => {
        const t = s.trim()
        if (!t) return t
        // Avoid double-prefixing and handle @-rules minimally.
        if (t.startsWith(scope) || t.startsWith('@')) return t
        return scope + ' ' + t
      })
      return selectors.join(', ') + brace
    })
  }

  renderFrame(frame: number): void {
    const THREE = this.THREE
    if (!this.spec || !this.scene || !this.camera || !this.renderer) return

    this.updateCamera(frame)

    // Seek all anime.js animations to the exact frame time (ms).
    const timeMs = (frame / this.opts.fps) * 1000
    for (const reg of this.registry) {
      const obj = reg.object3D
      if (reg.visible) {
        obj.visible = frame >= reg.visible.startFrame && frame < reg.visible.endFrame
      }
      if (reg.animations) {
        for (const anim of reg.animations) {
          try {
            anim.seek(timeMs)
          } catch (e) {
            // ignore single-frame seek errors
          }
        }
      }
      // Particle drift (legacy procedural motion not covered by anime).
      if ((obj as any).isPoints && (obj as any).__driftSpeed) {
        const pos = obj.geometry.attributes.position as any
        const speed = (obj as any).__driftSpeed
        for (let i = 0; i < pos.count; i++) {
          pos.array[i * 3 + 1] += speed * 0.01
          if (pos.array[i * 3 + 1] > 5) pos.array[i * 3 + 1] = -5
        }
        pos.needsUpdate = true
      }
      // HTML split-text segment animation: drive via anime on segments.
      if ((obj as any).__splitSegments) {
        this.driveSplitText(obj, frame)
      }
    }

    if (this.postComposer) {
      this.postComposer.render()
    } else {
      this.renderer.render(this.scene, this.camera)
    }
    if (this.cssRenderer && this.cssScene) {
      this.cssRenderer.render(this.cssScene, this.camera)
    }
  }

  private driveSplitText(obj: any, _frame: number): void {
    const anime = this.anime
    if (!anime?.animate) return
    if (!obj.__splitAnim) {
      const sp: SplitTextSpec = obj.__splitSpec
      const segs = obj.__splitSegments
      if (!segs || segs.length === 0) return
      try {
        const anim = anime.animate(segs, {
          y: [20, 0],
          opacity: [0, 1],
          duration: 600,
          delay: anime.stagger(sp.stagger, sp.from ? { from: sp.from } : {}),
          ease: 'outSine',
          autoplay: false,
        })
        obj.__splitAnim = anim
      } catch (e) {
        console.warn('[SceneRuntime] splitText animate failed:', e)
        return
      }
    }
    const timeMs = (_frame / this.opts.fps) * 1000
    try {
      obj.__splitAnim.seek(timeMs)
    } catch {
      // ignore
    }
  }

  private updateCamera(frame: number): void {
    const THREE = this.THREE
    const spec = this.spec!
    const total = spec.durationInFrames > 0 ? spec.durationInFrames : 1
    const t = frame / total
    const cam = this.camera
    if (spec.cameraRig?.type === 'path' && this.pathPoints.length > 0) {
      const idx = t * (this.pathPoints.length - 1)
      const i0 = Math.floor(idx)
      const i1 = Math.min(i0 + 1, this.pathPoints.length - 1)
      const f = idx - i0
      const p0 = this.pathPoints[i0]
      const p1 = this.pathPoints[i1]
      cam.position.lerpVectors(p0, p1, f)
      if (this.cameraLookAt) {
        cam.lookAt(new THREE.Vector3(this.cameraLookAt[0], this.cameraLookAt[1], this.cameraLookAt[2]))
      }
    } else if (spec.cameraRig?.type === 'orbit') {
      const angle = t * Math.PI * 2 * (this.orbitSpeed * 5)
      cam.position.set(
        this.orbitCenter[0] + Math.cos(angle) * this.orbitRadius,
        this.orbitCenter[1] + this.orbitHeight,
        this.orbitCenter[2] + Math.sin(angle) * this.orbitRadius,
      )
      cam.lookAt(new THREE.Vector3(this.orbitCenter[0], this.orbitCenter[1], this.orbitCenter[2]))
    } else if (spec.cameraRig?.type === 'curve' && this.curve) {
      const tt = this.curveClosed ? t % 1 : Math.min(t, 1)
      const pos = this.curve.getPointAt(tt)
      cam.position.copy(pos)
      if (this.curveLookAt) {
        cam.lookAt(new THREE.Vector3(this.curveLookAt[0], this.curveLookAt[1], this.curveLookAt[2]))
      } else {
        const tangent = this.curve.getTangentAt(tt)
        cam.lookAt(pos.clone().add(tangent))
      }
    }
  }

  dispose(): void {
    try {
      this.pmremGenerator?.dispose?.()
      this.renderer?.dispose?.()
      this.scene?.traverse?.((o: any) => {
        if (o.geometry?.dispose) o.geometry.dispose()
        if (o.material?.dispose) o.material.dispose()
      })
      const dom = this.cssRenderer?.domElement
      if (dom && dom.parentNode) dom.parentNode.removeChild(dom)
    } catch (e) {
      console.warn('[SceneRuntime] dispose error:', e)
    }
  }
}

declare const window: Window & typeof globalThis

if (typeof window !== 'undefined') {
  const runtime = new SceneRuntime()
  ;(window as any).__sceneRuntime = runtime
}

export {}