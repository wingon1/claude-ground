import type { AnimalInst, GameState, Plot, WorldNode } from '../types'
import type { Bridge, LandZone } from '../content'
import {
  AnimalMap, Buildings, BuildingMap, CropMap, FarmPlots, Interactions, ItemMap, MineLevels,
  Player, RecipeMap, ResourceNodes, Stamina, World,
} from '../content'
import {
  buildingEffect, hasUnlock, invAdd, invCount, invIsFull, invRemove, maxPlotsAllowed,
  meetsCondition, newGameState, sellPriceOf, sleepDuration,
} from './GameState'
import { Camera } from './Camera'
import { Effects } from '../render/effects'
import { EventBus } from './EventBus'
import { chance, dist2, pickWeighted, randInt } from './rng'
import { AudioManager } from '../audio/AudioManager'
import { checkQuests } from '../systems/QuestSystem'
import { clearSave, loadState, saveState } from '../systems/SaveSystem'
import {
  drawApiary, drawBarn, drawBee, drawBuildSite, drawBush, drawChicken, drawCookingFire, drawCoop,
  drawCow, drawCrop, drawFarmSign, drawMine, drawOreNode, drawPlayer, drawRock, drawShell, drawShop,
  drawStorage, drawTent, drawTree,
} from '../render/sprites'
import { PAL } from '../render/palette'

type Mode = 'island' | 'mine'

const BUILD_ICON: Record<string, string> = {
  tent: 'tent', shop_stall: 'shop', cooking_fire: 'fire', chicken_coop: 'chicken',
  storage: 'box', farm_sign: 'sign', mine_entrance: 'pickaxe', barn: 'barn', apiary: 'beehive',
}

export type ContextAction = { id: string; label: string; enabled: boolean; reason?: string; icon: string }

export class Game {
  state: GameState
  bus = new EventBus()
  cam = new Camera()
  fx = new Effects()
  audio = new AudioManager()

  mode: Mode = 'island'
  mineFloor = 1

  private player = { x: 0, y: 0, facing: 1, walk: 0, action: 0, moving: false }
  private moveTarget: { x: number; y: number } | null = null
  private tapMarker: { x: number; y: number; t: number } | null = null
  private nodes: WorldNode[] = []
  private mineNodes: WorldNode[] = []
  private actionTimer = 0
  private actionDur = 0.5
  private staminaEmptyShown = false
  private vignette = 0
  private sleepPhase = 0 // 0 none, 1 fading, 2 dark, 3 waking
  private sleepTimer = 0
  private sunFlash = 0
  private autosaveTimer = 0
  private nodeIdSeq = 1
  private ctxScene = ''
  private invFullToastAt = -10
  private zoneTex = new Map<string, HTMLCanvasElement>()

  constructor() {
    this.state = newGameState()
  }

  // ---------- lifecycle ----------
  start() {
    const loaded = loadState()
    if (loaded) {
      this.state = loaded.state
      this.buildWorld()
      if (loaded.offlineSeconds > 2) this.applyOffline(loaded.offlineSeconds)
    } else {
      this.buildWorld()
    }
    this.player.x = World.playerStart.x
    this.player.y = World.playerStart.y
    this.followCam(true)
    this.audio.setSettings(this.state.audio)
  }

  private buildWorld() {
    this.nodes = []
    for (const n of World.resourceNodes) {
      const def = ResourceNodes[n.type]
      if (!def) continue
      this.nodes.push({
        id: this.nodeIdSeq++, type: n.type, pos: { x: n.x, y: n.y },
        hp: def.durability, alive: true, respawnAt: 0, shakeUntil: 0,
      })
    }
  }

  private buildMineFloor(floor: number) {
    const conf = MineLevels.floors.find((f) => f.floor === floor) || MineLevels.floors[0]
    this.mineNodes = []
    const anchors = World.mineNodeAnchors
    for (let i = 0; i < conf.nodeCount && i < anchors.length; i++) {
      this.mineNodes.push({
        id: this.nodeIdSeq++, type: 'mine_ore', pos: { ...anchors[i] },
        hp: 3, alive: true, respawnAt: 0, shakeUntil: 0,
      })
    }
  }

  resize(w: number, h: number) {
    this.cam.setView(w, h)
    this.followCam(true)
  }

  // ---------- input ----------
  tap(sx: number, sy: number) {
    this.audio.resume()
    if (this.sleepPhase !== 0) return
    const w = this.cam.screenToWorld(sx, sy)
    this.moveTarget = { x: w.x, y: w.y }
    this.tapMarker = { x: w.x, y: w.y, t: 0 }
    this.player.moving = true
    this.audio.sfx('tapMove')
  }

  // ---------- update ----------
  update(dt: number) {
    this.state.gameTime += dt
    if (this.tapMarker) { this.tapMarker.t += dt; if (this.tapMarker.t > 0.6) this.tapMarker = null }

    if (this.sleepPhase !== 0) { this.updateSleep(dt); this.fx.update(dt); this.followCam(); return }

    this.updateMovement(dt)
    this.updateInteraction(dt)
    if (this.mode === 'island') {
      this.updateRespawns()
      this.updateFarming()
      this.updateAnimals()
      this.updateCooking()
    } else {
      this.updateRespawns()
    }

    // vignette toward target based on stamina
    const targetVig = this.state.stamina <= 0 ? 0.55 : 0
    this.vignette += (targetVig - this.vignette) * Math.min(1, dt * 4)
    if (this.sunFlash > 0) this.sunFlash = Math.max(0, this.sunFlash - dt)

    this.fx.update(dt)
    this.followCam()
    this.updateScene()

    // autosave
    this.autosaveTimer += dt
    if (this.autosaveTimer >= 10) { this.autosaveTimer = 0; this.persist(false) }
  }

