// All world objects are square-pixel art (no arcs/curves), drawn from grids.
import { drawGrid, ICONS } from './art'

const PXR = 3 // pixel unit for resources/characters
const PXB = 3 // pixel unit for buildings

function shadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.fillStyle = 'rgba(40,30,20,0.10)'
  ctx.fillRect(Math.round(x - w / 2 - 3), Math.round(y - 2), w + 6, 4)
  ctx.fillStyle = 'rgba(40,30,20,0.16)'
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - 4), w, 5)
}

function r(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h))
}

// ---------------- grids ----------------
// ---- cute, detailed player (side view, ~13x17) ----
const PLAYER_PAL: Record<string, string> = {
  k: '#6b4a2e', j: '#8a6440', s: '#f6cda0', S: '#e3b083', c: '#ef9a9a',
  e: '#2f2418', w: '#ffffff', r: '#e0584f', R: '#b8423b', v: '#4f7bbf',
  V: '#3a5d96', b: '#ffd34d', h: '#fff0d6', u: '#7a4a2a', U: '#5e3720',
}
const HEAD_OPEN = [
  '..kkkkkkkkk..',
  '.kkkkkkkkkkk.',
  '.kkjjkkkjjkk.',
  '.kkssssssskk.',
  '.kswesssewsk.',
  '.kscsssscsk..',
  '..ssssossss..',
  '...sSSSSSs...',
]
const HEAD_BLINK = [
  '..kkkkkkkkk..',
  '.kkkkkkkkkkk.',
  '.kkjjkkkjjkk.',
  '.kkssssssskk.',
  '.ksseesseesk.',
  '.kscsssscsk..',
  '..ssssossss..',
  '...sSSSSSs...',
]
const TORSO = [
  '..rrrrrrrrr..',
  'hhvvvvvvvvvhh',
  '.hvvbvvvbvvh.',
  '.hvvvvvvvvvh.',
  '.svvvvvvvvvs.',
]
const STAND = ['...vv..vv....', '...vv..vv....', '...uu..uu....', '..uuu.uuu....']
const WALK_A = ['..vv...vv....', '..vv....vv...', '..uu....uu...', '.uuu....uuu..']
const WALK_C = ['....vv..vv...', '...vv...vv...', '...uu...uu...', '..uuu...uuu..']
function playerFrame(head: string[], legs: string[]): string[] {
  return [...head, ...TORSO, ...legs]
}

const CHICKEN = [
  '...cc....',
  '..WWWk...',
  '.WWWWWk..',
  '.WeWWWW..',
  'WWWWWWWW.',
  'WWWWWWWW.',
  'WWWWWWWW.',
  '.WW..WW..',
  '.k....k..',
]

const TREE_SMALL = [
  '...lllll...',
  '..lgggggl..',
  '.lgggggggl.',
  'lgggGGGgggl',
  'lggGGGGGggl',
  'lgggGGGgggl',
  '.lggGGGggl.',
  '..GGGGGGG..',
  '...GGGGG...',
  '....ttt....',
  '....tTt....',
  '....tTt....',
  '...ttttt...',
]

const TREE_BIG = [
  '....lllll....',
  '..llgggggll..',
  '.lggggggggGl.',
  'lggggGGGggggl',
  'lgggGGGGGgggl',
  'lggGGGGGGGggl',
  'lgggGGGGGgggl',
  '.lggGGGGGggl.',
  '..lgGGGGGgl..',
  '...GGGGGGG...',
  '....GGGGG....',
  '.....ttt.....',
  '....ttTtt....',
  '....ttTtt....',
  '...tttttt....',
]

const ROCK_SMALL = [
  '...rrrr...',
  '..rwwwwr..',
  '.rwwwwwwr.',
  'rwwwwwwwwr',
  'rRrwwwwRRr',
  'rRRRRRRRRr',
  '.RRRRRRR..',
  '..RRRRR...',
]

const ROCK_BIG = [
  '....rrrrr....',
  '..rrwwwwwrr..',
  '.rwwwwwwwwwr.',
  'rwwwwwwwwwwwr',
  'rwwRwwwwwRwwr',
  'rRRRRRRRRRRRr',
  'rRRRRRRRRRRRr',
  '.RRRRRRRRRR..',
  '..RRRRRRR....',
]

