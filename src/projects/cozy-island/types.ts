// Shared types for Cozy Island. No enums (erasableSyntaxOnly) — string unions only.

export type Vec = { x: number; y: number }

export type ItemCategory = 'resource' | 'crop' | 'animal' | 'food' | 'ore'

export type ItemDef = {
  id: string
  name: string
  emoji: string
  category: ItemCategory
  sellPrice: number
  color: string
}

export type DropDef = { itemId: string; min: number; max: number; chance?: number; weight?: number }

export type MineDropDef = { itemId: string; min: number; max: number; weight: number }

export type MineLevelDef = {
  floor: number
  name: string
  nodeCount: number
  nodeHp: number
  staminaCost: number
  unlockCondition?: UnlockCondition
  descendRequirement?: { minedNodes: number }
  drops: MineDropDef[]
}

export type ResourceNodeDef = {
  name: string
  kind: 'tree' | 'rock' | 'bush' | 'beach'
  durability: number
  staminaCost: number
  respawnSeconds: number
  drops: DropDef[]
  rareDrops: DropDef[]
}

export type CropDef = {
  id: string
  name: string
  growthSeconds: number
  harvestStaminaCost: number
  yield: { itemId: string; min: number; max: number }
  unlockCondition: UnlockCondition
}

export type UnlockCondition = {
  defaultUnlocked?: boolean
  requiredGold?: number
  requiredTotalHarvestCount?: number
  requiredTotalMineCount?: number
  requiredMaxStamina?: number
  requiredBuilding?: string
  requiredQuestIds?: string[]
  requiredRecipeDiscoveredCount?: number
  requiredItemSeen?: string
  requiredDeepestFloor?: number
}

export type CostDef = { gold?: number; items?: { itemId: string; amount: number }[] }

export type BuildingLevel = { upgradeCost?: CostDef; effects: Record<string, number | string> }

export type BuildingDef = {
  id: string
  name: string
  emoji: string
  category: string
  prePlaced?: boolean
  position: Vec
  footprint: { w: number; h: number }
  buildCost?: CostDef
  unlockCondition?: UnlockCondition
  maxLevel: number
  levels: BuildingLevel[]
}

export type RecipeDef = {
  id: string
  name: string
  emoji: string
  inputs: { itemId: string; amount: number }[]
  outputs: { itemId: string; amount: number }[]
  craftSeconds: number
  unlockCondition: UnlockCondition
}

export type AnimalDef = {
  id: string
  name: string
  emoji: string
  requiredBuilding: string
  purchaseCost: number
  product: { itemId: string; min: number; max: number }
  produceSeconds: number
  collectStaminaCost: number
}

export type QuestObjective = {
  type:
    | 'chop' | 'mine' | 'harvest' | 'collectAnimal' | 'sleep'
    | 'maxStamina' | 'gold' | 'collectItem' | 'sell' | 'buyPlot'
    | 'build' | 'craft' | 'staminaEmpty'
  target: number
  itemId?: string
  buildingId?: string
  recipeId?: string
}

export type QuestDef = {
  id: string
  name: string
  desc: string
  requires?: string
  objective: QuestObjective
  reward: { gold?: number; gems?: number; items?: { itemId: string; amount: number }[] }
}

// ---- Runtime state ----

export type PlotState = 'EMPTY' | 'GROWING' | 'READY' | 'PAUSED_NO_STAMINA'

export type Plot = {
  id: number
  pos: Vec
  cropId: string
  state: PlotState
  plantedAt: number // game seconds when growth started
  ready: boolean
}

export type WorldNode = {
  id: number
  type: string
  pos: Vec
  hp: number
  alive: boolean
  respawnAt: number // game seconds, 0 if alive
  shakeUntil: number
}

export type AnimalInst = {
  id: number
  animalId: string
  pos: Vec
  product: number // count ready (0 or 1+)
  nextAt: number // game seconds when next product ready
}

export type CookJob = { recipeId: string; doneAt: number }

export type BuildingState = { id: string; built: boolean; level: number }

export type InventoryEntry = { itemId: string; count: number }

export type GameState = {
  version: number
  gold: number
  gems: number
  stamina: number
  maxStamina: number
  inventory: InventoryEntry[]
  plots: Plot[]
  animals: AnimalInst[]
  buildings: Record<string, BuildingState>
  cookQueue: CookJob[]
  // progress counters
  counters: {
    treeChop: number
    rockMine: number
    oreMine: number
    harvest: number
    animalCollect: number
    bushClear: number
    sleeps: number
    plotsBought: number
    totalSalesGold: number
    staminaEmptyCount: number
  }
  itemTotals: Record<string, number> // total ever gained per item
  craftTotals: Record<string, number>
  seenItems: Record<string, boolean>
  recipesDiscovered: string[]
  quests: Record<string, { done: boolean; claimed: boolean }>
  unlockedZones: string[]
  mineCurrentFloor: number
  mineDeepestFloor: number
  mineMinedNodes: Record<string, number[]>
  // timekeeping
  gameTime: number // accumulated game seconds
  lastSaved: number // wallclock ms
  // audio settings
  audio: { master: number; bgm: number; sfx: number; muted: boolean }
}
