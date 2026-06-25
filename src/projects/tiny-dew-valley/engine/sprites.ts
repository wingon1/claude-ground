import type { CropQuality, Direction } from '../types'

// All sprites are procedurally baked into offscreen canvases at 1 art-px = 1
// canvas-px, then drawn integer-scaled with smoothing disabled.

export const T = 16 // tile pixel size (art space)

type Pal = {
  skin: string
  skinShade: string
  hair: string
  hairLite?: string
  top: string
  topShade: string
  bottom: string
  accent: string
  hat?: string
  hatShade?: string
  hood?: boolean
  // Cute / per-character detail knobs.
  style?: 'short' | 'spiky' | 'twin' | 'side' | 'bald'
  brow?: string
  eye?: string
  beard?: string // beard / stubble colour (older men)
  apron?: string // worker apron over the torso
  bow?: string // hair ribbon colour
  skirt?: string // render a skirt instead of trousers
  broad?: boolean // wider build (e.g. burly smith)
  freckles?: boolean
}

function cv(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function ctxOf(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const x = c.getContext('2d')!
  x.imageSmoothingEnabled = false
  return x
}

function px(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  g.fillStyle = color
  g.fillRect(x, y, w, h)
}

// Tiny seeded noise for texture dots.
function dot(g: CanvasRenderingContext2D, x: number, y: number, color: string) {
  g.fillStyle = color
  g.fillRect(x, y, 1, 1)
}

// ---------------- Humanoid (farmer + NPCs) ----------------
const HUMAN_W = 16
const HUMAN_H = 22

const OUTLINE = '#2e2630'

function drawHumanoid(
  g: CanvasRenderingContext2D,
  dir: Direction,
  frame: number, // 0 idle, 1/2 walk
  pal: Pal,
) {
  const legSwing = frame === 1 ? 1 : frame === 2 ? -1 : 0
  const hairLite = pal.hairLite ?? lighten(pal.hair)
  const eyeC = pal.eye ?? '#3a2c34'
  const style = pal.style ?? 'short'

  // Soft layered ground shadow.
  px(g, 4, 21, 8, 1, 'rgba(0,0,0,0.22)')
  px(g, 5, 20, 6, 1, 'rgba(0,0,0,0.12)')

  // ---- Lower body: skirt (cute) or trousers ----
  if (pal.skirt) {
    const lL = 2 + (legSwing > 0 ? 1 : 0)
    const rL = 2 + (legSwing < 0 ? 1 : 0)
    px(g, 5, 18, 2, lL, pal.skin) // bare legs
    px(g, 9, 18, 2, rL, pal.skin)
    px(g, 5, 18 + lL, 2, 1, '#8a4f33') // little shoes
    px(g, 9, 18 + rL, 2, 1, '#8a4f33')
    px(g, 4, 15, 8, 3, pal.skirt) // A-line skirt
    px(g, 3, 17, 10, 2, pal.skirt)
    px(g, 3, 18, 10, 1, darken(pal.skirt))
    px(g, 4, 15, 8, 1, lighten(pal.skirt))
  } else {
    const legY = 16
    const lL = 4 + (legSwing > 0 ? 0 : -1)
    const rL = 4 + (legSwing < 0 ? 0 : -1)
    px(g, 5, legY, 2, lL, pal.bottom)
    px(g, 9, legY, 2, rL, pal.bottom)
    px(g, 5, legY, 1, lL, 'rgba(255,255,255,0.12)')
    px(g, 9, legY, 1, rL, 'rgba(255,255,255,0.12)')
    px(g, 5, legY + lL, 2, 1, '#3a2a1a') // boots
    px(g, 9, legY + rL, 2, 1, '#3a2a1a')
  }

  // ---- Torso ----
  const tx = pal.broad ? 3 : 4
  const tw = pal.broad ? 10 : 8
  px(g, tx, 10, tw, 7, pal.top)
  px(g, tx, 14, tw, 3, pal.topShade)
  px(g, tx, 10, tw, 1, pal.accent) // collar
  px(g, tx + tw - 1, 11, 1, 6, 'rgba(0,0,0,0.18)') // right-side shade
  px(g, tx, 10, 1, 7, 'rgba(255,255,255,0.10)') // left-side light
  px(g, tx - 1, 16, tw + 2, 1, OUTLINE) // belt/hem outline

  // Apron over the torso (workers).
  if (pal.apron) {
    px(g, 6, 10, 4, 7, pal.apron)
    px(g, 5, 13, 6, 4, pal.apron)
    px(g, 6, 10, 4, 1, lighten(pal.apron))
    px(g, 7, 12, 2, 1, darken(pal.apron)) // pocket seam
  }

  // ---- Arms + hands ----
  const aL = tx - 1
  const aR = tx + tw - 1
  px(g, aL, 11, 2, 5, pal.top)
  px(g, aR, 11, 2, 5, pal.top)
  px(g, aR, 11, 1, 5, pal.topShade)
  px(g, aL, 15, 2, 1, pal.skin)
  px(g, aR, 15, 2, 1, pal.skin)

  // ---- Head (rounded, slightly chibi) ----
  px(g, 4, 4, 8, 7, pal.skin)
  g.clearRect(4, 4, 1, 1)
  g.clearRect(11, 4, 1, 1)
  px(g, 4, 10, 8, 1, pal.skinShade) // jaw shade
  px(g, 11, 5, 1, 5, pal.skinShade) // right cheek
  px(g, 4, 5, 1, 5, 'rgba(255,255,255,0.10)')
  if (dir === 'down') {
    px(g, 3, 7, 1, 2, pal.skin) // ears
    px(g, 12, 7, 1, 2, pal.skin)
    dot(g, 3, 8, pal.skinShade)
    dot(g, 12, 8, pal.skinShade)
  }

  // ---- Hair ----
  if (pal.hood) {
    px(g, 3, 2, 10, 7, pal.hair)
    px(g, 3, 2, 10, 1, hairLite)
    px(g, 4, 5, 8, 5, pal.skin) // face opening
    px(g, 4, 10, 8, 1, pal.skinShade)
    px(g, 11, 6, 1, 4, pal.skinShade)
  } else if (dir === 'up') {
    px(g, 3, 2, 10, 8, pal.hair) // full back of head
    px(g, 3, 2, 10, 1, hairLite)
    px(g, 3, 9, 1, 2, pal.hair)
    px(g, 12, 9, 1, 2, pal.hair)
    if (style === 'twin') {
      px(g, 1, 6, 2, 6, pal.hair)
      px(g, 13, 6, 2, 6, pal.hair)
      px(g, 1, 6, 2, 1, hairLite)
      px(g, 13, 6, 2, 1, hairLite)
    } else if (style === 'spiky') {
      px(g, 4, 1, 2, 1, pal.hair)
      px(g, 8, 1, 1, 1, pal.hair)
      px(g, 10, 1, 2, 1, pal.hair)
    }
  } else {
    // For a twin-tail profile, keep the nose (front) side of the face bare.
    const bareLeft = style === 'twin' && dir === 'left'
    const bareRight = style === 'twin' && dir === 'right'
    px(g, 3, 2, 10, 3, pal.hair) // crown
    px(g, 3, 2, 10, 1, hairLite)
    if (!bareLeft) px(g, 3, 4, 1, 5, pal.hair) // left sideburn
    if (!bareRight) px(g, 12, 4, 1, 5, pal.hair) // right sideburn
    // Side profile: bulk out the back of the head so the silhouette reads.
    if (dir === 'left') {
      px(g, 11, 3, 3, 7, pal.hair) // hair mass at the back (right)
      px(g, 13, 5, 1, 4, pal.hair)
      px(g, 11, 3, 3, 1, hairLite)
    } else if (dir === 'right') {
      px(g, 2, 3, 3, 7, pal.hair) // hair mass at the back (left)
      px(g, 2, 5, 1, 4, pal.hair)
      px(g, 2, 3, 3, 1, hairLite)
    }
    if (style === 'spiky') {
      px(g, 4, 4, 2, 2, pal.hair)
      px(g, 7, 4, 2, 2, pal.hair)
      px(g, 10, 4, 2, 2, pal.hair)
      px(g, 4, 1, 2, 1, pal.hair) // upward spikes
      px(g, 8, 1, 1, 1, pal.hair)
      px(g, 10, 1, 2, 1, pal.hair)
    } else if (style === 'twin') {
      px(g, 4, 4, 8, 2, pal.hair) // full bangs
      px(g, 5, 5, 6, 1, hairLite)
      // Long hair framing the face — fills the gap beside the cheeks.
      // Skipped on the nose side when viewed in profile.
      if (!bareLeft) {
        px(g, 3, 4, 1, 7, pal.hair) // left lock to jaw
        px(g, 2, 5, 1, 5, pal.hair) // fuller side
        px(g, 1, 6, 2, 6, pal.hair) // tail
        px(g, 1, 11, 2, 2, pal.hair)
        px(g, 1, 6, 2, 1, hairLite)
      }
      if (!bareRight) {
        px(g, 12, 4, 1, 7, pal.hair) // right lock to jaw
        px(g, 13, 5, 1, 5, pal.hair) // fuller side
        px(g, 13, 6, 2, 6, pal.hair) // tail
        px(g, 13, 11, 2, 2, pal.hair)
        px(g, 13, 6, 2, 1, hairLite)
      }
    } else if (style === 'bald') {
      px(g, 3, 3, 10, 1, pal.hair) // receded hairline
      px(g, 3, 4, 1, 4, pal.hair)
      px(g, 12, 4, 1, 4, pal.hair)
    } else if (style === 'side') {
      px(g, 4, 4, 7, 2, pal.hair) // side-swept bangs
      px(g, 4, 4, 5, 1, hairLite)
    } else {
      px(g, 4, 4, 8, 1, pal.hair) // short fringe
      px(g, 4, 4, 4, 1, hairLite)
    }
  }

  // Straw hat with brim shadow.
  if (pal.hat) {
    px(g, 2, 4, 12, 2, pal.hat)
    px(g, 4, 1, 8, 3, pal.hat)
    px(g, 4, 1, 8, 1, lighten(pal.hat))
    px(g, 2, 5, 12, 1, pal.hatShade ?? pal.hat)
    px(g, 4, 6, 8, 1, 'rgba(0,0,0,0.18)') // brim shadow on face
  }

  // Hair ribbon (girls) — rides the back tail when in profile.
  if (pal.bow) {
    if (dir === 'up') {
      px(g, 6, 2, 4, 2, pal.bow)
      dot(g, 7, 2, '#ffffff')
    } else if (dir === 'right') {
      px(g, 1, 4, 3, 2, pal.bow) // back tail is on the left
      px(g, 2, 3, 1, 1, lighten(pal.bow))
      dot(g, 2, 4, '#ffffff')
    } else {
      px(g, 12, 4, 3, 2, pal.bow)
      px(g, 13, 3, 1, 1, lighten(pal.bow))
      dot(g, 13, 4, '#ffffff')
    }
  }

  // ---- Face (slim vertical dot eyes) ----
  if (dir === 'down') {
    px(g, 6, 7, 1, 2, eyeC) // two tall 1px eyes
    px(g, 9, 7, 1, 2, eyeC)
    dot(g, 8, 8, pal.skinShade) // nose
    px(g, 7, 10, 2, 1, '#bd6a60') // mouth
    if (pal.freckles) {
      dot(g, 5, 9, '#d89a78')
      dot(g, 10, 9, '#d89a78')
    }
    dot(g, 4, 8, '#f0a6a6') // blush
    dot(g, 11, 8, '#f0a6a6')
  } else if (dir === 'left') {
    px(g, 6, 7, 1, 2, eyeC)
    px(g, 4, 8, 1, 1, pal.skinShade) // nose
    px(g, 5, 10, 2, 1, '#bd6a60')
    dot(g, 8, 9, '#f0a6a6') // cheek blush
  } else if (dir === 'right') {
    px(g, 9, 7, 1, 2, eyeC)
    px(g, 11, 8, 1, 1, pal.skinShade)
    px(g, 9, 10, 2, 1, '#bd6a60')
    dot(g, 7, 9, '#f0a6a6') // cheek blush
  }

  // ---- Beard / stubble (older men) ----
  if (pal.beard && dir !== 'up') {
    const bd = pal.beard
    if (dir === 'down') {
      px(g, 4, 9, 8, 2, bd) // jaw + chin
      px(g, 4, 9, 1, 2, darken(bd))
      px(g, 4, 8, 1, 2, bd) // sideburns
      px(g, 11, 8, 1, 2, bd)
      px(g, 6, 8, 4, 1, bd) // moustache
      px(g, 7, 9, 2, 1, '#7a3f38') // mouth within beard
      dot(g, 4, 5, hairLite) // greying temples
      dot(g, 11, 5, hairLite)
    } else if (dir === 'left') {
      px(g, 4, 8, 5, 3, bd)
      px(g, 5, 9, 3, 1, '#7a3f38')
    } else {
      px(g, 7, 8, 5, 3, bd)
      px(g, 8, 9, 3, 1, '#7a3f38')
    }
  }
}

function bakeHumanoidSheet(pal: Pal): Record<string, HTMLCanvasElement> {
  const dirs: Direction[] = ['down', 'up', 'left', 'right']
  const out: Record<string, HTMLCanvasElement> = {}
  for (const d of dirs) {
    for (let f = 0; f < 3; f++) {
      const c = cv(HUMAN_W, HUMAN_H)
      drawHumanoid(ctxOf(c), d, f, pal)
      out[`${d}_${f}`] = c
    }
  }
  return out
}

// ---------------- Tiles ----------------
function bakeGrass(variant: number): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  // base gradient
  px(g, 0, 0, T, T, '#7cc24e')
  px(g, 0, 0, T, T, '#7cc24e')
  for (let i = 0; i < T; i += 4) {
    for (let j = 0; j < T; j += 4) {
      dot(g, i + ((variant + j) % 3), j + ((i + variant) % 3), '#6fb544')
    }
  }
  // blades
  if (variant === 1) {
    px(g, 3, 9, 1, 2, '#5aa038')
    px(g, 10, 4, 1, 2, '#5aa038')
  }
  if (variant === 2) {
    dot(g, 6, 6, '#e8e36b')
    dot(g, 11, 11, '#e8e36b')
  }
  return c
}

