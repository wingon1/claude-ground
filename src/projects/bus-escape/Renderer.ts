// All Three.js: procedural meshes, isometric camera framing, animations, FX.

import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import {
  COLOR_HEX,
  COLOR_DARK,
  type ColorKey,
  type Facing,
  type Vehicle,
} from './types'
import { TweenManager, easeOutCubic, easeInOutCubic, easeOutBack, easeOutQuad, linear } from './tween'
import { HOLDING_COUNT, type GameState } from './GameState'

// Queue is an L: a horizontal row (front on the left, by the traffic light)
// turning up into a vertical tail on the right. People enter top-right, come
// down the vertical, round the corner and slide left to the front.
const QUEUE_H = 10 // horizontal slots (incl. the corner)
const QUEUE_V = 8 // vertical slots above the corner
const QUEUE_WINDOW = QUEUE_H + QUEUE_V // 18 visible
const QUEUE_HSPACING = 0.48
const QUEUE_VSPACING = 0.4 // tighter; descending people may visually overlap
const SLOT_COUNT = 4

interface VehicleView {
  group: THREE.Group
  body: THREE.Mesh
  capFill: THREE.Mesh
  capBarWidth: number
  vehicle: Vehicle
}

interface Particle {
  mesh: THREE.Mesh
  vel: THREE.Vector3
  life: number
  ttl: number
}

export class Renderer {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.OrthographicCamera
  readonly renderer: THREE.WebGLRenderer
  readonly tween = new TweenManager()
  private host: HTMLElement

  private gradient: THREE.Texture
  private shadowTex: THREE.Texture
  private bodyMat = new Map<ColorKey, THREE.MeshToonMaterial>()
  private darkMat = new Map<ColorKey, THREE.MeshToonMaterial>()
  private glassMat: THREE.MeshToonMaterial
  private tireMat: THREE.MeshToonMaterial
  private markerMat: THREE.MeshToonMaterial
  private capBgMat: THREE.MeshBasicMaterial
  private capFillMat: THREE.MeshToonMaterial
  private arrowGeo: THREE.BufferGeometry | null = null

  private boardGroup = new THREE.Group()
  private vehicleGroup = new THREE.Group()
  private fxGroup = new THREE.Group()

  private views = new Map<number, VehicleView>()
  private queueMeshes: THREE.Group[] = []
  private passengerPool: THREE.Group[] = []
  private slotMarkers: THREE.Mesh[] = []
  private particles: Particle[] = []
  private particlePool: THREE.Mesh[] = []

  private size = 6
  private zoneZ = 0
  private queueZ = 0
  // Framing is pinned to this (original) queue z so the grid/zone never move;
  // the actual queue (queueZ) is raised above it to overlap the top HUD bar.
  private queueFrameZ = 0
  private slotSpacing = 2.4
  // Endless mode: incoming "holding" cars at the bottom.
  private endless = false
  private holdingZ = 0
  private holdingSpacing = 1.7

  private contentBox = new THREE.Box3()
  private camBasePos = new THREE.Vector3()
  private camTarget = new THREE.Vector3()
  private shakeTime = 0
  private shakeMag = 0
  private clock = new THREE.Clock()
  private hintId: number | null = null
  private composer: EffectComposer
  private bloomPass: UnrealBloomPass

  constructor(host: HTMLElement) {
    this.host = host
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(host.clientWidth, host.clientHeight, false)
    this.renderer.setClearColor(0x10142e, 1)
    this.renderer.toneMapping = THREE.NeutralToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    host.appendChild(this.renderer.domElement)

    this.camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200)

