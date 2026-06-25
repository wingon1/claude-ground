import type { GameState } from '../types'
import { ANIMAL_FARMS, ANIMAL_FARM_MAX_ANIMALS, type AnimalFarmDef } from '../data/animalFarms'
import { ANIMAL_UPGRADES, type AnimalUpgradeDef } from '../data/animalUpgrades'
import { BUILD_OPTIONS } from '../data/buildOptions'
import {
  COOKING_FIRE_BASE_SLOTS,
  COOKING_FIRE_MAX_LEVEL,
  COOKING_FIRE_UPGRADES,
} from '../data/cookingFire'
import { CROPS, CROP_LIST } from '../data/crops'
import { DEFAULT_FIELD_CROP, FIELD_PLOTS, FIELD_SIZE } from '../data/fields'
import { cropItemId, getItem } from '../data/items'
import {
  PASSIVES,
  PASSIVE_RARITIES,
  PASSIVE_RARITY_LABEL,
  PASSIVE_RARITY_WEIGHT,
  passiveDef,
  passiveValueText,
  type PassiveId,
  type PassiveRarity,
} from '../data/passives'
import { RECIPES } from '../data/recipes'
import { SHOP_CATALOG } from '../data/shopCatalog'
import {
  COOKING_FIRE_BUILD_COST,
} from '../data/gameBalance'
import { UPGRADEABLE_TOOLS, type ToolUpgradeDef, type UpgradeableToolId } from '../data/toolUpgrades'
import type { Period } from './gameTypes'
import type {
  BuildOptionView,
  BuildPermitView,
  ContextActionView,
  CookJobView,
  CookRecipeView,
  CookingFireView,
  CostItemView,
  CropChoiceView,
  EquippedToolView,
  FieldPlotView,
  InvSlotView,
  ObjectiveTaskView,
  ObjectiveView,
  OrderView,
  PassiveSlotView,
  PassiveView,
  ShopBuyView,
  ToastMsg,
  ToolTone,
  ToolUpgradeView,
  UIPhase,
  UISnapshot,
  WeatherView,
} from './uiSnapshot'

type RecipeDef = (typeof RECIPES)[number]
type CookingFireUpgradeDef = (typeof COOKING_FIRE_UPGRADES)[number]
function toolTone(level: number): ToolTone {
  if (level >= 2) return 'silver'
  if (level === 1) return 'copper'
  return 'base'
}

const TOOL_USE_TEXT: Record<UpgradeableToolId, string> = {
  axe: '나무와 그루터기를 벨 때 사용합니다.',
  pickaxe: '광산의 돌과 광석을 캘 때 사용합니다.',
  scythe: '다 자란 작물을 수확할 때 사용합니다.',
  sword: '광산 몬스터와 싸울 때 사용합니다.',
}

const TOOL_LABELS: Record<UpgradeableToolId, [string, string, string]> = {
  axe: ['낡은 도끼', '구리 도끼', '철 도끼'],
  pickaxe: ['낡은 곡괭이', '구리 곡괭이', '철 곡괭이'],
  scythe: ['낡은 낫', '구리 낫', '철 낫'],
  sword: ['낡은 검', '구리 검', '철 검'],
}

function equippedToolName(toolId: UpgradeableToolId, level: number): string {
  return TOOL_LABELS[toolId][Math.max(0, Math.min(2, level))] ?? `${TOOL_LABELS[toolId][0]} Lv.${level}`
}

