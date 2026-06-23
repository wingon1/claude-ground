import type { CookJob, GameState, InventorySlot, Tile } from '../types'
import { CROPS, CROP_LIST } from '../data/crops'
import { cropItemId, getItem } from '../data/items'
import { SHOP_CATALOG } from '../data/shopCatalog'
import { BUILD_OPTIONS } from '../data/buildOptions'
import { ANIMAL_FARMS, ANIMAL_FARM_MAX_ANIMALS, type AnimalFarmDef } from '../data/animalFarms'
import {
  DEFAULT_FIELD_CROP,
  FIELD_PLOTS,
  FIELD_ROW_COST_GOLD,
  FIELD_ROW_COST_WOOD,
  FIELD_SIZE,
} from '../data/fields'
import {
  COOKING_FIRE_BASE_SLOTS,
  COOKING_FIRE_MAX_LEVEL,
  COOKING_FIRE_SLOTS_PER_LEVEL,
  COOKING_FIRE_UPGRADES,
} from '../data/cookingFire'
import { cropUnlockFlag } from '../data/unlocks'
import { RECIPES } from '../data/recipes'
import { OBSTACLE_DROP, OBSTACLE_HP, OBSTACLE_SOLID, TERRAIN_SOLID } from '../data/tiles'
import {
  generateWorld,
  idx,
  inBounds,
  LOCATIONS,
  setObstacle,
  WORLD_H,
  WORLD_W,
} from './world'
import { bakeItemIcon, buildSprites, T, type Sprites } from './sprites'
import { AudioEngine } from './audio'
import { deleteSave, loadGame, saveGame, SAVE_VERSION } from './save'

const INV_SIZE = 24
const WALK_SPEED = 74 // art px / sec
const GAME_MIN_PER_SEC = 1200 / 240 // cosmetic day/night only
const WORK_INTERVAL = 0.42 // seconds between auto-work hits
const WORK_RANGE = T * 1.5 // how close to a node before auto-working
const RESPAWN_SECS = 80 // trees/rocks/stumps regrow after this
const STAGE_SECS_PER_DAY = 22 // real seconds per crop "grow day"
const COOK_BATCH_MAX = 20

// Stamina costs per auto-work hit.
const COST = { chop: 1, harvest: 1, plant: 1 }
const START_MAX_STAMINA = 40

// ---------- UI snapshot ----------
export type UIPhase = 'title' | 'playing' | 'shop' | 'build' | 'cook' | 'seed' | 'sleepConfirm'

export interface ToastMsg {
  id: number
  text: string
  kind: 'info' | 'good' | 'bad'
}
export interface InvSlotView {
  index: number
  itemId: string | null
  qty: number
  name: string
  sprite: string
  color?: string
  sellPrice: number
  type: string
  desc: string
}
export interface ShopBuyView {
  itemId: string
  name: string
  price: number
  affordable: boolean
  sprite: string
  color?: string
  desc: string
}
export interface CostItemView {
  itemId: string
  name: string
  have: number
  need: number
  ok: boolean
}
export interface BuildOptionView {
  id: string
  name: string
  desc: string
  costGold: number
  costItems: CostItemView[]
  canBuild: boolean
  built: boolean
  locked: boolean
}
export interface CropChoiceView {
  id: string
  name: string
  color: string
  selected: boolean
  unlocked: boolean
  lockText: string | null
}
export interface FieldPlotView {
  id: string
  name: string
  rows: number
  selectedCropId: string
  selectedCropName: string
  selected: boolean
  nextToUnlock: boolean
  canBuyRow: boolean
  costGold: number
  costItems: CostItemView[]
}
export interface CookRecipeView {
  id: string
  name: string
  desc: string
  outputName: string
  outputSprite: string
  outputColor?: string
  outputQty: number
  inputs: CostItemView[]
  canCook: boolean
  maxCookQty: number
  unlocked: boolean
  lockText: string | null
  craftSeconds: number
  difficulty: number
  sellPrice: number
}
export interface CookJobView {
  id: string
  recipeName: string
  outputName: string
  outputSprite: string
  outputColor?: string
  remainingSecs: number
  remainingQty: number
  totalQty: number
  totalRemainingSecs: number
  totalSecs: number
  progress: number
  ready: boolean
}
export interface CookingFireView {
  level: number
  maxLevel: number
  slots: number
  usedSlots: number
  nextSlots: number | null
  costGold: number
  costItems: CostItemView[]
  canUpgrade: boolean
}
export interface UISnapshot {
  phase: UIPhase
  day: number
  clock: string
  period: string
  periodKey: 'morning' | 'afternoon' | 'golden' | 'night'
  gold: number
  stamina: number
  maxStamina: number
  inventory: InvSlotView[]
  toasts: ToastMsg[]
  shopBuy: ShopBuyView[]
  buildOptions: BuildOptionView[]
  fieldPlots: FieldPlotView[]
  cropChoices: CropChoiceView[]
  selectedFieldId: string | null
  cookRecipes: CookRecipeView[]
  cookQueue: CookJobView[]
  cookingFire: CookingFireView
  contextAction: string | null
  contextActionId: 'sleep' | 'animal' | 'seed' | null
  nearBed: boolean
  nearStore: boolean
  nearBuild: boolean
  nearCooking: boolean
  exhausted: boolean
  muted: boolean
  musicOn: boolean
  hasSave: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
  gravity: number
  additive: boolean
}
interface Firefly {
  x: number
  y: number
  phase: number
  speed: number
}
type Period = 'morning' | 'afternoon' | 'golden' | 'night'
type WorkKind = 'pickup' | 'harvest' | 'chop' | 'plant'

export class Game {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  state!: GameState
  private sprites: Sprites
  audio = new AudioEngine()

  private raf = 0
  private last = 0
  private running = false
  private scale = 3
  private cam = { x: 0, y: 0 }
  private waterAnim = 0
  private particles: Particle[] = []
  private fireflies: Firefly[] = []
  private toasts: ToastMsg[] = []
  private toastId = 1
  private phase: UIPhase = 'title'
  private fade = 0
  private fadeDir = 0
  private pendingWake = false
  private workCooldown = 0
  private exhaustedNotified = false
  private target: { x: number; y: number } | null = null
  private stuckT = 0
  private keys = new Set<string>()
  private workTile: { x: number; y: number } | null = null
  private itemIconCache = new Map<string, HTMLCanvasElement>()

