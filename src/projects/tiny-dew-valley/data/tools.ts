import type { ToolDef, ToolId } from '../types'

export const TOOLS: Record<ToolId, ToolDef> = {
  hoe: {
    id: 'hoe',
    name: 'Hoe',
    hotbarSlot: 0,
    staminaCost: 3,
    description: 'Tills grass into soil ready for planting.',
  },
  watering_can: {
    id: 'watering_can',
    name: 'Watering Can',
    hotbarSlot: 1,
    staminaCost: 3,
    description: 'Waters tilled soil. Refill at the pond.',
  },
  axe: {
    id: 'axe',
    name: 'Axe',
    hotbarSlot: 2,
    staminaCost: 3,
    description: 'Chops trees and stumps for wood & hardwood.',
  },
  scythe: {
    id: 'scythe',
    name: 'Scythe',
    hotbarSlot: 3,
    staminaCost: 0,
    description: 'Clears wild weeds instantly. Costs no stamina.',
  },
  hand: {
    id: 'hand',
    name: 'Hand',
    hotbarSlot: 4,
    staminaCost: 0,
    description: 'Harvest crops, pick forage, and interact.',
  },
}

export const TOOL_ORDER: ToolId[] = ['hoe', 'watering_can', 'axe', 'scythe', 'hand']

export const WATER_CAPACITY = { basic: 10, copper: 25 }
