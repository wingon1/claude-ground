/* ===========================================================================
 * Person.ts — procedural low-poly passengers (a coloured body capsule + head),
 * pooled. Each person waits in the queue, then walks to a matching car and
 * boards (a short hop + fade into the vehicle).
 * ========================================================================= */

import * as THREE from 'three'
import { CAR_COLORS } from './Vehicle'

const bodyGeo = new THREE.CapsuleGeometry(0.16, 0.26, 4, 10)
const headGeo = new THREE.SphereGeometry(0.135, 12, 10)
const headMat = new THREE.MeshStandardMaterial({ color: 0xf3c89a, roughness: 0.7 })

const _v = new THREE.Vector3()

export type PState = 'queued' | 'walking' | 'boarded'

export class Person {
  colorIndex = 0
  state: PState = 'queued'
  target: Vehicleish | null = null

  readonly group = new THREE.Group()
  private bodyMat: THREE.MeshStandardMaterial
  private dest = new THREE.Vector3()
  private bobT = 0
  private speed = 2.6
  private onArrive: (() => void) | null = null

  constructor() {
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
    const body = new THREE.Mesh(bodyGeo, this.bodyMat)
    body.position.y = 0.3
    body.castShadow = true
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.y = 0.62
    head.castShadow = true
    this.group.add(body, head)
    this.group.visible = false
  }

  init(colorIndex: number, x: number, z: number) {
    this.colorIndex = colorIndex
    this.state = 'queued'
    this.target = null
    this.bodyMat.color.setHex(CAR_COLORS[colorIndex % CAR_COLORS.length])
    this.group.position.set(x, 0, z)
    this.group.rotation.y = Math.PI // face toward the cars (-z)
    this.group.scale.setScalar(1)
    this.group.visible = true
  }

  /** Glide to a new spot in the queue (when people ahead have left). */
  shuffleTo(x: number, z: number) {
    if (this.state !== 'queued') return
    this.dest.set(x, 0, z)
    this.state = 'walking'
    this.onArrive = () => {
      this.state = 'queued'
    }
  }

  /** Walk to a car and board it; onBoard fires when the person reaches it. */
  boardTo(target: Vehicleish, x: number, z: number, onBoard: () => void) {
    this.target = target
    this.dest.set(x, 0, z)
    this.state = 'walking'
    this.onArrive = () => {
      this.state = 'boarded'
      onBoard()
    }
  }

  update(dt: number): boolean {
    if (this.state === 'boarded') {
      // shrink + lift into the car, then signal done
      this.group.position.y += dt * 1.5
      const s = this.group.scale.x - dt * 3
      this.group.scale.setScalar(Math.max(0, s))
      if (s <= 0) {
        this.group.visible = false
        return true
      }
      return false
    }
    if (this.state !== 'walking') return false

    _v.copy(this.dest).sub(this.group.position)
    _v.y = 0
    const dist = _v.length()
    const step = Math.min(this.speed * dt, dist)
    if (dist > 1e-4) {
      _v.normalize()
      this.group.position.addScaledVector(_v, step)
      this.group.rotation.y = Math.atan2(_v.x, _v.z) + Math.PI
      // little walk bob
      this.bobT += dt * 12
      this.group.position.y = Math.abs(Math.sin(this.bobT)) * 0.06
    }
    if (dist <= step + 1e-3) {
      this.group.position.x = this.dest.x
      this.group.position.z = this.dest.z
      this.group.position.y = 0
      const cb = this.onArrive
      this.onArrive = null
      cb?.()
    }
    return false
  }
}

/** Minimal structural type to avoid a circular import with Vehicle. */
export type Vehicleish = { id: number }

export class PersonPool {
  private free: Person[] = []
  private scene: THREE.Scene
  constructor(scene: THREE.Scene) {
    this.scene = scene
  }
  acquire(): Person {
    let p = this.free.pop()
    if (!p) {
      p = new Person()
      this.scene.add(p.group)
    }
    return p
  }
  release(p: Person) {
    p.group.visible = false
    this.free.push(p)
  }
}
