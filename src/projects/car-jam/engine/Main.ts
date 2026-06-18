/* ===========================================================================
 * Main.ts — initialisation, the render loop, and the game's state machine.
 *
 * Owns the three.js scene/camera/renderer, an orthographic isometric camera
 * framed for portrait, the parking platform, lighting and shadows. Drives level
 * loading (via LevelGenerator), the drag-to-slide / drive-off mechanic (via
 * Input + Grid), animation (Car + Particles) and audio (Audio). Publishes a
 * compact GameState to the React HUD through an onState callback.
 * ========================================================================= */

import * as THREE from 'three'
import { Audio } from './Audio'
import { Car, CarPool, CAR_COLORS } from './Car'
import { Grid, type MoveRange } from './Grid'
import { Input } from './Input'
import { generateLevel } from './LevelGenerator'
import { Particles } from './Particles'
import type { GameState } from './types'

const MAX_LEVEL = 100
const STORAGE_KEY = 'carjam.level'

type Drag = {
  car: Car
  axis: 'x' | 'z'
  startAlong: number
  startAnchor: number
  range: MoveRange
  escDir: number
  blockedPush: number
  bumped: boolean
}

type Action =
  | { type: 'move'; car: Car; from: number; to: number }
  | { type: 'escape'; car: Car; anchor: number }

export class Main {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private clock = new THREE.Clock()
  private raf = 0

  private audio = new Audio()
  private particles: Particles
  private pool: CarPool
  private input: Input

  private grid: Grid
  private size = 5
  private active: Car[] = []
  private escaped: Car[] = []
  private undoStack: Action[] = []

  private level = 1
  private totalCars = 0
  private status: 'playing' | 'won' = 'playing'
  private drag: Drag | null = null

  private onState: (s: GameState) => void
  private tmp = new THREE.Vector3()

  constructor(container: HTMLElement, onState: (s: GameState) => void) {
    this.container = container
    this.onState = onState

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    container.appendChild(this.renderer.domElement)
    // Size the *drawing buffer* via setSize(w,h,false); pin the *display* size
    // to the container with CSS so the canvas can't overflow on high-DPR phones
    // (without this the canvas renders at w*devicePixelRatio CSS px = 2–3x too
    // big on iPhone, spilling off-screen).
    const cv = this.renderer.domElement
    cv.style.touchAction = 'none'
    cv.style.display = 'block'
    cv.style.width = '100%'
    cv.style.height = '100%'

    this.scene = new THREE.Scene()
    this.scene.background = this.makeSkyTexture()

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    this.camera.position.set(9, 11, 9)
    this.camera.lookAt(0, 0, 0)

    this.setupLights()

    this.particles = new Particles(this.scene)
    this.pool = new CarPool(this.scene)
    this.grid = new Grid(this.size)

    this.input = new Input(this.renderer.domElement, this.camera, {
      pickables: () => this.pool.pickable,
      onGrab: (car, g) => this.onGrab(car, g),
      onDrag: (g) => this.onDrag(g),
      onRelease: () => this.onRelease(),
    })

    const saved = Number(localStorage.getItem(STORAGE_KEY))
    this.level = Number.isFinite(saved) && saved >= 1 && saved <= MAX_LEVEL ? saved : 1

    this.resize()
    this.loadLevel(this.level)
    this.loop()
  }

  // ---- scene building -----------------------------------------------------

