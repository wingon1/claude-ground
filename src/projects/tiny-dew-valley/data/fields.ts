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
  { id: 'field_1', name: '1번 밭', x: 31, y: 13, sign: { x: 32, y: 12 } },
  { id: 'field_2', name: '2번 밭', x: 27, y: 13, sign: { x: 28, y: 12 } },
  { id: 'field_3', name: '3번 밭', x: 23, y: 13, sign: { x: 24, y: 12 } },
  { id: 'field_4', name: '4번 밭', x: 31, y: 17, sign: { x: 32, y: 16 } },
  { id: 'field_5', name: '5번 밭', x: 27, y: 17, sign: { x: 28, y: 16 } },
  { id: 'field_6', name: '6번 밭', x: 23, y: 17, sign: { x: 24, y: 16 } },
]

export const DEFAULT_FIELD_CROP = 'parsnip'
export const FIELD_ROW_COST_GOLD = 45
export const FIELD_ROW_COST_WOOD = 6
