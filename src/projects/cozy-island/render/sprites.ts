import { PAL } from './palette'

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.fillStyle = PAL.shadow
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
  ctx.fill()
}

function r(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

// Player: x,y are feet center. facing: -1 left, 1 right. action: 0..1 swing.
export function drawPlayer(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  facing: number, walk: number, action: number, tired: boolean,
) {
  shadow(ctx, x, y, 11, 4)
  const bob = Math.sin(walk * Math.PI * 2) * 1.2
  const by = y - 26 + bob
  // legs
  const legSwing = Math.sin(walk * Math.PI * 2) * 2
  r(ctx, x - 5, by + 16, 4, 7 + legSwing, PAL.pants)
  r(ctx, x + 1, by + 16, 4, 7 - legSwing, PAL.pants)
  // body
  r(ctx, x - 6, by + 8, 12, 9, PAL.shirt)
  // arms (one swings with action)
  const swing = Math.sin(action * Math.PI) * 6
  r(ctx, x + facing * 6 - 1, by + 9 - swing, 3, 7, PAL.skin)
  r(ctx, x - facing * 6 - 1, by + 10, 3, 6, PAL.skin)
  // head
  r(ctx, x - 5, by - 2, 10, 10, PAL.skin)
  // hair
  r(ctx, x - 5, by - 3, 10, 4, PAL.hair)
  r(ctx, x - 6, by - 1, 2, 4, PAL.hair)
  r(ctx, x + 4, by - 1, 2, 4, PAL.hair)
  // eyes
  r(ctx, x + facing * 2 - 2, by + 3, 1.5, 2, '#3a2a1a')
  r(ctx, x + facing * 2 + 1, by + 3, 1.5, 2, '#3a2a1a')
  if (tired) {
    // sweat drop
    r(ctx, x + 6, by - 1, 2, 3, '#7fd4ff')
  }
}

export function drawChicken(ctx: CanvasRenderingContext2D, x: number, y: number, hasEgg: boolean) {
  shadow(ctx, x, y, 8, 3)
  const b = y - 12
  r(ctx, x - 5, b + 2, 10, 9, '#fbfbf4')
  r(ctx, x - 5, b - 2, 7, 6, '#fbfbf4') // head
  r(ctx, x + 1, b - 4, 3, 3, '#e3413f') // comb
  r(ctx, x + 4, b + 1, 2, 2, '#f0a23a') // beak
  r(ctx, x, b, 1.5, 1.5, '#2a2a2a') // eye
  r(ctx, x - 6, b + 9, 3, 2, '#f0a23a')
  r(ctx, x + 3, b + 9, 3, 2, '#f0a23a')
  if (hasEgg) r(ctx, x - 2, y - 3, 5, 4, '#f4ead2')
}

export function drawTree(
  ctx: CanvasRenderingContext2D, x: number, y: number, big: boolean, hpRatio: number, shake: number,
) {
  const sw = shake ? Math.sin(performance.now() / 30) * shake * 2 : 0
  shadow(ctx, x, y, big ? 18 : 13, big ? 6 : 5)
  const th = big ? 20 : 14
  r(ctx, x - 3 + sw * 0.3, y - th, 6, th, PAL.trunk)
  r(ctx, x - 3 + sw * 0.3, y - th, 2, th, PAL.trunkDark)
  const cx = x + sw
  const cy = y - th - (big ? 18 : 12)
  const rad = big ? 22 : 16
  ctx.fillStyle = PAL.leafDark
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = PAL.leaf
  ctx.beginPath(); ctx.arc(cx - rad * 0.3, cy + 2, rad * 0.8, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = PAL.leafLight
  ctx.beginPath(); ctx.arc(cx - rad * 0.4, cy - rad * 0.4, rad * 0.45, 0, Math.PI * 2); ctx.fill()
  // damage: shrink top slightly handled by hpRatio (lighter when low)
  if (hpRatio < 1) {
    ctx.globalAlpha = 0.0
    ctx.globalAlpha = 1
  }
}

export function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, big: boolean) {
  const w = big ? 30 : 22
  const h = big ? 22 : 16
  shadow(ctx, x, y, w / 2, 5)
  ctx.fillStyle = PAL.rockDark
  ctx.beginPath()
  ctx.moveTo(x - w / 2, y)
  ctx.lineTo(x - w / 2 + 4, y - h)
  ctx.lineTo(x + w / 2 - 6, y - h + 2)
  ctx.lineTo(x + w / 2, y)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = PAL.rock
  ctx.beginPath()
  ctx.moveTo(x - w / 2 + 3, y)
  ctx.lineTo(x - w / 2 + 7, y - h + 3)
  ctx.lineTo(x + w / 2 - 9, y - h + 4)
  ctx.lineTo(x + w / 2 - 4, y)
  ctx.closePath(); ctx.fill()
  r(ctx, x - 3, y - h + 5, 6, 3, PAL.rockLight)
}

export function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, berry: boolean) {
  shadow(ctx, x, y, 13, 4)
  ctx.fillStyle = PAL.leafDark
  ctx.beginPath(); ctx.arc(x - 6, y - 6, 9, 0, Math.PI * 2); ctx.arc(x + 6, y - 6, 9, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = PAL.leaf
  ctx.beginPath(); ctx.arc(x, y - 10, 10, 0, Math.PI * 2); ctx.fill()
  if (berry) { r(ctx, x - 4, y - 10, 3, 3, '#e2515b'); r(ctx, x + 3, y - 6, 3, 3, '#e2515b') }
}

export function drawShell(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 8, 3)
  ctx.fillStyle = '#f6dcc8'
  ctx.beginPath(); ctx.arc(x, y - 3, 7, Math.PI, 0); ctx.fill()
  ctx.strokeStyle = '#d9a98a'; ctx.lineWidth = 1
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(x, y - 3); ctx.lineTo(x + i * 3, y - 9); ctx.stroke()
  }
}

