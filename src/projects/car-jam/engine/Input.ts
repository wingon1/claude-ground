/* ===========================================================================
 * Input.ts — pointer → world mapping. Translates raw pointer events into the
 * two things the game cares about: which car was grabbed, and where on the
 * ground plane (y=0) the pointer currently is. The drag state machine itself
 * lives in Main, which implements these handlers.
 * ========================================================================= */

import * as THREE from 'three'
import type { Car } from './Car'

export type InputHandlers = {
  /** Returns the body meshes that can be grabbed. */
  pickables: () => THREE.Mesh[]
  onGrab: (car: Car, groundAlong: THREE.Vector3) => void
  onDrag: (groundAlong: THREE.Vector3) => void
  onRelease: () => void
}

export class Input {
  private ray = new THREE.Raycaster()
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private ndc = new THREE.Vector2()
  private hit = new THREE.Vector3()
  private dragging = false
  private dom: HTMLElement
  private camera: THREE.Camera
  private handlers: InputHandlers

  constructor(dom: HTMLElement, camera: THREE.Camera, handlers: InputHandlers) {
    this.dom = dom
    this.camera = camera
    this.handlers = handlers
    dom.addEventListener('pointerdown', this.onDown)
    dom.addEventListener('pointermove', this.onMove)
    window.addEventListener('pointerup', this.onUp)
    dom.addEventListener('pointercancel', this.onUp)
  }

  private toGround(e: PointerEvent): THREE.Vector3 | null {
    const rect = this.dom.getBoundingClientRect()
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.ray.setFromCamera(this.ndc, this.camera)
    const p = this.ray.ray.intersectPlane(this.plane, this.hit)
    return p ? this.hit.clone() : null
  }

  private onDown = (e: PointerEvent) => {
    const rect = this.dom.getBoundingClientRect()
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.ray.setFromCamera(this.ndc, this.camera)
    const hits = this.ray.intersectObjects(this.handlers.pickables(), false)
    if (hits.length === 0) return
    const car = hits[0].object.userData.car as Car | undefined
    if (!car) return
    const ground = this.toGround(e)
    if (!ground) return
    this.dragging = true
    ;(this.dom as HTMLElement).setPointerCapture?.(e.pointerId)
    this.handlers.onGrab(car, ground)
    e.preventDefault()
  }

  private onMove = (e: PointerEvent) => {
    if (!this.dragging) return
    const ground = this.toGround(e)
    if (ground) this.handlers.onDrag(ground)
    e.preventDefault()
  }

  private onUp = () => {
    if (!this.dragging) return
    this.dragging = false
    this.handlers.onRelease()
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onDown)
    this.dom.removeEventListener('pointermove', this.onMove)
    window.removeEventListener('pointerup', this.onUp)
    this.dom.removeEventListener('pointercancel', this.onUp)
  }
}