const BUSH = [
  '...gggggg...',
  '..gggggggg..',
  '.ggglGGgggg.',
  'gggggggggggg',
  'gGgggggggGgg',
  '.GGGGGGGGGG.',
  '..GG..GG.G..',
]

const SHELL = [
  '...jjj...',
  '..jJjJj..',
  '.jJjJjJj.',
  'jJjJjJjJj',
  'jJjJjJjJj',
  '.jjjjjjj.',
  '..jjjjj..',
]

// buildings
const TENT = [
  '......t......',
  '......tyy....',
  '......t......',
  '.....ddd.....',
  '....ddddd....',
  '...ddddddd...',
  '..ddddddddd..',
  '.dddoooooddd.',
  'dddoooooooddd',
  'dddoooooooddd',
  'dddoooooooddd',
  'DDDDDDDDDDDDD',
]

const COOKFIRE = [
  '.....i.......',
  '....iIi......',
  '...iIIIi.....',
  '..iIIIIIi....',
  '..iIWIIIi....',
  '...iiiii.....',
  '.rrTTTTTrr...',
  'rrTtTtTtTrr..',
  '.rr.....rr...',
]

const COOP = [
  '.......SSS.......',
  '.....SSSSSSS.....',
  '...SSSSSSSSSSS...',
  '..SSSSSSSSSSSSS..',
  'XXXXXXXXXXXXXXXXX',
  'XxxxxKKKxxxWWxxxX',
  'XxxxxKKKxxxWWxxxX',
  'XxxxxKKKxxxxxxxxX',
  'XxxxxKKKxxxxxxxxX',
  'XXXXXXXXXXXXXXXXX',
]

const STORAGE = [
  '.XXXXXXXXXXX.',
  'XxxxxxxxxxxxX',
  'XxXxxxXxxxXxX',
  'XxxxxxxxxxxxX',
  'XXXXXXXXXXXXX',
  'XxxxxxxxxxxxX',
  'XxXxxxXxxxXxX',
  'XxxxxxxxxxxxX',
  '.XXXXXXXXXXX.',
]

const FARMSIGN = [
  '.UUUUUUUUU.',
  'UuaaaaaaauU',
  'UuaAaAaAauU',
  'UuaaaaaaauU',
  '.UUUUUUUUU.',
  '.....t.....',
  '.....t.....',
  '....TTT....',
]

const MINE = [
  '......RRRRR......',
  '....RRRRRRRRR....',
  '...RRRRRRRRRRR...',
  '..RRRRRRRRRRRRR..',
  '.RRRRRRRRRRRRRRR.',
  'RRRRRTTTTTRRRRRRR',
  'RRRRTKKKKKTRRRRRR',
  'RRRTKKKKKKKTRRRRR',
  'RRRTKKKKKKKTRRRRR',
  'RRRTKKKKKKKTRRRRR',
  'RRRRRRRRRRRRRRRRR',
]

const ORE = [
  '...mMm...',
  '..rwwwr..',
  '.rwmMwwr.',
  'rwwwwmMwr',
  'rRRwwwRRr',
  '.RRRRRRR.',
  '..RRRRR..',
]

const COW = [
  '.........WWW.',
  '..WWWWWWWWWWk',
  '.WWKKWWWWWWWe',
  'WWWKKWWWWKWWW',
  'WWWWWWWWKKWWW',
  '.WWWWWWWWWWW.',
  '.W.W...W.W...',
  '.u.u...u.u...',
]
const COW_PAL: Record<string, string> = {
  W: '#fbf7ee', K: '#5a4636', e: '#2f2418', k: '#f2b0a0', u: '#6e4a32',
}
const BEE = [
  '.W...W.',
  '.WbbbW.',
  'bKbKbKb',
  'bbbbbbb',
  '.bKbKb.',
  '..bbb..',
]
const BEE_PAL: Record<string, string> = { W: '#eaf4ff', b: '#ffce3a', K: '#3a2f1a' }
const BARN = [
  '......rrr......',
  '....rrrrrrr....',
  '..rrrrrrrrrrr..',
  '.rrrrrrrrrrrrr.',
  'rrrrrrrrrrrrrrr',
  'XXXXXXXXXXXXXXX',
  'XWWXXXKKKXXXWWX',
  'XWWXXXKKKXXXWWX',
  'XXXXXXKKKXXXXXX',
  'XXXXXXKKKXXXXXX',
  'XXXXXXXXXXXXXXX',
]
const BARN_PAL: Record<string, string> = {
  r: '#d2503f', X: '#b9854c', W: '#fff3da', K: '#6e4626',
}
const APIARY = [
  '.kkkkkkkkk.',
  '.kkkkekkkk.',
  '.kkkkkkkkk.',
  '.KKKKKKKKK.',
  '.kkkkkkkkk.',
  '.kkkkekkkk.',
  '.KKKKKKKKK.',
  '...ttttt...',
  '...t...t...',
]
const APIARY_PAL: Record<string, string> = { k: '#e8b84a', K: '#c2913a', e: '#3a2f1a', t: '#8a5a32' }

