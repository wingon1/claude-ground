/* ===========================================================================
 * Person.ts — procedural low-poly passengers (coloured capsule + head), pooled.
 * They shuffle along a horizontal queue, then hop (a quick arc) up into a
 * boarding car and vanish inside it.
 * ========================================================================= */

import * as THREE from 'three'
import { CAR_COLORS } from './Vehicle'

const bodyGeo = new THREE.CapsuleGeometry(0.15, 0.24, 4, 10)
const headGeo = new THREE.SphereGeometry(0.13, 12, 10)
const headMat = new THREE.MeshStandardMaterial({ color: 0xf3c89a, roughness: 0.7 })

const _v = new THREE.Vector3()

export type PState = 'queued' | 'walking' | 'hopping' | 'boarded'

export class Person {
  colorIndex = 0
  state: PState = 'queued'

  readonly group = new THREE.Group()
  private bodyMat: THREE.MeshStandardMaterial
  private dest = new THREE.Vector3()
  private from = new THREE.Vector3()
  private bobT = 0
  private hopT = 0
  private hopDur = 0.55
  private onArrive: (() => void) | null = null

  constructor() {
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
    const body = new THREE.Mesh(bodyGeo, this.bodyMat)
    body.position.y = 0.28
    body.castShadow = true
    const head = new THREE.Mesh(headGeo, headMat)
    head.position.y = 0.58
    head.castShadow = true
    this.group.add(body, head)
    this.group.visible = false
  }

  init(colorIndex: number, x: number, z: number) {
    this.colorIndex = colorIndex
    this.state = 'queued'
    this.onArrive = null
    this.bodyMat.color.setHex(CAR_COLORS[colorIndex % CAR_COLORS.length])
    this.group.position.set(x, 0, z)
    this.group.rotation.y = Math.PI // face up-screen (toward the lot)
    this.group.scale.setScalar(1)
    this.group.visible = true
  }

  /** Glide to a new queue spot (when people ahead have left). */
  shuffleTo(x: number, z: number) {
    if (this.state !== 'queued') return
    this.dest.set(x, 0, z)
    this.state = 'walking'
    this.onArrive = () => {
      this.state = 'queued'
    }
  }

  /** Leap in an arc up to a boarding car, then board. */
  hopTo(x: number, z: number, onBoard: () => void) {
    this.from.copy(this.group.position)
    this.dest.set(x, 0, z)
    this.hopT = 0
    this.state = 'hopping'
    this.onArrive = onBoard
  }

  update(dt: number): boolean {
    if (this.state === 'boarded') {
      this.group.position.y += dt * 1.4
      const s = this.group.scale.x - dt * 3
      this.group.scale.setScalar(Math.max(0, s))
      if (s <= 0) {
        this.group.visible = false
        return true
      }
      return false
    }

    if (this.state === 'hopping') {
      this.hopT = Math.min(1, this.hopT + dt / this.hopDur)
      const t = this.hopT
      _v.copy(this.from).lerp(this.dest, t)
      this.group.position.x = _v.x
      this.group.position.z = _v.z
      this.group.position.y = Math.sin(t * Math.PI) * 0.7 // arc
      // face direction of travel
      _v.copy(this.dest).sub(this.from)
      this.group.rotation.y = Math.atan2(_v.x, _v.z) + Math.PI
      if (t >= 1) {
        this.state = 'boarded'
        const cb = this.onArrive
        this.onArrive = null
        cb?.()
      }
      return false
    }

    if (this.state !== 'walking') return false
    _v.copy(this.dest).sub(this.group.position)
    _v.y = 0
    const dist = _v.length()
    const step = Math.min(2.6 * dt, dist)
    if (dist > 1e-4) {
      _v.normalize()
      this.group.position.addScaledVector(_v, step)
      this.group.rotation.y = Math.atan2(_v.x, _v.z) + Math.PI
      this.bobT += dt * 12
      this.group.position.y = Math.abs(Math.sin(this.bobT)) * 0.05
    }
    if (dist <= step + 1e-3) {
      this.group.position.set(this.dest.x, 0, this.dest.z)
      const cb = this.onArrive
      this.onArrive = null
      cb?.()
    }
    return false
  }
}

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