function bakeSoil(wet: boolean): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  const base = wet ? '#553620' : '#7e5230'
  const ridge = wet ? '#6a472a' : '#956339' // sun-lit ridge crown
  const groove = wet ? '#34200f' : '#5c3b20' // shadowed furrow
  const speck = wet ? '#46301e' : '#6d472a'
  px(g, 0, 0, T, T, base)
  // Plowed rows: lit crown + shadow groove, full width so tiles blend seamlessly.
  for (let y = 0; y < T; y += 4) {
    px(g, 0, y, T, 1, ridge)
    px(g, 0, y + 3, T, 1, groove)
  }
  // Crumbly soil texture.
  const specks: [number, number][] = [
    [2, 1], [7, 2], [12, 1], [4, 5], [10, 6], [6, 9], [13, 10], [3, 13], [9, 13], [11, 14],
  ]
  for (const [sx, sy] of specks) px(g, sx, sy, 1, 1, speck)
  px(g, 5, 6, 1, 1, wet ? '#5f5040' : '#9a8a68') // small pebbles
  px(g, 11, 2, 1, 1, wet ? '#5f5040' : '#9a8a68')
  if (wet) {
    // Damp sheen catching light in the furrows.
    px(g, 3, 7, 2, 1, 'rgba(126,156,186,0.16)')
    px(g, 9, 15, 2, 1, 'rgba(126,156,186,0.16)')
    px(g, 7, 11, 1, 1, 'rgba(126,156,186,0.16)')
  }
  return c
}

function bakeWater(frame: number): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 0, 0, T, T, '#3f73c4')
  px(g, 0, 0, T, T / 2, '#4a82d6')
  const off = frame * 2
  for (let y = 2; y < T; y += 5) {
    px(g, (off + y) % T, y, 4, 1, '#7fb0ea')
    px(g, (off + 8 + y) % T, y + 2, 3, 1, '#2f5da3')
  }
  return c
}

function bakePath(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 0, 0, T, T, '#b79b6e')
  for (let i = 0; i < 18; i++) {
    dot(g, (i * 7) % T, (i * 11) % T, '#a4885d')
  }
  px(g, 0, 0, T, 1, '#c8ad80')
  return c
}

function bakeFence(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  // Two horizontal rails spanning the full tile so runs join seamlessly, plus
  // two capped posts. Reads correctly when rotated 90° for vertical runs.
  for (const ry of [5, 10]) {
    px(g, 0, ry, T, 2, '#9a6a3a') // rail
    px(g, 0, ry, T, 1, '#b3824a') // top highlight
    px(g, 0, ry + 2, T, 1, 'rgba(60,40,24,0.4)') // underside shadow
  }
  for (const pxn of [2, 11]) {
    px(g, pxn, 2, 3, 13, '#7a5230') // post
    px(g, pxn, 2, 1, 13, '#92663c') // lit edge
    px(g, pxn + 2, 2, 1, 13, 'rgba(50,34,20,0.5)') // shaded edge
    px(g, pxn - 1, 2, 5, 1, '#a07b48') // cap
    dot(g, pxn + 1, 7, '#6a4a2a') // grain
  }
  return c
}

// Small animal-pen fence — a single low rail with two end posts, sitting in
// the TOP half of the tile (canonical = top edge of the pen). The rail spans
// the full width so straight runs join seamlessly; rotated 90°/180°/270° for
// the other three sides.
function bakeFenceSmall(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  // Horizontal rail near the top, full width.
  px(g, 0, 4, T, 2, '#9a6a3a')
  px(g, 0, 4, T, 1, '#b3824a') // highlight
  px(g, 0, 6, T, 1, 'rgba(60,40,24,0.4)') // underside shadow
  // Two short posts at the ends.
  for (const pxn of [2, 11]) {
    px(g, pxn, 1, 3, 8, '#7a5230')
    px(g, pxn, 1, 1, 8, '#92663c') // lit edge
    px(g, pxn + 2, 1, 1, 8, 'rgba(50,34,20,0.5)') // shaded edge
    px(g, pxn - 1, 1, 5, 1, '#a07b48') // cap
  }
  return c
}

