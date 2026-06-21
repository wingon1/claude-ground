import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generatePuzzle, rectArea, validateSolution, type Puzzle, type Rect } from './engine'
import { TIERS, type TierId } from './levels'
import { TIME_ATTACK, scoreForRect } from './timeattack/config'
import { playClear, playError, playStep, playTap } from './audio'
import Board, { type Tool } from './Board'
import { BackIcon, EraserIcon, UndoIcon } from './icons'

export type TimeAttackResult = {
  tier: TierId
  score: number
  comboMax: number
  solvedCount: number
}

type Props = {
  tier: TierId
  patterns: boolean
  onQuit: () => void
  onGameOver: (r: TimeAttackResult) => void
}

const randSeed = () => Math.floor(Math.random() * 0x7fffffff)

export default function TimeAttack({ tier, patterns, onQuit, onGameOver }: Props) {
  const { rows, cols } = TIERS[tier]

  const [puzzle, setPuzzle] = useState<Puzzle>(() => generatePuzzle(rows, cols, randSeed()))
  const [rects, setRects] = useState<Rect[]>([])
  const [tool, setTool] = useState<Tool>('draw')

  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [solvedCount, setSolvedCount] = useState(0)
  const [msLeft, setMsLeft] = useState(TIME_ATTACK.durationSec * 1000)
  const [flash, setFlash] = useState(0) // bumps to retrigger combo pop animation

  // Refs mirror state so event handlers always read fresh values.
  const rectsRef = useRef<Rect[]>([])
  const scoreRef = useRef(0)
  const comboRef = useRef(0)
  const comboMaxRef = useRef(0)
  const solvedRef = useRef(0)
  const overRef = useRef(false)
  const comboTimer = useRef<number | undefined>(undefined)

  const newBoard = useCallback(() => {
    rectsRef.current = []
    setRects([])
    setPuzzle(generatePuzzle(rows, cols, randSeed()))
  }, [rows, cols])

  const clearComboTimer = () => {
    if (comboTimer.current) window.clearTimeout(comboTimer.current)
    comboTimer.current = undefined
  }
  const breakCombo = useCallback(() => {
    clearComboTimer()
    comboRef.current = 0
    setCombo(0)
  }, [])
  const armComboTimer = useCallback(() => {
    clearComboTimer()
    comboTimer.current = window.setTimeout(() => {
      comboRef.current = 0
      setCombo(0)
    }, TIME_ATTACK.comboWindowSec * 1000)
  }, [])

  // ---- Countdown ----
  useEffect(() => {
    const end = Date.now() + TIME_ATTACK.durationSec * 1000
    const id = window.setInterval(() => {
      const left = end - Date.now()
      if (left <= 0) {
        setMsLeft(0)
        window.clearInterval(id)
        clearComboTimer()
        if (!overRef.current) {
          overRef.current = true
          onGameOver({
            tier,
            score: scoreRef.current,
            comboMax: comboMaxRef.current,
            solvedCount: solvedRef.current,
          })
        }
      } else {
        setMsLeft(left)
      }
    }, 100)
    return () => {
      window.clearInterval(id)
      clearComboTimer()
    }
  }, [tier, onGameOver])

  // ---- Board callbacks ----
  const onCommit = useCallback(
    (rect: Rect) => {
      if (overRef.current) return
      const prevCombo = comboRef.current
      const gained = scoreForRect(rectArea(rect), prevCombo)
      scoreRef.current += gained
      comboRef.current = prevCombo + 1
      comboMaxRef.current = Math.max(comboMaxRef.current, comboRef.current)
      setScore(scoreRef.current)
      setCombo(comboRef.current)
      setFlash((f) => f + 1)
      playStep(Math.min(comboRef.current, 7))
      armComboTimer()

      const next = [...rectsRef.current, rect]
      rectsRef.current = next
      setRects(next)

      if (validateSolution(puzzle, next).solved) {
        scoreRef.current += TIME_ATTACK.points.boardClearBonus
        solvedRef.current += 1
        setScore(scoreRef.current)
        setSolvedCount(solvedRef.current)
        playClear()
        newBoard()
      }
    },
    [puzzle, armComboTimer, newBoard],
  )

  const onErase = useCallback(
    (index: number) => {
      if (overRef.current) return
      playTap()
      breakCombo()
      const next = rectsRef.current.filter((_, i) => i !== index)
      rectsRef.current = next
      setRects(next)
    },
    [breakCombo],
  )

  const onUndo = useCallback(() => {
    if (rectsRef.current.length === 0) return
    playError()
    breakCombo()
    const next = rectsRef.current.slice(0, -1)
    rectsRef.current = next
    setRects(next)
  }, [breakCombo])

  const seconds = Math.ceil(msLeft / 1000)
  const frac = msLeft / (TIME_ATTACK.durationSec * 1000)
  const low = seconds <= 10
  const mult = useMemo(() => (1 + combo * TIME_ATTACK.comboStep).toFixed(1), [combo])

  return (
    <div className="sk-app">
      <div className="sk-header">
        <button className="sk-iconbtn" onClick={onQuit} aria-label="나가기">
          <BackIcon size={22} />
        </button>
        <span className="sk-title">⚡ 타임어택 · {TIERS[tier].label}</span>
        <span style={{ width: 42 }} />
      </div>

      {/* HUD */}
      <div className="sk-ta-hud">
        <div className={`sk-ta-timerbar${low ? ' low' : ''}`}>
          <div className="sk-ta-timerfill" style={{ width: `${Math.max(0, frac) * 100}%` }} />
          <span className="sk-ta-timertext">{seconds}초</span>
        </div>
        <div className="sk-ta-stats">
          <div className="sk-ta-score" key={`score-${flash}`}>
            {score.toLocaleString()}
          </div>
          {combo >= 2 ? (
            <div className="sk-ta-combo" key={`combo-${flash}`}>
              🔥 {combo} COMBO <small>x{mult}</small>
            </div>
          ) : (
            <div className="sk-ta-combo dim">
              {solvedCount}판 클리어
            </div>
          )}
        </div>
      </div>

      <div className="sk-board-area">
        <Board
          puzzle={puzzle}
          rects={rects}
          tool={tool}
          hintRect={null}
          patterns={patterns}
          onCommit={onCommit}
          onErase={onErase}
        />
      </div>

      {/* Minimal toolbar: undo + eraser only */}
      <div className="sk-toolbar">
        <button
          className={`sk-tool${tool === 'eraser' ? ' active' : ''}`}
          onClick={() => {
            playTap()
            setTool((t) => (t === 'eraser' ? 'draw' : 'eraser'))
          }}
          aria-label="지우개"
        >
          <EraserIcon size={22} />
          <span className="sk-tool-label">지우개</span>
        </button>
        <button className="sk-tool" onClick={onUndo} disabled={rects.length === 0} aria-label="되돌리기">
          <UndoIcon size={22} />
          <span className="sk-tool-label">되돌리기</span>
        </button>
      </div>
    </div>
  )
}
