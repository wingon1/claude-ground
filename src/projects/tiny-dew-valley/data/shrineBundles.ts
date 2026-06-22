// The Shrine Restoration Bundle. Data-driven so future bundles slot in.
export interface ShrineRequirement {
  key: 'gold' | 'pumpkins' | 'logs'
  label: string
  needed: number
  /** For item-based requirements, the inventory item id consumed. */
  itemId?: string
  icon: string
}

export const SHRINE_REQUIREMENTS: ShrineRequirement[] = [
  { key: 'gold', label: 'Gold Offering', needed: 1000, icon: '💰' },
  {
    key: 'pumpkins',
    label: 'Perfect Golden Pumpkins',
    needed: 5,
    itemId: 'crop_golden_pumpkin_perfect',
    icon: '🎃',
  },
  {
    key: 'logs',
    label: 'Hardwood Logs',
    needed: 20,
    itemId: 'hardwood',
    icon: '🪵',
  },
]

export const SHRINE_DEADLINE_DAY = 28
