import type { GameState, UnlockCondition } from '../types'
import {
  Buildings, BuildingMap, Economy, FarmPlots, ItemMap, Player, Sound, Stamina, World, Zones,
} from '../content'

export const SAVE_VERSION = 3

export function newGameState(): GameState {
  const buildings: GameState['buildings'] = {}
  for (const b of Buildings) {
    buildings[b.id] = { id: b.id, built: !!b.prePlaced, level: b.prePlaced ? 1 : 0 }
  }
  // First free plot
  const plots: GameState['plots'] = []
  const free = FarmPlots.freeStartingPlots
  for (let i = 0; i < free; i++) {
    const a = World.plotAnchors[i]
    plots.push({ id: i, pos: { ...a }, cropId: FarmPlots.defaultCropId, state: 'GROWING', plantedAt: 0, ready: false })
  }
  const unlockedZones = Zones.filter((z) => z.defaultUnlocked).map((z) => z.id)

  return {
    version: SAVE_VERSION,
    gold: Economy.startGold,
    gems: Economy.startGems,
    stamina: Stamina.startCurrent,
    maxStamina: Stamina.startMax,
    inventory: [],
    plots,
    selectedCropId: FarmPlots.defaultCropId,
    nextPlotIndex: free,
    animals: [],
    buildings,
    cookQueue: [],
    counters: {
      treeChop: 0, rockMine: 0, oreMine: 0, harvest: 0, animalCollect: 0,
      bushClear: 0, sleeps: 0, plotsBought: 0, totalSalesGold: 0, staminaEmptyCount: 0,
    },
    itemTotals: {},
    craftTotals: {},
    seenItems: {},
    recipesDiscovered: [],
    quests: {},
    unlockedZones,
    mineDeepestFloor: 0,
    gameTime: 0,
    lastSaved: Date.now(),
    audio: { ...Sound.defaults },
  }
}

// ---- Inventory helpers ----
export function invCount(s: GameState, itemId: string): number {
  const e = s.inventory.find((x) => x.itemId === itemId)
  return e ? e.count : 0
}

export function invSlotsUsed(s: GameState): number {
  return s.inventory.length
}

export function invSlotCap(s: GameState): number {
  const st = s.buildings['storage']
  let bonus = 0
  if (st && st.built) {
    const lvl = BuildingMap['storage'].levels[st.level - 1]
    bonus = (lvl?.effects.inventorySlots as number) || 0
  }
  return Player.inventorySlotCount + bonus
}

/** Returns amount actually added (capped by slot count for brand-new item types). */
export function invAdd(s: GameState, itemId: string, amount: number): number {
  if (amount <= 0) return 0
  let e = s.inventory.find((x) => x.itemId === itemId)
  if (!e) {
    if (invSlotsUsed(s) >= invSlotCap(s)) return 0
    e = { itemId, count: 0 }
    s.inventory.push(e)
  }
  const room = Player.stackLimit - e.count
  const added = Math.min(room, amount)
  e.count += added
  s.itemTotals[itemId] = (s.itemTotals[itemId] || 0) + added
  if (added > 0) s.seenItems[itemId] = true
  return added
}

export function invRemove(s: GameState, itemId: string, amount: number): boolean {
  const e = s.inventory.find((x) => x.itemId === itemId)
  if (!e || e.count < amount) return false
  e.count -= amount
  if (e.count <= 0) s.inventory = s.inventory.filter((x) => x !== e)
  return true
}

export function invIsFull(s: GameState): boolean {
  return invSlotsUsed(s) >= invSlotCap(s)
}

/** Can this item still be stored (existing stack with room, or a free slot)? */
export function canStore(s: GameState, itemId: string): boolean {
  const e = s.inventory.find((x) => x.itemId === itemId)
  if (e) return e.count < Player.stackLimit
  return invSlotsUsed(s) < invSlotCap(s)
}

// ---- Building effects ----
export function buildingEffect(s: GameState, buildingId: string, key: string): number | string | undefined {
  const bs = s.buildings[buildingId]
  if (!bs || !bs.built || bs.level < 1) return undefined
  const def = BuildingMap[buildingId]
  const lvl = def.levels[bs.level - 1]
  return lvl?.effects[key]
}

export function hasUnlock(s: GameState, key: string): boolean {
  for (const b of Buildings) {
    const bs = s.buildings[b.id]
    if (!bs || !bs.built) continue
    const lvl = b.levels[bs.level - 1]
    if (lvl && lvl.effects.unlock === key) return true
  }
  return false
}

export function maxPlotsAllowed(s: GameState): number {
  let cap = 1
  // farm_sign bonus
  const bonus = buildingEffect(s, 'farm_sign', 'plotCapBonus')
  if (typeof bonus === 'number') cap += bonus
  // base growth: allow a few even without sign
  cap = Math.max(cap, 4)
  return Math.min(FarmPlots.maxPlots, cap)
}

export function sleepDuration(s: GameState): number {
  const mult = buildingEffect(s, 'tent', 'sleepDurationMult')
  return Stamina.sleep.durationSeconds * (typeof mult === 'number' ? mult : 1)
}

export function sellPriceOf(itemId: string): number {
  const it = ItemMap[itemId]
  if (!it) return 0
  return Math.max(0, Math.round(it.sellPrice * Economy.sellMultiplier))
}

// ---- Unlock evaluation (shared by crops, recipes, buildings, zones) ----
export function meetsCondition(s: GameState, c: UnlockCondition | undefined): boolean {
  if (!c) return true
  if (c.defaultUnlocked) return true
  if (c.requiredGold !== undefined && s.gold < c.requiredGold) return false
  if (c.requiredTotalHarvestCount !== undefined && s.counters.harvest < c.requiredTotalHarvestCount) return false
  if (c.requiredTotalMineCount !== undefined && s.counters.rockMine + s.counters.oreMine < c.requiredTotalMineCount) return false
  if (c.requiredMaxStamina !== undefined && s.maxStamina < c.requiredMaxStamina) return false
  if (c.requiredBuilding !== undefined) {
    const bs = s.buildings[c.requiredBuilding]
    if (!bs || !bs.built) return false
  }
  if (c.requiredQuestIds) {
    for (const q of c.requiredQuestIds) if (!s.quests[q]?.done) return false
  }
  if (c.requiredRecipeDiscoveredCount !== undefined && s.recipesDiscovered.length < c.requiredRecipeDiscoveredCount) return false
  if (c.requiredItemSeen !== undefined && !s.seenItems[c.requiredItemSeen]) return false
  if (c.requiredDeepestFloor !== undefined && s.mineDeepestFloor < c.requiredDeepestFloor) return false
  return true
}