  private listeners = new Set<() => void>()
  private snap: UISnapshot
  private lastEmit = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false
    this.sprites = buildSprites(
      CROP_LIST.map((c) => ({ id: c.id, color: c.color, stages: c.stages })),
    )
    this.snap = this.buildSnapshot()
  }

  // ---------------- lifecycle ----------------
  start() {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    this.resize()
    this.loop(this.last)
  }
  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  hasSavedGame(): boolean {
    return loadGame() != null
  }

  newGame() {
    this.state = this.freshState()
    this.applyInitialUnlocks()
    this.initRuntime()
    this.phase = 'playing'
    this.audio.resume()
    this.audio.startMusic()
    this.toast('포근한 골짜기에 도착했어요. 화면을 탭해 걸어보세요!', 'good')
    this.emit()
  }

  continueGame(): boolean {
    const s = loadGame()
    if (!s) return false
    if (s.tiles.length !== WORLD_W * WORLD_H) s.tiles = generateWorld()
    this.state = s
    this.applyInitialUnlocks()
    this.applyGroundCleanup()
    this.applyFieldRows()
    this.applyAnimalFarms()
    this.applyFieldExpansions()
    this.initRuntime()
    this.phase = 'playing'
    this.audio.resume()
    this.audio.startMusic()
    this.emit()
    return true
  }

  deleteSaveData() {
    deleteSave()
    this.emit()
  }

  private freshState(): GameState {
    const tiles = generateWorld()
    const inv: InventorySlot[] = []
    for (let i = 0; i < INV_SIZE; i++) inv.push({ itemId: '', qty: 0 })
    return {
      saveVersion: SAVE_VERSION,
      day: 1,
      timeMinutes: 360,
      gold: 120,
      stamina: START_MAX_STAMINA,
      maxStamina: START_MAX_STAMINA,
      player: {
        x: LOCATIONS.spawn.x * T + T / 2,
        y: LOCATIONS.spawn.y * T + T,
        dir: 'down',
        moving: false,
        animTime: 0,
        exhausted: false,
      },
      tiles,
      inventory: inv,
      cookQueue: [],
      flags: {
        'fieldRows:field_1': FIELD_SIZE,
        'fieldCrop:field_1': DEFAULT_FIELD_CROP,
        [cropUnlockFlag(DEFAULT_FIELD_CROP)]: true,
      },
    }
  }

  private initRuntime() {
    if (!Array.isArray(this.state.cookQueue)) this.state.cookQueue = []
    this.particles = []
    this.fireflies = []
    for (let i = 0; i < 36; i++) {
      this.fireflies.push({
        x: Math.random() * WORLD_W * T,
        y: Math.random() * WORLD_H * T,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.6,
      })
    }
    this.fade = 0
    this.fadeDir = 0
    this.target = null
    this.workTile = null
  }

  // ---------------- main loop ----------------
  private loop = (now: number) => {
    if (!this.running) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
    if (this.phase === 'playing' || this.phase === 'cook') this.updateCooking(dt)
    if (this.phase === 'playing') this.update(dt)
    this.updateTransitions(dt)
    this.updateParticles(dt)
    this.render()
    if (now - this.lastEmit > 90) {
      this.lastEmit = now
      this.emit()
    }
    this.raf = requestAnimationFrame(this.loop)
  }

  private updateTransitions(dt: number) {
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * dt * 1.4
      if (this.fade >= 1 && this.fadeDir > 0) {
        this.fade = 1
        this.fadeDir = 0
        if (this.pendingWake) {
          this.pendingWake = false
          this.audio.sfx('rooster')
          this.fadeDir = -1
        }
      } else if (this.fade <= 0 && this.fadeDir < 0) {
        this.fade = 0
        this.fadeDir = 0
      }
    }
    if (this.workCooldown > 0) this.workCooldown -= dt
  }

  // ---------------- update ----------------
  private update(dt: number) {
    const s = this.state
    s.timeMinutes += dt * GAME_MIN_PER_SEC // cosmetic clock
    this.movePlayer(dt)
    this.growCrops(dt)
    this.updateAnimalDrops(dt)
    this.respawnNodes()
    this.updateFireflies(dt)
    if (!s.player.moving) this.tryAutoWork()
  }

  private movePlayer(dt: number) {
    const s = this.state
    const p = s.player
    // keyboard overrides tap target (desktop convenience)
    let kx = 0
    let ky = 0
    if (this.keys.has('w') || this.keys.has('arrowup')) ky -= 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) ky += 1
    if (this.keys.has('a') || this.keys.has('arrowleft')) kx -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) kx += 1
    if (kx !== 0 || ky !== 0) {
      this.target = null
      this.stepMove(p, kx, ky, dt)
      return
    }
    if (this.target) {
      const dx = this.target.x - p.x
      const dy = this.target.y - p.y
      const d = Math.hypot(dx, dy)
      if (d < 2) {
        this.target = null
        p.moving = false
        p.animTime = 0
        this.stuckT = 0
        return
      }
      const bx = p.x
      const by = p.y
      this.stepMove(p, dx / d, dy / d, dt)
      // Walking into something solid (e.g. the tap landed on a tree): once we
      // stop making progress, give up the target so auto-work can kick in.
      if (Math.hypot(p.x - bx, p.y - by) < 0.5) {
        this.stuckT += dt
        if (this.stuckT > 0.25) { this.target = null; this.stuckT = 0; p.moving = false }
      } else this.stuckT = 0
    } else {
      p.moving = false
      p.animTime = 0
    }
  }

  private stepMove(p: GameState['player'], vx: number, vy: number, dt: number) {
    const len = Math.hypot(vx, vy)
    if (len < 0.001) return
    vx /= len
    vy /= len
    p.moving = true
    if (Math.abs(vx) > Math.abs(vy)) p.dir = vx > 0 ? 'right' : 'left'
    else p.dir = vy > 0 ? 'down' : 'up'
    const speed = (p.exhausted ? WALK_SPEED * 0.5 : WALK_SPEED) * dt
    const nx = p.x + vx * speed
    const ny = p.y + vy * speed
    let moved = false
    if (!this.collides(nx, p.y)) { p.x = nx; moved = true }
    if (!this.collides(p.x, ny)) { p.y = ny; moved = true }
    if (!moved) this.target = null // stuck against a wall — stop
    p.animTime += dt
  }

  private collides(cx: number, cy: number): boolean {
    const x0 = Math.floor((cx - 5) / T)
    const x1 = Math.floor((cx + 5) / T)
    const y0 = Math.floor((cy - 6) / T)
    const y1 = Math.floor((cy - 0.5) / T)
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!inBounds(tx, ty)) return true
        if (this.tileSolid(this.state.tiles[idx(tx, ty)])) return true
      }
    }
    return false
  }

  private tileSolid(t: Tile): boolean {
    if (TERRAIN_SOLID[t.terrain]) return true
    if (t.obstacle && OBSTACLE_SOLID[t.obstacle]) return true
    return false
  }

  // ---------------- tap to move ----------------
  tap(screenX: number, screenY: number) {
    if (this.phase !== 'playing') return
    this.audio.resume()
    const dpr = this.canvas.width / Math.max(1, this.canvas.clientWidth)
    const wx = this.cam.x + (screenX * dpr) / this.scale
    const wy = this.cam.y + (screenY * dpr) / this.scale
    this.target = { x: wx, y: wy }
  }
  cancelMove() {
    this.target = null
  }

  onKeyDown(e: KeyboardEvent) {
    this.keys.add(e.key.toLowerCase())
  }
  onKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.key.toLowerCase())
  }

  // ---------------- auto work ----------------
  private playerTile() {
    return {
      x: Math.max(0, Math.min(WORLD_W - 1, Math.floor(this.state.player.x / T))),
      y: Math.max(0, Math.min(WORLD_H - 1, Math.floor((this.state.player.y - 8) / T))),
    }
  }

  // Find the best workable tile adjacent to the player (incl. own tile).
  private findWork(): { t: Tile; kind: WorkKind } | null {
    const p = this.state.player
    const pt = this.playerTile()
    let best: { t: Tile; kind: WorkKind; d: number; pri: number } | null = null
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = pt.x + dx
        const ty = pt.y + dy
        if (!inBounds(tx, ty)) continue
        const t = this.state.tiles[idx(tx, ty)]
        let kind: WorkKind | null = null
        let pri = 0
        if (this.groundItemId(t)) { kind = 'pickup'; pri = 4 }
        else if (t.cropId && t.growthStage >= CROPS[t.cropId].stages - 1) { kind = 'harvest'; pri = 3 }
        else if (t.obstacle) { kind = 'chop'; pri = 2 }
        else if (t.terrain === 'soil' && !t.cropId && this.cropForTile(t)) { kind = 'plant'; pri = 1 }
        if (!kind) continue
        const cx = tx * T + T / 2
        const cy = ty * T + T / 2
        const d = Math.hypot(cx - p.x, cy - p.y)
        if (d > WORK_RANGE + T) continue
        if (!best || pri > best.pri || (pri === best.pri && d < best.d)) {
          best = { t, kind, d, pri }
        }
      }
    }
    return best ? { t: best.t, kind: best.kind } : null
  }

  private tryAutoWork() {
    this.workTile = null
    if (this.fadeDir !== 0) return
    const work = this.findWork()
    if (!work) return
    this.workTile = { x: work.t.x, y: work.t.y }
    // face the node
    const p = this.state.player
    const cx = work.t.x * T + T / 2
    const cy = work.t.y * T + T / 2
    if (Math.abs(cx - p.x) > Math.abs(cy - p.y)) p.dir = cx > p.x ? 'right' : 'left'
    else if (Math.abs(cy - p.y) > 2) p.dir = cy > p.y ? 'down' : 'up'
    if (this.workCooldown > 0) return
    this.workCooldown = WORK_INTERVAL
    if (work.kind === 'pickup') this.pickupGroundItem(work.t)
    else if (work.kind === 'harvest') this.harvestCrop(work.t)
    else if (work.kind === 'chop') this.chopObstacle(work.t)
    else if (work.kind === 'plant') this.plantTile(work.t)
  }

  private chopObstacle(t: Tile) {
    if (!t.obstacle) return
    const ob = t.obstacle
    const px = t.x * T + T / 2
    const py = t.y * T + T / 2
    if (ob === 'weed') {
      if (!this.spendStamina(COST.chop)) return
      this.clearObs(t)
      this.giveItem('fiber', 1)
      this.audio.sfx('harvest')
      this.leafBurst(px, py, '#56a84a')
      this.emit()
      return
    }
    if (ob === 'flower') {
      if (!this.spendStamina(COST.harvest)) return
      this.clearObs(t)
      this.giveItem('daffodil', 1)
      this.audio.sfx('harvest')
      this.leafBurst(px, py, '#ffe14d')
      this.emit()
      return
    }
    if (!this.spendStamina(COST.chop)) return
    t.hp = (t.hp ?? OBSTACLE_HP[ob]) - 1
    this.audio.sfx(ob === 'rock' ? 'crack' : 'chop')
    if (ob === 'rock') this.dirtPuff(px, py, '#9a9a9a')
    else this.woodChips(px, py)
    if (t.hp <= 0) {
      const drop = OBSTACLE_DROP[ob]
      if (drop) this.giveItem(drop.itemId, drop.qty)
      this.audio.sfx('crack')
      const renewable = !!t.metadata.renewable
      this.clearObs(t)
      if (renewable) {
        t.metadata.renewable = true
        t.metadata.respawnAt = this.nowSecs() + RESPAWN_SECS
        t.metadata.respawnKind = 'large_stump'
      } else if (ob === 'tree' || ob === 'rock' || ob === 'stump') {
        t.metadata.respawnAt = this.nowSecs() + RESPAWN_SECS
        t.metadata.respawnKind = ob
      }
    }
    this.emit()
  }

  private respawnNodes() {
    const now = this.nowSecs()
    for (const t of this.state.tiles) {
      const at = t.metadata.respawnAt as number | undefined
      if (!at || t.obstacle) continue
      if (now >= at) {
        const kind = (t.metadata.respawnKind as string) || 'tree'
        setObstacle(t, kind as Exclude<Tile['obstacle'], null>)
        delete t.metadata.respawnAt
        delete t.metadata.respawnKind
      }
    }
  }

  // ---------------- crops ----------------
  private plantTile(t: Tile) {
    const cropId = this.cropForTile(t)
    if (!cropId) return
    const crop = CROPS[cropId]
    if (!crop) return
    if (!this.spendStamina(COST.plant)) return
    t.cropId = crop.id
    t.growthStage = 0
    t.metadata.growT = 0
    this.audio.sfx('plant')
    this.dirtPuff(t.x * T + T / 2, t.y * T + T / 2, '#3a8a3a')
    this.emit()
  }

  private growCrops(dt: number) {
    for (const t of this.state.tiles) {
      if (!t.cropId) continue
      const crop = CROPS[t.cropId]
      if (t.growthStage >= crop.stages - 1) continue
      const grow = ((t.metadata.growT as number) || 0) + dt
      t.metadata.growT = grow
      const matureSecs = crop.growDays * STAGE_SECS_PER_DAY
      const stage = Math.min(crop.stages - 1, Math.floor((grow / matureSecs) * (crop.stages - 1)))
      if (stage !== t.growthStage) t.growthStage = stage
    }
  }

  private harvestCrop(t: Tile) {
    const crop = CROPS[t.cropId!]
    const itemId = cropItemId(crop.id, 'normal')
    if (!this.canAccept(itemId, 1)) {
      this.toast('가방이 가득 찼어요! 공간을 비우세요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (!this.spendStamina(COST.harvest)) return
    this.giveItem(itemId, 1)
    this.audio.sfx('harvest')
    this.leafBurst(t.x * T + T / 2, t.y * T + T / 2, crop.color)
    const nextCropId = this.cropForTile(t) ?? crop.id
    t.cropId = nextCropId
    t.growthStage = 0
    t.metadata.growT = 0
    this.toast(`${crop.name}을(를) 수확했어요!`, 'good')
  }

  // ---------------- inventory ----------------
  private firstStackOrEmpty(itemId: string): number {
    const inv = this.state.inventory
    const def = getItem(itemId)
    if (def?.stackable) {
      for (let i = 0; i < inv.length; i++) {
        if (inv[i].itemId === itemId && inv[i].qty < def.maxStack) return i
      }
    }
    for (let i = 0; i < inv.length; i++) if (!inv[i].itemId) return i
    return -1
  }

  canAccept(itemId: string, qty: number): boolean {
    const def = getItem(itemId)
    if (!def) return false
    let remaining = qty
    const inv = this.state.inventory
    if (def.stackable) {
      for (const sl of inv) {
        if (sl.itemId === itemId) remaining -= def.maxStack - sl.qty
        if (remaining <= 0) return true
      }
    }
    for (const sl of inv) {
      if (!sl.itemId) {
        remaining -= def.stackable ? def.maxStack : 1
        if (remaining <= 0) return true
      }
    }
    return remaining <= 0
  }

  giveItem(itemId: string, qty: number): number {
    const def = getItem(itemId)
    if (!def || qty <= 0) return 0
    let left = qty
    const inv = this.state.inventory
    while (left > 0) {
      const slot = this.firstStackOrEmpty(itemId)
      if (slot === -1) break
      if (!inv[slot].itemId) inv[slot] = { itemId, qty: 0 }
      const room = def.stackable ? def.maxStack - inv[slot].qty : 1
      const add = Math.min(room, left)
      inv[slot].qty += add
      left -= add
    }
    const added = qty - left
    if (left > 0) this.toast('가방이 가득 차 일부를 잃었어요.', 'bad')
    return added
  }

  countItem(itemId: string): number {
    let n = 0
    for (const sl of this.state.inventory) if (sl.itemId === itemId) n += sl.qty
    return n
  }

  removeItem(itemId: string, qty: number): boolean {
    if (this.countItem(itemId) < qty) return false
    let left = qty
    const inv = this.state.inventory
    for (let i = 0; i < inv.length && left > 0; i++) {
      if (inv[i].itemId === itemId) {
        const take = Math.min(inv[i].qty, left)
        inv[i].qty -= take
        left -= take
        if (inv[i].qty <= 0) inv[i] = { itemId: '', qty: 0 }
      }
    }
    return true
  }

  private canPayCost(gold: number, items: { itemId: string; qty: number }[]): boolean {
    if (this.state.gold < gold) return false
    return items.every((it) => this.countItem(it.itemId) >= it.qty)
  }

  private payCost(gold: number, items: { itemId: string; qty: number }[]) {
    this.state.gold -= gold
    for (const it of items) this.removeItem(it.itemId, it.qty)
  }

  private spendStamina(cost: number): boolean {
    const s = this.state
    if (cost <= 0) return true
    if (s.stamina < cost) {
      if (!this.exhaustedNotified) {
        this.toast('너무 지쳤어요. 침대에서 잠을 자요.', 'bad')
        this.audio.sfx('reject')
        this.exhaustedNotified = true
      }
      s.player.exhausted = true
      return false
    }
    s.stamina -= cost
    if (s.stamina <= 0) {
      s.stamina = 0
      s.player.exhausted = true
    }
    return true
  }

  // ---------------- shop ----------------
  openShop() {
    if (this.phase !== 'playing') return
    if (!this.nearStore()) {
      this.toast('잡화점 가까이에서만 열 수 있어요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.phase = 'shop'
    this.target = null
    this.audio.resume()
    this.audio.sfx('select')
    this.emit()
  }
  closeShop() {
    if (this.phase === 'shop') {
      this.phase = 'playing'
      this.emit()
    }
  }

  private updateCooking(dt: number) {
    if (!this.state?.cookQueue?.length) return
    let completed = false
    const remaining: CookJob[] = []
    for (const job of this.state.cookQueue) {
      const recipe = RECIPES.find((r) => r.id === job.recipeId)
      if (!recipe) {
        completed = true
        continue
      }
      const remainingQty = Math.max(1, Math.floor(job.remainingQty ?? job.totalQty ?? 1))
      const nextRemaining = Math.max(0, job.remainingSecs - dt)
      if (nextRemaining <= 0 && this.canAccept(recipe.output.itemId, recipe.output.qty)) {
        this.giveItem(recipe.output.itemId, recipe.output.qty)
        const nextQty = remainingQty - 1
        this.toast(`${recipe.name} 완성!`, 'good')
        this.audio.sfx('sparkle')
        completed = true
        if (nextQty > 0) {
          remaining.push({
            ...job,
            totalQty: Math.max(1, Math.floor(job.totalQty ?? remainingQty)),
            remainingQty: nextQty,
            remainingSecs: recipe.craftSeconds,
          })
        }
      } else {
        remaining.push({
          ...job,
          totalQty: Math.max(1, Math.floor(job.totalQty ?? remainingQty)),
          remainingQty,
          remainingSecs: nextRemaining,
        })
      }
    }
    this.state.cookQueue = remaining
    if (completed) this.autosave()
  }

  openBuild() {
    if (this.phase !== 'playing') return
    this.phase = 'build'
    this.target = null
    this.audio.resume()
    this.audio.sfx('select')
    this.emit()
  }

  openSeedSelect() {
    if (this.phase !== 'playing') return
    if (!this.selectedFieldId()) {
      this.toast('밭 푯말 가까이에서 바꿀 수 있어요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.phase = 'seed'
    this.target = null
    this.audio.resume()
    this.audio.sfx('select')
    this.emit()
  }

  openCooking() {
    if (this.phase !== 'playing') return
    if (!this.nearCooking()) {
      this.toast('요리 화덕 가까이에서만 열 수 있어요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.phase = 'cook'
    this.target = null
    this.audio.resume()
    this.audio.sfx('select')
    this.emit()
  }

  closeModal() {
    if (this.phase === 'shop' || this.phase === 'build' || this.phase === 'cook' || this.phase === 'seed') {
      this.phase = 'playing'
      this.emit()
    }
  }

  buildField(optionId: string) {
    const option = BUILD_OPTIONS.find((o) => o.id === optionId)
    if (!option || this.phase !== 'build') return
    const current = this.fieldExpansionLevel()
    if (current >= option.level) {
      this.toast('이미 지어진 확장이에요.', 'info')
      return
    }
    if (option.level !== current + 1) {
      this.toast('앞 단계 밭부터 먼저 확장하세요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (!this.canPayCost(option.costGold, option.costItems)) {
      this.toast('건설 재료가 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.payCost(option.costGold, option.costItems)
    this.state.flags.fieldExpansionLevel = option.level
    this.applyBuildRect(option.rect)
    this.toast(`${option.name} 완료!`, 'good')
    this.audio.sfx('sparkle')
    this.autosave()
    this.emit()
  }

  buyFieldRow(fieldId: string) {
    if (this.phase !== 'build') return
    const plot = FIELD_PLOTS.find((p) => p.id === fieldId)
    if (!plot) return
    const rows = this.fieldRows(fieldId)
    if (rows >= FIELD_SIZE) {
      this.toast('이미 모두 해금된 밭이에요.', 'info')
      return
    }
    if (this.nextUnlockFieldId() !== fieldId) {
      this.toast('오른쪽 밭부터 순서대로 해금해야 해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    const costItems = [{ itemId: 'wood', qty: FIELD_ROW_COST_WOOD }]
    if (!this.canPayCost(FIELD_ROW_COST_GOLD, costItems)) {
      this.toast('땅을 살 재료가 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.payCost(FIELD_ROW_COST_GOLD, costItems)
    this.state.flags[this.fieldRowsKey(fieldId)] = rows + 1
    if (!this.fieldCrop(fieldId)) this.state.flags[this.fieldCropKey(fieldId)] = DEFAULT_FIELD_CROP
    this.applyFieldRows()
    this.toast(`${plot.name} ${rows + 1}/${FIELD_SIZE}줄 해금!`, 'good')
    this.audio.sfx('sparkle')
    this.autosave()
    this.emit()
  }

  setFieldCrop(fieldId: string, cropId: string) {
    if (this.phase !== 'seed') return
    if (this.selectedFieldId() !== fieldId) return
    if (!CROPS[cropId] || this.fieldRows(fieldId) <= 0) return
    if (!this.cropUnlocked(cropId)) {
      this.toast('아직 해금되지 않은 작물이에요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.state.flags[this.fieldCropKey(fieldId)] = cropId
    for (const t of this.state.tiles) {
      if (t.metadata.fieldId === fieldId && t.terrain === 'soil' && !t.cropId) {
        t.cropId = cropId
        t.growthStage = 0
        t.metadata.growT = 0
      }
    }
    this.toast(`${CROPS[cropId].name} 밭으로 등록했어요.`, 'good')
    this.audio.sfx('select')
    this.autosave()
    this.emit()
  }

  private recipeMaxCookQty(recipe: typeof RECIPES[number]): number {
    let max = COOK_BATCH_MAX
    for (const input of recipe.inputs) {
      max = Math.min(max, Math.floor(this.countItem(input.itemId) / input.qty))
    }
    return Math.max(0, max)
  }

  private recipeInputQty(recipe: typeof RECIPES[number], qty: number) {
    return recipe.inputs.map((input) => ({ itemId: input.itemId, qty: input.qty * qty }))
  }

  cook(recipeId: string, qty = 1) {
    const recipe = RECIPES.find((r) => r.id === recipeId)
    if (!recipe || this.phase !== 'cook') return
    const cookQty = Math.max(1, Math.min(COOK_BATCH_MAX, Math.floor(qty)))
    if (!this.flagEnabled(recipe.unlockFlag)) {
      this.toast('아직 해금되지 않은 레시피예요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (!this.canPayCost(0, this.recipeInputQty(recipe, cookQty))) {
      this.toast('요리 재료가 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (this.state.cookQueue.length >= this.cookingSlots()) {
      this.toast('화로대 조리 칸이 모두 찼어요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.payCost(0, this.recipeInputQty(recipe, cookQty))
    this.state.cookQueue.push({
      id: `${recipe.id}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      recipeId: recipe.id,
      totalQty: cookQty,
      remainingQty: cookQty,
      remainingSecs: recipe.craftSeconds,
    })
    this.toast(`${recipe.name} 조리 시작!`, 'good')
    this.audio.sfx('select')
    this.autosave()
    this.emit()
  }

  upgradeCookingFire() {
    if (this.phase !== 'build') return
    const upgrade = this.nextCookingFireUpgrade()
    if (!upgrade) {
      this.toast('화로대가 최대 레벨이에요.', 'info')
      return
    }
    if (!this.canPayCost(upgrade.costGold, upgrade.costItems)) {
      this.toast('화로대 업그레이드 재료가 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.payCost(upgrade.costGold, upgrade.costItems)
    this.state.flags.cookingFireLevel = upgrade.level
    this.toast(`화로대 Lv.${upgrade.level}! 조리 칸 ${this.cookingSlots()}개`, 'good')
    this.audio.sfx('sparkle')
    this.autosave()
    this.emit()
  }

  buyItem(itemId: string) {
    const entry = SHOP_CATALOG.find((e) => e.itemId === itemId)
    if (!entry || entry.buyPrice == null) return
    if (this.phase !== 'shop') return
    if (!this.flagEnabled(entry.requiresFlag)) return
    if (entry.animalFarmId) {
      this.buyAnimal(entry.animalFarmId)
      return
    }
    if (entry.grantsFlag && this.flagEnabled(entry.grantsFlag)) {
      this.toast('이미 해금된 항목이에요.', 'info')
      return
    }
    const s = this.state
    if (s.gold < entry.buyPrice) {
      this.toast('골드가 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (!entry.grantsFlag && !this.canAccept(itemId, 1)) {
      this.toast('가방이 가득 찼어요!', 'bad')
      return
    }
    s.gold -= entry.buyPrice
    if (entry.grantsFlag) {
      s.flags[entry.grantsFlag] = true
      this.applyAnimalFarms()
      const def = getItem(itemId)
      this.toast(`${def?.name ?? '콘텐츠'} 해금!`, 'good')
    } else {
      this.giveItem(itemId, 1)
    }
    this.audio.sfx('coin')
    this.autosave()
    this.emit()
  }

  private buyAnimal(farmId: string) {
    const farm = ANIMAL_FARMS.find((f) => f.id === farmId)
    if (!farm || !this.animalFarmOwned(farm)) return
    const price = this.animalBuyPrice(farm)
    const s = this.state
    const currentCount = this.animalCount(farm)
    if (currentCount >= ANIMAL_FARM_MAX_ANIMALS) {
      this.toast(`최대 ${ANIMAL_FARM_MAX_ANIMALS}마리까지 키울 수 있어요.`, 'info')
      return
    }
    if (s.gold < price) {
      this.toast('골드가 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    s.gold -= price
    const nextCount = currentCount + 1
    s.flags[this.animalCountKey(farm.id)] = nextCount
    if (typeof s.flags[this.animalDropKey(farm.id)] !== 'number') {
      s.flags[this.animalDropKey(farm.id)] = 0
    }
    const def = getItem(farm.animalItemId)
    this.toast(`${def?.name ?? farm.name} ${nextCount}마리째 입양!`, 'good')
    this.audio.sfx('coin')
    this.autosave()
    this.emit()
  }

  sellItem(index: number, all: boolean) {
    const slot = this.state.inventory[index]
    if (!slot || !slot.itemId) return
    const def = getItem(slot.itemId)
    if (!def) return
    const qty = all ? slot.qty : 1
    const gold = def.sellPrice * qty
    this.removeItem(slot.itemId, qty)
    this.state.gold += gold
    this.audio.sfx('coin')
    this.toast(`${def.name} ${qty}개를 ${gold}G에 팔았어요.`, 'good')
    this.autosave()
    this.emit()
  }

  // ---------------- sleep ----------------
  requestSleep() {
    if (this.phase === 'playing') {
      this.phase = 'sleepConfirm'
      this.target = null
      this.emit()
    }
  }
  cancelSleep() {
    if (this.phase === 'sleepConfirm') {
      this.phase = 'playing'
      this.emit()
    }
  }
  confirmSleep() {
    if (this.phase !== 'sleepConfirm' && this.phase !== 'playing') return
    const s = this.state
    s.maxStamina += 1
    s.stamina = s.maxStamina
    s.player.exhausted = false
    this.exhaustedNotified = false
    s.day++
    s.timeMinutes = 360
    s.player.x = LOCATIONS.spawn.x * T + T / 2
    s.player.y = LOCATIONS.spawn.y * T + T
    this.target = null
    this.phase = 'playing'
    this.fadeDir = 1
    this.pendingWake = true
    this.toast(`잘 잤어요! 최대 스태미나 +1 → ${s.maxStamina}`, 'good')
    this.audio.sfx('sparkle')
    this.autosave()
    this.emit()
  }

  // ---------------- helpers ----------------
  private nowSecs(): number {
    return performance.now() / 1000
  }

  private nearBed(): boolean {
    const p = this.playerTile()
    const b = LOCATIONS.bed
    return Math.abs(p.x - b.x) <= 1 && Math.abs(p.y - b.y) <= 2
  }

  private nearStore(): boolean {
    return this.nearTileMetadata('storeCounter') || this.nearTileMetadata('storeInterior')
  }

  private nearBuild(): boolean {
    return true
  }

  private nearCooking(): boolean {
    return this.nearTileMetadata('cookingFire')
  }

  private nearTileMetadata(key: string): boolean {
    const pt = this.playerTile()
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = inBounds(pt.x + dx, pt.y + dy)
          ? this.state.tiles[idx(pt.x + dx, pt.y + dy)]
          : null
        if (t && t.metadata[key]) return true
      }
    }
    return false
  }

  private selectedFieldId(): string | null {
    const pt = this.playerTile()
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = inBounds(pt.x + dx, pt.y + dy)
          ? this.state.tiles[idx(pt.x + dx, pt.y + dy)]
          : null
        const fieldId = t?.metadata.fieldSign
        if (typeof fieldId === 'string') return fieldId
      }
    }
    return null
  }

  private fieldRowsKey(fieldId: string): string {
    return `fieldRows:${fieldId}`
  }

  private fieldCropKey(fieldId: string): string {
    return `fieldCrop:${fieldId}`
  }

  private fieldRows(fieldId: string): number {
    const raw = this.state.flags[this.fieldRowsKey(fieldId)]
    return typeof raw === 'number' ? Math.max(0, Math.min(FIELD_SIZE, raw)) : 0
  }

  private fieldCrop(fieldId: string): string | null {
    const raw = this.state.flags[this.fieldCropKey(fieldId)]
    return typeof raw === 'string' && CROPS[raw] && this.cropUnlocked(raw) ? raw : null
  }

  private flagEnabled(flag: string | undefined): boolean {
    return !flag || this.state.flags[flag] === true
  }

  private applyInitialUnlocks() {
    this.state.flags[cropUnlockFlag(DEFAULT_FIELD_CROP)] = true
  }

  private cropUnlocked(cropId: string): boolean {
    return this.flagEnabled(cropUnlockFlag(cropId))
  }

  private cookingFireLevel(): number {
    const raw = this.state.flags.cookingFireLevel
    return typeof raw === 'number'
      ? Math.max(1, Math.min(COOKING_FIRE_MAX_LEVEL, raw))
      : 1
  }

  private cookingSlots(level = this.cookingFireLevel()): number {
    return COOKING_FIRE_BASE_SLOTS + (level - 1) * COOKING_FIRE_SLOTS_PER_LEVEL
  }

  private nextCookingFireUpgrade() {
    return COOKING_FIRE_UPGRADES.find((u) => u.level === this.cookingFireLevel() + 1) ?? null
  }

  private animalFarmOwned(farm: AnimalFarmDef): boolean {
    return this.flagEnabled(farm.unlockFlag)
  }

  private animalCountKey(farmId: string): string {
    return `animalCount:${farmId}`
  }

  private animalDropKey(farmId: string): string {
    return `animalDropT:${farmId}`
  }

  private animalCount(farm: AnimalFarmDef): number {
    const raw = this.state.flags[this.animalCountKey(farm.id)]
    return typeof raw === 'number'
      ? Math.max(0, Math.min(ANIMAL_FARM_MAX_ANIMALS, Math.floor(raw)))
      : 0
  }

  private animalBuyPrice(farm: AnimalFarmDef): number {
    return farm.animalBasePrice + this.animalCount(farm) * farm.animalPriceStep
  }

  private groundItemId(t: Tile): string | null {
    const itemId = t.metadata.groundItemId
    return typeof itemId === 'string' && getItem(itemId) ? itemId : null
  }

  private groundItemQty(t: Tile): number {
    const qty = t.metadata.groundItemQty
    return typeof qty === 'number' ? Math.max(1, Math.floor(qty)) : 1
  }

  private farmHasGroundDrop(farm: AnimalFarmDef): boolean {
    return this.state.tiles.some((t) =>
      t.metadata.animalDropFarm === farm.id && this.groundItemId(t),
    )
  }

  private placeAnimalDrops(farm: AnimalFarmDef, count: number): boolean {
    const candidates: Tile[] = []
    for (let y = farm.y + 1; y < farm.y + farm.h - 1; y++) {
      for (let x = farm.x + 1; x < farm.x + farm.w - 1; x++) {
        if (!inBounds(x, y)) continue
        const t = this.state.tiles[idx(x, y)]
        if (this.groundItemId(t) || t.obstacle || t.cropId) continue
        candidates.push(t)
      }
    }
    if (candidates.length < count) return false
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = candidates[i]
      candidates[i] = candidates[j]
      candidates[j] = tmp
    }
    for (let i = 0; i < count; i++) {
      const t = candidates[i]
      t.metadata.groundItemId = farm.productItemId
      t.metadata.groundItemQty = farm.productQty
      t.metadata.animalDropFarm = farm.id
    }
    return true
  }

  private pickupGroundItem(t: Tile) {
    const itemId = this.groundItemId(t)
    if (!itemId) return
    const qty = this.groundItemQty(t)
    if (!this.canAccept(itemId, qty)) {
      this.toast('가방이 가득 찼어요!', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.giveItem(itemId, qty)
    delete t.metadata.groundItemId
    delete t.metadata.groundItemQty
    delete t.metadata.animalDropFarm
    const item = getItem(itemId)
    this.toast(`${item?.name ?? itemId} +${qty}`, 'good')
    this.audio.sfx('harvest')
    this.autosave()
    this.emit()
  }

  private updateAnimalDrops(dt: number) {
    let dropped = false
    for (const farm of ANIMAL_FARMS) {
      if (!this.animalFarmOwned(farm)) continue
      const count = this.animalCount(farm)
      if (count <= 0) continue
      if (this.farmHasGroundDrop(farm)) continue
      const key = this.animalDropKey(farm.id)
      const elapsed = (typeof this.state.flags[key] === 'number' ? this.state.flags[key] : 0) + dt
      if (elapsed < farm.dropSeconds) {
        this.state.flags[key] = elapsed
        continue
      }
      if (this.placeAnimalDrops(farm, count)) {
        this.state.flags[key] = 0
        dropped = true
      }
    }
    if (dropped) this.autosave()
  }

  private selectedAnimalFarm(): AnimalFarmDef | null {
    const pt = this.playerTile()
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = inBounds(pt.x + dx, pt.y + dy)
          ? this.state.tiles[idx(pt.x + dx, pt.y + dy)]
          : null
        const farmId = t?.metadata.animalFarm
        if (typeof farmId !== 'string') continue
        const farm = ANIMAL_FARMS.find((f) => f.id === farmId)
        if (farm && this.animalFarmOwned(farm)) return farm
      }
    }
    return null
  }

  collectAnimalProduct() {
    if (this.phase !== 'playing') return
    const pt = this.playerTile()
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!inBounds(pt.x + dx, pt.y + dy)) continue
        const t = this.state.tiles[idx(pt.x + dx, pt.y + dy)]
        if (this.groundItemId(t)) {
          this.pickupGroundItem(t)
          return
        }
      }
    }
  }

  private nextUnlockFieldId(): string | null {
    for (const plot of FIELD_PLOTS) {
      if (this.fieldRows(plot.id) < FIELD_SIZE) return plot.id
    }
    return null
  }

  private cropForTile(t: Tile): string | null {
    const fieldId = t.metadata.fieldId
    if (typeof fieldId !== 'string') return null
    if (this.fieldRows(fieldId) <= 0) return null
    return this.fieldCrop(fieldId) ?? DEFAULT_FIELD_CROP
  }

  private applyFieldRows() {
    for (const t of this.state.tiles) {
      if (typeof t.metadata.fieldId === 'string' || typeof t.metadata.fieldSign === 'string') {
        t.terrain = 'grass'
        t.cropId = null
        t.growthStage = 0
        t.metadata.growT = 0
        t.obstacle = null
        t.hp = undefined
        delete t.metadata.fieldId
        delete t.metadata.fieldSign
      }
    }
    for (const plot of FIELD_PLOTS) {
      const rows = this.fieldRows(plot.id)
      for (let row = 0; row < FIELD_SIZE; row++) {
        for (let col = 0; col < FIELD_SIZE; col++) {
          const t = this.state.tiles[idx(plot.x + col, plot.y + row)]
          const unlocked = row < rows
          t.terrain = unlocked ? 'soil' : 'grass'
          if (!unlocked) {
            t.cropId = null
            t.growthStage = 0
            t.metadata.growT = 0
          }
          t.obstacle = null
          t.hp = undefined
          t.metadata.fieldId = plot.id
        }
      }
      const sign = this.state.tiles[idx(plot.sign.x, plot.sign.y)]
      sign.terrain = 'grass'
      sign.cropId = null
      sign.growthStage = 0
      sign.obstacle = null
      sign.hp = undefined
      sign.metadata.fieldSign = plot.id
    }
  }

  private applyGroundCleanup() {
    for (const t of this.state.tiles) {
      if (t.terrain === 'path') t.terrain = 'grass'
      delete t.metadata.shrine
    }
    for (let y = 2; y <= 4; y++) {
      for (let x = 19; x <= 21; x++) {
        const t = this.state.tiles[idx(x, y)]
        t.terrain = 'grass'
        t.cropId = null
        t.growthStage = 0
        t.obstacle = null
        t.hp = undefined
      }
    }
  }

  private applyAnimalFarms() {
    for (const t of this.state.tiles) {
      if (typeof t.metadata.animalFarm !== 'string') continue
      t.terrain = 'grass'
      t.cropId = null
      t.growthStage = 0
      t.obstacle = null
      t.hp = undefined
      delete t.metadata.animalFarm
    }
    for (const farm of ANIMAL_FARMS) {
      for (let y = farm.y; y < farm.y + farm.h; y++) {
        for (let x = farm.x; x < farm.x + farm.w; x++) {
          if (!inBounds(x, y)) continue
          const t = this.state.tiles[idx(x, y)]
          t.terrain = 'grass'
          t.cropId = null
          t.growthStage = 0
          t.obstacle = null
          t.hp = undefined
          delete t.metadata.animalFarm
        }
      }
      if (!this.animalFarmOwned(farm)) continue
      const gateX = farm.x + Math.floor(farm.w / 2)
      const gateY = farm.y + farm.h - 1
      for (let y = farm.y; y < farm.y + farm.h; y++) {
        for (let x = farm.x; x < farm.x + farm.w; x++) {
          if (!inBounds(x, y)) continue
          const t = this.state.tiles[idx(x, y)]
          const edge = x === farm.x || x === farm.x + farm.w - 1 || y === farm.y || y === farm.y + farm.h - 1
          const gate = x === gateX && y === gateY
          t.terrain = edge && !gate ? 'blocked' : 'grass'
          t.metadata.animalFarm = farm.id
        }
      }
    }
  }

  private fieldExpansionLevel(): number {
    const raw = this.state.flags.fieldExpansionLevel
    return typeof raw === 'number' ? raw : 0
  }

  private applyFieldExpansions() {
    const level = this.fieldExpansionLevel()
    for (const option of BUILD_OPTIONS) {
      if (option.level <= level) this.applyBuildRect(option.rect)
    }
  }

  private applyBuildRect(rect: { x: number; y: number; w: number; h: number }) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (!inBounds(x, y)) continue
        const t = this.state.tiles[idx(x, y)]
        t.terrain = 'soil'
        t.obstacle = null
        t.hp = undefined
        t.cropId = null
        t.growthStage = 0
        t.metadata.growT = 0
      }
    }
  }

  private toast(text: string, kind: 'info' | 'good' | 'bad') {
    const id = this.toastId++
    this.toasts.push({ id, text, kind })
    if (this.toasts.length > 4) this.toasts.shift()
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id)
      this.emit()
    }, 2600)
  }

  private clearObs(t: Tile) {
    t.obstacle = null
    t.hp = undefined
  }

  private autosave() {
    saveGame(this.state)
  }
  saveNow(): boolean {
    const ok = saveGame(this.state)
    this.toast(ok ? '게임을 저장했어요.' : '저장에 실패했어요.', ok ? 'good' : 'bad')
    this.emit()
    return ok
  }
  toggleMute() {
    this.audio.setMuted(!this.audio.muted)
    this.emit()
  }
  toggleMusic() {
    this.audio.toggleMusic()
    this.emit()
  }

  // ---------------- particles ----------------
  private dirtPuff(x: number, y: number, color: string) {
    for (let i = 0; i < 6; i++)
      this.particles.push({ x, y, vx: (Math.random() - 0.5) * 30, vy: -Math.random() * 25 - 5, life: 0.5, max: 0.5, color, size: 1.5, gravity: 90, additive: false })
  }
  private leafBurst(x: number, y: number, color: string) {
    for (let i = 0; i < 8; i++)
      this.particles.push({ x, y, vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 40 - 10, life: 0.6, max: 0.6, color, size: 1.6, gravity: 70, additive: false })
  }
  private woodChips(x: number, y: number) {
    for (let i = 0; i < 6; i++)
      this.particles.push({ x, y, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 50 - 10, life: 0.5, max: 0.5, color: '#a8743f', size: 1.4, gravity: 120, additive: false })
  }
  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) { this.particles.splice(i, 1); continue }
      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
  }
  private updateFireflies(dt: number) {
    for (const f of this.fireflies) {
      f.phase += dt * f.speed
      f.x += Math.cos(f.phase) * 6 * dt
      f.y += Math.sin(f.phase * 1.3) * 6 * dt
    }
  }

  // ---------------- rendering ----------------
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = this.canvas.clientWidth || 360
    const h = this.canvas.clientHeight || 640
    this.canvas.width = Math.floor(w * dpr)
    this.canvas.height = Math.floor(h * dpr)
    const target = T * 13
    this.scale = Math.max(2, Math.min(6, Math.round(Math.min(this.canvas.width, this.canvas.height) / target)))
    this.ctx.imageSmoothingEnabled = false
  }

  private minuteOfDay(): number {
    return this.state.timeMinutes % 1440
  }
  private period(): Period {
    const h = this.minuteOfDay() / 60
    if (h >= 6 && h < 12) return 'morning'
    if (h >= 12 && h < 17) return 'afternoon'
    if (h >= 17 && h < 20) return 'golden'
    return 'night'
  }

  private wx(worldX: number): number {
    return Math.round((worldX - this.cam.x) * this.scale)
  }
  private wy(worldY: number): number {
    return Math.round((worldY - this.cam.y) * this.scale)
  }

  private render() {
    const ctx = this.ctx
    const S = this.scale
    const bw = this.canvas.width
    const bh = this.canvas.height
    ctx.imageSmoothingEnabled = false
    if (this.phase === 'title' || !this.state) {
      this.renderTitle()
      return
    }
    const viewW = bw / S
    const viewH = bh / S
    const p = this.state.player
    this.cam.x = Math.max(0, Math.min(WORLD_W * T - viewW, p.x - viewW / 2))
    this.cam.y = Math.max(0, Math.min(WORLD_H * T - viewH, p.y - viewH / 2))
    if (WORLD_W * T < viewW) this.cam.x = (WORLD_W * T - viewW) / 2
    if (WORLD_H * T < viewH) this.cam.y = (WORLD_H * T - viewH) / 2

    ctx.fillStyle = '#2a3a2a'
    ctx.fillRect(0, 0, bw, bh)

    const x0 = Math.floor(this.cam.x / T) - 1
    const y0 = Math.floor(this.cam.y / T) - 1
    const x1 = x0 + Math.ceil(viewW / T) + 3
    const y1 = y0 + Math.ceil(viewH / T) + 3

    this.waterAnim += 0.02
    const wf = Math.floor(this.waterAnim) % this.sprites.water.length

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!inBounds(tx, ty)) continue
        this.drawGround(this.state.tiles[idx(tx, ty)], wf, S)
      }
    }
    // buildings
    this.drawBuilding(this.sprites.farmhouse, 29, 6, S, -16)
    this.drawBuilding(this.sprites.store, 22, 6, S, -14)
    this.drawAnimalFarms(S)
    this.drawFieldSigns(S)
    this.drawCookingFire(S)

    type Draw = { y: number; fn: () => void }
    const draws: Draw[] = []
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!inBounds(tx, ty)) continue
        const t = this.state.tiles[idx(tx, ty)]
        if (t.obstacle) draws.push({ y: ty * T + T, fn: () => this.drawObstacle(t, S) })
        if (t.cropId) draws.push({ y: ty * T + T, fn: () => this.drawCrop(t, S) })
        if (this.groundItemId(t)) draws.push({ y: ty * T + T, fn: () => this.drawGroundItem(t, S) })
      }
    }
    draws.push({ y: p.y, fn: () => this.drawHuman(this.sprites.farmer, p.x, p.y, p.dir, p.moving, p.exhausted) })
    draws.sort((a, b) => a.y - b.y)
    for (const d of draws) d.fn()

    this.drawWorkHighlight(S)
    this.drawParticles(S)
    this.drawLighting(S, bw, bh)
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.fade})`
      ctx.fillRect(0, 0, bw, bh)
    }
  }

  private drawGround(t: Tile, wf: number, S: number) {
    const dx = this.wx(t.x * T)
    const dy = this.wy(t.y * T)
    const sz = T * S
    let img: HTMLCanvasElement
    if (t.terrain === 'water') img = this.sprites.water[wf]
    else if (t.terrain === 'path') img = this.sprites.path
    else if (t.terrain === 'blocked') img = this.sprites.fence
    else if (t.terrain === 'soil' || t.terrain === 'tilled') img = this.sprites.soil
    else img = this.sprites.grass[(t.x * 7 + t.y * 13) % 3]
    this.ctx.drawImage(img, dx, dy, sz, sz)
  }

  private itemIcon(itemId: string): HTMLCanvasElement {
    const hit = this.itemIconCache.get(itemId)
    if (hit) return hit
    const item = getItem(itemId)
    const icon = bakeItemIcon(item?.sprite ?? itemId)
    this.itemIconCache.set(itemId, icon)
    return icon
  }

  private drawGroundItem(t: Tile, S: number) {
    const itemId = this.groundItemId(t)
    if (!itemId) return
    const ctx = this.ctx
    const x = this.wx(t.x * T)
    const y = this.wy(t.y * T)
    const bounce = Math.sin(performance.now() / 220 + t.x * 0.7 + t.y) * S
    ctx.fillStyle = 'rgba(40,32,24,0.25)'
    ctx.fillRect(x + 5 * S, y + 12 * S, 6 * S, 2 * S)
    ctx.drawImage(this.itemIcon(itemId), x + 3 * S, y + 2 * S + bounce, 10 * S, 10 * S)
  }

  private drawBuilding(img: HTMLCanvasElement, tx: number, ty: number, S: number, yOff: number) {
    this.ctx.drawImage(img, this.wx(tx * T), this.wy(ty * T + yOff), img.width * S, img.height * S)
  }

  private drawFieldSigns(S: number) {
    for (const plot of FIELD_PLOTS) this.drawSign(plot.sign.x, plot.sign.y, S)
  }

  private drawSign(tx: number, ty: number, S: number) {
    const ctx = this.ctx
    const x = this.wx(tx * T)
    const y = this.wy(ty * T)
    ctx.fillStyle = '#7a4c2a'
    ctx.fillRect(x + 5 * S, y + 4 * S, 2 * S, 11 * S)
    ctx.fillRect(x + 10 * S, y + 4 * S, 2 * S, 11 * S)
    ctx.fillStyle = '#d6aa63'
    ctx.fillRect(x + 3 * S, y + 2 * S, 11 * S, 7 * S)
    ctx.fillStyle = '#8f6230'
    ctx.fillRect(x + 4 * S, y + 4 * S, 9 * S, 1 * S)
    ctx.fillRect(x + 4 * S, y + 7 * S, 6 * S, 1 * S)
  }

  private drawAnimalFarms(S: number) {
    const ctx = this.ctx
    for (const farm of ANIMAL_FARMS) {
      if (!this.animalFarmOwned(farm)) continue
      const x = this.wx((farm.x + 1) * T)
      const y = this.wy((farm.y + 1) * T)
      ctx.fillStyle = '#8a5a32'
      ctx.fillRect(x + 2 * S, y + 5 * S, 18 * S, 11 * S)
      ctx.fillStyle = '#b3824a'
      ctx.fillRect(x + 2 * S, y + 5 * S, 18 * S, 4 * S)
      ctx.fillStyle = '#6e4426'
      ctx.fillRect(x + 7 * S, y + 10 * S, 6 * S, 6 * S)
      const count = Math.min(ANIMAL_FARM_MAX_ANIMALS, this.animalCount(farm))
      const now = performance.now() / 1000
      for (let i = 0; i < count; i++) {
        const seed = (farm.id.charCodeAt(0) * 17 + i * 37) / 10
        const innerW = Math.max(1, (farm.w - 2) * T - 16)
        const innerH = Math.max(1, (farm.h - 2) * T - 16)
        const px = (farm.x + 1) * T + 8 + ((Math.sin(now * 0.9 + seed) + 1) / 2) * innerW
        const py = (farm.y + 1) * T + 8 + ((Math.cos(now * 0.65 + seed * 1.7) + 1) / 2) * innerH
        this.drawAnimal(farm, px, py, S)
      }
    }
  }

  private drawAnimal(farm: AnimalFarmDef, x: number, y: number, S: number) {
    const ctx = this.ctx
    const sx = this.wx(x)
    const sy = this.wy(y)
    ctx.fillStyle = farm.color
    if (farm.id === 'chicken') {
      ctx.fillRect(sx - 4 * S, sy - 1 * S, 7 * S, 5 * S)
      ctx.fillRect(sx - 1 * S, sy - 4 * S, 4 * S, 4 * S)
      ctx.fillStyle = '#e05a36'
      ctx.fillRect(sx, sy - 6 * S, 2 * S, 2 * S)
      ctx.fillStyle = '#d9872a'
      ctx.fillRect(sx - 3 * S, sy + 4 * S, 1 * S, 2 * S)
      ctx.fillRect(sx + 1 * S, sy + 4 * S, 1 * S, 2 * S)
    } else if (farm.id === 'cow') {
      ctx.fillRect(sx - 6 * S, sy - 1 * S, 11 * S, 6 * S)
      ctx.fillRect(sx + 2 * S, sy - 4 * S, 5 * S, 5 * S)
      ctx.fillStyle = '#3a2a24'
      ctx.fillRect(sx - 4 * S, sy, 3 * S, 3 * S)
      ctx.fillRect(sx - 5 * S, sy + 5 * S, 1 * S, 3 * S)
      ctx.fillRect(sx + 2 * S, sy + 5 * S, 1 * S, 3 * S)
    } else {
      ctx.fillRect(sx - 6 * S, sy - 1 * S, 11 * S, 6 * S)
      ctx.fillRect(sx + 2 * S, sy - 3 * S, 5 * S, 5 * S)
      ctx.fillStyle = '#c96d82'
      ctx.fillRect(sx + 5 * S, sy - 1 * S, 2 * S, 2 * S)
      ctx.fillRect(sx - 5 * S, sy + 5 * S, 1 * S, 3 * S)
      ctx.fillRect(sx + 2 * S, sy + 5 * S, 1 * S, 3 * S)
    }
  }

  private drawCookingFire(S: number) {
    const ctx = this.ctx
    const x = this.wx(LOCATIONS.cookingFire.x * T)
    const y = this.wy(LOCATIONS.cookingFire.y * T)
    ctx.fillStyle = '#6b6255'
    ctx.fillRect(x + 3 * S, y + 11 * S, 10 * S, 3 * S)
    ctx.fillStyle = '#f0b23b'
    ctx.fillRect(x + 6 * S, y + 5 * S, 5 * S, 7 * S)
    ctx.fillStyle = '#e05a36'
    ctx.fillRect(x + 5 * S, y + 7 * S, 7 * S, 5 * S)
    ctx.fillStyle = '#fff0a6'
    ctx.fillRect(x + 8 * S, y + 6 * S, 2 * S, 4 * S)
  }

  private drawObstacle(t: Tile, S: number) {
    let img: HTMLCanvasElement | null
    let yOff = 0
    switch (t.obstacle) {
      case 'tree': img = this.sprites.tree; yOff = -14; break
      case 'stump': img = this.sprites.stump; break
      case 'large_stump': img = this.sprites.largeStump; yOff = -4; break
      case 'rock': img = this.sprites.rock; break
      case 'weed': img = this.sprites.weed; break
      case 'flower': img = this.sprites.flower; break
      default: img = null
    }
    if (!img) return
    this.ctx.drawImage(img, this.wx(t.x * T), this.wy(t.y * T + yOff), img.width * S, img.height * S)
  }

  private drawCrop(t: Tile, S: number) {
    if (!t.cropId) return
    const frames = this.sprites.crops[t.cropId]
    const img = frames[Math.min(t.growthStage, frames.length - 1)]
    this.ctx.drawImage(img, this.wx(t.x * T), this.wy(t.y * T), T * S, T * S)
  }

  private drawHuman(
    sheet: Record<string, HTMLCanvasElement>,
    x: number,
    y: number,
    dir: string,
    moving: boolean,
    exhausted: boolean,
  ) {
    const S = this.scale
    let frame = 0
    if (moving) frame = Math.floor(performance.now() / 160) % 2 === 0 ? 1 : 2
    const img = sheet[`${dir}_${frame}`] ?? sheet['down_0']
    this.ctx.drawImage(img, this.wx(x - 8), this.wy(y - 22 + 2), 16 * S, 22 * S)
    if (exhausted) {
      const t = performance.now() / 300
      this.ctx.fillStyle = '#9fd0ff'
      this.ctx.fillRect(this.wx(x + 5), this.wy(y - 20 + Math.sin(t) * 2), 2 * S, 3 * S)
    }
  }

  private drawWorkHighlight(S: number) {
    const w = this.workTile
    if (!w) return
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'
    ctx.lineWidth = Math.max(1, S / 2)
    ctx.strokeRect(this.wx(w.x * T) + 1, this.wy(w.y * T) + 1, T * S - 2, T * S - 2)
  }

  private drawParticles(S: number) {
    const ctx = this.ctx
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max))
      if (p.additive) ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = p.color
      ctx.fillRect(this.wx(p.x), this.wy(p.y), p.size * S, p.size * S)
      ctx.globalCompositeOperation = 'source-over'
    }
    ctx.globalAlpha = 1
  }

  private drawLighting(S: number, bw: number, bh: number) {
    const ctx = this.ctx
    const period = this.period()
    let overlay: [number, number, number, number]
    if (period === 'morning') overlay = [120, 160, 210, 0.12]
    else if (period === 'afternoon') overlay = [255, 240, 180, 0.05]
    else if (period === 'golden') overlay = [255, 150, 60, 0.2]
    else overlay = [20, 24, 70, 0.46]
    ctx.fillStyle = `rgba(${overlay[0]},${overlay[1]},${overlay[2]},${overlay[3]})`
    ctx.fillRect(0, 0, bw, bh)
    if (period === 'night') {
      ctx.globalCompositeOperation = 'lighter'
      this.glowRect(31 * T, 6 * T + 10, 6, 6, '#ffd65c', S)
      this.glowRect(24 * T + 6, 6 * T + 8, 6, 6, '#ffd07a', S)
      for (const f of this.fireflies) {
        const sx = this.wx(f.x)
        const sy = this.wy(f.y)
        if (sx < -10 || sy < -10 || sx > bw + 10 || sy > bh + 10) continue
        const a = 0.4 + 0.4 * Math.sin(f.phase * 2)
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 6 * S)
        g.addColorStop(0, `rgba(255,240,140,${a})`)
        g.addColorStop(1, 'rgba(255,240,140,0)')
        ctx.fillStyle = g
        ctx.fillRect(sx - 6 * S, sy - 6 * S, 12 * S, 12 * S)
      }
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  private glowRect(wx: number, wy: number, w: number, h: number, color: string, S: number) {
    const ctx = this.ctx
    const sx = this.wx(wx)
    const sy = this.wy(wy)
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 14 * S)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.globalAlpha = 0.6
    ctx.fillRect(sx - 14 * S, sy - 14 * S, 28 * S, 28 * S)
    ctx.globalAlpha = 1
    ctx.fillStyle = color
    ctx.fillRect(sx, sy, w * S, h * S)
  }

  private renderTitle() {
    const ctx = this.ctx
    const bw = this.canvas.width
    const bh = this.canvas.height
    const g = ctx.createLinearGradient(0, 0, 0, bh)
    g.addColorStop(0, '#8fd0e8')
    g.addColorStop(0.6, '#bfe6a0')
    g.addColorStop(1, '#7cc24e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, bw, bh)
    ctx.fillStyle = '#6fb544'
    ctx.beginPath()
    ctx.ellipse(bw * 0.3, bh * 0.8, bw * 0.5, bh * 0.25, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#5aa038'
    ctx.beginPath()
    ctx.ellipse(bw * 0.75, bh * 0.85, bw * 0.45, bh * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // ---------------- UI snapshot ----------------
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getSnapshot(): UISnapshot {
    return this.snap
  }
  private emit() {
    this.snap = this.buildSnapshot()
    for (const l of this.listeners) l()
  }

  private clockString(): string {
    const total = this.minuteOfDay()
    const h = Math.floor(total / 60)
    const m = Math.floor(total % 60)
    const ampm = h < 12 ? '오전' : '오후'
    let h12 = h % 12
    if (h12 === 0) h12 = 12
    return `${ampm} ${h12}:${m.toString().padStart(2, '0')}`
  }
  private periodLabel(): string {
    return { morning: '아침', afternoon: '낮', golden: '황혼', night: '밤' }[this.period()]
  }

  private buildSnapshot(): UISnapshot {
    const s = this.state
    if (!s) {
      return {
        phase: this.phase, day: 1, clock: '오전 6:00', period: '아침', periodKey: 'morning',
        gold: 0, stamina: 0, maxStamina: 0, inventory: [], toasts: [...this.toasts], shopBuy: [],
        buildOptions: [], fieldPlots: [], cropChoices: [], selectedFieldId: null, cookRecipes: [],
        cookQueue: [],
        cookingFire: {
          level: 1,
          maxLevel: COOKING_FIRE_MAX_LEVEL,
          slots: COOKING_FIRE_BASE_SLOTS,
          usedSlots: 0,
          nextSlots: COOKING_FIRE_BASE_SLOTS + COOKING_FIRE_SLOTS_PER_LEVEL,
          costGold: 0,
          costItems: [],
          canUpgrade: false,
        },
        contextAction: null, contextActionId: null, nearBed: false, nearStore: false, nearBuild: false, nearCooking: false, exhausted: false,
        muted: this.audio.muted, musicOn: this.audio.musicOn, hasSave: this.hasSavedGame(),
      }
    }
    const inventory: InvSlotView[] = s.inventory.map((sl, i) => {
      const def = sl.itemId ? getItem(sl.itemId) : null
      return {
        index: i,
        itemId: sl.itemId || null,
        qty: sl.qty,
        name: def?.name ?? '',
        sprite: def?.sprite ?? '',
        color: def?.cropId ? CROPS[def.cropId].color : undefined,
        sellPrice: def?.sellPrice ?? 0,
        type: def?.type ?? '',
        desc: def?.description ?? '',
      }
    })
    const shopBuy: ShopBuyView[] = SHOP_CATALOG.filter((e) => {
      if (!this.flagEnabled(e.requiresFlag)) return false
      if (e.grantsFlag && this.flagEnabled(e.grantsFlag)) return false
      return true
    }).map((e) => {
      const def = getItem(e.itemId)!
      const farm = e.animalFarmId ? ANIMAL_FARMS.find((f) => f.id === e.animalFarmId) : null
      const price = farm ? this.animalBuyPrice(farm) : (e.buyPrice ?? 0)
      const animalCount = farm ? this.animalCount(farm) : 0
      const ownedText = farm
        ? ` 보유 ${animalCount}/${ANIMAL_FARM_MAX_ANIMALS}마리 · ${farm.dropSeconds}초마다 생산`
        : ''
      return {
        itemId: e.itemId,
        name: def.name,
        price,
        affordable: s.gold >= price && (!farm || animalCount < ANIMAL_FARM_MAX_ANIMALS),
        sprite: def.sprite,
        color: def.cropId ? CROPS[def.cropId].color : undefined,
        desc: `${def.description}${ownedText}`,
      }
    })
    const costViews = (items: { itemId: string; qty: number }[]): CostItemView[] =>
      items.map((it) => {
        const have = this.countItem(it.itemId)
        return {
          itemId: it.itemId,
          name: getItem(it.itemId)?.name ?? it.itemId,
          have,
          need: it.qty,
          ok: have >= it.qty,
        }
      })
    const fieldLevel = this.fieldExpansionLevel()
    const buildOptions: BuildOptionView[] = BUILD_OPTIONS.map((option) => {
      const costItems = costViews(option.costItems)
      const built = fieldLevel >= option.level
      const locked = option.level > fieldLevel + 1
      return {
        id: option.id,
        name: option.name,
        desc: option.description,
        costGold: option.costGold,
        costItems,
        canBuild:
          !built &&
          !locked &&
          s.gold >= option.costGold &&
          costItems.every((it) => it.ok),
        built,
        locked,
      }
    })
    const selectedFieldId = this.selectedFieldId()
    const nextFieldId = this.nextUnlockFieldId()
    const rowCostItems = costViews([{ itemId: 'wood', qty: FIELD_ROW_COST_WOOD }])
    const fieldPlots: FieldPlotView[] = FIELD_PLOTS.map((plot) => {
      const rows = this.fieldRows(plot.id)
      const cropId = this.fieldCrop(plot.id) ?? DEFAULT_FIELD_CROP
      const crop = CROPS[cropId] ?? CROPS[DEFAULT_FIELD_CROP]
      const nextToUnlock = nextFieldId === plot.id
      return {
        id: plot.id,
        name: plot.name,
        rows,
        selectedCropId: crop.id,
        selectedCropName: crop.name,
        selected: selectedFieldId === plot.id,
        nextToUnlock,
        canBuyRow:
          rows < FIELD_SIZE &&
          nextToUnlock &&
          s.gold >= FIELD_ROW_COST_GOLD &&
          rowCostItems.every((it) => it.ok),
        costGold: FIELD_ROW_COST_GOLD,
        costItems: rowCostItems,
      }
    })
    const selectedCropId = selectedFieldId ? (this.fieldCrop(selectedFieldId) ?? DEFAULT_FIELD_CROP) : DEFAULT_FIELD_CROP
    const cropChoices: CropChoiceView[] = CROP_LIST.map((crop) => ({
      id: crop.id,
      name: crop.name,
      color: crop.color,
      selected: crop.id === selectedCropId,
      unlocked: this.cropUnlocked(crop.id),
      lockText: this.cropUnlocked(crop.id) ? null : '상점에서 해금',
    }))
    const cookingFireLevel = this.cookingFireLevel()
    const cookingSlots = this.cookingSlots(cookingFireLevel)
    const nextCookingUpgrade = this.nextCookingFireUpgrade()
    const cookingUpgradeItems = costViews(nextCookingUpgrade?.costItems ?? [])
    const cookingFire: CookingFireView = {
      level: cookingFireLevel,
      maxLevel: COOKING_FIRE_MAX_LEVEL,
      slots: cookingSlots,
      usedSlots: s.cookQueue.length,
      nextSlots: nextCookingUpgrade ? this.cookingSlots(nextCookingUpgrade.level) : null,
      costGold: nextCookingUpgrade?.costGold ?? 0,
      costItems: cookingUpgradeItems,
      canUpgrade:
        !!nextCookingUpgrade &&
        s.gold >= nextCookingUpgrade.costGold &&
        cookingUpgradeItems.every((it) => it.ok),
    }
    const cookQueue: CookJobView[] = s.cookQueue.map((job) => {
      const recipe = RECIPES.find((r) => r.id === job.recipeId)
      const out = recipe ? getItem(recipe.output.itemId) : undefined
      const perItemSecs = Math.max(1, recipe?.craftSeconds ?? job.remainingSecs)
      const remainingQty = Math.max(1, Math.floor(job.remainingQty ?? job.totalQty ?? 1))
      const totalQty = Math.max(1, Math.floor(job.totalQty ?? remainingQty))
      const remainingSecs = Math.max(0, job.remainingSecs)
      const totalSecs = totalQty * perItemSecs
      const totalRemainingSecs = (remainingQty - 1) * perItemSecs + remainingSecs
      return {
        id: job.id,
        recipeName: recipe?.name ?? job.recipeId,
        outputName: out?.name ?? recipe?.output.itemId ?? job.recipeId,
        outputSprite: out?.sprite ?? '',
        outputColor: out?.cropId ? CROPS[out.cropId].color : undefined,
        remainingSecs,
        remainingQty,
        totalQty,
        totalRemainingSecs,
        totalSecs,
        progress: Math.max(0, Math.min(1, 1 - totalRemainingSecs / totalSecs)),
        ready: totalRemainingSecs <= 0,
      }
    })
    const cookRecipes: CookRecipeView[] = RECIPES.map((recipe) => {
      const out = getItem(recipe.output.itemId)
      const inputs = costViews(recipe.inputs)
      const unlocked = this.flagEnabled(recipe.unlockFlag)
      const maxCookQty = this.recipeMaxCookQty(recipe)
      return {
        id: recipe.id,
        name: recipe.name,
        desc: recipe.description,
        outputName: out?.name ?? recipe.output.itemId,
        outputSprite: out?.sprite ?? '',
        outputColor: out?.cropId ? CROPS[out.cropId].color : undefined,
        outputQty: recipe.output.qty,
        inputs,
        canCook:
          unlocked &&
          s.cookQueue.length < cookingSlots &&
          maxCookQty > 0,
        maxCookQty,
        unlocked,
        lockText: unlocked ? null : '목장 허가서 필요',
        craftSeconds: recipe.craftSeconds,
        difficulty: recipe.difficulty,
        sellPrice: out?.sellPrice ?? 0,
      }
    })
    let contextAction: string | null = null
    let contextActionId: UISnapshot['contextActionId'] = null
    if (this.phase === 'playing') {
      const animalFarm = this.selectedAnimalFarm()
      if (this.nearBed()) {
        contextAction = '잠자기'
        contextActionId = 'sleep'
      } else if (this.selectedFieldId()) {
        contextAction = '씨앗 변경'
        contextActionId = 'seed'
      } else if (animalFarm) {
        contextAction = null
        contextActionId = null
      } else if (this.nearStore()) {
        contextAction = '상점'
      }
    }
    return {
      phase: this.phase,
      day: s.day,
      clock: this.clockString(),
      period: this.periodLabel(),
      periodKey: this.period(),
      gold: s.gold,
      stamina: Math.round(s.stamina),
      maxStamina: s.maxStamina,
      inventory,
      toasts: [...this.toasts],
      shopBuy,
      buildOptions,
      fieldPlots,
      cropChoices,
      selectedFieldId,
      cookRecipes,
      cookQueue,
      cookingFire,
      contextAction,
      contextActionId,
      nearBed: this.nearBed(),
      nearStore: this.nearStore(),
      nearBuild: this.nearBuild(),
      nearCooking: this.nearCooking(),
      exhausted: s.player.exhausted,
      muted: this.audio.muted,
      musicOn: this.audio.musicOn,
      hasSave: this.hasSavedGame(),
    }
  }
}
