// Preview-only renderer for the Tiny Dew Valley art pass.
// Dependency-free: a tiny RGBA-framebuffer Canvas2D shim feeds the SAME
// sprite-baking code from engine/sprites.ts, and game.ts live-drawn elements
// (cooking fire, animals, pens) are mirrored here. Output is a PNG contact
// sheet written to disk so the changes can be reviewed before merge.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// ---------------- Minimal Canvas2D shim ----------------
function parseColor(s) {
  if (typeof s !== 'string') return [0, 0, 0, 255]
  if (s[0] === '#') {
    let h = s.slice(1)
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    const n = parseInt(h, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
  }
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (m) {
    const p = m[1].split(',').map((v) => parseFloat(v.trim()))
    return [p[0] | 0, p[1] | 0, p[2] | 0, p[3] == null ? 255 : Math.round(p[3] * 255)]
  }
  return [0, 0, 0, 255]
}

class Ctx {
  constructor(canvas) {
    this.canvas = canvas
    this.fillStyle = '#000'
    this.strokeStyle = '#000'
    this.font = ''
    this.textAlign = 'left'
    this.lineWidth = 1
    this.imageSmoothingEnabled = false
  }
  _blend(x, y, rgba) {
    const { width: w, height: h, _d: d } = this.canvas
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 4
    const a = rgba[3] / 255
    if (a >= 1) {
      d[i] = rgba[0]; d[i + 1] = rgba[1]; d[i + 2] = rgba[2]; d[i + 3] = 255
    } else if (a > 0) {
      d[i] = Math.round(rgba[0] * a + d[i] * (1 - a))
      d[i + 1] = Math.round(rgba[1] * a + d[i + 1] * (1 - a))
      d[i + 2] = Math.round(rgba[2] * a + d[i + 2] * (1 - a))
      d[i + 3] = Math.max(d[i + 3], rgba[3])
    }
  }
  fillRect(x, y, w, h) {
    const c = parseColor(this.fillStyle)
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h)
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this._blend(x + i, y + j, c)
  }
  // stubs — bake code only paints the STORE label with these; skip glyphs.
  fillText() {}
  beginPath() {}
  arc() {}
  fill() {}
  stroke() {}
  save() {}
  restore() {}
  translate() {}
  rotate() {}
}

function createCanvas(w, h) {
  const c = { width: w, height: h, _d: new Uint8ClampedArray(w * h * 4) }
  c._ctx = new Ctx(c)
  c.getContext = () => c._ctx
  return c
}

// Nearest-neighbour blit of a baked canvas onto another, integer-scaled,
// optionally rotated 90° clockwise (for vertical fence runs). Transparent
// (alpha 0) source pixels are skipped so sprites composite cleanly.
function blit(dst, src, dx, dy, scale = 1, rot90 = false) {
  const g = dst.getContext()
  for (let sy = 0; sy < src.height; sy++) {
    for (let sx = 0; sx < src.width; sx++) {
      const i = (sy * src.width + sx) * 4
      if (src._d[i + 3] === 0) continue
      g.fillStyle = `rgba(${src._d[i]},${src._d[i + 1]},${src._d[i + 2]},${src._d[i + 3] / 255})`
      const px = rot90 ? dx + (src.height - 1 - sy) * scale : dx + sx * scale
      const py = rot90 ? dy + sx * scale : dy + sy * scale
      g.fillRect(px, py, scale, scale)
    }
  }
}