// ---------------- draw functions ----------------
const WALK_CYCLE = [WALK_A, STAND, WALK_C, STAND]

export function drawPlayer(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  facing: number, walk: number, action: number, tired: boolean, moving: boolean,
) {
  shadow(ctx, x, y, 22)
  const now = performance.now()
  const a = Math.max(0, Math.min(1, action))
  const blinking = now / 1000 % 3.6 < 0.12
  const head = (tired || blinking) ? HEAD_BLINK : HEAD_OPEN
  let legs = STAND
  if (moving && a <= 0) legs = WALK_CYCLE[Math.floor(walk * 4) & 3]
  // little hop while walking, gentle breathing while idle, slump when tired
  let bob = moving
    ? Math.round(Math.abs(Math.sin(walk * Math.PI * 2)) * 2)
    : Math.round(Math.sin(now / 600) * 1)
  if (tired) bob -= 1

  ctx.save()
  if (facing < 0) { ctx.translate(Math.round(x) * 2, 0); ctx.scale(-1, 1) }
  drawGrid(ctx, playerFrame(head, legs), x, y - bob, PXR, 'foot', PLAYER_PAL)
  ctx.restore()

  if (a > 0) drawTool(ctx, x, y - bob, facing, a)
  if (tired) { r(ctx, x + 9, y - 42, 2, 4, '#9fd8ff'); r(ctx, x + 8, y - 38, 4, 3, '#7fc8f0') }
}

// Pixel tool: wind-up (raised) then strike (down), blocky — no rotation.
function drawTool(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number, a: number) {
  const d = facing
  if (a < 0.5) {
    r(ctx, x + d * 4, y - 50, 3, 20, '#8a5a32')
    r(ctx, x + d * 1, y - 52, 9, 6, '#b8bcc4')
    r(ctx, x + d * 1, y - 52, 9, 2, '#dce1e6')
    r(ctx, x + d * 5 - 1, y - 32, 3, 9, '#f6cda0')
  } else {
    r(ctx, x + d * 6, y - 32, 3, 15, '#8a5a32')
    r(ctx, x + d * 7, y - 20, 9, 6, '#b8bcc4')
    r(ctx, x + d * 7, y - 20, 9, 2, '#dce1e6')
    r(ctx, x + d * 4, y - 28, 7, 3, '#f6cda0')
  }
}

export function drawChicken(ctx: CanvasRenderingContext2D, x: number, y: number, hasEgg: boolean) {
  shadow(ctx, x, y, 18)
  drawGrid(ctx, CHICKEN, x, y, PXR, 'foot')
  if (hasEgg) drawGrid(ctx, ICONS.egg, x + 12, y - 6, 2, 'center')
}

export function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, big: boolean) {
  shadow(ctx, x, y, big ? 26 : 20)
  drawGrid(ctx, big ? TREE_BIG : TREE_SMALL, x, y, PXR, 'foot')
}

export function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, big: boolean) {
  shadow(ctx, x, y, big ? 30 : 24)
  drawGrid(ctx, big ? ROCK_BIG : ROCK_SMALL, x, y, PXR, 'foot')
}

export function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, berry: boolean) {
  shadow(ctx, x, y, 26)
  drawGrid(ctx, BUSH, x, y, PXR, 'foot')
  if (berry) { r(ctx, x - 8, y - 18, 4, 4, '#e2515b'); r(ctx, x + 6, y - 12, 4, 4, '#e2515b') }
}

