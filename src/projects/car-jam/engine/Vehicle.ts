/* ===========================================================================
 * Vehicle.ts — procedural low-poly cars whose size/design scales with capacity:
 *   length 2 → compact car, 3 → van, 4+ → bus (taller, boxier cabin).
 *
 * Built from merged BoxGeometry (body/cabin/hood) + CylinderGeometry wheels.
 * Floating roof pips show seats still to fill. Motion is waypoint based:
 * dispatch() slides the car out of the lot and routes it to a boarding bay;
 * depart() drives it straight up off the top once full. Pooled per (length).
 * ========================================================================= */

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Orient } from './types'

export const CELL = 1.3 // world size of one grid cell

export const CAR_COLORS = [
  0xff5a5f, 0x3da5ff, 0xffc93c, 0x4cd97b, 0xb085f5, 0xff8c42, 0x2ec4b6, 0xf06595,
]

const WHEEL_R = 0.17
const WHEEL_W = 0.13
const BASE_Y = WHEEL_R

const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_W, 12)
wheelGeo.rotateX(Math.PI / 2)
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.85 })
const hubGeo = new THREE.CylinderGeometry(WHEEL_R * 0.5, WHEEL_R * 0.5, WHEEL_W + 0.02, 8)
hubGeo.rotateX(Math.PI / 2)
const hubMat = new THREE.MeshStandardMaterial({ color: 0xcfd6df, roughness: 0.4, metalness: 0.5 })
const windowMat = new THREE.MeshStandardMaterial({
  color: 0x16202b,
  roughness: 0.15,
  emissive: 0x0a1018,
  emissiveIntensity: 0.4,
})
const pipGeo = new THREE.SphereGeometry(0.11, 12, 8)

/** Outer dimensions of a car of a given length (in world units). */
function carDims(length: number) {
  const len = length * CELL * 0.9
  const wid = CELL * 0.62
  return { len, wid }
}

type Built = { body: THREE.BufferGeometry; glass: THREE.BufferGeometry }
const builtCache = new Map<number, Built>()

function build(length: number): Built {
  const { len, wid } = carDims(length)
  const bus = length >= 4
  const parts: THREE.BufferGeometry[] = []

  const chassisH = bus ? 0.5 : 0.28
  const chassis = new THREE.BoxGeometry(len, chassisH, wid)
  chassis.translate(0, chassisH / 2 + 0.02, 0)
  parts.push(chassis)

  if (bus) {
    // bus: tall roof box spanning most of the length
    const roof = new THREE.BoxGeometry(len * 0.96, 0.12, wid * 0.96)
    roof.translate(0, chassisH + 0.08, 0)
    parts.push(roof)
  } else {
    const cabinLen = length === 2 ? len * 0.5 : len * 0.46
    const cabin = new THREE.BoxGeometry(cabinLen, 0.24, wid * 0.86)
    cabin.translate(-len * 0.05, chassisH + 0.12, 0)
    parts.push(cabin)
    const hood = new THREE.BoxGeometry(len * 0.28, 0.14, wid * 0.9)
    hood.translate(len * 0.34, chassisH - 0.02, 0)
    parts.push(hood)
  }

  const body = mergeGeometries(parts, false)!
  parts.forEach((p) => p.dispose())

  // glass strip
  let glass: THREE.BufferGeometry
  if (bus) {
    glass = new THREE.BoxGeometry(len * 0.84, 0.18, wid * 0.98)
    glass.translate(0, chassisH * 0.62, 0)
  } else {
    const cabinLen = length === 2 ? len * 0.46 : len * 0.42
    glass = new THREE.BoxGeometry(cabinLen, 0.16, wid * 0.92)
    glass.translate(-len * 0.05, chassisH + 0.13, 0)
  }
  return { body, glass }
}

function built(length: number): Built {
  let b = builtCache.get(length)
  if (!b) {
    b = build(length)
    builtCache.set(length, b)
  }
  return b
}

const _v = new THREE.Vector3()

export type VState = 'parked' | 'driving' | 'boarding' | 'departing' | 'gone'

export class Vehicle {
  id = -1
  colorIndex = 0
  length = 2
  orient: Orient = 'h'
  anchor = 0
  lane = 0
  seats = 0
  pending = 0
  dispatched = false
  slot = -1
  state: VState = 'parked'

  readonly group = new THREE.Group()
  readonly body: THREE.Mesh
  private wheels: THREE.Group[] = []
  private bodyMat: THREE.MeshStandardMaterial
  private pipGroup = new THREE.Group()
  private pips: THREE.Mesh[] = []
  private builtLen = -1

  private path: THREE.Vector3[] = []
  private speed = 0
  private faceAngle = 0

