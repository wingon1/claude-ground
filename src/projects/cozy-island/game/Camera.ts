import { World } from '../content'

export class Camera {
  x = 0 // world coord at top-left of the view
  y = 0
  viewW = 360
  viewH = 640
  zoom = 1

  setView(w: number, h: number) {
    this.viewW = w
    this.viewH = h
    // Zoom so a whole region (one zone) fits the screen.
    const z = Math.min(w / World.zoneSize.w, h / World.zoneSize.h) * 0.98
    this.zoom = Math.max(0.45, Math.min(1.6, z))
  }

  /** Visible world span in world units. */
  spanW() { return this.viewW / this.zoom }
  spanH() { return this.viewH / this.zoom }

  centerOn(tx: number, ty: number, instant = false) {
    const targetX = tx - this.spanW() / 2
    const targetY = ty - this.spanH() / 2
    if (instant) { this.x = targetX; this.y = targetY }
    else { this.x += (targetX - this.x) * 0.14; this.y += (targetY - this.y) * 0.14 }
    this.clamp()
  }

  clamp() {
    const spanW = this.spanW()
    const spanH = this.spanH()
    const maxX = Math.max(0, World.world.width - spanW)
    const maxY = Math.max(0, World.world.height - spanH)
    if (World.world.width < spanW) this.x = (World.world.width - spanW) / 2
    else this.x = Math.max(0, Math.min(maxX, this.x))
    if (World.world.height < spanH) this.y = (World.world.height - spanH) / 2
    else this.y = Math.max(0, Math.min(maxY, this.y))
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: (wx - this.x) * this.zoom, y: (wy - this.y) * this.zoom }
  }
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx / this.zoom + this.x, y: sy / this.zoom + this.y }
  }
}
