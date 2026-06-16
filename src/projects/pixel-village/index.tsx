import { useEffect, useRef } from 'react'

/* ===========================================================================
 * Pixel Village — a high-detail, fully procedural 2D pixel-art scene.
 *
 * Everything you see is generated in code: no external images. Sprites are
 * built either from 2D character-grid arrays (a palette-ID matrix where a space
 * is a transparent pixel) or drawn procedurally with shading + dithering. The
 * ground is an isometric (2:1) tilemap, objects are Y-sorted, and the stream is
 * animated by shifting its pixel pattern each frame. Drag to pan the camera.
 * ========================================================================= */

type RGBA = [number, number, number, number]

const TRANSPARENT: RGBA = [0, 0, 0, 0]

/** Global light direction (top-left), used for consistent shading everywhere. */
const LIGHT = { x: -0.62, y: -0.78 }

const TILE_W = 32
const TILE_H = 16
const GRID = 14

function hexToRgba(hex: string): RGBA {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    255,
  ]
}

function darken([r, g, b, a]: RGBA, f: number): RGBA {
  return [Math.round(r * f), Math.round(g * f), Math.round(b * f), a]
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/* ------------------------------------------------------------------ buffer */

/** A tiny RGBA pixel buffer with the drawing primitives the sprites need. */
class Buf {
  w: number
  h: number
  data: Uint8ClampedArray

  constructor(w: number, h: number) {
    this.w = w
    this.h = h
    this.data = new Uint8ClampedArray(w * h * 4)
  }

  set(x: number, y: number, c: RGBA) {
    x |= 0
    y |= 0
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || c[3] === 0) return
    const i = (y * this.w + x) * 4
    this.data[i] = c[0]
    this.data[i + 1] = c[1]
    this.data[i + 2] = c[2]
    this.data[i + 3] = c[3]
  }

  alphaAt(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0
    return this.data[(y * this.w + x) * 4 + 3]
  }

  colorAt(x: number, y: number): RGBA {
    const i = (y * this.w + x) * 4
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]
  }

  /**
   * Selective outline: every transparent pixel touching the silhouette is
   * filled with a darker hue *of the adjacent pixel's own color* — a colored
   * outline rather than a harsh black one.
   */
  outline(factor = 0.55) {
    const adds: [number, number, RGBA][] = []
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alphaAt(x, y) > 0) continue
        const n =
          this.alphaAt(x - 1, y) > 0
            ? this.colorAt(x - 1, y)
            : this.alphaAt(x + 1, y) > 0
              ? this.colorAt(x + 1, y)
              : this.alphaAt(x, y - 1) > 0
                ? this.colorAt(x, y - 1)
                : this.alphaAt(x, y + 1) > 0
                  ? this.colorAt(x, y + 1)
                  : null
        if (n) adds.push([x, y, darken(n, factor)])
      }
    }
    for (const [x, y, c] of adds) this.set(x, y, c)
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas')
    c.width = this.w
    c.height = this.h
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(this.w, this.h)
    img.data.set(this.data)
    ctx.putImageData(img, 0, 0)
    return c
  }
}

/**
 * Pick a tone from a ramp by `t` ∈ [0,1], dithering between the two nearest
 * tones with an interlocking checkerboard to fake extra gradient steps.
 */
function rampDither(stops: RGBA[], t: number, x: number, y: number): RGBA {
  t = clamp01(t)
  const f = t * (stops.length - 1)
  const i = Math.floor(f)
  if (i >= stops.length - 1) return stops[stops.length - 1]
  const frac = f - i
  const checker = ((x + y) & 1) === 0
  const thresh = checker ? 0.32 : 0.68
  return frac > thresh ? stops[i + 1] : stops[i]
}

/** Lambert-ish term in [0,1] from a surface normal, lit from LIGHT. */
function litFromNormal(nx: number, ny: number) {
  return clamp01(0.5 - (nx * LIGHT.x + ny * LIGHT.y) * 0.62 + 0.18)
}

/* ----------------------------------------------------- array-based sprites */

/**
 * Build a sprite from a character grid. Each glyph maps to a palette color; a
 * space (or '.') is a transparent pixel (the classic "0 = transparent" rule).
 * This is the explicit array/matrix sprite-data path.
 */