// Corner piece for the animal pen (canonical = top-left corner): a corner post
// with a rail running right (top edge) and a rail running down (left edge), so
// it bridges two perpendicular straight runs. Rotated for the four corners.
function bakeFenceCorner(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  // Top rail running right from the corner (canonical = top-left corner).
  px(g, 4, 4, T - 4, 2, '#9a6a3a')
  px(g, 4, 4, T - 4, 1, '#b3824a')
  px(g, 4, 6, T - 4, 1, 'rgba(60,40,24,0.4)')
  // Left rail running down from the corner.
  px(g, 4, 4, 2, T - 4, '#9a6a3a')
  px(g, 4, 4, 1, T - 4, '#b3824a')
  px(g, 6, 4, 1, T - 4, 'rgba(60,40,24,0.4)')
  // No post at the bend itself — posts sit on each arm flanking the corner.
  // Post on the top arm (vertical stake straddling the rail).
  px(g, 9, 1, 3, 8, '#7a5230')
  px(g, 9, 1, 1, 8, '#92663c')
  px(g, 11, 1, 1, 8, 'rgba(50,34,20,0.5)')
  px(g, 8, 1, 5, 1, '#a07b48') // cap
  // Post on the left arm (horizontal stake straddling the rail).
  px(g, 1, 9, 8, 3, '#7a5230')
  px(g, 1, 9, 8, 1, '#92663c')
  px(g, 1, 11, 8, 1, 'rgba(50,34,20,0.5)')
  px(g, 1, 8, 1, 5, '#a07b48') // cap
  return c
}

// ---------------- Obstacles ----------------
function bakeTree(): HTMLCanvasElement {
  const c = cv(T, T + 16)
  const g = ctxOf(c)
  // shadow
  px(g, 3, 28, 10, 3, 'rgba(0,0,0,0.18)')
  // trunk (tall enough to meet the canopy with no gap)
  px(g, 7, 13, 3, 16, '#7a4a26')
  px(g, 7, 13, 1, 16, '#8f5a30')
  px(g, 6, 27, 5, 2, '#6e4426')
  // canopy (overlaps the trunk top so they read as one tree)
  px(g, 3, 5, 10, 11, '#2f7d3a')
  px(g, 2, 7, 12, 8, '#2f7d3a')
  px(g, 4, 2, 8, 6, '#3a9148')
  px(g, 5, 1, 6, 4, '#49a657')
  px(g, 6, 13, 4, 3, '#2f7d3a')
  for (let i = 0; i < 12; i++) dot(g, 3 + ((i * 5) % 10), 4 + ((i * 7) % 11), '#256b30')
  return c
}

function bakeStump(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 3, 11, 10, 3, 'rgba(0,0,0,0.15)')
  px(g, 4, 6, 8, 7, '#7a4a26')
  px(g, 4, 5, 8, 2, '#9a6438')
  px(g, 6, 6, 4, 2, '#b07a48')
  dot(g, 7, 7, '#7a4a26')
  return c
}

function bakeLargeStump(): HTMLCanvasElement {
  const c = cv(T + 6, T + 4)
  const g = ctxOf(c)
  px(g, 3, 15, 16, 4, 'rgba(0,0,0,0.18)')
  px(g, 3, 7, 16, 10, '#6e4426')
  px(g, 3, 6, 16, 2, '#8a5a32')
  px(g, 6, 7, 10, 3, '#a8743f')
  px(g, 9, 8, 4, 1, '#c08850')
  px(g, 3, 14, 16, 2, '#52331d')
  return c
}

function bakeRock(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 3, 12, 10, 2, 'rgba(0,0,0,0.15)')
  px(g, 3, 6, 10, 7, '#8b8f99')
  px(g, 4, 5, 7, 2, '#a7abb5')
  px(g, 4, 10, 8, 3, '#6e727c')
  dot(g, 6, 8, '#c2c6cf')
  return c
}

function bakeOreRock(ore: string): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 3, 12, 10, 2, 'rgba(0,0,0,0.15)')
  px(g, 3, 6, 10, 7, '#707884')
  px(g, 4, 5, 7, 2, '#9aa2ad')
  px(g, 4, 11, 8, 2, '#555d68')
  px(g, 5, 8, 2, 2, ore)
  px(g, 9, 7, 2, 3, ore)
  dot(g, 6, 8, '#f3d6a8')
  return c
}

function bakeWeed(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 5, 8, 1, 5, '#3f8a3a')
  px(g, 8, 7, 1, 6, '#3f8a3a')
  px(g, 6, 9, 1, 4, '#56a84a')
  px(g, 4, 9, 2, 1, '#56a84a')
  px(g, 9, 8, 2, 1, '#56a84a')
  px(g, 5, 12, 6, 1, 'rgba(0,0,0,0.12)')
  return c
}

function bakeFlower(): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  px(g, 7, 8, 1, 5, '#3f8a3a')
  px(g, 5, 9, 2, 1, '#3f8a3a')
  // daffodil petals
  px(g, 6, 4, 4, 4, '#ffe14d')
  px(g, 5, 5, 6, 2, '#ffe14d')
  px(g, 7, 5, 2, 2, '#ff9e2c')
  px(g, 6, 3, 1, 1, '#fff0a0')
  return c
}

// ---------------- Crops ----------------
// An octagonal "round" fruit (cut corners) with highlight, shade and a small
// green calyx — used for tomatoes.
function roundFruit(g: CanvasRenderingContext2D, x: number, y: number, col: string) {
  px(g, x + 1, y, 2, 4, col)
  px(g, x, y + 1, 4, 2, col)
  px(g, x + 1, y, 1, 1, lighten(col))
  dot(g, x, y + 1, lighten(col))
  px(g, x + 1, y + 3, 2, 1, darken(col))
  px(g, x + 1, y - 1, 2, 1, '#2f7d3a') // calyx
}

function drawWheat(g: CanvasRenderingContext2D, color: string, ripe: boolean) {
  const head = ripe ? color : '#9bbf5a'
  const stalk = ripe ? '#caa24a' : '#6fb04a'
  const ears: [number, number][] = [
    [4, 3],
    [8, 1],
    [12, 3],
  ]
  for (const [x, hy] of ears) {
    px(g, x, hy + 4, 1, 14 - (hy + 4), stalk) // stem to ground
    px(g, x - 1, hy, 3, 5, head) // grain head
    px(g, x - 1, hy, 1, 5, darken(head)) // left shade
    px(g, x + 1, hy, 1, 5, darken(head)) // right shade
    dot(g, x, hy + 1, lighten(head))
    dot(g, x, hy + 3, lighten(head))
    px(g, x, hy - 2, 1, 2, ripe ? '#e8d27a' : '#8abf5a') // awn
  }
  px(g, 4, 13, 9, 1, 'rgba(0,0,0,0.12)')
}

function drawTomato(g: CanvasRenderingContext2D, color: string, ripe: boolean) {
  const fruit = ripe ? color : '#6fae54'
  // foliage bush + stake
  px(g, 4, 6, 8, 7, '#2f7d3a')
  px(g, 4, 6, 8, 2, '#3a9148')
  px(g, 3, 8, 1, 3, '#2f7d3a')
  px(g, 12, 8, 1, 3, '#2f7d3a')
  px(g, 11, 3, 1, 10, '#9a6a3a') // stake
  roundFruit(g, 4, 8, fruit)
  roundFruit(g, 8, 9, fruit)
}

function drawStrawberry(g: CanvasRenderingContext2D, color: string, ripe: boolean) {
  // trefoil leaves
  px(g, 3, 5, 4, 3, '#3a8a3a')
  px(g, 9, 5, 4, 3, '#3a8a3a')
  px(g, 6, 4, 4, 3, '#3a8a3a')
  px(g, 3, 5, 4, 1, '#6fc25a')
  px(g, 9, 5, 4, 1, '#6fc25a')
  px(g, 5, 7, 6, 2, '#2f7d3a')
  if (ripe) {
    // hanging red berry with seeds + calyx
    px(g, 6, 8, 4, 3, color)
    px(g, 7, 8, 2, 5, color) // teardrop tip
    px(g, 6, 8, 4, 1, lighten(color))
    px(g, 6, 7, 4, 1, '#3a8a3a')
    dot(g, 7, 9, '#fff0a0')
    dot(g, 9, 10, '#fff0a0')
    dot(g, 7, 11, '#fff0a0')
  } else {
    // white blossoms
    px(g, 5, 8, 3, 3, '#f4f0e0')
    dot(g, 6, 9, '#ffe14d')
    px(g, 9, 9, 2, 2, '#f4f0e0')
    dot(g, 9, 9, '#ffe14d')
  }
}

function drawCorn(g: CanvasRenderingContext2D, color: string, ripe: boolean) {
  // tall stalk + angled leaves
  px(g, 7, 1, 2, 13, '#3a8a3a')
  px(g, 7, 1, 1, 13, '#4a9d4a')
  px(g, 3, 5, 4, 2, '#3a8a3a')
  px(g, 2, 6, 2, 1, '#56a84a')
  px(g, 9, 8, 4, 2, '#3a8a3a')
  px(g, 12, 9, 2, 1, '#56a84a')
  if (ripe) {
    // husked cob with kernel rows + tassel
    px(g, 9, 5, 4, 8, '#caa040') // husk
    px(g, 9, 5, 3, 8, color) // cob
    px(g, 9, 5, 3, 1, lighten(color))
    px(g, 11, 5, 1, 8, darken(color))
    for (let ky = 6; ky <= 11; ky += 2) dot(g, 10, ky, '#b9892f') // kernels
    px(g, 8, 6, 1, 6, '#6fb04a') // husk leaf
    px(g, 7, 0, 2, 2, '#e8d27a') // tassel
  } else {
    px(g, 7, 0, 2, 2, '#9bbf5a') // young tassel
  }
}

