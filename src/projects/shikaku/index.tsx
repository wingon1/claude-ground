import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  rectContainsCell,
  solvePuzzle,
  validateSolution,
  type Puzzle,
  type Rect,
} from './engine'
import { getLevel, levelCount, TIERS, type TierId } from './levels'
import { THEMES, type ThemeId } from './themes'
import { loadState, saveState, type SaveState } from './store'
import { playClear, playCoins, playTap, primeAudio, setSoundEnabled } from './audio'
import { CSS, STYLE_ID } from './styles'
import Board, { type Tool } from './Board'
import Toolbar, { WAND_COST } from './Toolbar'
import Header from './Header'
import LevelSelect from './LevelSelect'
import ThemeStore from './ThemeStore'
import WinOverlay from './WinOverlay'
import Tutorial from './Tutorial'
import TimeAttack, { type TimeAttackResult } from './TimeAttack'
import GameOver from './GameOver'
import Leaderboard from './Leaderboard'
import { SkipIcon } from './icons'

type Screen = 'levels' | 'game' | 'timeattack'

function useInjectedStyles() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return
    const el = document.createElement('style')
    el.id = STYLE_ID
    el.textContent = CSS
    document.head.appendChild(el)
    // Leave the style mounted; it's harmless and shared if remounted.
  }, [])
}

