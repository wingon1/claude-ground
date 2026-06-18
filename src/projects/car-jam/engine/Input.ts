/* ===========================================================================
 * Input.ts — taps only. Raycasts the pointer against car bodies and reports
 * which vehicle was tapped. The boarding game needs no dragging.
 * ========================================================================= */

import * as THREE from 'three'
import type { Vehicle } from './Vehicle'

export class Input {
  private ray = new THREE.Raycaster()
  private ndc = new THREE.Vector2()
  private downX = 0
  private downY = 0
  private dom: HTMLElement
  private camera: THREE.Camera
  private pickables: () => THREE.Mesh[]
  private onTap: (v: Vehicle) => void

  constructor(
    dom: HTMLElement,
    camera: THREE.Camera,
    pickables: () => THREE.Mesh[],
    onTap: (v: Vehicle) => void,
  ) {
    this.dom = dom
    this.camera = camera
    this.pickables = pickables
    this.onTap = onTap
    dom.addEventListener('pointerdown', this.onDown)
    dom.addEventListener('pointerup', this.onUp)
  }

  private onDown = (e: PointerEvent) => {
    this.downX = e.clientX
    this.downY = e.clientY
  }

  private onUp = (e: PointerEvent) => {
    // ignore drags / scrolls — only treat near-stationary taps as a click
    if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > 12) return
    const rect = this.dom.getBoundingClientRect()
    this.ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.ray.setFromCamera(this.ndc, this.camera)
    const hits = this.ray.intersectObjects(this.pickables(), false)
    if (hits.length === 0) return
    const v = hits[0].object.userData.vehicle as Vehicle | undefined
    if (v) this.onTap(v)
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onDown)
    this.dom.removeEventListener('pointerup', this.onUp)
  }
}
