import type { CostItem, ToolId } from '../types'
import balance from './balance.json'

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
  pickaxe: { name: '낡은 곡괭이', damage: balance.tools.base.pickaxe.damage },
  scythe: { name: '낡은 낫', damage: balance.tools.base.scythe.damage },
  sword: { name: '낡은 검', damage: balance.tools.base.sword.damage },
}

const upgradeNames: Record<UpgradeableToolId, string[]> = {
  pickaxe: ['구리 곡괭이', '철 곡괭이'],
  scythe: ['구리 낫', '철 낫'],
  sword: ['구리 검', '철 검'],
}

export const TOOL_UPGRADES: Record<UpgradeableToolId, ToolUpgradeDef[]> = {
  pickaxe: balance.tools.upgrades.pickaxe.map((upgrade, index) => ({
    ...upgrade,
    name: upgradeNames.pickaxe[index] ?? `곡괭이 Lv.${upgrade.level}`,
  })),
  scythe: balance.tools.upgrades.scythe.map((upgrade, index) => ({
    ...upgrade,
    name: upgradeNames.scythe[index] ?? `낫 Lv.${upgrade.level}`,
  })),
  sword: balance.tools.upgrades.sword.map((upgrade, index) => ({
    ...upgrade,
    name: upgradeNames.sword[index] ?? `검 Lv.${upgrade.level}`,
  })),
}