  private makeSkyTexture(): THREE.Texture {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#2a3a64')
    grad.addColorStop(0.5, '#43507f')
    grad.addColorStop(1, '#6b6e9e')
    g.fillStyle = grad
    g.fillRect(0, 0, 16, 256)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  private setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a4358, 0.7))
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.18))

    const key = new THREE.DirectionalLight(0xfff1d8, 2.1)
    key.position.set(7, 13, 5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.bias = -0.0006
    key.shadow.normalBias = 0.02
    const cam = key.shadow.camera
    cam.near = 1
    cam.far = 50
    cam.left = -10
    cam.right = 10
    cam.top = 10
    cam.bottom = -10
    this.scene.add(key)

    const rim = new THREE.DirectionalLight(0x9db8ff, 0.5)
    rim.position.set(-8, 6, -7)
    this.scene.add(rim)
  }

  /** Build the parking platform sized to the current grid (procedural lines). */
  private platform: THREE.Group | null = null
  private buildPlatform() {
    if (this.platform) {
      this.scene.remove(this.platform)
      this.platform.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
    }
    const g = new THREE.Group()
    const N = this.size
    const pad = 0.5
    const w = N + pad * 2

    // asphalt slab
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.4, w),
      new THREE.MeshStandardMaterial({ color: 0x3b4250, roughness: 0.95, metalness: 0 }),
    )
    slab.position.y = -0.2
    slab.receiveShadow = true
    g.add(slab)

    // painted grid lines on top
    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(N, N),
      new THREE.MeshStandardMaterial({
        map: this.makeGridTexture(N),
        roughness: 0.9,
        metalness: 0,
      }),
    )
    top.rotation.x = -Math.PI / 2
    top.position.y = 0.001
    top.receiveShadow = true
    g.add(top)

    // low border curb
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.7 })
    const t = 0.18
    const h = 0.22
    const mk = (sx: number, sz: number, px: number, pz: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), curbMat)
      m.position.set(px, h / 2, pz)
      m.castShadow = true
      m.receiveShadow = true
      g.add(m)
    }
    const half = N / 2
    mk(w, t, 0, -half - t / 2)
    mk(w, t, 0, half + t / 2)
    mk(t, w, -half - t / 2, 0)
    mk(t, w, half + t / 2, 0)

    this.platform = g
    this.scene.add(g)
  }

  private makeGridTexture(N: number): THREE.Texture {
    const px = 96
    const c = document.createElement('canvas')
    c.width = c.height = px * N
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#454c5b'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    ctx.lineWidth = 4
    for (let i = 0; i <= N; i++) {
      const p = i * px
      ctx.beginPath()
      ctx.moveTo(p, 0)
      ctx.lineTo(p, c.height)
      ctx.moveTo(0, p)
      ctx.lineTo(c.width, p)
      ctx.stroke()
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }

  // ---- camera framing -----------------------------------------------------

  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.frameCamera(w, h)
  }

  private frameCamera(w: number, h: number) {
    this.camera.updateMatrixWorld()
    const view = this.camera.matrixWorldInverse
    const half = this.size / 2 + 0.6
    let maxX = 0
    let maxY = 0
    for (const sx of [-half, half])
      for (const sz of [-half, half])
        for (const sy of [0, 0.8]) {
          this.tmp.set(sx, sy, sz).applyMatrix4(view)
          maxX = Math.max(maxX, Math.abs(this.tmp.x))
          maxY = Math.max(maxY, Math.abs(this.tmp.y))
        }
    const aspect = w / h
    const FILL = 0.74 // grid fills ~74% of the limiting screen dimension
    const halfH = Math.max(maxY / FILL, maxX / FILL / aspect)
    const halfW = halfH * aspect
    this.camera.top = halfH
    this.camera.bottom = -halfH
    this.camera.left = -halfW
    this.camera.right = halfW
    this.camera.updateProjectionMatrix()
  }

  // ---- level flow ---------------------------------------------------------

  private teardown() {
    for (const c of this.active) this.pool.release(c)
    for (const c of this.escaped) this.pool.release(c)
    this.active = []
    this.escaped = []
    this.undoStack = []
    this.drag = null
  }

  loadLevel(level: number) {
    this.level = Math.max(1, Math.min(MAX_LEVEL, level))
    localStorage.setItem(STORAGE_KEY, String(this.level))
    this.teardown()

    const spec = generateLevel(this.level)
    this.size = spec.size
    this.grid = new Grid(this.size)
    this.buildPlatform()

    spec.cars.forEach((s, id) => {
      const car = this.pool.acquire(s.length)
      car.init(id, s.colorIndex, s.orient, s.anchor, s.lane, this.size)
      this.grid.occupy(id, s.length, s.orient, s.anchor, s.lane)
      this.active.push(car)
    })

    this.totalCars = this.active.length
    this.status = 'playing'
    this.frameCamera(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight,
    )
    this.emit()
  }

  restart() {
    this.loadLevel(this.level)
  }

  next() {
    if (this.level < MAX_LEVEL) this.loadLevel(this.level + 1)
  }

  toggleMute() {
    this.audio.resume()
    this.audio.toggleMute()
    this.emit()
  }

  undo() {
    const a = this.undoStack.pop()
    if (!a) return
    if (a.type === 'move') {
      this.grid.free(a.car.length, a.car.orient, a.to, a.car.lane)
      a.car.anchor = a.from
      this.grid.occupy(a.car.id, a.car.length, a.car.orient, a.from, a.car.lane)
      a.car.slideTo(a.from)
      this.audio.tick()
    } else {
      // revive an escaped car
      const i = this.escaped.indexOf(a.car)
      if (i !== -1) this.escaped.splice(i, 1)
      a.car.reviveAt(a.anchor)
      this.pool.pickable.push(a.car.body)
      this.grid.occupy(a.car.id, a.car.length, a.car.orient, a.anchor, a.car.lane)
      this.active.push(a.car)
      this.status = 'playing'
    }
    this.emit()
  }

  private emit() {
    this.onState({
      level: this.level,
      total: this.totalCars,
      remaining: this.active.length,
      status: this.status,
      muted: this.audio.muted,
      canUndo: this.undoStack.length > 0,
    })
  }

  // ---- drag state machine -------------------------------------------------

  private onGrab(car: Car, ground: THREE.Vector3) {
    if (this.status !== 'playing' || car.state !== 'idle') return
    this.audio.resume()
    this.grid.free(car.length, car.orient, car.anchor, car.lane)
    const range = this.grid.range(car.length, car.orient, car.anchor, car.lane)
    const axis: 'x' | 'z' = car.orient === 'h' ? 'x' : 'z'
    car.state = 'dragging'
    car.cancelSlide()
    this.drag = {
      car,
      axis,
      startAlong: ground[axis],
      startAnchor: car.anchor,
      range,
      escDir: 0,
      blockedPush: 0,
      bumped: false,
    }
  }

  private onDrag(ground: THREE.Vector3) {
    const d = this.drag
    if (!d) return
    const delta = ground[d.axis] - d.startAlong
    const raw = d.startAnchor + delta
    const { range, car } = d

    const lo = range.exitMin ? -car.length - 1.6 : range.min
    const hi = range.exitMax ? this.size + 1.6 : range.max
    const clamped = Math.max(lo, Math.min(hi, raw))
    car.applyWorld(clamped)

    // decide whether we're being dragged off the board
    d.escDir = 0
    if (range.exitMax && raw > range.max + 0.7) d.escDir = 1
    else if (range.exitMin && raw < range.min - 0.7) d.escDir = -1

    // bump feedback when shoving into a blocker (a side with no exit)
    let push = 0
    if (!range.exitMax && raw > range.max + 0.25) push = raw - range.max
    if (!range.exitMin && raw < range.min - 0.25) push = Math.max(push, range.min - raw)
    d.blockedPush = push
    if (push > 0.4 && !d.bumped) {
      d.bumped = true
      car.bump()
      this.audio.honk()
    } else if (push < 0.1) {
      d.bumped = false
    }
  }

  private onRelease() {
    const d = this.drag
    this.drag = null
    if (!d) return
    const { car, range } = d

    if (d.escDir !== 0) {
      // drive off the board
      const idx = this.active.indexOf(car)
      if (idx !== -1) this.active.splice(idx, 1)
      const pIdx = this.pool.pickable.indexOf(car.body)
      if (pIdx !== -1) this.pool.pickable.splice(pIdx, 1)
      this.undoStack.push({ type: 'escape', car, anchor: car.anchor })
      car.escape(d.escDir)
      this.escaped.push(car)
      this.audio.drive()
      this.emit()
      return
    }

    // settle to nearest legal cell
    const settle = Math.max(range.min, Math.min(range.max, Math.round(car.floatAnchorValue())))
    const from = d.startAnchor
    car.anchor = settle
    car.state = 'idle'
    car.slideTo(settle)
    this.grid.occupy(car.id, car.length, car.orient, settle, car.lane)
    if (settle !== from) {
      this.undoStack.push({ type: 'move', car, from, to: settle })
      this.audio.tick()
    }
    this.emit()
  }

  // ---- loop ---------------------------------------------------------------

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05)

    for (const car of this.active) car.update(dt)

    // animate escaping cars + emit exhaust, retire when fully gone
    for (let i = this.escaped.length - 1; i >= 0; i--) {
      const car = this.escaped[i]
      const gone = car.update(dt)
      if (Math.random() < 0.6) this.particles.exhaust(car.tailWorld(this.tmp))
      if (gone) {
        this.escaped.splice(i, 1)
        if (this.status === 'playing' && this.active.length === 0) this.win()
      }
    }

    this.particles.update(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private win() {
    this.status = 'won'
    this.audio.clear()
    for (let i = 0; i < 3; i++) {
      this.tmp.set((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2)
      this.particles.burst(this.tmp, CAR_COLORS[i % CAR_COLORS.length])
    }
    this.emit()
  }

  observeResize() {
    const ro = new ResizeObserver(() => this.resize())
    ro.observe(this.container)
    return ro
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.input.dispose()
    this.audio.dispose()
    this.teardown()
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.container)
      this.container.removeChild(this.renderer.domElement)
  }
}
