import type { CropQuality, Direction } from '../types'

// All sprites are procedurally baked into offscreen canvases at 1 art-px = 1
// canvas-px, then drawn integer-scaled with smoothing disabled.

export const T = 16 // tile pixel size (art space)

type Pal = {
  skin: string
  skinShade: string
  hair: string
  top: string
  topShade: string
  bottom: string
  accent: string
  hat?: string
  hatShade?: string
  hood?: boolean
}

function cv(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = c.getContext('2d')!
  x.imageSmoothingEnabled = false
  return x
}

function px(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  g.fillStyle = color
  g.fillRect(x, y, w, h)
}

// Tiny seeded noise for texture dots.
function dot(g: CanvasRenderingContext2D, x: number, y: number, color: string) {
  g.fillStyle = color
  g.fillRect(x, y, 1, 1)
}

// ---------------- Humanoid (farmer + NPCs) ----------------
const HUMAN_W = 16
const HUMAN_H = 22

function drawHumanoid(
  g: CanvasRenderingContext2D,
  dir: Direction,
  frame: number, // 0 idle, 1/2 walk
  pal: Pal,
) {
  const legSwing = frame === 1 ? 1 : frame === 2 ? -1 : 0
  // Shadow
  px(g, 4, 21, 8, 1, 'rgba(0,0,0,0.18)')

  // Legs
  const legY = 17
  px(g, 5, legY, 2, 4 + (legSwing > 0 ? 0 : -1), pal.bottom)
  px(g, 9, legY, 2, 4 + (legSwing < 0 ? 0 : -1), pal.bottom)
  px(g, 5, 20, 2, 1, '#3a2a1a')
  px(g, 9, 20, 2, 1, '#3a2a1a')

  // Torso
  px(g, 4, 11, 8, 7, pal.top)
  px(g, 4, 15, 8, 3, pal.topShade)
  px(g, 4, 11, 8, 1, pal.accent)
  // Arms
  px(g, 3, 12, 2, 4, pal.top)
  px(g, 11, 12, 2, 4, pal.top)
  px(g, 3, 15, 2, 1, pal.skin)
  px(g, 11, 15, 2, 1, pal.skin)

  // Head
  px(g, 4, 4, 8, 8, pal.skin)
  px(g, 4, 10, 8, 1, pal.skinShade)

  // Hair / hood
  if (pal.hood) {
    px(g, 3, 3, 10, 6, pal.hair)
    px(g, 4, 6, 8, 4, pal.skin) // face opening
    px(g, 4, 10, 8, 1, pal.skinShade)
  } else {
    px(g, 4, 3, 8, 3, pal.hair)
    px(g, 3, 4, 1, 3, pal.hair)
    px(g, 12, 4, 1, 3, pal.hair)
  }

  // Hat (straw)
  if (pal.hat) {
    px(g, 2, 4, 12, 2, pal.hat)
    px(g, 4, 2, 8, 2, pal.hat)
    px(g, 2, 5, 12, 1, pal.hatShade ?? pal.hat)
  }

  // Face by direction
  const eye = '#2a2230'
  if (dir === 'down') {
    px(g, 6, 7, 1, 2, eye)
    px(g, 9, 7, 1, 2, eye)
    px(g, 7, 9, 2, 1, pal.skinShade)
  } else if (dir === 'up') {
    // back of head — no eyes
    px(g, 5, 6, 6, 2, pal.hair)
  } else if (dir === 'left') {
    px(g, 5, 7, 1, 2, eye)
    px(g, 4, 8, 1, 1, pal.skinShade)
  } else {
    px(g, 10, 7, 1, 2, eye)
    px(g, 11, 8, 1, 1, pal.skinShade)
  }
}

function bakeHumanoidSheet(pal: Pal): Record<string, HTMLCanvasElement> {
  const dirs: Direction[] = ['down', 'up', 'left', 'right']
  const out: Record<string, HTMLCanvasElement> = {}
  for (const d of dirs) {
    for (let f = 0; f < 3; f++) {
      const c = cv(HUMAN_W, HUMAN_H)
      drawHumanoid(ctxOf(c), d, f, pal)
      out[`${d}_${f}`] = c
    }
  }
  return out
}