function bakeCrop(id: string, color: string, stages: number): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = []
  for (let s = 0; s < stages; s++) {
    const c = cv(T, T)
    const g = ctxOf(c)
    const t = s / (stages - 1)
    if (s === 0) {
      // seed mound with a sprouting tip
      px(g, 5, 11, 6, 2, '#6e4426')
      px(g, 5, 11, 6, 1, '#8a5a32')
      px(g, 7, 9, 1, 2, '#3a8a3a')
      dot(g, 8, 9, '#56a84a')
    } else if (t < 0.55) {
      // leafy sprout with highlighted blades
      const h = Math.round(3 + t * 7)
      px(g, 7, 13 - h, 2, h, '#3a8a3a')
      px(g, 8, 13 - h, 1, h, '#56a84a') // stem light
      px(g, 4, 13 - h + 1, 3, 2, '#3a8a3a') // left leaf
      px(g, 4, 13 - h + 1, 2, 1, '#6fc25a')
      px(g, 9, 13 - h + 2, 3, 2, '#3a8a3a') // right leaf
      px(g, 10, 13 - h + 2, 2, 1, '#6fc25a')
      px(g, 6, 12, 4, 1, 'rgba(0,0,0,0.12)')
    } else {
      // crop-specific shape; final stage is ripe, earlier mature frames green
      const ripe = s === stages - 1
      if (id === 'wheat') drawWheat(g, color, ripe)
      else if (id === 'tomato') drawTomato(g, color, ripe)
      else if (id === 'strawberry') drawStrawberry(g, color, ripe)
      else if (id === 'corn') drawCorn(g, color, ripe)
      else {
        // generic bush fallback
        px(g, 7, 4, 2, 9, '#2f7d3a')
        px(g, 4, 8, 5, 5, ripe ? color : '#6fae54')
        px(g, 4, 8, 5, 2, lighten(ripe ? color : '#6fae54'))
        dot(g, 5, 9, '#ffffff')
      }
    }
    out.push(c)
  }
  return out
}

function lighten(hex: string): string {
  return shade(hex, 36)
}
function darken(hex: string): string {
  return shade(hex, -36)
}
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt))
  const gc = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `rgb(${r},${gc},${b})`
}

// ---------------- Buildings ----------------
// NOTE: This is now the player's home TENT (A-frame), ~1.5× smaller than the
// old farmhouse. Still stored under Sprites.farmhouse to avoid a wide rename.
function bakeFarmhouse(): HTMLCanvasElement {
  const w = 3 * T // 48
  const h = 3 * T // 48
  const c = cv(w, h)
  const g = ctxOf(c)
  const apexX = 24
  const apexY = 8
  const baseY = 42
  // Ground shadow.
  px(g, 6, baseY + 1, 36, 3, 'rgba(0,0,0,0.18)')
  // A-frame fabric — left panel lit, right panel shaded, drawn as scanlines.
  for (let y = apexY; y <= baseY; y++) {
    const t = (y - apexY) / (baseY - apexY)
    const half = Math.round(2 + t * 20)
    px(g, apexX - half, y, half, 1, '#dd8f5e') // lit side
    px(g, apexX, y, half, 1, '#c2723f') // shade side
  }
  // Ridge highlight + base trim.
  for (let y = apexY; y <= apexY + 6; y++) {
    const t = (y - apexY) / (baseY - apexY)
    const half = Math.round(2 + t * 20)
    px(g, apexX - half, y, half * 2, 1, '#eaa873')
  }
  px(g, apexX - 21, baseY - 1, 42, 2, '#9c542c') // hem
  // Fabric seams.
  for (const sx of [-12, 12]) {
    for (let y = apexY + 6; y <= baseY; y++) {
      const t = (y - apexY) / (baseY - apexY)
      if (Math.abs(sx) < 2 + t * 20) px(g, apexX + Math.round(sx * t) , y, 1, 1, 'rgba(120,70,40,0.4)')
    }
  }
  // Door flap — dark triangular opening, with tied-back flaps either side.
  const dTop = 22
  for (let y = dTop; y <= baseY - 1; y++) {
    const t = (y - dTop) / (baseY - dTop)
    const half = Math.round(1 + t * 7)
    px(g, apexX - half, y, half * 2, 1, '#3a2a30')
  }
  px(g, apexX - 8, dTop, 3, 6, '#b06b3c') // left tied flap
  px(g, apexX + 5, dTop, 3, 6, '#b06b3c') // right tied flap
  dot(g, apexX - 7, dTop + 5, '#e8c08a') // tie knots
  dot(g, apexX + 7, dTop + 5, '#e8c08a')
  // Ridge pole + pennant flag.
  px(g, apexX - 1, 2, 2, 8, '#6e4426')
  px(g, apexX + 1, 2, 8, 4, '#e0653f')
  px(g, apexX + 1, 2, 8, 1, '#f0855f')
  // Guy ropes + pegs.
  for (let i = 0; i < 6; i++) {
    dot(g, apexX - 14 - i, apexY + 8 + i * 4, 'rgba(90,70,50,0.7)')
    dot(g, apexX + 14 + i, apexY + 8 + i * 4, 'rgba(90,70,50,0.7)')
  }
  px(g, 3, baseY, 2, 2, '#5a4028')
  px(g, w - 5, baseY, 2, 2, '#5a4028')
  return c
}

// Open-air market stall: striped awning roof, side posts, an open central
// bay (player walks straight in to the counter), goods crates and a sign.
function bakeStore(): HTMLCanvasElement {
  const w = 6 * T // 96
  const h = 3 * T + 16 // 64
  const c = cv(w, h)
  const g = ctxOf(c)
  // Support posts (left + right), drawn first so the roof caps them.
  for (const pxn of [4, w - 10]) {
    px(g, pxn, 16, 6, h - 18, '#8a5a32')
    px(g, pxn, 16, 2, h - 18, '#a8743f') // lit edge
    px(g, pxn + 4, 16, 2, h - 18, 'rgba(50,34,20,0.4)') // shade edge
  }
  // Back counter spanning the bay.
  px(g, 10, 44, w - 20, 10, '#9a6a3a')
  px(g, 10, 44, w - 20, 2, '#b3824a')
  px(g, 10, 52, w - 20, 2, 'rgba(50,34,20,0.4)')
  for (let i = 14; i < w - 10; i += 6) px(g, i, 46, 1, 6, 'rgba(60,40,24,0.25)')
  // Goods on the counter: crates + a barrel.
  px(g, 16, 36, 12, 9, '#b07a44'); px(g, 16, 36, 12, 2, '#caa066')
  px(g, 18, 38, 3, 3, '#e2c47a'); px(g, 23, 38, 3, 3, '#e2c47a')
  px(g, w - 30, 35, 11, 10, '#9a6a3a'); px(g, w - 30, 35, 11, 2, '#b3824a')
  px(g, w - 28, 33, 7, 3, '#6fae54'); dot(g, w - 26, 34, '#8fcf6a') // greens
  // Striped awning roof.
  px(g, 0, 4, w, 16, '#b14b3a')
  px(g, 0, 4, w, 3, '#c75c48') // top highlight
  for (let i = 0; i < w; i += 12) px(g, i, 4, 6, 16, '#f0e2cc') // cream stripes
  px(g, 0, 16, w, 2, 'rgba(60,30,24,0.35)') // roof underside shadow
  // Scalloped valance.
  for (let i = 0; i < w; i += 8) px(g, i + 1, 18, 5, 3, '#c75c48')
  // Hanging sign board "STORE".
  px(g, w / 2 - 24, 22, 48, 12, '#6e4426')
  px(g, w / 2 - 22, 24, 44, 8, '#f0d89a')
  px(g, w / 2 - 4, 20, 2, 2, '#5a3a22') // hanger
  g.fillStyle = '#6e4426'
  g.font = '7px monospace'
  g.fillText('STORE', w / 2 - 16, 31)
  return c
}

function bakeShrine(restored: boolean): HTMLCanvasElement {
  const w = 3 * T
  const h = 3 * T + 8
  const c = cv(w, h)
  const g = ctxOf(c)
  const stone = restored ? '#cfc6e8' : '#8a8678'
  const stoneL = restored ? '#ece6ff' : '#a09c8e'
  px(g, 6, 18, w - 12, h - 20, stone)
  px(g, 6, 18, w - 12, 4, stoneL)
  // arch
  px(g, 10, 6, w - 20, 16, stone)
  px(g, 14, 2, w - 28, 8, stone)
  // gem
  px(g, w / 2 - 3, 22, 6, 8, restored ? '#7af0c0' : '#4a4636')
  if (restored) {
    px(g, w / 2 - 4, 21, 8, 2, '#bdffe6')
    dot(g, w / 2, 24, '#ffffff')
  }
  // moss / cracks when broken
  if (!restored) {
    px(g, 8, 30, 4, 2, '#5c7d3a')
    px(g, w - 12, 24, 3, 3, '#5c7d3a')
    px(g, 12, 12, 1, 6, '#6e6a5c')
  }
  return c
}

