/* ===========================================================================
 * Vehicle.ts — procedural low-poly cars whose silhouette changes with capacity:
 *   length 2 → compact car (hood + trunk, sloped cabin)
 *   length 3 → van / SUV (tall boxy greenhouse, roof rack)
 *   length 4 → bus (long, flat roof, window band, destination sign)
 *
 * Each is built from merged BoxGeometry plus CylinderGeometry wheels, with
 * little emissive head/tail lights for charm. Floating roof pips show seats
 * still to fill. Motion is waypoint based: dispatch() slides the car out of the
 * lot and routes it to a bay (ending facing UP so it stays narrow and never
 * overlaps a neighbouring bay); depart() drives it straight up off the top.
 * ========================================================================= */

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Orient } from './types'

export const CELL = 1.02 // world size of one grid cell (kept small + tidy)

export const CAR_COLORS = [
  0xff5a5f, 0x3da5ff, 0xffc93c, 0x4cd97b, 0xb085f5, 0xff8c42, 0x2ec4b6, 0xf06595,
]

const WHEEL_R = 0.15
const WHEEL_W = 0.11
const BASE_Y = WHEEL_R

const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_W, 12)
wheelGeo.rotateX(Math.PI / 2)
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.85 })
const hubGeo = new THREE.CylinderGeometry(WHEEL_R * 0.5, WHEEL_R * 0.5, WHEEL_W + 0.02, 8)
hubGeo.rotateX(Math.PI / 2)
const hubMat = new THREE.MeshStandardMaterial({ color: 0xd6dde6, roughness: 0.4, metalness: 0.5 })
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x1a2733,
  roughness: 0.12,
  metalness: 0.3,
  emissive: 0x0a1018,
  emissiveIntensity: 0.5,
})
const headMat = new THREE.MeshStandardMaterial({ color: 0xfff3c0, emissive: 0xfff0b0, emissiveIntensity: 0.9, roughness: 0.4 })
const tailMat = new THREE.MeshStandardMaterial({ color: 0xff4030, emissive: 0xff2818, emissiveIntensity: 0.9, roughness: 0.4 })
const signMat = new THREE.MeshStandardMaterial({ color: 0x2c3340, roughness: 0.6 })
const lightGeo = new THREE.BoxGeometry(0.06, 0.07, 0.1)
const pipGeo = new THREE.SphereGeometry(0.1, 12, 8)

type Kind = 'car' | 'van' | 'bus'
function kindOf(length: number): Kind {
  return length <= 2 ? 'car' : length === 3 ? 'van' : 'bus'
}

/** Outer dimensions of a car of a given length. */
function carDims(length: number) {
  return { len: length * CELL * 0.82, wid: CELL * 0.56 }
}
/** Roof height (for pip placement). */
function roofTop(length: number) {
  const k = kindOf(length)
  return k === 'bus' ? 0.62 : k === 'van' ? 0.56 : 0.44
}

type Built = { body: THREE.BufferGeometry; glass: THREE.BufferGeometry; sign?: THREE.BufferGeometry }
const builtCache = new Map<number, Built>()

