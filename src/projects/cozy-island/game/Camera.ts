import { World } from '../content'

export class Camera {
  x = 0
  y = 0
  viewW = 360
  viewH = 640
  panTarget: { x: number; y: number } | null = null

  setView(w: number, h: number) {
    this.viewW = w
    this.viewH = h
  }

  centerOn(tx: number, ty: number, instant = false) {
    const targetX = tx - this.viewW / 2
    const targetY = ty - this.viewH / 2
    if (instant) {
      this.x = targetX
      this.y = targetY
    } else {
      this.x += (targetX - this.x) * 0.12
      this.y += (targetY - this.y) * 0.12
    }
    this.clamp()
  }

  clamp() {
    const maxX = Math.max(0, World.world.width - this.viewW)
    const maxY = Math.max(0, World.world.height - this.viewH)
    if (World.world.width < this.viewW) this.x = (World.world.width - this.viewW) / 2
    else this.x = Math.max(0, Math.min(maxX, this.x))
    if (World.world.height < this.viewH) this.y = (World.world.height - this.viewH) / 2
    else this.y = Math.max(0, Math.min(maxY, this.y))
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx - this.x, y: wy - this.y }
  }
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: sx + this.x, y: sy + this.y }
  }
}