  /** Follow the player (zoom keeps a whole region on screen; neighbours reveal as you near an edge). */
  private followCam(instant = false) {
    this.cam.centerOn(this.player.x, this.player.y, instant)
  }

  private updateScene() {
    const scene = this.mode === 'mine' ? 'mine' : 'islandDay'
    if (scene !== this.ctxScene) {
      this.ctxScene = scene
      this.audio.setScene(scene === 'mine' ? 'mine' : 'islandDay')
    }
  }

  private updateMovement(dt: number) {
    const p = this.player
    if (this.actionTimer > 0) { p.moving = false; return }
    if (!this.moveTarget) { p.moving = false; p.walk = 0; return }
    const dx = this.moveTarget.x - p.x
    const dy = this.moveTarget.y - p.y
    const d = Math.hypot(dx, dy)
    if (d < 4) { p.moving = false; p.walk = 0; this.moveTarget = null; return }
    // If we can work and an actionable target is in range, stop to work.
    // When tired or bag-full we keep walking (e.g. toward the tent).
    if (this.canWork() && this.nearestActionable()) { p.moving = false; p.walk = 0; return }
    const sp = Player.moveSpeed
    const step = Math.min(d, sp * dt)
    const nx = p.x + (dx / d) * step
    const ny = p.y + (dy / d) * step
    // Water is non-walkable: try full step, then slide along one axis (bridges only crossing).
    if (this.mode === 'mine' || this.walkable(nx, ny)) { p.x = nx; p.y = ny }
    else if (this.walkable(nx, p.y)) { p.x = nx }
    else if (this.walkable(p.x, ny)) { p.y = ny }
    else { p.moving = false; p.walk = 0; this.moveTarget = null; return }
    p.facing = dx >= 0 ? 1 : -1
    p.moving = true
    p.walk = (p.walk + dt * 2.2) % 1
    if (Math.random() < dt * 8) this.fx.dust(p.x, p.y + 2)
  }

  /** Island walkability: inside any land zone or bridge (with a small inset so feet stay on land). */
  walkable(x: number, y: number): boolean {
    const inset = 12
    for (const z of World.landZones) {
      if (x >= z.x + inset && x <= z.x + z.w - inset && y >= z.y + inset && y <= z.y + z.h - inset) return true
    }
    for (const b of World.bridges) {
      if (x >= b.x + 6 && x <= b.x + b.w - 6 && y >= b.y && y <= b.y + b.h) return true
    }
    return false
  }

  private currentNodes(): WorldNode[] {
    return this.mode === 'mine' ? this.mineNodes : this.nodes
  }

  private nearestActionable(): { kind: 'node' | 'plot' | 'animal'; ref: WorldNode | Plot | AnimalInst } | null {
    const range = Player.interactionRange
    const r2 = range * range
    let best: { kind: 'node' | 'plot' | 'animal'; ref: WorldNode | Plot | AnimalInst; d: number } | null = null
    const consider = (kind: 'node' | 'plot' | 'animal', ref: WorldNode | Plot | AnimalInst, pos: { x: number; y: number }) => {
      const d = dist2(this.player.x, this.player.y, pos.x, pos.y)
      if (d <= r2 && (!best || d < best.d)) best = { kind, ref, d }
    }
    for (const n of this.currentNodes()) if (n.alive) consider('node', n, n.pos)
    if (this.mode === 'island') {
      for (const pl of this.state.plots) if (pl.state === 'READY') consider('plot', pl, pl.pos)
      for (const a of this.state.animals) if (a.product > 0) consider('animal', a, a.pos)
    }
    return best
  }

  private canWork(): boolean {
    return this.state.stamina > 0 && !invIsFull(this.state)
  }

  private updateInteraction(dt: number) {
    if (this.actionTimer > 0) { this.actionTimer -= dt; this.player.action = 1 - this.actionTimer / Math.max(0.0001, this.actionDur); return }
    this.player.action = 0
    if (this.state.stamina <= 0) { this.onStaminaEmpty(); return }
    const target = this.nearestActionable()
    if (!target) return
    // stop condition: inventory full (toast at most every few seconds)
    if (invIsFull(this.state)) {
      if (this.state.gameTime - this.invFullToastAt > 3) {
        this.invFullToastAt = this.state.gameTime
        this.bus.emit({ t: 'toast', text: '보관함이 가득 찼어요! 상점에서 파세요.', kind: 'bad' })
      }
      return
    }
    if (target.kind === 'node') this.actNode(target.ref as WorldNode)
    else if (target.kind === 'plot') this.actPlot(target.ref as Plot)
    else this.actAnimal(target.ref as AnimalInst)
  }

  private faceTo(x: number) { this.player.facing = x >= this.player.x ? 1 : -1 }

  private spendStamina(n: number) {
    this.state.stamina = Math.max(0, this.state.stamina - n)
    this.fx.popup(this.player.x + 10, this.player.y - 30, `-${n}`, '#ffd36b')
  }

  private gainItems(itemId: string, n: number, fromX: number, fromY: number) {
    const added = invAdd(this.state, itemId, n)
    if (added > 0) {
      const it = ItemMap[itemId]
      this.fx.fly(fromX, fromY - 10, this.player.x, this.player.y - 20, it?.emoji || '✨', it?.color || '#fff')
      this.fx.popup(fromX, fromY - 22, `+${added} ${it?.name || ''}`.trim(), it?.color || '#fff')
    }
  }

