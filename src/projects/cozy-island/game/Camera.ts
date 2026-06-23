// Camera zooms so one pen (region) fits the screen, and follows the player.
export class Camera {
  x = 0
  y = 0
  viewW = 360
  viewH = 640
  zoom = 1
  worldW = 1000
  worldH = 1000
  penW = 200
  penH = 170

  setWorld(worldW: number, worldH: number, penW: number, penH: number) {
    this.worldW = worldW
    this.worldH = worldH
    this.penW = penW
    this.penH = penH
    this.recomputeZoom()
  }

  setView(w: number, h: number) {
    this.viewW = w
    this.viewH = h
    this.recomputeZoom()
  }

  private recomputeZoom() {
    // fit one pen + a margin of path around it
    const z = Math.min(this.viewW / (this.penW + 90), this.viewH / (this.penH + 90))
    this.zoom = Math.max(0.4, Math.min(2.4, z))
  }

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
    if (this.worldW < spanW) this.x = (this.worldW - spanW) / 2
    else this.x = Math.max(0, Math.min(this.worldW - spanW, this.x))
    if (this.worldH < spanH) this.y = (this.worldH - spanH) / 2
    else this.y = Math.max(0, Math.min(this.worldH - spanH, this.y))
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: (wx - this.x) * this.zoom, y: (wy - this.y) * this.zoom }
  }
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx / this.zoom + this.x, y: sy / this.zoom + this.y }
  }
}
