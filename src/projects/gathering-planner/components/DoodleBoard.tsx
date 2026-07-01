import { useEffect, useRef, useState } from 'react'
import { getStore, type Stroke } from '../store'

// The cute 5-colour palette. Eraser paints the paper colour (#FDFBF7).
const PALETTE = [
  { name: 'Red', color: '#FF8FA3' },
  { name: 'Blue', color: '#8FB8FF' },
  { name: 'Green', color: '#8FE3B0' },
  { name: 'Yellow', color: '#FFD86B' },
  { name: 'Black', color: '#3D3A4B' },
]
const PEN_SIZE = 4
const ERASER_SIZE = 26

type Tool = 'select' | 'pen' | 'eraser'

function drawSegment(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.strokeStyle = s.color
  ctx.lineWidth = s.size
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(s.x0, s.y0)
  ctx.lineTo(s.x1, s.y1)
  ctx.stroke()
}

/**
 * A full-screen doodle layer: the canvas covers the whole app so you can draw
 * anywhere — over the calendar and venues included. The floating toolbar sits
 * above it. When the "select" tool is active the canvas ignores pointer events
 * so the planner underneath stays clickable.
 */
export default function DoodleBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [color, setColor] = useState(PALETTE[0].color)
  const toolRef = useRef(tool)
  const colorRef = useRef(color)
  toolRef.current = tool
  colorRef.current = color

  const store = getStore()

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctxRef.current = ctx

    function fit() {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(canvas)

    const disconnect = store.connectDoodle(
      (s) => drawSegment(ctx, s),
      () => clearLocal(),
    )
    return () => {
      ro.disconnect()
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function clearLocal() {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!canvas || !ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }

  function strokeStyleNow(x0: number, y0: number, x1: number, y1: number): Stroke {
    return {
      x0,
      y0,
      x1,
      y1,
      color: toolRef.current === 'eraser' ? '#FDFBF7' : colorRef.current,
      size: toolRef.current === 'eraser' ? ERASER_SIZE : PEN_SIZE,
    }
  }

  function onDown(e: React.PointerEvent) {
    if (toolRef.current === 'select') return
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)
    drawing.current = true
    const rect = canvasRef.current!.getBoundingClientRect()
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    last.current = p
    const s = strokeStyleNow(p.x, p.y, p.x, p.y) // a dot for a single tap
    drawSegment(ctxRef.current!, s)
    store.sendStroke(s)
  }

  function onMove(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return
    // getCoalescedEvents captures every sub-frame point so fast strokes stay
    // smooth without flooding — each segment is drawn locally and broadcast.
    const events =
      'getCoalescedEvents' in e.nativeEvent
        ? (e.nativeEvent.getCoalescedEvents() as PointerEvent[])
        : [e.nativeEvent]
    const rect = canvasRef.current!.getBoundingClientRect()
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const x = ev.clientX - rect.left
      const y = ev.clientY - rect.top
      const s = strokeStyleNow(last.current.x, last.current.y, x, y)
      drawSegment(ctxRef.current!, s)
      store.sendStroke(s)
      last.current = { x, y }
    }
  }

  function onUp(e: React.PointerEvent) {
    drawing.current = false
    last.current = null
    try {
      canvasRef.current!.releasePointerCapture(e.pointerId)
    } catch {
      /* pointer already released */
    }
  }

  function clearAll() {
    clearLocal()
    store.sendClear()
  }

  const pill = (active: boolean) =>
    `rounded-2xl px-3 py-1.5 text-sm font-extrabold transition ${
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

      {/* Floating toolbar (always above the canvas & planner) */}
      <div className="pointer-events-auto absolute bottom-5 left-1/2 z-30 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1.5 rounded-[22px] bg-white/85 px-3 py-2 shadow-[0_8px_24px_rgba(180,160,200,0.28)] backdrop-blur sm:bottom-auto sm:top-16">
        <button onClick={() => setTool('select')} className={pill(tool === 'select')}>
          👆 손
        </button>
        <button onClick={() => setTool('pen')} className={pill(tool === 'pen')}>
          ✏️ 펜
        </button>
        <button onClick={() => setTool('eraser')} className={pill(tool === 'eraser')}>
          🧽 지우개
        </button>

        <span className="mx-0.5 h-6 w-px bg-black/10" />

        <div className="flex items-center gap-1.5">
          {PALETTE.map((p) => (
            <button
              key={p.color}
              title={p.name}
              onClick={() => {
                setColor(p.color)
                setTool('pen')
              }}
              className={`h-7 w-7 rounded-full transition ${
                color === p.color && tool !== 'eraser'
                  ? 'scale-110 ring-2 ring-[#c9a9d6] ring-offset-2 ring-offset-white'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>

        <span className="mx-0.5 h-6 w-px bg-black/10" />

        <button
          onClick={clearAll}
          className="rounded-2xl px-3 py-1.5 text-sm font-extrabold text-[#8a7530] transition hover:bg-[#FFF2B2]"
        >
          🧹 전체지우기
        </button>
      </div>
    </>
  )
}
