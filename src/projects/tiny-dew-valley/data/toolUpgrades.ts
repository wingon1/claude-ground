import type { CostItem, ToolId } from '../types'

export type UpgradeableToolId = Extract<ToolId, 'pickaxe' | 'scythe'> | 'sword'

export interface ToolBaseDef {
  name: string
  damage: number
}

export interface ToolUpgradeDef {
  level: number
  name: string
  damage: number
  costGold: number
  costItems: CostItem[]
}

export const UPGRADEABLE_TOOLS: UpgradeableToolId[] = ['pickaxe', 'scythe', 'sword']

export const TOOL_BASE: Record<UpgradeableToolId, ToolBaseDef> = {
  pickaxe: { name: '낡은 곡괭이', damage: 1 },
  scythe: { name: '낡은 낫', damage: 1 },
  sword: { name: '낡은 검', damage: 1 },
}

export const TOOL_UPGRADES: Record<UpgradeableToolId, ToolUpgradeDef[]> = {
  pickaxe: [
    { level: 1, name: '구리 곡괭이', damage: 2, costGold: 300, costItems: [{ itemId: 'stone', qty: 20 }, { itemId: 'copper_ore', qty: 8 }] },
    { level: 2, name: '철 곡괭이', damage: 3, costGold: 900, costItems: [{ itemId: 'stone', qty: 50 }, { itemId: 'copper_ore', qty: 18 }, { itemId: 'iron_ore', qty: 10 }] },
  ],
  scythe: [
    { level: 1, name: '구리 낫', damage: 2, costGold: 260, costItems: [{ itemId: 'stone', qty: 14 }, { itemId: 'copper_ore', qty: 6 }] },
    { level: 2, name: '철 낫', damage: 3, costGold: 760, costItems: [{ itemId: 'stone', qty: 35 }, { itemId: 'copper_ore', qty: 12 }, { itemId: 'iron_ore', qty: 8 }] },
  ],
  sword: [
    { level: 1, name: '구리 검', damage: 2, costGold: 500, costItems: [{ itemId: 'stone', qty: 20 }, { itemId: 'copper_ore', qty: 12 }] },
    { level: 2, name: '철 검', damage: 3, costGold: 1200, costItems: [{ itemId: 'stone', qty: 40 }, { itemId: 'copper_ore', qty: 15 }, { itemId: 'iron_ore', qty: 18 }] },
  ],
}