// ---------------- Tiles ----------------
function bakeGrass(variant: number): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  // base gradient
  px(g, 0, 0, T, T, '#7cc24e')
  px(g, 0, 0, T, T, '#7cc24e')
  for (let i = 0; i < T; i += 4) {
    for (let j = 0; j < T; j += 4) {
      dot(g, i + ((variant + j) % 3), j + ((i + variant) % 3), '#6fb544')
    }
  }
  // blades
  if (variant === 1) {
    px(g, 3, 9, 1, 2, '#5aa038')
    px(g, 10, 4, 1, 2, '#5aa038')
  }
  if (variant === 2) {
    dot(g, 6, 6, '#e8e36b')
    dot(g, 11, 11, '#e8e36b')
  }
  return c
}

function bakeSoil(wet: boolean): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  const baseC = wet ? '#5a3a22' : '#8a5a34'
  const furrow = wet ? '#3f2817' : '#6e4626'
  px(g, 0, 0, T, T, baseC)
  for (let y = 2; y < T; y += 4) px(g, 1, y, T - 2, 2, furrow)
  px(g, 0, 0, T, 1, 'rgba(0,0,0,0.15)')
  px(g, 0, 0, 1, T, 'rgba(0,0,0,0.12)')
  return c
}

function bakeWater(frame: number): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 0, 0, T, T, '#3f73c4')
  px(g, 0, 0, T, T / 2, '#4a82d6')
  const off = frame * 2
  for (let y = 2; y < T; y += 5) {
    px(g, (off + y) % T, y, 4, 1, '#7fb0ea')
    px(g, (off + 8 + y) % T, y + 2, 3, 1, '#2f5da3')
  }
  return c
}

function bakePath(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 0, 0, T, T, '#b79b6e')
  for (let i = 0; i < 18; i++) {
    dot(g, (i * 7) % T, (i * 11) % T, '#a4885d')
  }
  px(g, 0, 0, T, 1, '#c8ad80')
  return c
}

function bakeFence(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 0, 0, T, T, '#5d8a3a')
  px(g, 0, 5, T, 3, '#8a6a40')
  px(g, 2, 2, 2, 12, '#6e5230')
  px(g, 11, 2, 2, 12, '#6e5230')
  px(g, 0, 5, T, 1, '#a07b48')
  return c
}

// ---------------- Obstacles ----------------
function bakeTree(): HTMLCanvasElement {
  const c = cv(T, T + 14)
  const g = ctxOf(c)
  const oy = 14
  px(g, 3, oy + 1, 8, 4, 'rgba(0,0,0,0.15)')
  // trunk
  px(g, 7, oy + 2, 3, 8, '#7a4a26')
  px(g, 7, oy + 2, 1, 8, '#8f5a30')
  // canopy
  px(g, 3, 2, 10, 10, '#2f7d3a')
  px(g, 2, 4, 12, 7, '#2f7d3a')
  px(g, 4, 0, 8, 5, '#3a9148')
  px(g, 4, 1, 5, 3, '#49a657')
  for (let i = 0; i < 10; i++) dot(g, 3 + ((i * 5) % 10), 3 + ((i * 7) % 9), '#256b30')
  return c
}

function bakeStump(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 3, 11, 10, 3, 'rgba(0,0,0,0.15)')
  px(g, 4, 6, 8, 7, '#7a4a26')
  px(g, 4, 5, 8, 2, '#9a6438')
  px(g, 6, 6, 4, 2, '#b07a48')
  dot(g, 7, 7, '#7a4a26')
  return c
}

function bakeLargeStump(): HTMLCanvasElement {
  const c = cv(T + 6, T + 4)
  const g = ctxOf(c)
  px(g, 3, 15, 16, 4, 'rgba(0,0,0,0.18)')
  px(g, 3, 7, 16, 10, '#6e4426')
  px(g, 3, 6, 16, 2, '#8a5a32')
  px(g, 6, 7, 10, 3, '#a8743f')
  px(g, 9, 8, 4, 1, '#c08850')
  px(g, 3, 14, 16, 2, '#52331d')
  return c
}

function bakeRock(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 3, 12, 10, 2, 'rgba(0,0,0,0.15)')
  px(g, 3, 6, 10, 7, '#8b8f99')
  px(g, 4, 5, 7, 2, '#a7abb5')
  px(g, 4, 10, 8, 3, '#6e727c')
  dot(g, 6, 8, '#c2c6cf')
  return c
}

function bakeWeed(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 5, 8, 1, 5, '#3f8a3a')
  px(g, 8, 7, 1, 6, '#3f8a3a')
  px(g, 6, 9, 1, 4, '#56a84a')
  px(g, 4, 9, 2, 1, '#56a84a')
  px(g, 9, 8, 2, 1, '#56a84a')
  px(g, 5, 12, 6, 1, 'rgba(0,0,0,0.12)')
  return c
}

