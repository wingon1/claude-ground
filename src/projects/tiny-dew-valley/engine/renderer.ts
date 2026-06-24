import type { Direction, GameState, Tile } from '../types'
import { CROPS } from '../data/crops'
import { getItem } from '../data/items'
import { ANIMAL_FARMS, ANIMAL_FARM_MAX_ANIMALS, type AnimalFarmDef } from '../data/animalFarms'
import { MONSTERS } from '../data/monsters'
import { FIELD_PLOTS } from '../data/fields'
import { OBSTACLE_HP } from '../data/tiles'
import { idx, inBounds, LOCATIONS, WORLD_H, WORLD_W } from './world'
import { bakeItemIcon, T, type Sprites } from './sprites'
import type { Firefly, MineMonster, Particle, Period, SpeechBubble, SpeechSpeaker } from './gameTypes'
import type { UpgradeableToolId } from '../data/toolUpgrades'
import type { OrderView, UIPhase, WeatherView } from './uiSnapshot'

const ORDER_NPC = { x: LOCATIONS.storeStand.x, y: LOCATIONS.storeStand.y }
const BLACKSMITH_NPC = { x: LOCATIONS.blacksmithNpc.x, y: LOCATIONS.blacksmithNpc.y }

export interface RenderHost {
  ctx: CanvasRenderingContext2D
  canvas: HTMLCanvasElement
  scale: number
  phase: UIPhase
  state: GameState | undefined
  sprites: Sprites
  cam: { x: number; y: number }
  area: 'farm' | 'mine'
  tiles: Tile[]
  mineMonsters: MineMonster[]
  fade: number
  particles: Particle[]
  fireflies: Firefly[]
  speechBubbles: SpeechBubble[]
  jumpT: number
  workAnimT: number
  workTile: { x: number; y: number } | null
  workTool: UpgradeableToolId | 'sword' | null
  nowSecs: () => number
  period: () => Period
  groundItemId: (tile: Tile) => string | null
  cropHarvestHp: (cropId: string) => number
  mineUnlocked: () => boolean
  cookingFireBuilt: () => boolean
  flagEnabled: (flag: string | undefined) => boolean
  animalFarmOwned: (farm: AnimalFarmDef) => boolean
  animalCount: (farm: AnimalFarmDef) => number
  currentOrder: () => OrderView | null
  currentWeather: () => WeatherView | null
}

export class GameRenderer {
  private host!: RenderHost
  private waterAnim = 0
  private itemIconCache = new Map<string, HTMLCanvasElement>()

  private get ctx() { return this.host.ctx }
  private get canvas() { return this.host.canvas }
  private get scale() { return this.host.scale }
  private get phase() { return this.host.phase }
  private get state() { return this.host.state }
  private get sprites() { return this.host.sprites }
  private get cam() { return this.host.cam }
  private get area() { return this.host.area }
  private get mineMonsters() { return this.host.mineMonsters }
  private get fade() { return this.host.fade }
  private get particles() { return this.host.particles }
  private get fireflies() { return this.host.fireflies }
  private get speechBubbles() { return this.host.speechBubbles }
  private get jumpT() { return this.host.jumpT }
  private get workAnimT() { return this.host.workAnimT }
  private get workTile() { return this.host.workTile }
  private get workTool() { return this.host.workTool }

  private activeTiles(): Tile[] { return this.host.tiles }
  private nowSecs(): number { return this.host.nowSecs() }
  private period(): Period { return this.host.period() }
  private groundItemId(tile: Tile): string | null { return this.host.groundItemId(tile) }
  private cropHarvestHp(cropId: string): number { return this.host.cropHarvestHp(cropId) }
  private mineUnlocked(): boolean { return this.host.mineUnlocked() }
  private cookingFireBuilt(): boolean { return this.host.cookingFireBuilt() }
  private flagEnabled(flag: string | undefined): boolean { return this.host.flagEnabled(flag) }
  private animalFarmOwned(farm: AnimalFarmDef): boolean { return this.host.animalFarmOwned(farm) }
  private animalCount(farm: AnimalFarmDef): number { return this.host.animalCount(farm) }
  private currentOrder(): OrderView | null { return this.host.currentOrder() }
  private currentWeather(): WeatherView | null { return this.host.currentWeather() }
  private wx(worldX: number): number {
    return Math.round((worldX - this.cam.x) * this.scale)
  }
  private wy(worldY: number): number {
    return Math.round((worldY - this.cam.y) * this.scale)
  }

