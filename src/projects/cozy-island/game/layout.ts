// Computes the fenced-pen world layout from worldLayout.json so every pen is
// identical in size and the geometry (rects, gates, paths) is derived, not hand-placed.
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
  gate: Rect // opening in the bottom fence onto the path below
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

export function buildLayout(): Layout {
  const water = World.water
  const path = World.pathWidth
  const fence = World.fence
  const gateW = World.gate
  const penW = World.penSize.w
  const penH = World.penSize.h
  const cols = World.cols
  const pensRaw = World.pens
  const rows = Math.ceil(pensRaw.length / cols)

  const worldW = 2 * water + path + cols * (penW + path)
  const worldH = 2 * water + path + rows * (penH + path)
  const land: Rect = { x: water, y: water, w: worldW - 2 * water, h: worldH - 2 * water }

  const pens: Pen[] = pensRaw.map((p, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const rect: Rect = {
      x: water + path + col * (penW + path),
      y: water + path + row * (penH + path),
      w: penW, h: penH,
    }
    const interior: Rect = { x: rect.x + fence, y: rect.y + fence, w: rect.w - 2 * fence, h: rect.h - 2 * fence }
    const gate: Rect = { x: rect.x + rect.w / 2 - gateW / 2, y: rect.y + rect.h - fence - 3, w: gateW, h: fence + 6 }
    return { id: p.id, content: p.content, cropId: p.cropId, building: p.building, rect, interior, gate }
  })

  const center = (r: Rect): Vec => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

  const buildingPos: Record<string, Vec> = {}
  const cropAnchors: Record<string, Vec[]> = {}
  const resourceSpots: { type: string; x: number; y: number }[] = []

  for (const pen of pens) {
    const c = center(pen.rect)
    if (pen.content === 'home') {
      buildingPos['tent'] = { x: c.x - 48, y: c.y - 18 }
      buildingPos['shop_stall'] = { x: c.x + 48, y: c.y - 18 }
      buildingPos['cooking_fire'] = { x: c.x - 48, y: c.y + 40 }
      buildingPos['storage'] = { x: c.x + 48, y: c.y + 40 }
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
      const trees = ['tree_small', 'tree_big', 'tree_small', 'tree_big', 'tree_small', 'tree_big']
      for (let k = 0; k < 6; k++) {
        const col = k % 3, row = Math.floor(k / 3)
        resourceSpots.push({ type: trees[k], x: pen.interior.x + 34 + col * 56, y: pen.interior.y + 56 + row * 64 })
      }
      resourceSpots.push({ type: 'bush', x: pen.interior.x + 40, y: pen.interior.y + 138 })
      resourceSpots.push({ type: 'bush', x: pen.interior.x + 150, y: pen.interior.y + 138 })
    }
    if (pen.content === 'quarry') {
      const rocks = ['rock_small', 'rock_big', 'rock_small', 'rock_big', 'rock_small']
      const spots = [[0, 0], [1, 0], [2, 0], [0.5, 1], [1.5, 1]]
      for (let k = 0; k < 5; k++) {
        resourceSpots.push({ type: rocks[k], x: pen.interior.x + 36 + spots[k][0] * 56, y: pen.interior.y + 66 + spots[k][1] * 62 })
      }
    }
  }

  const mineAnchors: Vec[] = World.mineNodeAnchors.map((m) => ({ x: m.x * worldW, y: m.y * worldH }))

  return { worldW, worldH, land, water, fence, penW, penH, pens, buildingPos, cropAnchors, resourceSpots, mineAnchors }
}

/** Walkable: inside land AND (in a pen interior, in a gate, or on a path = not in any pen footprint). */
export function layoutWalkable(L: Layout, x: number, y: number): boolean {
  if (x < L.land.x + 4 || x > L.land.x + L.land.w - 4 || y < L.land.y + 4 || y > L.land.y + L.land.h - 4) return false
  for (const pen of L.pens) {
    if (rectInside(x, y, pen.interior)) return true
    if (rectInside(x, y, pen.gate)) return true
  }
  // path = land but not inside any pen footprint (fence band included as blocked)
  for (const pen of L.pens) {
    if (rectInside(x, y, pen.rect)) return false
  }
  return true
}

export function penAt(L: Layout, x: number, y: number): Pen | null {
  for (const pen of L.pens) if (rectInside(x, y, pen.rect)) return pen
  return null
}
