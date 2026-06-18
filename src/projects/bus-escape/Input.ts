// Tap input + raycasting. Distinguishes a tap from a drag/scroll gesture.

import type { Renderer } from './Renderer'

export class Input {
  private el: HTMLElement
  private renderer: Renderer
  private onTap: (vehicleId: number) => void
  private downX = 0
  private downY = 0
  private downT = 0
  private active = false

  constructor(renderer: Renderer, onTap: (vehicleId: number) => void) {
    this.renderer = renderer
    this.el = renderer.renderer.domElement
    this.onTap = onTap
    this.el.addEventListener('pointerdown', this.handleDown)
    this.el.addEventListener('pointerup', this.handleUp)
  }

  private handleDown = (e: PointerEvent): void => {
    this.active = true
    this.downX = e.clientX
    this.downY = e.clientY
    this.downT = performance.now()
  }

  private handleUp = (e: PointerEvent): void => {
    if (!this.active) return
    this.active = false
    const dx = e.clientX - this.downX
    const dy = e.clientY - this.downY
    const dist = Math.hypot(dx, dy)
    const dt = performance.now() - this.downT
    if (dist > 14 || dt > 600) return // treat as drag/long-press, ignore
    const id = this.renderer.pickVehicle(e.clientX, e.clientY)
    if (id !== null) this.onTap(id)
  }

  dispose(): void {
    this.el.removeEventListener('pointerdown', this.handleDown)
    this.el.removeEventListener('pointerup', this.handleUp)
  }
}