// Crop: growth 0..1, ready highlights
export function drawCrop(ctx: CanvasRenderingContext2D, x: number, y: number, growth: number, ready: boolean, color: string) {
  // tilled soil
  r(ctx, x - 16, y - 8, 32, 14, '#7a5536')
  r(ctx, x - 16, y - 8, 32, 3, '#8a6442')
  for (let i = -1; i <= 1; i++) r(ctx, x + i * 10 - 1, y - 6, 2, 10, '#6a4830')
  const stage = ready ? 4 : Math.min(3, Math.floor(growth * 4))
  const h = 3 + stage * 5
  if (stage === 0) {
    r(ctx, x - 1, y - 4, 2, 4, '#6bbf4a')
  } else {
    for (const ox of [-7, 0, 7]) {
      r(ctx, x + ox - 1, y - 2 - h, 2, h, '#4f9a3a')
      if (ready) {
        ctx.fillStyle = color
        ctx.beginPath(); ctx.arc(x + ox, y - 2 - h, 3.5, 0, Math.PI * 2); ctx.fill()
      } else if (stage >= 3) {
        ctx.fillStyle = color
        ctx.globalAlpha = 0.6
        ctx.beginPath(); ctx.arc(x + ox, y - 2 - h, 2.5, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = 1
      }
    }
  }
  if (ready) {
    ctx.strokeStyle = 'rgba(255,240,150,0.9)'; ctx.lineWidth = 2
    ctx.strokeRect(x - 17, y - 9 - h, 34, 14 + h)
  }
}

// ---- Buildings ----
export function drawTent(ctx: CanvasRenderingContext2D, x: number, y: number, level: number) {
  shadow(ctx, x, y, 44, 9)
  const c = level >= 3 ? '#e09a6a' : level >= 2 ? '#e2b06a' : '#d98c6a'
  ctx.fillStyle = c
  ctx.beginPath(); ctx.moveTo(x, y - 56); ctx.lineTo(x - 46, y); ctx.lineTo(x + 46, y); ctx.closePath(); ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  ctx.beginPath(); ctx.moveTo(x, y - 56); ctx.lineTo(x + 46, y); ctx.lineTo(x + 16, y); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#5a3a28'
  ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.closePath(); ctx.fill()
  r(ctx, x - 1, y - 58, 2, 8, '#8a5a32')
  ctx.fillStyle = '#f6c343'
  ctx.beginPath(); ctx.moveTo(x + 1, y - 58); ctx.lineTo(x + 12, y - 55); ctx.lineTo(x + 1, y - 52); ctx.closePath(); ctx.fill()
  if (level >= 2) { r(ctx, x - 30, y - 6, 6, 6, '#cfa05a'); r(ctx, x + 24, y - 6, 6, 6, '#cfa05a') }
}

export function drawShop(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 48, 9)
  r(ctx, x - 44, y - 38, 88, 38, '#f0e3c8')
  r(ctx, x - 44, y - 38, 88, 6, '#caa56e')
  // awning
  for (let i = 0; i < 8; i++) r(ctx, x - 44 + i * 11, y - 50, 11, 14, i % 2 ? '#e06b6b' : '#fff4ee')
  r(ctx, x - 46, y - 52, 92, 4, '#a85050')
  // counter
  r(ctx, x - 44, y - 14, 88, 14, '#b9854c')
  r(ctx, x - 44, y - 14, 88, 4, '#cf9b54')
  // coin sign
  ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.fillText('🛒', x, y - 20); ctx.textAlign = 'left'
}

export function drawCookingFire(ctx: CanvasRenderingContext2D, x: number, y: number, level: number) {
  shadow(ctx, x, y, 30, 7)
  // stone ring
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    r(ctx, x + Math.cos(a) * 18 - 4, y + Math.sin(a) * 8 - 3, 8, 6, PAL.rock)
  }
  // logs
  r(ctx, x - 12, y - 6, 24, 5, PAL.trunk)
  // flame
  const f = Math.sin(performance.now() / 90) * 2
  ctx.fillStyle = '#f08a2a'
  ctx.beginPath(); ctx.moveTo(x, y - 26 - f); ctx.lineTo(x - 9, y - 6); ctx.lineTo(x + 9, y - 6); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#f6d24a'
  ctx.beginPath(); ctx.moveTo(x, y - 18 - f); ctx.lineTo(x - 5, y - 6); ctx.lineTo(x + 5, y - 6); ctx.closePath(); ctx.fill()
  if (level >= 2) { r(ctx, x + 14, y - 18, 10, 12, '#9aa3ad') } // pot stand
}

