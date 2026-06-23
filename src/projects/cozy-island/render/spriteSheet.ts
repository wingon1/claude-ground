import manifestJson from '../assets/spritesheet.json'
import spriteSheetUrl from '../assets/spritesheet.png'

export type SpriteAnchor = 'foot' | 'center' | 'topLeft'

export type SpriteFrame = {
  x: number
  y: number
  w: number
  h: number
  anchor: SpriteAnchor
  scale: number
  tags?: string[]
}

export type SpriteManifest = {
  image: string
  tile: number
  sprites: Record<string, SpriteFrame>
}

const manifest = manifestJson as SpriteManifest

let sheet: HTMLImageElement | null = null
let loadStarted = false
let loadError = false
const missing = new Set<string>()

export function getSpriteManifest(): SpriteManifest {
  return manifest
}

export function hasSprite(id: string): boolean {
  return !!manifest.sprites[id]
}

export function preloadSpriteSheet(): void {
  if (loadStarted || sheet) return
  loadStarted = true
  const img = new Image()
  img.src = spriteSheetUrl
  img.onload = () => { sheet = img }
  img.onerror = () => { loadError = true }
}

export function spriteSheetReady(): boolean {
  return !!sheet && !loadError
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  opts: { scale?: number; flipX?: boolean; alpha?: number } = {},
): boolean {
  const frame = manifest.sprites[id]
  if (!frame) {
    warnMissing(id)
    return false
  }
  preloadSpriteSheet()
  if (!sheet) return loadError ? false : true

  const scale = opts.scale ?? frame.scale ?? 1
  const dw = frame.w * scale
  const dh = frame.h * scale
  let dx = x
  let dy = y
  if (frame.anchor === 'foot') {
    dx -= dw / 2
    dy -= dh
  } else if (frame.anchor === 'center') {
    dx -= dw / 2
    dy -= dh / 2
  }

  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.globalAlpha *= opts.alpha ?? 1
  if (opts.flipX) {
    ctx.translate(Math.round(dx + dw), Math.round(dy))
    ctx.scale(-1, 1)
    ctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h, 0, 0, Math.round(dw), Math.round(dh))
  } else {
    ctx.drawImage(sheet, frame.x, frame.y, frame.w, frame.h, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh))
  }
  ctx.restore()
  return true
}

function warnMissing(id: string) {
  if (missing.has(id)) return
  missing.add(id)
  console.warn(`[cozy-island] missing sprite "${id}". Add it to assets/spritesheet.png and assets/spritesheet.json before using it.`)
}
