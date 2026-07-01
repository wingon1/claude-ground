import { useEffect, useRef, useState } from 'react'
import type { RoomStore, Stroke } from '../store'

// The cute 5-colour palette.
const PALETTE = [
  { name: 'Red', color: '#FF8FA3' },
  { name: 'Blue', color: '#8FB8FF' },
  { name: 'Green', color: '#8FE3B0' },
  { name: 'Yellow', color: '#FFD86B' },
  { name: 'Black', color: '#3D3A4B' },
]
const PEN_SIZE = 4
const ERASER_SIZE = 26
const SNAPSHOT_DELAY = 1200 // ms after drawing settles before persisting

type Tool = 'select' | 'pen' | 'eraser'

/**
 * A full-screen doodle layer: the canvas covers the whole app so you can draw
 * anywhere — over the calendar and venues included. Strokes are normalized
 * (0..1) so they line up across screen sizes, broadcast live, and periodically
 * snapshotted so late joiners see the current picture. When the "손"(select)
 * tool is active the canvas ignores pointer events so the planner stays usable.
 */
export default function DoodleBoard({ store }: { store: RoomStore }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState(PALETTE[0].color)
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
    ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over'
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(s.x0 * rect.width, s.y0 * rect.height)
    ctx.lineTo(s.x1 * rect.width, s.y1 * rect.height)
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

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctxRef.current = ctx

    // Resize the backing store to the element, preserving the current drawing
    // by stretching the old pixels onto the new size.
    function fit() {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.round(rect.width * dpr))
      const h = Math.max(1, Math.round(rect.height * dpr))
      if (w === canvas.width && h === canvas.height) return
      const prev = document.createElement('canvas')
      prev.width = canvas.width
      prev.height = canvas.height
      if (canvas.width && canvas.height) prev.getContext('2d')!.drawImage(canvas, 0, 0)
      canvas.width = w
      canvas.height = h
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (prev.width && prev.height)
        ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, rect.width, rect.height)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)

    const drawSnapshot = (dataUrl: string): Promise<void> =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          const rect = canvas.getBoundingClientRect()
          ctx.drawImage(img, 0, 0, rect.width, rect.height)
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
      if (snap) await drawSnapshot(snap)
      if (cancelled) return
      disconnect = store.connectDoodle(
        (s) => draw(s),
        () => clearLocal(),
      )
    })()

    return () => {
      cancelled = true
      ro.disconnect()
      disconnect()
      if (snapTimer.current) clearTimeout(snapTimer.current)
    }
  }, [store])

  function strokeFrom(x0: number, y0: number, x1: number, y1: number): Stroke {
    const erase = toolRef.current === 'eraser'
    return {
      x0,
      y0,
      x1,
      y1,
      color: erase ? '#000' : colorRef.current,
      size: erase ? ERASER_SIZE : PEN_SIZE,
      erase,
    }
  }

  function norm(e: { clientX: number; clientY: number }) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height }
  }

  // Persist a downscaled PNG snapshot a moment after drawing settles.
  function scheduleSnapshot() {
    if (snapTimer.current) clearTimeout(snapTimer.current)
    snapTimer.current = setTimeout(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      const scale = Math.min(1, 1000 / canvas.width)
      const tmp = document.createElement('canvas')
      tmp.width = Math.max(1, Math.round(canvas.width * scale))
      tmp.height = Math.max(1, Math.round(canvas.height * scale))
      tmp.getContext('2d')!.drawImage(canvas, 0, 0, tmp.width, tmp.height)
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

  return (
    <>
      {/* Full-screen drawing surface */}
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="absolute inset-0 z-20 h-full w-full touch-none"
        style={{
          pointerEvents: tool === 'select' ? 'none' : 'auto',
          cursor: tool === 'eraser' ? 'cell' : 'crosshair',
        }}
      />

      {/* Floating toolbar — single horizontal row (scrolls sideways if narrow),
          so the palette stays laid out horizontally on mobile too. */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 z-30 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-nowrap items-center gap-1 overflow-x-auto rounded-[22px] bg-white/85 px-2.5 py-2 shadow-[0_8px_24px_rgba(180,160,200,0.28)] backdrop-blur sm:max-w-[calc(100vw-1.5rem)] sm:gap-1.5 sm:px-3 sm:top-16 sm:bottom-auto">
        <button
          onClick={() => setTool('select')}
          title="달력·장소를 누를 수 있어요 (그림은 안 그려짐)"
          className={pill(tool === 'select')}
        >
          <span className="hidden sm:inline">✋ </span>조작
        </button>
        <button
          onClick={() => setTool('pen')}
          title="펜으로 그려요"
          className={pill(tool === 'pen')}
        >
          <span className="hidden sm:inline">✏️ </span>그리기
        </button>
        <button
          onClick={() => setTool('eraser')}
          title="그린 걸 지워요"
          className={pill(tool === 'eraser')}
        >
          <span className="hidden sm:inline">🧽 </span>지우개
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
              className={`h-6 w-6 shrink-0 rounded-full transition sm:h-7 sm:w-7 ${
                color === p.color && tool !== 'eraser'
                  ? 'scale-110 ring-2 ring-[#c9a9d6] ring-offset-2 ring-offset-white'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>

        {/* 전체지우기 — 당분간 비활성화 (요청)
        <span className="mx-0.5 h-6 w-px bg-black/10" />
        <button
          onClick={clearAll}
          className="rounded-2xl px-3 py-1.5 text-sm font-extrabold text-[#8a7530] transition hover:bg-[#FFF2B2]"
        >
          🧹 전체지우기
        </button>
        */}
      </div>
    </>
  )
}
