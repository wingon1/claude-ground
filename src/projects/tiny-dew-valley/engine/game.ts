import type { CookJob, Direction, GameState, InventorySlot, Tile } from '../types'
import type { ShopEntry } from '../types'
import { CROPS, CROP_LIST } from '../data/crops'
import { cropItemId, getItem } from '../data/items'
import { SHOP_CATALOG } from '../data/shopCatalog'
import { BUILD_OPTIONS } from '../data/buildOptions'
import { ANIMAL_FARMS, ANIMAL_FARM_MAX_ANIMALS, type AnimalFarmDef } from '../data/animalFarms'
import { ANIMAL_UPGRADES, type AnimalUpgradeDef } from '../data/animalUpgrades'
import { ACT2_FLAGS, ACT2_ITEMS, firstAvailableAct2Stage, type Act2StageDef } from '../data/act2Progression'
import { MINE_MAX_FLOOR, mineFloorDef } from '../data/mineFloors'
import { MONSTERS, type MonsterDef } from '../data/monsters'
import {
  COOK_BATCH_MAX,
  COOKING_FIRE_BUILD_COST,
  COOKING_FIRE_BUILT_FLAG,
  FIELD_ROW_BASE_GOLD,
  FIELD_ROW_BASE_WOOD,
  FIELD_ROW_GOLD_STEP,
  FIELD_ROW_WOOD_STEP,
  GAME_MIN_PER_SEC,
  BACKPACK_UPGRADE_PRICES,
  INV_BASE_ROWS,
  INV_BASE_SIZE,
  INV_COLUMNS,
  INV_MAX_SIZE,
  LEGACY_ID_MAP,
  ORDER_ITEM_POOL,
  RARE_ANIMAL_PRODUCTS,
  RESPAWN_SECS,
  STAGE_SECS_PER_DAY,
  START_MAX_HP,
  START_MAX_STAMINA,
  TUTORIAL_REWARDS,
  WALK_SPEED,
  WEATHER_TYPES,
  WORK_COST,
  WORK_INTERVAL,
  backpackUpgradeFlag,
} from '../data/gameBalance'
import {
  PASSIVES,
  PASSIVE_RARITIES,
  PASSIVE_RARITY_LABEL,
  passiveDef,
  type PassiveId,
  type PassiveRarity,
} from '../data/passives'
import {
  DEFAULT_FIELD_CROP,
  FIELD_PLOTS,
  FIELD_SIZE,
} from '../data/fields'
import {
  BLACKSMITH_NPC_LINES,
  PLAYER_AMBIENT_LINES,
  PLAYER_LOCKED_MINE_LINES,
  PLAYER_WEAK_TOOL_LINES,
  SHOP_NPC_LINES,
  SHOP_NPC_NEW_STOCK_LINES,
} from '../data/speechLines'
import {
  COOKING_FIRE_BASE_SLOTS,
  COOKING_FIRE_MAX_LEVEL,
  COOKING_FIRE_SLOTS_PER_LEVEL,
  COOKING_FIRE_UPGRADES,
} from '../data/cookingFire'
import { cropUnlockFlag } from '../data/unlocks'
import { RECIPES } from '../data/recipes'
import { INTRO_ARRIVAL_LINES } from '../data/intro'
import { OBSTACLE_DROP, OBSTACLE_HP, OBSTACLE_SOLID, TERRAIN_SOLID } from '../data/tiles'
import {
  canWildObstacleSpawn,
  generateWorld,
  idx,
  inBounds,
  LOCATIONS,
  setObstacle,
  stampBlacksmith,
  stampCookingFire,
  stampFarmhouse,
  stampMine,
  stampStore,
  stampTentSideProps,
  WORLD_H,
  WORLD_W,
} from './world'
import { buildSprites, T, type Sprites } from './sprites'
import { AudioEngine } from './audio'
import { deleteSave, loadGame, saveGame, SAVE_VERSION } from './save'
import { TOOL_BASE, TOOL_UPGRADES, type UpgradeableToolId } from '../data/toolUpgrades'
import type { Firefly, MineMonster, Particle, Period, SlimeBlob, SlimeTrail, SpeechBubble, SpeechSpeaker, WorkKind } from './gameTypes'
import { buildMineMonsters, buildMineTiles } from './mineRuntime'
import { buildUISnapshot } from './snapshotBuilder'
import { GameRenderer } from './renderer'
import type {
  IntroScene,
  ObjectiveTaskView,
  ObjectiveView,
  OrderView,
  ToastMsg,
  UIPhase,
  UISnapshot,
  WeatherView,
} from './uiSnapshot'

