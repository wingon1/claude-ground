import { useEffect, useRef, useState } from 'react'
import type { RoomStore, Stroke } from '../store'
import { useIsMobile } from '../useIsMobile'
import Cursors from './Cursors'

// The cute 5-colour palette.
const PALETTE = [
  { name: 'Red', color: '#FF8FA3' },
  { name: 'Blue', color: '#8FB8FF' },
  { name: 'Green', color: '#8FE3B0' },
  { name: 'Yellow', color: '#FFD86B' },
  { name: 'Black', color: '#3D3A4B' },
]
// Stroke thickness as a FRACTION of the reference width, so lines scale with the
// canvas and everyone sees the same relative thickness (small mobile pad or PC).
const PEN_FRAC = 0.004
const ERASER_FRAC = 0.052
const SNAPSHOT_DELAY = 1200 // ms after drawing settles before persisting

// Strokes live in a shared PC-proportioned logical rectangle (0..1 in both
// axes, aspect = REF_ASPECT). Each device maps that rectangle onto its canvas
// with a "contain" fit (centred, aspect-preserved), so a drawing keeps the same
// shape & composition everywhere — on a tall phone it appears as a centred band
// instead of being stretched. PC is effectively the reference.
const REF_ASPECT = 16 / 9
const REF_SNAP_W = 1000
const REF_SNAP_H = Math.round(REF_SNAP_W / REF_ASPECT)

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** The centred, aspect-preserved rectangle (CSS px) the logical square maps to. */
function fitRect(cw: number, ch: number) {
  let fw: number, fh: number
  if (cw / ch > REF_ASPECT) {
    fh = ch
    fw = ch * REF_ASPECT
  } else {
    fw = cw
    fh = cw / REF_ASPECT
  }
  return { ox: (cw - fw) / 2, oy: (ch - fh) / 2, fw, fh }
}

type Tool = 'select' | 'pen' | 'eraser'

/**
 * Everyone draws in the same 16:9 space so shapes & thickness stay identical: on
 * desktop the whole app is a fixed 16:9 stage and the canvas fills it; on mobile
 * a post-it opens a 16:9 panel. Stroke coordinates and thickness are
 * stored relative to that reference rectangle, broadcast live, and periodically
 * snapshotted so late joiners see the current picture. On resize the drawing is
 * repainted from stored strokes (vectors) rather than stretching the bitmap, so
 * it stays crisp. On desktop the "조작"(select) tool lets pointer events pass
 * through to the planner.
 */
type Props = { store: RoomStore; meId: string; nick: string; color: string }