    this.gradient = this.makeGradient()
    this.shadowTex = this.makeShadowTexture()
    this.glassMat = new THREE.MeshToonMaterial({ color: 0x213049, gradientMap: this.gradient })
    this.tireMat = new THREE.MeshToonMaterial({ color: 0x2a2f3a, gradientMap: this.gradient })
    this.markerMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: this.gradient })
    this.capBgMat = new THREE.MeshBasicMaterial({ color: 0x14203a })
    this.capFillMat = new THREE.MeshToonMaterial({ color: 0x8affc0, gradientMap: this.gradient, emissive: 0x2a8f5a, emissiveIntensity: 1.3 })

    // Post-processing: a single conservative bloom pass on bright emissives.
    const w = Math.max(1, host.clientWidth)
    const h = Math.max(1, host.clientHeight)
    const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4, type: THREE.HalfFloatType })
    this.composer = new EffectComposer(this.renderer, rt)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.5, 0.4, 0.9)
    this.composer.addPass(this.bloomPass)
    this.composer.addPass(new OutputPass())

    this.setupSceneBasics()
  }

  // ---- shared resources -------------------------------------------------

  private makeGradient(): THREE.Texture {
    const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255])
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat)
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.needsUpdate = true
    return tex
  }

  private makeShadowTexture(): THREE.Texture {
    const s = 64
    const cv = document.createElement('canvas')
    cv.width = s
    cv.height = s
    const ctx = cv.getContext('2d')!
    const grd = ctx.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2)
    grd.addColorStop(0, 'rgba(0,0,0,0.45)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, s, s)
    const tex = new THREE.CanvasTexture(cv)
    tex.needsUpdate = true
    return tex
  }

  private bodyMaterial(c: ColorKey): THREE.MeshToonMaterial {
    let m = this.bodyMat.get(c)
    if (!m) {
      m = new THREE.MeshToonMaterial({ color: COLOR_HEX[c], gradientMap: this.gradient })
      this.bodyMat.set(c, m)
    }
    return m
  }

  private darkMaterial(c: ColorKey): THREE.MeshToonMaterial {
    let m = this.darkMat.get(c)
    if (!m) {
      m = new THREE.MeshToonMaterial({ color: COLOR_DARK[c], gradientMap: this.gradient })
      this.darkMat.set(c, m)
    }
    return m
  }

  // Flat arrow lying on the roof, pointing toward the vehicle's local +x (its
  // front). The vehicle group is rotated by facing, so it points the real way.
  private arrowGeometry(): THREE.BufferGeometry {
    if (this.arrowGeo) return this.arrowGeo
    const s = new THREE.Shape()
    s.moveTo(0.26, 0)
    s.lineTo(0.04, 0.18)
    s.lineTo(0.04, 0.07)
    s.lineTo(-0.22, 0.07)
    s.lineTo(-0.22, -0.07)
    s.lineTo(0.04, -0.07)
    s.lineTo(0.04, -0.18)
    s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false })
    g.rotateX(-Math.PI / 2) // lay flat, normal up
    this.arrowGeo = g
    return g
  }

  // ---- scene setup ------------------------------------------------------

  private setupSceneBasics(): void {
    this.scene.background = this.makeBackgroundTexture()
    const hemi = new THREE.HemisphereLight(0xdde6ff, 0x2a2440, 0.9)
    this.scene.add(hemi)
    const dir = new THREE.DirectionalLight(0xffffff, 1.15)
    dir.position.set(-6, 12, 8)
    this.scene.add(dir)
    const fill = new THREE.DirectionalLight(0x88aaff, 0.35)
    fill.position.set(8, 6, -6)
    this.scene.add(fill)
    // Warm rim/back light to separate silhouettes (we use no outlines).
    const rim = new THREE.DirectionalLight(0xffd9a0, 0.55)
    rim.position.set(7, 4, -12)
    this.scene.add(rim)
    this.scene.add(this.boardGroup)
    this.scene.add(this.vehicleGroup)
    this.scene.add(this.fxGroup)
  }

  private makeBackgroundTexture(): THREE.Texture {
    const cv = document.createElement('canvas')
    cv.width = 16
    cv.height = 256
    const ctx = cv.getContext('2d')!
    const grd = ctx.createLinearGradient(0, 0, 0, 256)
    grd.addColorStop(0, '#0b1030')
    grd.addColorStop(0.55, '#141a3e')
    grd.addColorStop(1, '#1f2752')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, 16, 256)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    return tex
  }

  // ---- layout helpers ---------------------------------------------------

  private cellWorld(r: number, c: number): { x: number; z: number } {
    const half = (this.size - 1) / 2
    return { x: c - half, z: r - half }
  }

  private vehicleCenter(v: Vehicle): { x: number; z: number } {
    if (v.orientation === 'h') {
      return this.cellWorld(v.row, v.col + (v.length - 1) / 2)
    }
    return this.cellWorld(v.row + (v.length - 1) / 2, v.col)
  }

  private rotForFacing(f: Facing): number {
    switch (f) {
      case 'right': return 0
      case 'left': return Math.PI
      case 'down': return -Math.PI / 2
      case 'up': return Math.PI / 2
    }
  }

  private forwardDir(f: Facing): THREE.Vector3 {
    switch (f) {
      case 'right': return new THREE.Vector3(1, 0, 0)
      case 'left': return new THREE.Vector3(-1, 0, 0)
      case 'down': return new THREE.Vector3(0, 0, 1)
      case 'up': return new THREE.Vector3(0, 0, -1)
    }
  }

  private slotWorld(i: number): THREE.Vector3 {
    const x = (i - (SLOT_COUNT - 1) / 2) * this.slotSpacing
    return new THREE.Vector3(x, 0, this.zoneZ)
  }

  private get queueRightX(): number {
    return ((QUEUE_H - 1) / 2) * QUEUE_HSPACING
  }

  // Resting position of queue index i along the L (0 = front/left).
  private queueWorld(i: number): THREE.Vector3 {
    if (i < QUEUE_H) {
      const x = (i - (QUEUE_H - 1) / 2) * QUEUE_HSPACING
      return new THREE.Vector3(x, 0, this.queueZ)
    }
    // vertical tail above the right corner, steps 1..QUEUE_V
    const step = i - (QUEUE_H - 1)
    return new THREE.Vector3(this.queueRightX, 0, this.queueZ - step * QUEUE_VSPACING)
  }

  // Off-frame point above the top of the vertical tail where passengers appear
  // before descending and rounding the corner toward the front.
  private queueEntryStart(): THREE.Vector3 {
    return new THREE.Vector3(this.queueRightX, 1.7, this.queueZ - (QUEUE_V + 1) * QUEUE_VSPACING)
  }

  // ---- level build ------------------------------------------------------

  buildLevel(state: GameState): void {
    this.disposeLevel()
    this.endless = false
    this.size = state.size
    const half = (this.size - 1) / 2
    this.slotSpacing = Math.max(1.7, Math.min(2.5, this.size * 0.32))
    const zoneBaseZ = -half - 3.2
    this.queueFrameZ = zoneBaseZ - 3.0
    // Frame first (pinned to the original zone/queue z) so the grid framing and
    // overall proportions stay fixed, then nudge the zone + queue up 5% of the
    // screen height each.
    this.zoneZ = zoneBaseZ
    this.queueZ = this.queueFrameZ
    this.frameContent()
    const sp = Math.sin((56 * Math.PI) / 180)
    const raise = 0.05 * (this.camera.top - this.camera.bottom) / sp
    this.zoneZ = zoneBaseZ - raise
    this.queueZ = this.queueFrameZ - raise

    this.buildBoard()
    this.buildZoneMarkers()
    this.buildTrafficLight()

    for (const v of state.vehicles.values()) {
      const view = this.makeVehicle(v)
      const c = this.vehicleCenter(v)
      view.group.position.set(c.x, 0, c.z)
      view.group.rotation.y = this.rotForFacing(v.facing)
      this.vehicleGroup.add(view.group)
      this.views.set(v.id, view)
    }

    // Already-parked vehicles (none at start, but keep correct on rebuild).
    state.zone.forEach((slot, i) => {
      if (!slot) return
      const view = this.makeVehicle(slot.vehicle)
      const p = this.slotWorld(i)
      view.group.position.copy(p)
      view.group.rotation.y = this.rotForFacing('up')
      this.vehicleGroup.add(view.group)
      this.views.set(slot.vehicle.id, view)
      this.updateCapacity(slot.vehicle)
    })

    this.buildQueue(state.queue)
  }

  // Endless mode: empty 7x7 parking grid + zone + top queue + a bottom row of
  // incoming "holding" cars the player taps to park.
  buildEndless(state: GameState): void {
    this.disposeLevel()
    this.endless = true
    this.size = state.size
    const half = (this.size - 1) / 2
    this.slotSpacing = Math.max(1.7, Math.min(2.5, this.size * 0.32))
    const zoneBaseZ = -half - 3.2
    this.queueFrameZ = zoneBaseZ - 3.0
    this.holdingZ = half + 2.6
    this.holdingSpacing = Math.max(1.5, Math.min(2.3, (this.size * 0.9) / Math.max(1, state.holding.length)))
    this.zoneZ = zoneBaseZ
    this.queueZ = this.queueFrameZ
    this.frameContent()
    const sp = Math.sin((56 * Math.PI) / 180)
    const raise = 0.05 * (this.camera.top - this.camera.bottom) / sp
    this.zoneZ = zoneBaseZ - raise
    this.queueZ = this.queueFrameZ - raise

    this.buildBoard()
    this.buildZoneMarkers()
    this.buildTrafficLight()
    this.buildHoldingPlatform(state.holding.length)

    // Pre-parked cars already on the grid.
    for (const v of state.vehicles.values()) {
      const view = this.makeVehicle(v)
      const c = this.vehicleCenter(v)
      view.group.position.set(c.x, 0, c.z)
      view.group.rotation.y = this.rotForFacing(v.facing)
      this.vehicleGroup.add(view.group)
      this.views.set(v.id, view)
    }

    this.buildQueue(state.queue)
    this.syncHolding(state.holding)
  }

  private holdingWorld(i: number, count: number): THREE.Vector3 {
    const x = (i - (count - 1) / 2) * this.holdingSpacing
    return new THREE.Vector3(x, 0, this.holdingZ)
  }

  private buildHoldingPlatform(count: number): void {
    const len = Math.max(count, 1) * this.holdingSpacing + 1.0
    const plat = new THREE.Mesh(
      new RoundedBoxGeometry(len, 0.2, 1.6, 2, 0.1),
      new THREE.MeshToonMaterial({ color: 0x2a2150, gradientMap: this.gradient }),
    )
    plat.position.set(0, -0.1, this.holdingZ)
    this.boardGroup.add(plat)
  }

  // Create/reposition holding car meshes to match state.holding order.
  syncHolding(holding: Vehicle[]): void {
    const count = holding.length
    holding.forEach((v, i) => {
      let view = this.views.get(v.id)
      const target = this.holdingWorld(i, count)
      if (!view) {
        view = this.makeVehicle(v)
        // new arrivals slide in from the right
        view.group.position.set(target.x + 2.2, 0, this.holdingZ)
        view.group.rotation.y = this.rotForFacing('up')
        this.vehicleGroup.add(view.group)
        this.views.set(v.id, view)
      }
      const from = view.group.position.clone()
      const v2 = view
      this.anim(240, (k) => v2.group.position.lerpVectors(from, target, k), easeOutQuad)
    })
  }

  // Animate an incoming car from its holding spot into its parked grid cell.
  // Reads the (already updated) row/col/orientation from the vehicle.
  async animateParkIn(vehicleId: number): Promise<void> {
    const view = this.views.get(vehicleId)
    if (!view) return
    const c = this.vehicleCenter(view.vehicle)
    const end = new THREE.Vector3(c.x, 0, c.z)
    const start = view.group.position.clone()
    const endRot = this.rotForFacing(view.vehicle.facing)
    const startRot = view.group.rotation.y
    const mid = new THREE.Vector3(end.x, 0, (start.z + end.z) / 2)
    await this.anim(140, (k) => {
      view.group.scale.set(1 + 0.08 * k, 1 - 0.06 * k, 1)
    }, easeOutQuad)
    await this.anim(420, (k) => {
      const a = start.clone().lerp(mid, k)
      const b = mid.clone().lerp(end, k)
      view.group.position.copy(a.lerp(b, k))
      view.group.rotation.y = startRot + (endRot - startRot) * k
      view.group.scale.set(1 + 0.08 * (1 - k), 1 - 0.06 * (1 - k), 1)
    }, easeInOutCubic)
    view.group.position.copy(end)
    view.group.rotation.y = endRot
    view.group.scale.set(1, 1, 1)
  }

  private buildBoard(): void {
    const half = (this.size - 1) / 2
    const pad = 0.5
    const w = this.size + pad * 2
    // Base slab
    const slab = new THREE.Mesh(
      new RoundedBoxGeometry(w, 0.5, w, 4, 0.18),
      new THREE.MeshToonMaterial({ color: 0x2c3358, gradientMap: this.gradient }),
    )
    slab.position.set(0, -0.27, 0)
    this.boardGroup.add(slab)

    // Top surface with painted grid lines (procedural canvas texture).
    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(this.size, this.size),
      new THREE.MeshToonMaterial({ map: this.makeBoardTexture(), gradientMap: this.gradient }),
    )
    top.rotation.x = -Math.PI / 2
    top.position.set(0, 0.001, 0)
    this.boardGroup.add(top)

    // Zone platform
    const zoneW = this.slotSpacing * SLOT_COUNT + 0.6
    const zonePlat = new THREE.Mesh(
      new RoundedBoxGeometry(zoneW, 0.3, 2.0, 3, 0.12),
      new THREE.MeshToonMaterial({ color: 0x37406b, gradientMap: this.gradient }),
    )
    zonePlat.position.set(0, -0.15, this.zoneZ)
    this.boardGroup.add(zonePlat)

    // Queue platform — a clean L: the two arms share the same width and meet
    // exactly at the corner (no overhang). PW = lane width.
    const qMat = new THREE.MeshToonMaterial({ color: 0x252b4d, gradientMap: this.gradient })
    const PW = 1.0
    const cornerX = this.queueRightX
    const xLeft = -cornerX - 0.55 // a little before the front (index 0)
    const xRight = cornerX + PW / 2 // reach the corner's outer edge
    // Horizontal arm
    const hLen = xRight - xLeft
    const qH = new THREE.Mesh(new RoundedBoxGeometry(hLen, 0.2, PW, 2, 0.09), qMat)
    qH.position.set((xLeft + xRight) / 2, -0.1, this.queueZ)
    this.boardGroup.add(qH)
    // Vertical arm — from the corner up to just past the last vertical slot
    const topZ = this.queueZ - QUEUE_V * QUEUE_VSPACING - 0.5
    const bottomZ = this.queueZ - PW / 2 // butts against the horizontal arm
    const vLen = bottomZ - topZ
    const qV = new THREE.Mesh(new RoundedBoxGeometry(PW, 0.2, vLen, 2, 0.09), qMat)
    qV.position.set(cornerX, -0.1, (topZ + bottomZ) / 2)
    this.boardGroup.add(qV)

    void half
  }

  private makeBoardTexture(): THREE.Texture {
    const cells = this.size
    const px = 64
    const s = cells * px
    const cv = document.createElement('canvas')
    cv.width = s
    cv.height = s
    const ctx = cv.getContext('2d')!
    ctx.fillStyle = '#3a4170'
    ctx.fillRect(0, 0, s, s)
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#414978' : '#3a4170'
        ctx.fillRect(c * px + 2, r * px + 2, px - 4, px - 4)
      }
    }
    const tex = new THREE.CanvasTexture(cv)
    tex.needsUpdate = true
    return tex
  }

  private buildZoneMarkers(): void {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 0.82, 28),
        new THREE.MeshBasicMaterial({ color: 0x6f7bd0, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
      )
      ring.rotation.x = -Math.PI / 2
      const p = this.slotWorld(i)
      ring.position.set(p.x, 0.02, p.z)
      this.boardGroup.add(ring)
      this.slotMarkers.push(ring)
    }
  }

  // A little traffic light marking the head of the queue (where the next
  // passenger boards). The line of people extends away from it (+x).
  private buildTrafficLight(): void {
    const g = new THREE.Group()
    const headX = this.queueWorld(0).x - 0.95
    g.position.set(headX, 0, this.queueZ)

    const dark = new THREE.MeshToonMaterial({ color: 0x2b3047, gradientMap: this.gradient })
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.15, 10), dark)
    pole.position.y = 0.57
    g.add(pole)
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.1, 14), dark)
    base.position.y = 0.05
    g.add(base)
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.74, 0.22), dark)
    housing.position.y = 1.32
    g.add(housing)

    // three lamps facing the camera (+z); green is lit = "board here"
    const lamps: { y: number; color: number; on: boolean }[] = [
      { y: 1.58, color: 0xff4d4d, on: false },
      { y: 1.32, color: 0xffcf3a, on: false },
      { y: 1.06, color: 0x42cf6b, on: true },
    ]
    for (const l of lamps) {
      const mat = new THREE.MeshToonMaterial({
        color: l.color,
        gradientMap: this.gradient,
        emissive: l.color,
        emissiveIntensity: l.on ? 2.4 : 0.12,
      })
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 12), mat)
      lamp.position.set(0, l.y, 0.12)
      g.add(lamp)
      if (l.on) {
        const glow = new THREE.Mesh(
          new THREE.CircleGeometry(0.16, 18),
          new THREE.MeshBasicMaterial({ color: l.color, transparent: true, opacity: 0.35 }),
        )
        glow.position.set(0, l.y, 0.135)
        g.add(glow)
      }
    }
    this.boardGroup.add(g)
  }

  // ---- vehicle mesh -----------------------------------------------------

  private makeVehicle(v: Vehicle): VehicleView {
    const group = new THREE.Group()
    const len = v.length - 0.16
    const wid = 0.84
    const bodyH = 0.46
    const bodyY = 0.16 + bodyH / 2

    const body = new THREE.Mesh(new RoundedBoxGeometry(len, bodyH, wid, 3, 0.1), this.bodyMaterial(v.color))
    body.position.y = bodyY
    group.add(body)

    // Cabin / roof (a bit taller for buses & long)
    const cabH = v.size === 'car' ? 0.26 : 0.34
    const cab = new THREE.Mesh(
      new RoundedBoxGeometry(len * 0.82, cabH, wid * 0.86, 3, 0.07),
      this.darkMaterial(v.color),
    )
    cab.position.y = bodyY + bodyH / 2 + cabH / 2 - 0.02
    group.add(cab)

    // Windows along both sides
    const windowCount = v.length // 2/3/4
    const winMat = this.glassMat
    for (let s = -1; s <= 1; s += 2) {
      for (let w = 0; w < windowCount; w++) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(len / (windowCount + 0.4) * 0.7, cabH * 0.6, 0.04), winMat)
        const xx = -len / 2 + (len * (w + 0.7)) / (windowCount + 0.4)
        win.position.set(xx, cab.position.y + 0.02, (s * wid * 0.86) / 2)
        group.add(win)
      }
    }
    // Windshield at the front (+x)
    const wind = new THREE.Mesh(new THREE.BoxGeometry(0.04, cabH * 0.6, wid * 0.7), winMat)
    wind.position.set(len / 2 - 0.02, cab.position.y + 0.02, 0)
    group.add(wind)

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.1, 14)
    const wheelPositions = v.length >= 4 ? [-0.34, -0.1, 0.14, 0.36] : v.length === 3 ? [-0.32, 0, 0.32] : [-0.28, 0.28]
    for (const fx of wheelPositions) {
      for (let s = -1; s <= 1; s += 2) {
        const wheel = new THREE.Mesh(wheelGeo, this.tireMat)
        wheel.rotation.x = Math.PI / 2
        wheel.position.set(fx * len, 0.15, (s * wid) / 2)
        group.add(wheel)
      }
    }

    // Direction arrow on the roof, pointing toward the front (+x).
    const arrow = new THREE.Mesh(this.arrowGeometry(), this.markerMat)
    arrow.position.set(len * 0.16, cab.position.y + cabH / 2 + 0.04, 0)
    group.add(arrow)

    // Capacity bar on the roof (back portion)
    const capBarWidth = len * 0.5
    const barX = -len * 0.22
    const barZ = 0
    const bg = new THREE.Mesh(new THREE.BoxGeometry(capBarWidth, 0.04, 0.12), this.capBgMat)
    bg.position.set(barX, cab.position.y + cabH / 2 + 0.04, barZ)
    group.add(bg)
    const capFill = new THREE.Mesh(new THREE.BoxGeometry(capBarWidth, 0.06, 0.13), this.capFillMat)
    capFill.position.set(barX - capBarWidth / 2, cab.position.y + cabH / 2 + 0.05, barZ)
    capFill.scale.x = 0.001
    group.add(capFill)

    // Blob shadow
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(len + 0.5, wid + 0.5),
      new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.015
    group.add(shadow)

    return { group, body, capFill, capBarWidth, vehicle: v }
  }

  updateCapacity(v: Vehicle): void {
    const view = this.views.get(v.id)
    if (!view) return
    const ratio = Math.max(0.001, v.boarded / v.capacity)
    const w = view.capBarWidth
    view.capFill.scale.x = ratio
    view.capFill.position.x = -w * 0.44 - w / 2 + (w * ratio) / 2
  }

  // ---- passengers / queue ----------------------------------------------

  private makePassenger(): THREE.Group {
    const pooled = this.passengerPool.pop()
    if (pooled) {
      pooled.visible = true
      this.fxGroup.add(pooled)
      return pooled
    }
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.2, 4, 10), this.bodyMaterial('red'))
    body.position.y = 0.28
    body.name = 'body'
    g.add(body)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshToonMaterial({ color: 0xffe0bd, gradientMap: this.gradient }))
    head.position.y = 0.56
    g.add(head)
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.6),
      new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.01
    g.add(shadow)
    this.fxGroup.add(g)
    return g
  }

  private paintPassenger(g: THREE.Group, color: ColorKey): void {
    const body = g.getObjectByName('body') as THREE.Mesh
    body.material = this.bodyMaterial(color)
  }

  private recyclePassenger(g: THREE.Group): void {
    g.visible = false
    this.fxGroup.remove(g)
    this.passengerPool.push(g)
  }

  // Spawn a passenger at the top-right entry point; update() eases it into the
  // row. `order` staggers arrivals so the line forms one-by-one.
  private spawnQueuePassenger(color: ColorKey, order: number): THREE.Group {
    const p = this.makePassenger()
    this.paintPassenger(p, color)
    p.scale.setScalar(1)
    p.rotation.set(0, 0, 0)
    const s = this.queueEntryStart()
    p.position.copy(s)
    p.userData.gy = s.y
    p.userData.activateAt = this.clock.elapsedTime + order * 0.055
    return p
  }

  private buildQueue(colors: ColorKey[]): void {
    for (const m of this.queueMeshes) this.recyclePassenger(m)
    this.queueMeshes = []
    const n = Math.min(QUEUE_WINDOW, colors.length)
    for (let i = 0; i < n; i++) {
      this.queueMeshes.push(this.spawnQueuePassenger(colors[i], i))
    }
  }

  // Reconcile the visible queue to `colors` after boarding: keep/repaint the
  // survivors (they slide left via update()), drop extras, and let new tail
  // passengers descend in from the top-right.
  private syncQueueColors(colors: ColorKey[]): void {
    const n = Math.min(QUEUE_WINDOW, colors.length)
    while (this.queueMeshes.length > n) {
      this.recyclePassenger(this.queueMeshes.pop()!)
    }
    let order = 0
    while (this.queueMeshes.length < n) {
      this.queueMeshes.push(this.spawnQueuePassenger(colors[this.queueMeshes.length], order++))
    }
    this.queueMeshes.forEach((m, i) => this.paintPassenger(m, colors[i]))
  }

  private setCapacityRatio(view: VehicleView, ratio: number): void {
    const r = Math.max(0.001, Math.min(1, ratio))
    const w = view.capBarWidth
    view.capFill.scale.x = r
    view.capFill.position.x = -w * 0.44 - w / 2 + (w * r) / 2
  }

  // Board a whole batch of passengers in a fast, overlapping burst. State is
  // already resolved by the caller; this only plays the visuals.
  async animateBoardBurst(
    steps: number[],
    finalQueue: ColorKey[],
    onLand: (vehicleId: number) => void,
  ): Promise<void> {
    const GAP = 50 // ms between successive launches
    const DUR = 230 // arc duration
    const landed = new Map<number, number>()
    const flights: Promise<void>[] = []

    for (let i = 0; i < steps.length; i++) {
      const vId = steps[i]
      const view = this.views.get(vId)
      if (!view) continue

      let mesh = this.queueMeshes.shift()
      if (!mesh) {
        // boarding more than fit in the visible window: spawn from the tail
        mesh = this.makePassenger()
        this.paintPassenger(mesh, view.vehicle.color)
        mesh.position.copy(this.queueWorld(QUEUE_WINDOW - 1))
      }
      const flier = mesh
      const start = flier.position.clone()
      const target = view.group.position.clone()
      target.y = 1.05
      const peak = Math.max(start.y, target.y) + 0.85
      const ctrl = new THREE.Vector3((start.x + target.x) / 2, peak, (start.z + target.z) / 2)
      const delay = i * GAP

      flights.push(
        (async () => {
          if (delay) await this.anim(delay, () => {}, linear)
          await this.anim(DUR, (k) => {
            const a = start.clone().lerp(ctrl, k)
            const b = ctrl.clone().lerp(target, k)
            flier.position.copy(a.lerp(b, k))
            flier.scale.setScalar(1 - 0.3 * Math.sin(k * Math.PI))
          }, easeInOutCubic)
          flier.scale.setScalar(1)
          this.recyclePassenger(flier)
          const c = (landed.get(vId) ?? 0) + 1
          landed.set(vId, c)
          this.setCapacityRatio(view, c / view.vehicle.capacity)
          view.body.scale.y = 0.9
          this.anim(120, (k) => { view.body.scale.y = 0.9 + 0.1 * k }, easeOutQuad)
          onLand(vId)
        })(),
      )

      // remaining passengers slide left automatically via update()'s easing
    }

    await Promise.all(flights)
    this.syncQueueColors(finalQueue)
  }

  // ---- vehicle animations ----------------------------------------------

  async animateBump(vehicleId: number, distance: number): Promise<void> {
    const view = this.views.get(vehicleId)
    if (!view) return
    const v = view.vehicle
    const dir = this.forwardDir(v.facing)
    const base = view.group.position.clone()
    const amt = Math.min(0.32, 0.18 + distance * 0.08)
    await this.anim(110, (k) => {
      view.group.position.copy(base).addScaledVector(dir, amt * k)
    }, easeOutQuad)
    await this.anim(170, (k) => {
      view.group.position.copy(base).addScaledVector(dir, amt * (1 - k))
    }, easeOutBack)
    view.group.position.copy(base)
  }

  async animateBlocked(vehicleId: number): Promise<void> {
    const view = this.views.get(vehicleId)
    if (!view) return
    const base = view.group.position.clone()
    await this.anim(260, (k) => {
      view.group.position.x = base.x + Math.sin(k * Math.PI * 6) * 0.08
    }, linear)
    view.group.position.copy(base)
  }

  async animateDriveToZone(vehicleId: number, slotIndex: number): Promise<void> {
    const view = this.views.get(vehicleId)
    if (!view) return
    const v = view.vehicle
    const dir = this.forwardDir(v.facing)
    const start = view.group.position.clone()
    const startRot = view.group.rotation.y

    // Phase 1: squash then drive forward off the grid.
    const exitPoint = start.clone().addScaledVector(dir, this.size + 1.5)
    await this.anim(120, (k) => {
      view.group.scale.set(1 + 0.12 * k, 1 - 0.08 * k, 1)
    }, easeOutQuad)
    await this.anim(360, (k) => {
      view.group.position.lerpVectors(start, exitPoint, k)
      view.group.scale.set(1 + 0.12 * (1 - k), 1 - 0.08 * (1 - k), 1)
    }, easeOutCubic)
    view.group.scale.set(1, 1, 1)

    // Phase 2: arc into the boarding slot, turning to face the queue.
    const target = this.slotWorld(slotIndex)
    const endRot = this.rotForFacing('up')
    const mid = new THREE.Vector3((exitPoint.x + target.x) / 2, 0, exitPoint.z - 0.6)
    await this.anim(440, (k) => {
      const a = exitPoint.clone().lerp(mid, k)
      const b = mid.clone().lerp(target, k)
      view.group.position.copy(a.lerp(b, k))
      view.group.rotation.y = startRot + (endRot - startRot) * k
    }, easeInOutCubic)
    view.group.position.copy(target)
    view.group.rotation.y = endRot
    this.pulseSlot(slotIndex)
  }

  async animateDepart(vehicleId: number, slotIndex: number): Promise<void> {
    const view = this.views.get(vehicleId)
    if (!view) return
    this.spawnSparkles(view.group.position.clone(), view.vehicle.color)
    const start = view.group.position.clone()
    const dir = new THREE.Vector3(0, 0, -1) // drive forward off the top
    const end = start.clone().addScaledVector(dir, this.size + 4)
    await this.anim(120, (k) => {
      view.group.scale.set(1 - 0.1 * k, 1 + 0.15 * k, 1 - 0.1 * k)
    }, easeOutQuad)
    await this.anim(420, (k) => {
      view.group.position.lerpVectors(start, end, k)
      view.group.scale.setScalar(1 - 0.4 * k)
    }, easeInOutCubic)
    this.removeVehicleView(vehicleId)
    void slotIndex
  }

  pulseVehicle(vehicleId: number | null): void {
    this.hintId = vehicleId
  }

  private pulseSlot(i: number): void {
    const ring = this.slotMarkers[i]
    if (!ring) return
    const mat = ring.material as THREE.MeshBasicMaterial
    this.anim(360, (k) => {
      mat.opacity = 0.7 + 0.3 * Math.sin(k * Math.PI)
      ring.scale.setScalar(1 + 0.25 * Math.sin(k * Math.PI))
    }, linear)
  }

  screenShake(mag = 0.4, time = 0.4): void {
    this.shakeMag = mag
    this.shakeTime = time
  }

  // ---- FX particles -----------------------------------------------------

  private sparkleMat = new Map<string, THREE.MeshToonMaterial>()
  // Bright emissive material (HDR) so sparkles trigger bloom; independent of
  // the matte vehicle materials so cars don't glow.
  private getSparkleMat(c: ColorKey | 'white'): THREE.MeshToonMaterial {
    let m = this.sparkleMat.get(c)
    if (!m) {
      const hex = c === 'white' ? 0xffffff : COLOR_HEX[c]
      m = new THREE.MeshToonMaterial({
        color: 0x111111,
        emissive: hex,
        emissiveIntensity: 2.4,
        gradientMap: this.gradient,
      })
      this.sparkleMat.set(c, m)
    }
    return m
  }

  private spawnSparkles(at: THREE.Vector3, color: ColorKey): void {
    const count = 14
    for (let i = 0; i < count; i++) {
      let mesh = this.particlePool.pop()
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), this.bodyMaterial(color))
      } else {
        mesh.visible = true
      }
      mesh.material = i % 2 === 0 ? this.getSparkleMat(color) : this.getSparkleMat('white')
      mesh.position.copy(at).add(new THREE.Vector3(0, 0.6, 0))
      mesh.scale.setScalar(1)
      this.fxGroup.add(mesh)
      const ang = Math.random() * Math.PI * 2
      const sp = 2 + Math.random() * 3
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(ang) * sp, 3 + Math.random() * 3, Math.sin(ang) * sp),
        life: 0,
        ttl: 0.7 + Math.random() * 0.3,
      })
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life += dt
      p.vel.y -= 12 * dt
      p.mesh.position.addScaledVector(p.vel, dt)
      p.mesh.rotation.x += dt * 6
      p.mesh.rotation.y += dt * 4
      const k = 1 - p.life / p.ttl
      p.mesh.scale.setScalar(Math.max(0.001, k))
      if (p.life >= p.ttl) {
        p.mesh.visible = false
        this.fxGroup.remove(p.mesh)
        this.particlePool.push(p.mesh)
        this.particles.splice(i, 1)
      }
    }
  }

  // ---- camera framing ---------------------------------------------------

  private frameContent(): void {
    const half = (this.size - 1) / 2
    const margin = 1.2
    // Frame the grid + zone + horizontal row ONLY (exactly as before the L).
    // The queue's vertical tail intentionally extends above this box and is
    // clipped off the top of the screen — grid/zone size & position stay fixed.
    // Bottom edge extends to the holding row in endless mode.
    const nearZ = this.endless ? this.holdingZ + 1.2 : half + margin
    this.contentBox.min.set(-half - margin, 0, this.queueFrameZ - 1.4)
    this.contentBox.max.set(half + margin, 1.8, nearZ)
    const zoneHalfW = (this.slotSpacing * SLOT_COUNT) / 2 + 0.8
    // left edge includes the traffic light beside the front of the row
    const queueHalfW = ((QUEUE_H - 1) / 2) * QUEUE_HSPACING + 1.3
    const holdingHalfW = this.endless ? (this.holdingSpacing * HOLDING_COUNT) / 2 + 0.6 : 0
    const halfW = Math.max(zoneHalfW, queueHalfW, holdingHalfW)
    if (halfW > this.contentBox.max.x) {
      this.contentBox.min.x = -halfW
      this.contentBox.max.x = halfW
    }
    const center = new THREE.Vector3()
    this.contentBox.getCenter(center)
    this.camTarget.copy(center)

    const pitch = (56 * Math.PI) / 180
    const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch)).normalize()
    this.camBasePos.copy(center).addScaledVector(dir, 45)
    this.camera.position.copy(this.camBasePos)
    this.camera.lookAt(center)
    this.camera.updateMatrixWorld(true)
    this.applyFrustum()
  }

  private applyFrustum(): void {
    // Project content box corners into camera space, fit ortho frustum.
    const inv = this.camera.matrixWorldInverse
    const b = this.contentBox
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    const corner = new THREE.Vector3()
    for (let xi = 0; xi < 2; xi++) {
      for (let yi = 0; yi < 2; yi++) {
        for (let zi = 0; zi < 2; zi++) {
          corner.set(xi ? b.max.x : b.min.x, yi ? b.max.y : b.min.y, zi ? b.max.z : b.min.z)
          corner.applyMatrix4(inv)
          minX = Math.min(minX, corner.x)
          maxX = Math.max(maxX, corner.x)
          minY = Math.min(minY, corner.y)
          maxY = Math.max(maxY, corner.y)
        }
      }
    }
    let halfW = (maxX - minX) / 2
    let halfH = (maxY - minY) / 2
    halfW *= 1.06
    halfH *= 1.06
    const w = this.host.clientWidth || 1
    const h = this.host.clientHeight || 1
    const aspect = w / h
    if (halfW / halfH < aspect) halfW = halfH * aspect
    else halfH = halfW / aspect
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    this.camera.left = cx - halfW
    this.camera.right = cx + halfW
    this.camera.top = cy + halfH
    this.camera.bottom = cy - halfH
    this.camera.updateProjectionMatrix()
  }

  resize(): void {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.composer.setSize(w, h)
    this.bloomPass.setSize(w, h)
    this.applyFrustum()
  }

  // ---- picking ----------------------------------------------------------

  private raycaster = new THREE.Raycaster()
  private ndc = new THREE.Vector2()

  pickVehicle(clientX: number, clientY: number): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.ndc, this.camera)
    const hits = this.raycaster.intersectObjects(this.vehicleGroup.children, true)
    if (hits.length === 0) return null
    let obj: THREE.Object3D | null = hits[0].object
    while (obj && obj.parent !== this.vehicleGroup) obj = obj.parent
    if (!obj) return null
    for (const [id, view] of this.views) {
      if (view.group === obj) return id
    }
    return null
  }

  // ---- loop / cleanup ---------------------------------------------------

  private anim(duration: number, update: (k: number) => void, easing = easeOutCubic): Promise<void> {
    return this.tween.add(duration, update, easing)
  }

  update(): void {
    const dt = Math.min(0.05, this.clock.getDelta())
    this.tween.step(dt * 1000)
    this.updateParticles(dt)

    // Queue passengers ease toward their slot (slide-left as the line advances)
    // and descend from the top-right entry point; plus a gentle idle bob.
    const t = this.clock.elapsedTime
    const ef = 1 - Math.pow(0.001, dt)
    this.queueMeshes.forEach((m, i) => {
      const bob = Math.abs(Math.sin(t * 2 + i * 0.6)) * 0.06
      if (t < (m.userData.activateAt ?? 0)) {
        m.position.y = (m.userData.gy ?? 0) + bob
        return
      }
      const tgt = this.queueWorld(i)
      m.position.x += (tgt.x - m.position.x) * ef
      m.position.z += (tgt.z - m.position.z) * ef
      const gy = (m.userData.gy ?? 0) * (1 - ef)
      m.userData.gy = gy
      m.position.y = gy + bob
    })

    // hint pulse
    if (this.hintId !== null) {
      const view = this.views.get(this.hintId)
      if (view) {
        const s = 1 + Math.sin(t * 8) * 0.06
        view.group.scale.setScalar(s)
      }
    }

    // screen shake
    if (this.shakeTime > 0) {
      this.shakeTime -= dt
      const m = this.shakeMag * Math.max(0, this.shakeTime)
      this.camera.position.set(
        this.camBasePos.x + (Math.random() - 0.5) * m,
        this.camBasePos.y + (Math.random() - 0.5) * m,
        this.camBasePos.z + (Math.random() - 0.5) * m,
      )
      this.camera.lookAt(this.camTarget)
    } else if (!this.camera.position.equals(this.camBasePos)) {
      this.camera.position.copy(this.camBasePos)
      this.camera.lookAt(this.camTarget)
    }

    this.composer.render()
  }

  clearHint(): void {
    if (this.hintId !== null) {
      const view = this.views.get(this.hintId)
      if (view) view.group.scale.setScalar(1)
    }
    this.hintId = null
  }

  private removeVehicleView(id: number): void {
    const view = this.views.get(id)
    if (!view) return
    this.vehicleGroup.remove(view.group)
    view.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose()
      }
    })
    this.views.delete(id)
  }

  private disposeLevel(): void {
    this.tween.clear()
    for (const id of [...this.views.keys()]) this.removeVehicleView(id)
    for (const m of this.queueMeshes) this.recyclePassenger(m)
    this.queueMeshes = []
    for (const p of this.particles) {
      p.mesh.visible = false
      this.fxGroup.remove(p.mesh)
      this.particlePool.push(p.mesh)
    }
    this.particles = []
    this.boardGroup.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose()
    })
    this.boardGroup.clear()
    this.slotMarkers = []
  }

  dispose(): void {
    this.disposeLevel()
    this.composer.dispose()
    this.renderer.dispose()
    if (this.renderer.domElement.parentElement === this.host) {
      this.host.removeChild(this.renderer.domElement)
    }
  }
}
