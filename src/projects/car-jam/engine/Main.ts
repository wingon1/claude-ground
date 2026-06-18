/* ===========================================================================
 * Main.ts — scene/camera/loop + the color-boarding game state machine.
 *
 * Portrait layout (a vertical stack, centred on screen):
 *   • TOP    — queue of colour-coded passengers (far from camera, -Z)
 *   • MIDDLE — a row of boarding slots
 *   • BOTTOM — the jammed parking lot of colour-coded cars (near camera, +Z)
 *
 * Tap a car → if nothing is parked in front of it in its column and a slot is
 * free, it drives up to the slot. The passenger at the front of the queue
 * boards any slotted car of its colour; when a car's seats are full it drives
 * off and frees its slot. Clear the whole queue to win.
 * ========================================================================= */

import * as THREE from 'three'
import { Audio } from './Audio'
import { generateLevel } from './LevelGenerator'
import { Input } from './Input'
import { Particles } from './Particles'
import { Person, PersonPool } from './Person'
import type { GameState } from './types'
import { Vehicle, VehiclePool, CAR_COLORS } from './Vehicle'

const MAX_LEVEL = 100
const STORAGE_KEY = 'carjam.level'

const LOT_GAP = 1.4 // spacing between cars in the lot
const SLOT_Z = 0 // boarding lane sits at z = 0 (screen middle)
const SLOT_GAP = 1.75
const LANE_GAP = 1.95 // slots → first lot row
const QUEUE_GAP = 0.66 // spacing between queued people
const QUEUE_GAP0 = 1.95 // slots → front of queue
const VISIBLE = 8 // max passengers shown in the queue at once

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
  private cols = 3
  private rows = 2
  private slotCount = 3

  private lot: Vehicle[] = [] // cars still parked
  private slots: (Vehicle | null)[] = []
  private slotX: number[] = []
  private moving: Vehicle[] = [] // driving / boarding / departing cars

  private queueColors: number[] = []
  private boarded = 0
  private queue: Person[] = [] // people still waiting (front first)
  private activePeople: Person[] = []

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
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x4a4358, 0.75))
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.16))
    const key = new THREE.DirectionalLight(0xfff1d8, 2.1)
    key.position.set(6, 14, 9)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.bias = -0.0006
    key.shadow.normalBias = 0.02
    const cam = key.shadow.camera
    cam.near = 1
    cam.far = 70
    cam.left = -16
    cam.right = 16
    cam.top = 16
    cam.bottom = -16
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x9db8ff, 0.5)
    rim.position.set(-8, 6, -2)
    this.scene.add(rim)
  }

  /** Bounding box of all play content (lot + slots + queue), in world space. */
  private bounds(): Bounds {
    const halfCols = ((this.cols - 1) / 2) * LOT_GAP
    const visN = Math.min(this.queueColors.length, VISIBLE)
    return {
      minX: -halfCols - 0.9,
      maxX: halfCols + 0.9,
      minZ: SLOT_Z - QUEUE_GAP0 - Math.max(0, visN - 1) * QUEUE_GAP - 0.7,
      maxZ: SLOT_Z + LANE_GAP + (this.rows - 1) * LOT_GAP + 0.9,
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
    const w = b.maxX - b.minX + 0.6
    const d = b.maxZ - b.minZ + 0.6
    const c = this.center(b)
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.4, d),
      new THREE.MeshStandardMaterial({ color: 0x3c4458, roughness: 0.97 }),
    )
    slab.position.set(c.x, -0.2, c.z)
    slab.receiveShadow = true
    g.add(slab)

    const padMat = new THREE.MeshStandardMaterial({ color: 0x5b6479, roughness: 0.9 })
    for (const sx of this.slotX) {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.06, 1.35), padMat)
      pad.position.set(sx, 0.02, SLOT_Z)
      pad.receiveShadow = true
      g.add(pad)
    }
    this.platform = g
    this.scene.add(g)
  }

  // ---- camera framing -----------------------------------------------------

  private positionCamera() {
    const c = this.center(this.bounds())
    this.camera.position.set(c.x + 7, 12.5, c.z + 9)
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
    const FILL = 0.94 // fill ~94% of the limiting screen dimension
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
    for (const s of this.slots) if (s) this.vehicles.release(s)
    for (const p of this.activePeople) this.people.release(p)
    this.lot = []
    this.moving = []
    this.slots = []
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
    this.slotCount = spec.slots
    this.slots = new Array(this.slotCount).fill(null)
    this.slotX = []
    for (let i = 0; i < this.slotCount; i++) this.slotX.push((i - (this.slotCount - 1) / 2) * SLOT_GAP)

    this.buildPlatform()

    // parked cars: row 0 is nearest the lane (just below the slots, +Z)
    spec.cars.forEach((c, id) => {
      const v = this.vehicles.acquire()
      const x = (c.col - (this.cols - 1) / 2) * LOT_GAP
      const z = SLOT_Z + LANE_GAP + c.row * LOT_GAP
      v.init(id, c.colorIndex, c.seats, c.col, c.row, x, z)
      this.lot.push(v)
    })

    // queue, lined up above the slots (-Z)
    this.queueColors = spec.queue.slice()
    this.boarded = 0
    for (let i = 0; i < Math.min(VISIBLE, this.queueColors.length); i++) {
      this.spawnQueuePerson(this.queueColors[i], i)
    }

    this.status = 'playing'
    this.frameCamera(
      this.container.clientWidth || window.innerWidth,
      this.container.clientHeight || window.innerHeight,
    )
    this.emit()
  }

  private queueSpot(i: number): [number, number] {
    return [0, SLOT_Z - QUEUE_GAP0 - i * QUEUE_GAP]
  }

  private spawnQueuePerson(colorIndex: number, slotIndex: number) {
    const p = this.people.acquire()
    const [x, z] = this.queueSpot(slotIndex)
    p.init(colorIndex, x, z - 0.5)
    p.group.rotation.y = 0 // face the lane / cars (+Z)
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

  // ---- interaction --------------------------------------------------------

  private dispatchable(v: Vehicle): boolean {
    for (const o of this.lot) if (o.col === v.col && o.row < v.row) return false
    return true
  }

  private onTap(v: Vehicle) {
    if (this.status !== 'playing') return
    this.audio.resume()
    if (v.dispatched) return
    if (!this.dispatchable(v)) {
      this.audio.honk()
      return
    }
    const slot = this.slots.indexOf(null)
    if (slot === -1) {
      this.audio.honk()
      return
    }
    this.lot.splice(this.lot.indexOf(v), 1)
    this.vehicles.unpick(v)
    this.slots[slot] = v
    const sx = this.slotX[slot]
    // pull straight up to the lane, then slide across to the slot
    const wps = [new THREE.Vector3(v.group.position.x, 0, SLOT_Z), new THREE.Vector3(sx, 0, SLOT_Z)]
    v.dispatch(slot, wps)
    this.moving.push(v)
    this.audio.tick()
    this.emit()
  }

  // ---- boarding logic -----------------------------------------------------

  private tryBoard() {
    let guard = this.slotCount + 1
    while (guard-- > 0) {
      const front = this.queue[0]
      if (!front || front.state !== 'queued') break
      let car: Vehicle | null = null
      for (const s of this.slots) {
        if (s && s.state === 'boarding' && s.colorIndex === front.colorIndex && s.freeSeats() > 0) {
          car = s
          break
        }
      }
      if (!car) break
      car.seats--
      car.pending++
      this.queue.shift()
      // walk to just in front of the car (on the queue side, -Z)
      const dest = this.tmp.set(car.group.position.x, 0, car.group.position.z - 0.8)
      front.boardTo({ id: car.id }, dest.x, dest.z, () => this.onBoarded(car!))
      this.advanceQueue()
    }
  }

  private onBoarded(car: Vehicle) {
    car.pending--
    car.popPip()
    this.audio.tick()
    if (car.seats === 0 && car.pending === 0) {
      const b = this.bounds()
      // drive off diagonally up-and-to-the-right, clear of queue and lot
      const exit = new THREE.Vector3(b.maxX + 6, 0, SLOT_Z - 1.2)
      car.depart(exit)
      const si = this.slots.indexOf(car)
      if (si !== -1) this.slots[si] = null
    }
  }

  private advanceQueue() {
    this.queue.forEach((p, i) => {
      const [x, z] = this.queueSpot(i)
      p.shuffleTo(x, z)
    })
    const nextIdx = this.boarded + this.queue.length + 1
    this.boarded++
    if (nextIdx <= this.queueColors.length - 1 && this.queue.length < VISIBLE) {
      this.spawnQueuePerson(this.queueColors[nextIdx], this.queue.length)
    }
    this.emit()
  }

  private checkEnd() {
    if (this.status !== 'playing') return
    if (this.boarded >= this.queueColors.length && this.queue.length === 0) {
      const anyWalking = this.activePeople.some((p) => p.state !== 'queued')
      if (!anyWalking) this.win()
      return
    }
    const front = this.queue[0]
    if (!front || front.state !== 'queued') return
    if (this.moving.some((v) => v.state === 'driving' || v.state === 'departing')) return
    const walking = this.activePeople.some((p) => p.state === 'walking' || p.state === 'boarded')
    if (walking) return
    const freeSlot = this.slots.indexOf(null) !== -1
    if (freeSlot && this.lot.length > 0) return
    const canBoard = this.slots.some(
      (s) => s && s.state === 'boarding' && s.colorIndex === front.colorIndex && s.freeSeats() > 0,
    )
    if (!canBoard && !freeSlot) {
      this.status = 'stuck'
      this.audio.honk()
      this.emit()
    }
  }

  private win() {
    this.status = 'won'
    this.audio.clear()
    for (let i = 0; i < 4; i++) {
      this.tmp.set((Math.random() - 0.5) * 3, 0.6, SLOT_Z + (Math.random() - 0.5) * 2)
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
