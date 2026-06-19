import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type PointerEvent,
  type ReactNode,
  type SetStateAction,
} from 'react'
import {
  canPlaceCat,
  checkWin,
  coordKey,
  createBoard,
  getCats,
  getConflicts,
  isLocked,
  type Board,
  type CellState,
  type Coord,
  type Difficulty,
  type Level,
} from './gameLogic'
import { levels } from './levels'

type Mode = 'cat' | 'mark'
type Status = 'playing' | 'won' | 'lost'

type Snapshot = {
  board: Board
  hearts: number
  status: Status
}

type MarkDragState = {
  active: boolean
  pointerId: number | null
  start: Coord | null
  startX: number
  startY: number
  visited: Set<string>
}

type CellColor = {
  base: string
  light: string
  text: string
}

const REGION_COLORS: CellColor[] = [
  { base: '#f36f9e', light: '#ff9ec0', text: '#9b375e' },
  { base: '#ffd04a', light: '#ffe27a', text: '#9f7221' },
  { base: '#7fc8ed', light: '#aee0f7', text: '#3b7fa4' },
  { base: '#b9b5e8', light: '#d2cff7', text: '#706aad' },
  { base: '#9fdc9d', light: '#c6efc1', text: '#4b9456' },
  { base: '#f2ae78', light: '#ffd0a6', text: '#a66035' },
  { base: '#d6b18a', light: '#edcfac', text: '#8d6346' },
]

const DIFFICULTIES: Difficulty[] = ['5x5', '6x6', '7x7']
const COMPLETED_STAGE_STORAGE_KEY = 'moledoku.completedStages.v1'

function stageCompletionKey(difficulty: Difficulty, index: number): string {
  return `${difficulty}:${index + 1}`
}

function loadCompletedStageKeys(): Set<string> {
  if (typeof window === 'undefined') return new Set()

  try {
    const raw = window.localStorage.getItem(COMPLETED_STAGE_STORAGE_KEY)
    if (!raw) return new Set()

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()

    return new Set(parsed.filter((item): item is string => typeof item === 'string'))
  } catch {
    return new Set()
  }
}

function saveCompletedStageKeys(keys: Set<string>) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(COMPLETED_STAGE_STORAGE_KEY, JSON.stringify([...keys].sort()))
  } catch {
    // Progress coloring is optional; gameplay should continue if storage is unavailable.
  }
}

// Self-contained keyframes for the mole's blink + mouth animation. Rendered via
// a hoisted <style> (deduped by `href` in React 19) so we never touch the shared
// global stylesheet. Geometry uses `transform-box: fill-box` so each element
// scales around its own centre regardless of where it sits in the SVG.
const MOLE_CSS = `
.moledoku-eye{transform-box:fill-box;transform-origin:center;animation:moledoku-blink 4.8s ease-in-out infinite}
.moledoku-tooth{transform-box:fill-box;transform-origin:top center;animation:moledoku-tooth 1.9s ease-in-out infinite}
@keyframes moledoku-blink{0%,88%,100%{transform:scaleY(1)}93%{transform:scaleY(0.1)}}
@keyframes moledoku-tooth{0%,100%{transform:scaleY(0.74)}50%{transform:scaleY(1.04)}}
.moledoku-confetti-piece{position:absolute;left:0;top:0;opacity:0;animation:moledoku-confetti 1150ms cubic-bezier(.16,.7,.3,1) forwards}
@keyframes moledoku-confetti{0%{transform:translate(-50%,-50%) rotate(0);opacity:0}12%{opacity:1}100%{transform:translate(calc(-50% + var(--tx)),calc(-50% + var(--ty))) rotate(var(--rot));opacity:0}}
@media (prefers-reduced-motion:reduce){.moledoku-eye,.moledoku-tooth{animation:none}.moledoku-confetti-piece{animation:none;opacity:0}}
`

function MoleStyles() {
  return (
    <style href="moledoku-anim" precedence="default">
      {MOLE_CSS}
    </style>
  )
}

const CONFETTI_COLORS = [
  '#f36f9e',
  '#ffd04a',
  '#7fc8ed',
  '#b9b5e8',
  '#9fdc9d',
  '#f2ae78',
  '#ff9ec0',
]

