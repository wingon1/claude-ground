import type {
  CropQuality,
  EndingState,
  GameState,
  InventorySlot,
  NPCState,
  Tile,
} from '../types'
import { CROPS, CROP_LIST } from '../data/crops'
import { cropItemId, getItem, QUALITY_LABEL } from '../data/items'
import { TOOLS, TOOL_ORDER, WATER_CAPACITY } from '../data/tools'
import { NPCS } from '../data/npcs'
import { SEED_DISCOUNT, SHIPPING_BONUS, SHOP_CATALOG } from '../data/shopCatalog'
import { SHRINE_REQUIREMENTS, SHRINE_DEADLINE_DAY } from '../data/shrineBundles'
import { RECIPES, RECIPE_MAP } from '../data/crafting'
import {
  OBSTACLE_DROP,
  OBSTACLE_HP,
  OBSTACLE_SOLID,
  TERRAIN_SOLID,
  TILLED_REVERT_DAYS,
} from '../data/tiles'
import {
  generateWorld,
  idx,
  inBounds,
  LOCATIONS,
  setObstacle,
  WORLD_H,
  WORLD_W,
} from './world'
import { buildSprites, T, type Sprites } from './sprites'
import { AudioEngine } from './audio'
import { deleteSave, loadGame, saveGame, SAVE_VERSION } from './save'

const INV_SIZE = 24
const WALK_SPEED = 60 // art px / sec
const NPC_SPEED = 30
const GAME_MIN_PER_SEC = 1200 / 180 // 1 day (1200 game-min) over 180 real sec
const PASSOUT_MIN = 1200 // 02:00
const MIDNIGHT_MIN = 1080 // 00:00

// ---------- UI snapshot shapes (consumed by React) ----------
export type UIPhase =
  | 'title'
  | 'playing'
  | 'shop'
  | 'craft'
  | 'tally'
  | 'shrine'
  | 'ending'
  | 'sleepConfirm'