  private actNode(node: WorldNode) {
    const inMine = node.type === 'mine_ore'
    const def = inMine ? null : ResourceNodes[node.type]
    const rule = inMine ? Interactions.oreNode : Interactions[def!.kind === 'beach' ? 'beach' : def!.kind]
    const cost = (rule?.staminaCost ?? Stamina.defaultActionCost)
    this.faceTo(node.pos.x)
    // passive: save chance
    let actualCost = cost
    if (!inMine && def?.kind === 'tree' && chance(this.passive('chopStaminaSaveChance'))) actualCost = 0
    if (inMine && chance(this.passive('mineStaminaSaveChance'))) actualCost = 0
    this.spendStamina(actualCost)
    node.hp -= 1
    node.shakeUntil = performance.now() + 200
    this.actionTimer = (rule?.durationMs ?? 600) / 1000
    this.actionDur = this.actionTimer

    if (inMine) {
      this.audio.sfx('mineRock')
      this.fx.burst('chip', node.pos.x, node.pos.y - 8, 4, PAL.rockLight)
    } else if (def!.kind === 'tree') {
      this.audio.sfx('chopTree')
      this.fx.burst('leaf', node.pos.x, node.pos.y - 28, 5, PAL.leaf)
    } else if (def!.kind === 'rock') {
      this.audio.sfx('mineRock')
      this.fx.burst('chip', node.pos.x, node.pos.y - 8, 5, PAL.rockLight)
    } else {
      this.audio.sfx('harvestCrop')
      this.fx.burst('leaf', node.pos.x, node.pos.y - 10, 4, PAL.leafLight)
    }

    if (node.hp <= 0) {
      node.alive = false
      if (inMine) {
        const conf = MineLevels.floors.find((f) => f.floor === this.mineFloor) || MineLevels.floors[0]
        const drop = pickWeighted(conf.drops)
        const amt = randInt(drop.min, drop.max)
        this.gainItems(drop.itemId, amt, node.pos.x, node.pos.y)
        this.state.counters.oreMine += 1
        this.state.mineDeepestFloor = Math.max(this.state.mineDeepestFloor, this.mineFloor)
        node.respawnAt = this.state.gameTime + 12
      } else {
        for (const d of def!.drops) this.gainItems(d.itemId, randInt(d.min, d.max), node.pos.x, node.pos.y)
        for (const rd of def!.rareDrops) if (chance(rd.chance ?? 0)) this.gainItems(rd.itemId, randInt(rd.min, rd.max), node.pos.x, node.pos.y)
        if (def!.kind === 'tree') this.state.counters.treeChop += 1
        else if (def!.kind === 'rock') this.state.counters.rockMine += 1
        else if (def!.kind === 'bush') this.state.counters.bushClear += 1
        node.respawnAt = this.state.gameTime + def!.respawnSeconds
      }
      this.audio.sfx('collectItem')
    }
    this.afterAction()
  }

  private actPlot(plot: Plot) {
    const crop = CropMap[plot.cropId]
    this.faceTo(plot.pos.x)
    this.spendStamina(crop.harvestStaminaCost)
    this.actionTimer = (Interactions.cropPlot.durationMs ?? 480) / 1000
    this.actionDur = this.actionTimer
    const bonus = this.passive('cropYieldBonus')
    const amt = randInt(crop.yield.min, crop.yield.max) + Math.floor(bonus)
    this.gainItems(crop.yield.itemId, amt, plot.pos.x, plot.pos.y)
    this.state.counters.harvest += 1
    this.fx.burst('sparkle', plot.pos.x, plot.pos.y - 14, 6, '#fff0a0')
    this.audio.sfx('harvestCrop')
    // auto-replant
    if (FarmPlots.autoReplant) { plot.state = 'GROWING'; plot.plantedAt = this.state.gameTime; plot.ready = false }
    else plot.state = 'EMPTY'
    this.afterAction()
  }

  private actAnimal(a: AnimalInst) {
    const def = AnimalMap[a.animalId]
    this.faceTo(a.pos.x)
    this.spendStamina(def.collectStaminaCost)
    this.actionTimer = (Interactions.animal.durationMs ?? 500) / 1000
    this.actionDur = this.actionTimer
    const amt = randInt(def.product.min, def.product.max)
    this.gainItems(def.product.itemId, amt, a.pos.x, a.pos.y)
    this.state.counters.animalCollect += 1
    a.product = 0
    a.nextAt = this.state.gameTime + def.produceSeconds
    this.fx.burst('sparkle', a.pos.x, a.pos.y - 10, 5, '#fff0a0')
    this.audio.sfx('collectItem')
    this.afterAction()
  }

  private afterAction() {
    const done = checkQuests(this.state)
    for (const q of done) { this.bus.emit({ t: 'quest', questId: q.id, name: q.name }); this.audio.sfx('questDone') }
    if (this.state.stamina <= 0) this.onStaminaEmpty()
    this.bus.emit({ t: 'state' })
  }

  private onStaminaEmpty() {
    if (this.staminaEmptyShown) return
    this.staminaEmptyShown = true
    this.state.counters.staminaEmptyCount += 1
    this.audio.sfx('staminaEmpty')
    this.bus.emit({ t: 'staminaEmpty' })
    this.bus.emit({ t: 'toast', text: '너무 피곤해요. 텐트에서 쉬세요.', kind: 'bad' })
    checkQuests(this.state)
    this.persist(false)
  }

  private passive(key: string): number {
    // MVP: no owned passives yet; structure ready. Returns 0.
    void key
    return 0
  }

  // ---------- world systems ----------
  private updateRespawns() {
    for (const n of this.currentNodes()) {
      if (!n.alive && n.respawnAt > 0 && this.state.gameTime >= n.respawnAt) {
        const def = n.type === 'mine_ore' ? null : ResourceNodes[n.type]
        n.alive = true
        n.hp = def ? def.durability : 3
        n.respawnAt = 0
      }
    }
  }

  private updateFarming() {
    for (const pl of this.state.plots) {
      if (pl.state === 'GROWING') {
        const crop = CropMap[pl.cropId]
        if (this.state.gameTime - pl.plantedAt >= crop.growthSeconds) { pl.state = 'READY'; pl.ready = true }
      }
    }
  }

