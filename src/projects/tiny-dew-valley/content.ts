// Typed access to all JSON data. Logic reads balance from here — never hardcoded.
import playerJson from './data/player.json'
import staminaJson from './data/stamina.json'
import itemsJson from './data/items.json'
import resourcesJson from './data/resources.json'
import interactionJson from './data/interactionRules.json'
import cropsJson from './data/crops.json'
import farmPlotsJson from './data/farmPlots.json'
import animalsJson from './data/animals.json'
import buildingsJson from './data/buildings.json'
import recipesJson from './data/recipes.json'
import shopsJson from './data/shops.json'
import questsJson from './data/quests.json'
import mineJson from './data/mineLevels.json'
import dungeonJson from './data/dungeonLevels.json'
import zonesJson from './data/mapZones.json'
import economyJson from './data/economy.json'
import passivesJson from './data/passives.json'
import soundJson from './data/sound.json'
import worldJson from './data/worldLayout.json'

import type {
  AnimalDef, BuildingDef, CropDef, ItemDef, MineLevelDef, QuestDef, RecipeDef, ResourceNodeDef, Vec,
} from './types'

export const Player = playerJson as {
  startGold: number; startGems: number; startMaxStamina: number; startCurrentStamina: number
  moveSpeed: number; interactionRange: number; inventorySlotCount: number; stackLimit: number
}

export const Stamina = staminaJson as {
  startMax: number; startCurrent: number; hardCap: number; defaultActionCost: number
  canSleepOnlyWhenStaminaIsZero: boolean
  actions: Record<string, number>
  sleep: { enabled: boolean; buildingId: string; durationSeconds: number; recoverType: string; increaseMaxOnWakeUp: boolean; increaseAmount: number }
}

export const Items = (itemsJson as { items: ItemDef[] }).items
export const ItemMap: Record<string, ItemDef> = Object.fromEntries(Items.map((i) => [i.id, i]))

export const ResourceNodes = (resourcesJson as { nodes: Record<string, ResourceNodeDef> }).nodes
export const Interactions = interactionJson as Record<string, {
  type: string; staminaCost?: number; durationMs?: number; autoTrigger: boolean; range: number
  requiresStamina?: boolean; canUseOnlyWhenCurrentStaminaIsZero?: boolean
}>

export const Crops = (cropsJson as { crops: CropDef[] }).crops
export const CropMap: Record<string, CropDef> = Object.fromEntries(Crops.map((c) => [c.id, c]))

export const FarmPlots = farmPlotsJson as {
  basePurchaseCost: number; costGrowthMultiplier: number; maxPlots: number
  freeStartingPlots: number; defaultCropId: string; autoReplant: boolean
}

export const Animals = (animalsJson as { animals: AnimalDef[] }).animals
export const AnimalMap: Record<string, AnimalDef> = Object.fromEntries(Animals.map((a) => [a.id, a]))

export const Buildings = (buildingsJson as { buildings: BuildingDef[] }).buildings
export const BuildingMap: Record<string, BuildingDef> = Object.fromEntries(Buildings.map((b) => [b.id, b]))

export const Recipes = (recipesJson as { recipes: RecipeDef[] }).recipes
export const RecipeMap: Record<string, RecipeDef> = Object.fromEntries(Recipes.map((r) => [r.id, r]))

export const Shops = shopsJson as {
  sellMultiplier: number; sellableCategories: string[]
  buyListings: { id: string; kind: string; name: string; emoji: string; desc: string; animalId?: string; cropId?: string; cost?: number }[]
}

export const Quests = (questsJson as { quests: QuestDef[] }).quests

export const MineLevels = mineJson as {
  floors: MineLevelDef[]
}
export const DungeonLevels = dungeonJson as { enabled: boolean; comingSoon: boolean; stages: unknown[] }
export const Zones = (zonesJson as { zones: { id: string; name: string; defaultUnlocked?: boolean; unlockCondition?: unknown }[] }).zones
export const Economy = economyJson as { startGold: number; startGems: number; sellMultiplier: number; gemSellValue: number; autosaveSeconds: number }
export const Passives = (passivesJson as unknown as { passives: { id: string; name: string; effect: Record<string, number>; owned: boolean }[] }).passives

export type SfxDef = Record<string, unknown>
export const Sound = soundJson as {
  defaults: { master: number; bgm: number; sfx: number; muted: boolean }
  bgm: Record<string, { tempo: number; scale: string; root: number; mood: string; pattern: number[]; padFreq: number; filter: number }>
  sfx: Record<string, SfxDef>
}

export type PenDef = { id: string; content: string; cropId?: string; building?: string }

export const World = worldJson as {
  world: { tile: number }
  water: number
  penSize: { w: number; h: number }
  gap: number
  fence: number
  gate: number
  pens: PenDef[]
  mineNodeAnchors: Vec[]
}
