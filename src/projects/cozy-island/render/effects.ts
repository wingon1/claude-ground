import type { Camera } from '../game/Camera'

type Particle = {
  kind: 'dust' | 'leaf' | 'chip' | 'sparkle' | 'zzz'
  x: number; y: number; vx: number; vy: number
  life: number; maxLife: number; size: number; color: string; rot: number; vr: number
}

type FlyItem = { x: number; y: number; tx: number; ty: number; t: number; color: string; emoji: string }
type Popup = { x: number; y: number; vy: number; life: number; maxLife: number; text: string; color: string }

export class Effects {
  private parts: Particle[] = []
  private flies: FlyItem[] = []
  private popups: Popup[] = []

  burst(kind: Particle['kind'], x: number, y: number, n: number, color: string) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 20 + Math.random() * 50
      this.parts.push({
        kind, x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (kind === 'leaf' ? 10 : 30),
        life: 0, maxLife: 0.5 + Math.random() * 0.5,
        size: kind === 'chip' ? 2 + Math.random() * 2 : 3 + Math.random() * 3,
        color, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 8,
      })
    }
  }

  dust(x: number, y: number) {
    this.parts.push({
      kind: 'dust', x, y, vx: (Math.random() - 0.5) * 14, vy: -6 - Math.random() * 8,
      life: 0, maxLife: 0.4, size: 2 + Math.random() * 2, color: 'rgba(220,200,160,0.7)', rot: 0, vr: 0,
    })
  }

  zzz(x: number, y: number) {
    this.parts.push({
      kind: 'zzz', x, y, vx: 8, vy: -22, life: 0, maxLife: 1.4, size: 10, color: '#ffffff', rot: 0, vr: 0,
    })
  }

  fly(x: number, y: number, tx: number, ty: number, emoji: string, color: string) {
    this.flies.push({ x, y, tx, ty, t: 0, emoji, color })
  }

  popup(x: number, y: number, text: string, color: string) {
    this.popups.push({ x, y, vy: -26, life: 0, maxLife: 1.0, text, color })
  }

  update(dt: number) {
    for (const p of this.parts) {
      p.life += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 80 * dt
      p.rot += p.vr * dt
      if (p.kind === 'zzz') { p.vx *= 1 - 0.5 * dt }
    }
    this.parts = this.parts.filter((p) => p.life < p.maxLife)

    for (const f of this.flies) {
      f.t += dt * 2.2
      const e = Math.min(1, f.t)
      f.x = f.x + (f.tx - f.x) * (e * 0.35)
      f.y = f.y + (f.ty - f.y) * (e * 0.35)
    }
    this.flies = this.flies.filter((f) => f.t < 1)

    for (const p of this.popups) {
      p.life += dt
      p.y += p.vy * dt
      p.vy += 18 * dt
    }
    this.popups = this.popups.filter((p) => p.life < p.maxLife)
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera) {
    for (const p of this.parts) {
      const s = cam.worldToScreen(p.x, p.y)
      const alpha = 1 - p.life / p.maxLife
      ctx.globalAlpha = alpha
      if (p.kind === 'zzz') {
        ctx.globalAlpha = alpha * 0.9
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 16px monospace'
        ctx.fillText('z', s.x, s.y)
      } else {
        ctx.save()
        ctx.translate(s.x, s.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        if (p.kind === 'leaf') {
          ctx.beginPath()
          ctx.ellipse(0, 0, p.size, p.size * 0.6, 0, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        }
        ctx.restore()
      }
    }
    ctx.globalAlpha = 1

    for (const f of this.flies) {
      const s = cam.worldToScreen(f.x, f.y)
      ctx.font = '16px serif'
      ctx.textAlign = 'center'
      ctx.fillText(f.emoji, s.x, s.y)
    }
    ctx.textAlign = 'left'

    for (const p of this.popups) {
      const s = cam.worldToScreen(p.x, p.y)
      const alpha = 1 - Math.max(0, (p.life - 0.5) / 0.5)
      ctx.globalAlpha = alpha
      ctx.font = 'bold 14px monospace'
      ctx.textAlign = 'center'
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(60,40,20,0.6)'
      ctx.strokeText(p.text, s.x, s.y)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, s.x, s.y)
      ctx.textAlign = 'left'
    }
    ctx.globalAlpha = 1
  }
}