function spriteFromRows(rows: string[], palette: Record<string, string>): Buf {
  const h = rows.length
  const w = Math.max(...rows.map((r) => r.length))
  const pal: Record<string, RGBA> = {}
  for (const k in palette) pal[k] = hexToRgba(palette[k])
  const buf = new Buf(w, h)
  for (let y = 0; y < h; y++) {
    const row = rows[y]
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (ch === ' ' || ch === '.' || ch === '0') continue
      const c = pal[ch]
      if (c) buf.set(x, y, c)
    }
  }
  return buf
}

// A plump pixel mushroom, authored as a palette-ID matrix.
const MUSHROOM = spriteFromRows(
  [
    '....CCCC....',
    '..CCccccCC..',
    '.CcwwccccwC.',
    'CccccwwccccC',
    'Ccwccccccwcc',
    'CccccccwcccC',
    'CcccwccccccC',
    '.CccccccccC.',
    '..sSSSSSSs..',
    '..sMmmmmMs..',
    '..sMmmmmMs..',
    '...ssssss...',
  ],
  {
    C: '#c94f6f', // cap dark / outline-ish
    c: '#ef6f8f', // cap base
    w: '#ffd7e2', // cap spots / highlight
    S: '#f3ead6', // stem top light
    s: '#cdbf9f', // stem shade
    M: '#e9dcc0', // stem light
    m: '#d8c8a8', // stem base
  },
)

// A tiny flower, also a matrix sprite.
const FLOWER = spriteFromRows(
  [
    '.p.p.',
    'pYpYp',
    '.pYp.',
    'pYpYp',
    '.p.p.',
    '..g..',
    '..g..',
  ],
  {
    p: '#f6a6d2', // petal
    Y: '#ffe08a', // pollen center
    g: '#5fae46', // stem
  },
)

/* --------------------------------------------------- procedural: iso tiles */

/** Fill the body of a 32×16 isometric diamond via a per-pixel shader. */
function diamond(shade: (x: number, y: number) => RGBA): Buf {
  const buf = new Buf(TILE_W, TILE_H)
  const cx = TILE_W / 2
  for (let y = 0; y < TILE_H; y++) {
    const dy = Math.abs(y - (TILE_H / 2 - 0.5))
    const hw = Math.round((1 - dy / (TILE_H / 2)) * (TILE_W / 2))
    for (let x = cx - hw; x < cx + hw; x++) buf.set(x, y, shade(x, y))
  }
  return buf
}

function makeGrassTile(seed: number): HTMLCanvasElement {
  const ramp: RGBA[] = [
    hexToRgba('#5aa84a'),
    hexToRgba('#74c155'),
    hexToRgba('#8fd766'),
    hexToRgba('#abe884'),
  ]
  const dark = hexToRgba('#4f9a42')
  const buf = diamond((x, y) => {
    // Brighter toward the top of the diamond (light from above).
    const t = 0.25 + (1 - y / TILE_H) * 0.7
    let c = rampDither(ramp, t, x, y)
    // Deterministic speckle texture so each variant looks a little different.
    const n = (x * 7 + y * 13 + seed * 131) % 17
    if (n === 0) c = dark
    return c
  })
  // Bright top edge highlight + selective outline underneath.
  const cx = TILE_W / 2
  for (let y = 0; y < TILE_H; y++) {
    const dy = Math.abs(y - (TILE_H / 2 - 0.5))
    const hw = Math.round((1 - dy / (TILE_H / 2)) * (TILE_W / 2))
    if (hw <= 0) continue
    if (y < TILE_H / 2) {
      buf.set(cx - hw, y, hexToRgba('#bdf0a0'))
      buf.set(cx + hw - 1, y, hexToRgba('#bdf0a0'))
    } else {
      buf.set(cx - hw, y, darken(hexToRgba('#4f9a42'), 0.9))
      buf.set(cx + hw - 1, y, darken(hexToRgba('#4f9a42'), 0.9))
    }
  }
  return buf.toCanvas()
}

const GRASS_TILES = [0, 1, 2, 3].map(makeGrassTile)

