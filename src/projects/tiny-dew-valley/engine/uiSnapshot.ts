import type { PassiveId, PassiveRarity } from '../data/passives'
import type { UpgradeableToolId } from '../data/toolUpgrades'

export type UIPhase = 'title' | 'intro' | 'playing' | 'shop' | 'build' | 'blacksmith' | 'blacksmithBuy' | 'cook' | 'seed' | 'order' | 'sleepConfirm' | 'mineExitConfirm'
export type IntroScene = 'newspaper' | 'arrival' | null

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
  useText: string
  level: number
  tone: ToolTone
  damage: number
  currentDamage: number
  nextName: string | null
  nextDamage: number | null
  costGold: number
  costItems: CostItemView[]
  canUpgrade: boolean
  maxed: boolean
  sprite: string
}

export interface EquippedToolView {
  toolId: UpgradeableToolId
  name: string
  useText: string
  level: number
  tone: ToolTone
  damage: number
  sprite: string
}

export type ToolTone = 'base' | 'copper' | 'silver'

export interface PassiveView {
  id: PassiveId
  rarity: PassiveRarity
  key: string
  name: string
  rarityLabel: string
  effectText: string
  desc: string
  qty: number
  equipped: boolean
}

export interface PassiveSlotView {
  index: number
  unlocked: boolean
  passive: PassiveView | null
}

export interface CropChoiceView {
  id: string
  name: string
  color: string
  sprite: string
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
  selectedCropColor: string
  selectedCropSprite: string
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
  slot: number
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

export interface WeatherView {
  id: string
  name: string
  icon: string
  desc: string
}

export interface ContextActionView {
  id: 'sleep' | 'animal' | 'seed' | 'shop' | 'cook' | 'order' | 'blacksmith' | 'blacksmithBuy' | 'mineEnter' | 'mineExit' | 'mineDown'
  label: string
}

export interface UISnapshot {
  phase: UIPhase
  introScene: IntroScene
  day: number
  clock: string
  period: string
  periodKey: 'morning' | 'afternoon' | 'golden' | 'night'
  gold: number
  hp: number
  maxHp: number
  stamina: number
  maxStamina: number
  inventory: InvSlotView[]
  toasts: ToastMsg[]
  shopBuy: ShopBuyView[]
  blacksmithBuy: ShopBuyView[]
  buildOptions: BuildOptionView[]
  buildPermits: BuildPermitView[]
  equippedTools: EquippedToolView[]
  toolUpgrades: ToolUpgradeView[]
  passives: PassiveView[]
  passiveSlots: PassiveSlotView[]
  passiveSlotCount: number
  fieldPlots: FieldPlotView[]
  cropChoices: CropChoiceView[]
  selectedFieldId: string | null
  cookRecipes: CookRecipeView[]
  cookQueue: CookJobView[]
  cookingFire: CookingFireView
  objective: ObjectiveView | null
  objectives: ObjectiveTaskView[]
  order: OrderView | null
  orders: OrderView[]
  weather: WeatherView | null
  contextAction: string | null
  contextActionId: ContextActionView['id'] | null
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