// ---------------- Item icons (for UI, drawn on small canvases) ----------------
export function bakeItemIcon(sprite: string, color?: string): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  switch (sprite) {
    case 'wood':
      px(g, 2, 6, 12, 5, '#8a5a32')
      px(g, 2, 6, 12, 2, '#a8743f')
      for (let i = 3; i < 14; i += 3) px(g, i, 6, 1, 5, '#6e4426')
      break
    case 'hardwood':
      px(g, 2, 5, 12, 7, '#6e4426')
      px(g, 2, 5, 12, 2, '#8a5a32')
      px(g, 4, 6, 8, 1, '#a8743f')
      break
    case 'stone':
      px(g, 3, 6, 10, 7, '#8b8f99')
      px(g, 4, 5, 7, 2, '#a7abb5')
      px(g, 4, 11, 8, 2, '#6e727c')
      break
    case 'copper_ore':
      px(g, 3, 6, 10, 7, '#787f8a')
      px(g, 4, 5, 7, 2, '#a0a6b0')
      px(g, 5, 8, 3, 3, '#c8753a')
      px(g, 10, 7, 2, 3, '#e09855')
      break
    case 'iron_ore':
      px(g, 3, 6, 10, 7, '#6f7680')
      px(g, 4, 5, 7, 2, '#9ba2ac')
      px(g, 5, 8, 3, 3, '#c8ccd6')
      px(g, 10, 7, 2, 3, '#eef0f6')
      break
    case 'daffodil':
      px(g, 7, 9, 1, 4, '#3f8a3a')
      px(g, 6, 4, 4, 4, '#ffe14d')
      px(g, 5, 5, 6, 2, '#ffe14d')
      px(g, 7, 5, 2, 2, '#ff9e2c')
      break
    case 'herbal_tea':
      // rising steam
      dot(g, 6, 2, 'rgba(210,230,210,0.7)')
      dot(g, 9, 3, 'rgba(210,230,210,0.7)')
      dot(g, 7, 4, 'rgba(210,230,210,0.7)')
      // saucer
      px(g, 3, 11, 10, 2, '#e6dfce')
      px(g, 3, 11, 10, 1, '#fbf5e6')
      // cup
      px(g, 4, 6, 8, 5, '#f4efe2')
      px(g, 4, 6, 8, 1, '#ffffff')
      px(g, 11, 6, 1, 5, '#d8d0bd')
      // green tea surface + floating leaf
      px(g, 5, 6, 6, 2, '#7bbf6a')
      px(g, 5, 6, 6, 1, '#9ad889')
      dot(g, 8, 7, '#3f8a3a')
      // handle
      px(g, 12, 7, 1, 3, '#f4efe2')
      px(g, 12, 7, 2, 1, '#f4efe2')
      px(g, 12, 9, 2, 1, '#f4efe2')
      break
    case 'flour':
      // folded paper top
      px(g, 6, 2, 4, 1, '#ece0c4')
      px(g, 5, 3, 6, 2, '#ded0b0')
      // sack body
      px(g, 4, 5, 8, 8, '#ece0c4')
      px(g, 4, 5, 1, 8, '#fbf4e2')
      px(g, 11, 5, 1, 8, '#d2c29c')
      px(g, 4, 12, 8, 1, '#c9b88f')
      // wheat emblem
      px(g, 7, 7, 2, 4, '#c98a3a')
      dot(g, 6, 8, '#c98a3a')
      dot(g, 9, 8, '#c98a3a')
      dot(g, 6, 9, '#d8a24a')
      dot(g, 9, 9, '#d8a24a')
      dot(g, 7, 6, '#e6c06a')
      break
    case 'bread':
      px(g, 3, 7, 10, 5, '#a8632a') // bottom crust
      px(g, 3, 7, 10, 1, '#c2843a')
      px(g, 4, 5, 8, 3, '#d99a4a') // domed top
      px(g, 5, 4, 6, 2, '#e6ad5a')
      px(g, 5, 4, 6, 1, '#f2c078') // sheen
      px(g, 6, 6, 1, 3, '#a8632a') // score marks
      px(g, 9, 6, 1, 3, '#a8632a')
      px(g, 3, 11, 10, 1, '#8f5520')
      break
    case 'toast':
      // bread-slice silhouette + butter pat
      px(g, 5, 3, 6, 2, '#c78335')
      px(g, 4, 4, 8, 9, '#c78335')
      px(g, 5, 6, 6, 6, '#f3cd82')
      px(g, 5, 6, 6, 1, '#ffe1a0')
      px(g, 7, 8, 3, 3, '#ffe79a')
      px(g, 7, 8, 2, 1, '#fff2c0')
      break
    case 'bacon_toast':
      px(g, 5, 3, 6, 2, '#c78335')
      px(g, 4, 4, 8, 9, '#c78335')
      px(g, 5, 6, 6, 6, '#f3cd82')
      px(g, 5, 7, 6, 2, '#c25048') // bacon strip
      px(g, 5, 7, 6, 1, '#e88a7a')
      px(g, 5, 10, 6, 2, '#a83e3a') // bacon strip
      px(g, 5, 10, 6, 1, '#d2706a')
      break
    case 'milk':
      px(g, 6, 2, 4, 2, '#9fd0ff') // cap
      px(g, 6, 2, 4, 1, '#cbe6ff')
      px(g, 6, 4, 4, 1, '#eef4ff') // neck
      px(g, 5, 5, 6, 8, '#f4f1df') // bottle body
      px(g, 5, 5, 1, 8, '#ffffff') // shine
      px(g, 10, 5, 1, 8, '#dcd6c0') // shade
      px(g, 5, 12, 6, 1, '#d4cdb6') // base
      px(g, 5, 8, 6, 3, '#cfe6ff') // label
      dot(g, 7, 9, '#5a9fd0')
      dot(g, 9, 9, '#5a9fd0')
      break
    case 'egg':
      px(g, 6, 3, 4, 1, '#fffdf6') // narrow top
      px(g, 5, 4, 6, 7, '#f6efdf') // body
      px(g, 6, 11, 4, 1, '#eee4cc') // round bottom
      px(g, 6, 4, 2, 4, '#fffdf6') // highlight
      px(g, 10, 6, 1, 5, '#e2d6bd') // shade
      break
    case 'golden_egg':
      px(g, 6, 3, 4, 1, '#ffe9a0')
      px(g, 5, 4, 6, 7, '#f0c44f')
      px(g, 6, 11, 4, 1, '#c79a34')
      px(g, 6, 4, 2, 3, '#fff0a8') // highlight
      px(g, 10, 6, 1, 5, '#b88724') // shade
      dot(g, 8, 6, '#fffce0') // sparkle
      dot(g, 9, 9, '#fff7b8')
      break
    case 'rich_milk':
      px(g, 6, 2, 4, 2, '#e8c06a') // gold cap
      px(g, 6, 2, 4, 1, '#fbe39a')
      px(g, 6, 4, 4, 1, '#fff6e0') // neck
      px(g, 5, 5, 6, 8, '#fff6d8') // creamy body
      px(g, 5, 5, 1, 8, '#ffffff')
      px(g, 10, 5, 1, 8, '#e8dcb0')
      px(g, 5, 12, 6, 1, '#dccba0')
      px(g, 5, 8, 6, 3, '#f5e6bd') // label
      dot(g, 8, 9, '#caa24a')
      break
    case 'bacon': {
      // two continuous wavy rashers (drawn per-column so there are no gaps)
      const wave1 = [4, 4, 5, 5, 5, 5, 5, 4, 4, 4]
      const wave2 = [9, 9, 10, 10, 10, 10, 10, 9, 9, 9]
      for (let i = 0; i < 10; i++) {
        const x = 3 + i
        px(g, x, wave1[i], 1, 3, '#c25048')
        dot(g, x, wave1[i], '#e88a7a') // fat streak on top
        dot(g, x, wave1[i] + 2, '#a83e3a') // bottom shade
        px(g, x, wave2[i], 1, 3, '#c25048')
        dot(g, x, wave2[i], '#e88a7a')
        dot(g, x, wave2[i] + 2, '#a83e3a')
      }
      break
    }
    case 'premium_bacon': {
      // one bold continuous marbled rasher + sheen
      const wave = [5, 5, 6, 6, 6, 6, 6, 5, 5, 5]
      for (let i = 0; i < 10; i++) {
        const x = 3 + i
        px(g, x, wave[i], 1, 4, '#a83e48')
        dot(g, x, wave[i], '#ffd08a') // fat marbling
        dot(g, x, wave[i] + 2, '#d2706a')
      }
      dot(g, 11, 5, '#fff0a0') // sheen
      break
    }
    case 'butter':
      px(g, 3, 9, 10, 3, '#efe6c8') // wrapper
      px(g, 3, 9, 10, 1, '#fff7e0')
      px(g, 4, 5, 8, 4, '#f5d35f') // butter block
      px(g, 4, 5, 8, 1, '#fff18f')
      px(g, 4, 8, 8, 1, '#e0b84a')
      px(g, 6, 4, 3, 1, '#fbe79a') // knob
      break
    case 'cheese':
      px(g, 3, 5, 9, 2, '#ffe07a') // wedge, wide top
      px(g, 3, 7, 8, 2, '#f5cf5a')
      px(g, 3, 9, 6, 2, '#f5cf5a')
      px(g, 3, 11, 4, 1, '#f0c34a')
      px(g, 3, 5, 9, 1, '#fff0a0') // top sheen
      px(g, 3, 5, 1, 7, '#e0b84a') // rind
      dot(g, 6, 7, '#d8a83a') // holes
      dot(g, 5, 10, '#d8a83a')
      dot(g, 8, 8, '#d8a83a')
      break
    case 'pastry':
      px(g, 4, 6, 8, 4, '#d99a4a') // croissant body
      px(g, 3, 7, 2, 2, '#cf9040') // left horn
      px(g, 11, 7, 2, 2, '#cf9040') // right horn
      px(g, 5, 5, 6, 1, '#e6ad5a')
      px(g, 4, 6, 8, 1, '#f2c078') // sheen
      px(g, 6, 6, 1, 3, '#b97832') // segment lines
      px(g, 8, 6, 1, 3, '#b97832')
      px(g, 10, 6, 1, 2, '#b97832')
      px(g, 4, 9, 8, 1, '#a8632a')
      break
    case 'strawberry_jam':
      px(g, 5, 3, 6, 2, '#c75a86') // lid
      px(g, 5, 3, 6, 1, '#e07fa6')
      px(g, 4, 5, 8, 1, '#cdbb92') // rim
      px(g, 4, 6, 8, 7, '#d2384f') // jam fill
      px(g, 4, 6, 8, 1, '#e85f74')
      px(g, 11, 6, 1, 6, 'rgba(255,255,255,0.28)') // glass shine
      px(g, 5, 9, 6, 3, '#f3e9cf') // label
      dot(g, 7, 10, '#d2384f') // berry on label
      dot(g, 8, 10, '#d2384f')
      dot(g, 7, 11, '#3f8a3a')
      break
    case 'strawberry_milk':
      px(g, 5, 4, 6, 9, '#f6cdda') // pink milk
      px(g, 5, 4, 6, 1, '#ffe1ea') // foam
      px(g, 5, 4, 1, 9, 'rgba(255,255,255,0.35)') // glass shine
      px(g, 5, 12, 6, 1, '#e2a6bc') // base shade
      px(g, 9, 2, 1, 5, '#ff6f9a') // straw
      dot(g, 10, 2, '#ff9fb8')
      break
    case 'strawberry_jam_toast':
      px(g, 5, 3, 6, 2, '#c78335')
      px(g, 4, 4, 8, 9, '#c78335')
      px(g, 5, 6, 6, 6, '#f3cd82')
      px(g, 5, 7, 6, 4, '#d2384f') // jam spread
      px(g, 5, 7, 6, 1, '#e85f74')
      dot(g, 7, 9, '#ff9fb0') // seeds
      dot(g, 9, 10, '#ff9fb0')
      break
    case 'tomato_sauce':
      px(g, 5, 3, 6, 2, '#c0473d') // lid
      px(g, 5, 3, 6, 1, '#e0685c')
      px(g, 6, 5, 4, 1, '#cfd9ea') // neck
      px(g, 4, 6, 8, 7, '#cfd9ea') // glass jar
      px(g, 5, 7, 6, 5, '#d8443d') // sauce
      px(g, 5, 7, 6, 1, '#e8675c')
      px(g, 11, 7, 1, 5, 'rgba(255,255,255,0.30)') // shine
      dot(g, 7, 9, '#ffb0a0') // tomato bits
      dot(g, 9, 10, '#ffb0a0')
      break
    case 'pizza':
      px(g, 3, 4, 10, 2, '#e0a850') // crust
      px(g, 3, 4, 10, 1, '#f0c87a')
      px(g, 4, 6, 8, 2, '#f2cb55') // cheese, narrowing to a tip
      px(g, 5, 8, 6, 2, '#f2cb55')
      px(g, 6, 10, 4, 1, '#f2cb55')
      px(g, 7, 11, 2, 1, '#f2cb55')
      px(g, 5, 6, 2, 2, '#cf3f3a') // pepperoni
      px(g, 9, 7, 2, 2, '#cf3f3a')
      px(g, 7, 9, 2, 2, '#cf3f3a')
      break
    case 'butter_corn':
      px(g, 3, 8, 2, 5, '#5aa038') // husk leaves
      px(g, 11, 8, 2, 5, '#5aa038')
      px(g, 5, 3, 6, 10, '#f0c84b') // cob
      px(g, 5, 3, 6, 1, '#ffe14d')
      px(g, 5, 12, 6, 1, '#d8a24a')
      px(g, 7, 3, 1, 10, '#e0b440') // kernel columns
      px(g, 9, 3, 1, 10, '#e0b440')
      px(g, 5, 6, 6, 1, '#e0b440') // kernel rows
      px(g, 5, 9, 6, 1, '#e0b440')
      px(g, 6, 4, 4, 2, '#fff2a0') // melting butter pat
      px(g, 6, 4, 4, 1, '#ffffff')
      break
    case 'corn_pizza':
      px(g, 3, 4, 10, 2, '#e0a850') // crust
      px(g, 3, 4, 10, 1, '#f0c87a')
      px(g, 4, 6, 8, 2, '#e8b94a') // cheese, narrowing to a tip
      px(g, 5, 8, 6, 2, '#e8b94a')
      px(g, 6, 10, 4, 1, '#e8b94a')
      px(g, 7, 11, 2, 1, '#e8b94a')
      dot(g, 5, 6, '#ffe87a') // corn kernels
      dot(g, 7, 7, '#ffe87a')
      dot(g, 9, 6, '#ffe87a')
      dot(g, 6, 9, '#ffe87a')
      dot(g, 8, 9, '#ffe87a')
      dot(g, 10, 8, '#7bbf6a') // herb fleck
      break
    case 'permit_chicken':
    case 'permit_dairy':
    case 'permit_pig':
      px(g, 3, 4, 10, 10, '#efe2bc')
      px(g, 4, 5, 8, 1, '#b3824a')
      px(g, 5, 8, 6, 1, '#6e4426')
      px(g, 5, 10, 5, 1, '#6e4426')
      break
    case 'animal_chicken':
      px(g, 4, 7, 7, 5, '#f0c85a')
      px(g, 8, 4, 4, 4, '#f0c85a')
      px(g, 9, 3, 2, 2, '#e05a36')
      px(g, 5, 12, 1, 2, '#d9872a')
      px(g, 9, 12, 1, 2, '#d9872a')
      break
    case 'animal_cow':
      px(g, 3, 7, 10, 6, '#e9e2d2')
      px(g, 10, 4, 4, 5, '#e9e2d2')
      px(g, 5, 8, 3, 3, '#3a2a24')
      px(g, 4, 13, 1, 2, '#3a2a24')
      px(g, 10, 13, 1, 2, '#3a2a24')
      break
    case 'animal_pig':
      px(g, 3, 7, 10, 6, '#e89aa8')
      px(g, 10, 5, 4, 4, '#e89aa8')
      px(g, 12, 7, 2, 2, '#c96d82')
      px(g, 4, 13, 1, 2, '#c96d82')
      px(g, 10, 13, 1, 2, '#c96d82')
      break
    case 'fiber':
      px(g, 5, 4, 1, 9, '#6fae54')
      px(g, 8, 3, 1, 10, '#5aa038')
      px(g, 10, 5, 1, 8, '#6fae54')
      px(g, 4, 6, 2, 1, '#7bbf6a')
      px(g, 8, 5, 2, 1, '#7bbf6a')
      px(g, 6, 12, 5, 1, 'rgba(0,0,0,0.15)')
      break
    case 'fertilizer':
    case 'fertilizer_deluxe': {
      const deluxe = sprite === 'fertilizer_deluxe'
      px(g, 3, 8, 10, 5, deluxe ? '#8a6a2a' : '#6e4a2a')
      px(g, 3, 8, 10, 2, deluxe ? '#b89244' : '#8a5e34')
      // speckles
      const fc = deluxe ? '#ffe14d' : '#7bbf6a'
      dot(g, 5, 9, fc)
      dot(g, 8, 10, fc)
      dot(g, 11, 9, fc)
      dot(g, 6, 11, fc)
      if (deluxe) dot(g, 9, 8, '#fff0a0')
      break
    }
    case 'sprinkler':
    case 'sprinkler_quality': {
      const gold = sprite === 'sprinkler_quality'
      const metal = gold ? '#e8c04a' : '#9aa0ac'
      const metalL = gold ? '#ffe87a' : '#c2c6cf'
      px(g, 7, 8, 2, 5, metal) // post
      px(g, 5, 6, 6, 3, metal) // head
      px(g, 5, 6, 6, 1, metalL)
      px(g, 4, 12, 8, 1, gold ? '#a6791f' : '#6e727c') // base
      dot(g, 4, 9, '#9fd0ff')
      dot(g, 11, 9, '#9fd0ff')
      dot(g, 8, 5, '#9fd0ff')
      break
    }
    case 'workbench':
      px(g, 2, 9, 12, 4, color ?? '#9a6a3a') // top
      px(g, 2, 9, 12, 1, '#b3824a')
      px(g, 3, 12, 2, 3, '#6e4426') // legs
      px(g, 11, 12, 2, 3, '#6e4426')
      px(g, 5, 6, 2, 3, '#b8bcc6') // saw blade
      px(g, 9, 5, 1, 4, '#9a6a3a') // hammer handle
      px(g, 8, 4, 3, 2, '#8b8f99') // hammer head
      break
    case 'seed_tomato':
    case 'seed_strawberry':
    case 'seed_corn':
      px(g, 4, 5, 8, 7, '#d8b888')
      px(g, 4, 5, 8, 2, '#e8cda0')
      px(g, 6, 8, 4, 3, color ?? '#7a5a3a')
      break
    default:
      if (sprite.startsWith('seed_')) {
        px(g, 4, 5, 8, 7, '#d8b888')
        px(g, 4, 5, 8, 2, '#e8cda0')
        px(g, 6, 8, 4, 3, color ?? '#7a5a3a')
      } else if (sprite.startsWith('crop_')) {
        px(g, 5, 6, 6, 7, color ?? '#e8506e')
        px(g, 5, 6, 6, 2, lighten(color ?? '#e8506e'))
        px(g, 6, 4, 2, 3, '#2f7d3a')
        dot(g, 7, 8, '#ffffff')
      } else {
        px(g, 4, 4, 8, 8, color ?? '#cccccc')
      }
  }
  return c
}