export interface SnapshotHost {
  phase: UIPhase
  introScene: UISnapshot['introScene']
  area: 'farm' | 'mine'
  state: GameState | undefined
  toasts: ToastMsg[]
  audioMuted: boolean
  audioMusicOn: boolean
  hasSavedGame(): boolean
  clockString(): string
  periodLabel(): string
  period(): Period
  countItem(itemId: string): number
  flagEnabled(flag: string | undefined): boolean
  isAnimalPermitEntry(entry: { grantsFlag?: string }): boolean
  animalUpgradeLevel(upgrade: AnimalUpgradeDef): number
  animalUpgradePrice(upgrade: AnimalUpgradeDef): number
  animalBuyPrice(farm: AnimalFarmDef): number
  animalCount(farm: AnimalFarmDef): number
  animalDropSeconds(farm: AnimalFarmDef): number
  passiveSlotCount(): number
  parsePassiveKey(key: unknown): { id: PassiveId; rarity: PassiveRarity } | null
  passiveEquipKey(slot: number): string
  passiveKey(id: PassiveId, rarity: PassiveRarity): string
  passiveCount(id: PassiveId, rarity: PassiveRarity): number
  nextToolUpgrade(toolId: UpgradeableToolId): ToolUpgradeDef | null
  toolName(toolId: UpgradeableToolId): string
  toolLevel(toolId: UpgradeableToolId): number
  toolDamage(toolId: UpgradeableToolId): number
  nearBlacksmith(): boolean
  fieldExpansionLevel(): number
  selectedFieldId(): string | null
  nextUnlockFieldId(): string | null
  fieldRows(fieldId: string): number
  fieldCrop(fieldId: string): string | null
  fieldRowCostGold(): number
  fieldRowCostWood(): number
  cropUnlocked(cropId: string): boolean
  cookingFireBuilt(): boolean
  cookingFireLevel(): number
  cookingSlots(level?: number): number
  nextCookingFireUpgrade(): CookingFireUpgradeDef | null
  recipeMaxCookQty(recipe: RecipeDef): number
  recipeUnlocked(recipe: RecipeDef): boolean
  passiveEffect(id: PassiveId): number
  currentObjective(): ObjectiveView | null
  objectiveTasks(current: ObjectiveView | null): ObjectiveTaskView[]
  currentOrder(): OrderView | null
  currentOrders(): OrderView[]
  currentWeather(): WeatherView | null
  nearMineExit(): boolean
  nearMineDown(): boolean
  selectedAnimalFarm(): AnimalFarmDef | null
  nearBed(): boolean
  canSleep(): boolean
  nearStore(): boolean
  nearOrderNpc(): boolean
  nearMineEntrance(): boolean
  nearCooking(): boolean
  nearBuild(): boolean
}

function emptySnapshot(host: SnapshotHost): UISnapshot {
  return {
    phase: host.phase,
    introScene: host.introScene,
    day: 1,
    clock: '오전 6:00',
    period: '아침',
    periodKey: 'morning',
    gold: 0,
    hp: 0,
    maxHp: 0,
    stamina: 0,
    maxStamina: 0,
    inventory: [],
    toasts: [...host.toasts],
    shopBuy: [],
    blacksmithBuy: [],
    buildOptions: [],
    buildPermits: [],
    equippedTools: [],
    toolUpgrades: [],
    passives: [],
    passiveSlots: [],
    passiveSlotCount: 0,
    fieldPlots: [],
    cropChoices: [],
    selectedFieldId: null,
    cookRecipes: [],
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
    orders: [],
    weather: null,
    contextAction: null,
    contextActionId: null,
    contextActions: [],
    nearBed: false,
    nearStore: false,
    nearBuild: false,
    nearCooking: false,
    exhausted: false,
    muted: host.audioMuted,
    musicOn: host.audioMusicOn,
    hasSave: host.hasSavedGame(),
  }
}