export function drawShell(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 16)
  drawGrid(ctx, SHELL, x, y, PXR, 'foot')
}

export function drawCrop(ctx: CanvasRenderingContext2D, x: number, y: number, growth: number, ready: boolean, color: string) {
  // tilled soil (blocky furrows)
  r(ctx, x - 18, y - 9, 36, 15, '#7a5536')
  r(ctx, x - 18, y - 9, 36, 3, '#8a6442')
  for (let i = -1; i <= 1; i++) r(ctx, x + i * 12 - 1, y - 7, 3, 11, '#6a4830')
  const stage = ready ? 4 : Math.min(3, Math.floor(growth * 4))
  const h = 4 + stage * 6
  for (const ox of [-9, 0, 9]) {
    if (stage === 0) { r(ctx, x + ox - 1, y - 8, 3, 4, '#6bbf4a'); continue }
    r(ctx, x + ox - 2, y - 6 - h, 4, h, '#4f9a3a')
    if (ready) {
      r(ctx, x + ox - 4, y - 9 - h, 9, 7, color)
      r(ctx, x + ox - 4, y - 9 - h, 9, 2, '#ffffff44')
    } else if (stage >= 3) {
      r(ctx, x + ox - 2, y - 8 - h, 5, 5, color)
    }
  }
  if (ready) {
    r(ctx, x - 19, y - 11 - h, 38, 2, '#fff0a0')
    r(ctx, x - 19, y + 5, 38, 2, '#fff0a0')
  }
}

export function drawOreNode(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 22)
  drawGrid(ctx, ORE, x, y, PXR, 'foot')
}

// buildings
export function drawTent(ctx: CanvasRenderingContext2D, x: number, y: number, level: number) {
  shadow(ctx, x, y, 50)
  const pal = level >= 3 ? { d: '#e6a35a', D: '#c8823c' } : level >= 2 ? { d: '#e4b06a', D: '#c2864a' } : undefined
  drawGrid(ctx, TENT, x, y, PXB, 'foot', pal)
}
export function drawShop(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 48)
  drawGrid(ctx, ICONS.shop, x, y, 5, 'foot')
}
export function drawCookingFire(ctx: CanvasRenderingContext2D, x: number, y: number, _level: number) {
  void _level
  shadow(ctx, x, y, 40)
  drawGrid(ctx, COOKFIRE, x, y, PXB, 'foot')
}
export function drawCoop(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 58)
  drawGrid(ctx, COOP, x, y, PXB, 'foot')
}
export function drawStorage(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 44)
  drawGrid(ctx, STORAGE, x, y, PXB, 'foot')
}
export function drawBarn(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 56)
  drawGrid(ctx, BARN, x, y, PXB, 'foot', BARN_PAL)
}
export function drawApiary(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 40)
  drawGrid(ctx, APIARY, x, y, PXB, 'foot', APIARY_PAL)
}
export function drawCow(ctx: CanvasRenderingContext2D, x: number, y: number, hasMilk: boolean) {
  shadow(ctx, x, y, 30)
  drawGrid(ctx, COW, x, y, PXR, 'foot', COW_PAL)
  if (hasMilk) drawGrid(ctx, ICONS.milk, x + 16, y - 22, 2, 'center')
}
export function drawBee(ctx: CanvasRenderingContext2D, x: number, y: number, hasHoney: boolean) {
  const fly = Math.round(Math.sin(performance.now() / 180) * 2)
  shadow(ctx, x, y, 12)
  drawGrid(ctx, BEE, x, y - 14 - fly, PXR, 'foot', BEE_PAL)
  if (hasHoney) drawGrid(ctx, ICONS.honey, x + 12, y - 18, 2, 'center')
}
export function drawFarmSign(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 28)
  drawGrid(ctx, FARMSIGN, x, y, PXR, 'foot')
}
export function drawMine(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 60)
  drawGrid(ctx, MINE, x, y, PXB, 'foot')
}
export function drawBuildSite(ctx: CanvasRenderingContext2D, x: number, y: number, iconName: string) {
  shadow(ctx, x, y, 30)
  // dirt pad (blocky)
  r(ctx, x - 22, y - 8, 44, 8, '#9c7a4a')
  r(ctx, x - 22, y - 8, 44, 2, '#b08a55')
  for (let i = -2; i <= 2; i++) r(ctx, x + i * 9 - 1, y - 6, 2, 5, '#8a6840')
  const grid = ICONS[iconName] || ICONS.hammer
  drawGrid(ctx, grid, x, y - 12, 3, 'center')
  drawGrid(ctx, ICONS.hammer, x + 14, y - 6, 2, 'center')
}