/** Animated water tile — the wave/sparkle pattern is shifted by `phase`. */
function makeWaterTile(phase: number): HTMLCanvasElement {
  const ramp: RGBA[] = [
    hexToRgba('#2f7bd6'),
    hexToRgba('#3f97e6'),
    hexToRgba('#62b6f2'),
    hexToRgba('#9bd9fb'),
  ]
  const buf = diamond((x, y) => {
    // Sinusoidal bands scrolling diagonally => a flowing current.
    const wave = Math.sin(x * 0.5 + y * 0.9 + phase * 0.9) * 0.5 + 0.5
    const t = 0.25 + wave * 0.6
    let c = rampDither(ramp, t, x, y)
    // Sparkles: shifting white highlights riding the crests.
    const h = (x * 5 + y * 11 + phase * 3) % 23
    if (wave > 0.86 && h < 2) c = hexToRgba('#ffffff')
    return c
  })
  return buf.toCanvas()
}

const WATER_FRAMES = 8
const WATER_TILES = Array.from({ length: WATER_FRAMES }, (_, i) =>
  makeWaterTile((i / WATER_FRAMES) * Math.PI * 2),
)

/* ----------------------------------------------- procedural: scene objects */

function makeTrunk(): HTMLCanvasElement {
  const w = 10
  const h = 16
  const ramp: RGBA[] = [
    hexToRgba('#7c5230'),
    hexToRgba('#9a6b3f'),
    hexToRgba('#b98a55'),
  ]
  const buf = new Buf(w, h)
  for (let y = 2; y < h; y++) {
    // A gently bulging, rooted trunk.
    const r = 2 + (y > h - 4 ? (y - (h - 4)) * 0.9 : 0)
    for (let x = w / 2 - r - 1; x <= w / 2 + r; x++) {
      const nx = (x - w / 2) / (r + 1)
      const t = litFromNormal(nx, -0.2)
      buf.set(x, y, rampDither(ramp, t, x, y))
    }
  }
  buf.outline(0.5)
  return buf.toCanvas()
}

function makeFoliage(): HTMLCanvasElement {
  const w = 34
  const h = 30
  const ramp: RGBA[] = [
    hexToRgba('#3f8f3a'),
    hexToRgba('#5cb046'),
    hexToRgba('#79cf5a'),
    hexToRgba('#a6ee82'),
    hexToRgba('#cdf7a4'),
  ]
  const buf = new Buf(w, h)
  // Overlapping clusters give the "fluffy, rounded, detailed" canopy. Each
  // cluster is lit independently so the canopy reads as many leaf bunches.
  const clusters: [number, number, number][] = [
    [17, 11, 11],
    [9, 14, 7.5],
    [25, 14, 7.5],
    [13, 7, 6.5],
    [22, 7, 6],
    [17, 17, 8],
  ]
  for (const [cx, cy, r] of clusters) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const dx = (x - cx) / r
        const dy = (y - cy) / r
        if (dx * dx + dy * dy > 1) continue
        const t = litFromNormal(dx, dy)
        buf.set(x, y, rampDither(ramp, t, x, y))
      }
    }
  }
  // Hanging fruit — round, with a tiny specular dot.
  const fruit: [number, number][] = [
    [11, 19],
    [24, 20],
    [18, 23],
  ]
  for (const [cx, cy] of fruit) {
    for (let y = cy - 2; y <= cy + 2; y++) {
      for (let x = cx - 2; x <= cx + 2; x++) {
        const dx = (x - cx) / 2.4
        const dy = (y - cy) / 2.4
        if (dx * dx + dy * dy > 1) continue
        const t = litFromNormal(dx, dy)
        buf.set(x, y, t > 0.7 ? hexToRgba('#ff8a6b') : t > 0.4 ? hexToRgba('#ef5b5b') : hexToRgba('#c23b3b'))
      }
    }
    buf.set(cx - 1, cy - 1, hexToRgba('#ffe1d2'))
  }
  buf.outline(0.5)
  return buf.toCanvas()
}

function makeBoulder(): HTMLCanvasElement {
  const w = 22
  const h = 15
  const ramp: RGBA[] = [
    hexToRgba('#8f897e'),
    hexToRgba('#aaa499'),
    hexToRgba('#c6c1b7'),
    hexToRgba('#dcd8cf'),
  ]
  const buf = new Buf(w, h)
  const cx = w / 2
  const cy = h * 0.62
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / (w / 2 - 1)
      const dy = (y - cy) / (h * 0.62)
      if (dx * dx + dy * dy > 1) continue
      const t = litFromNormal(dx, dy)
      let c = rampDither(ramp, t, x, y)
      // A couple of cracks/speckles for stony texture.
      if ((x * 3 + y * 7) % 19 === 0) c = darken(c, 0.82)
      buf.set(x, y, c)
    }
  }
  buf.outline(0.55)
  return buf.toCanvas()
}