  constructor() {
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.12 })
    this.body = new THREE.Mesh(undefined as unknown as THREE.BufferGeometry, this.bodyMat)
    this.body.castShadow = true
    this.body.position.y = BASE_Y
    this.group.add(this.body)
    this.glass = new THREE.Mesh(undefined as unknown as THREE.BufferGeometry, windowMat)
    this.glass.position.y = BASE_Y
    this.group.add(this.glass)
    this.group.add(this.pipGroup)
    this.body.userData.vehicle = this
    this.group.visible = false
  }
  private glass: THREE.Mesh

  private color() {
    return CAR_COLORS[this.colorIndex % CAR_COLORS.length]
  }

  private rebuild(length: number) {
    if (this.builtLen === length) return
    this.builtLen = length
    const b = built(length)
    this.body.geometry = b.body
    this.glass.geometry = b.glass
    // wheels
    for (const w of this.wheels) this.group.remove(w)
    this.wheels = []
    const { len, wid } = carDims(length)
    const pairs = length >= 4 ? 3 : 2
    for (let p = 0; p < pairs; p++) {
      const fx = len * (pairs === 3 ? 0.34 - p * 0.34 : 0.3 - p * 0.6)
      for (const sz of [wid * 0.5, -wid * 0.5]) {
        const wg = new THREE.Group()
        const tire = new THREE.Mesh(wheelGeo, wheelMat)
        tire.castShadow = true
        wg.add(tire, new THREE.Mesh(hubGeo, hubMat))
        wg.position.set(fx, BASE_Y, sz)
        this.wheels.push(wg)
        this.group.add(wg)
      }
    }
  }

  private buildPips(n: number) {
    for (const p of this.pips) this.pipGroup.remove(p)
    this.pips = []
    const mat = new THREE.MeshStandardMaterial({
      color: this.color(),
      emissive: this.color(),
      emissiveIntensity: 0.4,
      roughness: 0.4,
    })
    const { len } = carDims(this.length)
    const spread = Math.min(0.3, (len * 0.7) / Math.max(1, n))
    const start = -((n - 1) * spread) / 2
    const top = (this.length >= 4 ? 0.62 : 0.5) + BASE_Y + 0.18
    this.pipGroup.position.y = top
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(pipGeo, mat)
      m.position.set(start + i * spread, 0, 0)
      m.castShadow = true
      this.pipGroup.add(m)
      this.pips.push(m)
    }
  }

  init(id: number, colorIndex: number, length: number, orient: Orient, anchor: number, lane: number, x: number, z: number) {
    this.id = id
    this.colorIndex = colorIndex
    this.length = length
    this.orient = orient
    this.anchor = anchor
    this.lane = lane
    this.seats = length
    this.pending = 0
    this.dispatched = false
    this.slot = -1
    this.state = 'parked'
    this.path = []
    this.speed = 0
    this.rebuild(length)
    this.bodyMat.color.setHex(this.color())
    this.buildPips(length)
    // face the exit direction: h → -X (left), v → -Z (up)
    this.faceAngle = orient === 'h' ? Math.PI : Math.PI / 2
    this.group.position.set(x, 0, z)
    this.group.rotation.y = this.faceAngle
    this.group.scale.setScalar(1)
    this.group.visible = true
  }

  popPip() {
    const m = this.pips.pop()
    if (m) this.pipGroup.remove(m)
  }
  freeSeats() {
    return this.seats
  }

  dispatch(slot: number, waypoints: THREE.Vector3[]) {
    this.dispatched = true
    this.slot = slot
    this.state = 'driving'
    this.path = waypoints.map((w) => w.clone())
    this.speed = 4
  }

  depart(exit: THREE.Vector3) {
    this.state = 'departing'
    this.path = [exit.clone()]
    this.speed = 3
  }

  tail(out: THREE.Vector3) {
    const { len } = carDims(this.length)
    out.set(-len * 0.5 - 0.1, BASE_Y + 0.1, 0).applyMatrix4(this.group.matrixWorld)
    return out
  }

  update(dt: number): void {
    this.pipGroup.rotation.y += dt * 1.2
    if (this.path.length === 0) {
      if (this.state === 'driving') this.state = 'boarding'
      return
    }
    const target = this.path[0]
    const pos = this.group.position
    _v.copy(target).sub(pos)
    _v.y = 0
    const dist = _v.length()
    this.speed = Math.min(this.speed + dt * 10, this.state === 'departing' ? 12 : 7)
    const step = Math.min(this.speed * dt, dist)
    if (dist > 1e-4) {
      _v.normalize()
      pos.addScaledVector(_v, step)
      const want = Math.atan2(_v.x, _v.z) - Math.PI / 2
      let d = want - this.faceAngle
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      this.faceAngle += d * Math.min(1, dt * 12)
      this.group.rotation.y = this.faceAngle
      for (const w of this.wheels) w.rotation.z -= step / WHEEL_R
    }
    if (dist <= step + 1e-3) {
      pos.copy(target)
      pos.y = 0
      this.path.shift()
      if (this.path.length === 0) {
        if (this.state === 'driving') this.state = 'boarding'
        else if (this.state === 'departing') {
          this.state = 'gone'
          this.group.visible = false
        }
      }
    }
  }
}

export class VehiclePool {
  private free: Vehicle[] = []
  pickable: THREE.Mesh[] = []
  private scene: THREE.Scene
  constructor(scene: THREE.Scene) {
    this.scene = scene
  }
  acquire(): Vehicle {
    let v = this.free.pop()
    if (!v) {
      v = new Vehicle()
      this.scene.add(v.group)
    }
    this.pickable.push(v.body)
    return v
  }
  unpick(v: Vehicle) {
    const i = this.pickable.indexOf(v.body)
    if (i !== -1) this.pickable.splice(i, 1)
  }
  release(v: Vehicle) {
    v.group.visible = false
    this.unpick(v)
    this.free.push(v)
  }
}