  private updateAnimals() {
    for (const a of this.state.animals) {
      if (a.product <= 0 && this.state.gameTime >= a.nextAt) a.product = 1
    }
  }

  private updateCooking() {
    if (this.state.cookQueue.length === 0) return
    const remaining = []
    let changed = false
    for (const job of this.state.cookQueue) {
      if (this.state.gameTime >= job.doneAt) {
        const recipe = RecipeMap[job.recipeId]
        for (const out of recipe.outputs) invAdd(this.state, out.itemId, out.amount)
        if (!this.state.recipesDiscovered.includes(recipe.id)) this.state.recipesDiscovered.push(recipe.id)
        changed = true
      } else remaining.push(job)
    }
    this.state.cookQueue = remaining
    if (changed) { this.audio.sfx('collectItem'); checkQuests(this.state); this.bus.emit({ t: 'state' }) }
  }

  private applyOffline(seconds: number) {
    // advance timers only; never auto-harvest
    const t = this.state.gameTime + seconds
    for (const pl of this.state.plots) {
      if (pl.state === 'GROWING') {
        const crop = CropMap[pl.cropId]
        if (t - pl.plantedAt >= crop.growthSeconds) { pl.state = 'READY'; pl.ready = true }
      }
    }
    for (const a of this.state.animals) if (a.product <= 0 && t >= a.nextAt) a.product = 1
    const remaining = []
    for (const job of this.state.cookQueue) {
      if (t >= job.doneAt) {
        const recipe = RecipeMap[job.recipeId]
        for (const out of recipe.outputs) invAdd(this.state, out.itemId, out.amount)
        if (!this.state.recipesDiscovered.includes(recipe.id)) this.state.recipesDiscovered.push(recipe.id)
      } else remaining.push(job)
    }
    this.state.cookQueue = remaining
    for (const n of this.nodes) if (!n.alive && n.respawnAt > 0 && t >= n.respawnAt) { const def = ResourceNodes[n.type]; n.alive = true; n.hp = def.durability; n.respawnAt = 0 }
    this.state.gameTime = t
    this.bus.emit({ t: 'toast', text: '돌아왔어요! 그동안 작물이 자랐어요.', kind: 'info' })
  }

  // ---------- sleep ----------
  private updateSleep(dt: number) {
    this.sleepTimer -= dt
    if (this.sleepPhase === 1) {
      this.vignette = Math.min(0.92, this.vignette + dt * 1.6)
      if (this.vignette >= 0.9) { this.sleepPhase = 2; this.sleepTimer = sleepDuration(this.state) }
      if (Math.random() < dt * 4) this.fx.zzz(this.player.x, this.player.y - 40)
    } else if (this.sleepPhase === 2) {
      if (Math.random() < dt * 3) this.fx.zzz(this.player.x, this.player.y - 40)
      if (this.sleepTimer <= 0) { this.wake() }
    } else if (this.sleepPhase === 3) {
      this.vignette = Math.max(0, this.vignette - dt * 1.6)
      if (this.vignette <= 0.02) { this.vignette = 0; this.sleepPhase = 0 }
    }
  }

  private wake() {
    this.state.maxStamina = Math.min(Stamina.hardCap, this.state.maxStamina + Stamina.sleep.increaseAmount)
    this.state.stamina = this.state.maxStamina
    this.state.counters.sleeps += 1
    this.staminaEmptyShown = false
    this.sleepPhase = 3
    this.sunFlash = 1
    this.audio.sfx('wakeUp')
    window.setTimeout(() => this.audio.sfx('maxStaminaUp'), 250)
    this.bus.emit({ t: 'maxStaminaUp', value: this.state.maxStamina })
    const done = checkQuests(this.state)
    for (const q of done) this.bus.emit({ t: 'quest', questId: q.id, name: q.name })
    this.persist(true)
    this.bus.emit({ t: 'state' })
  }

  canSleep(): boolean {
    const tent = this.state.buildings['tent']
    return !!tent?.built && this.state.stamina === 0
  }

  sleep() {
    if (!this.canSleep()) {
      this.bus.emit({ t: 'toast', text: this.state.stamina > 0 ? '아직 잘 만큼 피곤하지 않아요.' : '텐트가 필요해요.', kind: 'bad' })
      this.audio.sfx('error')
      return
    }
    this.sleepPhase = 1
    this.sleepTimer = 0
    this.moveTarget = null
    this.audio.sfx('sleepStart')
    this.audio.setScene('islandNight')
    this.bus.emit({ t: 'sleepStart' })
  }

  // ---------- context (nearby UI triggers) ----------
  getContext(): ContextAction[] {
    if (this.mode === 'mine') return []
    const out: ContextAction[] = []
    const range2 = 56 * 56
    for (const b of Buildings) {
      const bs = this.state.buildings[b.id]
      const near = dist2(this.player.x, this.player.y, b.position.x, b.position.y) <= range2
      if (!near) continue
      if (!bs.built) {
        // build site
        const can = meetsCondition(this.state, b.unlockCondition)
        out.push({ id: `build:${b.id}`, icon: BUILD_ICON[b.id] || 'hammer', label: `${b.name} 짓기`, enabled: can, reason: can ? undefined : '조건 미달' })
        continue
      }
      if (b.id === 'tent') {
        const ok = this.canSleep()
        out.push({ id: 'sleep', icon: 'sleep', label: '잠자기', enabled: ok, reason: ok ? undefined : (this.state.stamina > 0 ? '스태미나를 모두 쓰세요' : undefined) })
      } else if (b.id === 'shop_stall') {
        out.push({ id: 'panel:shop', icon: 'shop', label: '상점', enabled: true })
      } else if (b.id === 'cooking_fire') {
        out.push({ id: 'panel:cooking', icon: 'pot', label: '요리', enabled: true })
      } else if (b.id === 'mine_entrance') {
        out.push({ id: 'mine:enter', icon: 'pickaxe', label: '광산 들어가기', enabled: true })
      }
    }
    return out
  }

