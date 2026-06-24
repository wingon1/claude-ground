// Central type definitions for Tiny Dew Valley.
// Kept data-driven: gameplay rules live in /data, this only describes shapes.

export type ItemType =
  | 'seed'
  | 'crop'
  | 'wood'
  | 'hardwood'
  | 'stone'
  | 'forage'
  | 'food'
  | 'offering'
  | 'material'
  | 'placeable'
  | 'misc'

export type CropQuality = 'normal' | 'silver' | 'gold' | 'perfect'

export interface ItemDef {
  id: string
  name: string
  type: ItemType
  stackable: boolean
  maxStack: number
  sellPrice: number
  description: string
  usable: boolean
  /** Stamina restored when eaten (food/crop). */
  staminaRestore?: number
  /** Gift affinity bucket lookups are per-NPC; this is a default. */
  giftValue: number
  /** For crop items, which crop + quality they came from. */
  cropId?: string
  quality?: CropQuality
  /** Emoji-ish glyph fallback / sprite key. */
  sprite: string
}

export interface InventorySlot {
  itemId: string
  qty: number
}

export interface CostItem {
  itemId: string
  qty: number
}

export interface BuildOptionDef {
  id: string
  name: string
  description: string
  costGold: number
  costItems: CostItem[]
  /** Build options are applied in order; this is the level after completion. */
  level: number
  rect: { x: number; y: number; w: number; h: number }
}

export interface RecipeDef {
  id: string
  name: string
  description: string
  inputs: CostItem[]
  output: { itemId: string; qty: number }
  craftSeconds: number
  difficulty: number
  unlockFlag?: string
}

export interface CookJob {
  id: string
  recipeId: string
  totalQty?: number
  remainingQty?: number
  remainingSecs: number
}

export type ToolId = 'hoe' | 'watering_can' | 'axe' | 'scythe' | 'hand'

export interface ToolDef {
  id: ToolId
  name: string
  hotbarSlot: number // 0-4 -> keys 1-5
  staminaCost: number
  description: string
}

export interface CropDef {
  id: string
  name: string
  seedItemId: string
  /** Days from planting to first harvest. */
  growDays: number
  /** Number of growth stages (visual). Last stage = harvestable. */
  stages: number
  baseSell: number
  /** If set, crop regrows after harvest; days between regrows. */
  regrowDays?: number
  /** Whether this crop rolls quality. */
  rollsQuality: boolean
  /** Season flavour / colour seed. */
  color: string
}

export type Terrain = 'grass' | 'soil' | 'tilled' | 'water' | 'path' | 'blocked'
export type Obstacle =
  | null
  | 'weed'
  | 'rock'
  | 'tree'
  | 'stump'
  | 'large_stump'
  | 'flower'

export interface Tile {
  x: number
  y: number
  terrain: Terrain
  cropId: string | null
  growthStage: number
  wateredToday: boolean
  wateredYesterday: boolean
  daysUnwatered: number
  obstacle: Obstacle
  hasFertilizer: boolean
  /** For large stumps: chops remaining before it yields hardwood. */
  hp?: number
  metadata: Record<string, number | string | boolean>
}

export type Direction = 'down' | 'up' | 'left' | 'right'

export interface PlayerState {
  x: number // world pixel position (center)
  y: number
  dir: Direction
  moving: boolean
  animTime: number
  exhausted: boolean
}

export type GiftTier = 'loved' | 'liked' | 'neutral' | 'disliked' | 'hated'

export interface NPCFriendship {
  points: number // 0..(hearts*GIFT...) we store raw points
  talkedToday: boolean
  giftedToday: boolean
  /** milestone hearts already celebrated (to fire dialogue once). */
  milestonesShown: number[]
}

export interface NPCState {
  id: string
  x: number
  y: number
  dir: Direction
  friendship: NPCFriendship
}

export interface ShrineState {
  gold: number
  offerings: number
  logs: number
  restored: boolean
}

export type ToolUpgrades = {
  watering_can: 'basic' | 'copper'
  backpack: 0 | 1 // inventory expansion levels (cosmetic cap already 24)
}

export type EndingState = 'none' | 'good' | 'bittersweet'

export interface GameState {
  saveVersion: number
  /** Nights slept. Cosmetic counter; sleeping is the only progression gate. */
  day: number
  /** Cosmetic day/night clock minutes; no gameplay deadline. */
  timeMinutes: number
  gold: number
  stamina: number
  maxStamina: number
  player: PlayerState
  tiles: Tile[] // flattened WORLD_W * WORLD_H farm/village grid
  inventory: InventorySlot[]
  cookQueue: CookJob[]
  flags: Record<string, boolean | number | string>
}

export interface DialogueLine {
  speaker: string
  text: string
}

export interface NPCDef {
  id: string
  name: string
  color: string
  accent: string
  heartsMax: number
  /** points needed per heart. */
  pointsPerHeart: number
  giftPrefs: {
    loved: string[]
    liked: string[]
    disliked: string[]
    hated: string[]
  }
  normalLines: string[]
  timeLines: { from: number; to: number; lines: string[] }[]
  milestoneLines: Record<number, string> // hearts -> line
  giftReactions: Record<GiftTier, string[]>
}

export interface ShopEntry {
  itemId: string
  /** Buy price; if omitted not buyable. */
  buyPrice?: number
  /** Additional item costs for non-inventory purchases such as construction. */
  costItems?: CostItem[]
  /** Buys one animal for an unlocked animal farm. Price may scale by count. */
  animalFarmId?: string
  /** Buys one level of a farm production upgrade. Price may scale by level. */
  animalUpgradeId?: string
  /** Whether the entry is a one-time tool upgrade. */
  upgrade?: 'copper_can' | 'backpack'
  /** Entry is visible only after this flag is set. */
  requiresFlag?: string
  /** Buying this entry permanently sets this flag instead of adding an item. */
  grantsFlag?: string
  unlockFlag?: string
}