function build(length: number): Built {
  const { len, wid } = carDims(length)
  const k = kindOf(length)
  const parts: THREE.BufferGeometry[] = []
  let glass: THREE.BufferGeometry
  let sign: THREE.BufferGeometry | undefined

  if (k === 'car') {
    const ch = 0.2
    const chassis = new THREE.BoxGeometry(len, ch, wid)
    chassis.translate(0, ch / 2 + 0.02, 0)
    parts.push(chassis)
    const cabin = new THREE.BoxGeometry(len * 0.46, 0.2, wid * 0.84)
    cabin.translate(-len * 0.02, ch + 0.12, 0)
    parts.push(cabin)
    const hood = new THREE.BoxGeometry(len * 0.26, 0.13, wid * 0.94)
    hood.translate(len * 0.36, ch * 0.7 + 0.04, 0)
    parts.push(hood)
    const trunk = new THREE.BoxGeometry(len * 0.16, 0.12, wid * 0.92)
    trunk.translate(-len * 0.42, ch * 0.6 + 0.04, 0)
    parts.push(trunk)
    glass = new THREE.BoxGeometry(len * 0.42, 0.15, wid * 0.9)
    glass.translate(-len * 0.02, ch + 0.13, 0)
  } else if (k === 'van') {
    const ch = 0.42
    const body = new THREE.BoxGeometry(len, ch, wid)
    body.translate(0, ch / 2 + 0.02, 0)
    parts.push(body)
    const hood = new THREE.BoxGeometry(len * 0.22, 0.2, wid * 0.96)
    hood.translate(len * 0.42, 0.16, 0)
    parts.push(hood)
    const roof = new THREE.BoxGeometry(len * 0.7, 0.06, wid * 0.84)
    roof.translate(-len * 0.06, ch + 0.06, 0)
    parts.push(roof) // roof rack hint
    glass = new THREE.BoxGeometry(len * 0.62, 0.22, wid * 0.98)
    glass.translate(-len * 0.04, ch * 0.66, 0)
  } else {
    const ch = 0.6
    const body = new THREE.BoxGeometry(len, ch, wid)
    body.translate(0, ch / 2 + 0.02, 0)
    parts.push(body)
    const roof = new THREE.BoxGeometry(len * 0.97, 0.08, wid * 0.92)
    roof.translate(0, ch + 0.06, 0)
    parts.push(roof)
    glass = new THREE.BoxGeometry(len * 0.82, 0.2, wid * 1.0)
    glass.translate(len * 0.02, ch * 0.66, 0)
    sign = new THREE.BoxGeometry(len * 0.34, 0.12, wid * 0.5)
    sign.translate(len * 0.5 - 0.02, ch * 0.78, 0)
  }

  const body = mergeGeometries(parts, false)!
  parts.forEach((p) => p.dispose())
  return { body, glass, sign }
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
  private glass: THREE.Mesh
  private sign: THREE.Mesh
  private lights: THREE.Mesh[] = []
  private wheels: THREE.Group[] = []
  private bodyMat: THREE.MeshStandardMaterial
  private pipGroup = new THREE.Group()
  private pips: THREE.Mesh[] = []
  private builtLen = -1

  private path: THREE.Vector3[] = []
  private speed = 0
  private faceAngle = 0

  constructor() {
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.12 })
    this.body = new THREE.Mesh(undefined as unknown as THREE.BufferGeometry, this.bodyMat)
    this.body.castShadow = true
    this.body.position.y = BASE_Y
    this.group.add(this.body)
    this.glass = new THREE.Mesh(undefined as unknown as THREE.BufferGeometry, glassMat)
    this.glass.position.y = BASE_Y
    this.group.add(this.glass)
    this.sign = new THREE.Mesh(undefined as unknown as THREE.BufferGeometry, signMat)
    this.sign.position.y = BASE_Y
    this.group.add(this.sign)
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(lightGeo, i < 2 ? headMat : tailMat)
      this.lights.push(m)
      this.group.add(m)
    }
    this.group.add(this.pipGroup)
    this.body.userData.vehicle = this
    this.group.visible = false
  }

  private color() {
    return CAR_COLORS[this.colorIndex % CAR_COLORS.length]
  }

  private rebuild(length: number) {
    if (this.builtLen === length) return
    this.builtLen = length
    const b = built(length)
    this.body.geometry = b.body
    this.glass.geometry = b.glass
    this.sign.visible = !!b.sign
    if (b.sign) this.sign.geometry = b.sign

    for (const w of this.wheels) this.group.remove(w)
    this.wheels = []
    const { len, wid } = carDims(length)
    const pairs = length >= 4 ? 3 : 2
    for (let p = 0; p < pairs; p++) {
      const fx = pairs === 3 ? len * (0.34 - p * 0.34) : len * (0.3 - p * 0.6)
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
    // head/tail lights at the ends
    const ly = BASE_Y + (kindOf(length) === 'bus' ? 0.18 : 0.12)
    const fxFront = len * 0.5 - 0.02
    this.lights[0].position.set(fxFront, ly, wid * 0.32)
    this.lights[1].position.set(fxFront, ly, -wid * 0.32)
    this.lights[2].position.set(-fxFront, ly, wid * 0.32)
    this.lights[3].position.set(-fxFront, ly, -wid * 0.32)
  }

  private buildPips(n: number) {
    for (const p of this.pips) this.pipGroup.remove(p)
    this.pips = []
    const mat = new THREE.MeshStandardMaterial({
      color: this.color(),
      emissive: this.color(),
      emissiveIntensity: 0.45,
      roughness: 0.4,
    })
    const { len } = carDims(this.length)
    const spread = Math.min(0.26, (len * 0.72) / Math.max(1, n))
    const start = -((n - 1) * spread) / 2
    this.pipGroup.position.y = BASE_Y + roofTop(this.length) + 0.18
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
    this.faceAngle = orient === 'h' ? Math.PI : Math.PI / 2 // h → -X, v → -Z
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