  doContext(id: string) {
    this.audio.resume()
    if (id === 'sleep') { this.sleep(); return }
    if (id.startsWith('panel:')) { this.bus.emit({ t: 'openPanel', panel: id.slice(6) }); this.audio.sfx('uiOpen'); return }
    if (id.startsWith('build:')) { this.build(id.slice(6)); return }
    if (id === 'mine:enter') { this.enterMine(); return }
  }

  // ---------- shop / build / farm / cook actions (called by UI) ----------
  plotCost(): number {
    const owned = this.state.plots.length
    return Math.round(FarmPlots.basePurchaseCost * Math.pow(FarmPlots.costGrowthMultiplier, Math.max(0, owned - FarmPlots.freeStartingPlots)))
  }

  buyPlot(): boolean {
    if (this.state.plots.length >= maxPlotsAllowed(this.state)) {
      this.bus.emit({ t: 'toast', text: '더 짓려면 농장 표지판이 필요해요.', kind: 'bad' }); return false
    }
    if (this.state.nextPlotIndex >= World.plotAnchors.length) { this.bus.emit({ t: 'toast', text: '자리가 없어요.', kind: 'bad' }); return false }
    const cost = this.plotCost()
    if (this.state.gold < cost) { this.bus.emit({ t: 'toast', text: '골드가 부족해요.', kind: 'bad' }); this.audio.sfx('error'); return false }
    this.state.gold -= cost
    const a = World.plotAnchors[this.state.nextPlotIndex++]
    this.state.plots.push({ id: this.state.plots.length, pos: { ...a }, cropId: this.state.selectedCropId, state: 'GROWING', plantedAt: this.state.gameTime, ready: false })
    this.state.counters.plotsBought += 1
    this.audio.sfx('build')
    this.fx.burst('sparkle', a.x, a.y - 10, 8, '#fff0a0')
    this.after()
    return true
  }

  setSelectedCrop(cropId: string): boolean {
    const crop = CropMap[cropId]
    if (!crop) return false
    if (!meetsCondition(this.state, crop.unlockCondition)) { this.bus.emit({ t: 'toast', text: '아직 잠겨 있어요.', kind: 'bad' }); return false }
    this.state.selectedCropId = cropId
    this.bus.emit({ t: 'toast', text: `새 밭에 ${crop.name}을(를) 심어요.`, kind: 'info' })
    this.after()
    return true
  }

  isCropUnlocked(cropId: string): boolean {
    const crop = CropMap[cropId]
    return !!crop && meetsCondition(this.state, crop.unlockCondition)
  }

  sell(itemId: string, qty: number): boolean {
    const have = invCount(this.state, itemId)
    const n = Math.min(qty, have)
    if (n <= 0) return false
    invRemove(this.state, itemId, n)
    const gain = sellPriceOf(itemId) * n
    this.state.gold += gain
    this.state.counters.totalSalesGold += gain
    this.audio.sfx('sellItem')
    this.bus.emit({ t: 'toast', text: `+${gain} 골드`, kind: 'good' })
    this.after()
    return true
  }

  sellAll(category: string): number {
    let total = 0
    for (const e of [...this.state.inventory]) {
      const it = ItemMap[e.itemId]
      if (it && it.category === category) { total += sellPriceOf(e.itemId) * e.count; this.sellQuiet(e.itemId, e.count) }
    }
    if (total > 0) { this.audio.sfx('sellItem'); this.bus.emit({ t: 'toast', text: `+${total} 골드`, kind: 'good' }) }
    this.after()
    return total
  }

  private sellQuiet(itemId: string, n: number) {
    invRemove(this.state, itemId, n)
    const gain = sellPriceOf(itemId) * n
    this.state.gold += gain
    this.state.counters.totalSalesGold += gain
  }

  canAfford(cost?: { gold?: number; items?: { itemId: string; amount: number }[] }): boolean {
    if (!cost) return true
    if (cost.gold && this.state.gold < cost.gold) return false
    if (cost.items) for (const it of cost.items) if (invCount(this.state, it.itemId) < it.amount) return false
    return true
  }

  private payCost(cost?: { gold?: number; items?: { itemId: string; amount: number }[] }) {
    if (!cost) return
    if (cost.gold) this.state.gold -= cost.gold
    if (cost.items) for (const it of cost.items) invRemove(this.state, it.itemId, it.amount)
  }

  build(buildingId: string): boolean {
    const def = BuildingMap[buildingId]
    const bs = this.state.buildings[buildingId]
    if (!def || !bs || bs.built) return false
    if (!meetsCondition(this.state, def.unlockCondition)) { this.bus.emit({ t: 'toast', text: '조건을 아직 못 채웠어요.', kind: 'bad' }); this.audio.sfx('error'); return false }
    if (!this.canAfford(def.buildCost)) { this.bus.emit({ t: 'toast', text: '재료가 부족해요.', kind: 'bad' }); this.audio.sfx('error'); return false }
    this.payCost(def.buildCost)
    bs.built = true
    bs.level = 1
    this.audio.sfx('build')
    this.fx.burst('sparkle', def.position.x, def.position.y - 10, 12, '#fff0a0')
    this.bus.emit({ t: 'toast', text: `${def.name} 완성!`, kind: 'good' })
    this.after()
    return true
  }

  upgradeCost(buildingId: string): { gold?: number; items?: { itemId: string; amount: number }[] } | null {
    const def = BuildingMap[buildingId]
    const bs = this.state.buildings[buildingId]
    if (!def || !bs || !bs.built || bs.level >= def.maxLevel) return null
    return def.levels[bs.level]?.upgradeCost || null
  }