function bakeFlower(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 7, 8, 1, 5, '#3f8a3a')
  px(g, 5, 9, 2, 1, '#3f8a3a')
  // daffodil petals
  px(g, 6, 4, 4, 4, '#ffe14d')
  px(g, 5, 5, 6, 2, '#ffe14d')
  px(g, 7, 5, 2, 2, '#ff9e2c')
  px(g, 6, 3, 1, 1, '#fff0a0')
  return c
}

// ---------------- Crops ----------------
function bakeCrop(color: string, stages: number): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = []
  for (let s = 0; s < stages; s++) {
    const c = cv(T, T)
    const g = ctxOf(c)
    const t = s / (stages - 1)
    if (s === 0) {
      // seed mound
      px(g, 6, 11, 4, 2, '#5a3a22')
      dot(g, 7, 10, '#3a8a3a')
    } else if (t < 0.7) {
      const h = Math.round(2 + t * 8)
      px(g, 7, 13 - h, 2, h, '#3a8a3a')
      px(g, 5, 13 - h, 2, 1, '#56a84a')
      px(g, 9, 13 - h + 1, 2, 1, '#56a84a')
    } else {
      // mature with fruit
      px(g, 7, 5, 2, 8, '#2f7d3a')
      px(g, 4, 6, 3, 1, '#3a8a3a')
      px(g, 9, 7, 3, 1, '#3a8a3a')
      px(g, 5, 8, 6, 5, color)
      px(g, 5, 8, 6, 2, lighten(color))
      px(g, 6, 12, 4, 1, darken(color))
      dot(g, 7, 9, '#ffffff')
    }
    out.push(c)
  }
  return out
}

function lighten(hex: string): string {
  return shade(hex, 36)
}
function darken(hex: string): string {
  return shade(hex, -36)
}
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt))
  const gc = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `rgb(${r},${gc},${b})`
}

// ---------------- Buildings ----------------
function bakeFarmhouse(): HTMLCanvasElement {
  const w = 5 * T
  const h = 3 * T + 18
  const c = cv(w, h)
  const g = ctxOf(c)
  const bodyY = 22
  px(g, 4, bodyY, w - 8, h - bodyY - 2, '#d8b07a')
  px(g, 4, bodyY, w - 8, 4, '#e8c590')
  // roof
  px(g, 0, 6, w, 18, '#b14b3a')
  px(g, 0, 6, w, 4, '#c75c48')
  for (let i = 6; i < w; i += 8) px(g, i, 6, 1, 18, '#9c3e30')
  // chimney
  px(g, w - 22, 0, 8, 10, '#8a6a48')
  // door
  px(g, w / 2 - 7, h - 22, 14, 20, '#6e4426')
  px(g, w / 2 - 7, h - 22, 14, 2, '#8a5a32')
  dot(g, w / 2 + 4, h - 12, '#ffd65c')
  // windows
  px(g, 12, bodyY + 8, 10, 9, '#9fd0e8')
  px(g, w - 22, bodyY + 8, 10, 9, '#9fd0e8')
  px(g, 12, bodyY + 12, 10, 1, '#6e4426')
  px(g, 16, bodyY + 8, 1, 9, '#6e4426')
  return c
}

function bakeStore(): HTMLCanvasElement {
  const w = 6 * T
  const h = 3 * T + 16
  const c = cv(w, h)
  const g = ctxOf(c)
  const bodyY = 20
  px(g, 2, bodyY, w - 4, h - bodyY - 2, '#caa9d6')
  px(g, 2, bodyY, w - 4, 4, '#dcc0e8')
  // roof
  px(g, 0, 4, w, 18, '#5c8a5a')
  px(g, 0, 4, w, 4, '#6fa06a')
  // sign
  px(g, w / 2 - 22, bodyY + 4, 44, 10, '#6e4426')
  px(g, w / 2 - 20, bodyY + 6, 40, 6, '#f0d89a')
  g.fillStyle = '#6e4426'
  g.font = '6px monospace'
  g.fillText('STORE', w / 2 - 15, bodyY + 11)
  // door
  px(g, 8, h - 22, 14, 20, '#6e4426')
  // window
  px(g, w - 26, bodyY + 18, 16, 12, '#9fd0e8')
  px(g, w - 18, bodyY + 18, 1, 12, '#6e4426')
  return c
}