type ConfettiPiece = {
  i: number
  color: string
  delay: number
  round: boolean
  style: Record<string, string>
}

// Generated once at module load (Math.random is impure, so it must stay out of
// render). The CSS animation replays whenever the win modal mounts.
function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: 28 }, (_, i) => {
    const dir = i % 2 === 0 ? -1 : 1 // alternate left / right
    const tx = dir * (28 + Math.random() * 86)
    const ty = -52 + Math.random() * 150
    const rot = Math.round(Math.random() * 760 - 380)
    const w = 5 + Math.random() * 4
    const h = 8 + Math.random() * 7
    return {
      i,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.round(Math.random() * 130),
      round: Math.random() < 0.3,
      style: {
        width: `${w}px`,
        height: `${h}px`,
        '--tx': `${tx.toFixed(1)}px`,
        '--ty': `${ty.toFixed(1)}px`,
        '--rot': `${rot}deg`,
      },
    }
  })
}

const CONFETTI_PIECES = makeConfetti()

// A one-shot celebratory burst that sprays paper pieces out to both sides of
// the mole.
function Confetti() {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[5.25rem] z-10 h-0 w-0"
      aria-hidden="true"
    >
      {CONFETTI_PIECES.map((p) => (
        <span
          key={p.i}
          className="moledoku-confetti-piece"
          style={{
            ...p.style,
            background: p.color,
            borderRadius: p.round ? '9999px' : '1.5px',
            animationDelay: `${p.delay}ms`,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row])
}

function createSnapshot(board: Board, hearts: number, status: Status): Snapshot {
  return {
    board: cloneBoard(board),
    hearts,
    status,
  }
}

function nextPlayableLevel(currentIndex: number, count: number): number {
  return (currentIndex + 1) % count
}

function conflictText(reasons: string[]): string {
  if (reasons.includes('row')) return '같은 행에는 한 마리만 들어갈 수 있어요.'
  if (reasons.includes('column')) return '같은 열에는 한 마리만 들어갈 수 있어요.'
  if (reasons.includes('region')) return '같은 색상에는 한 마리만 들어갈 수 있어요.'
  return '여기에는 놓을 수 없어요.'
}

export default function CatRegionPuzzle() {
  const [activeDifficulty, setActiveDifficulty] = useState<Difficulty>('5x5')
  const [stagePickerDifficulty, setStagePickerDifficulty] = useState<Difficulty | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [levelIndex, setLevelIndex] = useState(0)
  const [completedStageKeys, setCompletedStageKeys] = useState<Set<string>>(
    () => loadCompletedStageKeys(),
  )
  const availableLevels = useMemo(
    () => levels.filter((item) => item.difficulty === activeDifficulty),
    [activeDifficulty],
  )
  const level = availableLevels[levelIndex] ?? availableLevels[0]

  const startStage = (difficulty: Difficulty, index: number) => {
    setActiveDifficulty(difficulty)
    setLevelIndex(index)
    setStagePickerDifficulty(null)
    setIsPlaying(true)
  }

  const markStageComplete = (difficulty: Difficulty, index: number) => {
    const key = stageCompletionKey(difficulty, index)
    setCompletedStageKeys((current) => {
      if (current.has(key)) return current

      const next = new Set(current)
      next.add(key)
      saveCompletedStageKeys(next)
      return next
    })
  }

  if (!isPlaying) {
    return (
      <MainMenu
        stagePickerDifficulty={stagePickerDifficulty}
        completedStageKeys={completedStageKeys}
        openStagePicker={setStagePickerDifficulty}
        closeStagePicker={() => setStagePickerDifficulty(null)}
        startStage={startStage}
      />
    )
  }

  return (
    <GameSession
      key={level.id}
      level={level}
      levelIndex={levelIndex}
      availableLevels={availableLevels}
      setLevelIndex={setLevelIndex}
      returnToMenu={() => setIsPlaying(false)}
      markStageComplete={markStageComplete}
    />
  )
}

function MainMenu({
  stagePickerDifficulty,
  completedStageKeys,
  openStagePicker,
  closeStagePicker,
  startStage,
}: {
  stagePickerDifficulty: Difficulty | null
  completedStageKeys: Set<string>
  openStagePicker: (difficulty: Difficulty) => void
  closeStagePicker: () => void
  startStage: (difficulty: Difficulty, index: number) => void
}) {
  const pickerLevels = stagePickerDifficulty
    ? levels.filter((item) => item.difficulty === stagePickerDifficulty)
    : []

  return (
    <div className="min-h-full w-full overflow-auto bg-[#f8f3ef] text-[#87515b]">
      <MoleStyles />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col overflow-hidden">
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-[34px] bg-white shadow-[0_16px_34px_rgba(132,87,80,0.16)]">
            <MoleFace large seed={1} />
          </div>
          <p className="mt-8 text-[11px] font-bold uppercase tracking-[0.34em] text-[#c08a93]">
            Moledoku
          </p>
          <h1 className="mt-2.5 text-[2.75rem] font-black leading-none tracking-tight text-[#99545f]">
            두더지 스도쿠
          </h1>
          <p className="mt-5 max-w-[18rem] break-keep text-[15px] font-medium leading-relaxed text-[#ab7d83]">
            색상·가로줄·세로줄마다 두더지를 한 마리씩 숨겨봐요.
          </p>

          <div className="mt-12 grid w-full max-w-[19.5rem] gap-3.5">
            {DIFFICULTIES.map((difficulty, index) => (
              <button
                key={difficulty}
                type="button"
                onClick={() => openStagePicker(difficulty)}
                className="flex items-center justify-between rounded-[22px] bg-white px-8 py-6 text-left shadow-[0_10px_22px_rgba(132,87,80,0.12)] transition active:scale-[0.97]"
              >
                <span className="text-xl font-extrabold tracking-tight text-[#99545f]">
                  {difficulty}
                </span>
                <span className="text-xs font-semibold tracking-wide text-[#bd8d94]">
                  {['쉬움', '보통', '어려움'][index]}
                </span>
              </button>
            ))}
          </div>
        </main>

        {stagePickerDifficulty && (
          <StagePicker
            difficulty={stagePickerDifficulty}
            levels={pickerLevels}
            completedStageKeys={completedStageKeys}
            onClose={closeStagePicker}
            onStart={(index) => startStage(stagePickerDifficulty, index)}
          />
        )}
      </div>
    </div>
  )
}

function StagePicker({
  difficulty,
  levels: pickerLevels,
  completedStageKeys,
  onClose,
  onStart,
}: {
  difficulty: Difficulty
  levels: Level[]
  completedStageKeys: Set<string>
  onClose: () => void
  onStart: (index: number) => void
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#3d2d22]/35 p-8 backdrop-blur-sm">
      <div className="max-h-[calc(100dvh-4rem)] w-full max-w-[22.5rem] overflow-y-auto rounded-[30px] bg-[#fff8f3] px-9 pb-11 pt-9 text-center shadow-[0_20px_42px_rgba(72,45,35,0.22)]">
        <div className="flex items-center justify-between">
          <span className="h-10 w-10" />
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#99545f]">{difficulty}</h2>
            <p className="mt-1 text-[13px] font-medium text-[#b1838a]">스테이지를 골라요</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="스테이지 선택 닫기"
            className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-[#f1e5df] text-xl font-semibold leading-none text-[#a4707a] outline-none transition active:scale-90"
          >
            ×
          </button>
        </div>
        <div className="mx-auto mt-9 grid w-full max-w-[17.5rem] grid-cols-5 gap-3">
          {pickerLevels.map((item, index) => {
            const isCompleted = completedStageKeys.has(stageCompletionKey(difficulty, index))

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onStart(index)}
                className={`flex aspect-square items-center justify-center rounded-[16px] border-0 text-lg font-extrabold shadow-[0_5px_14px_rgba(132,87,80,0.12)] outline-none transition active:scale-90 ${
                  isCompleted ? 'bg-[#eadbd4] text-[#8f5360]' : 'bg-white text-[#99545f]'
                }`}
              >
                {index + 1}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function GameSession({
  level,
  levelIndex,
  availableLevels,
  setLevelIndex,
  returnToMenu,
  markStageComplete,
}: {
  level: Level
  levelIndex: number
  availableLevels: Level[]
  setLevelIndex: Dispatch<SetStateAction<number>>
  returnToMenu: () => void
  markStageComplete: (difficulty: Difficulty, index: number) => void
}) {
  const [board, setBoard] = useState<Board>(() => createBoard(level))
  const [hearts, setHearts] = useState(3)
  const [mode, setMode] = useState<Mode>('cat')
  const [status, setStatus] = useState<Status>('playing')
  const [history, setHistory] = useState<Snapshot[]>([])
  const [hint, setHint] = useState<Coord | null>(null)
  const [mistake, setMistake] = useState<Coord | null>(null)
  const [notice, setNotice] = useState('색상, 열, 행마다 두더지 1마리')
  const markDrag = useRef<MarkDragState>({
    active: false,
    pointerId: null,
    start: null,
    startX: 0,
    startY: 0,
    visited: new Set(),
  })
  const suppressNextCellClick = useRef(false)

  const catsPlaced = useMemo(() => getCats(board).length, [board])
  const lockedKeys = useMemo(
    () => new Set(level.lockedCats.map((cat) => coordKey(cat))),
    [level.lockedCats],
  )

  useEffect(() => {
    if (mistake === null) return
    const timeout = window.setTimeout(() => setMistake(null), 650)
    return () => window.clearTimeout(timeout)
  }, [mistake])

  const pushHistory = () => {
    setHistory((items) => [...items.slice(-20), createSnapshot(board, hearts, status)])
  }

  const loseHeart = (row: number, col: number, message: string) => {
    pushHistory()
    const nextHearts = hearts - 1
    setHearts(nextHearts)
    setMistake({ row, col })
    setNotice(message)
    if (nextHearts <= 0) setStatus('lost')
  }

  const placeCat = (row: number, col: number) => {
    if (status !== 'playing') return

    if (board[row][col] === 'cat') {
      if (isLocked(level, row, col)) {
        setNotice('처음부터 있는 두더지는 고정이에요.')
        return
      }
      pushHistory()
      const next = cloneBoard(board)
      next[row][col] = 'empty'
      setBoard(next)
      setNotice('두더지를 뺐어요.')
      return
    }

    if (!canPlaceCat(board, level, row, col)) {
      loseHeart(row, col, conflictText(getConflicts(board, level, row, col)))
      return
    }

    pushHistory()
    const next = cloneBoard(board)
    next[row][col] = 'cat'
    setBoard(next)
    setHint(null)
    setNotice('좋아요!')
    if (checkWin(next, level)) {
      markStageComplete(level.difficulty, levelIndex)
      setStatus('won')
    }
  }

  const toggleMark = (row: number, col: number) => {
    if (status !== 'playing') return
    if (board[row][col] === 'cat') {
      placeCat(row, col)
      return
    }

    pushHistory()
    const next = cloneBoard(board)
    next[row][col] = board[row][col] === 'mark' ? 'empty' : 'mark'
    setBoard(next)
    setHint(null)
    setNotice(next[row][col] === 'mark' ? '여긴 아니라고 표시했어요.' : '표시를 지웠어요.')
  }

  const paintMark = (row: number, col: number) => {
    const key = `${row}:${col}`
    if (markDrag.current.visited.has(key)) return

    markDrag.current.visited.add(key)
    setBoard((current) => {
      if (current[row][col] !== 'empty') return current

      const next = cloneBoard(current)
      next[row][col] = 'mark'
      return next
    })
  }

  const beginMarkDrag = (coord: Coord) => {
    if (!markDrag.current.active) {
      markDrag.current.active = true
      markDrag.current.visited = new Set()
      pushHistory()
      setHint(null)
      setNotice('표시했어요.')

      if (markDrag.current.start) {
        paintMark(markDrag.current.start.row, markDrag.current.start.col)
      }
    }

    paintMark(coord.row, coord.col)
  }

  const getPointerCell = (clientX: number, clientY: number): Coord | null => {
    const element = document.elementFromPoint(clientX, clientY)
    const cellElement = element?.closest('[data-moledoku-cell]')
    if (!(cellElement instanceof HTMLElement)) return null

    const row = Number(cellElement.dataset.row)
    const col = Number(cellElement.dataset.col)
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null

    return { row, col }
  }

  const handleMarkPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    row: number,
    col: number,
  ) => {
    if (mode !== 'mark' || status !== 'playing') return

    event.currentTarget.setPointerCapture(event.pointerId)
    markDrag.current = {
      active: false,
      pointerId: event.pointerId,
      start: { row, col },
      startX: event.clientX,
      startY: event.clientY,
      visited: new Set(),
    }
  }

  const handleBoardPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = markDrag.current
    if (mode !== 'mark' || status !== 'playing' || drag.pointerId !== event.pointerId) return

    const coord = getPointerCell(event.clientX, event.clientY)
    if (!coord) return

    const movedFromStart = drag.start
      ? coord.row !== drag.start.row || coord.col !== drag.start.col
      : false
    const movedFar =
      Math.abs(event.clientX - drag.startX) > 8 || Math.abs(event.clientY - drag.startY) > 8

    if (drag.active || movedFromStart || movedFar) {
      event.preventDefault()
      beginMarkDrag(coord)
    }
  }

  const endMarkDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (markDrag.current.pointerId !== event.pointerId) return

    if (markDrag.current.active) {
      suppressNextCellClick.current = true
      window.setTimeout(() => {
        suppressNextCellClick.current = false
      }, 250)
    }

    markDrag.current = {
      active: false,
      pointerId: null,
      start: null,
      startX: 0,
      startY: 0,
      visited: new Set(),
    }
  }

  const handleCell = (row: number, col: number) => {
    if (suppressNextCellClick.current) {
      suppressNextCellClick.current = false
      return
    }

    if (mode === 'cat') placeCat(row, col)
    else toggleMark(row, col)
  }

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setBoard(cloneBoard(previous.board))
    setHearts(previous.hearts)
    setStatus(previous.status)
    setHistory((items) => items.slice(0, -1))
    setHint(null)
    setMistake(null)
    setNotice('한 수 되돌렸어요.')
  }

  const restart = () => {
    setBoard(createBoard(level))
    setHearts(3)
    setStatus('playing')
    setHistory([])
    setHint(null)
    setMistake(null)
    setNotice('다시 시작해요.')
  }

  const showHint = () => {
    const nextCat = level.solution.find((cat) => board[cat.row][cat.col] !== 'cat')
    if (!nextCat) {
      setNotice('이미 다 찾았어요.')
      return
    }
    setHint(nextCat)
    setNotice('반짝이는 칸을 살펴봐요.')
  }

  const nextLevel = () => {
    setLevelIndex((index) => nextPlayableLevel(index, availableLevels.length))
  }

  return (
    <div className="min-h-full w-full overflow-auto bg-[#f8f3ef] text-[#87515b]">
      <MoleStyles />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col overflow-hidden px-7">
        <div className="absolute right-5 top-5 z-20">
          <RoundIconButton ariaLabel="메인 메뉴로 돌아가기" onClick={returnToMenu}>
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 11l8-7 8 7" />
              <path d="M6 10v9h12v-9" />
            </svg>
          </RoundIconButton>
        </div>

        <main className="relative z-10 flex flex-1 flex-col items-center justify-center py-12">
          <h1 className="text-xl font-black tracking-tight text-[#99545f]">
            레벨 {levelIndex + 1}
          </h1>

          <div className="mt-6 flex items-center justify-center gap-3">
            <StatusPill>
              <MoleFace tiny seed={2} />
              <span className="text-[#1fb26d]">
                {catsPlaced}/{level.size}
              </span>
            </StatusPill>
            <StatusPill>
              {Array.from({ length: 3 }, (_, index) => (
                <span
                  key={index}
                  className={index < hearts ? 'text-[#f0444d]' : 'text-[#dccfca]'}
                >
                  ♥
                </span>
              ))}
            </StatusPill>
          </div>

          <div
            className={`mt-11 grid w-full max-w-[21rem] gap-1.5 rounded-[22px] bg-white p-2.5 shadow-[0_12px_28px_rgba(125,85,78,0.16)] ${
              mode === 'mark' ? 'touch-none' : 'touch-manipulation'
            }`}
            style={{
              gridTemplateColumns: `repeat(${level.size}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${level.size}, minmax(0, 1fr))`,
              aspectRatio: '1 / 1',
            }}
            aria-label={`Level ${level.id} board`}
            onPointerMove={handleBoardPointerMove}
            onPointerUp={endMarkDrag}
            onPointerCancel={endMarkDrag}
          >
            {board.map((row, rowIndex) =>
              row.map((cell, colIndex) => (
                <BoardCell
                  key={`${rowIndex}-${colIndex}`}
                  cell={cell}
                  level={level}
                  row={rowIndex}
                  col={colIndex}
                  isHint={hint?.row === rowIndex && hint.col === colIndex}
                  isMistake={mistake?.row === rowIndex && mistake.col === colIndex}
                  isLocked={lockedKeys.has(`${rowIndex}:${colIndex}`)}
                  onClick={() => handleCell(rowIndex, colIndex)}
                  onPointerDown={(event) => handleMarkPointerDown(event, rowIndex, colIndex)}
                />
              )),
            )}
          </div>

          <div className="mt-7 flex h-12 items-center justify-center px-2">
            <p className="break-keep text-center text-sm font-semibold leading-snug text-[#a87f85]">
              {notice}
            </p>
          </div>

          <div className="mt-6 grid w-full max-w-[21rem] grid-cols-4 gap-3">
            <ModeButton active={mode === 'cat'} onClick={() => setMode('cat')} ariaLabel="두더지 놓기">
              <MoleFace tiny seed={3} />
            </ModeButton>
            <ModeButton active={mode === 'mark'} onClick={() => setMode('mark')} ariaLabel="X 표시">
              <span className="text-lg leading-none">✕</span>
            </ModeButton>
            <ModeButton onClick={undo} disabled={history.length === 0} ariaLabel="되돌리기">
              되돌리기
            </ModeButton>
            <ModeButton onClick={showHint} ariaLabel="힌트">
              힌트
            </ModeButton>
          </div>
        </main>
      </div>

      {status !== 'playing' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#3d2d22]/45 p-8 backdrop-blur-sm">
          <div className="relative w-full max-w-[20.5rem] overflow-hidden rounded-[30px] bg-[#fff8f3] px-9 pb-11 pt-9 text-center shadow-[0_20px_42px_rgba(72,45,35,0.24)]">
            {status === 'won' && <Confetti />}
            <div className="relative z-10 mx-auto flex h-24 w-24 items-center justify-center rounded-[30px] bg-[#f7ede6]">
              <MoleFace large seed={status === 'won' ? 4 : 7} />
            </div>
            <h2 className="mt-5 text-2xl font-black tracking-tight text-[#99545f]">
              {status === 'won' ? '찾았다!' : '앗, 막혔어요'}
            </h2>
            <p className="mt-2.5 text-sm font-medium leading-relaxed text-[#a87d81]">
              {status === 'won'
                ? '모든 두더지가 자기 색깔 굴을 찾았어요.'
                : '되돌리거나 다시 시작해봐요.'}
            </p>
            <div className="mx-auto mt-8 grid w-full max-w-[15rem] grid-cols-2 gap-3.5">
              <ModalButton onClick={restart}>다시 하기</ModalButton>
              <ModalButton onClick={nextLevel}>다음</ModalButton>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BoardCell({
  cell,
  level,
  row,
  col,
  isHint,
  isMistake,
  isLocked,
  onClick,
  onPointerDown,
}: {
  cell: CellState
  level: Level
  row: number
  col: number
  isHint: boolean
  isMistake: boolean
  isLocked: boolean
  onClick: () => void
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void
}) {
  const color = REGION_COLORS[level.regions[row][col] % REGION_COLORS.length]

  const style: CSSProperties = {
    background: `linear-gradient(145deg, ${color.light} 0%, ${color.base} 72%)`,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.35)',
      'inset 0 -2px 0 rgba(120,75,75,0.12)',
      isHint ? '0 0 0 4px rgba(255,255,255,0.88), 0 0 0 7px rgba(117,198,235,0.75)' : '',
      isMistake ? '0 0 0 5px rgba(255,105,116,0.65)' : '',
    ]
      .filter(Boolean)
      .join(', '),
  }

  return (
    <button
      type="button"
      data-moledoku-cell
      data-row={row}
      data-col={col}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={`relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-[10px] transition active:scale-95 ${
        isHint || isMistake ? 'z-10' : ''
      } ${isMistake ? 'animate-pulse' : ''}`}
      style={style}
      aria-label={`Row ${row + 1}, column ${col + 1}, ${cell === 'cat' ? 'mole' : cell}`}
    >
      {cell === 'cat' && <MoleFace seed={row * 7 + col + 1} />}
      {cell === 'mark' && (
        <span
          className="text-[clamp(0.9rem,5.5vw,1.75rem)] font-bold leading-none"
          style={{ color: color.text }}
        >
          ✕
        </span>
      )}
      {isLocked && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#99545f] ring-2 ring-white" />
      )}
    </button>
  )
}

function MoleFace({
  large = false,
  tiny = false,
  seed = 0,
}: {
  large?: boolean
  tiny?: boolean
  seed?: number
}) {
  // Desync instances a little so a board full of moles doesn't blink in unison.
  const blinkDelay = `${-((seed * 0.53) % 4.8).toFixed(2)}s`
  const toothDelay = `${-((seed * 0.37) % 1.9).toFixed(2)}s`
  const sizeClass = large ? 'mx-auto h-16 w-16' : tiny ? 'h-6 w-6' : 'h-[78%] w-[78%]'

  return (
    <svg viewBox="0 0 100 100" className={`block ${sizeClass}`} aria-hidden="true">
      {/* head — single terracotta tone */}
      <path
        d="M6 50 A44 44 0 0 1 94 50 L94 86 Q94 96 84 96 L16 96 Q6 96 6 86 Z"
        fill="#c06f56"
      />

      {/* eyes (simple dots, blink together) */}
      <g className="moledoku-eye" style={{ animationDelay: blinkDelay }}>
        <circle cx="32" cy="40" r="4.4" fill="#3a322c" />
      </g>
      <g className="moledoku-eye" style={{ animationDelay: blinkDelay }}>
        <circle cx="68" cy="40" r="4.4" fill="#3a322c" />
      </g>

      {/* muzzle — single golden tone */}
      <ellipse cx="37" cy="70" rx="16.5" ry="15.5" fill="#e7c887" />
      <ellipse cx="63" cy="70" rx="16.5" ry="15.5" fill="#e7c887" />

      {/* tooth tucked into the muzzle, long and squared (gentle nibble) */}
      <rect
        className="moledoku-tooth"
        style={{ animationDelay: toothDelay }}
        x="46.4"
        y="73.5"
        width="7.2"
        height="14"
        rx="1.5"
        fill="#fffdf7"
      />

      {/* nose — round, slate */}
      <circle cx="50" cy="55" r="7.2" fill="#45444f" />
    </svg>
  )
}

function RoundIconButton({
  onClick,
  ariaLabel,
  children,
}: {
  onClick: () => void
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#99545f] shadow-[0_6px_16px_rgba(132,87,80,0.13)] transition active:scale-90"
    >
      {children}
    </button>
  )
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2 text-base font-extrabold tracking-tight shadow-[0_5px_14px_rgba(132,87,80,0.1)]">
      {children}
    </div>
  )
}

function ModeButton({
  active = false,
  disabled = false,
  onClick,
  ariaLabel,
  children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`flex min-h-[3.5rem] items-center justify-center whitespace-nowrap rounded-[20px] px-2 py-4 text-xs font-bold shadow-[0_5px_14px_rgba(132,87,80,0.1)] transition active:scale-95 disabled:opacity-40 ${
        active ? 'bg-[#99545f] text-white' : 'bg-white text-[#99545f]'
      }`}
    >
      {children}
    </button>
  )
}

function ModalButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[3.5rem] whitespace-nowrap rounded-[20px] border-0 bg-[#99545f] px-4 py-[1.1rem] text-sm font-bold text-white shadow-[0_5px_14px_rgba(132,87,80,0.18)] outline-none transition active:scale-95"
    >
      {children}
    </button>
  )
}