// ---------------- Public bundle ----------------
export interface Sprites {
  grass: HTMLCanvasElement[]
  soil: HTMLCanvasElement
  soilWet: HTMLCanvasElement
  water: HTMLCanvasElement[]
  path: HTMLCanvasElement
  fence: HTMLCanvasElement
  fenceSmall: HTMLCanvasElement
  fenceCorner: HTMLCanvasElement
  tree: HTMLCanvasElement
  stump: HTMLCanvasElement
  largeStump: HTMLCanvasElement
  rock: HTMLCanvasElement
  copperOre: HTMLCanvasElement
  ironOre: HTMLCanvasElement
  weed: HTMLCanvasElement
  flower: HTMLCanvasElement
  sprinkler: HTMLCanvasElement
  sprinklerQ: HTMLCanvasElement
  farmer: Record<string, HTMLCanvasElement>
  barnaby: Record<string, HTMLCanvasElement>
  smith: Record<string, HTMLCanvasElement>
  faye: Record<string, HTMLCanvasElement>
  farmhouse: HTMLCanvasElement
  store: HTMLCanvasElement
  shrineBroken: HTMLCanvasElement
  shrineRestored: HTMLCanvasElement
  crops: Record<string, HTMLCanvasElement[]>
}

let cached: Sprites | null = null