  upgrade(buildingId: string): boolean {
    const def = BuildingMap[buildingId]
    const bs = this.state.buildings[buildingId]
    if (!def || !bs || !bs.built || bs.level >= def.maxLevel) return false
    const cost = def.levels[bs.level]?.upgradeCost
    if (!this.canAfford(cost)) { this.bus.emit({ t: 'toast', text: '재료가 부족해요.', kind: 'bad' }); this.audio.sfx('error'); return false }
    this.payCost(cost)
    bs.level += 1
    this.audio.sfx('upgrade')
    this.fx.burst('sparkle', def.position.x, def.position.y - 10, 12, '#fff0a0')
    this.bus.emit({ t: 'toast', text: `${def.name} Lv.${bs.level}!`, kind: 'good' })
    this.after()
    return true
  }

  buyAnimal(animalId: string): boolean {
    const def = AnimalMap[animalId]
    if (!def) return false
    const bldg = BuildingMap[def.requiredBuilding]
    if (!this.state.buildings[def.requiredBuilding]?.built) { this.bus.emit({ t: 'toast', text: `${bldg?.name ?? '시설'}이(가) 필요해요.`, kind: 'bad' }); this.audio.sfx('error'); return false }
    const cap = (buildingEffect(this.state, def.requiredBuilding, 'animalCapacity') as number) || 0
    const count = this.state.animals.filter((a) => a.animalId === animalId).length
    if (count >= cap) { this.bus.emit({ t: 'toast', text: `${bldg?.name ?? '시설'}이(가) 가득 찼어요. 업그레이드 하세요.`, kind: 'bad' }); return false }
    if (this.state.gold < def.purchaseCost) { this.bus.emit({ t: 'toast', text: '골드가 부족해요.', kind: 'bad' }); this.audio.sfx('error'); return false }
    this.state.gold -= def.purchaseCost
    const b = BuildingMap[def.requiredBuilding]
    const slot = count
    const pos = { x: b.position.x - 30 + (slot % 3) * 26, y: b.position.y + 14 + Math.floor(slot / 3) * 18 }
    this.state.animals.push({ id: Date.now() + slot, animalId, pos, product: 0, nextAt: this.state.gameTime + def.produceSeconds })
    this.audio.sfx('build')
    this.after()
    return true
  }

  cookSlots(): number {
    return (buildingEffect(this.state, 'cooking_fire', 'cookSlots') as number) || 0
  }

  canCook(recipeId: string): boolean {
    const r = RecipeMap[recipeId]
    if (!r) return false
    if (!hasUnlock(this.state, 'cooking')) return false
    if (this.state.cookQueue.length >= this.cookSlots()) return false
    for (const inp of r.inputs) if (invCount(this.state, inp.itemId) < inp.amount) return false
    return true
  }

  cook(recipeId: string): boolean {
    if (!this.canCook(recipeId)) { this.audio.sfx('error'); return false }
    const r = RecipeMap[recipeId]
    for (const inp of r.inputs) invRemove(this.state, inp.itemId, inp.amount)
    this.state.cookQueue.push({ recipeId, doneAt: this.state.gameTime + r.craftSeconds })
    this.audio.sfx('build')
    this.after()
    return true
  }

  // ---------- mine ----------
  enterMine() {
    if (!hasUnlock(this.state, 'mine')) { this.bus.emit({ t: 'toast', text: '광산 입구가 필요해요.', kind: 'bad' }); return }
    this.mode = 'mine'
    this.mineFloor = 1
    this.buildMineFloor(this.mineFloor)
    this.player.x = World.world.width / 2
    this.player.y = World.world.height - 120
    this.moveTarget = null
    this.followCam(true)
    this.audio.setScene('mine')
    this.audio.sfx('uiOpen')
    this.bus.emit({ t: 'state' })
  }

  exitMine() {
    this.mode = 'island'
    this.player.x = BuildingMap['mine_entrance'].position.x
    this.player.y = BuildingMap['mine_entrance'].position.y + 50
    this.moveTarget = null
    this.followCam(true)
    this.audio.setScene('islandDay')
    this.persist(false)
    this.bus.emit({ t: 'state' })
  }

  mineFloorMax(): number {
    return MineLevels.floors.length
  }

  descend(): boolean {
    const next = this.mineFloor + 1
    const conf = MineLevels.floors.find((f) => f.floor === next)
    if (!conf) return false
    this.mineFloor = next
    this.buildMineFloor(next)
    this.player.x = World.world.width / 2
    this.player.y = World.world.height - 120
    this.followCam(true)
    this.audio.sfx('uiOpen')
    this.bus.emit({ t: 'state' })
    return true
  }

  // ---------- persistence ----------
  private after() { checkQuests(this.state); this.persist(false); this.bus.emit({ t: 'state' }) }
  persist(_immediate: boolean) { void _immediate; saveState(this.state) }
  setAudioSettings(a: { master: number; bgm: number; sfx: number; muted: boolean }) {
    this.state.audio = { ...a }
    this.audio.setSettings(a)
    this.persist(false)
  }
  resetGame() {
    clearSave()
    this.state = newGameState()
    this.mode = 'island'
    this.buildWorld()
    this.player.x = World.playerStart.x
    this.player.y = World.playerStart.y
    this.staminaEmptyShown = false
    this.followCam(true)
    this.audio.setSettings(this.state.audio)
    this.audio.setScene('islandDay')
    this.bus.emit({ t: 'state' })
  }

