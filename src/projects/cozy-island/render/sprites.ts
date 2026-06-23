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

// outlined egg-shaped tree (ref): black outline, dark green body, lighter
// highlights upper-left, brown trunk with a small fork.
const TREE_PAL: Record<string, string> = {
  K: '#1b1b1b', d: '#3f7d39', D: '#2e5e2b', l: '#62a347', t: '#9c6b3f', T: '#6e4626',
}
const TREE_SMALL = [
  '...KdK...',
  '..KdddK..',
  '.KldddDK.',
  'KldddddDK',
  'KdddtddDK',
  '.KdtttdK.',
  '..KtttK..',
  '..KtTtK..',
  '..KtTtK..',
  '..KKKKK..',
]
const TREE_BIG = [
  '.....KdK.....',
  '....KdddK....',
  '...KldddK....',
  '..KldddddK...',
  '..KldddddDK..',
  '.KldddddddDK.',
  '.KldddddddDK.',
  '.KddddddddDK.',
  '..KdddtddDK..',
  '..KddtttdDK..',
  '...KdtttdK...',
  '....KtttK....',
  '....KtTtK....',
  '....KtTtK....',
  '....KtTtK....',
  '...KKKKKK....',
]

// rock: o outline, w highlight, r light, R mid, d shadow · m/M moss
const ROCK_PAL: Record<string, string> = {
  o: '#454c57', w: '#e3e9ef', r: '#b3bcc6', R: '#7f8893', d: '#5a636d',
  m: '#6cbb55', M: '#4f9a3f',
}
const ROCK_SMALL = [
  '...orrro...',
  '.owwrrrwwo.',
  'owrrrrrrrwo',
  'orrrRRRrrro',
  'orRRmRRMRro',
  '.oRRRRRRRo.',
  '.odRRRRRdo.',
  '..oddddo...',
]
const ROCK_BIG = [
  '....orrrro.....',
  '..owwwrrrwwwo..',
  '.owwrrrrrrrwwo.',
  'owrrrrrrrrrrrwo',
  'orrRRRRRRRRRrro',
  'oRRmMRRRRRMmRRo',
  'oRRRRRRRRRRRRRo',
  '.odRRRRRRRRRdo.',
  '.oddRRRRRRRddo.',
  '..oddddddddoo..',
]

// bush: o outline, l light, g mid, G deep, d shadow · f/F berries
const BUSH_PAL: Record<string, string> = {
  o: '#274a1c', l: '#9be069', g: '#6cc04a', G: '#46933a', d: '#2f6e29',
  f: '#e85563', F: '#bb3a45',
}
const BUSH = [
  '...ooooooo...',
  '..ogllllllgo.',
  '.oglllllllgo.',
  'ogllllllllllgo',
  'ogGfgggggfGgo',
  'ogGGfgggfGGgo',
  '.ogGGGGGGGgo.',
  '..oGGdddGGo..',
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
// teepee tent (ref): crossed poles on top, tan body, red band, dark doorway.
const TENT_PAL: Record<string, string> = {
  K: '#1c1c1c', s: '#e8c47a', S: '#d2a857', r: '#d2603f', R: '#b0492f', d: '#3a2a1e', b: '#8f7d68',
}
const TENT = [
  '....b.....b..',
  '.....b...b...',
  '......b.b....',
  '......bbb....',
  '.....KrK.....',
  '.....KsK.....',
  '....KsKsK....',
  '....KrKrK....',
  '...KrrKrrK...',
  '...KrrKrrK...',
  '..KsssKsssK..',
  '..KsssKsssK..',
  '.KsssKdKsssK.',
  '.KsssdddsssK.',
  'KssssdddssssK',
]

// campfire (ref): orange/yellow flame, crossed logs, gray stone ring, light rim.
const COOKFIRE_PAL: Record<string, string> = {
  W: '#f2f2ec', o: '#e8731f', O: '#c2531a', y: '#f6b833', Y: '#f8e06a',
  t: '#8a5a32', r: '#a23a26', g: '#c4c8cc', G: '#969ca2', D: '#646a70',
}
const COOKFIRE = [
  '......o......',
  '......oo.....',
  '.....ooo.....',
  '.....oyo.....',
  '....ooyoo....',
  '....oyYyo....',
  '...ooyYyoo...',
  '...trtttrt...',
  '..WgGggGGgGW.',
  '.WgGGGGGGGGW.',
  '.WGGGDGGGDGW.',
  '..WWWWWWWWW..',
]

// market stall (ref): red/white striped awning, wooden posts, SHOP sign.
const SHOP_PAL: Record<string, string> = {
  K: '#1c1c1c', j: '#ef9a6a', r: '#d6533f', R: '#b23a2c', W: '#f4ede0', w: '#d6ccbb',
  t: '#a9712f', T: '#7a4e22', y: '#f2c33a',
}
const SHOP = [
  '....KjjjjjjjK....',
  '..KjjjjjjjjjjjK..',
  '.KrrWWrrWWrrWWrK.',
  '.KrrWWrrWWrrWWrK.',
  '.KRRwwRRwwRRwwRK.',
  '.KKKKKKKKKKKKKKK.',
  '...tt.......tt...',
  '...tt.......tt...',
  '..KKKKKKKKKKKKK..',
  '..KtttttttttttK..',
  '..KtttttttttttK..',
  '..KtyTyTyTyTytK..',
  '..KtttttttttttK..',
  '..KKKKKKKKKKKKK..',
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
  shadow(ctx, x, y, big ? 28 : 22)
  drawGrid(ctx, big ? TREE_BIG : TREE_SMALL, x, y, PXR, 'foot', TREE_PAL)
}

export function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, big: boolean) {
  shadow(ctx, x, y, big ? 30 : 24)
  drawGrid(ctx, big ? ROCK_BIG : ROCK_SMALL, x, y, PXR, 'foot', ROCK_PAL)
}