export function buildUISnapshot(host: SnapshotHost): UISnapshot {
  const s = host.state
  if (!s) return emptySnapshot(host)

  const costViews = (items: { itemId: string; qty: number }[]): CostItemView[] =>
    items.map((it) => {
      const have = host.countItem(it.itemId)
      return {
        itemId: it.itemId,
        name: getItem(it.itemId)?.name ?? it.itemId,
        have,
        need: it.qty,
        ok: have >= it.qty,
      }
    })

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
    if (!host.flagEnabled(e.requiresFlag)) return false
    if (host.isAnimalPermitEntry(e)) return false
    if (e.grantsFlag && host.flagEnabled(e.grantsFlag)) return false
    if (e.animalUpgradeId) {
      const upgrade = ANIMAL_UPGRADES.find((u) => u.id === e.animalUpgradeId)
      if (!upgrade || host.animalUpgradeLevel(upgrade) >= upgrade.maxLevel) return false
    }
    return true
  }).map((e) => {
    const def = getItem(e.itemId)!
    const farm = e.animalFarmId ? ANIMAL_FARMS.find((f) => f.id === e.animalFarmId) : null
    const upgrade = e.animalUpgradeId ? ANIMAL_UPGRADES.find((u) => u.id === e.animalUpgradeId) : null
    const price = farm ? host.animalBuyPrice(farm) : upgrade ? host.animalUpgradePrice(upgrade) : (e.buyPrice ?? 0)
    const animalCount = farm ? host.animalCount(farm) : 0
    const ownedText = farm
      ? ` 보유 ${animalCount}/${ANIMAL_FARM_MAX_ANIMALS}마리 · ${host.animalDropSeconds(farm)}초마다 생산`
      : ''
    const upgradeText = upgrade
      ? ` ${upgrade.levelDesc} · Lv.${host.animalUpgradeLevel(upgrade)}/${upgrade.maxLevel}`
      : ''
    return {
      itemId: e.itemId,
      name: def.name,
      price,
      affordable: s.gold >= price && (!farm || animalCount < ANIMAL_FARM_MAX_ANIMALS),
      sprite: def.sprite,
      color: def.cropId ? CROPS[def.cropId].color : undefined,
      desc: `${def.description}${ownedText}${upgradeText}`,
      owned: !!upgrade && host.animalUpgradeLevel(upgrade) >= upgrade.maxLevel,
    }
  })

  const swordDef = getItem('sword')
  const swordPrice = 500
  const blacksmithBuy: ShopBuyView[] = swordDef ? [{
    itemId: 'sword',
    name: swordDef.name,
    price: swordPrice,
    affordable: s.gold >= swordPrice && host.countItem('sword') <= 0,
    sprite: swordDef.sprite,
    desc: swordDef.description,
    owned: host.countItem('sword') > 0,
  }] : []

  const equippedPassiveKeys = new Set<string>()
  for (let i = 0; i < host.passiveSlotCount(); i++) {
    const parsed = host.parsePassiveKey(s.flags[host.passiveEquipKey(i)])
    if (parsed) equippedPassiveKeys.add(host.passiveKey(parsed.id, parsed.rarity))
  }
  const makePassiveView = (id: PassiveId, rarity: PassiveRarity): PassiveView | null => {
    const def = passiveDef(id)
    if (!def) return null
    const key = host.passiveKey(id, rarity)
    return {
      id,
      rarity,
      key,
      name: def.name,
      rarityLabel: PASSIVE_RARITY_LABEL[rarity],
      effectText: passiveValueText(def, rarity),
      desc: def.description,
      qty: host.passiveCount(id, rarity),
      equipped: equippedPassiveKeys.has(key),
    }
  }
  const passives: PassiveView[] = PASSIVES.flatMap((passive) =>
    PASSIVE_RARITIES.map((rarity) => makePassiveView(passive.id, rarity)).filter((view): view is PassiveView =>
      !!view && view.qty > 0,
    ),
  ).sort((a, b) =>
    PASSIVE_RARITY_WEIGHT[b.rarity] - PASSIVE_RARITY_WEIGHT[a.rarity] || a.name.localeCompare(b.name),
  )
  const passiveSlotCount = host.passiveSlotCount()
  const passiveSlots: PassiveSlotView[] = Array.from({ length: 3 }, (_, index) => {
    const parsed = host.parsePassiveKey(s.flags[host.passiveEquipKey(index)])
    return {
      index,
      unlocked: index < passiveSlotCount,
      passive: parsed ? makePassiveView(parsed.id, parsed.rarity) : null,
    }
  })

  const buildPermits: BuildPermitView[] = SHOP_CATALOG.filter((e) =>
    host.isAnimalPermitEntry(e),
  ).map((e) => {
    const def = getItem(e.itemId)!
    const built = host.flagEnabled(e.grantsFlag)
    const locked = !host.flagEnabled(e.requiresFlag)
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

  const toolUpgrades: ToolUpgradeView[] = UPGRADEABLE_TOOLS.map((toolId) => {
    const next = host.nextToolUpgrade(toolId)
    const costItems = costViews(next?.costItems ?? [])
    const owned = toolId !== 'sword' || host.countItem('sword') > 0
    const level = host.toolLevel(toolId)
    const displayLevel = next?.level ?? level
    const currentDamage = host.toolDamage(toolId)
    return {
      toolId,
      name: next?.name ?? host.toolName(toolId),
      useText: TOOL_USE_TEXT[toolId],
      level: displayLevel,
      tone: toolTone(displayLevel),
      damage: next?.damage ?? currentDamage,
      currentDamage,
      nextName: next?.name ?? null,
      nextDamage: next?.damage ?? null,
      costGold: next?.costGold ?? 0,
      costItems,
      canUpgrade:
        host.phase === 'blacksmith' &&
        host.nearBlacksmith() &&
        owned &&
        !!next &&
        s.gold >= next.costGold &&
        costItems.every((it) => it.ok),
      maxed: !next,
      sprite: toolId,
    }
  })

  const equippedTools: EquippedToolView[] = UPGRADEABLE_TOOLS
    .filter((toolId) => toolId !== 'sword' || host.countItem('sword') > 0)
    .map((toolId) => {
      const level = host.toolLevel(toolId)
      return {
        toolId,
        name: equippedToolName(toolId, level),
        useText: TOOL_USE_TEXT[toolId],
        level,
        tone: toolTone(level),
        damage: host.toolDamage(toolId),
        sprite: toolId,
      }
    })

  const fieldLevel = host.fieldExpansionLevel()
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

  const selectedFieldId = host.selectedFieldId()
  const nextFieldId = host.nextUnlockFieldId()
  const rowCostGold = host.fieldRowCostGold()
  const rowCostItems = costViews([{ itemId: 'wood', qty: host.fieldRowCostWood() }])
  const fieldPlots: FieldPlotView[] = FIELD_PLOTS.map((plot) => {
    const rows = host.fieldRows(plot.id)
    const cropId = host.fieldCrop(plot.id) ?? DEFAULT_FIELD_CROP
    const crop = CROPS[cropId] ?? CROPS[DEFAULT_FIELD_CROP]
    const nextToUnlock = nextFieldId === plot.id
    const cropSprite = rows > 0 ? (getItem(cropItemId(crop.id, 'normal'))?.sprite ?? `crop_${crop.id}`) : 'ui_sprout'
    return {
      id: plot.id,
      name: plot.name,
      rows,
      selectedCropId: crop.id,
      selectedCropName: rows > 0 ? crop.name : '비어 있음',
      selectedCropColor: crop.color,
      selectedCropSprite: cropSprite,
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
  const selectedCropId = selectedFieldId ? (host.fieldCrop(selectedFieldId) ?? DEFAULT_FIELD_CROP) : DEFAULT_FIELD_CROP
  const cropChoices: CropChoiceView[] = CROP_LIST.map((crop) => ({
    id: crop.id,
    name: crop.name,
    color: crop.color,
    sprite: getItem(cropItemId(crop.id, 'normal'))?.sprite ?? `crop_${crop.id}`,
    selected: crop.id === selectedCropId,
    unlocked: host.cropUnlocked(crop.id),
    lockText: host.cropUnlocked(crop.id) ? null : '상점에서 해금',
  }))

  const cookingFireBuilt = host.cookingFireBuilt()
  const cookingFireLevel = host.cookingFireLevel()
  const cookingSlots = host.cookingSlots(cookingFireLevel)
  const nextCookingUpgrade = host.nextCookingFireUpgrade()
  const cookingUpgradeItems = costViews(cookingFireBuilt ? (nextCookingUpgrade?.costItems ?? []) : COOKING_FIRE_BUILD_COST)
  const cookingFire: CookingFireView = {
    built: cookingFireBuilt,
    level: cookingFireLevel,
    maxLevel: COOKING_FIRE_MAX_LEVEL,
    slots: cookingSlots,
    usedSlots: s.cookQueue.length,
    nextSlots: cookingFireBuilt
      ? (nextCookingUpgrade ? host.cookingSlots(nextCookingUpgrade.level) : null)
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
    const perItemSecs = Math.max(1, (recipe?.craftSeconds ?? job.remainingSecs) * (1 - host.passiveEffect('cook_speed')))
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

  const visibleRecipeDefs = RECIPES.filter((recipe) => host.recipeUnlocked(recipe))
  const cookRecipes: CookRecipeView[] = visibleRecipeDefs.map((recipe) => {
    const out = getItem(recipe.output.itemId)
    const inputs = costViews(recipe.inputs)
    const maxCookQty = host.recipeMaxCookQty(recipe)
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
      sellPrice: 0,
      mystery: true,
    })
  }

  const objective = host.currentObjective()
  let contextAction: string | null = null
  let contextActionId: UISnapshot['contextActionId'] = null
  const contextActions: ContextActionView[] = []
  if (host.phase === 'playing') {
    if (host.area === 'mine') {
      if (host.nearMineExit()) contextActions.push({ id: 'mineExit', label: '나가기' })
      if (host.nearMineDown()) contextActions.push({ id: 'mineDown', label: '아래층' })
    } else {
      const animalFarm = host.selectedAnimalFarm()
      if (host.nearBed() && host.canSleep()) {
        contextAction = '잠자기'
        contextActionId = 'sleep'
        contextActions.push({ id: 'sleep', label: '잠자기' })
      } else if (host.selectedFieldId()) {
        contextAction = '씨앗 변경'
        contextActionId = 'seed'
        contextActions.push({ id: 'seed', label: '씨앗 변경' })
      } else if (animalFarm) {
        contextAction = null
        contextActionId = null
      } else if (host.nearOrderNpc()) {
        contextActions.push({ id: 'order', label: '주문' })
        if (host.nearStore()) contextActions.push({ id: 'shop', label: '상점' })
      } else if (host.nearBlacksmith()) {
        contextActions.push({ id: 'blacksmithBuy', label: '구매' })
        contextActions.push({ id: 'blacksmith', label: '도구 업그레이드' })
      } else {
        if (host.nearMineEntrance()) contextActions.push({ id: 'mineEnter', label: '광산 들어가기' })
        if (host.nearStore()) contextActions.push({ id: 'shop', label: '상점' })
        if (host.nearCooking()) contextActions.push({ id: 'cook', label: '요리' })
      }
    }
    if (contextActions.length > 0 && contextActionId == null) {
      contextAction = contextActions[0].label
      contextActionId = contextActions[0].id
    }
  }

  return {
    phase: host.phase,
    introScene: host.introScene,
    day: s.day,
    clock: host.clockString(),
    period: host.periodLabel(),
    periodKey: host.period(),
    gold: s.gold,
    hp: Math.round(s.hp),
    maxHp: s.maxHp,
    stamina: Math.round(s.stamina),
    maxStamina: s.maxStamina,
    inventory,
    toasts: [...host.toasts],
    shopBuy,
    blacksmithBuy,
    buildOptions,
    buildPermits,
    equippedTools,
    toolUpgrades,
    passives,
    passiveSlots,
    passiveSlotCount,
    fieldPlots,
    cropChoices,
    selectedFieldId,
    cookRecipes,
    cookQueue,
    cookingFire,
    objective,
    objectives: host.objectiveTasks(objective),
    order: host.currentOrder(),
    orders: host.currentOrders(),
    weather: host.currentWeather(),
    contextAction,
    contextActionId,
    contextActions,
    nearBed: host.nearBed(),
    nearStore: host.nearStore(),
    nearBuild: host.nearBuild(),
    nearCooking: host.nearCooking(),
    exhausted: s.player.exhausted,
    muted: host.audioMuted,
    musicOn: host.audioMusicOn,
    hasSave: host.hasSavedGame(),
  }
}
