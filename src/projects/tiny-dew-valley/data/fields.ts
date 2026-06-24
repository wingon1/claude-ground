export interface FieldPlotDef {
  id: string
  name: string
  x: number
  y: number
  sign: { x: number; y: number }
}

export const FIELD_SIZE = 3

// Three plots per row, two rows. Unlock order is right-to-left, then the row below.
export const FIELD_PLOTS: FieldPlotDef[] = [
  { id: 'field_1', name: '밭 구역', x: 31, y: 16, sign: { x: 32, y: 15 } },
  { id: 'field_2', name: '밭 구역', x: 27, y: 16, sign: { x: 28, y: 15 } },
  { id: 'field_3', name: '밭 구역', x: 23, y: 16, sign: { x: 24, y: 15 } },
  { id: 'field_4', name: '밭 구역', x: 31, y: 20, sign: { x: 32, y: 19 } },
  { id: 'field_5', name: '밭 구역', x: 27, y: 20, sign: { x: 28, y: 19 } },
  { id: 'field_6', name: '밭 구역', x: 23, y: 20, sign: { x: 24, y: 19 } },
]

export const DEFAULT_FIELD_CROP = 'wheat'
export const FIELD_ROW_COST_GOLD = 45
export const FIELD_ROW_COST_WOOD = 6
