/* ===========================================================================
 * Main.ts — scene/camera/loop + the slide-out + boarding game state machine.
 *
 * Top-down portrait layout (top → bottom):
 *   • reserved empty strip — full cars drive UP through here and off-screen
 *   • boarding bays (a horizontal row)
 *   • the jammed parking lot: a grid of different-sized cars, some horizontal
 *     (exit left) and some vertical (exit up)
 *   • a horizontal queue of colour-coded passengers
 *
 * Tap a car to slide it out along its axis — if another car blocks the lane it
 * can't move (collision). A freed car routes to an open bay; passengers at the
 * front of the queue hop aboard a colour-matched bay car, and a full car drives
 * straight up and off. Bays are spaced so the parallel up-exits never overlap.
 * Clear the queue to win.
 * ========================================================================= */

import * as THREE from 'three'
import { Audio } from './Audio'
import { generateLevel } from './LevelGenerator'
import { Input } from './Input'
import { Particles } from './Particles'
import { Person, PersonPool } from './Person'
import type { GameState } from './types'
import { Vehicle, VehiclePool, CAR_COLORS, CELL } from './Vehicle'

const MAX_LEVEL = 100
const STORAGE_KEY = 'carjam.level'
const QUEUE_GAP = 0.8
const VISIBLE = 8
// Lay out / scale the scene as if up to this many boarding bays exist, so the
// view doesn't have to re-scale when more bays are added later.
const PLANNED_BAYS = 6
const BAY_PITCH = CELL * 1.12 // bay spacing; > a car's (face-up) width

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }

export class Main {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.OrthographicCamera
  private clock = new THREE.Clock()
  private raf = 0

  private audio = new Audio()
  private particles: Particles
  private vehicles: VehiclePool
  private people: PersonPool
  private input: Input

  private level = 1
  private cols = 4
  private rows = 4

  private grid: Int16Array = new Int16Array(0)
  private lot: Vehicle[] = []
  private bays: (Vehicle | null)[] = []
  private bayX: number[] = []
  private bayZ = 0
  private moving: Vehicle[] = []

  private queueColors: number[] = []
  private boarded = 0
  private queue: Person[] = []
  private activePeople: Person[] = []
  private queueZ = 0

  private status: 'playing' | 'won' | 'stuck' = 'playing'
  private onState: (s: GameState) => void
  private tmp = new THREE.Vector3()
  private platform: THREE.Group | null = null

  constructor(container: HTMLElement, onState: (s: GameState) => void) {
    this.container = container
    this.onState = onState

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    container.appendChild(this.renderer.domElement)
    const cv = this.renderer.domElement
    cv.style.touchAction = 'none'
    cv.style.display = 'block'
    cv.style.width = '100%'
    cv.style.height = '100%'

    this.scene = new THREE.Scene()
    this.scene.background = this.makeSky()
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)

    this.setupLights()
    this.particles = new Particles(this.scene)
    this.vehicles = new VehiclePool(this.scene)
    this.people = new PersonPool(this.scene)
    this.input = new Input(cv, this.camera, () => this.vehicles.pickable, (v) => this.onTap(v))

    const saved = Number(localStorage.getItem(STORAGE_KEY))
    this.level = Number.isFinite(saved) && saved >= 1 && saved <= MAX_LEVEL ? saved : 1