function bakeShrine(restored: boolean): HTMLCanvasElement {
  const w = 3 * T
  const h = 3 * T + 8
  const c = cv(w, h)
  const g = ctxOf(c)
  const stone = restored ? '#cfc6e8' : '#8a8678'
  const stoneL = restored ? '#ece6ff' : '#a09c8e'
  px(g, 6, 18, w - 12, h - 20, stone)
  px(g, 6, 18, w - 12, 4, stoneL)
  // arch
  px(g, 10, 6, w - 20, 16, stone)
  px(g, 14, 2, w - 28, 8, stone)
  // gem
  px(g, w / 2 - 3, 22, 6, 8, restored ? '#7af0c0' : '#4a4636')
  if (restored) {
    px(g, w / 2 - 4, 21, 8, 2, '#bdffe6')
    dot(g, w / 2, 24, '#ffffff')
  }
  // moss / cracks when broken
  if (!restored) {
    px(g, 8, 30, 4, 2, '#5c7d3a')
    px(g, w - 12, 24, 3, 3, '#5c7d3a')
    px(g, 12, 12, 1, 6, '#6e6a5c')
  }
  return c
}

// ---------------- Item icons (for UI, drawn on small canvases) ----------------
export function bakeItemIcon(sprite: string, color?: string): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  switch (sprite) {
    case 'wood':
      px(g, 2, 6, 12, 5, '#8a5a32')
      px(g, 2, 6, 12, 2, '#a8743f')
      for (let i = 3; i < 14; i += 3) px(g, i, 6, 1, 5, '#6e4426')
      break
    case 'hardwood':
      px(g, 2, 5, 12, 7, '#6e4426')
      px(g, 2, 5, 12, 2, '#8a5a32')
      px(g, 4, 6, 8, 1, '#a8743f')
      break
    case 'stone':
      px(g, 3, 6, 10, 7, '#8b8f99')
      px(g, 4, 5, 7, 2, '#a7abb5')
      px(g, 4, 11, 8, 2, '#6e727c')
      break
    case 'daffodil':
      px(g, 7, 9, 1, 4, '#3f8a3a')
      px(g, 6, 4, 4, 4, '#ffe14d')
      px(g, 5, 5, 6, 2, '#ffe14d')
      px(g, 7, 5, 2, 2, '#ff9e2c')
      break
    case 'herbal_tea':
      px(g, 4, 7, 8, 6, '#e8e2d0')
      px(g, 4, 6, 8, 1, '#ffffff')
      px(g, 5, 8, 6, 3, '#7bbf6a')
      px(g, 11, 8, 2, 3, '#e8e2d0')
      px(g, 6, 4, 1, 2, 'rgba(200,220,200,0.7)')
      break
    case 'seed_parsnip':
    case 'seed_strawberry':
    case 'seed_golden_pumpkin':
      px(g, 4, 5, 8, 7, '#d8b888')
      px(g, 4, 5, 8, 2, '#e8cda0')
      px(g, 6, 8, 4, 3, color ?? '#7a5a3a')
      break
    default:
      if (sprite.startsWith('crop_')) {
        px(g, 5, 6, 6, 7, color ?? '#e8506e')
        px(g, 5, 6, 6, 2, lighten(color ?? '#e8506e'))
        px(g, 6, 4, 2, 3, '#2f7d3a')
        dot(g, 7, 8, '#ffffff')
      } else {
        px(g, 4, 4, 8, 8, color ?? '#cccccc')
      }
  }
  return c
}

// ---------------- Public bundle ----------------
export interface Sprites {
  grass: HTMLCanvasElement[]
  soil: HTMLCanvasElement
  soilWet: HTMLCanvasElement
  water: HTMLCanvasElement[]
  path: HTMLCanvasElement
  fence: HTMLCanvasElement
  tree: HTMLCanvasElement
  stump: HTMLCanvasElement
  largeStump: HTMLCanvasElement
  rock: HTMLCanvasElement
  weed: HTMLCanvasElement
  flower: HTMLCanvasElement
  farmer: Record<string, HTMLCanvasElement>
  barnaby: Record<string, HTMLCanvasElement>
  faye: Record<string, HTMLCanvasElement>
  farmhouse: HTMLCanvasElement
  store: HTMLCanvasElement
  shrineBroken: HTMLCanvasElement
  shrineRestored: HTMLCanvasElement
  crops: Record<string, HTMLCanvasElement[]>
}

let cached: Sprites | null = null

