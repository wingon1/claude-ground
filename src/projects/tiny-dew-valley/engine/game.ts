import type { CookJob, Direction, GameState, InventorySlot, Tile, ToolId } from '../types'
import { CROPS, CROP_LIST } from '../data/crops'
import { cropItemId, getItem } from '../data/items'
import { SHOP_CATALOG } from '../data/shopCatalog'
import { BUILD_OPTIONS } from '../data/buildOptions'
import { ANIMAL_FARMS, ANIMAL_FARM_MAX_ANIMALS, type AnimalFarmDef } from '../data/animalFarms'
import { ANIMAL_UPGRADES, type AnimalUpgradeDef } from '../data/animalUpgrades'
import {
  DEFAULT_FIELD_CROP,
  FIELD_PLOTS,
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
  stampBlacksmith,
  stampCookingFire,
  stampFarmhouse,
  stampMine,
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
const COOKING_FIRE_BUILT_FLAG = 'build:cookingFire'
const COOKING_FIRE_BUILD_COST = [{ itemId: 'wood', qty: 5 }]
const ORDER_NPC = { x: LOCATIONS.storeStand.x, y: LOCATIONS.storeStand.y }
const BLACKSMITH_NPC = { x: LOCATIONS.blacksmithNpc.x, y: LOCATIONS.blacksmithNpc.y }

const TUTORIAL_REWARDS = [
  {
    id: 'wood5',
    title: '나무 5개 모으기',
    detail: '화로를 만들 첫 재료를 모읍니다.',
    rewardGold: 20,
    rewardItems: [] as { itemId: string; qty: number }[],
    rewardText: '20G',
  },
  {
    id: 'build_fire',
    title: '화로 제작하기',
    detail: '건설탭에서 나무 5개로 화로를 만듭니다.',
    rewardGold: 0,
    rewardItems: [{ itemId: 'crop_wheat_normal', qty: 2 }],
    rewardText: '밀 2개',
  },
  {
    id: 'first_bread',
    title: '첫 빵 굽기',
    detail: '밀가루로 첫 빵을 만들어 판매 루프를 시작합니다.',
    rewardGold: 80,
    rewardItems: [] as { itemId: string; qty: number }[],
    rewardText: '80G',
  },
  {
    id: 'first_toast',
    title: '첫 토스트 만들기',
    detail: '빵과 달걀을 조합해 닭장 이후의 핵심 상품을 만듭니다.',
    rewardGold: 150,
    rewardItems: [] as { itemId: string; qty: number }[],
    rewardText: '150G',
  },
]

const ORDER_ITEM_POOL = [
  { itemId: 'bread', minQty: 2, maxQty: 4, hint: '빵 주문은 닭장 자금을 모으기 좋아요.' },
  { itemId: 'toast', minQty: 1, maxQty: 3, hint: '토스트 수익으로 딸기 재배권을 노려보세요.' },
  { itemId: 'strawberry_jam', minQty: 1, maxQty: 3, hint: '딸기쨈은 다음 목장 확장의 징검다리예요.' },
  { itemId: 'strawberry_milk', minQty: 1, maxQty: 2, hint: '우유 라인을 돌리면 고급 디저트가 빨라져요.' },
  { itemId: 'strawberry_jam_toast', minQty: 1, maxQty: 2, hint: '딸기쨈 토스트 다음은 토마토와 피자예요.' },
  { itemId: 'pizza', minQty: 1, maxQty: 2, hint: '피자 수익으로 옥수수 후반 라인을 열어보세요.' },
  { itemId: 'butter_corn', minQty: 1, maxQty: 2, hint: '옥수수는 후반 요리의 좋은 보조 재료예요.' },
  { itemId: 'corn_pizza', minQty: 1, maxQty: 2, hint: '콘치즈 피자는 후반 주문 보상이 큽니다.' },
  { itemId: 'bacon_toast', minQty: 1, maxQty: 2, hint: '돼지농장까지 열면 베이컨 주문도 준비해보세요.' },
]

const LEGACY_ID_MAP: Record<string, string> = {
  parsnip: 'tomato',
  golden_pumpkin: 'corn',
  seed_parsnip: 'seed_tomato',
  seed_golden_pumpkin: 'seed_corn',
  crop_parsnip_normal: 'crop_tomato_normal',
  crop_golden_pumpkin_normal: 'crop_corn_normal',
  crop_golden_pumpkin_silver: 'crop_corn_normal',
  crop_golden_pumpkin_gold: 'crop_corn_normal',
  crop_golden_pumpkin_perfect: 'crop_corn_normal',
  parsnip_soup: 'tomato_sauce',
  cream_stew: 'pizza',
  pumpkin_soup: 'butter_corn',
  pumpkin_pie: 'corn_pizza',
}

// Stamina costs per auto-work hit.
const COST = { chop: 1, harvest: 1, plant: 1 }
const START_MAX_STAMINA = 20
const FIELD_ROW_BASE_GOLD = 45
const FIELD_ROW_GOLD_STEP = 35
const FIELD_ROW_BASE_WOOD = 6
const FIELD_ROW_WOOD_STEP = 4
type UpgradeableToolId = Extract<ToolId, 'pickaxe' | 'scythe'>
const TOOL_BASE: Record<UpgradeableToolId, { name: string; damage: number }> = {
  pickaxe: { name: '낡은 곡괭이', damage: 1 },
  scythe: { name: '낡은 낫', damage: 1 },
}
const TOOL_UPGRADES: Record<UpgradeableToolId, {
  level: number
  name: string
  damage: number
  costGold: number
  costItems: { itemId: string; qty: number }[]
}[]> = {
  pickaxe: [
    { level: 1, name: '구리 곡괭이', damage: 2, costGold: 300, costItems: [{ itemId: 'stone', qty: 20 }, { itemId: 'copper_ore', qty: 8 }] },
    { level: 2, name: '철 곡괭이', damage: 3, costGold: 900, costItems: [{ itemId: 'stone', qty: 50 }, { itemId: 'copper_ore', qty: 18 }, { itemId: 'iron_ore', qty: 10 }] },
  ],
  scythe: [
    { level: 1, name: '구리 낫', damage: 2, costGold: 260, costItems: [{ itemId: 'stone', qty: 14 }, { itemId: 'copper_ore', qty: 6 }] },
    { level: 2, name: '철 낫', damage: 3, costGold: 760, costItems: [{ itemId: 'stone', qty: 35 }, { itemId: 'copper_ore', qty: 12 }, { itemId: 'iron_ore', qty: 8 }] },
  ],
}

// ---------- UI snapshot ----------
export type UIPhase = 'title' | 'playing' | 'shop' | 'build' | 'blacksmith' | 'cook' | 'seed' | 'order' | 'sleepConfirm'

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
  owned?: boolean
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
export interface BuildPermitView {
  itemId: string
  name: string
  desc: string
  price: number
  costItems: CostItemView[]
  affordable: boolean
  sprite: string
  built: boolean
  locked: boolean
}
export interface ToolUpgradeView {
  toolId: UpgradeableToolId
  name: string
  level: number
  damage: number
  nextName: string | null
  nextDamage: number | null
  costGold: number
  costItems: CostItemView[]
  canUpgrade: boolean
  maxed: boolean
  sprite: string
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
  mystery?: boolean
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
  built: boolean
  level: number
  maxLevel: number
  slots: number
  usedSlots: number
  nextSlots: number | null
  costGold: number
  costItems: CostItemView[]
  canUpgrade: boolean
}
export interface ObjectiveView {
  title: string
  detail: string
  progress: number
  max: number
}
export interface ObjectiveTaskView extends ObjectiveView {
  id: string
  rewardText: string | null
  completed: boolean
  claimed: boolean
  current: boolean
}
export interface OrderView {
  day: number
  itemId: string
  itemName: string
  sprite: string
  color?: string
  qty: number
  have: number
  rewardGold: number
  hint: string
  completed: boolean
  canComplete: boolean
}
export interface ContextActionView {
  id: 'sleep' | 'animal' | 'seed' | 'shop' | 'cook' | 'order' | 'blacksmith'
  label: string
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
  buildPermits: BuildPermitView[]
  toolUpgrades: ToolUpgradeView[]
  fieldPlots: FieldPlotView[]
  cropChoices: CropChoiceView[]
  selectedFieldId: string | null
  cookRecipes: CookRecipeView[]
  cookQueue: CookJobView[]
  cookingFire: CookingFireView
  objective: ObjectiveView | null
  objectives: ObjectiveTaskView[]
  order: OrderView | null
  contextAction: string | null
  contextActionId: 'sleep' | 'animal' | 'seed' | 'shop' | 'cook' | 'order' | 'blacksmith' | null
  contextActions: ContextActionView[]
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
  private jumpT = 0
  private workAnimT = 0
  private awardingTutorialReward = false

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
    this.applyFieldRows()
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
    this.applyMineState()
    stampFarmhouse(this.state.tiles)
    stampCookingFire(this.state.tiles, this.cookingFireBuilt())
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
      gold: 0,
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
        'fieldRows:field_1': 1,
        'fieldCrop:field_1': DEFAULT_FIELD_CROP,
        [cropUnlockFlag(DEFAULT_FIELD_CROP)]: true,
        [COOKING_FIRE_BUILT_FLAG]: false,
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
    this.jumpT = 0
    this.workAnimT = 0
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
    if (this.jumpT > 0) this.jumpT = Math.max(0, this.jumpT - dt)
    if (this.workAnimT > 0) this.workAnimT = Math.max(0, this.workAnimT - dt)
  }

  // ---------------- update ----------------
  private update(dt: number) {
    const s = this.state
    s.timeMinutes += dt * GAME_MIN_PER_SEC // cosmetic clock
    this.movePlayer(dt)
    this.autoPlantFields()
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
    const speed = WALK_SPEED * dt
    const nx = p.x + vx * speed
    const ny = p.y + vy * speed
    let moved = false
    if (!this.collides(nx, p.y)) { p.x = nx; moved = true }
    if (!this.collides(p.x, ny)) { p.y = ny; moved = true }
    if (!moved) this.target = null // stuck against a wall — stop
    if (moved && this.overlapsAnimalFence(p.x, p.y)) this.jumpT = Math.max(this.jumpT, 0.22)
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
    if (t.metadata.animalFence === true) return false
    if (t.metadata.cookingFireBlock === true) return true
    if (TERRAIN_SOLID[t.terrain]) return true
    if (t.obstacle && OBSTACLE_SOLID[t.obstacle]) return true
    return false
  }

  private overlapsAnimalFence(cx: number, cy: number): boolean {
    const x0 = Math.floor((cx - 5) / T)
    const x1 = Math.floor((cx + 5) / T)
    const y0 = Math.floor((cy - 6) / T)
    const y1 = Math.floor((cy - 0.5) / T)
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!inBounds(tx, ty)) continue
        if (this.state.tiles[idx(tx, ty)].metadata.animalFence === true) return true
      }
    }
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
    if (work.kind !== 'pickup' && (this.state.stamina < 1 || this.state.player.exhausted)) {
      this.state.player.exhausted = true
      this.workTile = null
      return
    }
    if (work.kind === 'pickup') {
      this.pickupGroundItem(work.t)
    } else {
      this.workAnimT = 0.28
      if (work.kind === 'harvest') this.harvestCrop(work.t)
      else if (work.kind === 'chop') this.chopObstacle(work.t)
      else if (work.kind === 'plant') this.plantTile(work.t)
    }
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
    const mining = ob === 'rock' || ob === 'copper_ore' || ob === 'iron_ore'
    if (mining) {
      const requiredLevel = ob === 'iron_ore' ? 1 : 0
      if (this.toolLevel('pickaxe') < requiredLevel) {
        this.toast('더 좋은 곡괭이가 필요해요.', 'bad')
        this.audio.sfx('reject')
        return
      }
    }
    if (!this.spendStamina(COST.chop)) return
    const damage = mining ? this.toolDamage('pickaxe') : 1
    t.hp = (t.hp ?? OBSTACLE_HP[ob]) - damage
    this.audio.sfx(mining ? 'crack' : 'chop')
    if (mining) this.dirtPuff(px, py, ob === 'copper_ore' ? '#c8753a' : ob === 'iron_ore' ? '#c8ccd6' : '#9a9a9a')
    else this.woodChips(px, py)
    if (t.hp <= 0) {
      const drop = OBSTACLE_DROP[ob]
      if (drop) this.giveItem(drop.itemId, drop.qty)
      if (ob === 'copper_ore' || ob === 'iron_ore') this.giveItem('stone', 1)
      this.audio.sfx('crack')
      const renewable = !!t.metadata.renewable
      this.clearObs(t)
      if (renewable) {
        t.metadata.renewable = true
        t.metadata.respawnAt = this.nowSecs() + RESPAWN_SECS
        t.metadata.respawnKind = ob
      } else if (ob === 'tree' || ob === 'rock' || ob === 'stump' || ob === 'copper_ore' || ob === 'iron_ore') {
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
        if (this.isMineResource(kind) && t.metadata.mineNode !== true) {
          delete t.metadata.respawnAt
          delete t.metadata.respawnKind
          continue
        }
        setObstacle(t, kind as Exclude<Tile['obstacle'], null>)
        delete t.metadata.respawnAt
        delete t.metadata.respawnKind
      }
    }
  }

  // ---------------- crops ----------------
  private autoPlantFields() {
    for (const t of this.state.tiles) {
      if (t.terrain !== 'soil' || t.cropId || t.obstacle) continue
      const cropId = this.cropForTile(t)
      if (!cropId) continue
      const crop = CROPS[cropId]
      if (!crop) continue
      t.cropId = crop.id
      t.growthStage = 0
      t.metadata.growT = 0
      delete t.metadata.harvestHp
    }
  }

  private plantTile(t: Tile) {
    const cropId = this.cropForTile(t)
    if (!cropId) return
    const crop = CROPS[cropId]
    if (!crop) return
    if (!this.spendStamina(COST.plant)) return
    t.cropId = crop.id
    t.growthStage = 0
    t.metadata.growT = 0
    delete t.metadata.harvestHp
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
      if (stage !== t.growthStage) {
        t.growthStage = stage
        delete t.metadata.harvestHp
      }
    }
  }

  private cropHarvestHp(cropId: string): number {
    if (cropId === 'wheat') return 2
    if (cropId === 'tomato') return 3
    if (cropId === 'strawberry') return 4
    if (cropId === 'corn') return 4
    return 2
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
    const maxHp = this.cropHarvestHp(crop.id)
    const hp = typeof t.metadata.harvestHp === 'number' ? t.metadata.harvestHp : maxHp
    const nextHp = hp - this.toolDamage('scythe')
    t.metadata.harvestHp = Math.max(0, nextHp)
    this.audio.sfx('harvest')
    this.leafBurst(t.x * T + T / 2, t.y * T + T / 2, crop.color)
    if (nextHp > 0) {
      this.emit()
      return
    }
    this.giveItem(itemId, 1)
    const nextCropId = this.cropForTile(t) ?? crop.id
    t.cropId = nextCropId
    t.growthStage = 0
    t.metadata.growT = 0
    delete t.metadata.harvestHp
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
    if (added > 0) this.markItemSeen(itemId)
    if (added > 0 && !this.awardingTutorialReward) this.checkTutorialRewards()
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

  openOrder() {
    if (this.phase !== 'playing') return
    if (!this.nearOrderNpc()) {
      this.toast('상점 주인 가까이에서만 주문을 볼 수 있어요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.ensureDailyOrder()
    this.phase = 'order'
    this.target = null
    this.audio.resume()
    this.audio.sfx('select')
    this.emit()
  }

  openBlacksmith() {
    if (this.phase !== 'playing') return
    if (!this.mineUnlocked() || !this.nearBlacksmith()) {
      this.toast('광산 옆 대장장이 근처에서만 도구를 강화할 수 있어요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.phase = 'blacksmith'
    this.target = null
    this.audio.resume()
    this.audio.sfx('select')
    this.emit()
  }

  closeOrder() {
    if (this.phase === 'order') {
      this.phase = 'playing'
      this.emit()
    }
  }

  completeOrder() {
    if (this.phase !== 'order') return
    const order = this.currentOrder()
    if (!order) {
      this.toast('아직 맡길 주문이 없어요.', 'info')
      return
    }
    if (order.completed) {
      this.toast('오늘 주문은 이미 완료했어요.', 'info')
      return
    }
    if (this.countItem(order.itemId) < order.qty) {
      this.toast('주문 수량이 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.removeItem(order.itemId, order.qty)
    this.state.gold += order.rewardGold
    this.state.flags[this.orderCompletedKey(this.state.day)] = true
    this.toast(`주문 완료! ${order.rewardGold}G`, 'good')
    this.audio.sfx('coin')
    this.autosave()
    this.emit()
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
    if (!this.cookingFireBuilt()) {
      this.toast('건설탭에서 화로를 먼저 제작하세요.', 'bad')
      this.audio.sfx('reject')
      return
    }
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
    if (this.phase === 'shop' || this.phase === 'build' || this.phase === 'blacksmith' || this.phase === 'cook' || this.phase === 'seed' || this.phase === 'order') {
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
    const costGold = this.fieldRowCostGold()
    const costItems = [{ itemId: 'wood', qty: this.fieldRowCostWood() }]
    if (!this.canPayCost(costGold, costItems)) {
      this.toast('땅을 살 재료가 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.payCost(costGold, costItems)
    this.state.flags[this.fieldRowsKey(fieldId)] = rows + 1
    if (!this.fieldCrop(fieldId)) this.state.flags[this.fieldCropKey(fieldId)] = DEFAULT_FIELD_CROP
    this.applyFieldRows()
    this.toast(`밭 확장 완료! ${rows + 1}/${FIELD_SIZE}줄 해금`, 'good')
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
        delete t.metadata.harvestHp
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
    if (!this.recipeUnlocked(recipe)) {
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
    if (!this.cookingFireBuilt()) {
      this.buildCookingFire()
      return
    }
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

  buildCookingFire() {
    if (this.phase !== 'build') return
    if (this.cookingFireBuilt()) {
      this.toast('이미 화로가 있어요.', 'info')
      return
    }
    if (!this.canPayCost(0, COOKING_FIRE_BUILD_COST)) {
      this.toast('화로를 만들 나무가 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.payCost(0, COOKING_FIRE_BUILD_COST)
    this.state.flags[COOKING_FIRE_BUILT_FLAG] = true
    this.state.flags.cookingFireLevel = 1
    stampCookingFire(this.state.tiles, true)
    this.toast('화로를 제작했어요! 이제 요리를 시작할 수 있어요.', 'good')
    this.audio.sfx('sparkle')
    this.checkTutorialRewards()
    this.autosave()
    this.emit()
  }

  upgradeTool(toolId: UpgradeableToolId) {
    if (this.phase !== 'blacksmith') return
    if (!this.mineUnlocked() || !this.nearBlacksmith()) {
      this.toast('대장장이 앞에서만 도구를 강화할 수 있어요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    const upgrade = this.nextToolUpgrade(toolId)
    if (!upgrade) {
      this.toast('이미 최대 등급 도구예요.', 'info')
      return
    }
    if (!this.canPayCost(upgrade.costGold, upgrade.costItems)) {
      this.toast('도구 업그레이드 재료가 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.payCost(upgrade.costGold, upgrade.costItems)
    this.state.flags[this.toolLevelKey(toolId)] = upgrade.level
    this.toast(`${upgrade.name} 업그레이드 완료! 타격력 ${upgrade.damage}`, 'good')
    this.audio.sfx('sparkle')
    this.autosave()
    this.emit()
  }

  buyBuildPermit(itemId: string) {
    if (this.phase !== 'build') return
    const entry = SHOP_CATALOG.find((e) => e.itemId === itemId)
    if (!entry?.grantsFlag || entry.buyPrice == null || !this.isAnimalPermitEntry(entry)) return
    if (!this.flagEnabled(entry.requiresFlag)) {
      this.toast('이전 농장부터 건설해야 해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (this.flagEnabled(entry.grantsFlag)) {
      this.toast('이미 건설된 농장이에요.', 'info')
      return
    }
    const costItems = entry.costItems ?? []
    if (!this.canPayCost(entry.buyPrice, costItems)) {
      this.toast('건설 재료가 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.payCost(entry.buyPrice, costItems)
    this.state.flags[entry.grantsFlag] = true
    this.applyAnimalFarms()
    const def = getItem(itemId)
    this.toast(`${def?.name ?? '농장'} 건설 완료!`, 'good')
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
    if (entry.animalUpgradeId) {
      this.buyAnimalUpgrade(entry.animalUpgradeId)
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

  private buyAnimalUpgrade(upgradeId: string) {
    const upgrade = ANIMAL_UPGRADES.find((u) => u.id === upgradeId)
    if (!upgrade) return
    const farm = ANIMAL_FARMS.find((f) => f.id === upgrade.farmId)
    if (!farm || !this.animalFarmOwned(farm)) return
    const level = this.animalUpgradeLevel(upgrade)
    if (level >= upgrade.maxLevel) {
      this.toast('이미 최대 레벨이에요.', 'info')
      return
    }
    const price = this.animalUpgradePrice(upgrade)
    if (this.state.gold < price) {
      this.toast('골드가 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.state.gold -= price
    this.state.flags[this.animalUpgradeKey(upgrade.id)] = level + 1
    const def = getItem(upgrade.itemId)
    this.toast(`${def?.name ?? '업그레이드'} Lv.${level + 1}!`, 'good')
    this.audio.sfx('sparkle')
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
    if (this.phase === 'playing' && this.canSleep()) {
      this.phase = 'sleepConfirm'
      this.target = null
      this.emit()
    } else if (this.phase === 'playing') {
      this.toast('스태미나가 0일 때만 잠을 잘 수 있어요.', 'info')
      this.audio.sfx('reject')
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
    this.ensureDailyOrder()
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
    return Math.abs(p.x - b.x) <= 1 && Math.abs(p.y - b.y) <= 1
  }

  private canSleep(): boolean {
    return this.state.stamina <= 0
  }

  private nearStore(): boolean {
    return this.nearTileMetadata('storeCounter') || this.nearTileMetadata('storeInterior')
  }

  private nearOrderNpc(): boolean {
    const p = this.playerTile()
    return Math.abs(p.x - ORDER_NPC.x) <= 1 && Math.abs(p.y - ORDER_NPC.y) <= 1
  }

  private nearBlacksmith(): boolean {
    if (!this.mineUnlocked()) return false
    const p = this.playerTile()
    return Math.abs(p.x - BLACKSMITH_NPC.x) <= 1 && Math.abs(p.y - BLACKSMITH_NPC.y) <= 1
  }

  private nearBuild(): boolean {
    return true
  }

  private nearCooking(): boolean {
    return this.cookingFireBuilt() && this.nearTileMetadata('cookingFire')
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

  private toolLevelKey(toolId: UpgradeableToolId): string {
    return `tool:${toolId}:level`
  }

  private toolLevel(toolId: UpgradeableToolId): number {
    const raw = this.state.flags[this.toolLevelKey(toolId)]
    const maxLevel = TOOL_UPGRADES[toolId][TOOL_UPGRADES[toolId].length - 1]?.level ?? 0
    return typeof raw === 'number' ? Math.max(0, Math.min(maxLevel, Math.floor(raw))) : 0
  }

  private toolName(toolId: UpgradeableToolId): string {
    const level = this.toolLevel(toolId)
    return TOOL_UPGRADES[toolId].find((upgrade) => upgrade.level === level)?.name ?? TOOL_BASE[toolId].name
  }

  private toolDamage(toolId: UpgradeableToolId): number {
    const level = this.toolLevel(toolId)
    return TOOL_UPGRADES[toolId].find((upgrade) => upgrade.level === level)?.damage ?? TOOL_BASE[toolId].damage
  }

  private nextToolUpgrade(toolId: UpgradeableToolId) {
    return TOOL_UPGRADES[toolId].find((upgrade) => upgrade.level === this.toolLevel(toolId) + 1) ?? null
  }

  private applyInitialUnlocks() {
    this.migrateCropContentIds()
    this.migrateSeenItems()
    this.state.flags[cropUnlockFlag(DEFAULT_FIELD_CROP)] = true
    const migratedKey = 'migration:initialFieldRows:v2'
    if (this.state.flags[migratedKey] !== true) {
      const firstRowsKey = this.fieldRowsKey('field_1')
      const otherFieldsLocked = FIELD_PLOTS.slice(1).every((plot) => this.fieldRows(plot.id) === 0)
      if (this.state.flags[firstRowsKey] === FIELD_SIZE && otherFieldsLocked) {
        this.state.flags[firstRowsKey] = 1
      }
      this.state.flags[migratedKey] = true
    }
  }

  private seenItemKey(itemId: string): string {
    return `seen:item:${itemId}`
  }

  private itemSeen(itemId: string): boolean {
    return this.state.flags[this.seenItemKey(itemId)] === true
  }

  private markItemSeen(itemId: string) {
    if (!getItem(itemId)) return
    const wasSeen = this.itemSeen(itemId)
    this.state.flags[this.seenItemKey(itemId)] = true
    if (itemId === 'toast' && !wasSeen) this.applyMineState(true)
  }

  private mineUnlocked(): boolean {
    return this.itemSeen('toast')
  }

  private applyMineState(force = false) {
    const active = this.mineUnlocked()
    const key = 'mine:stampedActive:v3'
    if (!force && this.state.flags[key] === active && this.mineStampMatches(active)) return
    stampMine(this.state.tiles, active)
    stampBlacksmith(this.state.tiles, active)
    this.state.flags[key] = active
  }

  private mineStampMatches(active: boolean): boolean {
    let hasBoard = false
    let hasNode = false
    for (const t of this.state.tiles) {
      if (t.metadata.mineBoard === true) hasBoard = true
      if (t.metadata.mineNode === true) hasNode = true
    }
    return active ? hasNode && !hasBoard : hasBoard && !hasNode
  }

  private migrateSeenItems() {
    for (const slot of this.state.inventory) {
      if (slot.itemId) this.markItemSeen(slot.itemId)
    }
  }

  private migrateCropContentIds() {
    const flags = this.state.flags
    if (flags[cropUnlockFlag('parsnip')] === true) flags[cropUnlockFlag('tomato')] = true
    if (flags[cropUnlockFlag('golden_pumpkin')] === true) flags[cropUnlockFlag('corn')] = true
    for (const plot of FIELD_PLOTS) {
      const key = this.fieldCropKey(plot.id)
      const raw = flags[key]
      if (typeof raw === 'string' && LEGACY_ID_MAP[raw]) flags[key] = LEGACY_ID_MAP[raw]
    }
    for (const t of this.state.tiles) {
      if (t.cropId && LEGACY_ID_MAP[t.cropId]) t.cropId = LEGACY_ID_MAP[t.cropId]
      const groundItemId = t.metadata.groundItemId
      if (typeof groundItemId === 'string' && LEGACY_ID_MAP[groundItemId]) {
        t.metadata.groundItemId = LEGACY_ID_MAP[groundItemId]
      }
    }
    for (const slot of this.state.inventory) {
      if (slot.itemId && LEGACY_ID_MAP[slot.itemId]) slot.itemId = LEGACY_ID_MAP[slot.itemId]
    }
    for (const job of this.state.cookQueue) {
      if (LEGACY_ID_MAP[job.recipeId]) job.recipeId = LEGACY_ID_MAP[job.recipeId]
    }
  }

  private cropUnlocked(cropId: string): boolean {
    return this.flagEnabled(cropUnlockFlag(cropId))
  }

  private cookingFireLevel(): number {
    if (!this.cookingFireBuilt()) return 0
    const raw = this.state.flags.cookingFireLevel
    return typeof raw === 'number'
      ? Math.max(1, Math.min(COOKING_FIRE_MAX_LEVEL, raw))
      : 1
  }

  private cookingSlots(level = this.cookingFireLevel()): number {
    if (level <= 0) return 0
    return COOKING_FIRE_BASE_SLOTS + (level - 1) * COOKING_FIRE_SLOTS_PER_LEVEL
  }

  private nextCookingFireUpgrade() {
    if (!this.cookingFireBuilt()) return null
    return COOKING_FIRE_UPGRADES.find((u) => u.level === this.cookingFireLevel() + 1) ?? null
  }

  private cookingFireBuilt(): boolean {
    return this.state.flags[COOKING_FIRE_BUILT_FLAG] === true
  }

  private recipeUnlocked(recipe: typeof RECIPES[number]): boolean {
    return recipe.inputs.every((input) => this.itemSeen(input.itemId))
  }

  private tutorialRewardKey(id: string): string {
    return `tutorialReward:${id}`
  }

  private tutorialRewardComplete(id: string): boolean {
    if (id === 'wood5') return this.countItem('wood') >= 5 || this.cookingFireBuilt()
    if (id === 'build_fire') return this.cookingFireBuilt()
    if (id === 'first_bread') return this.itemSeen('bread')
    if (id === 'first_toast') return this.itemSeen('toast')
    return false
  }

  private checkTutorialRewards() {
    if (!this.state || this.awardingTutorialReward) return
    this.awardingTutorialReward = true
    try {
      for (const reward of TUTORIAL_REWARDS) {
        const key = this.tutorialRewardKey(reward.id)
        if (this.state.flags[key] === true || !this.tutorialRewardComplete(reward.id)) continue
        this.state.flags[key] = true
        if (reward.rewardGold > 0) this.state.gold += reward.rewardGold
        for (const item of reward.rewardItems) this.giveItem(item.itemId, item.qty)
        this.toast(`${reward.title} 보상: ${reward.rewardText}`, 'good')
      }
    } finally {
      this.awardingTutorialReward = false
    }
  }

  private objectiveTasks(current: ObjectiveView | null = this.currentObjective()): ObjectiveTaskView[] {
    const currentKey = current ? `${current.title}:${current.detail}` : null
    return TUTORIAL_REWARDS.map((reward) => {
      const claimed = this.state.flags[this.tutorialRewardKey(reward.id)] === true
      const completed = claimed || this.tutorialRewardComplete(reward.id)
      const progress = reward.id === 'wood5'
        ? completed ? 5 : Math.min(5, this.countItem('wood'))
        : completed ? 1 : 0
      const max = reward.id === 'wood5' ? 5 : 1
      const taskKey = `${reward.title}:${reward.detail}`
      return {
        id: reward.id,
        title: reward.title,
        detail: reward.detail,
        progress,
        max,
        rewardText: reward.rewardText,
        completed,
        claimed,
        current: taskKey === currentKey,
      }
    })
  }

  private orderDayKey(): string {
    return 'dailyOrder:day'
  }

  private orderItemKey(): string {
    return 'dailyOrder:itemId'
  }

  private orderQtyKey(): string {
    return 'dailyOrder:qty'
  }

  private orderRewardKey(): string {
    return 'dailyOrder:rewardGold'
  }

  private orderCompletedKey(day: number): string {
    return `dailyOrder:completed:${day}`
  }

  private availableOrderPool() {
    return ORDER_ITEM_POOL.filter((order) => this.itemSeen(order.itemId))
  }

  private ensureDailyOrder() {
    if (this.state.flags[this.orderDayKey()] === this.state.day) return
    const pool = this.availableOrderPool()
    if (pool.length === 0) {
      this.state.flags[this.orderDayKey()] = this.state.day
      delete this.state.flags[this.orderItemKey()]
      delete this.state.flags[this.orderQtyKey()]
      delete this.state.flags[this.orderRewardKey()]
      return
    }
    const pick = pool[(this.state.day * 7 + pool.length * 3) % pool.length]
    const span = pick.maxQty - pick.minQty + 1
    const qty = pick.minQty + ((this.state.day * 5 + pick.itemId.length) % span)
    const item = getItem(pick.itemId)
    const rewardGold = Math.round((item?.sellPrice ?? 10) * qty * 1.35 + 25)
    this.state.flags[this.orderDayKey()] = this.state.day
    this.state.flags[this.orderItemKey()] = pick.itemId
    this.state.flags[this.orderQtyKey()] = qty
    this.state.flags[this.orderRewardKey()] = rewardGold
  }

  private currentOrder(): OrderView | null {
    this.ensureDailyOrder()
    const itemId = this.state.flags[this.orderItemKey()]
    const qty = this.state.flags[this.orderQtyKey()]
    const rewardGold = this.state.flags[this.orderRewardKey()]
    if (typeof itemId !== 'string' || typeof qty !== 'number' || typeof rewardGold !== 'number') return null
    const item = getItem(itemId)
    if (!item) return null
    const pool = ORDER_ITEM_POOL.find((order) => order.itemId === itemId)
    const have = this.countItem(itemId)
    const completed = this.state.flags[this.orderCompletedKey(this.state.day)] === true
    return {
      day: this.state.day,
      itemId,
      itemName: item.name,
      sprite: item.sprite,
      color: item.cropId ? CROPS[item.cropId].color : undefined,
      qty,
      have,
      rewardGold,
      hint: pool?.hint ?? '주문을 완료하면 다음 생산 목표를 잡기 쉬워요.',
      completed,
      canComplete: !completed && have >= qty,
    }
  }

  private catalogPrice(itemId: string): number {
    return SHOP_CATALOG.find((entry) => entry.itemId === itemId)?.buyPrice ?? 0
  }

  private currentObjective(): ObjectiveView | null {
    if (!this.cookingFireBuilt()) {
      const wood = this.countItem('wood')
      if (wood < 5) {
        return {
          title: '나무 5개 모으기',
          detail: '나무를 베어 화로 제작 재료를 준비하세요.',
          progress: wood,
          max: 5,
        }
      }
      return {
        title: '화로 제작하기',
        detail: '건설탭에서 나무 5개로 화로를 만드세요.',
        progress: 0,
        max: 1,
      }
    }
    if (!this.itemSeen('crop_wheat_normal')) {
      return {
        title: '밀 수확하기',
        detail: '처음 열린 밭에서 밀을 수확하세요.',
        progress: 0,
        max: 1,
      }
    }
    if (!this.itemSeen('flour')) {
      return {
        title: '밀가루 만들기',
        detail: '화로에서 밀 2개를 갈아 밀가루를 만드세요.',
        progress: Math.min(2, this.countItem('crop_wheat_normal')),
        max: 2,
      }
    }
    if (!this.itemSeen('bread')) {
      return {
        title: '빵 굽기',
        detail: '밀가루를 빵으로 구운 뒤 상점에서 팔아 돈을 모으세요.',
        progress: Math.min(1, this.countItem('flour')),
        max: 1,
      }
    }
    if (!this.flagEnabled('unlock:animal:chicken')) {
      const price = this.catalogPrice('permit_chicken')
      return {
        title: '닭장 구매하기',
        detail: '빵을 팔아 건설탭에서 닭장을 지으세요.',
        progress: Math.min(price, this.state.gold),
        max: price,
      }
    }
    const chickenFarm = ANIMAL_FARMS.find((farm) => farm.id === 'chicken')
    if (chickenFarm && this.animalCount(chickenFarm) <= 0) {
      const price = this.animalBuyPrice(chickenFarm)
      return {
        title: '닭 구매하기',
        detail: '상점에서 닭을 사면 달걀이 바닥에 떨어집니다.',
        progress: Math.min(price, this.state.gold),
        max: price,
      }
    }
    if (!this.itemSeen('egg')) {
      return {
        title: '달걀 줍기',
        detail: '닭장 안에 떨어진 달걀을 주워 토스트 재료를 여세요.',
        progress: 0,
        max: 1,
      }
    }
    if (!this.itemSeen('toast')) {
      return {
        title: '토스트 만들기',
        detail: '빵과 달걀로 토스트를 만들어 더 높은 가격에 파세요.',
        progress: Math.min(2, (this.countItem('bread') > 0 ? 1 : 0) + (this.countItem('egg') > 0 ? 1 : 0)),
        max: 2,
      }
    }
    if (!this.itemSeen('copper_ore')) {
      return {
        title: '광산에서 구리광석 캐기',
        detail: '동쪽 광산 구역의 구리 광맥을 곡괭이로 여러 번 타격하세요.',
        progress: Math.min(1, this.countItem('copper_ore')),
        max: 1,
      }
    }
    if (this.toolLevel('pickaxe') < 1) {
      const stone = Math.min(20, this.countItem('stone'))
      const copper = Math.min(8, this.countItem('copper_ore'))
      return {
        title: '구리 곡괭이 강화하기',
        detail: '광산 옆 대장간에서 돌 20개와 구리광석 8개로 곡괭이를 강화하세요.',
        progress: stone + copper,
        max: 28,
      }
    }
    if (!this.cropUnlocked('strawberry')) {
      const price = this.catalogPrice('seed_strawberry')
      return {
        title: '딸기 재배권 구매하기',
        detail: '토스트 수익으로 딸기 재배권을 여세요.',
        progress: Math.min(price, this.state.gold),
        max: price,
      }
    }
    if (!this.itemSeen('crop_strawberry_normal')) {
      return {
        title: '딸기 수확하기',
        detail: '밭 푯말에서 딸기로 바꾸고 첫 딸기를 수확하세요.',
        progress: 0,
        max: 1,
      }
    }
    if (!this.itemSeen('strawberry_jam')) {
      return {
        title: '딸기쨈 만들기',
        detail: '딸기 2개를 졸여 딸기쨈을 만드세요.',
        progress: Math.min(2, this.countItem('crop_strawberry_normal')),
        max: 2,
      }
    }
    if (!this.flagEnabled('unlock:dairy')) {
      const price = this.catalogPrice('permit_dairy')
      return {
        title: '젖소 농장 구매하기',
        detail: '우유와 버터가 열리면 딸기쨈 토스트를 만들 수 있습니다.',
        progress: Math.min(price, this.state.gold),
        max: price,
      }
    }
    const cowFarm = ANIMAL_FARMS.find((farm) => farm.id === 'cow')
    if (cowFarm && this.animalCount(cowFarm) <= 0) {
      const price = this.animalBuyPrice(cowFarm)
      return {
        title: '소 구매하기',
        detail: '상점에서 소를 사서 우유 생산을 시작하세요.',
        progress: Math.min(price, this.state.gold),
        max: price,
      }
    }
    if (!this.itemSeen('milk')) {
      return {
        title: '우유 줍기',
        detail: '젖소 농장 바닥에 떨어진 우유를 주우세요.',
        progress: 0,
        max: 1,
      }
    }
    if (!this.itemSeen('butter')) {
      return {
        title: '버터 만들기',
        detail: '우유 2개를 버터로 가공하세요.',
        progress: Math.min(2, this.countItem('milk')),
        max: 2,
      }
    }
    if (!this.itemSeen('strawberry_jam_toast')) {
      return {
        title: '딸기쨈 토스트 만들기',
        detail: '빵, 버터, 딸기쨈을 조합해 중반 핵심 상품을 만드세요.',
        progress: Math.min(3,
          (this.countItem('bread') > 0 ? 1 : 0) +
          (this.countItem('butter') > 0 ? 1 : 0) +
          (this.countItem('strawberry_jam') > 0 ? 1 : 0)),
        max: 3,
      }
    }
    if (!this.cropUnlocked('tomato')) {
      const price = this.catalogPrice('seed_tomato')
      return {
        title: '토마토 재배권 구매하기',
        detail: '피자 체인을 열어 판매 단가를 한 단계 올리세요.',
        progress: Math.min(price, this.state.gold),
        max: price,
      }
    }
    if (!this.itemSeen('crop_tomato_normal')) {
      return {
        title: '토마토 수확하기',
        detail: '밭 푯말에서 토마토로 바꾸고 첫 토마토를 수확하세요.',
        progress: 0,
        max: 1,
      }
    }
    if (!this.itemSeen('tomato_sauce')) {
      return {
        title: '토마토소스 만들기',
        detail: '토마토 2개를 졸여 피자 재료를 준비하세요.',
        progress: Math.min(2, this.countItem('crop_tomato_normal')),
        max: 2,
      }
    }
    if (!this.itemSeen('cheese')) {
      return {
        title: '치즈 만들기',
        detail: '우유 2개를 숙성해 피자에 들어갈 치즈를 만드세요.',
        progress: Math.min(2, this.countItem('milk')),
        max: 2,
      }
    }
    if (!this.itemSeen('pizza')) {
      return {
        title: '피자 만들기',
        detail: '토마토소스, 밀가루, 치즈로 피자를 구우세요.',
        progress: Math.min(3,
          (this.countItem('flour') > 0 ? 1 : 0) +
          (this.countItem('tomato_sauce') > 0 ? 1 : 0) +
          (this.countItem('cheese') > 0 ? 1 : 0)),
        max: 3,
      }
    }
    if (!this.cropUnlocked('corn')) {
      const price = this.catalogPrice('seed_corn')
      return {
        title: '옥수수 재배권 구매하기',
        detail: '옥수수로 후반 피자와 버터옥수수 라인을 여세요.',
        progress: Math.min(price, this.state.gold),
        max: price,
      }
    }
    if (!this.itemSeen('crop_corn_normal')) {
      return {
        title: '옥수수 수확하기',
        detail: '밭 푯말에서 옥수수로 바꾸고 첫 옥수수를 수확하세요.',
        progress: 0,
        max: 1,
      }
    }
    if (!this.itemSeen('corn_pizza')) {
      return {
        title: '콘치즈 피자 만들기',
        detail: '옥수수와 피자 재료를 조합해 후반 판매품을 만드세요.',
        progress: Math.min(4,
          (this.countItem('flour') > 0 ? 1 : 0) +
          (this.countItem('tomato_sauce') > 0 ? 1 : 0) +
          (this.countItem('cheese') > 0 ? 1 : 0) +
          (this.countItem('crop_corn_normal') > 0 ? 1 : 0)),
        max: 4,
      }
    }
    return {
      title: '농장 확장하기',
      detail: '밭, 동물, 화로 업그레이드를 늘려 생산량을 키우세요.',
      progress: this.state.gold,
      max: Math.max(1, this.state.gold),
    }
  }

  private animalFarmOwned(farm: AnimalFarmDef): boolean {
    return this.flagEnabled(farm.unlockFlag)
  }

  private isAnimalPermitEntry(entry: { grantsFlag?: string }): boolean {
    return !!entry.grantsFlag && ANIMAL_FARMS.some((farm) => farm.unlockFlag === entry.grantsFlag)
  }

  private animalCountKey(farmId: string): string {
    return `animalCount:${farmId}`
  }

  private animalDropKey(farmId: string): string {
    return `animalDropT:${farmId}`
  }

  private animalUpgradeKey(upgradeId: string): string {
    return `animalUpgrade:${upgradeId}`
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

  private animalUpgradeLevel(upgrade: AnimalUpgradeDef): number {
    const raw = this.state.flags[this.animalUpgradeKey(upgrade.id)]
    return typeof raw === 'number'
      ? Math.max(0, Math.min(upgrade.maxLevel, Math.floor(raw)))
      : 0
  }

  private animalUpgradePrice(upgrade: AnimalUpgradeDef): number {
    return upgrade.basePrice + this.animalUpgradeLevel(upgrade) * upgrade.priceStep
  }

  private farmUpgradeLevel(farm: AnimalFarmDef, kind: AnimalUpgradeDef['kind']): number {
    const upgrade = ANIMAL_UPGRADES.find((u) => u.farmId === farm.id && u.kind === kind)
    return upgrade ? this.animalUpgradeLevel(upgrade) : 0
  }

  private animalDropSeconds(farm: AnimalFarmDef): number {
    const speedLevel = this.farmUpgradeLevel(farm, 'speed')
    return Math.max(2, Math.round(farm.dropSeconds * (1 - speedLevel * 0.15) * 10) / 10)
  }

  private animalProductQty(farm: AnimalFarmDef): number {
    const yieldLevel = this.farmUpgradeLevel(farm, 'yield')
    const chance = [0, 0.25, 0.45, 0.65][yieldLevel] ?? 0
    let qty = farm.productQty
    if (Math.random() < chance) qty += 1
    if (yieldLevel >= 3 && Math.random() < 0.15) qty += 1
    return qty
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
      t.metadata.groundItemQty = this.animalProductQty(farm)
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
      const dropSeconds = this.animalDropSeconds(farm)
      if (elapsed < dropSeconds) {
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

  private unlockedFieldRowsTotal(): number {
    return FIELD_PLOTS.reduce((sum, plot) => sum + this.fieldRows(plot.id), 0)
  }

  private fieldExpansionStep(): number {
    return Math.max(0, this.unlockedFieldRowsTotal() - 1)
  }

  private fieldRowCostGold(step = this.fieldExpansionStep()): number {
    return FIELD_ROW_BASE_GOLD + step * FIELD_ROW_GOLD_STEP
  }

  private fieldRowCostWood(step = this.fieldExpansionStep()): number {
    return FIELD_ROW_BASE_WOOD + step * FIELD_ROW_WOOD_STEP
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
      if (this.isMineResource(t.obstacle) && t.metadata.mineNode !== true) {
        t.obstacle = null
        t.hp = undefined
      }
      const respawnKind = t.metadata.respawnKind
      if (typeof respawnKind === 'string' && this.isMineResource(respawnKind) && t.metadata.mineNode !== true) {
        delete t.metadata.respawnAt
        delete t.metadata.respawnKind
      }
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

  private isMineResource(kind: unknown): kind is 'rock' | 'copper_ore' | 'iron_ore' {
    return kind === 'rock' || kind === 'copper_ore' || kind === 'iron_ore'
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
      delete t.metadata.animalFence
      delete t.metadata.animalFenceAxis
      delete t.metadata.animalFenceKind
      delete t.metadata.animalFenceRot
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
          delete t.metadata.animalFence
          delete t.metadata.animalFenceAxis
          delete t.metadata.animalFenceKind
          delete t.metadata.animalFenceRot
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
          if (edge && !gate) {
            const left = x === farm.x
            const right = x === farm.x + farm.w - 1
            const top = y === farm.y
            const bottom = y === farm.y + farm.h - 1
            t.metadata.animalFence = true
            if ((left || right) && (top || bottom)) {
              // Corner: rotation by corner (CW from top-left).
              t.metadata.animalFenceKind = 'corner'
              t.metadata.animalFenceRot = top && left ? 0 : top && right ? 1 : bottom && right ? 2 : 3
            } else {
              // Straight: top=0, right=1, bottom=2, left=3.
              t.metadata.animalFenceKind = 'straight'
              t.metadata.animalFenceRot = top ? 0 : right ? 1 : bottom ? 2 : 3
            }
          } else {
            delete t.metadata.animalFence
            delete t.metadata.animalFenceAxis
            delete t.metadata.animalFenceKind
            delete t.metadata.animalFenceRot
          }
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
  unstuckPlayer() {
    if (this.phase !== 'playing') return
    this.state.player.x = LOCATIONS.spawn.x * T + T / 2
    this.state.player.y = LOCATIONS.spawn.y * T + T
    this.state.player.moving = false
    this.target = null
    this.workTile = null
    this.stuckT = 0
    this.jumpT = 0
    this.toast('안전한 위치로 이동했어요.', 'good')
    this.autosave()
    this.emit()
  }
  grantTestItem(itemId: string, qty = 10) {
    if (this.phase !== 'playing') return
    const item = getItem(itemId)
    if (!item) return
    const added = this.giveItem(itemId, qty)
    this.toast(`${item.name} ${added}개 추가`, added > 0 ? 'good' : 'bad')
    this.autosave()
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
    // Tent (player home): 48×48 canvas over the 30–32 × 7–8 footprint,
    // base resting on the front (row 9) where the bed/spawn sits.
    this.drawBuilding(this.sprites.farmhouse, 30, 7, S, -16)
    this.drawBuilding(this.sprites.store, 22, 6, S, -14)
    this.drawAnimalFarms(S)
    this.drawFieldSigns(S)
    this.drawCookingFire(S)
    this.drawMineEntrance(S)
    this.drawBlacksmith(S)

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
    draws.push({ y: this.orderNpcPosition().y, fn: () => this.drawOrderNpc(S) })
    if (this.mineUnlocked()) {
      const smith = this.blacksmithNpcPosition()
      draws.push({ y: smith.y, fn: () => this.drawBlacksmithNpc(S) })
    }
    draws.push({ y: p.y, fn: () => this.drawHuman(this.sprites.farmer, p.x, p.y, p.dir, p.moving, p.exhausted, p.animTime) })
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
    else if (t.terrain === 'blocked') {
      this.ctx.drawImage(this.sprites.grass[(t.x * 7 + t.y * 13) % 3], dx, dy, sz, sz)
      if (t.metadata.invisibleBlock === true) return
      if (t.metadata.animalFence === true) {
        // Small animal-pen fence: pick straight/corner piece and rotate it.
        const piece = t.metadata.animalFenceKind === 'corner' ? this.sprites.fenceCorner : this.sprites.fenceSmall
        const rot = typeof t.metadata.animalFenceRot === 'number' ? t.metadata.animalFenceRot : 0
        if (rot === 0) {
          this.ctx.drawImage(piece, dx, dy, sz, sz)
        } else {
          this.ctx.save()
          this.ctx.translate(dx + sz / 2, dy + sz / 2)
          this.ctx.rotate((rot * Math.PI) / 2)
          this.ctx.drawImage(piece, -sz / 2, -sz / 2, sz, sz)
          this.ctx.restore()
        }
        return
      }
      img = this.sprites.fence
    }
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

  private orderNpcPosition(): { x: number; y: number; dir: Direction } {
    const t = this.nowSecs()
    const dx = Math.sin(t * 0.35) * 7
    const dy = Math.sin(t * 0.22 + 1.4) * 4
    const dir: Direction = Math.abs(dx) > Math.abs(dy)
      ? (dx >= 0 ? 'right' : 'left')
      : (dy >= 0 ? 'down' : 'up')
    return {
      x: ORDER_NPC.x * T + T / 2 + dx,
      y: ORDER_NPC.y * T + T + dy,
      dir,
    }
  }

  private drawOrderNpc(S: number) {
    const npc = this.orderNpcPosition()
    const x = npc.x
    const y = npc.y
    this.drawHuman(this.sprites.barnaby, x, y, npc.dir, true, false, this.nowSecs(), false)
    const order = this.currentOrder()
    if (!order || order.completed) return
    const ctx = this.ctx
    const sx = this.wx(x - 4)
    const sy = this.wy(y - 30)
    ctx.fillStyle = '#fff4c8'
    ctx.strokeStyle = '#8a5a32'
    ctx.lineWidth = Math.max(1, S)
    ctx.beginPath()
    ctx.arc(sx, sy, 5 * S, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#a6791f'
    ctx.font = `${7 * S}px monospace`
    ctx.textAlign = 'center'
    ctx.fillText('!', sx, sy + 3 * S)
    ctx.textAlign = 'left'
  }

  private blacksmithNpcPosition(): { x: number; y: number; dir: Direction } {
    const t = this.nowSecs()
    const dx = Math.sin(t * 0.18 + 0.6) * 4
    const dy = Math.sin(t * 0.15 + 2.2) * 3
    const dir: Direction = Math.abs(dx) > Math.abs(dy)
      ? (dx >= 0 ? 'right' : 'left')
      : (dy >= 0 ? 'down' : 'up')
    return {
      x: BLACKSMITH_NPC.x * T + T / 2 + dx,
      y: BLACKSMITH_NPC.y * T + T + dy,
      dir,
    }
  }

  private drawBlacksmithNpc(S: number) {
    const npc = this.blacksmithNpcPosition()
    this.drawHuman(this.sprites.barnaby, npc.x, npc.y, npc.dir, true, false, this.nowSecs() + 1.4, false)
    const ctx = this.ctx
    const sx = this.wx(npc.x + 5)
    const sy = this.wy(npc.y - 17)
    ctx.fillStyle = '#4c3a33'
    ctx.fillRect(sx, sy, 6 * S, 6 * S)
    ctx.fillStyle = '#d6d0c2'
    ctx.fillRect(sx + 1 * S, sy + 1 * S, 4 * S, 2 * S)
    ctx.fillStyle = '#2a2a30'
    ctx.fillRect(sx + 2 * S, sy + 3 * S, 2 * S, 2 * S)
  }

  private drawAnimalFarms(S: number) {
    const ctx = this.ctx
    for (const farm of ANIMAL_FARMS) {
      if (!this.animalFarmOwned(farm)) continue
      const x = this.wx((farm.x + 1) * T)
      const y = this.wy((farm.y + 1) * T)
      // Small barn/coop: pitched roof, plank wall, door.
      ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(x + 1 * S, y + 16 * S, 20 * S, 3 * S)
      ctx.fillStyle = '#c4763f'; ctx.fillRect(x + 2 * S, y + 8 * S, 18 * S, 9 * S) // wall
      ctx.fillStyle = '#d98a4e'; ctx.fillRect(x + 2 * S, y + 8 * S, 18 * S, 2 * S)
      ctx.fillStyle = 'rgba(120,70,40,0.25)'
      for (let i = 4; i < 20; i += 4) ctx.fillRect(x + i * S, y + 8 * S, 1 * S, 9 * S) // planks
      ctx.fillStyle = '#8a3f30'; ctx.fillRect(x + 0 * S, y + 4 * S, 22 * S, 5 * S) // roof
      ctx.fillStyle = '#a04c3a'; ctx.fillRect(x + 0 * S, y + 4 * S, 22 * S, 2 * S)
      ctx.fillStyle = '#6e4426'; ctx.fillRect(x + 8 * S, y + 11 * S, 6 * S, 6 * S) // door
      ctx.fillStyle = '#8a5a32'; ctx.fillRect(x + 8 * S, y + 11 * S, 6 * S, 1 * S)
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
    const bob = Math.round(Math.sin(performance.now() / 360 + x) * 0.5) * S
    const sx = this.wx(x)
    const sy = this.wy(y) + bob
    // Soft contact shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.16)'
    ctx.fillRect(sx - 5 * S, sy + 6 * S, 11 * S, 2 * S)
    if (farm.id === 'chicken') {
      ctx.fillStyle = '#3a2a24'
      ctx.fillRect(sx - 3 * S, sy + 4 * S, 1 * S, 2 * S); ctx.fillRect(sx + 1 * S, sy + 4 * S, 1 * S, 2 * S)
      ctx.fillStyle = farm.color; ctx.fillRect(sx - 4 * S, sy - 1 * S, 7 * S, 5 * S)
      ctx.fillStyle = '#fff4cf'; ctx.fillRect(sx - 4 * S, sy - 1 * S, 7 * S, 2 * S)
      ctx.fillStyle = farm.color; ctx.fillRect(sx - 1 * S, sy - 5 * S, 4 * S, 4 * S)
      ctx.fillStyle = '#e05a36'; ctx.fillRect(sx, sy - 7 * S, 2 * S, 2 * S)
      ctx.fillStyle = '#e7a32f'; ctx.fillRect(sx + 3 * S, sy - 3 * S, 2 * S, 1 * S)
      ctx.fillStyle = '#2a2230'; ctx.fillRect(sx + 1 * S, sy - 4 * S, 1 * S, 1 * S)
    } else if (farm.id === 'cow') {
      ctx.fillStyle = '#3a2a24'
      ctx.fillRect(sx - 5 * S, sy + 5 * S, 1 * S, 3 * S); ctx.fillRect(sx + 2 * S, sy + 5 * S, 1 * S, 3 * S)
      ctx.fillStyle = farm.color; ctx.fillRect(sx - 6 * S, sy - 1 * S, 11 * S, 6 * S)
      ctx.fillStyle = '#fffaf0'; ctx.fillRect(sx - 6 * S, sy - 1 * S, 11 * S, 2 * S)
      ctx.fillStyle = '#cfc6b6'; ctx.fillRect(sx - 6 * S, sy + 4 * S, 11 * S, 1 * S)
      ctx.fillStyle = '#3a2a24'; ctx.fillRect(sx - 4 * S, sy, 3 * S, 3 * S)
      ctx.fillStyle = farm.color; ctx.fillRect(sx + 2 * S, sy - 4 * S, 5 * S, 5 * S)
      ctx.fillStyle = '#e8a0a8'; ctx.fillRect(sx + 6 * S, sy - 1 * S, 2 * S, 2 * S)
      ctx.fillStyle = '#fffaf0'; ctx.fillRect(sx + 1 * S, sy - 5 * S, 1 * S, 2 * S)
      ctx.fillStyle = '#2a2230'; ctx.fillRect(sx + 4 * S, sy - 3 * S, 1 * S, 1 * S)
    } else {
      ctx.fillStyle = '#3a2a24'
      ctx.fillRect(sx - 5 * S, sy + 5 * S, 1 * S, 3 * S); ctx.fillRect(sx + 2 * S, sy + 5 * S, 1 * S, 3 * S)
      ctx.fillStyle = farm.color; ctx.fillRect(sx - 6 * S, sy - 1 * S, 11 * S, 6 * S)
      ctx.fillStyle = '#f6c0cb'; ctx.fillRect(sx - 6 * S, sy - 1 * S, 11 * S, 2 * S)
      ctx.fillStyle = '#c96d82'; ctx.fillRect(sx - 6 * S, sy + 4 * S, 11 * S, 1 * S)
      ctx.fillStyle = farm.color; ctx.fillRect(sx + 2 * S, sy - 3 * S, 5 * S, 5 * S)
      ctx.fillStyle = '#d98699'; ctx.fillRect(sx + 2 * S, sy - 4 * S, 2 * S, 2 * S)
      ctx.fillStyle = '#c96d82'; ctx.fillRect(sx + 6 * S, sy - 1 * S, 2 * S, 3 * S)
      ctx.fillStyle = '#8f3f52'; ctx.fillRect(sx + 6 * S, sy, 1 * S, 1 * S); ctx.fillRect(sx + 7 * S, sy, 1 * S, 1 * S)
      ctx.fillStyle = '#2a2230'; ctx.fillRect(sx + 4 * S, sy - 2 * S, 1 * S, 1 * S)
    }
  }

  private drawCookingFire(S: number) {
    if (!this.cookingFireBuilt()) return
    const ctx = this.ctx
    const x = this.wx(LOCATIONS.cookingFire.x * T)
    const y = this.wy(LOCATIONS.cookingFire.y * T)
    const now = performance.now() / 1000
    // Ground shadow + warm glow.
    ctx.fillStyle = 'rgba(0,0,0,0.16)'
    ctx.fillRect(x + 4 * S, y + 26 * S, 24 * S, 4 * S)
    ctx.fillStyle = 'rgba(240,150,60,0.10)'
    ctx.fillRect(x + 2 * S, y + 10 * S, 28 * S, 18 * S)
    // Stone ring.
    const stones: [number, number][] = [
      [3, 22], [7, 25], [13, 26], [19, 25], [24, 22], [25, 16], [3, 16],
    ]
    for (const [sx, sy] of stones) {
      ctx.fillStyle = '#8b8f99'; ctx.fillRect(x + sx * S, y + sy * S, 6 * S, 5 * S)
      ctx.fillStyle = '#a7abb5'; ctx.fillRect(x + sx * S, y + sy * S, 6 * S, 2 * S)
      ctx.fillStyle = '#6e727c'; ctx.fillRect(x + sx * S, y + (sy + 4) * S, 6 * S, 1 * S)
    }
    // Crossed logs.
    ctx.fillStyle = '#6e4426'; ctx.fillRect(x + 8 * S, y + 20 * S, 16 * S, 3 * S)
    ctx.fillStyle = '#8a5a32'; ctx.fillRect(x + 9 * S, y + 18 * S, 14 * S, 3 * S)
    ctx.fillStyle = '#a8743f'; ctx.fillRect(x + 10 * S, y + 18 * S, 3 * S, 1 * S)
    // Flickering flames.
    const f = Math.sin(now * 9) * 1.2
    ctx.fillStyle = '#e0532f'; ctx.fillRect(x + 10 * S, y + 12 * S, 12 * S, 9 * S)
    ctx.fillStyle = '#f0902f'; ctx.fillRect(x + (12 - f) * S, y + 9 * S, 8 * S, 11 * S)
    ctx.fillStyle = '#f7c63b'; ctx.fillRect(x + 14 * S, y + (8 + f) * S, 4 * S, 11 * S)
    ctx.fillStyle = '#fff0a6'; ctx.fillRect(x + 15 * S, y + 10 * S, 2 * S, 6 * S)
    // Rising embers.
    ctx.fillStyle = '#ffd27a'
    for (let i = 0; i < 3; i++) {
      const ey = (now * 20 + i * 7) % 16
      ctx.fillRect(x + (12 + i * 4) * S, y + (14 - ey) * S, 1 * S, 1 * S)
    }
  }

  private drawObstacle(t: Tile, S: number) {
    let img: HTMLCanvasElement | null
    let yOff = 0
    switch (t.obstacle) {
      case 'tree': img = this.sprites.tree; yOff = -14; break
      case 'stump': img = this.sprites.stump; break
      case 'large_stump': img = this.sprites.largeStump; yOff = -4; break
      case 'rock': img = this.sprites.rock; break
      case 'copper_ore': img = this.sprites.copperOre; break
      case 'iron_ore': img = this.sprites.ironOre; break
      case 'weed': img = this.sprites.weed; break
      case 'flower': img = this.sprites.flower; break
      default: img = null
    }
    if (!img) return
    this.ctx.drawImage(img, this.wx(t.x * T), this.wy(t.y * T + yOff), img.width * S, img.height * S)
    if (t.hp != null && t.obstacle && t.hp < OBSTACLE_HP[t.obstacle]) {
      this.drawHpBar(t.x, t.y, t.hp, OBSTACLE_HP[t.obstacle], S)
    }
  }

  private drawCrop(t: Tile, S: number) {
    if (!t.cropId) return
    const frames = this.sprites.crops[t.cropId]
    const img = frames[Math.min(t.growthStage, frames.length - 1)]
    this.ctx.drawImage(img, this.wx(t.x * T), this.wy(t.y * T), T * S, T * S)
    const crop = CROPS[t.cropId]
    if (crop && t.growthStage >= crop.stages - 1 && typeof t.metadata.harvestHp === 'number') {
      this.drawHpBar(t.x, t.y, t.metadata.harvestHp, this.cropHarvestHp(crop.id), S)
    }
  }

  private drawHpBar(tx: number, ty: number, hp: number, maxHp: number, S: number) {
    const ctx = this.ctx
    const x = this.wx(tx * T + 3)
    const y = this.wy(ty * T + 1)
    const w = 10 * S
    const h = Math.max(2, 2 * S)
    ctx.fillStyle = 'rgba(30,24,20,0.55)'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#e05a36'
    ctx.fillRect(x, y, Math.max(0, Math.min(w, w * (hp / Math.max(1, maxHp)))), h)
  }

  private drawMineEntrance(S: number) {
    const ctx = this.ctx
    const x = this.wx(45 * T)
    const y = this.wy(4 * T)
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(x + 4 * S, y + 48 * S, 104 * S, 8 * S)
    ctx.fillStyle = '#6f6b60'
    ctx.fillRect(x + 4 * S, y + 20 * S, 104 * S, 36 * S)
    ctx.fillStyle = '#8b8678'
    ctx.fillRect(x + 10 * S, y + 12 * S, 92 * S, 14 * S)
    ctx.fillStyle = '#3a3432'
    ctx.fillRect(x + 34 * S, y + 24 * S, 40 * S, 32 * S)
    ctx.fillStyle = '#201c20'
    ctx.fillRect(x + 42 * S, y + 32 * S, 24 * S, 24 * S)
    ctx.fillStyle = '#a59b86'
    ctx.fillRect(x + 14 * S, y + 24 * S, 10 * S, 6 * S)
    ctx.fillRect(x + 86 * S, y + 30 * S, 9 * S, 5 * S)
    if (!this.mineUnlocked()) {
      ctx.fillStyle = '#6e4426'
      ctx.fillRect(x + 38 * S, y + 35 * S, 32 * S, 5 * S)
      ctx.fillRect(x + 36 * S, y + 45 * S, 36 * S, 5 * S)
      ctx.fillStyle = '#9a6a3a'
      ctx.fillRect(x + 38 * S, y + 35 * S, 32 * S, 2 * S)
      ctx.fillRect(x + 36 * S, y + 45 * S, 36 * S, 2 * S)
      ctx.fillStyle = '#52331d'
      ctx.fillRect(x + 49 * S, y + 33 * S, 4 * S, 20 * S)
    }
  }

  private drawBlacksmith(S: number) {
    if (!this.mineUnlocked()) return
    const ctx = this.ctx
    const x = this.wx(LOCATIONS.blacksmith.x * T)
    const y = this.wy(LOCATIONS.blacksmith.y * T - 14)
    ctx.fillStyle = 'rgba(0,0,0,0.17)'
    ctx.fillRect(x + 5 * S, y + 58 * S, 70 * S, 7 * S)
    ctx.fillStyle = '#5b4b42'
    ctx.fillRect(x + 5 * S, y + 23 * S, 70 * S, 38 * S)
    ctx.fillStyle = '#746055'
    ctx.fillRect(x + 8 * S, y + 26 * S, 64 * S, 5 * S)
    ctx.fillStyle = '#3d3330'
    ctx.fillRect(x + 19 * S, y + 38 * S, 16 * S, 23 * S)
    ctx.fillStyle = '#242026'
    ctx.fillRect(x + 23 * S, y + 43 * S, 8 * S, 18 * S)
    ctx.fillStyle = '#a95432'
    ctx.fillRect(x + 46 * S, y + 40 * S, 17 * S, 13 * S)
    ctx.fillStyle = '#f0912e'
    ctx.fillRect(x + 49 * S, y + 43 * S, 11 * S, 7 * S)
    ctx.fillStyle = '#ffd05c'
    ctx.fillRect(x + 52 * S, y + 44 * S, 5 * S, 5 * S)
    ctx.fillStyle = '#3f3532'
    ctx.fillRect(x + 56 * S, y + 7 * S, 10 * S, 23 * S)
    ctx.fillStyle = '#211c20'
    ctx.fillRect(x + 58 * S, y + 5 * S, 6 * S, 4 * S)
    ctx.fillStyle = '#4d403b'
    ctx.fillRect(x + 2 * S, y + 20 * S, 76 * S, 7 * S)
    ctx.fillStyle = '#6d5a50'
    ctx.fillRect(x + 8 * S, y + 14 * S, 64 * S, 8 * S)
    ctx.fillStyle = '#8b6a4d'
    ctx.fillRect(x + 16 * S, y + 10 * S, 48 * S, 7 * S)
    ctx.fillStyle = '#2e2930'
    ctx.fillRect(x + 48 * S, y + 57 * S, 16 * S, 4 * S)
  }

  private drawHuman(
    sheet: Record<string, HTMLCanvasElement>,
    x: number,
    y: number,
    dir: string,
    moving: boolean,
    exhausted: boolean,
    animTime: number,
    playerMotion = true,
  ) {
    const S = this.scale
    let frame = 0
    if (moving) frame = Math.floor(animTime * 10) % 2 === 0 ? 1 : 2
    const img = sheet[`${dir}_${frame}`] ?? sheet['down_0']
    const walkBob = moving ? Math.abs(Math.sin(animTime * 18)) * 1.2 : 0
    const jump = playerMotion && this.jumpT > 0 ? Math.sin((this.jumpT / 0.22) * Math.PI) * 7 : 0
    const work = playerMotion && this.workAnimT > 0 ? Math.sin((this.workAnimT / 0.28) * Math.PI) : 0
    const drawY = y - 22 + 2 - walkBob - jump - work * 1.5
    this.ctx.drawImage(img, this.wx(x - 8), this.wy(drawY), 16 * S, 22 * S)
    if (playerMotion && work > 0) this.drawWorkPose(x, drawY, dir, work, S, this.currentWorkTool())
    if (exhausted) {
      const t = performance.now() / 300
      this.ctx.fillStyle = '#9fd0ff'
      this.ctx.fillRect(this.wx(x + 5), this.wy(drawY + 2 + Math.sin(t) * 2), 2 * S, 3 * S)
      if (playerMotion) this.drawExhaustBubble(x, drawY, S)
    }
  }

  private drawExhaustBubble(x: number, y: number, S: number) {
    const ctx = this.ctx
    const text = '피곤해.. 잠을 자야해'
    ctx.save()
    ctx.font = `${Math.max(10, 7 * S)}px sans-serif`
    ctx.textBaseline = 'middle'
    const padX = 6 * S
    const w = Math.ceil(ctx.measureText(text).width + padX * 2)
    const h = 16 * S
    const sx = Math.max(4 * S, Math.min(this.canvas.width - w - 4 * S, this.wx(x) - w / 2))
    const sy = Math.max(4 * S, this.wy(y - 24) - h)
    ctx.fillStyle = '#fff4d6'
    ctx.fillRect(sx, sy, w, h)
    const tailX = Math.max(sx + 10 * S, Math.min(sx + w - 10 * S, this.wx(x)))
    ctx.beginPath()
    ctx.moveTo(tailX - 4 * S, sy + h - 1 * S)
    ctx.lineTo(tailX + 4 * S, sy + h - 1 * S)
    ctx.lineTo(tailX, sy + h + 5 * S)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#4b3427'
    ctx.fillText(text, sx + padX, sy + h / 2 + 0.5 * S)
    ctx.restore()
  }

  private currentWorkTool(): UpgradeableToolId {
    const w = this.workTile
    if (!w || !inBounds(w.x, w.y)) return 'scythe'
    const ob = this.state.tiles[idx(w.x, w.y)].obstacle
    return ob === 'rock' || ob === 'copper_ore' || ob === 'iron_ore' ? 'pickaxe' : 'scythe'
  }

  private drawWorkPose(x: number, y: number, dir: string, t: number, S: number, tool: UpgradeableToolId) {
    const ctx = this.ctx
    const sx = this.wx(x)
    const sy = this.wy(y)
    // Hand pivot: the player's right hand, except when facing left it mirrors.
    const mirror = dir === 'left' ? -1 : 1
    const hx = sx + mirror * 4 * S
    const hy = sy + 14 * S
    const ang = mirror * (-0.5 + t * 2.0) // raise → chop forward

    ctx.save()
    ctx.translate(hx, hy)
    ctx.scale(mirror, 1)
    ctx.rotate(mirror * ang)
    // Hand gripping the snath.
    ctx.fillStyle = '#f0c79a'
    ctx.fillRect(-2 * S, -2 * S, 4 * S, 4 * S)
    // Short wooden handle pointing up from the hand.
    ctx.fillStyle = '#9a6a3a'
    ctx.fillRect(-1 * S, -10 * S, 2 * S, 10 * S)
    ctx.fillStyle = '#7a5230'
    ctx.fillRect(-1 * S, -10 * S, 1 * S, 10 * S)
    ctx.fillStyle = '#cfd3dc'
    if (tool === 'pickaxe') {
      ctx.fillRect(-5 * S, -12 * S, 10 * S, 2 * S)
      ctx.fillStyle = '#eef0f6'
      ctx.fillRect(-5 * S, -12 * S, 10 * S, 1 * S)
      ctx.fillStyle = '#aeb2bc'
      ctx.fillRect(-5 * S, -10 * S, 2 * S, 3 * S)
      ctx.fillRect(3 * S, -10 * S, 2 * S, 3 * S)
    } else {
      ctx.fillRect(0, -11 * S, 4 * S, 2 * S)
      ctx.fillStyle = '#eef0f6'
      ctx.fillRect(0, -11 * S, 4 * S, 1 * S)
      ctx.fillStyle = '#aeb2bc'
      ctx.fillRect(3 * S, -11 * S, 2 * S, 3 * S)
    }
    ctx.restore()
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
      this.glowRect(31 * T, 6 * T + 10, '#ffd65c', S)
      this.glowRect(24 * T + 6, 6 * T + 8, '#ffd07a', S)
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

  private glowRect(wx: number, wy: number, color: string, S: number) {
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
        buildOptions: [], buildPermits: [], toolUpgrades: [], fieldPlots: [], cropChoices: [], selectedFieldId: null, cookRecipes: [],
        cookQueue: [],
        cookingFire: {
          built: false,
          level: 0,
          maxLevel: COOKING_FIRE_MAX_LEVEL,
          slots: 0,
          usedSlots: 0,
          nextSlots: COOKING_FIRE_BASE_SLOTS,
          costGold: 0,
          costItems: [],
          canUpgrade: false,
        },
        objective: null,
        objectives: [],
        order: null,
        contextAction: null, contextActionId: null, contextActions: [], nearBed: false, nearStore: false, nearBuild: false, nearCooking: false, exhausted: false,
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
      if (this.isAnimalPermitEntry(e)) return false
      if (e.grantsFlag && this.flagEnabled(e.grantsFlag)) return false
      if (e.animalUpgradeId) {
        const upgrade = ANIMAL_UPGRADES.find((u) => u.id === e.animalUpgradeId)
        if (!upgrade || this.animalUpgradeLevel(upgrade) >= upgrade.maxLevel) return false
      }
      return true
    }).map((e) => {
      const def = getItem(e.itemId)!
      const farm = e.animalFarmId ? ANIMAL_FARMS.find((f) => f.id === e.animalFarmId) : null
      const upgrade = e.animalUpgradeId ? ANIMAL_UPGRADES.find((u) => u.id === e.animalUpgradeId) : null
      const price = farm ? this.animalBuyPrice(farm) : upgrade ? this.animalUpgradePrice(upgrade) : (e.buyPrice ?? 0)
      const animalCount = farm ? this.animalCount(farm) : 0
      const ownedText = farm
        ? ` 보유 ${animalCount}/${ANIMAL_FARM_MAX_ANIMALS}마리 · ${this.animalDropSeconds(farm)}초마다 생산`
        : ''
      const upgradeText = upgrade
        ? ` ${upgrade.levelDesc} · Lv.${this.animalUpgradeLevel(upgrade)}/${upgrade.maxLevel}`
        : ''
      return {
        itemId: e.itemId,
        name: def.name,
        price,
        affordable: s.gold >= price && (!farm || animalCount < ANIMAL_FARM_MAX_ANIMALS),
        sprite: def.sprite,
        color: def.cropId ? CROPS[def.cropId].color : undefined,
        desc: `${def.description}${ownedText}${upgradeText}`,
        owned: !!upgrade && this.animalUpgradeLevel(upgrade) >= upgrade.maxLevel,
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
    const buildPermits: BuildPermitView[] = SHOP_CATALOG.filter((e) =>
      this.isAnimalPermitEntry(e),
    ).map((e) => {
      const def = getItem(e.itemId)!
      const built = this.flagEnabled(e.grantsFlag)
      const locked = !this.flagEnabled(e.requiresFlag)
      const price = e.buyPrice ?? 0
      const costItems = costViews(e.costItems ?? [])
      return {
        itemId: e.itemId,
        name: def.name,
        desc: def.description,
        price,
        costItems,
        affordable: !built && !locked && s.gold >= price && costItems.every((it) => it.ok),
        sprite: def.sprite,
        built,
        locked,
      }
    })
    const toolUpgrades: ToolUpgradeView[] = (['pickaxe', 'scythe'] as UpgradeableToolId[]).map((toolId) => {
      const next = this.nextToolUpgrade(toolId)
      const costItems = costViews(next?.costItems ?? [])
      return {
        toolId,
        name: this.toolName(toolId),
        level: this.toolLevel(toolId),
        damage: this.toolDamage(toolId),
        nextName: next?.name ?? null,
        nextDamage: next?.damage ?? null,
        costGold: next?.costGold ?? 0,
        costItems,
        canUpgrade:
          this.phase === 'blacksmith' &&
          this.nearBlacksmith() &&
          !!next &&
          s.gold >= next.costGold &&
          costItems.every((it) => it.ok),
        maxed: !next,
        sprite: toolId,
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
    const rowCostGold = this.fieldRowCostGold()
    const rowCostItems = costViews([{ itemId: 'wood', qty: this.fieldRowCostWood() }])
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
          s.gold >= rowCostGold &&
          rowCostItems.every((it) => it.ok),
        costGold: rowCostGold,
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
    const cookingFireBuilt = this.cookingFireBuilt()
    const cookingFireLevel = this.cookingFireLevel()
    const cookingSlots = this.cookingSlots(cookingFireLevel)
    const nextCookingUpgrade = this.nextCookingFireUpgrade()
    const cookingUpgradeItems = costViews(cookingFireBuilt ? (nextCookingUpgrade?.costItems ?? []) : COOKING_FIRE_BUILD_COST)
    const cookingFire: CookingFireView = {
      built: cookingFireBuilt,
      level: cookingFireLevel,
      maxLevel: COOKING_FIRE_MAX_LEVEL,
      slots: cookingSlots,
      usedSlots: s.cookQueue.length,
      nextSlots: cookingFireBuilt
        ? (nextCookingUpgrade ? this.cookingSlots(nextCookingUpgrade.level) : null)
        : COOKING_FIRE_BASE_SLOTS,
      costGold: cookingFireBuilt ? (nextCookingUpgrade?.costGold ?? 0) : 0,
      costItems: cookingUpgradeItems,
      canUpgrade:
        (!cookingFireBuilt || !!nextCookingUpgrade) &&
        s.gold >= (cookingFireBuilt ? (nextCookingUpgrade?.costGold ?? 0) : 0) &&
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
    const visibleRecipeDefs = RECIPES.filter((recipe) => this.recipeUnlocked(recipe))
    const cookRecipes: CookRecipeView[] = visibleRecipeDefs.map((recipe) => {
      const out = getItem(recipe.output.itemId)
      const inputs = costViews(recipe.inputs)
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
          cookingFireBuilt &&
          s.cookQueue.length < cookingSlots &&
          maxCookQty > 0,
        maxCookQty,
        unlocked: true,
        lockText: null,
        craftSeconds: recipe.craftSeconds,
        difficulty: recipe.difficulty,
        sellPrice: out?.sellPrice ?? 0,
      }
    })
    if (visibleRecipeDefs.length < RECIPES.length) {
      cookRecipes.push({
        id: 'mystery',
        name: '???',
        desc: '새 재료를 얻으면 새로운 요리가 떠오를 것 같아요.',
        outputName: '???',
        outputSprite: '',
        outputQty: 1,
        inputs: [],
        canCook: false,
        maxCookQty: 0,
        unlocked: true,
        lockText: null,
        craftSeconds: 0,
        difficulty: 0,
        sellPrice: 0,
        mystery: true,
      })
    }
    const objective = this.currentObjective()
    let contextAction: string | null = null
    let contextActionId: UISnapshot['contextActionId'] = null
    const contextActions: ContextActionView[] = []
    if (this.phase === 'playing') {
      const animalFarm = this.selectedAnimalFarm()
      if (this.nearBed() && this.canSleep()) {
        contextAction = '잠자기'
        contextActionId = 'sleep'
        contextActions.push({ id: 'sleep', label: '잠자기' })
      } else if (this.selectedFieldId()) {
        contextAction = '씨앗 변경'
        contextActionId = 'seed'
        contextActions.push({ id: 'seed', label: '씨앗 변경' })
      } else if (animalFarm) {
        contextAction = null
        contextActionId = null
      } else if (this.nearOrderNpc()) {
        contextActions.push({ id: 'order', label: '주문' })
        if (this.nearStore()) contextActions.push({ id: 'shop', label: '상점' })
      } else if (this.nearBlacksmith()) {
        contextActions.push({ id: 'blacksmith', label: '대장간' })
      } else {
        if (this.nearStore()) contextActions.push({ id: 'shop', label: '상점' })
        if (this.nearCooking()) contextActions.push({ id: 'cook', label: '요리' })
      }
      if (contextActions.length > 0 && contextActionId == null) {
        contextAction = contextActions[0].label
        contextActionId = contextActions[0].id
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
      buildPermits,
      toolUpgrades,
      fieldPlots,
      cropChoices,
      selectedFieldId,
      cookRecipes,
      cookQueue,
      cookingFire,
      objective,
      objectives: this.objectiveTasks(objective),
      order: this.currentOrder(),
      contextAction,
      contextActionId,
      contextActions,
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