    this.loadLevel(this.level)
    this.resize()
    this.loop()
  }

  // ---- coordinate helpers -------------------------------------------------

  private cellX(c: number) {
    return (c - (this.cols - 1) / 2) * CELL
  }
  private cellZ(r: number) {
    return (r - (this.rows - 1) / 2) * CELL
  }
  private leftEdge() {
    return this.cellX(0) - CELL / 2
  }
  private topEdge() {
    return this.cellZ(0) - CELL / 2
  }
  private bottomEdge() {
    return this.cellZ(this.rows - 1) + CELL / 2
  }
  private carWorld(v: { orient: 'h' | 'v'; length: number; anchor: number; lane: number }): [number, number] {
    const cc = v.anchor + (v.length - 1) / 2
    return v.orient === 'h' ? [this.cellX(cc), this.cellZ(v.lane)] : [this.cellX(v.lane), this.cellZ(cc)]
  }
  private queueSpot(i: number): [number, number] {
    const x0 = -((VISIBLE - 1) * QUEUE_GAP) / 2
    return [x0 + i * QUEUE_GAP, this.queueZ]
  }

  // ---- scene dressing -----------------------------------------------------

  private makeSky(): THREE.Texture {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#2a3a64')
    grad.addColorStop(0.55, '#46527f')
    grad.addColorStop(1, '#717499')
    g.fillStyle = grad
    g.fillRect(0, 0, 16, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }

  private setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a4358, 0.78))
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.16))
    const key = new THREE.DirectionalLight(0xfff1d8, 2.1)
    key.position.set(5, 16, 8)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.bias = -0.0006
    key.shadow.normalBias = 0.02
    const cam = key.shadow.camera
    cam.near = 1
    cam.far = 80
    cam.left = -18
    cam.right = 18
    cam.top = 18
    cam.bottom = -18
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x9db8ff, 0.5)
    rim.position.set(-8, 6, -2)
    this.scene.add(rim)
  }

  private bounds(): Bounds {
    // Reserve width for the planned max bay row so the scale is future-proof.
    const half = Math.max(
      (PLANNED_BAYS / 2) * BAY_PITCH,
      (this.cols * CELL) / 2,
      ((VISIBLE - 1) * QUEUE_GAP) / 2,
    )
    return {
      minX: -half - 0.5,
      maxX: half + 0.5,
      minZ: this.bayZ - 1.9, // room for a face-up bus standing in a bay
      maxZ: this.queueZ + 0.8,
    }
  }
  private center(b: Bounds) {
    return new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2)
  }

  private buildPlatform() {
    if (this.platform) {
      this.scene.remove(this.platform)
      this.platform.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
      })
    }
    const g = new THREE.Group()
    const b = this.bounds()
    const c = this.center(b)
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(b.maxX - b.minX + 0.6, 0.4, b.maxZ - b.minZ + 0.6),
      new THREE.MeshStandardMaterial({ color: 0x3c4458, roughness: 0.97 }),
    )
    slab.position.set(c.x, -0.2, c.z)
    slab.receiveShadow = true
    g.add(slab)

    const padMat = new THREE.MeshStandardMaterial({ color: 0x5b6479, roughness: 0.9 })
    for (const sx of this.bayX) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(CELL * 1.1, 0.06, CELL * 1.1), padMat)
      pad.position.set(sx, 0.02, this.bayZ)
      pad.receiveShadow = true
      g.add(pad)
    }
    this.platform = g
    this.scene.add(g)
  }

  // ---- camera framing -----------------------------------------------------

  private positionCamera() {
    const c = this.center(this.bounds())
    // gentle quarter view (~55° elevation): tilted enough to read each car's
    // shape/height, but with no X offset so the lot stays an axis-aligned
    // rectangle (no isometric left/right skew).
    this.camera.position.set(c.x, 13, c.z + 9)
    this.camera.lookAt(c.x, 0, c.z)
    this.camera.updateMatrixWorld()
  }

  private resize = () => {
    const w = this.container.clientWidth || window.innerWidth
    const h = this.container.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.frameCamera(w, h)
  }

  private frameCamera(w: number, h: number) {
    this.positionCamera()
    const view = this.camera.matrixWorldInverse
    const b = this.bounds()
    let mx = 0
    let my = 0
    for (const x of [b.minX, b.maxX])
      for (const z of [b.minZ, b.maxZ])
        for (const y of [0, 1.0]) {
          this.tmp.set(x, y, z).applyMatrix4(view)
          mx = Math.max(mx, Math.abs(this.tmp.x))
          my = Math.max(my, Math.abs(this.tmp.y))
        }
    const aspect = w / h
    const FILL = 0.95
    const halfH = Math.max(my / FILL, mx / FILL / aspect)
    this.camera.top = halfH
    this.camera.bottom = -halfH
    this.camera.left = -halfH * aspect
    this.camera.right = halfH * aspect
    this.camera.updateProjectionMatrix()
  }

  // ---- level flow ---------------------------------------------------------

  private teardown() {
    for (const v of this.lot) this.vehicles.release(v)
    for (const v of this.moving) this.vehicles.release(v)
    for (const s of this.bays) if (s) this.vehicles.release(s)
    for (const p of this.activePeople) this.people.release(p)
    this.lot = []
    this.moving = []
    this.bays = []
    this.queue = []
    this.activePeople = []
  }

  loadLevel(level: number) {
    this.level = Math.max(1, Math.min(MAX_LEVEL, level))
    localStorage.setItem(STORAGE_KEY, String(this.level))
    this.teardown()

    const spec = generateLevel(this.level)
    this.cols = spec.cols
    this.rows = spec.rows
    this.grid = new Int16Array(this.cols * this.rows).fill(-1)

    // bays: a horizontal row in the strip above the lot, centred and pitched
    // so up to PLANNED_BAYS fit without their (face-up) cars overlapping.
    this.bayZ = this.topEdge() - 2.2
    this.bays = new Array(spec.bays).fill(null)
    this.bayX = []
    for (let i = 0; i < spec.bays; i++) this.bayX.push((i - (spec.bays - 1) / 2) * BAY_PITCH)

    this.queueZ = this.bottomEdge() + 1.5

    this.buildPlatform()

    spec.cars.forEach((c, id) => {
      const v = this.vehicles.acquire()
      const [x, z] = this.carWorld(c)
      v.init(id, c.colorIndex, c.length, c.orient, c.anchor, c.lane, x, z)
      this.occupy(v)
      this.lot.push(v)
    })

    this.queueColors = spec.queue.slice()
    this.boarded = 0
    for (let i = 0; i < Math.min(VISIBLE, this.queueColors.length); i++)
      this.spawnQueuePerson(this.queueColors[i], i)

    this.status = 'playing'
    this.frameCamera(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight,
    )
    this.emit()
  }

  private spawnQueuePerson(colorIndex: number, slotIndex: number) {
    const p = this.people.acquire()
    const [x, z] = this.queueSpot(slotIndex)
    p.init(colorIndex, x + 0.6, z) // appear from the right and slide into place
    p.shuffleTo(x, z)
    this.queue.push(p)
    this.activePeople.push(p)
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

  private emit() {
    this.onState({
      level: this.level,
      queueTotal: this.queueColors.length,
      queueLeft: this.queueColors.length - this.boarded,
      status: this.status,
      muted: this.audio.muted,
    })
  }

  // ---- grid ---------------------------------------------------------------

  private idx(c: number, r: number) {
    return r * this.cols + c
  }
  private occupy(v: Vehicle) {
    for (let i = 0; i < v.length; i++) {
      const c = v.orient === 'h' ? v.anchor + i : v.lane
      const r = v.orient === 'h' ? v.lane : v.anchor + i
      this.grid[this.idx(c, r)] = v.id
    }
  }
  private free(v: Vehicle) {
    for (let i = 0; i < v.length; i++) {
      const c = v.orient === 'h' ? v.anchor + i : v.lane
      const r = v.orient === 'h' ? v.lane : v.anchor + i
      this.grid[this.idx(c, r)] = -1
    }
  }
  /** Clear path from the car to its exit edge (cells before anchor)? */
  private extractable(v: Vehicle) {
    for (let p = 0; p < v.anchor; p++) {
      const c = v.orient === 'h' ? p : v.lane
      const r = v.orient === 'h' ? v.lane : p
      if (this.grid[this.idx(c, r)] !== -1) return false
    }
    return true
  }

  // ---- interaction --------------------------------------------------------

  private onTap(v: Vehicle) {
    if (this.status !== 'playing') return
    this.audio.resume()
    if (v.dispatched) return
    if (!this.extractable(v)) {
      this.audio.honk() // blocked by another car
      return
    }
    const bay = this.bays.indexOf(null)
    if (bay === -1) {
      this.audio.honk() // no open bay
      return
    }
    this.free(v)
    this.lot.splice(this.lot.indexOf(v), 1)
    this.vehicles.unpick(v)
    this.bays[bay] = v

    const len = v.length * CELL * 0.82
    const [cx, cz] = this.carWorld(v)
    const bx = this.bayX[bay]
    const stageZ = this.bayZ + 1.4 // staging lane just below the bay row
    const wps: THREE.Vector3[] = []
    if (v.orient === 'v') {
      // slide up out of the lot, shift across under the bay, then up into it
      wps.push(new THREE.Vector3(cx, 0, stageZ))
    } else {
      // slide left out of the lot, then up the left margin (clear of the lot)
      const offX = this.leftEdge() - len / 2 - 0.3
      wps.push(new THREE.Vector3(offX, 0, cz))
      wps.push(new THREE.Vector3(offX, 0, stageZ))
    }
    wps.push(new THREE.Vector3(bx, 0, stageZ))
    // final approach is straight up → the car comes to rest facing UP (narrow),
    // so it never overlaps a neighbouring bay
    wps.push(new THREE.Vector3(bx, 0, this.bayZ))
    v.dispatch(bay, wps)
    this.moving.push(v)
    this.audio.tick()
  }

  // ---- boarding logic -----------------------------------------------------

  private tryBoard() {
    let guard = this.bays.length + 1
    while (guard-- > 0) {
      const front = this.queue[0]
      if (!front || front.state !== 'queued') break
      let car: Vehicle | null = null
      for (const s of this.bays) {
        if (s && s.state === 'boarding' && s.colorIndex === front.colorIndex && s.freeSeats() > 0) {
          car = s
          break
        }
      }
      if (!car) break
      car.seats--
      car.pending++
      this.queue.shift()
      front.hopTo(car.group.position.x, car.group.position.z + 0.5, () => this.onBoarded(car!))
      this.advanceQueue()
    }
  }

  private onBoarded(car: Vehicle) {
    car.pending--
    car.popPip()
    this.audio.tick()
    if (car.seats === 0 && car.pending === 0) {
      const exit = new THREE.Vector3(car.group.position.x, 0, this.bayZ - 7)
      car.depart(exit) // straight up, off the top
      const si = this.bays.indexOf(car)
      if (si !== -1) this.bays[si] = null
    }
  }

  private advanceQueue() {
    this.queue.forEach((p, i) => {
      const [x, z] = this.queueSpot(i)
      p.shuffleTo(x, z)
    })
    const nextIdx = this.boarded + this.queue.length + 1
    this.boarded++
    if (nextIdx <= this.queueColors.length - 1 && this.queue.length < VISIBLE)
      this.spawnQueuePerson(this.queueColors[nextIdx], this.queue.length)
    this.emit()
  }

  private checkEnd() {
    if (this.status !== 'playing') return
    if (this.boarded >= this.queueColors.length && this.queue.length === 0) {
      if (!this.activePeople.some((p) => p.state !== 'queued')) this.win()
      return
    }
    const front = this.queue[0]
    if (!front || front.state !== 'queued') return
    if (this.moving.some((v) => v.state === 'driving' || v.state === 'departing')) return
    if (this.activePeople.some((p) => p.state === 'hopping' || p.state === 'boarded')) return

    const freeBay = this.bays.indexOf(null) !== -1
    const canBoard = this.bays.some(
      (s) => s && s.state === 'boarding' && s.colorIndex === front.colorIndex && s.freeSeats() > 0,
    )
    const canExtract = freeBay && this.lot.some((v) => this.extractable(v))
    if (!canBoard && !canExtract) {
      this.status = 'stuck'
      this.audio.honk()
      this.emit()
    }
  }

  private win() {
    this.status = 'won'
    this.audio.clear()
    for (let i = 0; i < 4; i++) {
      this.tmp.set((Math.random() - 0.5) * 3, 0.6, this.bayZ + (Math.random() - 0.5) * 2)
      this.particles.burst(this.tmp, CAR_COLORS[i % CAR_COLORS.length])
    }
    this.emit()
  }

  // ---- loop ---------------------------------------------------------------

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(this.clock.getDelta(), 0.05)

    for (const v of this.lot) v.update(dt)
    for (let i = this.moving.length - 1; i >= 0; i--) {
      const v = this.moving[i]
      v.update(dt)
      if (v.state === 'departing' && Math.random() < 0.5) this.particles.exhaust(v.tail(this.tmp))
      if (v.state === 'gone') {
        this.moving.splice(i, 1)
        this.vehicles.release(v)
      }
    }
    for (let i = this.activePeople.length - 1; i >= 0; i--) {
      const p = this.activePeople[i]
      if (p.update(dt)) {
        this.activePeople.splice(i, 1)
        this.people.release(p)
      }
    }

    if (this.status === 'playing') {
      this.tryBoard()
      this.checkEnd()
    }

    this.particles.update(dt)
    this.renderer.render(this.scene, this.camera)
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