export interface ToastMsg {
  id: number
  text: string
  kind: 'info' | 'good' | 'bad'
}
export interface HotbarSlotView {
  kind: 'tool' | 'item' | 'empty'
  id: string | null
  label: string
  sprite: string
  color?: string
  selected: boolean
  qty?: number
  extra?: string
}
export interface InvSlotView {
  index: number
  itemId: string | null
  qty: number
  name: string
  sprite: string
  color?: string
  sellPrice: number
  quality?: CropQuality
  type: string
  usable: boolean
  desc: string
  giftable: boolean
}
export interface ShopBuyView {
  itemId: string
  name: string
  price: number
  affordable: boolean
  sprite: string
  color?: string
  desc: string
  owned: boolean
  isUpgrade: boolean
}
export interface DialogueView {
  name: string
  text: string
  color: string
}
export interface TallyItemView {
  name: string
  qty: number
  unit: number
  total: number
  sprite: string
  color?: string
}
export interface TallyView {
  items: TallyItemView[]
  total: number
  shown: number // how many counted so far (animation)
  goldBefore: number
}
export interface ShrineReqView {
  key: string
  label: string
  icon: string
  have: number
  need: number
  done: boolean
  canDeposit: number // how many the player could deposit now
}
export interface ShrineView {
  reqs: ShrineReqView[]
  restored: boolean
  daysLeft: number
}
export interface NpcHeartView {
  id: string
  name: string
  hearts: number
  max: number
  color: string
}
export interface CraftInputView {
  name: string
  have: number
  need: number
  ok: boolean
}
export interface CraftRecipeView {
  id: string
  name: string
  sprite: string
  color?: string
  desc: string
  inputs: CraftInputView[]
  outputQty: number
  isUnlock: boolean
  craftable: boolean
  locked: boolean
  owned: boolean
  lockHint?: string
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
  water: number
  waterMax: number
  tools: HotbarSlotView[]
  items: HotbarSlotView[]
  inventory: InvSlotView[]
  toasts: ToastMsg[]
  dialogue: DialogueView | null
  shopBuy: ShopBuyView[]
  tally: TallyView | null
  shrine: ShrineView | null
  ending: EndingState
  endingText: string
  contextAction: string | null
  npcHearts: NpcHeartView[]
  exhausted: boolean
  recipes: { herbalTea: boolean }
  craft: CraftRecipeView[]
  crafting: { workbench: boolean; workshop: boolean }
  nearbyNpc: string | null
  muted: boolean
  musicOn: boolean
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
interface NpcRuntime {
  tx: number
  ty: number
  roamTimer: number
  available: boolean
  visible: boolean
  isShop: boolean
}

type Period = 'morning' | 'afternoon' | 'golden' | 'night'

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
  private npcRt: Record<string, NpcRuntime> = {}
  private keys = new Set<string>()
  private mobileVec = { x: 0, y: 0 }
  private toasts: ToastMsg[] = []
  private toastId = 1
  private dialogue: DialogueView | null = null
  private phase: UIPhase = 'title'
  private tally: TallyView | null = null
  private tallyTimer = 0
  private fade = 0 // 0..1 black overlay for sleep transition
  private fadeDir = 0
  private pendingWake = false
  private actionCooldown = 0
  private endingText = ''

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
    this.initRuntime()
    this.phase = 'playing'
    this.audio.resume()
    this.audio.startMusic()
    this.toast('새로운 봄이 밝았어요. 28일째까지 신단을 복원하세요!', 'good')
    this.emit()
  }

  continueGame(): boolean {
    const s = loadGame()
    if (!s) return false
    this.state = s
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
    inv[0] = { itemId: 'seed_parsnip', qty: 5 }
    const mkNpc = (id: string, tx: number, ty: number): NPCState => ({
      id,
      x: tx * T + T / 2,
      y: ty * T + T,
      dir: 'down',
      friendship: { points: 0, talkedToday: false, giftedToday: false, milestonesShown: [] },
    })
    return {
      saveVersion: SAVE_VERSION,
      day: 1,
      timeMinutes: 0,
      gold: 250,
      stamina: 100,
      maxStamina: 100,
      nextDayStaminaCap: null,
      player: {
        x: LOCATIONS.spawn.x * T + T / 2,
        y: LOCATIONS.spawn.y * T + T,
        dir: 'down',
        moving: false,
        animTime: 0,
        exhausted: false,
      },
      tiles,
      selectedSlot: 0,
      hotbarItems: [null, null, null, null, null],
      water: WATER_CAPACITY.basic,
      inventory: inv,
      toolUpgrades: { watering_can: 'basic', backpack: 0 },
      npcs: {
        barnaby: mkNpc('barnaby', LOCATIONS.storeStand.x, LOCATIONS.storeStand.y),
        faye: mkNpc('faye', 5, 12),
      },
      shrine: { gold: 0, pumpkins: 0, logs: 0, restored: false },
      recipes: { herbalTea: false },
      unlocks: {
        seedDiscount: false,
        backpack: false,
        shippingBonus: false,
        fayeStaminaBoost: false,
        workbench: false,
        workshop: false,
      },
      flags: {},
      ending: 'none',
      endless: false,
      pendingShip: [],
    }
  }

  private initRuntime() {
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
    this.npcRt = {
      barnaby: { tx: 0, ty: 0, roamTimer: 0, available: false, visible: true, isShop: false },
      faye: { tx: 0, ty: 0, roamTimer: 0, available: false, visible: true, isShop: false },
    }
    this.fade = 0
    this.fadeDir = 0
  }

  // ---------------- main loop ----------------
  private loop = (now: number) => {
    if (!this.running) return
    const dt = Math.min(0.05, (now - this.last) / 1000)
    this.last = now
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
    if (this.tally && this.phase === 'tally') {
      this.tallyTimer += dt
      if (this.tallyTimer > 0.18 && this.tally.shown < this.tally.items.length) {
        this.tallyTimer = 0
        this.tally.shown++
        this.audio.sfx('coin')
      }
    }
    if (this.actionCooldown > 0) this.actionCooldown -= dt
  }

  // ---------------- time / update ----------------
  private update(dt: number) {
    const s = this.state
    // clock
    const before = s.timeMinutes
    s.timeMinutes += dt * GAME_MIN_PER_SEC
    if (before < MIDNIGHT_MIN && s.timeMinutes >= MIDNIGHT_MIN) {
      this.toast('자정이 지났어요! 새벽 2시 전에 잠자리에 드세요.', 'bad')
    }
    if (s.timeMinutes >= PASSOUT_MIN) {
      this.passOut()
      return
    }
    this.movePlayer(dt)
    this.updateNpcs(dt)
    this.updateFireflies(dt)
  }

  private movePlayer(dt: number) {
    const s = this.state
    let vx = 0
    let vy = 0
    if (this.keys.has('w') || this.keys.has('arrowup')) vy -= 1
    if (this.keys.has('s') || this.keys.has('arrowdown')) vy += 1
    if (this.keys.has('a') || this.keys.has('arrowleft')) vx -= 1
    if (this.keys.has('d') || this.keys.has('arrowright')) vx += 1
    vx += this.mobileVec.x
    vy += this.mobileVec.y
    const len = Math.hypot(vx, vy)
    const p = s.player
    if (len > 0.1) {
      vx /= len
      vy /= len
      p.moving = true
      if (Math.abs(vx) > Math.abs(vy)) p.dir = vx > 0 ? 'right' : 'left'
      else p.dir = vy > 0 ? 'down' : 'up'
      const speed = (p.exhausted ? WALK_SPEED * 0.5 : WALK_SPEED) * dt
      this.tryMove(p, vx * speed, vy * speed)
      p.animTime += dt
    } else {
      p.moving = false
      p.animTime = 0
    }
  }

  private tryMove(p: { x: number; y: number }, dx: number, dy: number) {
    if (!this.collides(p.x + dx, p.y)) p.x += dx
    if (!this.collides(p.x, p.y + dy)) p.y += dy
  }

  private collides(cx: number, cy: number): boolean {
    // foot box
    const left = cx - 5
    const right = cx + 5
    const top = cy - 6
    const bottom = cy - 0.5
    const x0 = Math.floor(left / T)
    const x1 = Math.floor(right / T)
    const y0 = Math.floor(top / T)
    const y1 = Math.floor(bottom / T)
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

  // ---------------- NPCs ----------------
  private updateNpcs(dt: number) {
    const min = this.minuteOfDay()
    for (const id of Object.keys(this.state.npcs)) {
      const npc = this.state.npcs[id]
      const rt = this.npcRt[id]
      const sched = this.npcSchedule(id, min, rt, dt)
      rt.available = sched.available
      rt.visible = sched.target != null
      rt.isShop = sched.isShop
      if (!sched.target) continue
      const tgx = sched.target.x * T + T / 2
      const tgy = sched.target.y * T + T
      const ddx = tgx - npc.x
      const ddy = tgy - npc.y
      const d = Math.hypot(ddx, ddy)
      if (d > 2) {
        const step = NPC_SPEED * dt
        const nx = npc.x + (ddx / d) * step
        const ny = npc.y + (ddy / d) * step
        if (Math.abs(ddx) > Math.abs(ddy)) npc.dir = ddx > 0 ? 'right' : 'left'
        else npc.dir = ddy > 0 ? 'down' : 'up'
        if (!this.npcCollides(nx, npc.y)) npc.x = nx
        if (!this.npcCollides(npc.x, ny)) npc.y = ny
      }
    }
  }

  private npcCollides(cx: number, cy: number): boolean {
    const tx = Math.floor(cx / T)
    const ty = Math.floor((cy - 2) / T)
    if (!inBounds(tx, ty)) return true
    return this.tileSolid(this.state.tiles[idx(tx, ty)])
  }

  private npcSchedule(
    id: string,
    min: number,
    rt: NpcRuntime,
    dt: number,
  ): { target: { x: number; y: number } | null; available: boolean; isShop: boolean } {
    rt.roamTimer -= dt
    if (id === 'barnaby') {
      if (min >= 8 * 60 && min < 17 * 60) {
        return { target: LOCATIONS.storeStand, available: true, isShop: true }
      }
      if (min >= 17 * 60 && min < 20 * 60) {
        if (rt.roamTimer <= 0) {
          rt.roamTimer = 3 + Math.random() * 2
          rt.tx = 13 + Math.floor(Math.random() * 10)
          rt.ty = 31 + Math.floor(Math.random() * 2)
        }
        return { target: { x: rt.tx, y: rt.ty }, available: true, isShop: false }
      }
      return { target: null, available: false, isShop: false }
    }
    // faye
    if (min >= 6 * 60 && min < 12 * 60) {
      if (rt.roamTimer <= 0) {
        rt.roamTimer = 4 + Math.random() * 3
        rt.tx = 3 + Math.floor(Math.random() * 6)
        rt.ty = 10 + Math.floor(Math.random() * 6)
      }
      return { target: { x: rt.tx, y: rt.ty }, available: true, isShop: false }
    }
    if (min >= 12 * 60 && min < 17 * 60) {
      if (rt.roamTimer <= 0) {
        rt.roamTimer = 4 + Math.random() * 3
        rt.tx = 2 + Math.floor(Math.random() * 6)
        rt.ty = 16 + Math.floor(Math.random() * 8)
      }
      return { target: { x: rt.tx, y: rt.ty }, available: true, isShop: false }
    }
    if (min >= 17 * 60 && min < 20 * 60) {
      return { target: { x: 20, y: 7 }, available: true, isShop: false }
    }
    return { target: null, available: false, isShop: false }
  }

  private updateFireflies(dt: number) {
    for (const f of this.fireflies) {
      f.phase += dt * f.speed
      f.x += Math.cos(f.phase) * 6 * dt
      f.y += Math.sin(f.phase * 1.3) * 6 * dt
    }
  }

  // ---------------- input ----------------
  onKeyDown(e: KeyboardEvent) {
    const k = e.key.toLowerCase()
    if (this.phase === 'playing') {
      if (k >= '1' && k <= '5') {
        this.selectSlot(parseInt(k, 10) - 1)
        return
      }
      if (k >= '6' && k <= '9') {
        this.selectSlot(5 + (parseInt(k, 10) - 6))
        return
      }
      if (k === '0') {
        this.selectSlot(9)
        return
      }
      if (k === ' ' || k === 'e') {
        e.preventDefault()
        this.pressAction()
        return
      }
    }
    if (this.dialogue) {
      if (k === ' ' || k === 'e' || k === 'enter') {
        this.dialogue = null
        this.emit()
        return
      }
    }
    this.keys.add(k)
  }

  onKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.key.toLowerCase())
  }

  setMobileVector(x: number, y: number) {
    this.mobileVec.x = x
    this.mobileVec.y = y
  }

  selectSlot(slot: number) {
    if (slot < 0 || slot > 9) return
    this.state.selectedSlot = slot
    this.audio.sfx('select')
    this.emit()
  }

  // ---------------- action dispatch ----------------
  pressAction() {
    if (this.phase !== 'playing') return
    if (this.actionCooldown > 0) return
    this.actionCooldown = 0.16
    this.audio.resume()
    if (this.dialogue) {
      this.dialogue = null
      this.emit()
      return
    }
    const s = this.state
    // item hotbar slot -> plant seed / eat / use
    if (s.selectedSlot >= 5) {
      const itemId = s.hotbarItems[s.selectedSlot - 5]
      if (itemId) {
        const def = getItem(itemId)
        if (def?.type === 'seed') this.plantFromSelected(itemId)
        else if (def?.type === 'placeable') this.placeFromSelected(itemId)
        else this.useItem(itemId)
      }
      return
    }
    // tool / context. Context interactions (shop/shrine/bed/npc) take priority
    // for the Hand; with a real tool selected only shop/shrine/bed still apply.
    const toolId = TOOL_ORDER[s.selectedSlot]
    const near = this.nearbyContext()
    if (toolId === 'hand') {
      if (near) {
        this.doContext(near)
        return
      }
      this.useHand()
      return
    }
    // a real tool: still allow shrine/shop/bed if directly targeted
    if (near === 'shop' || near === 'shrine' || near === 'bed') {
      this.doContext(near)
      return
    }
    this.useTool(toolId)
  }

  private nearbyContext(): 'shop' | 'shrine' | 'bed' | 'npc' | null {
    const { tx, ty } = this.frontTile()
    const ft = inBounds(tx, ty) ? this.state.tiles[idx(tx, ty)] : null
    // also check the player's own tile for bed/shrine
    const pt = this.playerTile()
    const self = this.state.tiles[idx(pt.x, pt.y)]
    if (ft?.metadata.shop || ft?.metadata.storeCounter || self.metadata.storeCounter || self.metadata.storeInterior) {
      if (this.npcRt.barnaby.isShop) return 'shop'
    }
    if (ft?.metadata.shrine || self.metadata.shrine) return 'shrine'
    if (ft?.metadata.bed || self.metadata.bed) return 'bed'
    if (this.nearbyNpcId()) return 'npc'
    return null
  }

  private doContext(kind: 'shop' | 'shrine' | 'bed' | 'npc') {
    if (kind === 'shop') {
      this.phase = 'shop'
      this.audio.sfx('select')
    } else if (kind === 'shrine') {
      this.phase = 'shrine'
      this.audio.sfx('select')
    } else if (kind === 'bed') {
      this.phase = 'sleepConfirm'
    } else if (kind === 'npc') {
      const id = this.nearbyNpcId()
      if (id) this.talkTo(id)
    }
    this.emit()
  }

  private playerTile() {
    // player.y is the feet anchor (bottom of the body); the occupied tile is
    // ~half a body up from there.
    return {
      x: Math.max(0, Math.min(WORLD_W - 1, Math.floor(this.state.player.x / T))),
      y: Math.max(0, Math.min(WORLD_H - 1, Math.floor((this.state.player.y - 8) / T))),
    }
  }

  private frontTile() {
    const p = this.playerTile()
    let { x, y } = p
    const d = this.state.player.dir
    if (d === 'up') y -= 1
    else if (d === 'down') y += 1
    else if (d === 'left') x -= 1
    else x += 1
    return { tx: x, ty: y }
  }

  private nearbyNpcId(): string | null {
    const p = this.state.player
    let best: string | null = null
    let bestD = 22
    for (const id of Object.keys(this.state.npcs)) {
      if (!this.npcRt[id].visible) continue
      const n = this.state.npcs[id]
      const d = Math.hypot(n.x - p.x, n.y - p.y)
      if (d < bestD) {
        bestD = d
        best = id
      }
    }
    return best
  }

  // ---------------- tools ----------------
  private useTool(toolId: string) {
    const s = this.state
    const tool = TOOLS[toolId as keyof typeof TOOLS]
    const { tx, ty } = this.frontTile()
    if (!inBounds(tx, ty)) return
    const t = s.tiles[idx(tx, ty)]
    const cost = tool.staminaCost
    const px = tx * T + T / 2
    const py = ty * T + T / 2

    if (toolId === 'hoe') {
      if (t.terrain === 'grass' && !t.obstacle) {
        if (!this.spendStamina(cost)) return
        t.terrain = 'tilled'
        t.daysUnwatered = 0
        this.audio.sfx('till')
        this.dirtPuff(px, py, '#8a5a34')
      } else this.toast('빈 풀밭만 갈 수 있어요.', 'bad')
    } else if (toolId === 'watering_can') {
      if (t.terrain === 'water') {
        s.water = WATER_CAPACITY[s.toolUpgrades.watering_can]
        this.audio.sfx('water')
        this.toast('물뿌리개를 가득 채웠어요.', 'good')
      } else if (t.terrain === 'tilled') {
        if (t.wateredToday) {
          this.toast('오늘은 이미 물을 줬어요.', 'info')
        } else if (s.water <= 0) {
          this.toast('물뿌리개가 비었어요. 연못에서 채우세요.', 'bad')
          this.audio.sfx('reject')
        } else if (this.spendStamina(cost)) {
          s.water--
          t.wateredToday = true
          if (t.cropId) t.metadata.waterStreak = ((t.metadata.waterStreak as number) || 0) + 1
          this.audio.sfx('water')
          this.waterSplash(px, py)
        }
      } else this.toast('여기엔 물을 줄 게 없어요.', 'bad')
    } else if (toolId === 'axe') {
      if (
        t.obstacle === 'tree' ||
        t.obstacle === 'stump' ||
        t.obstacle === 'large_stump' ||
        t.obstacle === 'rock'
      ) {
        if (!this.spendStamina(cost)) return
        this.chopObstacle(t, px, py)
      } else if (t.obstacle === 'weed' || t.obstacle === 'flower') {
        this.toast('그건 낫으로 베세요.', 'info')
      } else this.toast('부술 것이 없습니다.', 'bad')
    } else if (toolId === 'scythe') {
      if (t.obstacle === 'weed') {
        this.clearObs(t)
        this.giveItem('fiber', 1)
        this.audio.sfx('harvest')
        this.leafBurst(px, py, '#56a84a')
      } else if (t.obstacle === 'flower') {
        // harvest daffodil
        this.giveItem('daffodil', 1)
        this.clearObs(t)
        this.audio.sfx('harvest')
        this.leafBurst(px, py, '#ffe14d')
      } else if (t.cropId && t.growthStage >= CROPS[t.cropId].stages - 1) {
        this.harvestCrop(t, px, py)
      } else this.toast('여기엔 베어낼 게 없어요.', 'info')
    }
    this.emit()
  }

  private chopObstacle(t: Tile, px: number, py: number) {
    t.hp = (t.hp ?? OBSTACLE_HP[t.obstacle as Exclude<Tile['obstacle'], null>]) - 1
    this.audio.sfx('chop')
    this.woodChips(px, py)
    if (t.hp! <= 0) {
      const drop = OBSTACLE_DROP[t.obstacle as Exclude<Tile['obstacle'], null>]
      this.audio.sfx('crack')
      if (drop) this.giveItem(drop.itemId, drop.qty)
      this.clearObs(t)
    }
  }

  private useHand() {
    const { tx, ty } = this.frontTile()
    if (!inBounds(tx, ty)) return
    const t = this.state.tiles[idx(tx, ty)]
    const px = tx * T + T / 2
    const py = ty * T + T / 2
    // harvest mature crop
    if (t.cropId && t.growthStage >= CROPS[t.cropId].stages - 1) {
      this.harvestCrop(t, px, py)
      this.emit()
      return
    }
    // pick up a placed sprinkler
    if (t.metadata.sprinkler) {
      const tier = t.metadata.sprinkler as number
      this.giveItem(tier >= 2 ? 'sprinkler_quality' : 'sprinkler', 1)
      delete t.metadata.sprinkler
      this.audio.sfx('select')
      this.toast('스프링클러를 회수했어요.', 'info')
      this.emit()
      return
    }
    // empty tilled soil: hint to plant
    if (t.terrain === 'tilled' && !t.cropId) {
      this.toast('심으려면 아이템 칸에서 씨앗을 고르세요.', 'info')
      return
    }
    if (t.obstacle === 'flower') {
      this.giveItem('daffodil', 1)
      this.clearObs(t)
      this.audio.sfx('harvest')
      this.leafBurst(px, py, '#ffe14d')
      this.emit()
      return
    }
    this.toast('여기서는 할 일이 없어요.', 'info')
  }

  private plantFromSelected(seedId: string) {
    const { tx, ty } = this.frontTile()
    if (!inBounds(tx, ty)) return
    const t = this.state.tiles[idx(tx, ty)]
    if (t.metadata.sprinkler) {
      this.toast('스프링클러가 설치된 칸에는 심을 수 없어요.', 'info')
      this.audio.sfx('reject')
    } else if (t.terrain === 'tilled' && !t.cropId) {
      this.plantSeed(t, seedId)
      this.emit()
    } else if (t.cropId) {
      this.toast('여기엔 이미 뭔가 자라고 있어요.', 'info')
    } else {
      this.toast('먼저 호미로 밭을 가세요.', 'info')
      this.audio.sfx('reject')
    }
  }

  private plantSeed(t: Tile, seedId: string) {
    const crop = CROP_LIST.find((c) => c.seedItemId === seedId)
    if (!crop) return
    if (!this.removeItem(seedId, 1)) return
    t.cropId = crop.id
    t.growthStage = 0
    t.metadata.waterStreak = 0
    this.audio.sfx('plant')
    this.dirtPuff(t.x * T + T / 2, t.y * T + T / 2, '#3a8a3a')
    this.toast(`${crop.name} 씨앗을 심었어요.`, 'good')
  }

  // ---------------- placeables (sprinklers / fertilizer) ----------------
  private placeFromSelected(itemId: string) {
    const { tx, ty } = this.frontTile()
    if (!inBounds(tx, ty)) return
    const t = this.state.tiles[idx(tx, ty)]
    if (itemId === 'fertilizer' || itemId === 'fertilizer_deluxe') {
      this.applyFertilizer(t, itemId)
    } else if (itemId === 'sprinkler' || itemId === 'sprinkler_quality') {
      this.placeSprinkler(t, itemId)
    }
    this.emit()
  }

  private applyFertilizer(t: Tile, itemId: string) {
    if (t.terrain !== 'tilled') {
      this.toast('비료는 갈아놓은 밭에만 뿌릴 수 있어요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    const level = itemId === 'fertilizer_deluxe' ? 2 : 1
    const cur = (t.metadata.fertLevel as number) || 0
    if (cur >= level) {
      this.toast('이미 비료를 줬어요.', 'info')
      return
    }
    if (!this.removeItem(itemId, 1)) return
    t.hasFertilizer = true
    t.metadata.fertLevel = level
    this.audio.sfx('plant')
    this.dirtPuff(t.x * T + T / 2, t.y * T + T / 2, level >= 2 ? '#ffd65c' : '#6e8f5e')
    this.toast('비료를 뿌렸어요. 물 준 작물이 더 빨리 자라요.', 'good')
  }

  private placeSprinkler(t: Tile, itemId: string) {
    if (t.terrain !== 'tilled') {
      this.toast('스프링클러는 갈아놓은 밭에 설치해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (t.cropId) {
      this.toast('작물 위에는 설치할 수 없어요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (t.metadata.sprinkler) {
      this.toast('이미 스프링클러가 있어요.', 'info')
      return
    }
    const tier = itemId === 'sprinkler_quality' ? 2 : 1
    if (!this.removeItem(itemId, 1)) return
    t.metadata.sprinkler = tier
    this.audio.sfx('sparkle')
    this.waterSplash(t.x * T + T / 2, t.y * T + T / 2)
    this.waterAround(t, tier) // water once right away
    this.toast('스프링클러를 설치했어요. 매일 아침 자동으로 물을 줘요.', 'good')
  }

  // Waters the sprinkler tile + its neighbours (4-dir tier 1, 8-dir tier 2).
  private waterAround(t: Tile, tier: number) {
    const ortho = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
    const diag = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]
    const cells = tier >= 2 ? [...ortho, ...diag] : ortho
    for (const [dx, dy] of cells) {
      const nx = t.x + dx
      const ny = t.y + dy
      if (!inBounds(nx, ny)) continue
      const n = this.state.tiles[idx(nx, ny)]
      if (n.terrain !== 'tilled') continue
      n.wateredToday = true
      if (n.cropId) n.metadata.waterStreak = ((n.metadata.waterStreak as number) || 0) + 1
      if (tier >= 2) {
        n.hasFertilizer = true
        if (!n.metadata.fertLevel) n.metadata.fertLevel = 1
      }
    }
  }

  private runSprinklers() {
    for (const t of this.state.tiles) {
      const tier = t.metadata.sprinkler as number | undefined
      if (!tier) continue
      this.waterAround(t, tier)
    }
  }

  // ---------------- crafting ----------------
  openCraft() {
    if (this.phase !== 'playing') return
    this.phase = 'craft'
    this.audio.resume()
    this.audio.sfx('select')
    this.emit()
  }

  craft(recipeId: string) {
    const r = RECIPE_MAP[recipeId]
    if (!r) return
    const s = this.state
    if (r.station >= 1 && !s.unlocks.workbench) {
      this.toast('먼저 작업대를 만들어야 해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (r.station >= 2 && !s.unlocks.workshop) {
      this.toast('먼저 작업장으로 확장해야 해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (r.unlock === 'workbench' && s.unlocks.workbench) {
      this.toast('이미 작업대가 있어요.', 'info')
      return
    }
    if (r.unlock === 'workshop' && s.unlocks.workshop) {
      this.toast('이미 작업장을 확장했어요.', 'info')
      return
    }
    for (const inp of r.inputs) {
      if (this.countItem(inp.itemId) < inp.qty) {
        this.toast('재료가 부족해요.', 'bad')
        this.audio.sfx('reject')
        return
      }
    }
    if (r.output && !this.canAccept(r.output.itemId, r.output.qty)) {
      this.toast('가방이 가득 찼어요!', 'bad')
      return
    }
    for (const inp of r.inputs) this.removeItem(inp.itemId, inp.qty)
    if (r.unlock === 'workbench') {
      s.unlocks.workbench = true
      this.toast('작업대를 만들었어요! 새로운 제작법이 열렸어요.', 'good')
    } else if (r.unlock === 'workshop') {
      s.unlocks.workshop = true
      this.toast('작업장으로 확장했어요! 고급 제작법이 열렸어요.', 'good')
    } else if (r.output) {
      this.giveItem(r.output.itemId, r.output.qty)
      this.toast(`${r.name} ${r.output.qty}개를 만들었어요.`, 'good')
    }
    this.audio.sfx('sparkle')
    this.autosave()
    this.emit()
  }

  private harvestCrop(t: Tile, px: number, py: number) {
    const crop = CROPS[t.cropId!]
    let quality: CropQuality = 'normal'
    if (crop.rollsQuality) quality = this.rollQuality(t, crop.growDays)
    const itemId = cropItemId(crop.id, quality)
    if (!this.canAccept(itemId, 1)) {
      this.toast('가방이 가득 찼어요! 수확하려면 공간을 비우세요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    this.giveItem(itemId, 1)
    this.audio.sfx('harvest')
    this.leafBurst(px, py, crop.color)
    if (quality === 'perfect' || quality === 'gold') this.audio.sfx('sparkle')
    if (crop.regrowDays) {
      // regrow: step back so it matures again after regrowDays waterings
      t.growthStage = Math.max(1, crop.stages - 1 - crop.regrowDays)
      t.metadata.waterStreak = 0
    } else {
      t.cropId = null
      t.growthStage = 0
    }
    const label = quality === 'normal' ? crop.name : `${QUALITY_LABEL[quality]}${crop.name}`
    this.toast(`${label}을(를) 수확했어요!`, 'good')
  }

  private rollQuality(t: Tile, growDays: number): CropQuality {
    const s = this.state
    const pity = (s.flags.pumpkinPity as number) || 0
    if (pity >= 4) {
      s.flags.pumpkinPity = 0
      return 'perfect'
    }
    const streak = (t.metadata.waterStreak as number) || 0
    const ratio = Math.max(0, Math.min(1, streak / growDays))
    const fert = (t.metadata.fertLevel as number) || 0
    const fertPerfect = fert >= 2 ? 0.18 : fert >= 1 ? 0.08 : 0
    const fertGold = fert >= 1 ? 0.1 : 0
    const perfect = 0.05 + ratio * 0.22 + fertPerfect
    const gold = 0.15 + ratio * 0.2 + fertGold
    const silver = 0.3
    const r = Math.random()
    let q: CropQuality
    if (r < perfect) q = 'perfect'
    else if (r < perfect + gold) q = 'gold'
    else if (r < perfect + gold + silver) q = 'silver'
    else q = 'normal'
    s.flags.pumpkinPity = q === 'perfect' ? 0 : pity + 1
    return q
  }

  // ---------------- items / inventory ----------------
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
    // simplistic: at least one slot can take it (stack or empty)
    const def = getItem(itemId)
    if (!def) return false
    const inv = this.state.inventory
    let remaining = qty
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
      if (!inv[slot].itemId) {
        inv[slot] = { itemId, qty: 0 }
      }
      const room = def.stackable ? def.maxStack - inv[slot].qty : 1
      const add = Math.min(room, left)
      inv[slot].qty += add
      left -= add
    }
    const added = qty - left
    if (left > 0) this.toast('가방이 가득 차 일부 아이템을 잃었어요.', 'bad')
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

  private canAfford(amount: number): boolean {
    return this.state.gold >= amount
  }
  private spendGold(amount: number): boolean {
    if (!this.canAfford(amount)) return false
    this.state.gold -= amount
    return true
  }

  private spendStamina(cost: number): boolean {
    const s = this.state
    if (cost <= 0) return true
    if (s.stamina < cost) {
      this.toast('너무 지쳤어요! 뭔가 먹거나 잠을 자세요.', 'bad')
      this.audio.sfx('reject')
      s.player.exhausted = true
      return false
    }
    s.stamina -= cost
    if (s.stamina <= 0) {
      s.stamina = 0
      s.player.exhausted = true
      this.toast('완전히 지쳤어요!', 'bad')
    }
    return true
  }

  useItem(itemId: string) {
    const def = getItem(itemId)
    if (!def || !def.usable) return
    if (this.countItem(itemId) <= 0) return
    if (itemId === 'herbal_tea') {
      this.removeItem(itemId, 1)
      const s = this.state
      if (s.maxStamina < 130) {
        s.maxStamina = 130
        this.toast('최대 스태미나가 영구히 130으로 올랐어요!', 'good')
        this.audio.sfx('sparkle')
      } else {
        this.toast('허브차를 마셨어요. 정말 편안하네요.', 'good')
      }
      const restore = def.staminaRestore ?? 0
      s.stamina = Math.min(s.maxStamina, s.stamina + restore)
      if (s.stamina > 0) s.player.exhausted = false
      this.audio.sfx('eat')
      this.emit()
      return
    }
    // food / crop -> restore stamina
    const restore = def.staminaRestore ?? 0
    if (restore > 0) {
      this.removeItem(itemId, 1)
      const s = this.state
      const boost = s.unlocks.fayeStaminaBoost ? Math.round(restore * 1.3) : restore
      s.stamina = Math.min(s.maxStamina, s.stamina + boost)
      if (s.stamina > 0) s.player.exhausted = false
      this.audio.sfx('eat')
      this.heartBurst(this.state.player.x, this.state.player.y - 16, '#9af0c0')
      this.toast(`${def.name}을(를) 먹었어요. 스태미나 +${boost}.`, 'good')
      this.emit()
    }
  }

  // ---------------- shop ----------------
  buyItem(itemId: string) {
    const entry = SHOP_CATALOG.find((e) => e.itemId === itemId)
    if (!entry || entry.buyPrice == null) return
    const s = this.state
    let price = entry.buyPrice
    if (entry.itemId.startsWith('seed_') && s.unlocks.seedDiscount) {
      price = Math.round(price * (1 - SEED_DISCOUNT))
    }
    if (entry.upgrade === 'copper_can') {
      if (s.toolUpgrades.watering_can === 'copper') {
        this.toast('이미 구리 물뿌리개를 가지고 있어요.', 'info')
        return
      }
      if (!this.spendGold(price)) return this.notEnoughGold()
      s.toolUpgrades.watering_can = 'copper'
      s.water = WATER_CAPACITY.copper
      this.toast('구리 물뿌리개! 물을 25까지 담아요.', 'good')
      this.audio.sfx('sparkle')
      this.autosave()
      this.emit()
      return
    }
    if (entry.upgrade === 'backpack') {
      if (s.unlocks.backpack) {
        this.toast('가방은 이미 업그레이드됐어요.', 'info')
        return
      }
      if (!this.spendGold(price)) return this.notEnoughGold()
      s.unlocks.backpack = true
      this.toast('더 넓은 가방! (24칸 확보.)', 'good')
      this.audio.sfx('sparkle')
      this.autosave()
      this.emit()
      return
    }
    if (!this.canAccept(itemId, 1)) {
      this.toast('가방이 가득 찼어요!', 'bad')
      return
    }
    if (!this.spendGold(price)) return this.notEnoughGold()
    this.giveItem(itemId, 1)
    this.audio.sfx('coin')
    this.emit()
  }

  private notEnoughGold() {
    this.toast('골드가 부족해요.', 'bad')
    this.audio.sfx('reject')
  }

  sellItem(index: number, all: boolean) {
    const inv = this.state.inventory
    const slot = inv[index]
    if (!slot || !slot.itemId) return
    const def = getItem(slot.itemId)
    if (!def) return
    if (def.type === 'seed' || def.id === 'hardwood') {
      // allow selling anything except keep guidance; still allow
    }
    const qty = all ? slot.qty : 1
    const bonus = this.state.unlocks.shippingBonus ? 1 + SHIPPING_BONUS : 1
    const gold = Math.round(def.sellPrice * qty * bonus)
    this.removeItem(slot.itemId, qty)
    this.state.gold += gold
    this.audio.sfx('coin')
    this.toast(`${def.name} ${qty}개를 ${gold}G에 팔았어요.`, 'good')
    this.emit()
  }

  closeModal() {
    if (this.phase === 'shop' || this.phase === 'shrine' || this.phase === 'craft') {
      this.phase = 'playing'
      this.emit()
    }
  }

  // ---------------- NPC talk / gift ----------------
  private talkTo(id: string) {
    const npc = this.state.npcs[id]
    const def = NPCS[id]
    const min = this.minuteOfDay()
    let line = def.normalLines[Math.floor(Math.random() * def.normalLines.length)]
    // time line chance
    for (const tl of def.timeLines) {
      if (min >= tl.from && min < tl.to && Math.random() < 0.5) {
        line = tl.lines[Math.floor(Math.random() * tl.lines.length)]
        break
      }
    }
    if (!npc.friendship.talkedToday) {
      npc.friendship.talkedToday = true
      this.addFriendship(id, 12)
    }
    // milestone line if a new heart was reached
    const hearts = this.hearts(id)
    if (def.milestoneLines[hearts] && !npc.friendship.milestonesShown.includes(hearts)) {
      line = def.milestoneLines[hearts]
    }
    this.dialogue = { name: def.name, text: line, color: def.color }
    this.audio.sfx('select')
    this.emit()
  }

  giftItem(index: number) {
    const id = this.nearbyNpcId()
    if (!id) {
      this.toast('선물할 사람이 근처에 없어요.', 'info')
      return
    }
    const npc = this.state.npcs[id]
    if (npc.friendship.giftedToday) {
      this.toast('오늘은 이미 선물을 줬어요.', 'info')
      this.audio.sfx('reject')
      return
    }
    const slot = this.state.inventory[index]
    if (!slot || !slot.itemId) return
    const def = NPCS[id]
    const itemId = slot.itemId
    let tier: 'loved' | 'liked' | 'neutral' | 'disliked' | 'hated' = 'neutral'
    if (def.giftPrefs.loved.includes(itemId)) tier = 'loved'
    else if (def.giftPrefs.liked.includes(itemId)) tier = 'liked'
    else if (def.giftPrefs.hated.includes(itemId)) tier = 'hated'
    else if (def.giftPrefs.disliked.includes(itemId)) tier = 'disliked'
    const pts = { loved: 80, liked: 40, neutral: 8, disliked: -20, hated: -40 }[tier]
    this.removeItem(itemId, 1)
    npc.friendship.giftedToday = true
    this.addFriendship(id, pts)
    const react = def.giftReactions[tier]
    this.dialogue = { name: def.name, text: react[Math.floor(Math.random() * react.length)], color: def.color }
    if (pts > 0) {
      this.heartBurst(npc.x, npc.y - 18, '#ff6e8a')
      this.audio.sfx('sparkle')
    } else this.audio.sfx('reject')
    this.emit()
  }

  private addFriendship(id: string, pts: number) {
    const npc = this.state.npcs[id]
    const before = this.hearts(id)
    npc.friendship.points = Math.max(0, npc.friendship.points + pts)
    const after = this.hearts(id)
    if (after > before) this.checkMilestones(id, after)
  }

  private hearts(id: string): number {
    const npc = this.state.npcs[id]
    const def = NPCS[id]
    return Math.min(def.heartsMax, Math.floor(npc.friendship.points / def.pointsPerHeart))
  }

  private checkMilestones(id: string, hearts: number) {
    const npc = this.state.npcs[id]
    const s = this.state
    if (npc.friendship.milestonesShown.includes(hearts)) return
    let rewarded = false
    if (id === 'barnaby') {
      if (hearts === 2 && !s.unlocks.seedDiscount) {
        s.unlocks.seedDiscount = true
        this.toast('이제 바나비가 씨앗 할인을 해줘요!', 'good')
        rewarded = true
      } else if (hearts === 4 && !s.unlocks.backpack) {
        s.unlocks.backpack = true
        this.toast('바나비가 가방을 업그레이드해줬어요!', 'good')
        rewarded = true
      } else if (hearts === 5 && !s.unlocks.shippingBonus) {
        s.unlocks.shippingBonus = true
        this.toast('바나비가 출하 보너스 +15%를 줘요!', 'good')
        rewarded = true
      }
    } else if (id === 'faye') {
      if (hearts === 3 && !s.recipes.herbalTea) {
        s.recipes.herbalTea = true
        this.toast('페이가 허브차 비법을 알려줬어요!', 'good')
        rewarded = true
      } else if (hearts === 5 && !s.unlocks.fayeStaminaBoost) {
        s.unlocks.fayeStaminaBoost = true
        this.toast('이제 음식이 스태미나를 +30% 더 회복시켜요!', 'good')
        rewarded = true
      }
    }
    if (NPCS[id].milestoneLines[hearts]) npc.friendship.milestonesShown.push(hearts)
    if (rewarded) {
      this.audio.sfx('sparkle')
      this.autosave()
    }
  }

  // Crafting outside shop: brew herbal tea if recipe known (uses a daffodil).
  brewHerbalTea() {
    const s = this.state
    if (!s.recipes.herbalTea) return
    if (this.countItem('daffodil') < 1) {
      this.toast('차를 끓이려면 야생 수선화가 필요해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (!this.canAccept('herbal_tea', 1)) {
      this.toast('가방이 가득 찼어요!', 'bad')
      return
    }
    this.removeItem('daffodil', 1)
    this.giveItem('herbal_tea', 1)
    this.audio.sfx('sparkle')
    this.toast('허브차를 끓였어요.', 'good')
    this.emit()
  }

  // ---------------- shrine ----------------
  depositShrine(key: string) {
    const s = this.state
    const req = SHRINE_REQUIREMENTS.find((r) => r.key === key)
    if (!req || s.shrine.restored) return
    if (key === 'gold') {
      const remaining = req.needed - s.shrine.gold
      const give = Math.min(remaining, s.gold)
      if (give <= 0) {
        this.toast(s.gold <= 0 ? '바칠 골드가 없어요.' : '황금 공물을 모두 바쳤어요.', 'info')
        return
      }
      s.gold -= give
      s.shrine.gold += give
      this.audio.sfx('coin')
      this.toast(`신단에 ${give}G를 바쳤어요.`, 'good')
    } else {
      const have = this.countItem(req.itemId!)
      const remaining = req.needed - (key === 'pumpkins' ? s.shrine.pumpkins : s.shrine.logs)
      const give = Math.min(remaining, have)
      if (give <= 0) {
        this.toast(have <= 0 ? `${req.label}이(가) 없어요.` : '이미 다 채웠어요.', have <= 0 ? 'bad' : 'info')
        if (have <= 0) this.audio.sfx('reject')
        return
      }
      this.removeItem(req.itemId!, give)
      if (key === 'pumpkins') s.shrine.pumpkins += give
      else s.shrine.logs += give
      this.audio.sfx('sparkle')
      this.toast(`${req.label} ${give}개를 바쳤어요.`, 'good')
    }
    this.checkShrineComplete()
    this.autosave()
    this.emit()
  }

  // shrine wrongly-typed items are simply never offered via the typed buttons,
  // but a generic "offer selected item" guard explains rejection:
  rejectShrineItem() {
    this.toast('신단은 정해진 공물만 받아요.', 'info')
    this.audio.sfx('reject')
  }

  private checkShrineComplete() {
    const s = this.state
    const sh = s.shrine
    if (sh.gold >= 1000 && sh.pumpkins >= 5 && sh.logs >= 20 && !sh.restored) {
      sh.restored = true
      s.ending = s.day <= SHRINE_DEADLINE_DAY ? 'good' : 'good'
      s.endless = true
      this.triggerVictory()
    }
  }

  private triggerVictory() {
    this.endingText =
      '신단이 빛으로 피어나요! 골짜기가 오래 참았던 숨을 내쉽니다. ' +
      '오래된 돌이 다시 깨어나는 동안 꽃잎이 따뜻한 바람에 흩날려요. 해냈어요.'
    this.phase = 'ending'
    this.audio.sfx('sparkle')
    setTimeout(() => this.audio.sfx('sparkle'), 300)
    setTimeout(() => this.audio.sfx('sparkle'), 600)
    for (let i = 0; i < 40; i++) {
      this.particles.push({
        x: LOCATIONS.shrine.x * T + Math.random() * 32 - 16,
        y: LOCATIONS.shrine.y * T - Math.random() * 40,
        vx: (Math.random() - 0.5) * 20,
        vy: -10 - Math.random() * 20,
        life: 3,
        max: 3,
        color: ['#9af0c0', '#ffd65c', '#ff9ec0'][i % 3],
        size: 2,
        gravity: -4,
        additive: true,
      })
    }
    this.autosave()
    this.emit()
  }

  // ---------------- sleep / day cycle ----------------
  requestSleep() {
    if (this.phase === 'playing') {
      this.phase = 'sleepConfirm'
      this.emit()
    }
  }

  confirmSleep() {
    this.doSleep(false)
  }
  cancelSleep() {
    if (this.phase === 'sleepConfirm') {
      this.phase = 'playing'
      this.emit()
    }
  }

  private passOut() {
    const s = this.state
    const penalty = Math.round(s.gold * 0.2)
    s.gold -= penalty
    s.nextDayStaminaCap = Math.round(s.maxStamina * 0.5)
    this.toast(`쓰러졌어요! ${penalty}G를 잃었어요.`, 'bad')
    this.doSleep(true)
  }

  private doSleep(passedOut: boolean) {
    // Build tally from pending shipped items.
    const bonus = this.state.unlocks.shippingBonus ? 1 + SHIPPING_BONUS : 1
    const items: TallyItemView[] = []
    let total = 0
    for (const sl of this.state.pendingShip) {
      const def = getItem(sl.itemId)
      if (!def) continue
      const unit = Math.round(def.sellPrice * bonus)
      const line = unit * sl.qty
      total += line
      items.push({
        name: def.name,
        qty: sl.qty,
        unit,
        total: line,
        sprite: def.sprite,
        color: def.cropId ? CROPS[def.cropId].color : undefined,
      })
    }
    this.tally = { items, total, shown: 0, goldBefore: this.state.gold }
    this.tallyTimer = 0
    this.phase = 'tally'
    // store passedOut for after-tally processing
    this.state.flags.__passedOut = passedOut
    this.emit()
  }

  // Called when the player dismisses the tally screen.
  finishTally() {
    const s = this.state
    if (this.tally) {
      s.gold += this.tally.total
      s.pendingShip = []
    }
    this.tally = null
    const passedOut = !!s.flags.__passedOut
    delete s.flags.__passedOut
    // fade out, advance day, fade in
    this.phase = 'playing'
    this.fadeDir = 1
    this.pendingWake = true
    this.advanceDay(passedOut)
    this.emit()
  }

  private advanceDay(passedOut: boolean) {
    const s = this.state
    s.day++
    s.timeMinutes = 0
    // growth tick + tile maintenance
    for (const t of s.tiles) {
      if (t.cropId) {
        const crop = CROPS[t.cropId]
        if (t.wateredToday) {
          if (t.growthStage < crop.stages - 1) {
            t.growthStage++
            // Fertilizer: a chance (deluxe: guaranteed) at an extra stage.
            const fert = (t.metadata.fertLevel as number) || 0
            if (fert > 0 && t.growthStage < crop.stages - 1 && (fert >= 2 || Math.random() < 0.5)) {
              t.growthStage++
            }
          }
          t.daysUnwatered = 0
        } else {
          t.daysUnwatered++
        }
      } else if (t.terrain === 'tilled') {
        if (t.wateredToday) t.daysUnwatered = 0
        else t.daysUnwatered++
        // Tiles with a sprinkler or fertilizer are kept (don't revert to grass).
        const kept = !!t.metadata.sprinkler || t.hasFertilizer
        if (!kept && t.daysUnwatered >= TILLED_REVERT_DAYS) {
          t.terrain = 'grass'
          t.daysUnwatered = 0
          t.metadata = {}
        }
      }
      t.wateredYesterday = t.wateredToday
      t.wateredToday = false
    }
    // renewable woods: respawn large stumps + scatter forage
    for (const t of s.tiles) {
      if (t.metadata.renewable && !t.obstacle && Math.random() < 0.7) {
        setObstacle(t, 'large_stump')
      }
    }
    this.scatterForage()
    // sprinklers water their neighbours for the new morning
    this.runSprinklers()
    // stamina reset
    s.stamina = s.nextDayStaminaCap ?? s.maxStamina
    s.nextDayStaminaCap = null
    s.player.exhausted = s.stamina <= 0
    // reset NPC daily flags + reposition
    for (const id of Object.keys(s.npcs)) {
      s.npcs[id].friendship.talkedToday = false
      s.npcs[id].friendship.giftedToday = false
    }
    s.npcs.barnaby.x = LOCATIONS.storeStand.x * T + T / 2
    s.npcs.barnaby.y = LOCATIONS.storeStand.y * T + T
    s.npcs.faye.x = 5 * T + T / 2
    s.npcs.faye.y = 12 * T + T
    // place player at bed front
    s.player.x = LOCATIONS.spawn.x * T + T / 2
    s.player.y = LOCATIONS.spawn.y * T + T
    // deadline check
    if (s.day > SHRINE_DEADLINE_DAY && !s.shrine.restored && s.ending === 'none') {
      s.ending = 'bittersweet'
      s.endless = true
      this.endingText =
        '봄이 지나갔지만, 신단은 여전히 이끼 아래에서 잠들어 있어요. ' +
        '그래도 골짜기는 인내심이 깊죠. 다음 계절은 언제나 있으니까요... ' +
        '(끝없는 모드 해금 — 계속 농사를 지으며 언제든 신단을 복원하세요.)'
      this.phase = 'ending'
    }
    if (passedOut) this.toast('늦잠을 잤어요. 오늘은 스태미나가 제한돼요.', 'bad')
    this.autosave()
  }

  private scatterForage() {
    const w = LOCATIONS.woods
    let flowers = 0
    let attempts = 0
    while (flowers < 3 && attempts < 40) {
      attempts++
      const x = w.x + Math.floor(Math.random() * w.w)
      const y = w.y + Math.floor(Math.random() * w.h)
      if (!inBounds(x, y)) continue
      const t = this.state.tiles[idx(x, y)]
      if (t.terrain === 'grass' && !t.obstacle) {
        setObstacle(t, Math.random() < 0.6 ? 'flower' : 'weed')
        flowers++
      }
    }
  }

  // ---------------- shipping (overnight sell) ----------------
  shipItem(index: number, all: boolean) {
    const slot = this.state.inventory[index]
    if (!slot || !slot.itemId) return
    const def = getItem(slot.itemId)
    if (!def || def.sellPrice <= 0) return
    const qty = all ? slot.qty : 1
    this.removeItem(slot.itemId, qty)
    // merge into pendingShip
    const existing = this.state.pendingShip.find((p) => p.itemId === def.id)
    if (existing) existing.qty += qty
    else this.state.pendingShip.push({ itemId: def.id, qty })
    this.audio.sfx('select')
    this.toast(`${def.name} ${qty}개를 출하했어요 (밤사이 정산).`, 'good')
    this.emit()
  }

  // ---------------- ending / replay ----------------
  dismissEnding() {
    this.phase = 'playing'
    this.emit()
  }

  // ---------------- particles / fx ----------------
  private dirtPuff(x: number, y: number, color: string) {
    for (let i = 0; i < 6; i++)
      this.particles.push({
        x, y, vx: (Math.random() - 0.5) * 30, vy: -Math.random() * 25 - 5,
        life: 0.5, max: 0.5, color, size: 1.5, gravity: 90, additive: false,
      })
  }
  private waterSplash(x: number, y: number) {
    for (let i = 0; i < 7; i++)
      this.particles.push({
        x, y: y - 4, vx: (Math.random() - 0.5) * 26, vy: -Math.random() * 30 - 8,
        life: 0.5, max: 0.5, color: '#9fd0ff', size: 1.4, gravity: 110, additive: false,
      })
  }
  private leafBurst(x: number, y: number, color: string) {
    for (let i = 0; i < 8; i++)
      this.particles.push({
        x, y, vx: (Math.random() - 0.5) * 50, vy: -Math.random() * 40 - 10,
        life: 0.6, max: 0.6, color, size: 1.6, gravity: 70, additive: false,
      })
  }
  private woodChips(x: number, y: number) {
    for (let i = 0; i < 6; i++)
      this.particles.push({
        x, y, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 50 - 10,
        life: 0.5, max: 0.5, color: '#a8743f', size: 1.4, gravity: 120, additive: false,
      })
  }
  private heartBurst(x: number, y: number, color: string) {
    for (let i = 0; i < 5; i++)
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8, y, vx: (Math.random() - 0.5) * 14,
        vy: -20 - Math.random() * 14, life: 1, max: 1, color, size: 2, gravity: -6, additive: true,
      })
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        this.particles.splice(i, 1)
        continue
      }
      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
    }
  }

  // ---------------- helpers ----------------
  private minuteOfDay(): number {
    return (360 + this.state.timeMinutes) % 1440
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

  private period(): Period {
    const h = this.minuteOfDay() / 60
    if (h >= 6 && h < 12) return 'morning'
    if (h >= 12 && h < 17) return 'afternoon'
    if (h >= 17 && h < 20) return 'golden'
    return 'night'
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
    // camera follows player
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

    // ground pass
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!inBounds(tx, ty)) continue
        this.drawGround(this.state.tiles[idx(tx, ty)], wf, S)
      }
    }
    // buildings (drawn once at anchor)
    this.drawBuilding(this.sprites.farmhouse, 29, 6, S, -16)
    this.drawBuilding(this.sprites.store, 14, 26, S, -14)
    this.drawBuilding(
      this.state.shrine.restored ? this.sprites.shrineRestored : this.sprites.shrineBroken,
      19, 2, S, -8,
    )

    // collect drawables (obstacles, crops, npcs, player) sorted by y for depth
    type Draw = { y: number; fn: () => void }
    const draws: Draw[] = []
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!inBounds(tx, ty)) continue
        const t = this.state.tiles[idx(tx, ty)]
        if (t.obstacle) draws.push({ y: ty * T + T, fn: () => this.drawObstacle(t, S) })
        if (t.cropId) draws.push({ y: ty * T + T, fn: () => this.drawCrop(t, S) })
        if (t.metadata.sprinkler) draws.push({ y: ty * T + T - 1, fn: () => this.drawSprinkler(t, S) })
      }
    }
    for (const id of Object.keys(this.state.npcs)) {
      if (!this.npcRt[id].visible) continue
      const n = this.state.npcs[id]
      draws.push({ y: n.y, fn: () => this.drawHuman(this.sprites[id as 'barnaby' | 'faye'], n.x, n.y, n.dir, false, false) })
    }
    draws.push({
      y: p.y,
      fn: () => this.drawHuman(this.sprites.farmer, p.x, p.y, p.dir, p.moving, p.exhausted),
    })
    draws.sort((a, b) => a.y - b.y)
    for (const d of draws) d.fn()

    // target tile highlight
    this.drawTargetHighlight(S)
    // particles
    this.drawParticles(S)
    // lighting overlay
    this.drawLighting(S, bw, bh)
    // fade
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.fade})`
      ctx.fillRect(0, 0, bw, bh)
    }
  }

  private wx(worldX: number): number {
    return Math.round((worldX - this.cam.x) * this.scale)
  }
  private wy(worldY: number): number {
    return Math.round((worldY - this.cam.y) * this.scale)
  }

  private drawGround(t: Tile, wf: number, S: number) {
    const dx = this.wx(t.x * T)
    const dy = this.wy(t.y * T)
    const sz = T * S
    let img: HTMLCanvasElement
    if (t.terrain === 'water') img = this.sprites.water[wf]
    else if (t.terrain === 'path') img = this.sprites.path
    else if (t.terrain === 'blocked') img = this.sprites.fence
    else if (t.terrain === 'tilled') img = t.wateredToday ? this.sprites.soilWet : this.sprites.soil
    else img = this.sprites.grass[(t.x * 7 + t.y * 13) % 3]
    this.ctx.drawImage(img, dx, dy, sz, sz)
    // Fertilizer speckles on tilled soil.
    if (t.terrain === 'tilled' && t.hasFertilizer) {
      const lvl = (t.metadata.fertLevel as number) || 1
      this.ctx.fillStyle = lvl >= 2 ? 'rgba(255,214,92,0.85)' : 'rgba(110,143,94,0.8)'
      const spots = [
        [3, 4],
        [10, 5],
        [6, 11],
        [12, 12],
      ]
      const d = Math.max(1, Math.round(S))
      for (const [ox, oy] of spots) this.ctx.fillRect(dx + ox * S, dy + oy * S, d, d)
    }
  }

  private drawSprinkler(t: Tile, S: number) {
    const tier = t.metadata.sprinkler as number
    const img = tier >= 2 ? this.sprites.sprinklerQ : this.sprites.sprinkler
    const dx = this.wx(t.x * T)
    const dy = this.wy(t.y * T - 2)
    this.ctx.drawImage(img, dx, dy, img.width * S, img.height * S)
  }

  private drawBuilding(img: HTMLCanvasElement, tx: number, ty: number, S: number, yOff: number) {
    const dx = this.wx(tx * T)
    const dy = this.wy(ty * T + yOff)
    this.ctx.drawImage(img, dx, dy, img.width * S, img.height * S)
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
    const dx = this.wx(t.x * T)
    const dy = this.wy(t.y * T + yOff)
    this.ctx.drawImage(img, dx, dy, img.width * S, img.height * S)
  }

  private drawCrop(t: Tile, S: number) {
    if (!t.cropId) return
    const frames = this.sprites.crops[t.cropId]
    const stage = Math.min(t.growthStage, frames.length - 1)
    const img = frames[stage]
    const dx = this.wx(t.x * T)
    const dy = this.wy(t.y * T)
    this.ctx.drawImage(img, dx, dy, T * S, T * S)
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
    const dx = this.wx(x - 8)
    const dy = this.wy(y - 22 + 2)
    this.ctx.drawImage(img, dx, dy, 16 * S, 22 * S)
    if (exhausted) {
      const t = performance.now() / 300
      this.ctx.fillStyle = '#9fd0ff'
      const sx = this.wx(x + 5)
      const sy = this.wy(y - 20 + Math.sin(t) * 2)
      this.ctx.fillRect(sx, sy, 2 * S, 3 * S)
    }
  }

  private drawTargetHighlight(S: number) {
    if (this.phase !== 'playing') return
    const slot = this.state.selectedSlot
    if (slot >= 5) return
    const { tx, ty } = this.frontTile()
    if (!inBounds(tx, ty)) return
    const ctx = this.ctx
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.lineWidth = Math.max(1, S / 2)
    ctx.strokeRect(this.wx(tx * T) + 1, this.wy(ty * T) + 1, T * S - 2, T * S - 2)
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
    if (period === 'golden') {
      const g = ctx.createRadialGradient(bw / 2, bh / 2, bh / 4, bw / 2, bh / 2, bh)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, 'rgba(80,30,0,0.28)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, bw, bh)
    }
    if (period === 'night') {
      // glowing windows
      ctx.globalCompositeOperation = 'lighter'
      this.glowRect(31 * T, 6 * T + 10, 6, 6, '#ffd65c', S)
      this.glowRect(30 * T + 5, 6 * T + 16, 5, 5, '#ffd65c', S)
      this.glowRect(16 * T + 6, 26 * T + 8, 6, 6, '#ffd07a', S)
      // fireflies
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
    // simple hills
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
    const phase = this.phase === 'playing' && this.dialogue ? 'playing' : this.phase
    if (!s) {
      return {
        phase: this.phase, day: 1, clock: '6:00 AM', period: 'Morning', periodKey: 'morning',
        gold: 0, stamina: 100, maxStamina: 100, water: 10, waterMax: 10,
        tools: [], items: [], inventory: [], toasts: this.toasts, dialogue: null,
        shopBuy: [], tally: null, shrine: null, ending: 'none', endingText: '',
        contextAction: null, npcHearts: [], exhausted: false, recipes: { herbalTea: false },
        craft: [], crafting: { workbench: false, workshop: false },
        nearbyNpc: null, muted: this.audio.muted, musicOn: this.audio.musicOn,
      }
    }
    // tools
    const tools: HotbarSlotView[] = TOOL_ORDER.map((id, i) => {
      const tdef = TOOLS[id]
      let extra: string | undefined
      if (id === 'watering_can') extra = `${s.water}/${WATER_CAPACITY[s.toolUpgrades.watering_can]}`
      return {
        kind: 'tool', id, label: tdef.name, sprite: id, selected: s.selectedSlot === i, extra,
      }
    })
    // item hotbar: auto-fill with distinct seeds + usable items (seeds first)
    const usable: string[] = []
    const pushIf = (pred: (id: string) => boolean) => {
      for (const sl of s.inventory) {
        if (usable.length >= 5) break
        const def = sl.itemId ? getItem(sl.itemId) : null
        if (def && pred(def.id) && !usable.includes(def.id)) usable.push(def.id)
      }
    }
    pushIf((id) => getItem(id)!.type === 'seed')
    pushIf((id) => getItem(id)!.type === 'placeable')
    pushIf((id) => !!getItem(id)!.usable)
    s.hotbarItems = [0, 1, 2, 3, 4].map((i) => usable[i] ?? null)
    const items: HotbarSlotView[] = s.hotbarItems.map((id, i) => {
      const def = id ? getItem(id) : null
      return {
        kind: id ? 'item' : 'empty',
        id: id ?? null,
        label: def?.name ?? '',
        sprite: def?.sprite ?? '',
        color: def?.cropId ? CROPS[def.cropId].color : undefined,
        selected: s.selectedSlot === 5 + i,
        qty: id ? this.countItem(id) : undefined,
      }
    })
    // inventory view
    const nearby = this.nearbyNpcId()
    const inventory: InvSlotView[] = s.inventory.map((sl, i) => {
      const def = sl.itemId ? getItem(sl.itemId) : null
      const giftable =
        !!nearby && !!def && def.type !== 'misc' && !s.npcs[nearby].friendship.giftedToday
      return {
        index: i,
        itemId: sl.itemId || null,
        qty: sl.qty,
        name: def?.name ?? '',
        sprite: def?.sprite ?? '',
        color: def?.cropId ? CROPS[def.cropId].color : undefined,
        sellPrice: def?.sellPrice ?? 0,
        quality: def?.quality,
        type: def?.type ?? '',
        usable: def?.usable ?? false,
        desc: def?.description ?? '',
        giftable,
      }
    })
    // shop
    const shopBuy: ShopBuyView[] = SHOP_CATALOG.map((e) => {
      let price = e.buyPrice ?? 0
      if (e.itemId.startsWith('seed_') && s.unlocks.seedDiscount) price = Math.round(price * (1 - SEED_DISCOUNT))
      let name: string
      let sprite: string
      let color: string | undefined
      let desc: string
      let owned = false
      if (e.upgrade === 'copper_can') {
        name = '구리 물뿌리개'; sprite = 'watering_can'; desc = '물을 25까지 담아요.'
        owned = s.toolUpgrades.watering_can === 'copper'
      } else if (e.upgrade === 'backpack') {
        name = '가방 업그레이드'; sprite = 'backpack'; desc = '24칸 가방을 확보해요.'
        owned = s.unlocks.backpack
      } else {
        const def = getItem(e.itemId)!
        name = def.name; sprite = def.sprite; desc = def.description
        color = def.cropId ? CROPS[def.cropId].color : undefined
      }
      return { itemId: e.itemId, name, price, affordable: s.gold >= price, sprite, color, desc, owned, isUpgrade: !!e.upgrade }
    })
    // shrine
    const shrine: ShrineView = {
      restored: s.shrine.restored,
      daysLeft: Math.max(0, SHRINE_DEADLINE_DAY - s.day),
      reqs: SHRINE_REQUIREMENTS.map((r) => {
        const have = r.key === 'gold' ? s.shrine.gold : r.key === 'pumpkins' ? s.shrine.pumpkins : s.shrine.logs
        let canDeposit: number
        if (r.key === 'gold') canDeposit = Math.min(r.needed - have, s.gold)
        else canDeposit = Math.min(r.needed - have, this.countItem(r.itemId!))
        return { key: r.key, label: r.label, icon: r.icon, have, need: r.needed, done: have >= r.needed, canDeposit: Math.max(0, canDeposit) }
      }),
    }
    const npcHearts: NpcHeartView[] = Object.keys(s.npcs).map((id) => ({
      id, name: NPCS[id].name, hearts: this.hearts(id), max: NPCS[id].heartsMax, color: NPCS[id].color,
    }))
    // crafting recipes
    const craft: CraftRecipeView[] = RECIPES.map((r) => {
      const locked =
        (r.station >= 1 && !s.unlocks.workbench) || (r.station >= 2 && !s.unlocks.workshop)
      const owned =
        (r.unlock === 'workbench' && s.unlocks.workbench) ||
        (r.unlock === 'workshop' && s.unlocks.workshop)
      const inputs: CraftInputView[] = r.inputs.map((inp) => {
        const have = this.countItem(inp.itemId)
        return { name: getItem(inp.itemId)?.name ?? inp.itemId, have, need: inp.qty, ok: have >= inp.qty }
      })
      const craftable =
        !locked &&
        !owned &&
        inputs.every((i) => i.ok) &&
        (!r.output || this.canAccept(r.output.itemId, r.output.qty))
      let lockHint: string | undefined
      if (r.station >= 2 && !s.unlocks.workshop) lockHint = '작업장 확장 필요'
      else if (r.station >= 1 && !s.unlocks.workbench) lockHint = '작업대 필요'
      return {
        id: r.id,
        name: r.name,
        sprite: r.sprite,
        color: r.color,
        desc: r.desc,
        inputs,
        outputQty: r.output?.qty ?? 0,
        isUnlock: !!r.unlock,
        craftable,
        locked,
        owned,
        lockHint,
      }
    })
    // context action label
    let contextAction: string | null = null
    if (this.phase === 'playing') {
      const ctx = this.nearbyContext()
      if (ctx === 'shop') contextAction = '상점'
      else if (ctx === 'shrine') contextAction = '신단'
      else if (ctx === 'bed') contextAction = '잠자기'
      else if (ctx === 'npc') contextAction = `${NPCS[this.nearbyNpcId()!].name} 대화`
      else if (s.selectedSlot < 5) contextAction = TOOLS[TOOL_ORDER[s.selectedSlot]].name
      else if (s.hotbarItems[s.selectedSlot - 5]) {
        const hid = s.hotbarItems[s.selectedSlot - 5]!
        const ht = getItem(hid)?.type
        if (ht === 'seed') contextAction = '심기'
        else if (ht === 'placeable') contextAction = hid.startsWith('fertilizer') ? '비료 주기' : '설치'
        else contextAction = '사용'
      }
    }

    return {
      phase,
      day: s.day,
      clock: this.clockString(),
      period: this.periodLabel(),
      periodKey: this.period(),
      gold: s.gold,
      stamina: Math.round(s.stamina),
      maxStamina: s.maxStamina,
      water: s.water,
      waterMax: WATER_CAPACITY[s.toolUpgrades.watering_can],
      tools,
      items,
      inventory,
      toasts: [...this.toasts],
      dialogue: this.dialogue,
      shopBuy,
      tally: this.tally,
      shrine,
      ending: s.ending,
      endingText: this.endingText,
      contextAction,
      npcHearts,
      exhausted: s.player.exhausted,
      recipes: s.recipes,
      craft,
      crafting: { workbench: s.unlocks.workbench, workshop: s.unlocks.workshop },
      nearbyNpc: nearby,
      muted: this.audio.muted,
      musicOn: this.audio.musicOn,
    }
  }
}