  // ---------- render ----------
  render(ctx: CanvasRenderingContext2D) {
    const W = this.cam.viewW
    const H = this.cam.viewH
    const z = this.cam.zoom
    ctx.save()
    ctx.imageSmoothingEnabled = false
    // single world transform — integer translate keeps everything pixel-stable (no jitter)
    ctx.translate(Math.round(-this.cam.x * z), Math.round(-this.cam.y * z))
    ctx.scale(z, z)
    if (this.mode === 'mine') this.renderMine(ctx)
    else this.renderIsland(ctx)
    ctx.restore()
    // screen-space overlays
    this.fx.draw(ctx, this.cam)
    this.drawTapMarker(ctx)
    if (this.mode === 'mine') this.drawMineDarkness(ctx, W, H)
    this.renderOverlays(ctx, W, H)
  }

  private drawTapMarker(ctx: CanvasRenderingContext2D) {
    if (!this.tapMarker) return
    const s = this.cam.worldToScreen(this.tapMarker.x, this.tapMarker.y)
    const r = (6 + this.tapMarker.t * 18) * this.cam.zoom
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - this.tapMarker.t / 0.6)})`
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke()
  }

  private drawMineDarkness(ctx: CanvasRenderingContext2D, W: number, H: number) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.7)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.55)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  private rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + rr, y)
    ctx.arcTo(x + w, y, x + w, y + h, rr)
    ctx.arcTo(x + w, y + h, x, y + h, rr)
    ctx.arcTo(x, y + h, x, y, rr)
    ctx.arcTo(x, y, x + w, y, rr)
    ctx.closePath()
  }

  // Flowing water across the visible world rect (drawn in world coords).
  private drawWater(ctx: CanvasRenderingContext2D) {
    const x0 = this.cam.x, y0 = this.cam.y
    const w = this.cam.spanW(), h = this.cam.spanH()
    const grad = ctx.createLinearGradient(0, y0, 0, y0 + h)
    grad.addColorStop(0, PAL.water2)
    grad.addColorStop(1, PAL.water1)
    ctx.fillStyle = grad
    ctx.fillRect(x0 - 4, y0 - 4, w + 8, h + 8)
    // scrolling wavy foam lines (gentle flow)
    const t = this.state.gameTime
    const rowH = 26
    ctx.lineWidth = 2
    for (let row = 0; row < Math.ceil(h / rowH) + 2; row++) {
      const baseY = Math.floor(y0 / rowH) * rowH + row * rowH
      const speed = row % 2 === 0 ? 14 : -10
      const phase = t * speed
      const alpha = row % 3 === 0 ? 0.16 : 0.09
      ctx.strokeStyle = `rgba(207,238,251,${alpha})`
      ctx.beginPath()
      for (let x = x0 - 8; x <= x0 + w + 8; x += 8) {
        const y = baseY + Math.sin((x + phase) * 0.05 + row) * 3
        if (x === x0 - 8) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  private getZoneTexture(z: LandZone): HTMLCanvasElement {
    const cached = this.zoneTex.get(z.id)
    if (cached) return cached
    const pad = 16
    const cv = document.createElement('canvas')
    cv.width = z.w + pad * 2
    cv.height = z.h + pad * 2
    const c = cv.getContext('2d')!
    const ox = pad, oy = pad
    // foam ring + sandy shore (rounded)
    c.fillStyle = PAL.waterFoam; this.rrect(c, ox - 12, oy - 12, z.w + 24, z.h + 24, 30); c.fill()
    c.fillStyle = PAL.sand; this.rrect(c, ox - 7, oy - 7, z.w + 14, z.h + 14, 26); c.fill()
    c.fillStyle = PAL.sandDark; this.rrect(c, ox - 7, oy - 7, z.w + 14, z.h + 14, 26)
    // grass body, clipped to rounded island
    c.save()
    this.rrect(c, ox, oy, z.w, z.h, 18); c.clip()
    c.fillStyle = PAL.grass2; c.fillRect(ox, oy, z.w, z.h)
    // natural blotches (static value-noise look, no checker)
    const hash = (x: number, y: number) => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + z.x + z.y) * 43758.5453
      return n - Math.floor(n)
    }
    const tones = [PAL.grass1, PAL.grass3, PAL.grassDark]
    for (let i = 0; i < Math.floor((z.w * z.h) / 900); i++) {
      const hx = hash(i, 1), hy = hash(i, 2), hs = hash(i, 3)
      const px = ox + hx * z.w, py = oy + hy * z.h
      const rad = 10 + hs * 26
      c.fillStyle = tones[Math.floor(hash(i, 4) * tones.length)]
      c.globalAlpha = 0.18 + hash(i, 5) * 0.16
      c.beginPath(); c.ellipse(px, py, rad, rad * 0.7, 0, 0, Math.PI * 2); c.fill()
    }
    c.globalAlpha = 1
    // sparse grass blades
    for (let i = 0; i < Math.floor((z.w * z.h) / 520); i++) {
      const hx = hash(i, 7), hy = hash(i, 8)
      const px = Math.round(ox + hx * z.w), py = Math.round(oy + hy * z.h)
      c.fillStyle = hash(i, 9) > 0.5 ? PAL.grassDark : PAL.grass3
      c.fillRect(px, py, 2, hash(i, 10) > 0.5 ? 3 : 2)
    }
    c.restore()
    this.zoneTex.set(z.id, cv)
    return cv
  }

  private drawZone(ctx: CanvasRenderingContext2D, z: LandZone) {
    const tex = this.getZoneTexture(z)
    ctx.drawImage(tex, z.x - 16, z.y - 16)
  }

  private drawBridge(ctx: CanvasRenderingContext2D, b: Bridge) {
    const horizontal = b.w > b.h
    ctx.fillStyle = PAL.trunkDark
    ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4)
    ctx.fillStyle = '#b9854c'
    ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.fillStyle = '#a8743c'
    if (horizontal) for (let i = 0; i < b.w; i += 12) ctx.fillRect(b.x + i, b.y, 2, b.h)
    else for (let i = 0; i < b.h; i += 12) ctx.fillRect(b.x, b.y + i, b.w, 2)
    ctx.fillStyle = PAL.trunk
    if (horizontal) { ctx.fillRect(b.x, b.y - 4, b.w, 4); ctx.fillRect(b.x, b.y + b.h, b.w, 4) }
    else { ctx.fillRect(b.x - 4, b.y, 4, b.h); ctx.fillRect(b.x + b.w, b.y, 4, b.h) }
  }

  private renderIsland(ctx: CanvasRenderingContext2D) {
    this.drawWater(ctx)
    for (const z of World.landZones) this.drawZone(ctx, z)
    for (const b of World.bridges) this.drawBridge(ctx, b)

    // y-sorted draw list, all in world coordinates
    type Drawable = { y: number; fn: () => void }
    const list: Drawable[] = []
    for (const b of Buildings) {
      const bs = this.state.buildings[b.id]
      list.push({ y: b.position.y, fn: () => this.drawBuilding(ctx, b.id, bs.built, bs.level, b.position.x, b.position.y) })
    }
    for (const pl of this.state.plots) {
      const crop = CropMap[pl.cropId]
      const growth = pl.state === 'READY' ? 1 : Math.min(1, (this.state.gameTime - pl.plantedAt) / crop.growthSeconds)
      list.push({ y: pl.pos.y, fn: () => drawCrop(ctx, pl.pos.x, pl.pos.y, growth, pl.state === 'READY', ItemMap[crop.yield.itemId]?.color || '#e3c45a') })
    }
    for (const a of this.state.animals) {
      list.push({ y: a.pos.y, fn: () => this.drawAnimal(ctx, a.animalId, a.pos.x, a.pos.y, a.product > 0) })
    }
    for (const n of this.nodes) {
      if (!n.alive) continue
      const def = ResourceNodes[n.type]
      const shake = n.shakeUntil > performance.now() ? Math.round(Math.sin(performance.now() / 28) * 2) : 0
      list.push({ y: n.pos.y, fn: () => this.drawResource(ctx, def.kind, n.type, n.pos.x + shake, n.pos.y) })
    }
    list.push({ y: this.player.y, fn: () => drawPlayer(ctx, this.player.x, this.player.y, this.player.facing, this.player.walk, this.player.action, this.state.stamina <= 0, this.player.moving) })

    list.sort((a, b) => a.y - b.y)
    for (const d of list) d.fn()
  }

  private renderMine(ctx: CanvasRenderingContext2D) {
    const tile = World.world.tile
    const x0 = Math.floor(this.cam.x / tile) * tile
    const y0 = Math.floor(this.cam.y / tile) * tile
    for (let wy = y0; wy < this.cam.y + this.cam.spanH() + tile; wy += tile) {
      for (let wx = x0; wx < this.cam.x + this.cam.spanW() + tile; wx += tile) {
        const checker = ((wx / tile) + (wy / tile)) % 2 === 0
        ctx.fillStyle = checker ? '#3a3340' : '#332d38'
        ctx.fillRect(wx, wy, tile + 1, tile + 1)
      }
    }
    type Drawable = { y: number; fn: () => void }
    const list: Drawable[] = []
    for (const n of this.mineNodes) {
      if (!n.alive) continue
      list.push({ y: n.pos.y, fn: () => drawOreNode(ctx, n.pos.x, n.pos.y) })
    }
    list.push({ y: this.player.y, fn: () => drawPlayer(ctx, this.player.x, this.player.y, this.player.facing, this.player.walk, this.player.action, this.state.stamina <= 0, this.player.moving) })
    list.sort((a, b) => a.y - b.y)
    for (const d of list) d.fn()
  }

  private drawResource(ctx: CanvasRenderingContext2D, kind: string, type: string, x: number, y: number) {
    if (kind === 'tree') drawTree(ctx, x, y, type === 'tree_big')
    else if (kind === 'rock') drawRock(ctx, x, y, type === 'rock_big')
    else if (kind === 'bush') drawBush(ctx, x, y, false)
    else drawShell(ctx, x, y)
  }

  private drawBuilding(ctx: CanvasRenderingContext2D, id: string, built: boolean, level: number, x: number, y: number) {
    if (!built) {
      drawBuildSite(ctx, x, y, BUILD_ICON[id] || 'hammer')
      return
    }
    switch (id) {
      case 'tent': drawTent(ctx, x, y, level); break
      case 'shop_stall': drawShop(ctx, x, y); break
      case 'cooking_fire': drawCookingFire(ctx, x, y, level); break
      case 'chicken_coop': drawCoop(ctx, x, y); break
      case 'storage': drawStorage(ctx, x, y); break
      case 'farm_sign': drawFarmSign(ctx, x, y); break
      case 'mine_entrance': drawMine(ctx, x, y); break
      case 'barn': drawBarn(ctx, x, y); break
      case 'apiary': drawApiary(ctx, x, y); break
      default: break
    }
  }

  private drawAnimal(ctx: CanvasRenderingContext2D, animalId: string, x: number, y: number, ready: boolean) {
    if (animalId === 'cow') drawCow(ctx, x, y, ready)
    else if (animalId === 'bee') drawBee(ctx, x, y, ready)
    else drawChicken(ctx, x, y, ready)
  }

  private renderOverlays(ctx: CanvasRenderingContext2D, W: number, H: number) {
    if (this.vignette > 0.01) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75)
      g.addColorStop(0, 'rgba(20,18,40,0)')
      g.addColorStop(1, `rgba(15,12,35,${this.vignette})`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, W, H)
    }
    if (this.sunFlash > 0) {
      ctx.fillStyle = `rgba(255,240,180,${this.sunFlash * 0.5})`
      ctx.fillRect(0, 0, W, H)
    }
  }

  // ---------- snapshot for UI ----------
  getMode(): Mode { return this.mode }
}