export function buildSprites(
  cropDefs: { id: string; color: string; stages: number }[],
): Sprites {
  if (cached) return cached
  const farmerPal: Pal = {
    skin: '#f0c79a',
    skinShade: '#d8a878',
    hair: '#5a3a22',
    top: '#4a7fc4',
    topShade: '#3a66a0',
    bottom: '#3a4a6a',
    accent: '#9fd0e8',
    hat: '#e8c86a',
    hatShade: '#cda84e',
  }
  const barnabyPal: Pal = {
    skin: '#f0c79a',
    skinShade: '#d8a878',
    hair: '#caa05a',
    top: '#c8763e',
    topShade: '#a85e30',
    bottom: '#6e4426',
    accent: '#fbe3b3',
  }
  const fayePal: Pal = {
    skin: '#ecc6a4',
    skinShade: '#d0a684',
    hair: '#6e8f5e',
    top: '#6e8f5e',
    topShade: '#577445',
    bottom: '#4a5a3a',
    accent: '#d9c6ec',
    hood: true,
  }

  const crops: Record<string, HTMLCanvasElement[]> = {}
  for (const cd of cropDefs) crops[cd.id] = bakeCrop(cd.color, cd.stages)

  cached = {
    grass: [bakeGrass(0), bakeGrass(1), bakeGrass(2)],
    soil: bakeSoil(false),
    soilWet: bakeSoil(true),
    water: [bakeWater(0), bakeWater(1), bakeWater(2), bakeWater(3)],
    path: bakePath(),
    fence: bakeFence(),
    tree: bakeTree(),
    stump: bakeStump(),
    largeStump: bakeLargeStump(),
    rock: bakeRock(),
    weed: bakeWeed(),
    flower: bakeFlower(),
    farmer: bakeHumanoidSheet(farmerPal),
    barnaby: bakeHumanoidSheet(barnabyPal),
    faye: bakeHumanoidSheet(fayePal),
    farmhouse: bakeFarmhouse(),
    store: bakeStore(),
    shrineBroken: bakeShrine(false),
    shrineRestored: bakeShrine(true),
    crops,
  }
  return cached
}

export const QUALITY_GLYPH: Record<CropQuality, string> = {
  normal: '',
  silver: '◇',
  gold: '◆',
  perfect: '★',
}

// ---------------- Tool / DOM icons ----------------
function bakeToolIcon(tool: string): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  switch (tool) {
    case 'hoe':
      px(g, 4, 3, 2, 9, '#9a6a3a')
      px(g, 4, 3, 6, 2, '#8b8f99')
      px(g, 8, 3, 2, 4, '#8b8f99')
      break
    case 'watering_can':
      px(g, 4, 6, 7, 6, '#7fa8c0')
      px(g, 4, 6, 7, 2, '#a7cbe0')
      px(g, 10, 4, 3, 3, '#7fa8c0')
      px(g, 11, 3, 3, 2, '#a7cbe0')
      px(g, 3, 5, 2, 3, '#5e89a0')
      break
    case 'axe':
      px(g, 7, 3, 2, 10, '#9a6a3a')
      px(g, 8, 3, 4, 4, '#c0c4cd')
      px(g, 8, 3, 4, 1, '#e0e4ed')
      break
    case 'scythe':
      px(g, 6, 4, 2, 9, '#9a6a3a')
      px(g, 6, 4, 6, 2, '#c0c4cd')
      px(g, 10, 4, 2, 4, '#c0c4cd')
      break
    case 'hand':
      px(g, 5, 5, 6, 7, '#f0c79a')
      px(g, 5, 4, 2, 3, '#f0c79a')
      px(g, 7, 4, 2, 2, '#f0c79a')
      px(g, 9, 4, 2, 3, '#f0c79a')
      px(g, 5, 11, 6, 1, '#d8a878')
      break
    case 'backpack':
      px(g, 4, 5, 8, 8, '#9a6a3a')
      px(g, 4, 5, 8, 2, '#b3824a')
      px(g, 6, 8, 4, 3, '#6e4426')
      break
    default:
      px(g, 4, 4, 8, 8, '#cccccc')
  }
  return c
}

const iconCache = new Map<string, string>()

export function iconURL(key: string, color?: string): string {
  const ck = `${key}|${color ?? ''}`
  const hit = iconCache.get(ck)
  if (hit) return hit
  let canvas: HTMLCanvasElement
  if (['hoe', 'watering_can', 'axe', 'scythe', 'hand', 'backpack'].includes(key)) {
    canvas = bakeToolIcon(key)
  } else {
    canvas = bakeItemIcon(key, color)
  }
  const url = canvas.toDataURL()
  iconCache.set(ck, url)
  return url
}
