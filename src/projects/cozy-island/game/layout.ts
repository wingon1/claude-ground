// Computes the world layout from worldLayout.json.
// Pens spiral CLOCKWISE around the central home, starting directly BELOW it.
// The home has no fence; every other pen is fully fenced with one gate that
// faces the home. Trees/rocks/bushes are scattered on the open land OUTSIDE
// the pens (never inside a fence). There is no stone path — the ground is grass.
import { World } from '../content'
import type { Vec } from '../types'

export type Rect = { x: number; y: number; w: number; h: number }
export type Pen = {
  id: string
  content: string
  cropId?: string
  building?: string
  rect: Rect
  interior: Rect
  gates: Rect[] // openings in all four fence edges
}
export type Layout = {
  worldW: number
  worldH: number
  land: Rect
  water: number
  fence: number
  penW: number
  penH: number
  pens: Pen[]
  buildingPos: Record<string, Vec>
  cropAnchors: Record<string, Vec[]>
  resourceSpots: { type: string; x: number; y: number }[]
  mineAnchors: Vec[]
}

function rectInside(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
}

/** Cells for n pens: index 0 = home (0,0); the rest spiral CLOCKWISE from below. */
function spiralCells(n: number): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [{ col: 0, row: 0 }]
  const push = (col: number, row: number) => { if (cells.length < n) cells.push({ col, row }) }
  let ring = 1
  while (cells.length < n) {
    // start directly below the home, then sweep clockwise (down → left → up → right)
    for (let col = 0; col >= -ring; col--) push(col, ring)
    for (let row = ring - 1; row >= -ring; row--) push(-ring, row)
    for (let col = -ring + 1; col <= ring; col++) push(col, -ring)
    for (let row = -ring + 1; row <= ring; row++) push(ring, row)
    for (let col = ring - 1; col >= 1; col--) push(col, ring)
    ring++
  }
  return cells.slice(0, n)
}

export function buildLayout(): Layout {
  const water = World.water
  const gap = World.gap
  const fence = World.fence
  const gateW = World.gate
  const penW = World.penSize.w
  const penH = World.penSize.h
  const pensRaw = World.pens

  const cells = spiralCells(pensRaw.length)
  let minCol = 0, maxCol = 0, minRow = 0, maxRow = 0
  for (const c of cells) {
    minCol = Math.min(minCol, c.col); maxCol = Math.max(maxCol, c.col)
    minRow = Math.min(minRow, c.row); maxRow = Math.max(maxRow, c.row)
  }
  const usedCols = maxCol - minCol + 1
  const usedRows = maxRow - minRow + 1
  const landW = usedCols * penW + (usedCols + 1) * gap
  const landH = usedRows * penH + (usedRows + 1) * gap
  const worldW = landW + 2 * water
  const worldH = landH + 2 * water
  const land: Rect = { x: water, y: water, w: landW, h: landH }

  const pens: Pen[] = pensRaw.map((p, i) => {
    const cell = cells[i]
    const rect: Rect = {
      x: water + gap + (cell.col - minCol) * (penW + gap),
      y: water + gap + (cell.row - minRow) * (penH + gap),
      w: penW, h: penH,
    }
    const interior: Rect = { x: rect.x + fence, y: rect.y + fence, w: rect.w - 2 * fence, h: rect.h - 2 * fence }
    // A gate on every edge (top/bottom/left/right). Each opening is centred and
    // overlaps both sides of the fence band so the pathfinding grid reads it as
    // continuously walkable (no jamming against the fence).
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2
    const gd = fence + 12
    const gates: Rect[] = [
      { x: cx - gateW / 2, y: rect.y - 6, w: gateW, h: gd },
      { x: cx - gateW / 2, y: rect.y + rect.h - fence - 6, w: gateW, h: gd },
      { x: rect.x - 6, y: cy - gateW / 2, w: gd, h: gateW },
      { x: rect.x + rect.w - fence - 6, y: cy - gateW / 2, w: gd, h: gateW },
    ]
    return { id: p.id, content: p.content, cropId: p.cropId, building: p.building, rect, interior, gates }
  })

  const center = (r: Rect): Vec => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

  const buildingPos: Record<string, Vec> = {}
  const cropAnchors: Record<string, Vec[]> = {}
  // All nature lives in the fenceless grove above the tent — everywhere else is clean grass.
  const resourceSpots: { type: string; x: number; y: number }[] = []

  for (const pen of pens) {
    const c = center(pen.rect)
    if (pen.content === 'home') {
      // tent centered; shop on the left, cooking fire on the right; storage in front
      buildingPos['tent'] = { x: c.x, y: c.y - 8 }
      buildingPos['shop_stall'] = { x: c.x - 64, y: c.y - 2 }
      buildingPos['cooking_fire'] = { x: c.x + 64, y: c.y - 2 }
      buildingPos['storage'] = { x: c.x, y: c.y + 56 }
    } else if (pen.building) {
      buildingPos[pen.building] = { x: c.x, y: c.y - 24 }
    }
    if (pen.content === 'field' && pen.cropId) {
      const a: Vec[] = []
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          a.push({ x: pen.interior.x + 32 + col * 55, y: pen.interior.y + 58 + row * 60 })
        }
      }
      cropAnchors[pen.cropId] = a
    }
    if (pen.content === 'forest') {
      const ix = pen.interior.x, iy = pen.interior.y, iw = pen.interior.w
      // tidy grove: two rows of trees, a couple rocks and bushes for stone/fiber
      const trees = ['tree_big', 'tree_small', 'tree_big', 'tree_small', 'tree_big', 'tree_small']
      for (let k = 0; k < 6; k++) {
        const col = k % 3, row = Math.floor(k / 3)
        resourceSpots.push({ type: trees[k], x: ix + 34 + col * (iw - 68) / 2, y: iy + 40 + row * 52 })
      }
      resourceSpots.push({ type: 'rock_big', x: ix + 34, y: iy + pen.interior.h - 16 })
      resourceSpots.push({ type: 'rock_small', x: ix + 78, y: iy + pen.interior.h - 14 })
      resourceSpots.push({ type: 'bush', x: ix + iw - 30, y: iy + pen.interior.h - 16 })
      resourceSpots.push({ type: 'bush', x: ix + iw - 70, y: iy + pen.interior.h - 12 })
    }
  }

  const mineAnchors: Vec[] = World.mineNodeAnchors.map((m) => ({ x: m.x * worldW, y: m.y * worldH }))

  return { worldW, worldH, land, water, fence, penW, penH, pens, buildingPos, cropAnchors, resourceSpots, mineAnchors }
}

/** Walkable: inside land AND (home pen, a pen interior, a gate, or open land). Fences and sea block. */
export function layoutWalkable(L: Layout, x: number, y: number): boolean {
  if (x < L.land.x + 4 || x > L.land.x + L.land.w - 4 || y < L.land.y + 4 || y > L.land.y + L.land.h - 4) return false
  for (const pen of L.pens) {
    if (pen.content === 'home' || pen.content === 'forest') { if (rectInside(x, y, pen.rect)) return true; continue }
    if (rectInside(x, y, pen.interior)) return true
    for (const g of pen.gates) if (rectInside(x, y, g)) return true
  }
  // fence band of a fenced pen blocks; the home, the grove and all open land are walkable
  for (const pen of L.pens) {
    if (pen.content === 'home' || pen.content === 'forest') continue
    if (rectInside(x, y, pen.rect)) return false
  }
  return true
}

export function penAt(L: Layout, x: number, y: number): Pen | null {
  for (const pen of L.pens) if (rectInside(x, y, pen.rect)) return pen
  return null
}
