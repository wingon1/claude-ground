/* ===========================================================================
 * Car.ts — procedural low-poly cars + per-car animation, with object pooling.
 *
 * A car is a THREE.Group built from BoxGeometry (body, cabin, windows) and
 * CylinderGeometry (wheels). The body boxes are merged into a single mesh to
 * keep draw calls/polys low; wheels stay separate so they can spin while the
 * car moves. Cars are pooled by length (2 = sedan, 3 = truck) and reused across
 * levels so transitions allocate nothing — no GC churn, no leaks.
 * ========================================================================= */

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Orient } from './types'

const CELL = 1

/** Vibrant, distinct toy-car colours. */
export const CAR_COLORS = [
  0xff5a5f, // coral red
  0x3da5ff, // sky blue
  0xffc93c, // sunflower
  0x4cd97b, // mint green
  0xb085f5, // lavender
  0xff8c42, // orange
  0x2ec4b6, // teal
  0xf06595, // pink
]

const WHEEL_R = 0.17
const WHEEL_W = 0.13
const BASE_Y = WHEEL_R // sit the wheels on the ground

// ---- shared geometry / materials (built once) ----------------------------

const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_W, 12)
wheelGeo.rotateX(Math.PI / 2) // axle along local Z so wheels roll about Z
const wheelMat = new THREE.MeshStandardMaterial({
  color: 0x20242b,
  roughness: 0.85,
  metalness: 0.1,
})
const hubMat = new THREE.MeshStandardMaterial({
  color: 0xcfd6df,
  roughness: 0.4,
  metalness: 0.5,
})
const hubGeo = new THREE.CylinderGeometry(WHEEL_R * 0.5, WHEEL_R * 0.5, WHEEL_W + 0.02, 8)
hubGeo.rotateX(Math.PI / 2)
const windowMat = new THREE.MeshStandardMaterial({
  color: 0x16202b,
  roughness: 0.15,
  metalness: 0.2,
  emissive: 0x0a1018,
  emissiveIntensity: 0.4,
})

/** Build the merged body geometry for a car of the given length. */
function buildBodyGeometry(length: number): THREE.BufferGeometry {
  const len = length * CELL
  const bodyW = 0.78
  const parts: THREE.BufferGeometry[] = []

  // lower chassis
  const chassis = new THREE.BoxGeometry(len * 0.94, 0.26, bodyW)
  chassis.translate(0, 0.05, 0)
  parts.push(chassis)

  // upper hull / cabin — shorter and tucked toward the rear for a "car" look
  const cabinLen = length === 2 ? len * 0.52 : len * 0.42
  const cabin = new THREE.BoxGeometry(cabinLen, 0.24, bodyW * 0.86)
  cabin.translate(length === 2 ? -len * 0.04 : len * 0.12, 0.27, 0)
  parts.push(cabin)

  // a little hood/nose wedge up front
  const hood = new THREE.BoxGeometry(len * 0.3, 0.16, bodyW * 0.9)
  hood.translate(len * 0.3, 0.18, 0)
  parts.push(hood)

  const merged = mergeGeometries(parts, false)!
  parts.forEach((p) => p.dispose())
  return merged
}

const bodyGeoCache = new Map<number, THREE.BufferGeometry>()
function bodyGeometry(length: number) {
  let g = bodyGeoCache.get(length)
  if (!g) {
    g = buildBodyGeometry(length)
    bodyGeoCache.set(length, g)
  }
  return g
}

function buildWindowGeometry(length: number): THREE.BufferGeometry {
  const len = length * CELL
  const cabinLen = length === 2 ? len * 0.5 : len * 0.4
  const g = new THREE.BoxGeometry(cabinLen, 0.16, 0.74)
  g.translate(length === 2 ? -len * 0.04 : len * 0.12, 0.29, 0)
  return g
}

export type CarState = 'idle' | 'dragging' | 'escaping' | 'gone'

export class Car {
  id = -1
  length: number
  orient: Orient = 'h'
  anchor = 0
  lane = 0
  colorIndex = 0
  state: CarState = 'idle'

  readonly group: THREE.Group
  readonly body: THREE.Mesh
  private wheels: THREE.Group[] = []
  private bodyMat: THREE.MeshStandardMaterial

  private gridSize = 6
  private floatAnchor = 0
  private lastAlong = 0
  private slideTarget: number | null = null

  // squish spring (s = displacement, v = velocity)
  private squish = 0
  private squishVel = 0

  // escape motion
  private escapeDir = 1
  private escapeSpeed = 0
  private escapeTravel = 0