export default function Shikaku() {
  useInjectedStyles()

  const [state, setState] = useState<SaveState>(() => loadState())
  const [screen, setScreen] = useState<Screen>('levels')
  const [activeTier, setActiveTier] = useState<TierId>('easy')
  const [levelIndex, setLevelIndex] = useState(0)

  const [rects, setRects] = useState<Rect[]>([])
  const [tool, setTool] = useState<Tool>('draw')
  const [hintRect, setHintRect] = useState<Rect | null>(null)
  const [storeOpen, setStoreOpen] = useState(false)
  const [win, setWin] = useState<{ reward: number } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Time-attack mode
  const [taTier, setTaTier] = useState<TierId>('easy')
  const [taKey, setTaKey] = useState(0) // bump to remount/restart a round
  const [gameOver, setGameOver] = useState<TimeAttackResult | null>(null)
  const [gameOverIsBest, setGameOverIsBest] = useState(false)
  const [ranking, setRanking] = useState<{ tier: TierId; highlight?: number } | null>(null)

  const theme = THEMES[state.activeTheme]
  const patterns = !!theme.patterns

  const puzzle: Puzzle = useMemo(
    () => getLevel(activeTier, levelIndex),
    [activeTier, levelIndex],
  )

  // Persist on every change.
  const update = useCallback((fn: (s: SaveState) => SaveState) => {
    setState((prev) => {
      const next = fn(prev)
      saveState(next)
      return next
    })
  }, [])

  useEffect(() => {
    setSoundEnabled(state.sound)
  }, [state.sound])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 1800)
  }, [])

  // ---- Level lifecycle ----
  const loadLevel = useCallback((tier: TierId, index: number) => {
    setActiveTier(tier)
    setLevelIndex(index)
    setRects([])
    setHintRect(null)
    setTool('draw')
    setWin(null)
    setScreen('game')
  }, [])

  const clueIndexOf = useCallback(
    (rect: Rect): number => puzzle.clues.findIndex((cl) => rectContainsCell(rect, cl.r, cl.c)),
    [puzzle],
  )

  const coveredClueCount = useMemo(
    () =>
      puzzle.clues.filter((cl) => rects.some((r) => rectContainsCell(r, cl.r, cl.c))).length,
    [puzzle, rects],
  )

  // ---- Win handling ----
  const handleSolved = useCallback(() => {
    const tier = activeTier
    const idx = levelIndex
    const alreadyCleared = state.progress[tier][idx]
    const reward = alreadyCleared ? 0 : TIERS[tier].reward
    update((s) => {
      const progress = { ...s.progress, [tier]: [...s.progress[tier]] }
      progress[tier][idx] = true
      return { ...s, progress, coins: s.coins + reward }
    })
    playClear()
    if (reward > 0) window.setTimeout(playCoins, 500)
    setWin({ reward })
  }, [activeTier, levelIndex, state.progress, update])

  const checkWin = useCallback(
    (nextRects: Rect[]) => {
      const res = validateSolution(puzzle, nextRects)
      if (res.solved) handleSolved()
    },
    [puzzle, handleSolved],
  )

  // ---- Board actions ----
  const onCommit = useCallback(
    (rect: Rect) => {
      setHintRect(null)
      setRects((prev) => {
        const next = [...prev, rect]
        checkWin(next)
        return next
      })
    },
    [checkWin],
  )

  const onErase = useCallback((index: number) => {
    playTap()
    setHintRect(null)
    setRects((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const onUndo = useCallback(() => {
    setHintRect(null)
    setRects((prev) => prev.slice(0, -1))
  }, [])

  const onToggleEraser = useCallback(() => {
    playTap()
    setTool((t) => (t === 'eraser' ? 'draw' : 'eraser'))
  }, [])

  // ---- Hint: outline one unsolved clue's correct rectangle ----
  const onHint = useCallback(() => {
    playTap()
    const fixed = new Map<number, Rect>()
    for (const rect of rects) {
      const idx = clueIndexOf(rect)
      if (idx >= 0) fixed.set(idx, rect)
    }
    const solution = solvePuzzle(puzzle, fixed)
    if (!solution) {
      showToast('여기선 풀 수 없어요. 되돌리기 해봐요!')
      return
    }
    // First unsolved clue index.
    const unsolved = puzzle.clues
      .map((_, i) => i)
      .filter((i) => !fixed.has(i))
    if (unsolved.length === 0) return
    const target = unsolved[0]
    const rect = solution.get(target)
    if (rect) {
      setHintRect(rect)
      window.setTimeout(() => setHintRect((h) => (h === rect ? null : h)), 2600)
    }
  }, [puzzle, rects, clueIndexOf, showToast])

  // ---- Magic Wand: solve & place the hardest remaining clue ----
  const onWand = useCallback(() => {
    if (state.coins < WAND_COST) {
      showToast('코인이 부족해요')
      return
    }
    const fixed = new Map<number, Rect>()
    for (const rect of rects) {
      const idx = clueIndexOf(rect)
      if (idx >= 0) fixed.set(idx, rect)
    }
    const solution = solvePuzzle(puzzle, fixed)
    if (!solution) {
      showToast('여기선 풀 수 없어요. 되돌리기 해봐요!')
      return
    }
    const unsolved = puzzle.clues
      .map((cl, i) => ({ i, cl }))
      .filter(({ i }) => !fixed.has(i))
    if (unsolved.length === 0) return
    // "Hardest" = largest clue value.
    unsolved.sort((a, b) => b.cl.value - a.cl.value)
    const target = unsolved[0].i
    const rect = solution.get(target)
    if (!rect) return
    playTap()
    update((s) => ({ ...s, coins: s.coins - WAND_COST }))
    setHintRect(null)
    setRects((prev) => {
      const next = [...prev, rect]
      checkWin(next)
      return next
    })
  }, [state.coins, puzzle, rects, clueIndexOf, update, checkWin, showToast])

  // ---- Theme store ----
  const onBuy = useCallback(
    (id: ThemeId) => {
      const t = THEMES[id]
      if (state.coins < t.cost || state.ownedThemes.includes(id)) return
      playCoins()
      update((s) => ({
        ...s,
        coins: s.coins - t.cost,
        ownedThemes: [...s.ownedThemes, id],
        activeTheme: id,
      }))
    },
    [state.coins, state.ownedThemes, update],
  )

  const onEquip = useCallback(
    (id: ThemeId) => {
      playTap()
      update((s) => ({ ...s, activeTheme: id }))
    },
    [update],
  )

  const onToggleSound = useCallback(() => {
    update((s) => {
      const sound = !s.sound
      setSoundEnabled(sound)
      return { ...s, sound }
    })
    playTap()
  }, [update])

  // ---- Navigation ----
  const hasNext = levelIndex + 1 < levelCount(activeTier)
  const goNext = useCallback(() => {
    if (hasNext) loadLevel(activeTier, levelIndex + 1)
    else setScreen('levels')
  }, [hasNext, activeTier, levelIndex, loadLevel])

  const onSkip = useCallback(() => {
    playTap()
    goNext()
  }, [goNext])

  const replay = useCallback(() => {
    setRects([])
    setHintRect(null)
    setTool('draw')
    setWin(null)
  }, [])

  // ---- Time-attack ----
  const startTimeAttack = useCallback((tier: TierId) => {
    playTap()
    setTaTier(tier)
    setGameOver(null)
    setTaKey((k) => k + 1)
    setScreen('timeattack')
  }, [])

  const onTimeAttackOver = useCallback(
    (result: TimeAttackResult) => {
      const prevBest = state.bestScores[result.tier] ?? 0
      const isBest = result.score > prevBest
      if (isBest) {
        update((s) => ({
          ...s,
          bestScores: { ...s.bestScores, [result.tier]: result.score },
        }))
      }
      setGameOverIsBest(isBest)
      setGameOver(result)
    },
    [state.bestScores, update],
  )

  // Prime audio on first interaction (mobile autoplay policy).
  const onFirstPointer = useCallback(() => primeAudio(), [])

  const rootStyle = theme.vars as React.CSSProperties
  const stageLabel = `${TIERS[activeTier].label} ${levelIndex + 1}단계`

  return (
    <div
      className={`shikaku-root${patterns ? ' theme-mono' : ''}`}
      style={rootStyle}
      onPointerDownCapture={onFirstPointer}
    >
      {screen === 'levels' && (
        <LevelSelect
          state={state}
          activeTier={activeTier}
          onSelectTier={setActiveTier}
          onPlay={loadLevel}
          onOpenStore={() => setStoreOpen(true)}
          onPlayTimeAttack={startTimeAttack}
          onOpenRanking={() => setRanking({ tier: activeTier })}
        />
      )}

      {screen === 'timeattack' && (
        <TimeAttack
          key={taKey}
          tier={taTier}
          patterns={patterns}
          onQuit={() => setScreen('levels')}
          onGameOver={onTimeAttackOver}
        />
      )}

      {screen === 'game' && (
        <div className="sk-app">
          <Header
            title={stageLabel}
            coins={state.coins}
            onBack={() => setScreen('levels')}
            onSettings={() => setStoreOpen(true)}
          />
          <div className="sk-subheader">
            <button className="sk-skip" onClick={onSkip}>
              {hasNext ? '건너뛰기' : '끝내기'}
              <SkipIcon size={15} />
            </button>
          </div>

          <div className="sk-board-area">
            <div className="sk-progresshint">
              {coveredClueCount} / {puzzle.clues.length} 사각형 완성했어요
            </div>
            <Board
              puzzle={puzzle}
              rects={rects}
              tool={tool}
              hintRect={hintRect}
              patterns={patterns}
              onCommit={onCommit}
              onErase={onErase}
            />
          </div>

          <Toolbar
            tool={tool}
            onToggleEraser={onToggleEraser}
            onUndo={onUndo}
            onHint={onHint}
            onWand={onWand}
            canUndo={rects.length > 0}
            canWand={state.coins >= WAND_COST && coveredClueCount < puzzle.clues.length}
          />
        </div>
      )}

      {storeOpen && (
        <ThemeStore
          state={state}
          onBuy={onBuy}
          onEquip={onEquip}
          onToggleSound={onToggleSound}
          onClose={() => setStoreOpen(false)}
        />
      )}

      {win && (
        <WinOverlay
          reward={win.reward}
          hasNext={hasNext}
          onNext={goNext}
          onReplay={replay}
          onMenu={() => {
            setWin(null)
            setScreen('levels')
          }}
        />
      )}

      {gameOver && (
        <GameOver
          result={gameOver}
          defaultNickname={state.nickname}
          deviceId={state.deviceId}
          isBest={gameOverIsBest}
          onSaveMeta={(nickname) => update((s) => ({ ...s, nickname }))}
          onReplay={() => startTimeAttack(gameOver.tier)}
          onMenu={() => {
            setGameOver(null)
            setScreen('levels')
          }}
          onViewRanking={() => setRanking({ tier: gameOver.tier, highlight: gameOver.score })}
        />
      )}

      {ranking && (
        <Leaderboard
          initialTier={ranking.tier}
          deviceId={state.deviceId}
          highlightScore={ranking.highlight}
          onClose={() => setRanking(null)}
        />
      )}

      {toast && <div className="sk-toast">{toast}</div>}

      {!state.tutorialSeen && (
        <Tutorial onClose={() => update((s) => ({ ...s, tutorialSeen: true }))} />
      )}
    </div>
  )
}
