// Coarse-grid A* so the player reliably routes along stone paths and through
// gates (no stuck-against-a-fence spots). Grid is sampled from a walkable() test.
import type { Vec } from '../types'

export type Grid = {
  cell: number
  cols: number
  rows: number
  ox: number
  oy: number
  walk: Uint8Array
}

export function buildGrid(worldW: number, worldH: number, cell: number, walkable: (x: number, y: number) => boolean): Grid {
  const cols = Math.ceil(worldW / cell)
  const rows = Math.ceil(worldH / cell)
  const walk = new Uint8Array(cols * rows)
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const x = gx * cell + cell / 2
      const y = gy * cell + cell / 2
      walk[gy * cols + gx] = walkable(x, y) ? 1 : 0
    }
  }
  return { cell, cols, rows, ox: 0, oy: 0, walk }
}

function idx(g: Grid, gx: number, gy: number) { return gy * g.cols + gx }
function inBounds(g: Grid, gx: number, gy: number) { return gx >= 0 && gy >= 0 && gx < g.cols && gy < g.rows }

function nearestWalkable(g: Grid, gx: number, gy: number): [number, number] | null {
  if (inBounds(g, gx, gy) && g.walk[idx(g, gx, gy)]) return [gx, gy]
  for (let r = 1; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const nx = gx + dx, ny = gy + dy
        if (inBounds(g, nx, ny) && g.walk[idx(g, nx, ny)]) return [nx, ny]
      }
    }
  }
  return null
}

/** Returns a list of world-space waypoints from start to goal, or null if unreachable. */
export function findPath(g: Grid, start: Vec, goal: Vec): Vec[] | null {
  const s = nearestWalkable(g, Math.floor(start.x / g.cell), Math.floor(start.y / g.cell))
  const t = nearestWalkable(g, Math.floor(goal.x / g.cell), Math.floor(goal.y / g.cell))
  if (!s || !t) return null
  const [sx, sy] = s, [tx, ty] = t
  const startI = idx(g, sx, sy), goalI = idx(g, tx, ty)
  if (startI === goalI) return [goal]

  const n = g.cols * g.rows
  const came = new Int32Array(n).fill(-1)
  const gScore = new Float32Array(n).fill(Infinity)
  const fScore = new Float32Array(n).fill(Infinity)
  const open: number[] = [startI]
  gScore[startI] = 0
  fScore[startI] = Math.hypot(tx - sx, ty - sy)
  const inOpen = new Uint8Array(n)
  inOpen[startI] = 1

  const neighbours = [
    [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
  ]

  while (open.length) {
    // pick lowest fScore
    let bi = 0
    for (let k = 1; k < open.length; k++) if (fScore[open[k]] < fScore[open[bi]]) bi = k
    const cur = open[bi]
    if (cur === goalI) break
    open.splice(bi, 1)
    inOpen[cur] = 0
    const cx = cur % g.cols, cy = Math.floor(cur / g.cols)
    for (const [dx, dy] of neighbours) {
      const nx = cx + dx, ny = cy + dy
      if (!inBounds(g, nx, ny)) continue
      const ni = idx(g, nx, ny)
      if (!g.walk[ni]) continue
      if (dx !== 0 && dy !== 0) {
        // no corner cutting through fences
        if (!g.walk[idx(g, cx + dx, cy)] || !g.walk[idx(g, cx, cy + dy)]) continue
      }
      const step = dx !== 0 && dy !== 0 ? 1.4142 : 1
      const tentative = gScore[cur] + step
      if (tentative < gScore[ni]) {
        came[ni] = cur
        gScore[ni] = tentative
        fScore[ni] = tentative + Math.hypot(tx - nx, ty - ny)
        if (!inOpen[ni]) { open.push(ni); inOpen[ni] = 1 }
      }
    }
  }

  if (came[goalI] === -1 && startI !== goalI) return null
  // reconstruct
  const cells: number[] = []
  let c = goalI
  while (c !== -1) { cells.push(c); if (c === startI) break; c = came[c] }
  cells.reverse()
  const pts: Vec[] = cells.map((ci) => ({
    x: (ci % g.cols) * g.cell + g.cell / 2,
    y: Math.floor(ci / g.cols) * g.cell + g.cell / 2,
  }))
  pts.push(goal) // exact final point
  return simplify(pts)
}

// Drop collinear midpoints for smoother motion.
function simplify(pts: Vec[]): Vec[] {
  if (pts.length <= 2) return pts
  const out: Vec[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const a = out[out.length - 1], b = pts[i], c = pts[i + 1]
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    if (Math.abs(cross) > 0.001) out.push(b)
  }
  out.push(pts[pts.length - 1])
  return out
}