  constructor(length: number) {
    this.length = length
    this.group = new THREE.Group()

    this.bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.12,
    })
    this.body = new THREE.Mesh(bodyGeometry(length), this.bodyMat)
    this.body.castShadow = true
    this.body.position.y = BASE_Y
    this.group.add(this.body)

    const win = new THREE.Mesh(buildWindowGeometry(length), windowMat)
    win.position.y = BASE_Y
    win.castShadow = true
    this.group.add(win)

    // four wheels at the corners
    const len = length * CELL
    const wx = len * 0.32
    const wz = 0.34
    for (const [sx, sz] of [
      [wx, wz],
      [wx, -wz],
      [-wx, wz],
      [-wx, -wz],
    ]) {
      const wg = new THREE.Group()
      const tire = new THREE.Mesh(wheelGeo, wheelMat)
      tire.castShadow = true
      const hub = new THREE.Mesh(hubGeo, hubMat)
      wg.add(tire, hub)
      wg.position.set(sx, BASE_Y, sz)
      this.wheels.push(wg)
      this.group.add(wg)
    }

    this.body.userData.car = this
    this.group.visible = false
  }

  /** Configure this car for a placement and snap it into world position. */
  init(
    id: number,
    colorIndex: number,
    orient: Orient,
    anchor: number,
    lane: number,
    gridSize: number,
  ) {
    this.id = id
    this.colorIndex = colorIndex
    this.orient = orient
    this.anchor = anchor
    this.lane = lane
    this.gridSize = gridSize
    this.state = 'idle'
    this.squish = 0
    this.squishVel = 0
    this.escapeSpeed = 0
    this.escapeTravel = 0
    this.floatAnchor = anchor
    this.lastAlong = anchor
    this.bodyMat.color.setHex(CAR_COLORS[colorIndex % CAR_COLORS.length])
    this.group.rotation.y = orient === 'v' ? Math.PI / 2 : 0
    this.group.scale.set(1, 1, 1)
    this.group.visible = true
    this.applyWorld(anchor)
  }

  private worldFromAnchor(a: number): [number, number] {
    const centerCell = a + (this.length - 1) / 2
    const along = (centerCell - (this.gridSize - 1) / 2) * CELL
    const lane = (this.lane - (this.gridSize - 1) / 2) * CELL
    return this.orient === 'h' ? [along, lane] : [lane, along]
  }

  /** Move the group to a (possibly fractional) anchor and roll the wheels. */
  applyWorld(a: number) {
    this.floatAnchor = a
    const [x, z] = this.worldFromAnchor(a)
    this.group.position.x = x
    this.group.position.z = z
    const d = (a - this.lastAlong) * CELL
    this.lastAlong = a
    const spin = -d / WHEEL_R
    for (const w of this.wheels) w.rotation.z += spin
  }

  /** Current (possibly fractional) anchor — used to settle on release. */
  floatAnchorValue() {
    return this.floatAnchor
  }

  /** Smoothly glide to an integer anchor (snap animation). */
  slideTo(anchor: number) {
    this.slideTarget = anchor
  }

  cancelSlide() {
    this.slideTarget = null
  }

  /** Bring a previously-escaped car back onto the board (undo). */
  reviveAt(anchor: number) {
    this.state = 'idle'
    this.anchor = anchor
    this.slideTarget = null
    this.escapeSpeed = 0
    this.escapeTravel = 0
    this.group.visible = true
    this.applyWorld(anchor)
  }

  /** Kick the squash-and-stretch spring (used on a blocked bump). */
  bump() {
    this.squishVel = -9
  }

  /** Begin driving off the board. dir = +1 toward high edge, -1 toward low. */
  escape(dir: number) {
    this.state = 'escaping'
    this.escapeDir = dir
    this.escapeSpeed = 2.5
    this.escapeTravel = 0
  }

  /** Per-frame animation. Returns true when an escaping car has fully left. */
  update(dt: number): boolean {
    // squish spring → critically-ish damped return to 0
    const k = 220
    const c = 14
    const a = -k * this.squish - c * this.squishVel
    this.squishVel += a * dt
    this.squish += this.squishVel * dt
    const s = this.squish
    // local +X is the motion axis; squash along it, bulge sideways + up
    this.group.scale.set(1 + s * 0.45, 1 - s * 0.25, 1 - s * 0.3)

    // snap-glide toward an integer cell after a release
    if (this.slideTarget !== null && this.state === 'idle') {
      const cur = this.floatAnchor
      const next = cur + (this.slideTarget - cur) * Math.min(1, dt * 16)
      if (Math.abs(this.slideTarget - next) < 0.002) {
        this.applyWorld(this.slideTarget)
        this.slideTarget = null
      } else {
        this.applyWorld(next)
      }
    }

    if (this.state === 'escaping') {
      this.escapeSpeed += 14 * dt
      const step = this.escapeDir * this.escapeSpeed * dt
      this.applyWorld(this.floatAnchor + step)
      this.escapeTravel += Math.abs(step)
      if (this.escapeTravel > this.gridSize + this.length + 3) {
        this.state = 'gone'
        this.group.visible = false
        return true
      }
    }
    return false
  }

  /** World position of the car's tail, for spawning exhaust particles. */
  tailWorld(out: THREE.Vector3) {
    const back = -this.escapeDir * (this.length * 0.5 + 0.1)
    out.set(back, BASE_Y + 0.1, 0)
    out.applyMatrix4(this.group.matrixWorld)
    return out
  }
}

// ---- pool -----------------------------------------------------------------

export class CarPool {
  private scene: THREE.Scene
  private free2: Car[] = []
  private free3: Car[] = []
  /** Body meshes of currently-active cars, for raycasting. */
  pickable: THREE.Mesh[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  acquire(length: number): Car {
    const pool = length === 3 ? this.free3 : this.free2
    let car = pool.pop()
    if (!car) {
      car = new Car(length)
      this.scene.add(car.group)
    }
    this.pickable.push(car.body)
    return car
  }

  release(car: Car) {
    car.group.visible = false
    car.state = 'idle'
    const i = this.pickable.indexOf(car.body)
    if (i !== -1) this.pickable.splice(i, 1)
    ;(car.length === 3 ? this.free3 : this.free2).push(car)
  }
}