// ---------------- ground / fences (square-pixel) ----------------
type RectT = { x: number; y: number; w: number; h: number }

function pxHash(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 4.1414) * 43758.5453
  return n - Math.floor(n)
}

/** One reusable pixel-grass texture for every (identical) pen. */
export function makeGrassTexture(w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = w; cv.height = h
  const c = cv.getContext('2d')!
  const cell = 4
  const tones = ['#7cc25b', '#8fd06a', '#72b552', '#86c863']
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      const r = pxHash(x, y)
      c.fillStyle = tones[Math.floor(r * tones.length)]
      c.fillRect(x, y, cell, cell)
    }
  }
  for (let i = 0; i < (w * h) / 360; i++) {
    const x = Math.floor(pxHash(i, 7) * w)
    const y = Math.floor(pxHash(i, 13) * h)
    c.fillStyle = pxHash(i, 21) > 0.5 ? '#5fa347' : '#6bb04e'
    c.fillRect(x, y, 2, pxHash(i, 4) > 0.5 ? 3 : 2)
  }
  return cv
}

/** Cobblestone path tile (square-pixel). */
export function makeStoneTexture(tile: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = tile; cv.height = tile
  const c = cv.getContext('2d')!
  c.fillStyle = '#9a9183'; c.fillRect(0, 0, tile, tile)
  const cell = 4
  for (let y = 0; y < tile; y += cell) {
    for (let x = 0; x < tile; x += cell) {
      const r = pxHash(x + 1, y + 2)
      c.fillStyle = r > 0.82 ? '#857c6f' : r > 0.5 ? '#a79e8f' : '#b4ab9c'
      c.fillRect(x, y, cell, cell)
    }
  }
  c.fillStyle = '#7d7468'
  for (let y = 0; y < tile; y += 16) c.fillRect(0, y, tile, 1)
  for (let x = 0; x < tile; x += 16) c.fillRect(x, 0, 1, tile)
  return cv
}

/** Pixel wooden fence around a pen rect, leaving the gate gap on the bottom edge. */
export function drawFence(ctx: CanvasRenderingContext2D, rect: RectT, gate: RectT) {
  const post = '#7a4a26'
  const rail = '#9c6a3c'
  const railHi = '#b07f4c'
  const x0 = Math.round(rect.x), y0 = Math.round(rect.y)
  const x1 = Math.round(rect.x + rect.w), y1 = Math.round(rect.y + rect.h)
  const th = 4
  ctx.fillStyle = rail
  ctx.fillRect(x0, y0, rect.w, th)
  ctx.fillRect(x0, y0, th, rect.h)
  ctx.fillRect(x1 - th, y0, th, rect.h)
  const gx0 = Math.round(gate.x), gx1 = Math.round(gate.x + gate.w)
  ctx.fillRect(x0, y1 - th, gx0 - x0, th)
  ctx.fillRect(gx1, y1 - th, x1 - gx1, th)
  ctx.fillStyle = railHi
  ctx.fillRect(x0, y0, rect.w, 1)
  ctx.fillStyle = post
  const step = 26
  for (let x = x0; x <= x1; x += step) {
    ctx.fillRect(x - 2, y0 - 2, 5, th + 4)
    const inGate = x > gx0 - 3 && x < gx1 + 3
    if (!inGate) ctx.fillRect(x - 2, y1 - th - 2, 5, th + 4)
  }
  for (let y = y0; y <= y1; y += step) {
    ctx.fillRect(x0 - 2, y - 2, th + 4, 5)
    ctx.fillRect(x1 - th - 2, y - 2, th + 4, 5)
  }
  ctx.fillRect(gx0 - 3, y1 - th - 3, 5, th + 7)
  ctx.fillRect(gx1 - 2, y1 - th - 3, 5, th + 7)
}