const WORK_RANGE = T * 1.5 // how close to a node before auto-working
const ORDER_NPC = { x: LOCATIONS.storeStand.x, y: LOCATIONS.storeStand.y }
const BLACKSMITH_NPC = { x: LOCATIONS.blacksmithNpc.x, y: LOCATIONS.blacksmithNpc.y }
const MINE_DOWN_REVEAL_LINES = [
  '내려가는 길이 생겼다!',
  '아래층으로 갈 수 있겠어.',
  '길이 열렸어. 더 내려가 보자.',
  '몬스터가 사라지니 길이 보이네.',
  '바닥 아래로 이어지는 통로야.',
  '조금 더 깊이 들어갈 수 있겠어.',
  '아래쪽에서 찬바람이 올라와.',
  '좋아, 다음 층으로 갈 차례야.',
]
const PLAYER_FAINT_WAKE_LOST_LINES = [
  '여기까지 어떻게 왔지.. 아이템을 잃어버렸어.',
  '너무 강한 상대를 만났군. 그래도 무사히 집에는 왔어.',
  '아이템을 잃어버렸어. 다음엔 더 조심해야겠어.',
  '가방이 가벼워졌어... 뭔가 잃어버렸나 봐.',
  '살아 돌아온 건 다행인데, 물건이 사라졌어.',
  '정신을 잃은 사이에 가방이 털린 것 같아.',
  '다음엔 욕심내지 말고 바로 돌아와야겠어.',
]
const PLAYER_FAINT_WAKE_SAFE_LINES = [
  '여기까지 어떻게 왔지.. 그래도 무사히 집에는 왔어.',
  '너무 강한 상대를 만났군. 장비를 더 챙겨야겠어.',
  '간신히 돌아왔어. 다음엔 무리하지 말자.',
  '눈 떠보니 텐트 앞이네. 운이 좋았어.',
  '몸은 아픈데 가방은 멀쩡한 것 같아.',
  '이번엔 잃어버린 게 없어서 다행이야.',
  '숨 좀 고르고 다시 생각하자.',
]
const PLAYER_BLACKSMITH_SITE_LINES = [
  '여긴 뭐가 생기는 거지?',
  '통나무랑 상자가 잔뜩 있네.',
  '누가 여기에 뭔가 지으려나 봐.',
  '공사 준비 중인 자리인가?',
  '연장 자국이 남아 있어.',
  '여기서 쇠 냄새가 나는 것 같기도 해.',
  '상자 안엔 뭐가 들어 있을까.',
  '누가 이 자리를 꽤 신경 써서 준비했네.',
  '나중에 중요한 곳이 될지도 몰라.',
]
const INTRO_WOODS_START = { x: 2 * T + T / 2, y: 11 * T + T }
const INTRO_WOODS_EDGE = { x: 8 * T + T / 2, y: 11 * T + T }
const INTRO_FIELD_EDGE = { x: 19 * T + T / 2, y: 11 * T + T }
const INTRO_TENT_APPROACH = { x: LOCATIONS.spawn.x * T + T / 2, y: LOCATIONS.spawn.y * T + T }

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
  private particles: Particle[] = []
  private fireflies: Firefly[] = []
  private speechBubbles: SpeechBubble[] = []
  private toasts: ToastMsg[] = []
  private toastId = 1
  private phase: UIPhase = 'title'
  private introScene: IntroScene = null
  private introT = 0
  private introLineStep = -1
  private fade = 0
  private fadeDir = 0
  private pendingWake = false
  private pendingFaint = false
  private workCooldown = 0
  private exhaustedNotified = false
  private target: { x: number; y: number } | null = null
  private stuckT = 0
  private keys = new Set<string>()
  private workTile: { x: number; y: number } | null = null
  private workTool: UpgradeableToolId | 'hand' | null = null
  private jumpT = 0
  private workAnimT = 0
  private playerHurtT = 0
  private playerFaintT = 0
  private playerAlertT = 0
  private nextNoSwordToastAt = 0
  private awardingTutorialReward = false
  private nextSpeechAt: Record<SpeechSpeaker | 'weakTool' | 'lockedMine' | 'blacksmithSite', number> = {
    player: 0,
    shop: 0,
    blacksmith: 0,
    weakTool: 0,
    lockedMine: 0,
    blacksmithSite: 0,
  }
  private area: 'farm' | 'mine' = 'farm'
  private mineTiles: Tile[] = []
  private mineFloor = 1
  private mineMonsters: MineMonster[] = []
  private slimeTrails: SlimeTrail[] = []
  private slimeBlobs: SlimeBlob[] = []
  private inBossFight = false
  private farmReturn: { x: number; y: number; dir: Direction } | null = null

  private listeners = new Set<() => void>()
  private snap: UISnapshot
  private lastEmit = 0
  private renderer = new GameRenderer()

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
    this.leaveMineRuntime()
    this.applyInitialUnlocks()
    this.applyFieldRows()
    this.initRuntime()
    this.phase = 'intro'
    this.introScene = 'newspaper'
    this.introT = 0
    this.introLineStep = -1
    this.audio.resume()
    this.audio.startMusic()
    this.emit()
  }

  startIntroArrival() {
    if (this.phase !== 'intro') return
    this.introScene = 'arrival'
    this.introT = 0
    this.introLineStep = -1
    this.fade = 0
    this.fadeDir = 0
    this.area = 'farm'
    const introTree = this.state.tiles[idx(1, 11)]
    introTree.terrain = 'grass'
    introTree.cropId = null
    introTree.metadata = { ...introTree.metadata }
    setObstacle(introTree, 'tree')
    const p = this.state.player
    p.x = INTRO_WOODS_START.x
    p.y = INTRO_WOODS_START.y
    p.dir = 'right'
    p.moving = true
    p.animTime = 0
    p.exhausted = false
    this.target = null
    this.workTile = null
    this.workTool = null
    this.speechBubbles = []
    this.emit()
  }

  finishIntro() {
    if (this.phase !== 'intro') return
    this.introScene = null
    this.introT = 0
    this.introLineStep = -1
    this.fade = 0
    this.fadeDir = 0
    const p = this.state.player
    p.x = INTRO_TENT_APPROACH.x
    p.y = INTRO_TENT_APPROACH.y
    p.dir = 'down'
    p.moving = false
    p.animTime = 0
    this.speechBubbles = []
    this.phase = 'playing'
    this.toast('숲 끝의 텐트에 도착했어요. 화면을 탭해 걸어보세요!', 'good')
    this.emit()
  }

  continueGame(): boolean {
    const s = loadGame()
    if (!s) return false
    if (s.tiles.length !== WORLD_W * WORLD_H) s.tiles = generateWorld()
    this.state = s
    this.leaveMineRuntime()
    this.applyInitialUnlocks()
    this.applyGroundCleanup()
    this.applyFieldRows()
    this.applyFieldExpansions(true)
    this.applyMineState()
    this.applyAnimalFarms()
    stampStore(this.state.tiles)
    stampFarmhouse(this.state.tiles)
    stampTentSideProps(this.state.tiles)
    stampCookingFire(this.state.tiles, this.cookingFireBuilt())
    this.initRuntime()
    this.introScene = null
    this.introT = 0
    this.introLineStep = -1
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
    for (let i = 0; i < INV_BASE_SIZE; i++) inv.push({ itemId: '', qty: 0 })
    return {
      saveVersion: SAVE_VERSION,
      day: 1,
      timeMinutes: 360,
      gold: 0,
      hp: START_MAX_HP,
      maxHp: START_MAX_HP,
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
    if (this.phase === 'intro') this.updateIntro(dt)
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
        } else if (this.pendingFaint) {
          this.recoverFromFaint()
          this.pendingFaint = false
          this.fadeDir = -1
        }
      } else if (this.fade <= 0 && this.fadeDir < 0) {
        this.fade = 0
        this.fadeDir = 0
      }
    }
    if (this.workCooldown > 0) this.workCooldown -= dt
    if (this.jumpT > 0) this.jumpT = Math.max(0, this.jumpT - dt)
    if (this.playerAlertT > 0) this.playerAlertT = Math.max(0, this.playerAlertT - dt)
    if (this.workAnimT > 0) {
      this.workAnimT = Math.max(0, this.workAnimT - dt)
      if (this.workAnimT <= 0 && this.workCooldown <= 0) {
        this.workTile = null
        this.workTool = null
      }
    }
    if (this.playerHurtT > 0) this.playerHurtT = Math.max(0, this.playerHurtT - dt)
    if (this.playerFaintT > 0) {
      this.playerFaintT = Math.max(0, this.playerFaintT - dt)
      if (this.playerFaintT <= 0 && this.pendingFaint && this.fadeDir === 0) this.fadeDir = 1
    }
  }

  private updateIntro(dt: number) {
    if (this.introScene !== 'arrival') return
    const p = this.state.player
    this.introT += dt
    this.speechBubbles = this.speechBubbles.filter((bubble) => bubble.until > this.nowSecs())
    if (this.introT < 2.2) {
      this.placeIntroPlayer(INTRO_WOODS_START, INTRO_WOODS_EDGE, this.introT / 2.2)
      if (this.introLineStep < 0 && this.introT > 0.35) {
        this.introLineStep = 0
        this.say('player', INTRO_ARRIVAL_LINES[0], 3.1)
      }
    } else if (this.introT < 4.0) {
      p.x = INTRO_WOODS_EDGE.x
      p.y = INTRO_WOODS_EDGE.y
      p.dir = 'right'
      p.moving = false
      if (this.introLineStep < 1 && this.introT > 2.45) {
        this.introLineStep = 1
        this.say('player', INTRO_ARRIVAL_LINES[1], 2.9)
      }
    } else if (this.introT < 6.8) {
      this.placeIntroPlayer(INTRO_WOODS_EDGE, INTRO_FIELD_EDGE, (this.introT - 4.0) / 2.8)
      if (this.introLineStep < 2 && this.introT > 4.3) {
        this.introLineStep = 2
        this.say('player', INTRO_ARRIVAL_LINES[2], 3.2)
      }
    } else if (this.introT < 10.2) {
      this.placeIntroPlayer(INTRO_FIELD_EDGE, INTRO_TENT_APPROACH, (this.introT - 6.8) / 3.4)
      if (this.introLineStep < 3 && this.introT > 7.1) {
        this.introLineStep = 3
        this.say('player', INTRO_ARRIVAL_LINES[3], 3.3)
      }
      if (this.introT > 8.0) this.fade = Math.min(1, (this.introT - 8.0) / 2.2)
    } else {
      this.finishIntro()
    }
  }

  private placeIntroPlayer(from: { x: number; y: number }, to: { x: number; y: number }, rawT: number) {
    const p = this.state.player
    const t = Math.max(0, Math.min(1, rawT))
    const eased = t * t * (3 - 2 * t)
    p.x = from.x + (to.x - from.x) * eased
    p.y = from.y + (to.y - from.y) * eased
    p.dir = to.x >= from.x ? 'right' : 'left'
    p.moving = true
    p.animTime = this.introT
  }

  // ---------------- update ----------------
  private update(dt: number) {
    const s = this.state
    s.timeMinutes += dt * GAME_MIN_PER_SEC // cosmetic clock
    if (this.pendingFaint) return
    this.movePlayer(dt)
    if (this.area === 'farm') {
      this.autoPlantFields()
      this.growCrops(dt)
      this.updateAnimalDrops(dt)
      this.respawnNodes()
      this.updateFireflies(dt)
    } else {
      this.updateMineMonsters(dt)
      this.updateSlimeBlobs(dt)
      this.updateSlimeTrails(dt)
      this.syncBattleMusic()
    }
    this.collectMagnetItems()
    if (!s.player.moving) this.tryAutoWork()
    this.updateSpeech()
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
    const speed = WALK_SPEED * (1 + this.passiveEffect('move_speed')) * dt
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
        if (this.tileSolid(this.activeTiles()[idx(tx, ty)])) return true
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
        if (this.area === 'farm' && this.state.tiles[idx(tx, ty)].metadata.animalFence === true) return true
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

  private activeTiles(): Tile[] {
    return this.area === 'mine' ? this.mineTiles : this.state.tiles
  }

  private leaveMineRuntime() {
    this.area = 'farm'
    this.mineTiles = []
    this.mineMonsters = []
    this.slimeTrails = []
    this.slimeBlobs = []
    this.mineFloor = 1
    this.farmReturn = null
    this.syncBattleMusic()
  }

  private deepestMineFloor(): number {
    const raw = this.state.flags['mine:deepestFloor']
    return typeof raw === 'number' ? Math.max(0, Math.min(MINE_MAX_FLOOR, Math.floor(raw))) : 0
  }

  private setDeepestMineFloor(floor: number) {
    this.state.flags['mine:deepestFloor'] = Math.max(this.deepestMineFloor(), Math.min(MINE_MAX_FLOOR, floor))
  }

  private passiveCountKey(id: PassiveId, rarity: PassiveRarity): string {
    return `passive:${id}:${rarity}`
  }

  private passiveEquipKey(slot: number): string {
    return `passive:equip:${slot}`
  }

  private passiveKey(id: PassiveId, rarity: PassiveRarity): string {
    return `${id}:${rarity}`
  }

  private parsePassiveKey(key: unknown): { id: PassiveId; rarity: PassiveRarity } | null {
    if (typeof key !== 'string') return null
    const [id, rarity] = key.split(':')
    if (!passiveDef(id)) return null
    if (!PASSIVE_RARITIES.includes(rarity as PassiveRarity)) return null
    return { id: id as PassiveId, rarity: rarity as PassiveRarity }
  }

  private passiveCount(id: PassiveId, rarity: PassiveRarity): number {
    const raw = this.state.flags[this.passiveCountKey(id, rarity)]
    return typeof raw === 'number' ? Math.max(0, Math.floor(raw)) : 0
  }

  private passiveSlotCount(): number {
    if (!this.mineUnlocked()) return 0
    const floor = this.deepestMineFloor()
    if (floor >= 10) return 3
    if (floor >= 5) return 2
    return 1
  }

  private equippedPassives(): { id: PassiveId; rarity: PassiveRarity }[] {
    const out: { id: PassiveId; rarity: PassiveRarity }[] = []
    for (let i = 0; i < this.passiveSlotCount(); i++) {
      const parsed = this.parsePassiveKey(this.state.flags[this.passiveEquipKey(i)])
      if (parsed) out.push(parsed)
    }
    return out
  }

  private passiveEffect(id: PassiveId): number {
    let value = 0
    for (const equipped of this.equippedPassives()) {
      if (equipped.id !== id) continue
      const def = passiveDef(equipped.id)
      if (def) value += def.values[equipped.rarity]
    }
    return value
  }

  private grantPassive(id: PassiveId, rarity: PassiveRarity) {
    const def = passiveDef(id)
    if (!def) return
    const key = this.passiveCountKey(id, rarity)
    const next = this.passiveCount(id, rarity) + 1
    this.state.flags[key] = next
    this.toast(`${PASSIVE_RARITY_LABEL[rarity]} ${def.name} 획득`, rarity === 'epic' ? 'good' : 'info')
  }

  equipPassive(id: PassiveId, rarity: PassiveRarity) {
    if (this.passiveCount(id, rarity) <= 0) return
    const slots = this.passiveSlotCount()
    if (slots <= 0) return
    const nextKey = this.passiveKey(id, rarity)
    for (let i = 0; i < slots; i++) {
      const parsed = this.parsePassiveKey(this.state.flags[this.passiveEquipKey(i)])
      if (parsed?.id === id) {
        this.state.flags[this.passiveEquipKey(i)] = nextKey
        this.audio.sfx('select')
        this.autosave()
        this.emit()
        return
      }
    }
    for (let i = 0; i < slots; i++) {
      if (!this.parsePassiveKey(this.state.flags[this.passiveEquipKey(i)])) {
        this.state.flags[this.passiveEquipKey(i)] = nextKey
        this.audio.sfx('select')
        this.autosave()
        this.emit()
        return
      }
    }
    this.toast('패시브 슬롯이 부족해요.', 'bad')
    this.audio.sfx('reject')
  }

  unequipPassive(slot: number) {
    if (slot < 0 || slot >= this.passiveSlotCount()) return
    delete this.state.flags[this.passiveEquipKey(slot)]
    this.audio.sfx('select')
    this.autosave()
    this.emit()
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
        const t = this.activeTiles()[idx(tx, ty)]
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
    if (this.workAnimT > 0) return
    if (this.workAnimT <= 0) {
      this.workTile = null
      this.workTool = null
    }
    if (this.fadeDir !== 0) return
    const monster = this.nearestAttackableMonster()
    if (monster) {
      if (this.countItem('sword') <= 0) {
        const now = this.nowSecs()
        if (now >= this.nextNoSwordToastAt) {
          this.nextNoSwordToastAt = now + 2.5
          this.toast('몬스터를 공격하려면 검이 필요해요.', 'bad')
          this.audio.sfx('reject')
        }
      } else {
        const p = this.state.player
        const tx = Math.floor(monster.x / T)
        const ty = Math.floor((monster.y - 8) / T)
        this.workTile = { x: tx, y: ty }
        this.workTool = 'sword'
        if (Math.abs(monster.x - p.x) > Math.abs(monster.y - p.y)) p.dir = monster.x > p.x ? 'right' : 'left'
        else p.dir = monster.y > p.y ? 'down' : 'up'
        if (this.workCooldown > 0) return
        this.workCooldown = WORK_INTERVAL
        this.workAnimT = 0.28
        this.hitMonster(monster)
        return
      }
    }
    const work = this.findWork()
    if (!work) return
    this.workTile = { x: work.t.x, y: work.t.y }
    this.workTool = this.toolForWork(work)
    // face the node
    const p = this.state.player
    const cx = work.t.x * T + T / 2
    const cy = work.t.y * T + T / 2
    if (Math.abs(cx - p.x) > Math.abs(cy - p.y)) p.dir = cx > p.x ? 'right' : 'left'
    else if (Math.abs(cy - p.y) > 2) p.dir = cy > p.y ? 'down' : 'up'
    this.maybeSayWeakTool(work)
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

  private toolForWork(work: { t: Tile; kind: WorkKind }): UpgradeableToolId | 'hand' | null {
    if (work.kind === 'pickup') return null
    if (work.kind === 'harvest') return 'scythe'
    if (work.kind === 'plant') return 'hand'
    const obstacle = work.t.obstacle
    if (obstacle === 'rock' || obstacle === 'copper_ore' || obstacle === 'iron_ore') return 'pickaxe'
    if (obstacle === 'tree' || obstacle === 'stump' || obstacle === 'large_stump') return 'axe'
    return 'scythe'
  }

  private nearestAttackableMonster(): MineMonster | null {
    if (this.area !== 'mine' || this.mineMonsters.length === 0) return null
    const p = this.state.player
    let best: { monster: MineMonster; d: number } | null = null
    for (const monster of this.mineMonsters) {
      const d = Math.hypot(monster.x - p.x, monster.y - p.y)
      if (d > WORK_RANGE + T * 0.5) continue
      if (!best || d < best.d) best = { monster, d }
    }
    return best?.monster ?? null
  }

  private monsterCollides(cx: number, cy: number): boolean {
    const x0 = Math.floor((cx - 5) / T)
    const x1 = Math.floor((cx + 5) / T)
    const y0 = Math.floor((cy - 6) / T)
    const y1 = Math.floor((cy - 0.5) / T)
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!inBounds(tx, ty)) return true
        if (this.tileSolid(this.activeTiles()[idx(tx, ty)])) return true
      }
    }
    return false
  }

  // Switch BGM/SFX into battle mode while the ooze boss is alive, and fire a
  // one-shot combat sting the moment the fight begins (e.g. entering floor 10).
  private syncBattleMusic() {
    const fighting = this.area === 'mine' && this.mineMonsters.some((m) => m.id === 'mine_guardian')
    if (fighting && !this.inBossFight) this.audio.sfx('battle')
    if (fighting !== this.inBossFight) {
      this.inBossFight = fighting
      this.audio.setBattle(fighting)
    }
  }

  private updateMineMonsters(dt: number) {
    if (this.area !== 'mine') return
    const p = this.state.player
    const now = performance.now() / 1000
    for (const monster of this.mineMonsters) {
      const def = MONSTERS[monster.id]
      const isBoss = monster.id === 'mine_guardian'
      monster.hitT = Math.max(0, monster.hitT - dt)
      monster.attackT = Math.max(0, monster.attackT - dt)
      if (isBoss && monster.castT) monster.castT = Math.max(0, monster.castT - dt)
      const dx = p.x - monster.x
      const dy = p.y - monster.y
      const d = Math.max(1, Math.hypot(dx, dy))

      if (isBoss) {
        this.updateBoss(monster, def, dt, now, dx, dy, d)
        continue
      }

      if (d < T * 7 && d > T * 1.15) {
        const step = def.speed * dt
        const nx = monster.x + (dx / d) * step
        const ny = monster.y + (dy / d) * step
        if (!this.monsterCollides(nx, monster.y)) monster.x = nx
        if (!this.monsterCollides(monster.x, ny)) monster.y = ny
      }
      if (d <= T * 1.2 && monster.attackT <= 0 && this.state.hp > 0 && !this.pendingFaint) {
        this.state.hp = Math.max(0, this.state.hp - def.attack)
        this.playerHurtT = 0.36
        monster.attackT = 1.2
        this.toast(`${def.name}에게 맞았어요.`, 'bad')
        this.audio.sfx('reject')
        if (this.state.hp <= 0) this.faintPlayer()
      }
    }
  }

  // Ooze boss: surge-and-stick crawl (꿀렁꿀렁/질뻑질뻑), leaves fading slime
  // smears, and periodically spits a fan of dirty liquid globs at the player.
  private updateBoss(
    monster: MineMonster,
    def: MonsterDef,
    dt: number,
    now: number,
    dx: number,
    dy: number,
    d: number,
  ) {
    const ph = monster.x * 0.7 + monster.y * 0.3
    // Lurching speed: near-zero between heaves, fast surges as the body slops forward.
    const surge = Math.pow(Math.max(0, Math.sin(now * 2.2 + ph)), 1.7)
    if (d < T * 9 && d > T * 1.0 && !monster.castT) {
      const step = def.speed * (0.18 + 1.5 * surge) * dt
      // Ooze a little sideways while advancing so the crawl looks slithery.
      const perp = Math.sin(now * 3.3 + ph) * 0.35
      const nx = monster.x + (dx / d) * step + (-dy / d) * step * perp
      const ny = monster.y + (dy / d) * step + (dx / d) * step * perp
      if (!this.monsterCollides(nx, monster.y)) monster.x = nx
      if (!this.monsterCollides(monster.x, ny)) monster.y = ny
    }

    // Drop a slime smear roughly every 0.26s, strongest during a surge.
    monster.trailT = (monster.trailT ?? 0) - dt
    if (monster.trailT <= 0) {
      this.slimeTrails.push({
        x: monster.x + (Math.random() - 0.5) * 6,
        y: monster.y - 2,
        life: 6.5,
        max: 6.5,
        r: 8 + Math.random() * 4 + surge * 3,
        seed: Math.random() * 99,
      })
      if (this.slimeTrails.length > 90) this.slimeTrails.shift()
      monster.trailT = 0.26
    }

    // Begin a spit when off cooldown and the player is in sight.
    if (monster.attackT <= 0 && monster.fireT === undefined && d < T * 8.5) {
      monster.castT = 0.55
      monster.fireT = 0.55
      monster.attackT = 2.6 + Math.random() * 0.7
      this.audio.sfx('reject')
    }
    if (monster.fireT !== undefined) {
      monster.fireT -= dt
      if (monster.fireT <= 0) {
        this.spawnSlimeSpray(monster)
        monster.fireT = undefined
      }
    }

    // Close-range slap still hurts.
    if (d <= T * 1.3 && monster.attackT <= 0 && this.state.hp > 0 && !this.pendingFaint) {
      this.state.hp = Math.max(0, this.state.hp - def.attack)
      this.playerHurtT = 0.36
      monster.attackT = 1.4
      this.slimeSplat(this.state.player.x, this.state.player.y - 8, true)
      this.toast(`${def.name}의 점액에 휩쓸렸어요.`, 'bad')
      this.audio.sfx('reject')
      if (this.state.hp <= 0) this.faintPlayer()
    }
  }

  // Launch an arcing fan of dirty-liquid globs toward the player.
  private spawnSlimeSpray(monster: MineMonster) {
    const p = this.state.player
    const ox = monster.x
    const oy = monster.y - 16
    const baseAng = Math.atan2(p.y - 10 - oy, p.x - ox)
    const n = 5
    for (let i = 0; i < n; i++) {
      const spread = (i - (n - 1) / 2) * 0.24 + (Math.random() - 0.5) * 0.08
      const ang = baseAng + spread
      const speed = 95 + Math.random() * 55
      this.slimeBlobs.push({
        x: ox,
        y: oy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed - 34,
        life: 1.5,
        max: 1.5,
        r: 2.6 + Math.random() * 1.6,
        spin: Math.random() * 6,
        hit: false,
      })
    }
    // Muzzle burst at the mouth — flashy launch.
    for (let i = 0; i < 12; i++) {
      const a = baseAng + (Math.random() - 0.5) * 1.0
      const sp = 30 + Math.random() * 70
      this.particles.push({
        x: ox,
        y: oy,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        life: 0.45,
        max: 0.45,
        color: Math.random() < 0.3 ? '#6a5a2c' : '#52c94a',
        size: 1.6,
        gravity: 120,
        additive: false,
      })
    }
    this.audio.sfx('crack')
  }

  private updateSlimeBlobs(dt: number) {
    const p = this.state.player
    for (let i = this.slimeBlobs.length - 1; i >= 0; i--) {
      const b = this.slimeBlobs[i]
      b.life -= dt
      b.vy += 150 * dt
      b.x += b.vx * dt
      b.y += b.vy * dt
      b.spin += dt * 12
      // Splat on the player.
      if (!b.hit && this.state.hp > 0 && !this.pendingFaint) {
        const pdx = p.x - b.x
        const pdy = p.y - 10 - b.y
        if (Math.hypot(pdx, pdy) < T * 0.8) {
          b.hit = true
          const dmg = Math.max(2, Math.ceil(MONSTERS.mine_guardian.attack * 0.5))
          this.state.hp = Math.max(0, this.state.hp - dmg)
          this.playerHurtT = 0.32
          this.slimeSplat(b.x, b.y, true)
          this.audio.sfx('reject')
          this.slimeBlobs.splice(i, 1)
          if (this.state.hp <= 0) this.faintPlayer()
          continue
        }
      }
      if (b.life <= 0) {
        this.slimeSplat(b.x, b.y, false)
        this.slimeBlobs.splice(i, 1)
      }
    }
  }

  private updateSlimeTrails(dt: number) {
    for (let i = this.slimeTrails.length - 1; i >= 0; i--) {
      const tr = this.slimeTrails[i]
      tr.life -= dt
      if (tr.life <= 0) this.slimeTrails.splice(i, 1)
    }
  }

  // Bursting goo: a spray of green/brown particles plus a short-lived smear.
  private slimeSplat(x: number, y: number, big: boolean) {
    const count = big ? 10 : 6
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const sp = 20 + Math.random() * (big ? 70 : 40)
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 18,
        life: 0.5,
        max: 0.5,
        color: Math.random() < 0.3 ? '#5a4a2a' : Math.random() < 0.5 ? '#2c7a3a' : '#6fce5a',
        size: 1.5,
        gravity: 130,
        additive: false,
      })
    }
    this.slimeTrails.push({
      x,
      y,
      life: big ? 2.8 : 1.6,
      max: big ? 2.8 : 1.6,
      r: big ? 6 : 4,
      seed: Math.random() * 99,
    })
    if (this.slimeTrails.length > 90) this.slimeTrails.shift()
  }

  private hitMonster(monster: MineMonster) {
    const damage = this.toolDamage('sword') + Math.floor(this.passiveEffect('attack'))
    monster.hp -= damage
    monster.hitT = 0.2
    this.audio.sfx('crack')
    if (monster.id === 'mine_guardian') this.slimeSplat(monster.x, monster.y - 14, true)
    else this.dirtPuff(monster.x, monster.y - 8, MONSTERS[monster.id].accent)
    if (monster.hp > 0) {
      this.emit()
      return
    }
    this.defeatMonster(monster)
  }

  private defeatMonster(monster: MineMonster) {
    const def = MONSTERS[monster.id]
    this.mineMonsters = this.mineMonsters.filter((m) => m.uid !== monster.uid)
    for (const drop of def.drops) {
      if (Math.random() > drop.chance) continue
      const qty = drop.minQty + Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1))
      this.dropGroundItemNear(monster.x, monster.y, drop.itemId, qty)
    }
    if (monster.id === 'mine_guardian') {
      this.completeMineGuardianClear(def)
    } else {
      this.rollPassiveDrop(def)
      this.toast(`${def.name} 처치`, 'good')
    }
    if (this.mineMonsters.length === 0) this.revealMineDownNear(monster.x, monster.y)
    this.audio.sfx('sparkle')
    this.emit()
  }

  private revealMineDownNear(x: number, y: number) {
    if (this.area !== 'mine' || this.mineFloor >= MINE_MAX_FLOOR || this.mineDownRevealed()) return
    const origin = {
      x: Math.max(21, Math.min(36, Math.floor(x / T))),
      y: Math.max(11, Math.min(23, Math.floor((y - 8) / T))),
    }
    const offsets: [number, number][] = [
      [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1],
      [2, 0], [-2, 0], [0, 2], [0, -2],
    ]
    for (const [dx, dy] of offsets) {
      const tx = origin.x + dx
      const ty = origin.y + dy
      if (!inBounds(tx, ty)) continue
      const t = this.mineTiles[idx(tx, ty)]
      if (t.terrain === 'blocked' || t.metadata.mineExit || t.obstacle || this.groundItemId(t)) continue
      t.metadata.mineDown = true
      t.cropId = null
      t.hp = undefined
      this.say('player', this.pickLine(MINE_DOWN_REVEAL_LINES), 3.8)
      this.toast('아래층으로 내려가는 길이 열렸어요.', 'good')
      return
    }
  }

  private mineDownRevealed(): boolean {
    return this.mineTiles.some((tile) => tile.metadata.mineDown === true)
  }

  private faintPlayer() {
    if (this.pendingFaint) return
    this.pendingFaint = true
    this.target = null
    this.workTile = null
    this.workTool = null
    this.state.player.moving = false
    this.playerHurtT = 0
    this.playerFaintT = 0.65
    this.fadeDir = 0
    this.audio.sfx('reject')
    this.emit()
  }

  private recoverFromFaint() {
    const lost = this.loseFaintItems()
    const p = this.state.player
    this.area = 'farm'
    this.mineTiles = []
    this.mineMonsters = []
    this.slimeTrails = []
    this.slimeBlobs = []
    this.farmReturn = null
    this.syncBattleMusic()
    p.x = LOCATIONS.spawn.x * T + T / 2
    p.y = LOCATIONS.spawn.y * T + T
    p.dir = 'down'
    p.moving = false
    this.target = null
    this.workTile = null
    this.workTool = null
    this.state.hp = this.state.maxHp
    this.playerHurtT = 0
    this.playerFaintT = 0
    this.phase = 'playing'
    this.toast(lost.length ? `기절했어요. 잃어버린 아이템: ${lost.join(', ')}` : '기절했지만 잃어버린 아이템은 없어요.', 'bad')
    this.say('player', this.pickLine(lost.length ? PLAYER_FAINT_WAKE_LOST_LINES : PLAYER_FAINT_WAKE_SAFE_LINES), 5.2)
    this.autosave()
    this.emit()
  }

  private loseFaintItems(): string[] {
    const candidates = this.state.inventory
      .map((slot) => ({ slot, item: slot.itemId ? getItem(slot.itemId) : null }))
      .filter((entry) =>
        entry.slot.itemId &&
        entry.slot.qty > 0 &&
        entry.item &&
        entry.item.important !== true &&
        entry.item.id !== 'sword' &&
        entry.item.type !== 'seed' &&
        entry.item.type !== 'placeable' &&
        entry.item.type !== 'misc',
      )
    if (candidates.length === 0) return []
    const shuffled = [...candidates].sort(() => Math.random() - 0.5)
    const lossCount = Math.min(3, Math.max(1, Math.ceil(shuffled.length * 0.2)))
    const lost: string[] = []
    for (const entry of shuffled.slice(0, lossCount)) {
      const qty = Math.max(1, Math.ceil(entry.slot.qty * 0.25))
      this.removeItem(entry.slot.itemId, qty)
      lost.push(`${entry.item?.name ?? entry.slot.itemId} ${qty}개`)
    }
    return lost
  }

  private completeMineGuardianClear(monster: MonsterDef) {
    const key = ACT2_FLAGS.mineGuardianCleared
    const firstClear = this.state.flags[key] !== true
    this.grantPassive(this.pickWeightedPassive(monster).id, firstClear ? 'epic' : 'rare')
    if (firstClear) {
      this.state.flags[key] = true
      this.state.gold += 1000
      this.toast('광산 10층 클리어! 에픽 패시브와 1000G를 얻었어요.', 'good')
    } else {
      this.toast('광산 수호자 처치! 레어 패시브를 얻었어요.', 'good')
    }
    this.autosave()
  }

  private rollPassiveDrop(monster: MonsterDef) {
    const floor = mineFloorDef(this.mineFloor)
    const dropChance = Math.min(0.95, floor.passiveDropChance + monster.passiveDropBonus + this.passiveDropChanceBonus())
    if (Math.random() > dropChance) return
    const passive = this.pickWeightedPassive(monster)
    const rarity = this.pickPassiveRarity(monster)
    this.grantPassive(passive.id, rarity)
    this.autosave()
  }

  private pickWeightedPassive(monster: MonsterDef) {
    const weights = PASSIVES.map((passive) => ({
      passive,
      weight: monster.passiveWeights?.[passive.id] ?? 1,
    }))
    const total = weights.reduce((sum, entry) => sum + entry.weight, 0)
    let roll = Math.random() * total
    for (const entry of weights) {
      roll -= entry.weight
      if (roll <= 0) return entry.passive
    }
    return weights[weights.length - 1].passive
  }

  private pickPassiveRarity(monster: MonsterDef): PassiveRarity {
    const base = { ...mineFloorDef(this.mineFloor).rarityChance }
    for (const rarity of PASSIVE_RARITIES) base[rarity] += monster.rarityBonus?.[rarity] ?? 0
    const total = PASSIVE_RARITIES.reduce((sum, rarity) => sum + Math.max(0, base[rarity]), 0)
    let roll = Math.random() * Math.max(0.001, total)
    for (const rarity of PASSIVE_RARITIES) {
      roll -= Math.max(0, base[rarity])
      if (roll <= 0) return rarity
    }
    return 'normal'
  }

  private dropGroundItemNear(x: number, y: number, itemId: string, qty: number) {
    const tx = Math.floor(x / T)
    const ty = Math.floor((y - 8) / T)
    for (let r = 0; r <= 2; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const px = tx + dx
          const py = ty + dy
          if (!inBounds(px, py)) continue
          const t = this.activeTiles()[idx(px, py)]
          if (this.tileSolid(t) || t.cropId || this.groundItemId(t)) continue
          t.metadata.groundItemId = itemId
          t.metadata.groundItemQty = qty
          return
        }
      }
    }
    this.giveItem(itemId, qty)
  }

  private collectMagnetItems() {
    const rangeTiles = this.passiveEffect('magnet')
    if (rangeTiles <= 0) return
    const p = this.state.player
    const range = rangeTiles * T
    let best: { t: Tile; d: number } | null = null
    for (const t of this.activeTiles()) {
      if (!this.groundItemId(t)) continue
      const cx = t.x * T + T / 2
      const cy = t.y * T + T / 2
      const d = Math.hypot(cx - p.x, cy - p.y)
      if (d > range) continue
      if (!best || d < best.d) best = { t, d }
    }
    if (best) this.pickupGroundItem(best.t)
  }

  private chopObstacle(t: Tile) {
    if (!t.obstacle) return
    const ob = t.obstacle
    const px = t.x * T + T / 2
    const py = t.y * T + T / 2
    if (ob === 'weed') {
      if (!this.spendStamina(WORK_COST.chop)) return
      this.clearObs(t)
      this.giveItem('fiber', 1)
      this.audio.sfx('harvest')
      this.leafBurst(px, py, '#56a84a')
      this.emit()
      return
    }
    if (ob === 'flower') {
      if (!this.spendStamina(WORK_COST.harvest)) return
      this.clearObs(t)
      t.metadata.respawnAt = this.nowSecs() + RESPAWN_SECS
      t.metadata.respawnKind = ob
      this.giveItem('daffodil', 1)
      this.audio.sfx('harvest')
      this.leafBurst(px, py, '#ffe14d')
      this.emit()
      return
    }
    const mining = ob === 'rock' || ob === 'copper_ore' || ob === 'iron_ore'
    const woodcutting = ob === 'tree' || ob === 'stump' || ob === 'large_stump'
    if (mining) {
      const requiredLevel = ob === 'iron_ore' ? 1 : 0
      if (this.toolLevel('pickaxe') < requiredLevel) {
        this.toast('더 좋은 곡괭이가 필요해요.', 'bad')
        this.audio.sfx('reject')
        return
      }
    }
    if (!this.spendStamina(WORK_COST.chop)) return
    const damage = mining ? this.toolDamage('pickaxe') : woodcutting ? this.toolDamage('axe') : 1
    t.hp = (t.hp ?? OBSTACLE_HP[ob]) - damage
    this.audio.sfx(mining ? 'crack' : 'chop')
    if (mining) this.dirtPuff(px, py, ob === 'copper_ore' ? '#c8753a' : ob === 'iron_ore' ? '#c8ccd6' : '#9a9a9a')
    else this.woodChips(px, py)
    if (t.hp <= 0) {
      const drop = OBSTACLE_DROP[ob]
      if (drop) {
        this.giveItem(drop.itemId, drop.qty)
        if (Math.random() < this.resourceBonusChance()) this.giveItem(drop.itemId, 1)
        if (mining && Math.random() < this.passiveEffect('ore_bonus')) this.giveItem(drop.itemId, 1)
      }
      if (ob === 'copper_ore' || ob === 'iron_ore') this.giveItem('stone', 1)
      this.audio.sfx('crack')
      const renewable = !!t.metadata.renewable
      const mineNode = t.metadata.mineNode === true
      this.clearObs(t)
      if (mineNode) {
        t.metadata.mineNode = true
      } else if (renewable) {
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
        if (kind === 'flower') {
          if (!this.canRespawnForestFlower(t)) {
            delete t.metadata.respawnAt
            delete t.metadata.respawnKind
            continue
          }
          setObstacle(t, 'flower')
          delete t.metadata.respawnAt
          delete t.metadata.respawnKind
          continue
        }
        if (this.isMineResource(kind) && t.metadata.mineNode !== true) {
          delete t.metadata.respawnAt
          delete t.metadata.respawnKind
          continue
        }
        if (!canWildObstacleSpawn(this.state.tiles, t.x, t.y)) {
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
    if (!this.spendStamina(WORK_COST.plant)) return
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
      const matureSecs = crop.growDays * STAGE_SECS_PER_DAY * this.cropGrowthMultiplier()
      const stage = Math.min(crop.stages - 1, Math.floor((grow / matureSecs) * (crop.stages - 1)))
      if (stage !== t.growthStage) {
        t.growthStage = stage
        delete t.metadata.harvestHp
      }
    }
  }

  private canRespawnForestFlower(t: Tile): boolean {
    const woods = LOCATIONS.woods
    return (
      t.x >= woods.x &&
      t.x < woods.x + woods.w &&
      t.y >= woods.y &&
      t.y < woods.y + woods.h &&
      t.terrain === 'grass' &&
      !t.obstacle &&
      !t.cropId
    )
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
    if (!this.spendStamina(WORK_COST.harvest)) return
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
    if (Math.random() < this.passiveEffect('crop_yield')) this.giveItem(itemId, 1)
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

  useInventoryItem(index: number) {
    const slot = this.state.inventory[index]
    if (!slot?.itemId || slot.qty <= 0) return
    const item = getItem(slot.itemId)
    if (!item || item.id !== 'herbal_tea') {
      this.toast('아직 먹을 수 없는 아이템이에요.', 'bad')
      this.audio.sfx('reject')
      this.emit()
      return
    }
    if (this.state.hp >= this.state.maxHp) {
      this.toast('HP가 이미 가득 차 있어요.', 'bad')
      this.audio.sfx('reject')
      this.emit()
      return
    }
    const heal = item.hpRestore ?? 10
    const before = this.state.hp
    this.state.hp = Math.min(this.state.maxHp, this.state.hp + heal)
    this.removeItem(item.id, 1)
    this.toast(`HP +${this.state.hp - before}`, 'good')
    this.audio.sfx('eat')
    this.autosave()
    this.emit()
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
    if (Math.random() < this.passiveEffect('stamina_save')) return true
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
    this.ensureDailyOrders()
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
    if (!this.flagEnabled('talk:blacksmith:intro')) {
      this.state.flags['talk:blacksmith:intro'] = true
      this.autosave()
    }
    this.phase = 'blacksmith'
    this.target = null
    this.audio.resume()
    this.audio.sfx('select')
    this.emit()
  }

  openBlacksmithBuy() {
    if (this.phase !== 'playing') return
    if (!this.mineUnlocked() || !this.nearBlacksmith()) {
      this.toast('대장간 근처에서만 구매할 수 있어요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (!this.flagEnabled('talk:blacksmith:intro')) {
      this.state.flags['talk:blacksmith:intro'] = true
      this.autosave()
    }
    this.phase = 'blacksmithBuy'
    this.target = null
    this.audio.resume()
    this.audio.sfx('select')
    this.emit()
  }

  enterMine() {
    if (this.phase !== 'playing' || !this.mineUnlocked() || !this.nearMineEntrance()) return
    const p = this.state.player
    this.farmReturn = { x: p.x, y: p.y, dir: p.dir }
    this.area = 'mine'
    this.mineFloor = 1
    this.mineTiles = buildMineTiles(this.mineFloor)
    this.mineMonsters = buildMineMonsters(this.mineFloor)
    this.slimeTrails = []
    this.slimeBlobs = []
    this.setDeepestMineFloor(this.mineFloor)
    p.x = 28 * T + T / 2
    p.y = 23 * T
    p.dir = 'up'
    p.moving = false
    this.target = null
    this.workTile = null
    this.fade = 1
    this.fadeDir = -1
    this.toast(`광산 ${this.mineFloor}층`, 'info')
    this.audio.sfx('select')
    this.emit()
  }

  exitMine() {
    if (this.phase !== 'playing' || this.area !== 'mine' || !this.nearMineExit()) return
    this.phase = 'mineExitConfirm'
    this.target = null
    this.emit()
  }

  cancelExitMine() {
    if (this.phase === 'mineExitConfirm') {
      this.phase = 'playing'
      this.emit()
    }
  }

  confirmExitMine() {
    if (this.phase !== 'mineExitConfirm' || this.area !== 'mine') return
    const p = this.state.player
    const ret = this.farmReturn
    this.area = 'farm'
    this.mineTiles = []
    p.x = ret?.x ?? (LOCATIONS.mine.x * T + T / 2)
    p.y = ret?.y ?? ((LOCATIONS.mine.y + 2) * T)
    p.dir = 'down'
    p.moving = false
    this.target = null
    this.workTile = null
    this.mineFloor = 1
    this.mineMonsters = []
    this.slimeTrails = []
    this.slimeBlobs = []
    this.farmReturn = null
    this.syncBattleMusic()
    this.phase = 'playing'
    this.fade = 1
    this.fadeDir = -1
    this.audio.sfx('select')
    this.emit()
  }

  descendMine() {
    if (this.phase !== 'playing' || this.area !== 'mine' || !this.nearMineDown()) return
    if (this.mineFloor >= MINE_MAX_FLOOR) {
      this.toast(`현재 광산은 ${MINE_MAX_FLOOR}층까지예요.`, 'info')
      this.audio.sfx('reject')
      return
    }
    this.mineFloor += 1
    this.mineTiles = buildMineTiles(this.mineFloor)
    this.mineMonsters = buildMineMonsters(this.mineFloor)
    this.slimeTrails = []
    this.slimeBlobs = []
    this.setDeepestMineFloor(this.mineFloor)
    const p = this.state.player
    p.x = 28 * T + T / 2
    p.y = 23 * T
    p.dir = 'up'
    p.moving = false
    this.target = null
    this.workTile = null
    this.fade = 1
    this.fadeDir = -1
    this.toast(`광산 ${this.mineFloor}층`, 'info')
    this.audio.sfx('select')
    this.emit()
  }

  teleportToMineFloorForTest(floor = 10) {
    if (this.phase !== 'playing') return
    const p = this.state.player
    if (this.area !== 'mine') {
      this.farmReturn = { x: p.x, y: p.y, dir: p.dir }
    }
    const nextFloor = Math.max(1, Math.min(MINE_MAX_FLOOR, Math.floor(floor)))
    this.area = 'mine'
    this.mineFloor = nextFloor
    this.mineTiles = buildMineTiles(this.mineFloor)
    this.mineMonsters = buildMineMonsters(this.mineFloor)
    this.slimeTrails = []
    this.slimeBlobs = []
    this.setDeepestMineFloor(this.mineFloor)
    p.x = 28 * T + T / 2
    p.y = 23 * T
    p.dir = 'up'
    p.moving = false
    this.target = null
    this.workTile = null
    this.workTool = null
    this.fade = 1
    this.fadeDir = -1
    this.toast(`테스트: 광산 ${this.mineFloor}층으로 이동`, 'info')
    this.audio.sfx('select')
    this.emit()
  }

  closeOrder() {
    if (this.phase === 'order') {
      this.phase = 'playing'
      this.emit()
    }
  }

  completeOrder(slot = 0) {
    if (this.phase !== 'order') return
    const orders = this.currentOrders()
    const order = orders.find((candidate) => candidate.slot === slot)
      ?? orders.find((candidate) => candidate.canComplete)
      ?? orders[0]
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
    this.state.flags[this.orderCompletedKey(this.state.day, order.slot)] = true
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
        completed = true
        if (nextQty > 0) {
          remaining.push({
            ...job,
            totalQty: Math.max(1, Math.floor(job.totalQty ?? remainingQty)),
            remainingQty: nextQty,
            remainingSecs: recipe.craftSeconds,
          })
        } else {
          this.toast(`${recipe.name} 완성!`, 'good')
          this.audio.sfx('sparkle')
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
    if (this.phase === 'shop' || this.phase === 'build' || this.phase === 'blacksmith' || this.phase === 'blacksmithBuy' || this.phase === 'cook' || this.phase === 'seed' || this.phase === 'order') {
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
      remainingSecs: Math.max(1, recipe.craftSeconds * (1 - this.passiveEffect('cook_speed'))),
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
    if (toolId === 'sword' && this.countItem('sword') <= 0) {
      this.toast('검을 먼저 구매해야 업그레이드할 수 있어요.', 'bad')
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
      const def = getItem(itemId)
      if (entry.grantsFlag.startsWith('upgrade:backpack:')) {
        this.ensureInventoryCapacity()
        this.toast(`가방이 ${this.inventoryRows()}줄로 확장됐어요!`, 'good')
      } else {
        this.applyAnimalFarms()
        this.toast(`${def?.name ?? '콘텐츠'} 해금!`, 'good')
      }
    } else {
      this.giveItem(itemId, 1)
    }
    this.audio.sfx('coin')
    this.autosave()
    this.emit()
  }

  buyBlacksmithItem(itemId: string) {
    if (this.phase !== 'blacksmithBuy') return
    if (itemId !== 'sword') return
    const price = 500
    const s = this.state
    if (this.countItem(itemId) > 0) {
      this.toast('이미 가지고 있어요.', 'info')
      return
    }
    if (s.gold < price) {
      this.toast('골드가 부족해요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    if (!this.canAccept(itemId, 1)) {
      this.toast('가방이 가득 찼어요.', 'bad')
      this.audio.sfx('reject')
      return
    }
    s.gold -= price
    this.giveItem(itemId, 1)
    this.toast('검을 샀어요.', 'good')
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
    s.hp = s.maxHp
    s.stamina = s.maxStamina
    s.player.exhausted = false
    this.exhaustedNotified = false
    s.day++
    s.timeMinutes = 360
    this.ensureDailyOrders()
    this.ensureDailyWeather()
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
    if (this.area !== 'farm') return false
    const p = this.playerTile()
    const b = LOCATIONS.bed
    return Math.abs(p.x - b.x) <= 1 && Math.abs(p.y - b.y) <= 1
  }

  private canSleep(): boolean {
    return this.state.stamina <= 0
  }

  private nearStore(): boolean {
    return this.nearStoreFront()
  }

  private nearStoreFront(): boolean {
    if (this.area !== 'farm') return false
    const p = this.playerTile()
    const front = LOCATIONS.storeFront
    return Math.abs(p.x - front.x) <= 3 && p.y >= front.y - 1 && p.y <= front.y
  }

  private nearOrderNpc(): boolean {
    if (this.area !== 'farm') return false
    const p = this.playerTile()
    return Math.abs(p.x - ORDER_NPC.x) <= 1 && Math.abs(p.y - ORDER_NPC.y) <= 1
  }

  private nearBlacksmith(): boolean {
    if (this.area !== 'farm' || !this.mineUnlocked()) return false
    const p = this.playerTile()
    return Math.abs(p.x - BLACKSMITH_NPC.x) <= 1 && Math.abs(p.y - BLACKSMITH_NPC.y) <= 1
  }

  private nearBlacksmithSite(): boolean {
    if (this.area !== 'farm' || this.mineUnlocked()) return false
    const p = this.playerTile()
    const site = LOCATIONS.blacksmith
    return p.x >= site.x - 1 && p.x <= site.x + 5 && p.y >= site.y - 1 && p.y <= site.y + 5
  }

  private nearBuild(): boolean {
    return this.area === 'farm'
  }

  private nearCooking(): boolean {
    if (this.area !== 'farm') return false
    return this.cookingFireBuilt() && this.nearTileMetadata('cookingFire')
  }

  private nearMineEntrance(): boolean {
    return this.area === 'farm' && this.mineUnlocked() && this.nearTileMetadata('mineEntrance')
  }

  private nearMineExit(): boolean {
    return this.area === 'mine' && this.nearTileMetadata('mineExit')
  }

  private nearMineDown(): boolean {
    return this.area === 'mine' && this.nearTileMetadata('mineDown')
  }

  private nearTileMetadata(key: string): boolean {
    const pt = this.playerTile()
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const t = inBounds(pt.x + dx, pt.y + dy)
          ? this.activeTiles()[idx(pt.x + dx, pt.y + dy)]
          : null
        if (t && t.metadata[key]) return true
      }
    }
    return false
  }

  private activeSpeechBubbles(): SpeechBubble[] {
    const now = this.nowSecs()
    const latestBySpeaker = new Map<SpeechSpeaker, SpeechBubble>()
    for (const bubble of this.speechBubbles) {
      if (bubble.until <= now) continue
      if (bubble.speaker === 'player' && this.state.player.exhausted) continue
      const previous = latestBySpeaker.get(bubble.speaker)
      if (!previous || bubble.until >= previous.until) latestBySpeaker.set(bubble.speaker, bubble)
    }
    return [...latestBySpeaker.values()]
  }

  private say(speaker: SpeechSpeaker, text: string, seconds = 4.2) {
    if (speaker === 'player' && this.state.player.exhausted) return
    const now = this.nowSecs()
    this.speechBubbles = this.speechBubbles.filter((bubble) => bubble.until > now && bubble.speaker !== speaker)
    this.speechBubbles.push({ speaker, text, until: now + seconds })
  }

  private pickLine(lines: string[]): string {
    return lines[Math.floor(Math.random() * lines.length)] ?? ''
  }

  private hasSpeech(speaker: SpeechSpeaker): boolean {
    const now = this.nowSecs()
    return this.speechBubbles.some((bubble) => bubble.speaker === speaker && bubble.until > now)
  }

  private updateSpeech() {
    const now = this.nowSecs()
    this.speechBubbles = this.speechBubbles.filter((bubble) => bubble.until > now)
    if (this.state.player.exhausted) {
      this.speechBubbles = this.speechBubbles.filter((bubble) => bubble.speaker !== 'player')
    }
    if (this.phase !== 'playing') return
    if (this.area === 'farm') {
      this.updateNpcSpeech(now)
      this.updateLockedMineSpeech(now)
      this.updateBlacksmithSiteSpeech(now)
    }
    this.updatePlayerAmbientSpeech(now)
  }

  private updateNpcSpeech(now: number) {
    if (this.nearStore() || this.nearStoreFront() || this.nearOrderNpc()) {
      if (this.trySayNewShopStock()) {
        this.nextSpeechAt.shop = now + 7
      } else if (now >= this.nextSpeechAt.shop && !this.hasSpeech('shop')) {
        this.nextSpeechAt.shop = now + 7 + Math.random() * 5
        if (Math.random() < 0.45) this.say('shop', this.pickLine(SHOP_NPC_LINES))
      }
    }
    if (this.nearBlacksmith() && now >= this.nextSpeechAt.blacksmith && !this.hasSpeech('blacksmith')) {
      this.nextSpeechAt.blacksmith = now + 8 + Math.random() * 6
      if (Math.random() < 0.45) this.say('blacksmith', this.pickLine(BLACKSMITH_NPC_LINES))
    }
  }

  private updateLockedMineSpeech(now: number) {
    if (this.state.player.exhausted) return
    if (this.mineUnlocked()) return
    if (!this.nearTileMetadata('mineEntrance') && !this.nearTileMetadata('mineBoard')) return
    if (now < this.nextSpeechAt.lockedMine) return
    this.nextSpeechAt.lockedMine = now + 7
    this.say('player', this.pickLine(PLAYER_LOCKED_MINE_LINES), 3.8)
  }

  private updateBlacksmithSiteSpeech(now: number) {
    if (this.state.player.exhausted) return
    if (!this.nearBlacksmithSite()) return
    if (now < this.nextSpeechAt.blacksmithSite || this.hasSpeech('player')) return
    this.nextSpeechAt.blacksmithSite = now + 8
    this.say('player', this.pickLine(PLAYER_BLACKSMITH_SITE_LINES), 3.8)
  }

  private updatePlayerAmbientSpeech(now: number) {
    if (this.state.player.exhausted) return
    if (now < this.nextSpeechAt.player || this.hasSpeech('player')) return
    this.nextSpeechAt.player = now + 16 + Math.random() * 18
    if (Math.random() < 0.22) this.say('player', this.pickLine(PLAYER_AMBIENT_LINES), 3.8)
  }

  private trySayNewShopStock(): boolean {
    const entry = SHOP_CATALOG.find((candidate) =>
      candidate.requiresFlag &&
      this.shopEntryVisible(candidate) &&
      this.state.flags[this.shopStockSpeechKey(candidate.itemId)] !== true,
    )
    if (!entry) return false
    this.state.flags[this.shopStockSpeechKey(entry.itemId)] = true
    this.say('shop', this.pickLine(SHOP_NPC_NEW_STOCK_LINES), 4.4)
    return true
  }

  private shopStockSpeechKey(itemId: string): string {
    return `speech:shopStock:${itemId}`
  }

  private shopEntryVisible(entry: ShopEntry): boolean {
    if (!this.flagEnabled(entry.requiresFlag)) return false
    if (this.isAnimalPermitEntry(entry)) return false
    if (entry.grantsFlag && this.flagEnabled(entry.grantsFlag)) return false
    if (entry.animalUpgradeId) {
      const upgrade = ANIMAL_UPGRADES.find((candidate) => candidate.id === entry.animalUpgradeId)
      if (!upgrade || this.animalUpgradeLevel(upgrade) >= upgrade.maxLevel) return false
    }
    return true
  }

  private maybeSayWeakTool(work: { t: Tile; kind: WorkKind }) {
    if (this.state.player.exhausted) return
    if (work.kind !== 'chop' && work.kind !== 'harvest') return
    const now = this.nowSecs()
    if (now < this.nextSpeechAt.weakTool || this.hasSpeech('player')) return
    let needed = 0
    let damage = 1
    if (work.kind === 'harvest' && work.t.cropId) {
      needed = this.cropHarvestHp(work.t.cropId)
      damage = this.toolDamage('scythe')
    } else if (work.t.obstacle) {
      needed = OBSTACLE_HP[work.t.obstacle]
      const mining = work.t.obstacle === 'rock' || work.t.obstacle === 'copper_ore' || work.t.obstacle === 'iron_ore'
      const woodcutting = work.t.obstacle === 'tree' || work.t.obstacle === 'stump' || work.t.obstacle === 'large_stump'
      damage = mining ? this.toolDamage('pickaxe') : woodcutting ? this.toolDamage('axe') : 1
    }
    if (needed <= 0 || needed / Math.max(1, damage) < 4) return
    this.nextSpeechAt.weakTool = now + 18
    if (Math.random() < 0.45) this.say('player', this.pickLine(PLAYER_WEAK_TOOL_LINES), 3.8)
  }

  private selectedFieldId(): string | null {
    if (this.area !== 'farm') return null
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
    this.migrateInventoryCapacity()
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
    const key = 'mine:stampedActive:v4'
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
      if (t.x >= 43 && t.x <= 54 && t.y >= 4 && t.y <= 14 && this.isMineResource(t.obstacle)) {
        hasNode = true
      }
    }
    return active ? !hasBoard && !hasNode : hasBoard && !hasNode
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

  private weatherDayKey(): string {
    return 'dailyWeather:day'
  }

  private weatherIdKey(): string {
    return 'dailyWeather:id'
  }

  private ensureDailyWeather() {
    if (this.state.flags[this.weatherDayKey()] === this.state.day) {
      const id = this.state.flags[this.weatherIdKey()]
      if (typeof id === 'string' && WEATHER_TYPES.some((weather) => weather.id === id)) return
    }
    const pick = WEATHER_TYPES[(this.state.day * 5 + 1) % WEATHER_TYPES.length]
    this.state.flags[this.weatherDayKey()] = this.state.day
    this.state.flags[this.weatherIdKey()] = pick.id
  }

  private currentWeatherDef(): (typeof WEATHER_TYPES)[number] | null {
    this.ensureDailyWeather()
    const id = this.state.flags[this.weatherIdKey()]
    return typeof id === 'string'
      ? WEATHER_TYPES.find((weather) => weather.id === id) ?? null
      : null
  }

  private currentWeather(): WeatherView | null {
    const weather = this.currentWeatherDef()
    if (!weather) return null
    return {
      id: weather.id,
      name: weather.name,
      icon: weather.icon,
      desc: weather.desc,
    }
  }

  private cropGrowthMultiplier(): number {
    return this.currentWeatherDef()?.cropGrowthMultiplier ?? 1
  }

  private animalDropMultiplier(): number {
    return this.currentWeatherDef()?.animalDropMultiplier ?? 1
  }

  private resourceBonusChance(): number {
    return this.currentWeatherDef()?.resourceBonusChance ?? 0
  }

  private rareAnimalProductChanceBonus(): number {
    return this.currentWeatherDef()?.rareAnimalProductChanceBonus ?? 0
  }

  private passiveDropChanceBonus(): number {
    return this.currentWeatherDef()?.passiveDropChanceBonus ?? 0
  }

  private orderDayKey(): string {
    return 'dailyOrder:day'
  }

  private orderChoiceCountKey(): string {
    return 'dailyOrder:choiceCount'
  }

  private orderItemKey(slot: number): string {
    return `dailyOrder:itemId:${slot}`
  }

  private orderQtyKey(slot: number): string {
    return `dailyOrder:qty:${slot}`
  }

  private orderRewardKey(slot: number): string {
    return `dailyOrder:rewardGold:${slot}`
  }

  private orderCompletedKey(day: number, slot: number): string {
    return `dailyOrder:completed:${day}:${slot}`
  }

  private availableOrderPool() {
    return ORDER_ITEM_POOL.filter((order) => this.itemSeen(order.itemId))
  }

  private ensureDailyOrders() {
    if (
      this.state.flags[this.orderDayKey()] === this.state.day &&
      typeof this.state.flags[this.orderChoiceCountKey()] === 'number'
    ) return
    const pool = this.availableOrderPool()
    if (pool.length === 0) {
      this.state.flags[this.orderDayKey()] = this.state.day
      this.state.flags[this.orderChoiceCountKey()] = 0
      for (let slot = 0; slot < 3; slot++) {
        delete this.state.flags[this.orderItemKey(slot)]
        delete this.state.flags[this.orderQtyKey(slot)]
        delete this.state.flags[this.orderRewardKey(slot)]
      }
      return
    }
    const count = Math.min(3, pool.length)
    const start = (this.state.day * 7 + pool.length * 3) % pool.length
    this.state.flags[this.orderDayKey()] = this.state.day
    this.state.flags[this.orderChoiceCountKey()] = count
    for (let slot = 0; slot < 3; slot++) {
      delete this.state.flags[this.orderItemKey(slot)]
      delete this.state.flags[this.orderQtyKey(slot)]
      delete this.state.flags[this.orderRewardKey(slot)]
    }
    for (let slot = 0; slot < count; slot++) {
      const pick = pool[(start + slot) % pool.length]
      const span = pick.maxQty - pick.minQty + 1
      const qty = pick.minQty + ((this.state.day * 5 + pick.itemId.length + slot * 2) % span)
      const item = getItem(pick.itemId)
      const rewardGold = Math.round((item?.sellPrice ?? 10) * qty * (1.25 + slot * 0.08) + 25 + slot * 15)
      this.state.flags[this.orderItemKey(slot)] = pick.itemId
      this.state.flags[this.orderQtyKey(slot)] = qty
      this.state.flags[this.orderRewardKey(slot)] = rewardGold
    }
  }

  private currentOrders(): OrderView[] {
    this.ensureDailyOrders()
    const rawCount = this.state.flags[this.orderChoiceCountKey()]
    const count = typeof rawCount === 'number' ? Math.max(0, Math.min(3, Math.floor(rawCount))) : 0
    const orders: OrderView[] = []
    for (let slot = 0; slot < count; slot++) {
      const itemId = this.state.flags[this.orderItemKey(slot)]
      const qty = this.state.flags[this.orderQtyKey(slot)]
      const rewardGold = this.state.flags[this.orderRewardKey(slot)]
      if (typeof itemId !== 'string' || typeof qty !== 'number' || typeof rewardGold !== 'number') continue
      const item = getItem(itemId)
      if (!item) continue
      const pool = ORDER_ITEM_POOL.find((order) => order.itemId === itemId)
      const have = this.countItem(itemId)
      const completed = this.state.flags[this.orderCompletedKey(this.state.day, slot)] === true
      orders.push({
        slot,
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
      })
    }
    return orders
  }

  private currentOrder(): OrderView | null {
    const orders = this.currentOrders()
    return orders.find((order) => !order.completed) ?? orders[0] ?? null
  }

  private catalogPrice(itemId: string): number {
    return SHOP_CATALOG.find((entry) => entry.itemId === itemId)?.buyPrice ?? 0
  }

  private currentObjective(): ObjectiveView | null {
    const act2Objective = this.currentAct2Objective()
    if (act2Objective) return act2Objective
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
        progress: 0,
        max: 1,
      }
    }
    if (!this.itemSeen('bread')) {
      return {
        title: '빵 굽기',
        detail: '밀가루를 빵으로 구운 뒤 상점에서 팔아 돈을 모으세요.',
        progress: 0,
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
        progress: 0,
        max: 1,
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
        progress: 0,
        max: 1,
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
        progress: 0,
        max: 1,
      }
    }
    if (!this.itemSeen('strawberry_jam_toast')) {
      return {
        title: '딸기쨈 토스트 만들기',
        detail: '빵, 버터, 딸기쨈을 조합해 중반 핵심 상품을 만드세요.',
        progress: 0,
        max: 1,
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
        progress: 0,
        max: 1,
      }
    }
    if (!this.itemSeen('cheese')) {
      return {
        title: '치즈 만들기',
        detail: '우유 2개를 숙성해 피자에 들어갈 치즈를 만드세요.',
        progress: 0,
        max: 1,
      }
    }
    if (!this.itemSeen('pizza')) {
      return {
        title: '피자 만들기',
        detail: '토마토소스, 밀가루, 치즈로 피자를 구우세요.',
        progress: 0,
        max: 1,
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
        progress: 0,
        max: 1,
      }
    }
    return {
      title: '농장 확장하기',
      detail: '밭, 동물, 화로 업그레이드를 늘려 생산량을 키우세요.',
      progress: 0,
      max: 1,
    }
  }

  private currentAct2Objective(): ObjectiveView | null {
    if (!this.hasSuspiciousSeed()) return null
    const flags = this.state.flags[ACT2_FLAGS.suspiciousSeedFound] === true
      ? this.state.flags
      : { ...this.state.flags, [ACT2_FLAGS.suspiciousSeedFound]: true }
    const stage = firstAvailableAct2Stage(flags)
    return stage ? this.act2StageObjective(stage) : null
  }

  private act2StageObjective(stage: Act2StageDef): ObjectiveView {
    const detail = `${stage.detail} 다음 해금: ${stage.unlocksHint}`
    if (!stage.requiredItems?.length) {
      return {
        title: stage.title,
        detail,
        progress: 0,
        max: 1,
      }
    }
    const progress = stage.requiredItems.reduce((sum, item) => sum + Math.min(item.qty, this.countItem(item.itemId)), 0)
    const max = stage.requiredItems.reduce((sum, item) => sum + item.qty, 0)
    return {
      title: stage.title,
      detail,
      progress,
      max,
    }
  }

  private hasSuspiciousSeed(): boolean {
    return this.countItem(ACT2_ITEMS.suspiciousSeed) > 0 || this.state.flags[ACT2_FLAGS.suspiciousSeedFound] === true
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
    return Math.max(2, Math.round(farm.dropSeconds * (1 - speedLevel * 0.15) * this.animalDropMultiplier() * 10) / 10)
  }

  private animalProductQty(farm: AnimalFarmDef): number {
    const yieldLevel = this.farmUpgradeLevel(farm, 'yield')
    const chance = Math.min(0.9, ([0, 0.25, 0.45, 0.65][yieldLevel] ?? 0) + this.passiveEffect('animal_yield'))
    let qty = farm.productQty
    if (Math.random() < chance) qty += 1
    if (yieldLevel >= 3 && Math.random() < 0.15) qty += 1
    return qty
  }

  private animalProductDrop(farm: AnimalFarmDef): { itemId: string; qty: number } {
    const rare = RARE_ANIMAL_PRODUCTS.find((product) => product.farmId === farm.id)
    if (rare && Math.random() < rare.chance + this.rareAnimalProductChanceBonus()) {
      return { itemId: rare.itemId, qty: 1 }
    }
    return { itemId: farm.productItemId, qty: this.animalProductQty(farm) }
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
      const drop = this.animalProductDrop(farm)
      t.metadata.groundItemId = drop.itemId
      t.metadata.groundItemQty = drop.qty
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
    if (itemId === ACT2_ITEMS.suspiciousSeed) {
      this.state.flags[ACT2_FLAGS.suspiciousSeedFound] = true
      this.say('player', '수상한 씨앗을 얻었다! 이게 뭐지..?', 4.2)
      this.jumpT = Math.max(this.jumpT, 0.22)
      this.playerAlertT = 1.15
      this.audio.sfx('sparkle')
    }
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

  private fieldCellAt(x: number, y: number): { plotId: string; row: number } | null {
    for (const plot of FIELD_PLOTS) {
      const insideX = x >= plot.x && x < plot.x + FIELD_SIZE
      const insideY = y >= plot.y && y < plot.y + FIELD_SIZE
      if (insideX && insideY) return { plotId: plot.id, row: y - plot.y }
    }
    return null
  }

  private backpackUpgradeLevel(): number {
    let level = 0
    for (let i = 0; i < BACKPACK_UPGRADE_PRICES.length; i++) {
      if (this.state.flags[backpackUpgradeFlag(i)] === true) level = i + 1
      else break
    }
    return level
  }

  private inventoryCapacity(): number {
    return Math.min(INV_MAX_SIZE, INV_BASE_SIZE + this.backpackUpgradeLevel() * INV_COLUMNS)
  }

  private inventoryRows(): number {
    return Math.ceil(this.inventoryCapacity() / INV_COLUMNS)
  }

  private ensureInventoryCapacity() {
    const target = this.inventoryCapacity()
    while (this.state.inventory.length < target) this.state.inventory.push({ itemId: '', qty: 0 })
  }

  private migrateInventoryCapacity() {
    const occupiedLast = this.state.inventory.reduce((last, slot, index) =>
      slot.itemId && slot.qty > 0 ? index : last,
    -1)
    const slotsToPreserve = Math.min(INV_MAX_SIZE, Math.max(this.state.inventory.length, occupiedLast + 1, INV_BASE_SIZE))
    const rowsToPreserve = Math.ceil(slotsToPreserve / INV_COLUMNS)
    const upgradesToGrant = Math.max(0, Math.min(BACKPACK_UPGRADE_PRICES.length, rowsToPreserve - INV_BASE_ROWS))
    for (let i = 0; i < upgradesToGrant; i++) this.state.flags[backpackUpgradeFlag(i)] = true
    this.ensureInventoryCapacity()
  }

  private fieldSignAt(x: number, y: number): string | null {
    const plot = FIELD_PLOTS.find((candidate) => candidate.sign.x === x && candidate.sign.y === y)
    return plot?.id ?? null
  }

  private clearCropState(t: Tile) {
    t.cropId = null
    t.growthStage = 0
    t.metadata.growT = 0
    delete t.metadata.harvestHp
  }

  private applyFieldRows() {
    for (const t of this.state.tiles) {
      const hasFieldMeta = typeof t.metadata.fieldId === 'string' || typeof t.metadata.fieldSign === 'string'
      if (hasFieldMeta && !this.fieldCellAt(t.x, t.y) && !this.fieldSignAt(t.x, t.y)) {
        t.terrain = 'grass'
        this.clearCropState(t)
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
            this.clearCropState(t)
          } else if (t.cropId && !CROPS[t.cropId]) {
            this.clearCropState(t)
          }
          t.obstacle = null
          t.hp = undefined
          t.metadata.fieldId = plot.id
          delete t.metadata.fieldSign
        }
      }
      const sign = this.state.tiles[idx(plot.sign.x, plot.sign.y)]
      sign.terrain = 'grass'
      this.clearCropState(sign)
      sign.obstacle = null
      sign.hp = undefined
      sign.metadata.fieldSign = plot.id
      delete sign.metadata.fieldId
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

  private applyFieldExpansions(preserveCrops = false) {
    const level = this.fieldExpansionLevel()
    for (const option of BUILD_OPTIONS) {
      if (option.level <= level) this.applyBuildRect(option.rect, preserveCrops)
    }
  }

  private applyBuildRect(rect: { x: number; y: number; w: number; h: number }, preserveCrops = false) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (!inBounds(x, y)) continue
        const t = this.state.tiles[idx(x, y)]
        t.terrain = 'soil'
        t.obstacle = null
        t.hp = undefined
        if (!preserveCrops || (t.cropId && !CROPS[t.cropId])) this.clearCropState(t)
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
    this.saveGameState()
  }
  saveNow(): boolean {
    const ok = this.saveGameState()
    this.toast(ok ? '게임을 저장했어요.' : '저장에 실패했어요.', ok ? 'good' : 'bad')
    this.emit()
    return ok
  }

  private saveGameState(): boolean {
    if (this.area !== 'mine' || !this.farmReturn) return saveGame(this.state)
    const p = this.state.player
    const current = { x: p.x, y: p.y, dir: p.dir, moving: p.moving }
    p.x = this.farmReturn.x
    p.y = this.farmReturn.y
    p.dir = this.farmReturn.dir
    p.moving = false
    const ok = saveGame(this.state)
    p.x = current.x
    p.y = current.y
    p.dir = current.dir
    p.moving = current.moving
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

  private render() {
    this.renderer.render({
      ctx: this.ctx,
      canvas: this.canvas,
      scale: this.scale,
      phase: this.phase,
      state: this.state,
      sprites: this.sprites,
      cam: this.cam,
      area: this.area,
      tiles: this.state ? this.activeTiles() : [],
      mineMonsters: this.mineMonsters,
      slimeTrails: this.slimeTrails,
      slimeBlobs: this.slimeBlobs,
      fade: this.fade,
      particles: this.particles,
      fireflies: this.fireflies,
      speechBubbles: this.activeSpeechBubbles(),
      jumpT: this.jumpT,
      workAnimT: this.workAnimT,
      playerHurtT: this.playerHurtT,
      playerFainting: this.pendingFaint,
      playerAlertT: this.playerAlertT,
      workTile: this.workTile,
      workTool: this.workTool,
      nowSecs: () => this.nowSecs(),
      period: () => this.period(),
      groundItemId: (tile) => this.groundItemId(tile),
      cropHarvestHp: (cropId) => this.cropHarvestHp(cropId),
      mineUnlocked: () => this.mineUnlocked(),
      cookingFireBuilt: () => this.cookingFireBuilt(),
      flagEnabled: (flag) => this.flagEnabled(flag),
      animalFarmOwned: (farm) => this.animalFarmOwned(farm),
      animalCount: (farm) => this.animalCount(farm),
      toolLevel: (toolId) => this.toolLevel(toolId),
      currentOrder: () => this.currentOrder(),
      currentWeather: () => this.currentWeather(),
    })
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
    return buildUISnapshot({
      phase: this.phase,
      introScene: this.introScene,
      area: this.area,
      state: this.state,
      toasts: this.toasts,
      audioMuted: this.audio.muted,
      audioMusicOn: this.audio.musicOn,
      hasSavedGame: () => this.hasSavedGame(),
      clockString: () => this.clockString(),
      periodLabel: () => this.periodLabel(),
      period: () => this.period(),
      countItem: (itemId) => this.countItem(itemId),
      flagEnabled: (flag) => this.flagEnabled(flag),
      isAnimalPermitEntry: (entry) => this.isAnimalPermitEntry(entry),
      animalUpgradeLevel: (upgrade) => this.animalUpgradeLevel(upgrade),
      animalUpgradePrice: (upgrade) => this.animalUpgradePrice(upgrade),
      animalBuyPrice: (farm) => this.animalBuyPrice(farm),
      animalCount: (farm) => this.animalCount(farm),
      animalDropSeconds: (farm) => this.animalDropSeconds(farm),
      passiveSlotCount: () => this.passiveSlotCount(),
      parsePassiveKey: (key) => this.parsePassiveKey(key),
      passiveEquipKey: (slot) => this.passiveEquipKey(slot),
      passiveKey: (id, rarity) => this.passiveKey(id, rarity),
      passiveCount: (id, rarity) => this.passiveCount(id, rarity),
      nextToolUpgrade: (toolId) => this.nextToolUpgrade(toolId),
      toolName: (toolId) => this.toolName(toolId),
      toolLevel: (toolId) => this.toolLevel(toolId),
      toolDamage: (toolId) => this.toolDamage(toolId),
      nearBlacksmith: () => this.nearBlacksmith(),
      fieldExpansionLevel: () => this.fieldExpansionLevel(),
      selectedFieldId: () => this.selectedFieldId(),
      nextUnlockFieldId: () => this.nextUnlockFieldId(),
      fieldRows: (fieldId) => this.fieldRows(fieldId),
      fieldCrop: (fieldId) => this.fieldCrop(fieldId),
      fieldRowCostGold: () => this.fieldRowCostGold(),
      fieldRowCostWood: () => this.fieldRowCostWood(),
      cropUnlocked: (cropId) => this.cropUnlocked(cropId),
      cookingFireBuilt: () => this.cookingFireBuilt(),
      cookingFireLevel: () => this.cookingFireLevel(),
      cookingSlots: (level) => this.cookingSlots(level),
      nextCookingFireUpgrade: () => this.nextCookingFireUpgrade(),
      recipeMaxCookQty: (recipe) => this.recipeMaxCookQty(recipe),
      recipeUnlocked: (recipe) => this.recipeUnlocked(recipe),
      passiveEffect: (id) => this.passiveEffect(id),
      currentObjective: () => this.currentObjective(),
      objectiveTasks: (current) => this.objectiveTasks(current),
      currentOrder: () => this.currentOrder(),
      currentOrders: () => this.currentOrders(),
      currentWeather: () => this.currentWeather(),
      nearMineExit: () => this.nearMineExit(),
      nearMineDown: () => this.nearMineDown(),
      selectedAnimalFarm: () => this.selectedAnimalFarm(),
      nearBed: () => this.nearBed(),
      canSleep: () => this.canSleep(),
      nearStore: () => this.nearStore(),
      nearOrderNpc: () => this.nearOrderNpc(),
      nearMineEntrance: () => this.nearMineEntrance(),
      nearCooking: () => this.nearCooking(),
      nearBuild: () => this.nearBuild(),
    })
  }
}