  render(host: RenderHost) {
    this.host = host
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
    const tiles = this.activeTiles()

    this.waterAnim += 0.02
    const wf = Math.floor(this.waterAnim) % this.sprites.water.length

    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!inBounds(tx, ty)) continue
        const t = tiles[idx(tx, ty)]
        if (this.area === 'mine') this.drawMineGround(t, S)
        else this.drawGround(t, wf, S)
      }
    }
    // buildings
    // Tent (player home): 48×48 canvas over the 30–32 × 7–8 footprint,
    // base resting on the front (row 9) where the bed/spawn sits.
    if (this.area === 'farm') {
      this.drawBuilding(this.sprites.farmhouse, 30, 7, S, -16)
      this.drawBuilding(this.sprites.store, 22, 6, S, -14)
      this.drawAnimalFarms(S)
      this.drawFieldSigns(S)
      this.drawCookingFire(S)
      this.drawMineEntrance(S)
      this.drawBlacksmith(S)
    }

    type Draw = { y: number; fn: () => void }
    const draws: Draw[] = []
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!inBounds(tx, ty)) continue
        const t = tiles[idx(tx, ty)]
        if (t.obstacle) draws.push({ y: ty * T + T, fn: () => this.drawObstacle(t, S) })
        if (t.cropId) draws.push({ y: ty * T + T, fn: () => this.drawCrop(t, S) })
        if (this.groundItemId(t)) draws.push({ y: ty * T + T, fn: () => this.drawGroundItem(t, S) })
      }
    }
    if (this.area === 'farm') draws.push({ y: this.orderNpcPosition().y, fn: () => this.drawOrderNpc(S) })
    if (this.area === 'farm' && this.mineUnlocked()) {
      const smith = this.blacksmithNpcPosition()
      draws.push({ y: smith.y, fn: () => this.drawBlacksmithNpc(S) })
    }
    if (this.area === 'mine') {
      for (const monster of this.mineMonsters) {
        draws.push({ y: monster.y, fn: () => this.drawMonster(monster, S) })
      }
    }
    draws.push({ y: p.y, fn: () => this.drawHuman(this.sprites.farmer, p.x, p.y, p.dir, p.moving, p.exhausted, p.animTime) })
    draws.sort((a, b) => a.y - b.y)
    for (const d of draws) d.fn()

    this.drawWorkHighlight(S)
    this.drawParticles(S)
    if (this.area === 'farm') this.drawLighting(S, bw, bh)
    if (this.area === 'farm') this.drawWeatherEffects(S, bw, bh)
    this.drawSpeechBubbles(S)
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

  private drawMineGround(t: Tile, S: number) {
    const ctx = this.ctx
    const dx = this.wx(t.x * T)
    const dy = this.wy(t.y * T)
    const seed = (((t.x + 7) * 928371 + (t.y + 13) * 1237) >>> 0)
    const r = (px: number, py: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c
      ctx.fillRect(dx + px * S, dy + py * S, w * S, h * S)
    }
    if (t.terrain === 'blocked') {
      // Rocky cave wall: chunky facets, cracks, a rim light up top, occasional ore vein.
      r(0, 0, 16, 16, '#201f27')
      r(1, 0, 14, 15, '#2a2933')
      r(2, 2, 5, 5, seed & 1 ? '#33323d' : '#2f2e38')
      r(8, 3, 5, 4, seed & 2 ? '#34333e' : '#302f39')
      r(3, 9, 6, 5, seed & 4 ? '#2c2b35' : '#2a2933')
      r(9, 9, 4, 5, '#26252e')
      r(1, 0, 14, 1, '#43424f') // torch-lit top rim
      r(1, 1, 2, 2, '#3a3946')
      r(7, 2, 1, 6, '#1b1a21') // cracks
      r(5, 8, 4, 1, '#1b1a21')
      r(11, 6, 1, 5, '#1b1a21')
      r(1, 13, 14, 2, '#181820') // bottom shadow
      if ((seed & 7) === 0) {
        r(4, 5, 2, 2, '#c8753a') // copper vein glint
        r(5, 6, 1, 1, '#e8a060')
      } else if ((seed & 7) === 3) {
        r(10, 4, 2, 2, '#aeb4c0') // iron vein glint
        r(11, 5, 1, 1, '#e6ebf2')
      }
      return
    }
    // Dirt / gravel floor with scattered pebbles and a hairline crack.
    r(0, 0, 16, 16, '#352e29')
    r(1, 1, 14, 14, (t.x * 5 + t.y * 7) % 4 === 0 ? '#473d34' : '#3d342d')
    r(3 + (seed & 3), 4 + ((seed >> 2) & 3), 2, 2, '#4c4239')
    r(9 + ((seed >> 4) & 2), 9 + ((seed >> 5) & 3), 2, 1, '#2f2823')
    r(6 + ((seed >> 3) & 3), 11, 1, 1, '#534637')
    r(4, 7 + ((seed >> 2) & 2), 5, 1, '#2c251f')
    if (t.metadata.mineExit === true) {
      // Ladder up toward daylight (recognisable exit).
      r(3, 2, 10, 12, '#1a1820')
      r(2, 1, 12, 2, '#6b6254')
      r(5, 2, 1, 12, '#7a4c2a')
      r(10, 2, 1, 12, '#7a4c2a')
      r(5, 4, 6, 1, '#9a6a3a')
      r(5, 7, 6, 1, '#9a6a3a')
      r(5, 10, 6, 1, '#9a6a3a')
      r(5, 2, 6, 1, '#cdbf8e') // light spilling from above
    } else if (t.metadata.mineDown === true) {
      // Pit with a ladder descending into darkness (go deeper).
      r(2, 3, 12, 11, '#0e0c11')
      r(2, 3, 12, 1, '#5a5048')
      r(3, 4, 1, 9, '#241f15')
      r(6, 4, 1, 9, '#6b4a32')
      r(10, 4, 1, 9, '#6b4a32')
      r(6, 6, 5, 1, '#3f2c1e')
      r(6, 9, 5, 1, '#3f2c1e')
      r(6, 12, 5, 1, '#3f2c1e')
    }
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
    const dx = Math.sin(t * 0.11) * 18
    const dy = Math.sin(t * 0.08 + 1.4) * 10
    const vx = Math.cos(t * 0.11) * 0.11 * 18
    const vy = Math.cos(t * 0.08 + 1.4) * 0.08 * 10
    const dir: Direction = Math.abs(vx) > Math.abs(vy)
      ? (vx >= 0 ? 'right' : 'left')
      : (vy >= 0 ? 'down' : 'up')
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
    this.drawHuman(this.sprites.barnaby, x, y, npc.dir, true, false, this.nowSecs(), false, 0.35)
    const order = this.currentOrder()
    if (!order || order.completed) return
    this.drawQuestMarker(x + 9, y - 18, S)
  }

  private blacksmithNpcPosition(): { x: number; y: number; dir: Direction } {
    const t = this.nowSecs()
    const dx = Math.sin(t * 0.07 + 0.6) * 14
    const dy = Math.sin(t * 0.06 + 2.2) * 9
    const vx = Math.cos(t * 0.07 + 0.6) * 0.07 * 14
    const vy = Math.cos(t * 0.06 + 2.2) * 0.06 * 9
    const dir: Direction = Math.abs(vx) > Math.abs(vy)
      ? (vx >= 0 ? 'right' : 'left')
      : (vy >= 0 ? 'down' : 'up')
    return {
      x: BLACKSMITH_NPC.x * T + T / 2 + dx,
      y: BLACKSMITH_NPC.y * T + T + dy,
      dir,
    }
  }

  private drawBlacksmithNpc(S: number) {
    const npc = this.blacksmithNpcPosition()
    this.drawHuman(this.sprites.smith, npc.x, npc.y, npc.dir, true, false, this.nowSecs() + 1.4, false, 0.35)
    const ctx = this.ctx
    const sx = this.wx(npc.x + 5)
    const sy = this.wy(npc.y - 17)
    ctx.fillStyle = '#4c3a33'
    ctx.fillRect(sx, sy, 6 * S, 6 * S)
    ctx.fillStyle = '#d6d0c2'
    ctx.fillRect(sx + 1 * S, sy + 1 * S, 4 * S, 2 * S)
    ctx.fillStyle = '#2a2a30'
    ctx.fillRect(sx + 2 * S, sy + 3 * S, 2 * S, 2 * S)
    if (!this.flagEnabled('talk:blacksmith:intro')) {
      this.drawSpeechBubble(npc.x, npc.y - 36, '도구 업그레이드가 필요하면 나에게로 와.', S)
      this.drawQuestMarker(npc.x + 9, npc.y - 18, S)
    }
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

  private drawMonster(monster: MineMonster, S: number) {
    const def = MONSTERS[monster.id]
    const ctx = this.ctx
    const hit = monster.hitT > 0
    const x = this.wx(monster.x - 8)
    const y = this.wy(monster.y - 17 + (hit ? -2 : 0))
    const tt = performance.now() / 1000
    const ph = monster.x * 0.7 + monster.y * 0.3 // de-sync animation per monster
    const r = (px: number, py: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c
      ctx.fillRect(x + px * S, y + py * S, w * S, h * S)
    }
    // contact shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)'
    ctx.fillRect(this.wx(monster.x - 6), this.wy(monster.y - 3), 12 * S, 3 * S)

    if (monster.id === 'slime') {
      // Gooey blob: rounded dome, glossy highlight, jiggling base, drip.
      const sDark = '#3f9a4a'
      const squash = Math.sin(tt * 6 + ph) > 0.3 ? 1 : 0
      r(2 - squash, 11, 12 + squash * 2, 3, def.color) // wobbling base
      r(3, 8, 10, 4, def.color)
      r(4, 6, 8, 3, def.color)
      r(5, 5, 6, 1, def.color)
      r(2 - squash, 13, 12 + squash * 2, 1, sDark) // base shade
      r(5, 6, 3, 2, def.accent) // glossy highlight
      r(6, 5, 2, 1, def.accent)
      r(6, 8, 2, 2, '#15301a') // eyes
      r(10, 8, 2, 2, '#15301a')
      r(6, 8, 1, 1, '#e8ffe8')
      r(10, 8, 1, 1, '#e8ffe8')
      r(7, 11, 1, 1, '#15301a') // smile
      r(8, 12, 2, 1, '#15301a')
      r(10, 11, 1, 1, '#15301a')
      r(12, 9, 1, 3, def.color) // side drip
    } else if (monster.id === 'bat') {
      // Flapping bat: pointed ears, membrane wings with finger struts, fangs, glowing eyes.
      const bDark = '#3d3450'
      const wy = Math.round(Math.sin(tt * 9 + ph) * 2)
      r(-3, 7 + wy, 3, 1, def.color) // left wing
      r(-2, 8 + wy, 7, 1, def.color)
      r(-1, 9 + wy, 6, 2, def.color)
      r(0, 11 + wy, 5, 1, def.color)
      r(0, 8 + wy, 1, 3, bDark)
      r(2, 8 + wy, 1, 3, bDark)
      r(13, 7 + wy, 3, 1, def.color) // right wing
      r(11, 8 + wy, 7, 1, def.color)
      r(11, 9 + wy, 6, 2, def.color)
      r(11, 11 + wy, 5, 1, def.color)
      r(15, 8 + wy, 1, 3, bDark)
      r(13, 8 + wy, 1, 3, bDark)
      r(5, 7, 6, 5, def.color) // body
      r(6, 6, 4, 1, def.color)
      r(5, 3, 2, 3, def.color) // ears
      r(9, 3, 2, 3, def.color)
      r(5, 3, 1, 2, bDark)
      r(10, 3, 1, 2, bDark)
      r(6, 8, 2, 2, def.accent) // glowing eyes
      r(8, 8, 2, 2, def.accent)
      r(6, 8, 1, 1, '#fff2a0')
      r(9, 8, 1, 1, '#fff2a0')
      r(6, 11, 1, 1, '#ffffff') // fangs
      r(9, 11, 1, 1, '#ffffff')
    } else if (monster.id === 'mine_rat') {
      // Rodent: hunched body, big round ear, long tail, snout with buck teeth & whiskers.
      const pink = '#e2899a'
      const sniff = Math.sin(tt * 10 + ph) > 0.4 ? 1 : 0
      r(0, 12, 4, 1, def.accent) // tail
      r(1, 10, 1, 2, def.accent)
      r(2, 9, 2, 1, def.accent)
      r(4, 8, 9, 5, def.color) // body
      r(5, 7, 6, 1, def.color)
      r(4, 9, 3, 4, def.color) // haunch
      r(5, 8, 6, 1, def.accent) // back highlight
      r(11, 8, 4, 4, def.color) // head
      r(14, 9, 2, 2, def.color) // snout
      r(11, 5, 3, 3, def.color) // ear
      r(12, 6, 1, 1, pink)
      r(12, 9, 1, 1, '#1c130d') // eye
      r(15 + sniff, 10, 1, 1, pink) // twitching nose
      r(14, 11, 1, 1, '#ffffff') // buck teeth
      r(6, 12, 1, 1, pink) // feet
      r(9, 12, 1, 1, pink)
    } else if (monster.id === 'stone_golem') {
      // Walking boulder: cracked rock body, heavy arms, mossy crown, glowing core & eyes.
      const gDark = '#5d5d64'
      const moss = '#5f8a4a'
      const pulse = 0.5 + 0.5 * Math.sin(tt * 3 + ph)
      r(4, 13, 3, 3, gDark) // legs
      r(9, 13, 3, 3, gDark)
      r(2, 4, 12, 10, def.color) // torso
      r(3, 3, 10, 1, def.color)
      r(2, 11, 12, 3, gDark) // lower shade
      r(2, 4, 2, 10, gDark) // left edge shade
      r(0, 6, 3, 6, def.color) // arms
      r(13, 6, 3, 6, def.color)
      r(0, 10, 3, 2, gDark)
      r(13, 10, 3, 2, gDark)
      r(5, 1, 6, 3, def.color) // brow / head ridge
      r(6, 5, 1, 4, gDark) // cracks
      r(7, 7, 3, 1, gDark)
      r(9, 9, 1, 3, gDark)
      r(4, 5, 1, 1, def.accent) // mineral specks
      r(11, 6, 1, 1, def.accent)
      r(4, 1, 2, 1, moss) // moss
      r(9, 1, 2, 1, moss)
      ctx.fillStyle = `rgba(127,208,255,${0.55 + 0.45 * pulse})`
      ctx.fillRect(x + 5 * S, y + 2 * S, 2 * S, 1 * S) // glowing eyes
      ctx.fillRect(x + 9 * S, y + 2 * S, 2 * S, 1 * S)
      ctx.fillStyle = `rgba(140,215,255,${0.5 + 0.5 * pulse})`
      ctx.fillRect(x + 7 * S, y + 8 * S, 2 * S, 2 * S) // glowing chest core
    } else {
      // mine_guardian — boss: armored crystalline sentinel with crown spikes, gem core, aura.
      const gDark = '#4a3266'
      const gem = def.accent
      const pulse = 0.5 + 0.5 * Math.sin(tt * 2.5 + ph)
      ctx.fillStyle = `rgba(240,208,106,${0.1 + 0.12 * pulse})` // pulsing aura
      ctx.beginPath()
      ctx.arc(x + 8 * S, y + 8 * S, 14 * S, 0, Math.PI * 2)
      ctx.fill()
      r(2, 2, 12, 15, def.color) // body
      r(0, 5, 3, 9, def.color) // shoulders/arms
      r(13, 5, 3, 9, def.color)
      r(2, 12, 12, 5, gDark) // lower armor shade
      r(4, 6, 8, 6, gDark) // chest plate
      r(4, -1, 8, 4, def.color) // helmet
      r(3, -3, 2, 3, gem) // crown spikes
      r(11, -3, 2, 3, gem)
      r(7, -4, 2, 3, gem)
      r(0, 4, 2, 2, gem) // shoulder spikes
      r(14, 4, 2, 2, gem)
      r(0, 12, 3, 3, gDark) // fists
      r(13, 12, 3, 3, gDark)
      r(4, 13, 1, 2, gem) // crystal accents
      r(11, 13, 1, 2, gem)
      ctx.fillStyle = `rgba(255,225,120,${0.6 + 0.4 * pulse})`
      ctx.fillRect(x + 5 * S, y + 1 * S, 2 * S, 1 * S) // glowing visor eyes
      ctx.fillRect(x + 9 * S, y + 1 * S, 2 * S, 1 * S)
      ctx.fillStyle = `rgba(255,232,150,${0.55 + 0.45 * pulse})`
      ctx.fillRect(x + 6 * S, y + 7 * S, 4 * S, 4 * S) // gem core
      r(7, 8, 2, 2, '#fff7d0')
    }

    if (monster.hp < monster.maxHp) {
      const barY = monster.id === 'mine_guardian' ? monster.y - 28 : monster.y - 24
      this.drawWorldHpBar(monster.x - 8, barY, monster.hp, monster.maxHp, S)
    }
  }

  private drawWorldHpBar(x: number, y: number, hp: number, maxHp: number, S: number) {
    const ctx = this.ctx
    const sx = this.wx(x + 3)
    const sy = this.wy(y)
    const w = 10 * S
    const h = Math.max(2, 2 * S)
    ctx.fillStyle = 'rgba(30,24,20,0.55)'
    ctx.fillRect(sx, sy, w, h)
    ctx.fillStyle = '#e05a36'
    ctx.fillRect(sx, sy, Math.max(0, Math.min(w, w * (hp / Math.max(1, maxHp)))), h)
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
    const R = (px: number, py: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c
      ctx.fillRect(x + px * S, y + py * S, w * S, h * S)
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(x + 4 * S, y + 50 * S, 104 * S, 8 * S)
    // Rocky mountainside with peak.
    R(2, 14, 108, 42, '#5f5b52')
    R(6, 8, 96, 12, '#6f6b60')
    R(14, 3, 76, 8, '#7c7868')
    R(2, 40, 108, 16, '#4f4b44') // lower shade
    R(2, 14, 5, 42, '#534f48') // left edge
    R(103, 14, 7, 42, '#534f48') // right edge
    R(20, 6, 18, 3, '#8e8a79') // highlights
    R(60, 9, 20, 3, '#888473')
    // Timber A-frame portal supports.
    R(28, 16, 56, 3, '#855c36') // top beam highlight
    R(30, 18, 52, 4, '#6e4a2a') // top beam
    R(30, 18, 6, 38, '#5c3c22') // posts
    R(76, 18, 6, 38, '#5c3c22')
    R(31, 18, 2, 38, '#7a4c2a')
    R(77, 18, 2, 38, '#7a4c2a')
    R(32, 26, 2, 1, '#4a3018') // plank grain
    R(32, 36, 2, 1, '#4a3018')
    R(78, 26, 2, 1, '#4a3018')
    R(78, 36, 2, 1, '#4a3018')
    // Tunnel mouth with receding darkness.
    R(36, 22, 40, 34, '#2a2622')
    R(40, 26, 32, 30, '#1a1620')
    R(46, 32, 20, 24, '#0d0a12')
    R(40, 24, 32, 2, '#3a2a1c') // inner support arch
    // Hanging lantern.
    R(54, 17, 1, 5, '#3a3026')
    R(51, 20, 6, 1, '#7a5e22')
    R(51, 21, 6, 6, '#caa23a')
    R(52, 22, 4, 4, '#ffd86a')
    // Minecart rails leading out.
    R(40, 54, 8, 2, '#6b5a4a')
    R(64, 54, 8, 2, '#6b5a4a')
    R(43, 52, 2, 8, '#9aa0aa')
    R(67, 52, 2, 8, '#9aa0aa')
    if (!this.mineUnlocked()) {
      // Boarded shut with a padlock until unlocked.
      R(36, 26, 40, 5, '#7a4c2a')
      R(34, 34, 44, 5, '#7a4c2a')
      R(36, 42, 40, 5, '#7a4c2a')
      R(36, 26, 40, 2, '#9a6a3a')
      R(34, 34, 44, 2, '#9a6a3a')
      R(36, 42, 40, 2, '#9a6a3a')
      R(50, 24, 4, 26, '#5c3c22') // nailed vertical board
      R(53, 33, 6, 7, '#3a3a42') // padlock body
      R(54, 30, 4, 4, '#52525c') // shackle
      R(55, 35, 2, 2, '#1c1c22') // keyhole
    } else {
      // Crossed pickaxe marker once open.
      R(52, 38, 1, 10, '#6b4a32')
      R(48, 36, 10, 2, '#aeb4c0')
      R(48, 36, 2, 2, '#e6ebf2')
    }
  }

  private drawBlacksmith(S: number) {
    if (!this.mineUnlocked()) return
    const ctx = this.ctx
    const x = this.wx(LOCATIONS.blacksmith.x * T)
    const y = this.wy(LOCATIONS.blacksmith.y * T - 14)
    const tt = performance.now() / 1000
    const R = (px: number, py: number, w: number, h: number, c: string) => {
      ctx.fillStyle = c
      ctx.fillRect(x + px * S, y + py * S, w * S, h * S)
    }
    ctx.fillStyle = 'rgba(0,0,0,0.17)'
    ctx.fillRect(x + 4 * S, y + 58 * S, 72 * S, 7 * S)
    // Stone walls with block courses.
    R(4, 24, 72, 37, '#5b4b42')
    R(4, 24, 72, 4, '#6d5a50')
    R(4, 32, 72, 1, '#473a33')
    R(4, 40, 72, 1, '#473a33')
    R(4, 48, 72, 1, '#473a33')
    R(20, 28, 1, 33, '#473a33')
    R(40, 33, 1, 28, '#473a33')
    R(58, 28, 1, 33, '#473a33')
    // Timber-framed roof.
    R(0, 18, 80, 7, '#4d403b')
    R(2, 12, 76, 8, '#6d5a50')
    R(10, 7, 60, 7, '#8b6a4d')
    R(10, 7, 60, 2, '#a07f5e')
    // Brick chimney + animated smoke.
    R(56, 2, 11, 18, '#7a4030')
    R(56, 2, 11, 2, '#995441')
    R(57, 6, 9, 1, '#5c3024')
    R(57, 11, 9, 1, '#5c3024')
    for (let i = 0; i < 3; i++) {
      const sm = (tt * 8 + i * 4) % 12
      const a = 0.4 - sm * 0.03
      if (a <= 0) continue
      ctx.fillStyle = `rgba(190,190,196,${a})`
      ctx.fillRect(x + (58 + Math.sin(tt * 2 + i) * 2) * S, y + (2 - sm) * S, 5 * S, 4 * S)
    }
    // Forge hood with glowing coals + rising sparks (left interior).
    R(8, 30, 26, 4, '#3a3330')
    R(10, 34, 22, 16, '#241f1d')
    const pulse = 0.6 + 0.4 * Math.sin(tt * 5)
    ctx.fillStyle = 'rgba(240,120,40,0.85)'
    ctx.fillRect(x + 13 * S, y + 42 * S, 16 * S, 7 * S)
    ctx.fillStyle = `rgba(255,170,60,${pulse})`
    ctx.fillRect(x + 16 * S, y + 43 * S, 10 * S, 5 * S)
    R(19, 44, 4, 3, '#ffe79a')
    for (let i = 0; i < 3; i++) {
      const sp = (tt * 20 + i * 7) % 10
      ctx.fillStyle = `rgba(255,200,90,${Math.max(0, 0.9 - sp * 0.1)})`
      ctx.fillRect(x + (17 + i * 3) * S, y + (44 - sp) * S, 1 * S, 1 * S)
    }
    // Doorway (right).
    R(44, 38, 16, 23, '#2e2620')
    R(46, 40, 12, 21, '#1a1410')
    R(50, 48, 1, 4, '#caa23a')
    // Anvil with leaning hammer (out front).
    R(30, 54, 16, 3, '#2e2930')
    R(33, 50, 10, 4, '#46434c')
    R(31, 49, 7, 2, '#56535e')
    R(42, 49, 4, 2, '#56535e') // horn
    R(38, 44, 1, 7, '#6b4a32') // hammer handle
    R(36, 43, 5, 3, '#7c7e88') // hammer head
    // Water quench barrel.
    R(64, 46, 10, 15, '#6b4a2e')
    R(64, 46, 10, 2, '#3a78a0')
    R(64, 50, 10, 1, '#8a6a42')
    R(64, 56, 10, 1, '#8a6a42')
    // Hanging horseshoe sign.
    R(12, 16, 1, 6, '#3a3026')
    R(8, 21, 9, 3, '#caa23a')
    R(10, 21, 5, 3, '#9a7a2a')
  }

  private drawSpeechBubbles(S: number) {
    for (const bubble of this.speechBubbles) {
      const anchor = this.speechAnchor(bubble.speaker)
      if (!anchor) continue
      this.drawSpeechBubble(anchor.x, anchor.y, bubble.text, S)
    }
  }

  private speechAnchor(speaker: SpeechSpeaker): { x: number; y: number } | null {
    if (speaker === 'player') {
      const p = this.state?.player
      return p ? { x: p.x, y: p.y - 34 } : null
    }
    if (speaker === 'shop') {
      const npc = this.orderNpcPosition()
      return { x: npc.x, y: npc.y - 34 }
    }
    if (speaker === 'blacksmith') {
      if (!this.mineUnlocked()) return null
      const npc = this.blacksmithNpcPosition()
      return { x: npc.x, y: npc.y - 34 }
    }
    return null
  }

  private drawSpeechBubble(x: number, y: number, text: string, S: number) {
    const ctx = this.ctx
    ctx.save()
    ctx.font = `${Math.max(10, 6 * S)}px sans-serif`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const maxWidth = 150 * S
    const padX = 7 * S
    const padY = 5 * S
    const lineHeight = Math.max(11, 9 * S)
    const lines = this.wrapSpeech(text, maxWidth, ctx)
    const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width), 16 * S)
    const w = Math.min(this.canvas.width - 8 * S, Math.ceil(textWidth + padX * 2))
    const h = Math.ceil(lines.length * lineHeight + padY * 2)
    const anchorX = this.wx(x)
    const sx = Math.max(4 * S, Math.min(this.canvas.width - w - 4 * S, anchorX - w / 2))
    const sy = Math.max(4 * S, this.wy(y) - h)
    ctx.fillStyle = 'rgba(255, 246, 218, 0.94)'
    ctx.fillRect(sx, sy, w, h)
    const tailX = Math.max(sx + 10 * S, Math.min(sx + w - 10 * S, anchorX))
    ctx.beginPath()
    ctx.moveTo(tailX - 5 * S, sy + h - 1 * S)
    ctx.lineTo(tailX + 5 * S, sy + h - 1 * S)
    ctx.lineTo(tailX, sy + h + 6 * S)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#4b3427'
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], sx + padX, sy + padY + lineHeight * i + lineHeight / 2)
    }
    ctx.restore()
  }

  private wrapSpeech(text: string, maxWidth: number, ctx: CanvasRenderingContext2D): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (ctx.measureText(next).width <= maxWidth || !line) {
        line = next
      } else {
        lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    return lines.length > 0 ? lines.slice(0, 3) : ['']
  }

  private drawQuestMarker(x: number, y: number, S: number) {
    const ctx = this.ctx
    const sx = this.wx(x)
    const sy = this.wy(y)
    ctx.save()
    ctx.font = `900 ${Math.max(15, 11 * S)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(65, 28, 24, 0.35)'
    ctx.fillText('!', sx + 1.5 * S, sy + 1.5 * S)
    ctx.fillStyle = '#d9362e'
    ctx.fillText('!', sx - 0.6 * S, sy)
    ctx.fillText('!', sx, sy)
    ctx.fillText('!', sx + 0.6 * S, sy)
    ctx.restore()
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
    walkAnimScale = 1,
  ) {
    const S = this.scale
    let frame = 0
    if (moving) frame = Math.floor(animTime * 10 * walkAnimScale) % 2 === 0 ? 1 : 2
    const img = sheet[`${dir}_${frame}`] ?? sheet['down_0']
    const walkBob = moving ? Math.abs(Math.sin(animTime * 18 * walkAnimScale)) * (playerMotion ? 1.2 : 0.5) : 0
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
    this.drawSpeechBubble(x, y - 24, '피곤해.. 잠을 자야해', S)
  }

  private currentWorkTool(): UpgradeableToolId | 'sword' {
    if (this.workTool) return this.workTool
    const w = this.workTile
    if (!w || !inBounds(w.x, w.y)) return 'scythe'
    const ob = this.activeTiles()[idx(w.x, w.y)].obstacle
    return ob === 'rock' || ob === 'copper_ore' || ob === 'iron_ore' ? 'pickaxe' : 'scythe'
  }

  private drawWorkPose(x: number, y: number, dir: string, t: number, S: number, tool: UpgradeableToolId | 'sword') {
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
    if (tool === 'sword') {
      ctx.fillRect(-1 * S, -15 * S, 2 * S, 12 * S)
      ctx.fillStyle = '#eef0f6'
      ctx.fillRect(0, -15 * S, 1 * S, 12 * S)
      ctx.fillStyle = '#caa066'
      ctx.fillRect(-4 * S, -4 * S, 8 * S, 1 * S)
    } else if (tool === 'pickaxe') {
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

  private drawWeatherEffects(S: number, bw: number, bh: number) {
    const weather = this.currentWeather()
    if (!weather) return
    if (weather.id === 'rain') this.drawRain(S, bw, bh)
    else if (weather.id === 'wind') this.drawWindLeaves(S, bw, bh)
    else if (weather.id === 'lucky') this.drawLuckySparkles(S, bw, bh)
  }

  private drawRain(S: number, bw: number, bh: number) {
    const ctx = this.ctx
    const t = this.nowSecs()
    ctx.save()
    ctx.fillStyle = 'rgba(40,68,92,0.1)'
    ctx.fillRect(0, 0, bw, bh)
    ctx.strokeStyle = 'rgba(172,218,240,0.55)'
    ctx.lineWidth = Math.max(1, S * 0.34)
    const count = Math.max(34, Math.floor((bw * bh) / 17500))
    for (let i = 0; i < count; i++) {
      const a = this.noise01(i, 11)
      const b = this.noise01(i, 23)
      const c = this.noise01(i, 37)
      const speed = (330 + a * 210) * S
      const drift = (18 + b * 28) * S
      const spanY = bh + 42 * S
      const y = (b * spanY + t * speed) % spanY - 24 * S
      const x = (c * (bw + 84 * S) - 42 * S + Math.sin(t * 1.7 + i) * 5 * S - t * drift) % (bw + 84 * S)
      const sx = x < -42 * S ? x + bw + 84 * S : x
      const len = (5 + this.noise01(i, 51) * 5) * S
      const slant = (1.3 + this.noise01(i, 67) * 2.1) * S
      ctx.beginPath()
      ctx.moveTo(Math.round(sx), Math.round(y))
      ctx.lineTo(Math.round(sx + slant), Math.round(y + len))
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawWindLeaves(S: number, bw: number, bh: number) {
    const ctx = this.ctx
    const t = this.nowSecs()
    ctx.save()
    const count = Math.max(12, Math.floor(bw / 58))
    for (let i = 0; i < count; i++) {
      const a = this.noise01(i, 101)
      const b = this.noise01(i, 137)
      const c = this.noise01(i, 163)
      const x = (a * (bw + 90 * S) + t * (28 + c * 42) * S) % (bw + 90 * S) - 45 * S
      const y = (b * bh + Math.sin(t * (0.9 + c) + i * 1.7) * (10 + a * 18) * S) % Math.max(1, bh)
      const spin = t * (2.2 + c * 3.1) + i
      const size = (1.8 + c * 1.25) * S
      ctx.globalAlpha = 0.28 + b * 0.26
      ctx.fillStyle = a > 0.45 ? '#79b85a' : '#d5a94f'
      ctx.save()
      ctx.translate(Math.round(x), Math.round(y))
      ctx.rotate(spin)
      ctx.beginPath()
      ctx.moveTo(0, -size)
      ctx.lineTo(size * 0.75, 0)
      ctx.lineTo(0, size)
      ctx.lineTo(-size * 0.75, 0)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  private drawLuckySparkles(S: number, bw: number, bh: number) {
    const ctx = this.ctx
    const t = this.nowSecs()
    ctx.save()
    const count = Math.max(7, Math.floor((bw * bh) / 84000))
    for (let i = 0; i < count; i++) {
      const a = this.noise01(i, 211)
      const b = this.noise01(i, 251)
      const pulse = (Math.sin(t * (1.7 + a) + i * 2.1) + 1) / 2
      if (pulse < 0.35) continue
      const x = (a * bw + Math.sin(t * 0.26 + i) * 14 * S) % Math.max(1, bw)
      const y = (b * bh + Math.cos(t * 0.22 + i) * 10 * S) % Math.max(1, bh)
      const r = (0.9 + pulse * 1.25) * S
      ctx.globalAlpha = 0.12 + pulse * 0.42
      ctx.fillStyle = '#ffe78a'
      ctx.fillRect(Math.round(x - r / 2), Math.round(y - r * 2), Math.max(1, S), Math.round(r * 4))
      ctx.fillRect(Math.round(x - r * 2), Math.round(y - r / 2), Math.round(r * 4), Math.max(1, S))
      ctx.fillStyle = '#fff8c8'
      ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, S), Math.max(1, S))
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  private noise01(i: number, salt: number): number {
    const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
    return n - Math.floor(n)
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

}