function makeCottage(): HTMLCanvasElement {
  const w = 46
  const h = 44
  const buf = new Buf(w, h)

  // --- walls: warm plaster with subtle dither + a brick base course ---
  const wall: RGBA[] = [hexToRgba('#efd9b2'), hexToRgba('#f6e6c8')]
  const wallX0 = 8
  const wallX1 = 38
  const wallY0 = 20
  const wallY1 = 40
  for (let y = wallY0; y < wallY1; y++) {
    for (let x = wallX0; x < wallX1; x++) {
      buf.set(x, y, rampDither(wall, 0.5, x, y))
    }
  }
  // Brick base course (bottom 6px) — staggered bricks with mortar lines.
  const brick = hexToRgba('#cf8d6a')
  const brickLt = hexToRgba('#e0a784')
  const mortar = hexToRgba('#b9b09a')
  for (let y = wallY1 - 6; y < wallY1; y++) {
    for (let x = wallX0; x < wallX1; x++) {
      const row = Math.floor((y - (wallY1 - 6)) / 3)
      const offset = row % 2 === 0 ? 0 : 4
      const isMortar = (y - (wallY1 - 6)) % 3 === 0 || (x + offset) % 8 === 0
      buf.set(x, y, isMortar ? mortar : (x + y) % 2 === 0 ? brickLt : brick)
    }
  }

  // --- door: wood with vertical grain + a knob ---
  const doorX0 = 19
  const doorX1 = 27
  const doorY0 = 28
  const doorWood: RGBA[] = [hexToRgba('#7a4f2c'), hexToRgba('#9c6b3f'), hexToRgba('#b9854f')]
  for (let y = doorY0; y < wallY1; y++) {
    for (let x = doorX0; x < doorX1; x++) {
      const nx = (x - (doorX0 + doorX1) / 2) / 4
      let c = rampDither(doorWood, litFromNormal(nx, -0.1), x, y)
      if ((x - doorX0) % 3 === 2) c = darken(c, 0.8) // grain lines
      buf.set(x, y, c)
    }
  }
  // Arched door top.
  buf.set(doorX0, doorY0, TRANSPARENT)
  buf.set(doorX1 - 1, doorY0, TRANSPARENT)
  buf.set(25, 33, hexToRgba('#ffe08a')) // knob

  // --- window: glass with a white cross frame + corner highlight ---
  const winX0 = 11
  const winX1 = 17
  const winY0 = 24
  const winY1 = 31
  for (let y = winY0; y < winY1; y++) {
    for (let x = winX0; x < winX1; x++) {
      const glass = (x + y) % 2 === 0 ? hexToRgba('#bfe6f0') : hexToRgba('#a9d8ec')
      buf.set(x, y, glass)
    }
  }
  buf.set(winX0 + 1, winY0 + 1, hexToRgba('#eafaff'))
  buf.set(winX0 + 2, winY0 + 1, hexToRgba('#eafaff'))
  for (let y = winY0; y < winY1; y++) buf.set((winX0 + winX1) >> 1, y, hexToRgba('#f3e6c8'))
  for (let x = winX0; x < winX1; x++) buf.set(x, (winY0 + winY1) >> 1, hexToRgba('#f3e6c8'))

  // --- roof: shingled trapezoid, lit & dithered, with a bright ridge ---
  const roof: RGBA[] = [hexToRgba('#b85740'), hexToRgba('#d76f54'), hexToRgba('#ef8e6e')]
  const roofTop = 5
  const roofBot = 21
  for (let y = roofTop; y < roofBot; y++) {
    const f = (y - roofTop) / (roofBot - roofTop)
    const half = 6 + f * 17
    const cxr = w / 2
    for (let x = Math.round(cxr - half); x < Math.round(cxr + half); x++) {
      // Shingle rows (every 3px) + checker dither for texture.
      const shingleRow = Math.floor((y - roofTop) / 3)
      const base = rampDither(roof, 0.7 - f * 0.3, x, y)
      let c = base
      if ((y - roofTop) % 3 === 0) c = darken(base, 0.78) // shingle seam
      else if ((x + shingleRow) % 6 === 0) c = darken(base, 0.9)
      buf.set(x, y, c)
    }
  }
  // Bright ridge line along the top of the roof.
  for (let x = (w >> 1) - 6; x < (w >> 1) + 6; x++) buf.set(x, roofTop, hexToRgba('#ffb499'))

  buf.outline(0.5)
  return buf.toCanvas()
}