export function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, _berry: boolean) {
  void _berry
  shadow(ctx, x, y, 26)
  drawGrid(ctx, BUSH, x, y, PXR, 'foot', BUSH_PAL)
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
  shadow(ctx, x, y, 62)
  const pal = level >= 3 ? { ...TENT_PAL, s: '#f0d48c', S: '#dcb866' }
    : level >= 2 ? { ...TENT_PAL, s: '#eccd86' } : TENT_PAL
  drawGrid(ctx, TENT, x, y, 5, 'foot', pal)
}
export function drawShop(ctx: CanvasRenderingContext2D, x: number, y: number) {
  shadow(ctx, x, y, 58)
  drawGrid(ctx, SHOP, x, y, 4, 'foot', SHOP_PAL)
}
export function drawCookingFire(ctx: CanvasRenderingContext2D, x: number, y: number, _level: number) {
  void _level
  shadow(ctx, x, y, 50)
  drawGrid(ctx, COOKFIRE, x, y, 4, 'foot', COOKFIRE_PAL)
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

/** Clean grass tile: two close greens, a few sparse flowers. Reused across the land. */
export function makeGrassTexture(size: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = size; cv.height = size
  const c = cv.getContext('2d')!
  // flat base
  c.fillStyle = '#85cb62'
  c.fillRect(0, 0, size, size)
  // gentle 2-tone speckle (very subtle, blocky)
  const cell = 6
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      if (pxHash(x * 0.5, y * 0.5) > 0.78) { c.fillStyle = '#7cc257'; c.fillRect(x, y, cell, cell) }
    }
  }
  // a few simple flowers, well spaced
  const petals = ['#f4d24a', '#ffffff']
  for (let i = 0; i < (size * size) / 2600; i++) {
    const x = 6 + Math.floor(pxHash(i + 50, 7) * (size - 12))
    const y = 6 + Math.floor(pxHash(i + 50, 17) * (size - 12))
    c.fillStyle = petals[pxHash(i, 23) > 0.5 ? 0 : 1]
    c.fillRect(x - 2, y, 2, 2); c.fillRect(x + 2, y, 2, 2); c.fillRect(x, y - 2, 2, 2); c.fillRect(x, y + 2, 2, 2)
    c.fillStyle = '#e8a93a'; c.fillRect(x, y, 2, 2)
  }
  return cv
}

/** Pixel wooden fence around a pen with a centred gate gap on ALL four edges. */
export function drawFence(ctx: CanvasRenderingContext2D, rect: RectT, gateW: number) {
  const railLo = '#6f421f', rail = '#9c6a3c', railHi = '#bd8651', post = '#5e371d'
  const th = 5
  const x0 = Math.round(rect.x), y0 = Math.round(rect.y)
  const x1 = Math.round(rect.x + rect.w), y1 = Math.round(rect.y + rect.h)
  const cx = Math.round(rect.x + rect.w / 2), cy = Math.round(rect.y + rect.h / 2)
  const hg = Math.round(gateW / 2)
  const hRail = (ax: number, bx: number, y: number) => {
    if (bx <= ax) return
    ctx.fillStyle = rail; ctx.fillRect(ax, y, bx - ax, th)
    ctx.fillStyle = railHi; ctx.fillRect(ax, y, bx - ax, 1)
    ctx.fillStyle = railLo; ctx.fillRect(ax, y + th - 1, bx - ax, 1)
  }
  const vRail = (ay: number, by: number, x: number) => {
    if (by <= ay) return
    ctx.fillStyle = rail; ctx.fillRect(x, ay, th, by - ay)
    ctx.fillStyle = railHi; ctx.fillRect(x, ay, 1, by - ay)
    ctx.fillStyle = railLo; ctx.fillRect(x + th - 1, ay, 1, by - ay)
  }
  // each edge split into two segments around its centred gate gap
  hRail(x0, cx - hg, y0); hRail(cx + hg, x1, y0)
  hRail(x0, cx - hg, y1 - th); hRail(cx + hg, x1, y1 - th)
  vRail(y0, cy - hg, x0); vRail(cy + hg, y1, x0)
  vRail(y0, cy - hg, x1 - th); vRail(cy + hg, y1, x1 - th)
  // posts: four corners + the two posts flanking each gate
  const drawPost = (px: number, py: number) => {
    ctx.fillStyle = post; ctx.fillRect(px - 2, py - 3, 6, th + 6)
    ctx.fillStyle = railHi; ctx.fillRect(px - 2, py - 3, 6, 1)
  }
  drawPost(x0, y0); drawPost(x1 - th, y0); drawPost(x0, y1 - th); drawPost(x1 - th, y1 - th)
  drawPost(cx - hg - 3, y0); drawPost(cx + hg - 2, y0)
  drawPost(cx - hg - 3, y1 - th); drawPost(cx + hg - 2, y1 - th)
  drawPost(x0, cy - hg - 3); drawPost(x0, cy + hg - 2)
  drawPost(x1 - th, cy - hg - 3); drawPost(x1 - th, cy + hg - 2)
}