export function drawCoop(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 46, 9)
  r(ctx, x - 40, y - 30, 80, 30, '#caa06a')
  r(ctx, x - 40, y - 30, 80, 6, '#a8804c')
  ctx.fillStyle = '#a85050'
  ctx.beginPath(); ctx.moveTo(x - 46, y - 30); ctx.lineTo(x, y - 50); ctx.lineTo(x + 46, y - 30); ctx.closePath(); ctx.fill()
  r(ctx, x - 10, y - 20, 20, 20, '#6e4626')
  ctx.beginPath(); ctx.fillStyle = '#6e4626'; ctx.arc(x, y - 20, 10, Math.PI, 0); ctx.fill()
  ctx.font = '14px serif'; ctx.textAlign = 'center'; ctx.fillText('🐔', x, y - 6); ctx.textAlign = 'left'
}

export function drawStorage(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 38, 8)
  r(ctx, x - 34, y - 34, 68, 34, '#c79a5e')
  r(ctx, x - 34, y - 34, 68, 6, '#a8804c')
  ctx.fillStyle = '#8a6038'
  ctx.beginPath(); ctx.moveTo(x - 38, y - 34); ctx.lineTo(x, y - 50); ctx.lineTo(x + 38, y - 34); ctx.closePath(); ctx.fill()
  r(ctx, x - 10, y - 22, 20, 22, '#6e4626')
  r(ctx, x - 1, y - 22, 2, 22, '#caa56e')
}

export function drawFarmSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 14, 4)
  r(ctx, x - 2, y - 26, 4, 26, PAL.trunk)
  r(ctx, x - 16, y - 34, 32, 14, '#e2c98a')
  r(ctx, x - 16, y - 34, 32, 14, 'rgba(0,0,0,0)')
  ctx.strokeStyle = '#a8804c'; ctx.lineWidth = 2; ctx.strokeRect(x - 16, y - 34, 32, 14)
  ctx.font = '11px serif'; ctx.textAlign = 'center'; ctx.fillText('🌾', x, y - 23); ctx.textAlign = 'left'
}

export function drawMine(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 48, 10)
  // hill
  ctx.fillStyle = PAL.rockDark
  ctx.beginPath(); ctx.moveTo(x - 52, y); ctx.quadraticCurveTo(x, y - 64, x + 52, y); ctx.closePath(); ctx.fill()
  ctx.fillStyle = PAL.rock
  ctx.beginPath(); ctx.moveTo(x - 44, y); ctx.quadraticCurveTo(x - 6, y - 50, x + 30, y); ctx.closePath(); ctx.fill()
  // entrance
  ctx.fillStyle = '#241b22'
  ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.lineTo(x - 16, y - 18); ctx.quadraticCurveTo(x, y - 32, x + 16, y - 18); ctx.lineTo(x + 16, y); ctx.closePath(); ctx.fill()
  // beams
  r(ctx, x - 18, y - 20, 5, 22, PAL.trunk)
  r(ctx, x + 13, y - 20, 5, 22, PAL.trunk)
  r(ctx, x - 20, y - 22, 40, 5, PAL.trunkDark)
}

export function drawBuildSite(ctx: CanvasRenderingContext2D, x: number, y: number, emoji: string) {
  shadow(ctx, x, y, 26, 6)
  ctx.save()
  ctx.setLineDash([5, 4])
  ctx.strokeStyle = 'rgba(90,70,40,0.6)'
  ctx.lineWidth = 2
  ctx.strokeRect(x - 26, y - 30, 52, 30)
  ctx.restore()
  ctx.globalAlpha = 0.85
  ctx.font = '18px serif'; ctx.textAlign = 'center'
  ctx.fillText('🔨', x, y - 8)
  ctx.font = '13px serif'
  ctx.fillText(emoji, x, y - 30)
  ctx.textAlign = 'left'; ctx.globalAlpha = 1
}

export function drawOreNode(ctx: CanvasRenderingContext2D, x: number, y: number, gemColor: string) {
  shadow(ctx, x, y, 16, 4)
  ctx.fillStyle = PAL.rockDark
  ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.lineTo(x - 10, y - 18); ctx.lineTo(x + 12, y - 16); ctx.lineTo(x + 16, y); ctx.closePath(); ctx.fill()
  ctx.fillStyle = PAL.rock
  ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x - 6, y - 13); ctx.lineTo(x + 8, y - 12); ctx.lineTo(x + 11, y); ctx.closePath(); ctx.fill()
  ctx.fillStyle = gemColor
  r(ctx, x - 4, y - 11, 4, 4, gemColor)
  r(ctx, x + 3, y - 7, 3, 3, gemColor)
}
