import { useEffect, useRef, useState } from 'react'
import { getStore, type Stroke } from '../store'

// The cute 5-colour palette. Eraser paints the paper colour (#FFFFFF).
const PALETTE = [
  { name: 'Red', color: '#FF8FA3' },
  { name: 'Blue', color: '#8FB8FF' },
  { name: 'Green', color: '#8FE3B0' },
  { name: 'Yellow', color: '#FFD86B' },
  { name: 'Black', color: '#3D3A4B' },
]
const PEN_SIZE = 4
const ERASER_SIZE = 26

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

export default function DoodleBoard() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen')
  const [color, setColor] = useState(PALETTE[0].color)
  const toolRef = useRef(tool)
  const colorRef = useRef(color)
  toolRef.current = tool
  colorRef.current = color

  const store = getStore()

  // Set up the canvas backing store to match its CSS size (crisp on retina),
  // and connect the realtime doodle channel.
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

  function pointFromEvent(e: React.PointerEvent) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function onDown(e: React.PointerEvent) {
    e.preventDefault()
    canvasRef.current!.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = pointFromEvent(e)
    // A dot for a single tap.
    const p = last.current
    const s: Stroke = {
      x0: p.x,
      y0: p.y,
      x1: p.x,
      y1: p.y,
      color: toolRef.current === 'eraser' ? '#FFFFFF' : colorRef.current,
      size: toolRef.current === 'eraser' ? ERASER_SIZE : PEN_SIZE,
    }
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
      const s: Stroke = {
        x0: last.current.x,
        y0: last.current.y,
        x1: x,
        y1: y,
        color: toolRef.current === 'eraser' ? '#FFFFFF' : colorRef.current,
        size: toolRef.current === 'eraser' ? ERASER_SIZE : PEN_SIZE,
      }
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

  return (
    <div className="flex h-full w-full flex-col gap-3">
      {/* Floating toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-[20px] bg-white/80 px-3 py-2 shadow-[0_6px_20px_rgba(180,160,200,0.18)] backdrop-blur">
        <button
          onClick={() => setTool('pen')}
          className={`rounded-2xl px-3 py-1.5 text-sm font-extrabold transition ${
            tool === 'pen'
              ? 'bg-[#FFD1DC] text-[#7A4A56] shadow-inner'
              : 'bg-[#FDFBF7] text-[#9a92a8] hover:bg-[#F3EFEA]'
          }`}
        >
          ✏️ Pen
        </button>
        <button
          onClick={() => setTool('eraser')}
          className={`rounded-2xl px-3 py-1.5 text-sm font-extrabold transition ${
            tool === 'eraser'
              ? 'bg-[#B9F2E5] text-[#356055] shadow-inner'
              : 'bg-[#FDFBF7] text-[#9a92a8] hover:bg-[#F3EFEA]'
          }`}
        >
          🧽 Eraser
        </button>

        <span className="mx-1 h-6 w-px bg-black/10" />

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
                color === p.color && tool === 'pen'
                  ? 'ring-2 ring-offset-2 ring-[#c9a9d6] scale-110'
                  : 'hover:scale-110'
              }`}
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>

        <span className="mx-1 h-6 w-px bg-black/10" />

        <button
          onClick={clearAll}
          className="rounded-2xl bg-[#FFF2B2] px-3 py-1.5 text-sm font-extrabold text-[#8a7530] transition hover:brightness-95"
        >
          🧹 Clear All
        </button>
      </div>

      {/* Sketch paper */}
      <div className="relative flex-1 overflow-hidden rounded-[24px] bg-white shadow-[0_10px_30px_rgba(180,160,200,0.22)] ring-1 ring-[#efe7de]">
        {/* faint paper lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(#f4f0ea, #f4f0ea 1px, transparent 1px, transparent 28px)',
          }}
        />
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="relative h-full w-full touch-none"
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
        />
        <div className="pointer-events-none absolute bottom-3 right-4 text-xs font-bold text-[#cbb8c8]">
          ✍️ 함께 그려요
        </div>
      </div>
    </div>
  )
}
