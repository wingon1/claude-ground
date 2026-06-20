import { useMemo, useRef, useState } from 'react'
import {
  cluesInRect,
  normalizeRect,
  rectArea,
  rectContainsCell,
  rectsOverlap,
  type Clue,
  type Puzzle,
  type Rect,
} from './engine'
import { MONO_PATTERNS } from './themes'
import { playError, playStep, playTock } from './audio'

export type Tool = 'draw' | 'eraser'

type Props = {
  puzzle: Puzzle
  rects: Rect[]
  tool: Tool
  hintRect: Rect | null
  patterns: boolean
  /** committed rect count → used for marimba step pitch */
  onCommit: (rect: Rect) => void
  onErase: (index: number) => void
}

type Cell = { r: number; c: number }

function blockFill(index: number, patterns: boolean): React.CSSProperties {
  if (patterns) {
    return {
      backgroundColor: '#FFFFFF',
      backgroundImage: MONO_PATTERNS[index % MONO_PATTERNS.length],
    }
  }
  return { backgroundColor: `var(--block-${index % 5})` }
}

export default function Board({ puzzle, rects, tool, hintRect, patterns, onCommit, onErase }: Props) {
  const { rows, cols, clues } = puzzle
  const boardRef = useRef<HTMLDivElement>(null)
  const [anchor, setAnchor] = useState<Cell | null>(null)
  const [cursor, setCursor] = useState<Cell | null>(null)
  const [pendingErase, setPendingErase] = useState<number | null>(null)
  const [shakeKey, setShakeKey] = useState(0)

  // Map "r,c" -> clue for quick lookup, and which clue cells are covered.
  const clueAt = useMemo(() => {
    const m = new Map<string, Clue>()
    for (const cl of clues) m.set(`${cl.r},${cl.c}`, cl)
    return m
  }, [clues])

  const coveredClues = useMemo(() => {
    const s = new Set<string>()
    for (const cl of clues) {
      if (rects.some((rect) => rectContainsCell(rect, cl.r, cl.c))) s.add(`${cl.r},${cl.c}`)
    }
    return s
  }, [clues, rects])

  const preview = anchor && cursor ? normalizeRect(anchor, cursor) : null

  const overlapsCommitted = (rect: Rect) => rects.some((r) => rectsOverlap(r, rect))
  const previewInvalid = preview
    ? cluesInRect(preview, clues).length > 1 || overlapsCommitted(preview)
    : false

  const cellFromEvent = (e: React.PointerEvent): Cell | null => {
    const el = boardRef.current
    if (!el) return null
    const box = el.getBoundingClientRect()
    const gap = parseFloat(getComputedStyle(el).columnGap || '0') || 0
    const cellW = (box.width - gap * (cols - 1)) / cols
    const cellH = (box.height - gap * (rows - 1)) / rows
    const x = e.clientX - box.left
    const y = e.clientY - box.top
    let c = Math.floor(x / (cellW + gap))
    let r = Math.floor(y / (cellH + gap))
    c = Math.max(0, Math.min(cols - 1, c))
    r = Math.max(0, Math.min(rows - 1, r))
    return { r, c }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const cell = cellFromEvent(e)
    if (!cell) return
    boardRef.current?.setPointerCapture(e.pointerId)

    // Tapping an already-filled cell erases that block — in any tool mode.
    const idx = rects.findIndex((r) => rectContainsCell(r, cell.r, cell.c))
    if (idx >= 0) {
      setPendingErase(idx)
      return // no draw anchor → no preview/error on a block tap
    }

    if (tool === 'eraser') return // empty cell + eraser: nothing to do
    setAnchor(cell)
    setCursor(cell)
    playTock()
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const cell = cellFromEvent(e)
    if (!cell) return
    // Dragging off the pressed block cancels the pending erase.
    if (pendingErase !== null) {
      if (!rectContainsCell(rects[pendingErase], cell.r, cell.c)) setPendingErase(null)
      return
    }
    if (!anchor) return
    setCursor((prev) => {
      if (prev && prev.r === cell.r && prev.c === cell.c) return prev
      playTock()
      return cell
    })
  }

  const finish = () => {
    if (preview) {
      const cs = cluesInRect(preview, clues)
      const area = rectArea(preview)
      const valid = cs.length === 1 && area === cs[0].value && !overlapsCommitted(preview)
      if (valid) {
        onCommit(preview)
        playStep(rects.length)
      } else if (area > 1 || cs.length > 1) {
        // A real (mis-sized / multi-clue / overlapping) attempt — give feedback.
        if (cs.length !== 0 || overlapsCommitted(preview)) {
          playError()
          setShakeKey((k) => k + 1)
        }
      }
    }
    setAnchor(null)
    setCursor(null)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    boardRef.current?.releasePointerCapture?.(e.pointerId)
    if (pendingErase !== null) {
      onErase(pendingErase)
      setPendingErase(null)
      return
    }
    finish()
  }

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    aspectRatio: `${cols} / ${rows}`,
  }

  return (
    <div
      ref={boardRef}
      className="sk-board"
      style={gridStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Base cells with clue numbers */}
      {Array.from({ length: rows * cols }, (_, i) => {
        const r = Math.floor(i / cols)
        const c = i % cols
        const cl = clueAt.get(`${r},${c}`)
        const covered = cl && coveredClues.has(`${r},${c}`)
        return (
          <div key={`cell-${i}`} className="sk-cell" style={{ gridColumn: c + 1, gridRow: r + 1 }}>
            {cl && <span className={`sk-clue${covered ? ' sk-block-clue' : ''}`}>{cl.value}</span>}
          </div>
        )
      })}

      {/* Committed blocks */}
      {rects.map((rect, i) => (
        <div
          key={`block-${i}`}
          className="sk-overlay sk-block erasable"
          style={{
            gridColumn: `${rect.c0 + 1} / span ${rect.c1 - rect.c0 + 1}`,
            gridRow: `${rect.r0 + 1} / span ${rect.r1 - rect.r0 + 1}`,
            ...blockFill(i, patterns),
          }}
        />
      ))}

      {/* Drag preview */}
      {preview && (
        <div
          key={`preview-${shakeKey}`}
          className={`sk-overlay sk-preview${previewInvalid ? ' invalid' : ''}`}
          style={{
            gridColumn: `${preview.c0 + 1} / span ${preview.c1 - preview.c0 + 1}`,
            gridRow: `${preview.r0 + 1} / span ${preview.r1 - preview.r0 + 1}`,
            ...(previewInvalid ? {} : blockFill(rects.length, patterns)),
          }}
        />
      )}

      {/* Hint perimeter */}
      {hintRect && (
        <div
          className="sk-overlay sk-hint"
          style={{
            gridColumn: `${hintRect.c0 + 1} / span ${hintRect.c1 - hintRect.c0 + 1}`,
            gridRow: `${hintRect.r0 + 1} / span ${hintRect.r1 - hintRect.r0 + 1}`,
          }}
        />
      )}
    </div>
  )
}