export function buildSprites(
  cropDefs: { id: string; color: string; stages: number }[],
): Sprites {
  if (cached) return cached
  // Player: cheerful young man, straw hat + tufts of brown hair.
  const farmerPal: Pal = {
    skin: '#f0c79a',
    skinShade: '#d8a878',
    hair: '#5a3a22',
    hairLite: '#74492a',
    top: '#4a7fc4',
    topShade: '#3a66a0',
    bottom: '#3a4a6a',
    accent: '#9fd0e8',
    hat: '#e8c86a',
    hatShade: '#cda84e',
    style: 'spiky',
    brow: '#4a2e18',
    eye: '#3a5a8c',
  }
  // Store / order NPC: bright young girl, twin tails + bow, pink dress.
  const barnabyPal: Pal = {
    skin: '#f8d2b0',
    skinShade: '#e6af88',
    hair: '#d98a3e',
    hairLite: '#f0ac5e',
    top: '#ec8aa6',
    topShade: '#cf6a87',
    bottom: '#b15577',
    accent: '#ffe2ec',
    style: 'twin',
    bow: '#ff7faa',
    skirt: '#d75f86',
    brow: '#a85c2a',
    eye: '#7a4a86',
    freckles: true,
  }
  // Blacksmith NPC: burly middle-aged man, greying beard + leather apron.
  const smithPal: Pal = {
    skin: '#d8a06e',
    skinShade: '#bc855a',
    hair: '#6a5c50',
    hairLite: '#8c7d6e',
    top: '#8a5030',
    topShade: '#6a3b22',
    bottom: '#46352a',
    accent: '#caa05a',
    style: 'bald',
    broad: true,
    apron: '#3a2e28',
    beard: '#7c6c5c',
    brow: '#5a4a3c',
    eye: '#46342a',
  }
  const fayePal: Pal = {
    skin: '#ecc6a4',
    skinShade: '#d0a684',
    hair: '#6e8f5e',
    top: '#6e8f5e',
    topShade: '#577445',
    bottom: '#4a5a3a',
    accent: '#d9c6ec',
    hood: true,
  }

  const crops: Record<string, HTMLCanvasElement[]> = {}
  for (const cd of cropDefs) crops[cd.id] = bakeCrop(cd.id, cd.color, cd.stages)

  cached = {
    grass: [bakeGrass(0), bakeGrass(1), bakeGrass(2)],
    soil: bakeSoil(false),
    soilWet: bakeSoil(true),
    water: [bakeWater(0), bakeWater(1), bakeWater(2), bakeWater(3)],
    path: bakePath(),
    fence: bakeFence(),
    fenceSmall: bakeFenceSmall(),
    fenceCorner: bakeFenceCorner(),
    tree: bakeTree(),
    stump: bakeStump(),
    largeStump: bakeLargeStump(),
    rock: bakeRock(),
    copperOre: bakeOreRock('#c8753a'),
    ironOre: bakeOreRock('#c8ccd6'),
    weed: bakeWeed(),
    flower: bakeFlower(),
    sprinkler: bakeItemIcon('sprinkler'),
    sprinklerQ: bakeItemIcon('sprinkler_quality'),
    farmer: bakeHumanoidSheet(farmerPal),
    barnaby: bakeHumanoidSheet(barnabyPal),
    smith: bakeHumanoidSheet(smithPal),
    faye: bakeHumanoidSheet(fayePal),
    farmhouse: bakeFarmhouse(),
    store: bakeStore(),
    shrineBroken: bakeShrine(false),
    shrineRestored: bakeShrine(true),
    crops,
  }
  return cached
}

export const QUALITY_GLYPH: Record<CropQuality, string> = {
  normal: '',
  silver: '◇',
  gold: '◆',
  perfect: '★',
}

// ---------------- Tool / DOM icons ----------------
function bakeToolIcon(tool: string): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  switch (tool) {
    case 'hoe':
      // diagonal wooden handle (top-right → bottom-left) + flat metal blade
      px(g, 11, 2, 2, 2, '#9a6a3a')
      px(g, 9, 4, 2, 2, '#a87a44')
      px(g, 7, 6, 2, 2, '#9a6a3a')
      px(g, 5, 8, 2, 2, '#a87a44')
      px(g, 2, 10, 6, 2, '#b8bcc6')
      px(g, 2, 10, 6, 1, '#dfe3ec')
      px(g, 2, 12, 2, 1, '#8f939c')
      break
    case 'watering_can':
      // blue can with spout, handle and droplets
      px(g, 4, 7, 7, 6, '#4f8fd0')
      px(g, 4, 7, 7, 2, '#7fb6e6')
      px(g, 4, 11, 7, 2, '#3f73c4')
      px(g, 3, 6, 2, 4, '#5e89a0')
      px(g, 11, 5, 3, 3, '#4f8fd0')
      px(g, 13, 4, 2, 2, '#7fb6e6')
      dot(g, 14, 8, '#9fd0ff')
      dot(g, 13, 10, '#9fd0ff')
      break
    case 'axe':
      // vertical handle + chunky triangular steel head (top-left)
      px(g, 8, 3, 2, 10, '#9a6a3a')
      px(g, 3, 3, 6, 3, '#c8ccd6')
      px(g, 3, 3, 6, 1, '#eef0f6')
      px(g, 4, 6, 4, 2, '#aeb2bc')
      px(g, 8, 4, 1, 3, '#c8ccd6')
      break
    case 'pickaxe':
      px(g, 8, 3, 2, 10, '#9a6a3a')
      px(g, 3, 3, 10, 2, '#c8ccd6')
      px(g, 3, 2, 10, 1, '#eef0f6')
      px(g, 3, 5, 2, 2, '#aeb2bc')
      px(g, 11, 5, 2, 2, '#aeb2bc')
      break
    case 'scythe':
      // long handle + wide sweeping curved blade hooking down at the top
      px(g, 9, 4, 2, 9, '#9a6a3a')
      px(g, 2, 4, 8, 2, '#cfd3dc')
      px(g, 2, 4, 2, 4, '#cfd3dc')
      px(g, 2, 3, 7, 1, '#eef0f6')
      px(g, 3, 8, 2, 1, '#aeb2bc')
      break
    case 'sword':
      px(g, 7, 2, 2, 8, '#dfe3ec')
      px(g, 8, 1, 1, 1, '#eef0f6')
      px(g, 6, 4, 1, 5, '#aeb2bc')
      px(g, 9, 4, 1, 5, '#ffffff')
      px(g, 4, 10, 8, 1, '#caa066')
      px(g, 7, 11, 2, 3, '#6e4426')
      px(g, 6, 13, 4, 1, '#9a6a3a')
      break
    case 'hand':
      // an open hand
      px(g, 5, 7, 6, 5, '#f6cfa0')
      px(g, 5, 4, 1, 4, '#f6cfa0')
      px(g, 7, 3, 1, 5, '#f6cfa0')
      px(g, 9, 4, 1, 4, '#f6cfa0')
      px(g, 4, 8, 1, 3, '#f6cfa0')
      px(g, 5, 11, 6, 1, '#d8a878')
      break
    case 'backpack':
      px(g, 4, 5, 8, 8, '#9a6a3a')
      px(g, 4, 5, 8, 2, '#b3824a')
      px(g, 6, 8, 4, 3, '#6e4426')
      break
    default:
      px(g, 4, 4, 8, 8, '#cccccc')
  }
  return c
}