const SPR = {
  trunk: makeTrunk(),
  foliage: makeFoliage(),
  boulder: makeBoulder(),
  cottage: makeCottage(),
  mushroom: MUSHROOM.toCanvas(),
  flower: FLOWER.toCanvas(),
}

/* ------------------------------------------------------------- scene layout */

type ObjKind = 'tree' | 'cottage' | 'boulder' | 'mushroom' | 'flower'
interface SceneObj {
  kind: ObjKind
  gx: number
  gy: number
  phase: number
}

// Meandering 2-tile-wide stream.
function streamCenter(gx: number) {
  return 6 + Math.round(Math.sin(gx * 0.62) * 2)
}
function isWater(gx: number, gy: number) {
  const c = streamCenter(gx)
  return gy === c || gy === c + 1
}

const OBJECTS: SceneObj[] = (() => {
  const out: SceneObj[] = []
  const add = (kind: ObjKind, gx: number, gy: number) =>
    out.push({ kind, gx, gy, phase: (gx * 12.9898 + gy * 78.233) % (Math.PI * 2) })
  add('cottage', 3, 3)
  const trees: [number, number][] = [
    [10, 2], [12, 5], [2, 8], [11, 10], [8, 12], [13, 11], [5, 12], [1, 4],
  ]
  for (const [gx, gy] of trees) if (!isWater(gx, gy)) add('tree', gx, gy)
  const boulders: [number, number][] = [[9, 5], [4, 10], [12, 8]]
  for (const [gx, gy] of boulders) if (!isWater(gx, gy)) add('boulder', gx, gy)
  const mush: [number, number][] = [[6, 3], [11, 3], [3, 11], [9, 9]]
  for (const [gx, gy] of mush) if (!isWater(gx, gy)) add('mushroom', gx, gy)
  const flowers: [number, number][] = [[5, 5], [7, 7], [2, 6], [10, 7], [4, 2], [12, 13]]
  for (const [gx, gy] of flowers) if (!isWater(gx, gy)) add('flower', gx, gy)
  return out
})()

// World-space (logical) helpers for the isometric projection.
const GROUND_W = GRID * TILE_W
const GROUND_H = GRID * TILE_H + TILE_H
const ORIGIN_X = (GRID - 1) * (TILE_W / 2) // shift negative iso-x into range
function tileVertex(gx: number, gy: number) {
  return {
    x: (gx - gy) * (TILE_W / 2) + ORIGIN_X,
    y: (gx + gy) * (TILE_H / 2),
  }
}

/** Bake all grass tiles once into a single world-sized canvas. */
function bakeGround(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = GROUND_W
  c.height = GROUND_H
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  for (let s = 0; s <= GRID * 2 - 2; s++) {
    for (let gx = 0; gx < GRID; gx++) {
      const gy = s - gx
      if (gy < 0 || gy >= GRID) continue
      if (isWater(gx, gy)) continue // water drawn live on top
      const v = tileVertex(gx, gy)
      const tile = GRASS_TILES[(gx * 3 + gy) % GRASS_TILES.length]
      ctx.drawImage(tile, Math.round(v.x - TILE_W / 2), Math.round(v.y))
    }
  }
  return c
}

/* ---------------------------------------------------------------- component */

