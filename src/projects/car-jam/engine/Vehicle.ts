/* ===========================================================================
 * Vehicle.ts — procedural low-poly cars with seat indicators + drive animation.
 *
 * A car is built from merged BoxGeometry (body/cabin/hood) plus CylinderGeometry
 * wheels that spin while moving. Above the roof float small "seat" pips showing
 * how many passengers still need to board; they pop as people get in. Cars are
 * pooled and reused across levels.
 *
 * Motion is waypoint based: dispatch() drives the car out of the lot to a
 * boarding slot, depart() drives it off-screen once full. update() eases the
 * car toward its current waypoint and rolls the wheels by the distance moved.
 * ========================================================================= */

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

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
const BASE_Y = WHEEL_R
const LEN = 1.35 // body length (along local +X / facing dir)

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
const pipGeo = new THREE.SphereGeometry(0.12, 12, 8)

function buildBody(): THREE.BufferGeometry {
  const w = 0.8
  const parts: THREE.BufferGeometry[] = []
  const chassis = new THREE.BoxGeometry(LEN, 0.26, w)
  chassis.translate(0, 0.05, 0)
  parts.push(chassis)
  const cabin = new THREE.BoxGeometry(LEN * 0.52, 0.24, w * 0.86)
  cabin.translate(-LEN * 0.04, 0.27, 0)
  parts.push(cabin)
  const hood = new THREE.BoxGeometry(LEN * 0.3, 0.16, w * 0.9)
  hood.translate(LEN * 0.32, 0.18, 0)
  parts.push(hood)
  const merged = mergeGeometries(parts, false)!
  parts.forEach((p) => p.dispose())
  return merged
}
const bodyGeo = buildBody()
function buildWindow(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(LEN * 0.5, 0.16, 0.74)
  g.translate(-LEN * 0.04, 0.29, 0)
  return g
}
const winGeo = buildWindow()

const _v = new THREE.Vector3()

export type VState = 'parked' | 'driving' | 'boarding' | 'departing' | 'gone'

export class Vehicle {
  id = -1
  colorIndex = 0
  col = 0
  row = 0
  seats = 0 // remaining unreserved seats
  pending = 0 // passengers currently walking toward this car
  dispatched = false
  slot = -1
  state: VState = 'parked'

  readonly group = new THREE.Group()
  readonly body: THREE.Mesh
  private wheels: THREE.Group[] = []
  private bodyMat: THREE.MeshStandardMaterial
  private pipGroup = new THREE.Group()
  private pips: THREE.Mesh[] = []

  // waypoint queue in world space; the car eases through them in order
  private path: THREE.Vector3[] = []
  private speed = 0
  private faceAngle = 0

  constructor() {
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0.12 })
    this.body = new THREE.Mesh(bodyGeo, this.bodyMat)
    this.body.castShadow = true
    this.body.position.y = BASE_Y
    this.group.add(this.body)

    const win = new THREE.Mesh(winGeo, windowMat)
    win.position.y = BASE_Y
    this.group.add(win)

    const wx = LEN * 0.32
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
      wg.add(tire, new THREE.Mesh(hubGeo, hubMat))
      wg.position.set(sx, BASE_Y, sz)
      this.wheels.push(wg)
      this.group.add(wg)
    }

    this.pipGroup.position.y = BASE_Y + 0.55
    this.group.add(this.pipGroup)

    this.body.userData.vehicle = this
    this.group.visible = false
  }

  private color() {
    return CAR_COLORS[this.colorIndex % CAR_COLORS.length]
  }

  init(id: number, colorIndex: number, seats: number, col: number, row: number, x: number, z: number) {
    this.id = id
    this.colorIndex = colorIndex
    this.seats = seats
    this.pending = 0
    this.col = col
    this.row = row
    this.dispatched = false
    this.slot = -1
    this.state = 'parked'
    this.path = []
    this.speed = 0
    this.faceAngle = 0
    this.bodyMat.color.setHex(this.color())
    this.group.position.set(x, 0, z)
    // face +Z (toward the boarding lane at the front of the lot)
    this.faceAngle = -Math.PI / 2
    this.group.rotation.y = this.faceAngle
    this.group.scale.setScalar(1)
    this.group.visible = true
    this.buildPips(seats)
  }

  private buildPips(n: number) {
    for (const p of this.pips) this.pipGroup.remove(p)
    this.pips = []
    const mat = new THREE.MeshStandardMaterial({
      color: this.color(),
      emissive: this.color(),
      emissiveIntensity: 0.35,
      roughness: 0.4,
    })
    const spread = 0.26
    const start = -((n - 1) * spread) / 2
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(pipGeo, mat)
      m.position.set(start + i * spread, 0, 0)
      m.castShadow = true
      this.pipGroup.add(m)
      this.pips.push(m)
    }
  }

  /** Remaining pips = seats not yet filled (reserved seats already popped). */
  popPip() {
    const m = this.pips.pop()
    if (m) {
      m.scale.setScalar(0.01)
      this.pipGroup.remove(m)
    }
  }

  /** Total seats still available to assign to a waiting passenger. */
  freeSeats() {
    return this.seats
  }

  /** Drive from the lot through the given waypoints to a boarding slot. */
  dispatch(slot: number, waypoints: THREE.Vector3[]) {
    this.dispatched = true
    this.slot = slot
    this.state = 'driving'
    this.path = waypoints.map((w) => w.clone())
    this.speed = 4
  }

  /** A boarding spot offset to the side of the car (where a passenger ends). */
  boardPoint(out: THREE.Vector3) {
    out.set(0, 0, 0.95).applyAxisAngle(_v.set(0, 1, 0), this.group.rotation.y)
    out.add(this.group.position)
    out.y = 0
    return out
  }

  /** Drive forward off the board once full. */
  depart(exit: THREE.Vector3) {
    this.state = 'departing'
    this.path = [exit.clone()]
    this.speed = 3
  }

  /** World position just behind the car (for exhaust). */
  tail(out: THREE.Vector3) {
    out.set(-LEN * 0.5 - 0.1, BASE_Y + 0.1, 0)
    out.applyMatrix4(this.group.matrixWorld)
    return out
  }

  update(dt: number): void {
    // pip bob
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

    // accelerate, then move toward the waypoint
    this.speed = Math.min(this.speed + dt * 10, this.state === 'departing' ? 12 : 7)
    const step = Math.min(this.speed * dt, dist)
    if (dist > 1e-4) {
      _v.normalize()
      pos.addScaledVector(_v, step)
      // face direction of travel (smoothly)
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