// ---------------- PNG encoder ----------------
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const t = Buffer.from(type, 'ascii')
  const body = Buffer.concat([t, data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
function encodePNG(canvas) {
  const { width: w, height: h, _d: d } = canvas
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    d.subarray(y * w * 4, (y + 1) * w * 4).forEach((v, i) => (raw[y * (w * 4 + 1) + 1 + i] = v))
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------- Document shim, then import baked sprites ----------------
globalThis.document = { createElement: () => createCanvas(1, 1) }
// createElement('canvas') is called as cv(w,h) which sets width/height after;
// our canvas allocates lazily on first context use, so re-alloc on size set:
globalThis.document = {
  createElement: () => {
    const c = createCanvas(1, 1)
    let w = 1, h = 1
    Object.defineProperty(c, 'width', { get: () => w, set: (v) => { w = v; c._d = new Uint8ClampedArray(w * h * 4) } })
    Object.defineProperty(c, 'height', { get: () => h, set: (v) => { h = v; c._d = new Uint8ClampedArray(w * h * 4) } })
    return c
  },
}
globalThis.performance = globalThis.performance ?? { now: () => 0 }

const { buildSprites } = await import(
  '../src/projects/tiny-dew-valley/engine/sprites.ts'
)
const { CROPS } = await import('../src/projects/tiny-dew-valley/data/crops.ts')

const cropDefs = Object.values(CROPS).map((c) => ({ id: c.id, color: c.color, stages: c.stages }))
const SP = buildSprites(cropDefs)

// ---------------- Mirrored game.ts live draws ----------------
const TIME = 600 // ms, fixed flame phase for the still
function drawCookingFire(g, x, y, S) {
  // (mirrors Game.drawCookingFire — keep in sync)
  const now = TIME / 1000
  g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x + 4 * S, y + 26 * S, 24 * S, 4 * S)
  // stone ring
  const stones = [[3, 22], [7, 25], [13, 26], [19, 25], [24, 22], [25, 16], [3, 16]]
  for (const [sx, sy] of stones) {
    g.fillStyle = '#8b8f99'; g.fillRect(x + sx * S, y + sy * S, 6 * S, 5 * S)
    g.fillStyle = '#a7abb5'; g.fillRect(x + sx * S, y + sy * S, 6 * S, 2 * S)
    g.fillStyle = '#6e727c'; g.fillRect(x + sx * S, y + (sy + 4) * S, 6 * S, 1 * S)
  }
  // logs
  g.fillStyle = '#6e4426'; g.fillRect(x + 8 * S, y + 20 * S, 16 * S, 3 * S)
  g.fillStyle = '#8a5a32'; g.fillRect(x + 9 * S, y + 18 * S, 14 * S, 3 * S)
  g.fillStyle = '#a8743f'; g.fillRect(x + 10 * S, y + 18 * S, 3 * S, 1 * S)
  // flames (flicker)
  const f = Math.sin(now * 9) * 1.2
  g.fillStyle = '#e0532f'; g.fillRect(x + (10) * S, y + (12) * S, 12 * S, 9 * S)
  g.fillStyle = '#f0902f'; g.fillRect(x + (12 - f) * S, y + (9) * S, 8 * S, 11 * S)
  g.fillStyle = '#f7c63b'; g.fillRect(x + (14) * S, y + (8 + f) * S, 4 * S, 11 * S)
  g.fillStyle = '#fff0a6'; g.fillRect(x + (15) * S, y + (10) * S, 2 * S, 6 * S)
  // embers
  g.fillStyle = '#ffd27a'
  for (let i = 0; i < 3; i++) {
    const ey = (now * 20 + i * 7) % 16
    g.fillRect(x + (12 + i * 4) * S, y + (14 - ey) * S, 1 * S, 1 * S)
  }
}

function drawChicken(g, sx, sy, S, base) {
  g.fillStyle = '#3a2a24'; g.fillRect(sx - 5 * S, sy + 4 * S, 1 * S, 2 * S); g.fillRect(sx + 1 * S, sy + 4 * S, 1 * S, 2 * S) // legs
  g.fillStyle = '#caa83f'; g.fillRect(sx - 5 * S, sy - 2 * S, 9 * S, 7 * S) // body outline-ish
  g.fillStyle = base; g.fillRect(sx - 4 * S, sy - 1 * S, 7 * S, 5 * S)
  g.fillStyle = '#fff4cf'; g.fillRect(sx - 4 * S, sy - 1 * S, 7 * S, 2 * S) // back highlight
  g.fillStyle = base; g.fillRect(sx - 1 * S, sy - 5 * S, 4 * S, 4 * S) // head
  g.fillStyle = '#e05a36'; g.fillRect(sx, sy - 7 * S, 2 * S, 2 * S) // comb
  g.fillStyle = '#e7a32f'; g.fillRect(sx + 3 * S, sy - 3 * S, 2 * S, 1 * S) // beak
  g.fillStyle = '#2a2230'; g.fillRect(sx + 1 * S, sy - 4 * S, 1 * S, 1 * S) // eye
}
function drawCow(g, sx, sy, S, base) {
  g.fillStyle = '#3a2a24'; g.fillRect(sx - 5 * S, sy + 5 * S, 1 * S, 3 * S); g.fillRect(sx + 2 * S, sy + 5 * S, 1 * S, 3 * S)
  g.fillStyle = base; g.fillRect(sx - 6 * S, sy - 1 * S, 11 * S, 6 * S)
  g.fillStyle = '#fffaf0'; g.fillRect(sx - 6 * S, sy - 1 * S, 11 * S, 2 * S)
  g.fillStyle = '#cfc6b6'; g.fillRect(sx - 6 * S, sy + 4 * S, 11 * S, 1 * S)
  g.fillStyle = '#3a2a24'; g.fillRect(sx - 4 * S, sy * 1, 3 * S, 3 * S) // spot
  g.fillStyle = base; g.fillRect(sx + 2 * S, sy - 4 * S, 5 * S, 5 * S) // head
  g.fillStyle = '#e8a0a8'; g.fillRect(sx + 6 * S, sy - 1 * S, 2 * S, 2 * S) // snout
  g.fillStyle = '#3a2a24'; g.fillRect(sx + 4 * S, sy - 3 * S, 1 * S, 1 * S) // eye
  g.fillStyle = '#fffaf0'; g.fillRect(sx + 1 * S, sy - 5 * S, 1 * S, 2 * S) // horn
}
function drawPig(g, sx, sy, S, base) {
  g.fillStyle = '#3a2a24'; g.fillRect(sx - 5 * S, sy + 5 * S, 1 * S, 3 * S); g.fillRect(sx + 2 * S, sy + 5 * S, 1 * S, 3 * S)
  g.fillStyle = base; g.fillRect(sx - 6 * S, sy - 1 * S, 11 * S, 6 * S)
  g.fillStyle = '#f6c0cb'; g.fillRect(sx - 6 * S, sy - 1 * S, 11 * S, 2 * S)
  g.fillStyle = '#c96d82'; g.fillRect(sx - 6 * S, sy + 4 * S, 11 * S, 1 * S)
  g.fillStyle = base; g.fillRect(sx + 2 * S, sy - 3 * S, 5 * S, 5 * S) // head
  g.fillStyle = '#d98699'; g.fillRect(sx + 2 * S, sy - 4 * S, 2 * S, 2 * S) // ear
  g.fillStyle = '#c96d82'; g.fillRect(sx + 6 * S, sy - 1 * S, 2 * S, 3 * S) // snout
  g.fillStyle = '#8f3f52'; g.fillRect(sx + 6 * S, sy, 1 * S, 1 * S); g.fillRect(sx + 7 * S, sy, 1 * S, 1 * S) // nostrils
  g.fillStyle = '#2a2230'; g.fillRect(sx + 4 * S, sy - 2 * S, 1 * S, 1 * S) // eye
}
function drawBarn(g, x, y, S) {
  // pitched-roof coop/barn
  g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x + 1 * S, y + 16 * S, 20 * S, 3 * S)
  g.fillStyle = '#c4763f'; g.fillRect(x + 2 * S, y + 8 * S, 18 * S, 9 * S) // wall
  g.fillStyle = '#d98a4e'; g.fillRect(x + 2 * S, y + 8 * S, 18 * S, 2 * S)
  for (let i = 4; i < 20; i += 4) { g.fillStyle = '#a8623233'; g.fillRect(x + i * S, y + 8 * S, 1 * S, 9 * S) }
  g.fillStyle = '#8a3f30'; g.fillRect(x + 0 * S, y + 4 * S, 22 * S, 5 * S) // roof
  g.fillStyle = '#a04c3a'; g.fillRect(x + 0 * S, y + 4 * S, 22 * S, 2 * S)
  g.fillStyle = '#6e4426'; g.fillRect(x + 8 * S, y + 11 * S, 6 * S, 6 * S) // door
  g.fillStyle = '#8a5a32'; g.fillRect(x + 8 * S, y + 11 * S, 6 * S, 1 * S)
}

// ---------------- Compose contact sheet ----------------
const cells = []
function cell(label, w, h, draw) { cells.push({ label, w, h, draw }) }

const GRASS = SP.grass[0]
function bg(g, x, y, w, h, S) {
  for (let ty = 0; ty < h; ty += 16) for (let tx = 0; tx < w; tx += 16) blit({ getContext: () => g, width: 0, height: 0, _d: null }, GRASS, x + tx, y + ty, S)
}

// individual sprites (scaled big)
const SCALE = 6
cell('TENT (house)', SP.farmhouse.width * SCALE, SP.farmhouse.height * SCALE, (sheet, x, y) => blit(sheet, SP.farmhouse, x, y, SCALE))
cell('STORE stall', SP.store.width * SCALE, SP.store.height * SCALE, (sheet, x, y) => blit(sheet, SP.store, x, y, SCALE))
cell('FENCE (h / v)', SP.fence.width * SCALE * 3 + 12, SP.fence.height * SCALE, (sheet, x, y) => {
  blit(sheet, SP.fence, x, y, SCALE)
  blit(sheet, SP.fence, x + SP.fence.width * SCALE + 4, y, SCALE)
  blit(sheet, SP.fence, x + SP.fence.width * SCALE * 2 + 12, y, SCALE, true)
})
// crops: show each crop's stages
for (const id of Object.keys(SP.crops)) {
  const frames = SP.crops[id]
  cell(`crop:${id}`, frames.length * (16 * SCALE + 4), 16 * SCALE, (sheet, x, y) => {
    frames.forEach((f, i) => blit(sheet, f, x + i * (16 * SCALE + 4), y, SCALE))
  })
}
// humanoids: 4 dirs idle
for (const [name, sheetSp] of [['farmer', SP.farmer], ['barnaby', SP.barnaby], ['faye', SP.faye]]) {
  cell(`${name} (d/u/l/r)`, 4 * (16 * SCALE + 4), 22 * SCALE, (sheet, x, y) => {
    ;['down', 'up', 'left', 'right'].forEach((d, i) => blit(sheet, sheetSp[`${d}_0`], x + i * (16 * SCALE + 4), y, SCALE))
  })
}
// cooking fire + animals + barn rendered live at scale
const FS = 5
cell('화로 cooking fire', 32 * FS, 32 * FS, (sheet, x, y) => drawCookingFire(sheet.getContext(), x, y, FS))
cell('chicken/cow/pig', 3 * 22 * FS, 16 * FS, (sheet, x, y) => {
  drawChicken(sheet.getContext(), x + 8 * FS, y + 8 * FS, FS, '#f0c85a')
  drawCow(sheet.getContext(), x + 30 * FS, y + 8 * FS, FS, '#e9e2d2')
  drawPig(sheet.getContext(), x + 52 * FS, y + 8 * FS, FS, '#e89aa8')
})
cell('animal barn', 24 * FS, 22 * FS, (sheet, x, y) => drawBarn(sheet.getContext(), x, y, FS))

// layout cells into a grid
const PAD = 18, LABEL = 14, COLS = 3
let col = 0, rowH = 0, cx = PAD, cy = PAD + LABEL
const placed = []
const rows = [[]]
for (const c of cells) {
  if (col === COLS) { col = 0; rows.push([]) }
  rows[rows.length - 1].push(c)
  col++
}
let totalH = PAD
let maxW = 0
for (const row of rows) {
  let rw = PAD
  let rh = 0
  for (const c of row) { rw += c.w + PAD; rh = Math.max(rh, c.h + LABEL) }
  maxW = Math.max(maxW, rw)
  totalH += rh + PAD + 6
}
const SHEET_W = Math.max(maxW, 600)
const sheet = createCanvas(SHEET_W, totalH)
const G = sheet.getContext()
G.fillStyle = '#2e3a2c'; G.fillRect(0, 0, SHEET_W, totalH) // cozy dark-green bg

let yy = PAD
for (const row of rows) {
  let xx = PAD
  let rh = 0
  for (const c of row) {
    // cell backdrop
    G.fillStyle = '#3a4a36'; G.fillRect(xx - 4, yy + LABEL - 4, c.w + 8, c.h + 8)
    c.draw(sheet, xx, yy + LABEL)
    rh = Math.max(rh, c.h + LABEL)
    xx += c.w + PAD
  }
  yy += rh + PAD + 6
}

const out = process.argv[2] || 'tdv-preview.png'
writeFileSync(out, encodePNG(sheet))
console.log('wrote', out, `${SHEET_W}x${totalH}`)