export default function PixelVillage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const container = containerRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const ground = bakeGround()

    let scale = 3
    let logicalW = 1
    let logicalH = 1
    const off = document.createElement('canvas')
    const offCtx = off.getContext('2d')!

    // Camera = logical position of the ground canvas's top-left.
    const cam = { x: 0, y: 0 }
    let camInit = false

    function clampCam() {
      const minX = logicalW - GROUND_W - 30
      const maxX = 30
      const minY = logicalH - GROUND_H - 30
      const maxY = 60
      cam.x = Math.min(maxX, Math.max(minX, cam.x))
      cam.y = Math.min(maxY, Math.max(minY, cam.y))
    }

    function resize() {
      const rect = container.getBoundingClientRect()
      scale = Math.max(2, Math.min(5, Math.floor(rect.height / 230)))
      canvas.width = Math.floor(rect.width)
      canvas.height = Math.floor(rect.height)
      logicalW = Math.ceil(canvas.width / scale)
      logicalH = Math.ceil(canvas.height / scale)
      off.width = logicalW
      off.height = logicalH
      offCtx.imageSmoothingEnabled = false
      ctx.imageSmoothingEnabled = false
      if (!camInit) {
        cam.x = Math.round((logicalW - GROUND_W) / 2)
        cam.y = Math.round((logicalH - GROUND_H) / 2)
        camInit = true
      }
      clampCam()
    }

    let tick = 0
    function frame() {
      tick++
      // Sky gradient backdrop.
      const sky = offCtx.createLinearGradient(0, 0, 0, logicalH)
      sky.addColorStop(0, '#bfe9f5')
      sky.addColorStop(1, '#e9f8e4')
      offCtx.fillStyle = sky
      offCtx.fillRect(0, 0, logicalW, logicalH)

      // Baked grass.
      offCtx.drawImage(ground, Math.round(cam.x), Math.round(cam.y))

      // Live water tiles (pixel-shifted current).
      for (let s = 0; s <= GRID * 2 - 2; s++) {
        for (let gx = 0; gx < GRID; gx++) {
          const gy = s - gx
          if (gy < 0 || gy >= GRID || !isWater(gx, gy)) continue
          const v = tileVertex(gx, gy)
          const fi = (((tick >> 2) + gx + gy * 2) % WATER_FRAMES + WATER_FRAMES) % WATER_FRAMES
          offCtx.drawImage(
            WATER_TILES[fi],
            Math.round(cam.x + v.x - TILE_W / 2),
            Math.round(cam.y + v.y),
          )
        }
      }

      // Y-sorted objects (draw far → near so nearer ones overlap correctly).
      const sorted = [...OBJECTS].sort((a, b) => a.gx + a.gy - (b.gx + b.gy) || a.gx - b.gx)
      const t = tick * 0.06
      for (const o of sorted) {
        const v = tileVertex(o.gx, o.gy)
        const footX = cam.x + v.x // tile-center x
        const footY = cam.y + v.y + TILE_H / 2 // tile-center y
        if (o.kind === 'tree') {
          const tr = SPR.trunk
          const fo = SPR.foliage
          const tx = Math.round(footX - tr.width / 2)
          const ty = Math.round(footY - tr.height + 2)
          offCtx.drawImage(tr, tx, ty)
          // Leaves rustle: a small periodic horizontal sway + tiny bob.
          const sway = Math.round(Math.sin(t + o.phase) * 1.4)
          const bob = Math.round(Math.cos(t * 0.8 + o.phase) * 0.6)
          offCtx.drawImage(
            fo,
            Math.round(footX - fo.width / 2) + sway,
            ty - fo.height + 7 + bob,
          )
        } else {
          const spr =
            o.kind === 'cottage'
              ? SPR.cottage
              : o.kind === 'boulder'
                ? SPR.boulder
                : o.kind === 'mushroom'
                  ? SPR.mushroom
                  : SPR.flower
          offCtx.drawImage(
            spr,
            Math.round(footX - spr.width / 2),
            Math.round(footY - spr.height + 3),
          )
        }
      }

      // Blit the logical buffer to screen at integer scale — crisp pixels.
      ctx.drawImage(off, 0, 0, logicalW, logicalH, 0, 0, logicalW * scale, logicalH * scale)
      raf = requestAnimationFrame(frame)
    }

    // Drag-to-pan.
    let dragging = false
    let sx = 0
    let sy = 0
    let camSx = 0
    let camSy = 0
    const onDown = (e: PointerEvent) => {
      dragging = true
      sx = e.clientX
      sy = e.clientY
      camSx = cam.x
      camSy = cam.y
      canvas.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      cam.x = camSx + (e.clientX - sx) / scale
      cam.y = camSy + (e.clientY - sy) / scale
      clampCam()
    }
    const onUp = () => {
      dragging = false
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    let raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-[#bfe9f5]">
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-grab touch-none active:cursor-grabbing"
        style={{ imageRendering: 'pixelated' }}
      />
      <div className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 text-center">
        <h1 className="text-2xl font-extrabold tracking-wide text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.45)]">
          🏡 Pixel Village
        </h1>
        <p className="mt-1 text-sm font-medium text-white/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
          procedural pixel art · drag to pan
        </p>
      </div>
    </div>
  )
}