// ---------------- UI dot icons (replace emoji in the HUD/menus) ----------------
export function bakeUIIcon(key: string): HTMLCanvasElement {
  const c = cv(T, T)
  const g = ctxOf(c)
  switch (key) {
    case 'ui_coin': {
      px(g, 6, 2, 4, 1, '#e8c14a'); px(g, 5, 3, 6, 1, '#e8c14a')
      px(g, 4, 4, 8, 6, '#e8c14a'); px(g, 5, 10, 6, 1, '#e8c14a'); px(g, 6, 11, 4, 1, '#e8c14a')
      px(g, 4, 8, 8, 2, '#b9892f') // rim shade
      px(g, 6, 3, 3, 1, '#f6e08a') // sheen
      px(g, 7, 5, 2, 5, '#b9892f') // engraved mark
      px(g, 6, 6, 4, 1, '#b9892f')
      break
    }
    case 'ui_bolt': {
      px(g, 9, 2, 3, 4, '#f7c63b'); px(g, 7, 5, 4, 2, '#f7c63b')
      px(g, 5, 7, 4, 2, '#f7c63b'); px(g, 7, 8, 3, 5, '#f7c63b')
      px(g, 9, 2, 1, 4, '#fff0a6'); px(g, 7, 8, 1, 5, '#caa024')
      break
    }
    case 'ui_hammer':
      px(g, 4, 3, 8, 4, '#9aa0ac'); px(g, 4, 3, 8, 1, '#c2c6cf')
      px(g, 4, 6, 8, 1, '#6e727c')
      px(g, 8, 6, 2, 8, '#9a6a3a'); px(g, 8, 6, 1, 8, '#b3824a')
      break
    case 'ui_target':
      px(g, 4, 4, 8, 8, '#c64a3a'); px(g, 5, 5, 6, 6, '#f6e9c9')
      px(g, 6, 6, 4, 4, '#c64a3a'); px(g, 7, 7, 2, 2, '#fff4c8')
      break
    case 'ui_basket':
      px(g, 3, 4, 10, 2, '#caa066') // rim
      px(g, 4, 6, 8, 6, '#b07a44') // body
      for (let i = 5; i < 12; i += 2) px(g, i, 6, 1, 6, 'rgba(90,60,30,0.4)')
      px(g, 4, 6, 8, 1, '#caa066')
      px(g, 5, 3, 1, 2, '#caa066'); px(g, 10, 3, 1, 2, '#caa066'); px(g, 6, 2, 4, 1, '#caa066') // handle
      break
    case 'ui_sprout':
      px(g, 4, 11, 8, 2, '#6e4426'); px(g, 4, 11, 8, 1, '#8a5a32')
      px(g, 7, 5, 2, 6, '#3a8a3a')
      px(g, 3, 6, 3, 2, '#56a84a'); px(g, 4, 5, 2, 1, '#6fc25a')
      px(g, 9, 7, 3, 2, '#56a84a'); px(g, 10, 6, 2, 1, '#6fc25a')
      break
    case 'ui_receipt':
      px(g, 4, 2, 8, 10, '#f4ecd6'); px(g, 4, 2, 8, 1, '#fffaf0')
      px(g, 5, 4, 6, 1, '#9a6a3a'); px(g, 5, 6, 6, 1, '#9a6a3a'); px(g, 5, 8, 4, 1, '#9a6a3a')
      px(g, 4, 12, 2, 1, '#f4ecd6'); px(g, 7, 12, 2, 1, '#f4ecd6'); px(g, 10, 12, 2, 1, '#f4ecd6') // torn edge
      break
    case 'ui_pan':
      px(g, 3, 7, 8, 4, '#3e3a40'); px(g, 3, 7, 8, 1, '#5a565e')
      px(g, 4, 8, 6, 2, '#55505a')
      px(g, 11, 8, 4, 2, '#9a6a3a'); px(g, 11, 8, 4, 1, '#b3824a') // handle
      px(g, 6, 8, 3, 2, '#f0c84b') // egg
      break
    case 'ui_bed':
      px(g, 2, 9, 12, 4, '#9a6a3a'); px(g, 2, 9, 12, 1, '#b3824a')
      px(g, 3, 7, 5, 3, '#eee6d4') // pillow
      px(g, 8, 8, 5, 2, '#c8763f') // blanket
      px(g, 2, 13, 1, 2, '#6e4426'); px(g, 13, 13, 1, 2, '#6e4426') // legs
      break
    case 'ui_fire':
      px(g, 6, 6, 4, 7, '#e0532f')
      px(g, 7, 3, 3, 9, '#f0902f')
      px(g, 7, 2, 2, 5, '#f7c63b'); dot(g, 8, 4, '#fff0a6')
      break
    case 'ui_save':
      px(g, 3, 3, 10, 10, '#4a6a9a'); px(g, 3, 3, 10, 1, '#6a86b4')
      px(g, 5, 3, 5, 4, '#cdd6e0'); px(g, 8, 4, 1, 2, '#2a3a5a') // shutter
      px(g, 5, 9, 6, 3, '#cdd6e0') // label
      break
    case 'ui_sound':
    case 'ui_mute': {
      px(g, 3, 6, 2, 4, '#9a6a3a')
      px(g, 5, 4, 3, 8, '#caa066'); px(g, 5, 4, 3, 1, '#e0c089')
      if (key === 'ui_sound') {
        px(g, 10, 5, 1, 6, '#7cae4e'); px(g, 12, 4, 1, 8, '#7cae4e')
      } else {
        px(g, 10, 5, 1, 1, '#c64a3a'); px(g, 11, 6, 1, 1, '#c64a3a'); px(g, 12, 7, 1, 1, '#c64a3a')
        px(g, 12, 5, 1, 1, '#c64a3a'); px(g, 11, 6, 1, 1, '#c64a3a'); px(g, 10, 7, 1, 1, '#c64a3a')
      }
      break
    }
    case 'ui_music':
      px(g, 9, 2, 2, 8, '#5a4a6a'); px(g, 9, 2, 4, 2, '#5a4a6a') // stem + flag
      px(g, 4, 9, 4, 3, '#7a6a8a'); px(g, 4, 9, 4, 1, '#9a8aaa') // note head
      break
    case 'ui_trash':
      px(g, 4, 5, 8, 8, '#9aa0ac'); px(g, 4, 5, 8, 1, '#c2c6cf')
      for (let i = 6; i < 12; i += 2) px(g, i, 6, 1, 6, '#6e727c')
      px(g, 3, 3, 10, 2, '#6e727c'); px(g, 6, 2, 4, 1, '#8b8f99') // lid + handle
      break
    case 'ui_settings':
      px(g, 6, 2, 4, 12, '#8a8f9a')
      px(g, 2, 6, 12, 4, '#8a8f9a')
      px(g, 4, 4, 8, 8, '#c2c6cf')
      px(g, 6, 6, 4, 4, '#5a606b')
      px(g, 7, 7, 2, 2, '#dfe3ec')
      break
    case 'ui_wheat':
      for (const [x, hy] of [[5, 3], [9, 3]] as [number, number][]) {
        px(g, x, hy + 3, 1, 8, '#caa24a')
        px(g, x - 1, hy, 3, 5, '#e8c14a'); px(g, x - 1, hy, 1, 5, '#b9892f'); px(g, x + 1, hy, 1, 5, '#b9892f')
        dot(g, x, hy + 1, '#f6e08a'); px(g, x, hy - 2, 1, 2, '#e8d27a')
      }
      break
    default:
      px(g, 4, 4, 8, 8, '#cccccc')
  }
  return c
}

const UI_ICONS = new Set([
  'ui_coin', 'ui_bolt', 'ui_hammer', 'ui_target', 'ui_basket', 'ui_sprout',
  'ui_receipt', 'ui_pan', 'ui_bed', 'ui_fire', 'ui_save', 'ui_sound',
  'ui_mute', 'ui_music', 'ui_trash', 'ui_settings', 'ui_wheat',
])

const iconCache = new Map<string, string>()

export function iconURL(key: string, color?: string): string {
  const ck = `${key}|${color ?? ''}`
  const hit = iconCache.get(ck)
  if (hit) return hit
  let canvas: HTMLCanvasElement
  if (UI_ICONS.has(key)) {
    canvas = bakeUIIcon(key)
  } else if (['hoe', 'watering_can', 'axe', 'pickaxe', 'scythe', 'sword', 'hand', 'backpack'].includes(key)) {
    canvas = bakeToolIcon(key)
  } else {
    canvas = bakeItemIcon(key, color)
  }
  const url = canvas.toDataURL()
  iconCache.set(ck, url)
  return url
}