export default function DoodleBoard({ store, meId, nick, color: myColor }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Kept so we can re-render crisply (as vectors) on resize instead of stretching
  // the old bitmap (which blurs). snapshotImg is the pre-join base layer.
  const strokesRef = useRef<Stroke[]>([])
  const snapshotImgRef = useRef<HTMLImageElement | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState(PALETTE[0].color)
  const isMobile = useIsMobile()
  // On mobile the board is a post-it that opens a drawing panel; on desktop the
  // canvas covers the whole screen. The canvas only exists when it should show.
  const [open, setOpen] = useState(false)
  const showCanvas = !isMobile || open
  const toolRef = useRef(tool)
  const colorRef = useRef(color)
  useEffect(() => {
    toolRef.current = tool
    colorRef.current = color
  }, [tool, color])

  // Draw a normalized stroke onto the canvas (CSS-pixel coordinate space).
  function draw(s: Stroke) {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    const f = fitRect(rect.width, rect.height)
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.size * f.fw // s.size is a fraction of the reference width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(f.ox + s.x0 * f.fw, f.oy + s.y0 * f.fh)
    ctx.lineTo(f.ox + s.x1 * f.fw, f.oy + s.y1 * f.fh)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }

  function clearLocal() {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }

  // Redraw everything at the current resolution: the snapshot base, then every
  // stroke as a vector. Called after a resize so lines stay crisp.
  function repaint() {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    clearLocal()
    const img = snapshotImgRef.current
    if (img) {
      const rect = canvas.getBoundingClientRect()
      const f = fitRect(rect.width, rect.height)
      ctx.drawImage(img, f.ox, f.oy, f.fw, f.fh)
    }
    for (const s of strokesRef.current) draw(s)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctxRef.current = ctx
    // Fresh render surface: rebuild from the snapshot + live strokes.
    strokesRef.current = []
    snapshotImgRef.current = null

    // Resize the backing store to the element, then repaint everything as
    // vectors at the new resolution (crisp, no bitmap stretching / blur).
    const fit = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(rect.width * dpr))
      const h = Math.max(1, Math.round(rect.height * dpr))
      if (w === canvas.width && h === canvas.height) return
      canvas.width = w
      canvas.height = h
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      repaint()
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)

    const loadSnapshot = (dataUrl: string): Promise<void> =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          snapshotImgRef.current = img
          repaint()
          resolve()
        }
        img.onerror = () => resolve()
        img.src = dataUrl
      })

    let cancelled = false
    let disconnect = () => {}
    ;(async () => {
      // Show the existing drawing first, then start receiving live strokes.
      const snap = await store.loadSnapshot().catch(() => null)
      if (cancelled) return
      if (snap) await loadSnapshot(snap)
      if (cancelled) return
      disconnect = store.connectDoodle(
        (s) => {
          draw(s)
          strokesRef.current.push(s)
        },
        () => {
          strokesRef.current = []
          snapshotImgRef.current = null
          clearLocal()
        },
      )
    })()

    return () => {
      cancelled = true
      ro.disconnect()
      disconnect()
      if (snapTimer.current) clearTimeout(snapTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, showCanvas])

  function strokeFrom(x0: number, y0: number, x1: number, y1: number): Stroke {
    const erase = toolRef.current === 'eraser'
    return {
      x0,
      y0,
      x1,
      y1,
      color: erase ? '#000' : colorRef.current,
      size: erase ? ERASER_FRAC : PEN_FRAC,
      erase,
    }
  }

  function norm(e: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const f = fitRect(rect.width, rect.height)
    return {
      x: clamp01((e.clientX - rect.left - f.ox) / f.fw),
      y: clamp01((e.clientY - rect.top - f.oy) / f.fh),
    }
  }

  // Persist a downscaled PNG snapshot a moment after drawing settles.
  function scheduleSnapshot() {
    if (snapTimer.current) clearTimeout(snapTimer.current)
    snapTimer.current = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      // Capture only the logical rectangle, normalized to the reference size, so
      // the snapshot is device-independent (loads back into any device's fit rect).
      const rect = canvas.getBoundingClientRect()
      const dpr = rect.width ? canvas.width / rect.width : 1
      const f = fitRect(rect.width, rect.height)
      const tmp = document.createElement('canvas')
      tmp.width = REF_SNAP_W
      tmp.height = REF_SNAP_H
      tmp
        .getContext('2d')!
        .drawImage(
          canvas,
          f.ox * dpr,
          f.oy * dpr,
          f.fw * dpr,
          f.fh * dpr,
          0,
          0,
          REF_SNAP_W,
          REF_SNAP_H,
        )
      store.saveSnapshot(tmp.toDataURL('image/png')).catch(() => {})
    }, SNAPSHOT_DELAY)
  }

  function onDown(e: React.PointerEvent) {
    if (toolRef.current === 'select') return
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)
    drawing.current = true
    const p = norm(e)
    last.current = p
    const s = strokeFrom(p.x, p.y, p.x, p.y) // a dot for a single tap
    draw(s)
    strokesRef.current.push(s)
    store.sendStroke(s)
  }

  function onMove(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return
    const events =
      'getCoalescedEvents' in e.nativeEvent
        ? (e.nativeEvent.getCoalescedEvents() as PointerEvent[])
        : [e.nativeEvent]
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const p = norm(ev)
      const s = strokeFrom(last.current.x, last.current.y, p.x, p.y)
      draw(s)
      strokesRef.current.push(s)
      store.sendStroke(s)
      last.current = p
    }
  }

  function onUp(e: React.PointerEvent) {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    try {
      canvasRef.current!.releasePointerCapture(e.pointerId)
    } catch {
      /* pointer already released */
    }
    scheduleSnapshot()
  }

  // Temporarily disabled per request.
  // function clearAll() {
  //   clearLocal()
  //   store.sendClear()
  //   scheduleSnapshot()
  // }

  const pill = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-2xl px-2.5 py-1.5 text-sm font-extrabold transition sm:px-3 ${
      active
        ? 'bg-[#FFD1DC] text-[#7A4A56] shadow-[0_2px_6px_rgba(200,120,150,0.35)]'
        : 'text-[#9a92a8] hover:bg-black/5'
    }`

  // Tool buttons + palette, shared by the desktop toolbar and the mobile panel.
  // `withSelect` shows the "조작"(pass-through) tool — only useful on desktop.
  const toolbarContent = (withSelect: boolean) => (
    <>
      {withSelect && (
        <button
          onClick={() => setTool('select')}
          title="달력·장소를 누를 수 있어요 (그림은 안 그려짐)"
          className={pill(tool === 'select')}
        >
          ✋ 조작
        </button>
      )}
      <button onClick={() => setTool('pen')} title="펜으로 그려요" className={pill(tool === 'pen')}>
        ✏️ 그리기
      </button>
      <button
        onClick={() => setTool('eraser')}
        title="그린 걸 지워요"
        className={pill(tool === 'eraser')}
      >
        🧽 지우개
      </button>

      <span className="mx-0.5 h-6 w-px shrink-0 bg-black/10" />

      <div className="flex shrink-0 items-center gap-1.5">
        {PALETTE.map((p) => (
          <button
            key={p.color}
            title={p.name}
            onClick={() => {
              setColor(p.color)
              setTool('pen')
            }}
            className={`h-7 w-7 shrink-0 rounded-full transition ${
              color === p.color && tool !== 'eraser'
                ? 'scale-110 ring-2 ring-[#c9a9d6] ring-offset-2 ring-offset-white'
                : 'hover:scale-110'
            }`}
            style={{ backgroundColor: p.color }}
          />
        ))}
      </div>
    </>
  )

  const canvasHandlers = {
    onPointerDown: onDown,
    onPointerMove: onMove,
    onPointerUp: onUp,
    onPointerCancel: onUp,
  }

  // --- Desktop: canvas fills the (already 16:9) app stage + floating toolbar ---
  if (!isMobile) {
    return (
      <>
        <canvas
          ref={canvasRef}
          {...canvasHandlers}
          className="absolute inset-0 z-20 h-full w-full touch-none"
          style={{
            pointerEvents: tool === 'select' ? 'none' : 'auto',
            cursor: tool === 'eraser' ? 'cell' : 'crosshair',
          }}
        />
        <Cursors store={store} meId={meId} nick={nick} color={myColor} />
        <div className="pointer-events-auto absolute left-1/2 top-16 z-30 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 flex-nowrap items-center gap-1.5 rounded-[22px] bg-white/85 px-3 py-2 shadow-[0_8px_24px_rgba(180,160,200,0.28)] backdrop-blur">
          {toolbarContent(true)}
        </div>
      </>
    )
  }

  // --- Mobile: a post-it launcher that opens a drawing panel ---
  return (
    <>
      {!open && (
        <button
          onClick={() => {
            setTool('pen')
            setOpen(true)
          }}
          aria-label="낙서장 열기"
          className="pointer-events-auto absolute bottom-5 left-3 z-40 flex -rotate-6 flex-col items-center rounded-xl bg-[#FFF2B2] px-3 pb-3 pt-4 shadow-[0_10px_22px_rgba(190,170,120,0.45)] transition active:scale-95"
        >
          <span className="absolute -top-2 left-1/2 h-4 w-10 -translate-x-1/2 rotate-2 rounded-sm bg-white/70" />
          <span className="text-2xl">🖍️</span>
          <span className="mt-0.5 text-[11px] font-extrabold text-[#8a7530]">낙서장</span>
        </button>
      )}

      {open && (
        <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col justify-end bg-black/30 backdrop-blur-sm">
          <div className="flex flex-col gap-3 rounded-t-[28px] bg-[#FDFBF7] p-4 pb-5 shadow-[0_-10px_40px_rgba(120,100,140,0.3)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#6b5b74]">🖍️ 함께 낙서해요</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-[#9a92a8] shadow-sm active:scale-95"
              >
                닫기 ✕
              </button>
            </div>

            {/* 16:9 sketch pad — matches the shared reference so it lines up with PC */}
            <div className="relative w-full overflow-hidden rounded-2xl bg-white shadow-inner" style={{ aspectRatio: '16 / 9' }}>
              <canvas
                ref={canvasRef}
                {...canvasHandlers}
                className="absolute inset-0 h-full w-full touch-none"
                style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
              />
              {/* Others' cursors, mapped to this 16:9 pad (only visible here) */}
              <Cursors store={store} meId={meId} nick={nick} color={myColor} />
            </div>

            <div className="flex flex-nowrap items-center justify-center gap-1.5 overflow-x-auto">
              {toolbarContent(false)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
