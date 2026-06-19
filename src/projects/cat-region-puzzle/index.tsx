import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
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

const REGION_COLORS: JellyColor[] = [
  { base: '#f8c88e', light: '#ffe8bc', shadow: '#d79357' },
  { base: '#f4df75', light: '#fff4ac', shadow: '#c9aa43' },
  { base: '#9bd8a5', light: '#cef0c9', shadow: '#6fae77' },
  { base: '#98d9df', light: '#d3f1f2', shadow: '#65aeb7' },
  { base: '#bea9ea', light: '#e3d8ff', shadow: '#9076c7' },
  { base: '#f0a9bd', light: '#ffd8df', shadow: '#c6738b' },
  { base: '#d9b28a', light: '#f2d4b0', shadow: '#a67955' },
]

const DIFFICULTIES: Difficulty[] = ['5x5', '6x6', '7x7']

type JellyColor = {
  base: string
  light: string
  shadow: string
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

export default function CatRegionPuzzle() {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('5x5')
  const [levelIndex, setLevelIndex] = useState(0)
  const availableLevels = useMemo(
    () => levels.filter((item) => item.difficulty === selectedDifficulty),
    [selectedDifficulty],
  )
  const level = availableLevels[levelIndex] ?? availableLevels[0]

  const selectDifficulty = (difficulty: Difficulty) => {
    setSelectedDifficulty(difficulty)
    setLevelIndex(0)
  }

  return (
    <GameSession
      key={level.id}
      level={level}
      levelIndex={levelIndex}
      availableLevels={availableLevels}
      selectedDifficulty={selectedDifficulty}
      selectDifficulty={selectDifficulty}
      setLevelIndex={setLevelIndex}
    />
  )
}

function GameSession({
  level,
  levelIndex,
  availableLevels,
  selectedDifficulty,
  selectDifficulty,
  setLevelIndex,
}: {
  level: Level
  levelIndex: number
  availableLevels: Level[]
  selectedDifficulty: Difficulty
  selectDifficulty: (difficulty: Difficulty) => void
  setLevelIndex: Dispatch<SetStateAction<number>>
}) {
  const [board, setBoard] = useState<Board>(() => createBoard(level))
  const [hearts, setHearts] = useState(3)
  const [mode, setMode] = useState<Mode>('cat')
  const [status, setStatus] = useState<Status>('playing')
  const [history, setHistory] = useState<Snapshot[]>([])
  const [hint, setHint] = useState<Coord | null>(null)
  const [mistake, setMistake] = useState<Coord | null>(null)
  const [notice, setNotice] = useState('Place one mole in every row, column, and color region.')

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
        setNotice('Locked moles are part of the puzzle start.')
        return
      }
      pushHistory()
      const next = cloneBoard(board)
      next[row][col] = 'empty'
      setBoard(next)
      setNotice('Mole removed.')
      return
    }

    if (!canPlaceCat(board, level, row, col)) {
      const conflicts = getConflicts(board, level, row, col)
      loseHeart(row, col, `Conflict: ${conflicts.join(', ') || 'blocked cell'}.`)
      return
    }

    pushHistory()
    const next = cloneBoard(board)
    next[row][col] = 'cat'
    setBoard(next)
    setHint(null)
    setNotice('Good placement.')
    if (checkWin(next, level)) setStatus('won')
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
    setNotice(next[row][col] === 'mark' ? 'Marked as impossible.' : 'Mark cleared.')
  }

  const handleCell = (row: number, col: number) => {
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
    setNotice('Undid the last move.')
  }

  const restart = () => {
    setBoard(createBoard(level))
    setHearts(3)
    setStatus('playing')
    setHistory([])
    setHint(null)
    setMistake(null)
    setNotice('Level restarted.')
  }

  const showHint = () => {
    const nextCat = level.solution.find((cat) => board[cat.row][cat.col] !== 'cat')
    if (!nextCat) {
      setNotice('All moles are already placed.')
      return
    }
    setHint(nextCat)
    setNotice('Inspect the highlighted cell and its row, column, region, and diagonals.')
  }

  const goToLevel = (index: number) => {
    setLevelIndex(index)
  }

  const nextLevel = () => {
    setLevelIndex((index) => nextPlayableLevel(index, availableLevels.length))
  }

  return (
    <div className="h-full w-full overflow-auto bg-[#f7ead7] text-[#3d2d22]">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col px-4 py-5 sm:px-6">
        <header className="pt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#dcb486] shadow-[inset_0_4px_0_rgba(255,255,255,0.45),0_7px_0_#a87750,0_12px_20px_rgba(87,56,34,0.18)]">
                <MoleFace />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-[#9a6845]">
                  Burrow Puzzle
                </div>
                <h1 className="text-3xl font-black leading-tight text-[#3d2d22] sm:text-4xl">
                  Moledoku
                </h1>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-[18px] bg-[#fff7ea]/90 px-3 py-2 shadow-[0_8px_0_#d5b58d,0_16px_28px_rgba(91,59,35,0.12)] ring-1 ring-[#8b674d]/10 sm:min-w-64">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: 3 }, (_, index) => (
                  <span
                    key={index}
                    className={`h-3.5 w-3.5 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ${
                      index < hearts ? 'bg-[#ef6b63]' : 'bg-[#decab3]'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-black text-[#7b5a42]">
                {catsPlaced}/{level.size} moles
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <ControlGroup label="Burrow size">
              {DIFFICULTIES.map((difficulty) => (
                <PillButton
                  key={difficulty}
                  active={selectedDifficulty === difficulty}
                  onClick={() => selectDifficulty(difficulty)}
                  ariaLabel={`Select ${difficulty} burrow`}
                >
                  {difficulty}
                </PillButton>
              ))}
            </ControlGroup>

            <ControlGroup label="Stage">
              {availableLevels.map((item, index) => (
                <StageButton
                  key={item.id}
                  active={index === levelIndex}
                  onClick={() => goToLevel(index)}
                  ariaLabel={`Open ${selectedDifficulty} puzzle ${index + 1}`}
                >
                  {index + 1}
                </StageButton>
              ))}
            </ControlGroup>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center gap-4 py-5">
          <section className="w-full max-w-[min(92vw,39rem)]">
            <div
              className="grid touch-manipulation gap-[clamp(0.22rem,1vw,0.42rem)] rounded-[22px] bg-[#6f4f37] p-[clamp(0.45rem,1.5vw,0.75rem)] shadow-[inset_0_5px_0_rgba(255,255,255,0.16),0_12px_0_#4e3524,0_24px_36px_rgba(75,48,29,0.24)]"
              style={{
                gridTemplateColumns: `repeat(${level.size}, minmax(0, 1fr))`,
                aspectRatio: '1 / 1',
              }}
              aria-label={`Level ${level.id} board`}
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
                    onDoubleClick={() => placeCat(rowIndex, colIndex)}
                  />
                )),
              )}
            </div>
          </section>

          <p className="min-h-6 max-w-xl text-center text-sm font-bold text-[#7b5a42]">
            {notice}
          </p>

          <div className="grid w-full max-w-xl grid-cols-3 gap-2 sm:grid-cols-6">
            <ToolButton active={mode === 'cat'} onClick={() => setMode('cat')} ariaLabel="Mole mode">
              <span className="flex items-center justify-center">
                <MoleFace tiny />
              </span>
              Mole
            </ToolButton>
            <ToolButton active={mode === 'mark'} onClick={() => setMode('mark')} ariaLabel="X mark mode">
              <span className="text-xl leading-none">X</span>
              Mark
            </ToolButton>
            <ToolButton onClick={undo} disabled={history.length === 0} ariaLabel="Undo">
              <span className="text-xl leading-none">U</span>
              Undo
            </ToolButton>
            <ToolButton onClick={showHint} ariaLabel="Hint">
              <span className="text-xl leading-none">?</span>
              Hint
            </ToolButton>
            <ToolButton onClick={restart} ariaLabel="Restart">
              <span className="text-xl leading-none">R</span>
              Reset
            </ToolButton>
            <ToolButton onClick={nextLevel} ariaLabel="Next stage">
              <span className="text-xl leading-none">&gt;</span>
              Next
            </ToolButton>
          </div>
        </main>
      </div>

      {status !== 'playing' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#2f2a24]/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[22px] bg-[#fff8ed] p-6 text-center shadow-[0_12px_0_#d8b98d,0_28px_42px_rgba(58,38,24,0.22)] ring-1 ring-[#8b674d]/10">
            <MoleFace large />
            <h2 className="mt-4 text-2xl font-black text-[#3d2d22]">
              {status === 'won' ? 'Burrow cleared' : 'Path blocked'}
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#756454]">
              {status === 'won'
                ? 'Every mole found a cozy room.'
                : 'Undo the last dig or start this burrow again.'}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={restart} className={actionButtonClass}>
                Replay
              </button>
              <button type="button" onClick={nextLevel} className={actionButtonClass}>
                Next
              </button>
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
  onDoubleClick,
}: {
  cell: CellState
  level: Level
  row: number
  col: number
  isHint: boolean
  isMistake: boolean
  isLocked: boolean
  onClick: () => void
  onDoubleClick: () => void
}) {
  const regionId = level.regions[row][col]
  const color = REGION_COLORS[regionId % REGION_COLORS.length]

  const style: CSSProperties = {
    background: [
      'radial-gradient(circle at 28% 22%, rgba(255,255,255,0.88) 0 10%, rgba(255,255,255,0.28) 11% 18%, transparent 19%)',
      `linear-gradient(145deg, ${color.light} 0%, ${color.base} 54%, ${color.shadow} 100%)`,
    ].join(', '),
    boxShadow: [
      'inset 0 3px 0 rgba(255,255,255,0.58)',
      'inset 0 -5px 0 rgba(73,43,24,0.18)',
      '0 5px 0 rgba(73,43,24,0.28)',
      '0 9px 12px rgba(73,43,24,0.14)',
      isHint ? '0 0 0 5px rgba(82,151,107,0.55)' : '',
      isMistake ? '0 0 0 5px rgba(219,77,67,0.65)' : '',
    ]
      .filter(Boolean)
      .join(', '),
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-[clamp(0.55rem,1.8vw,1rem)] border border-white/40 transition duration-150 hover:-translate-y-0.5 active:translate-y-1 active:scale-[0.97] ${
        isHint ? 'z-10' : ''
      } ${isMistake ? 'animate-pulse' : ''}`}
      style={style}
      aria-label={`Row ${row + 1}, column ${col + 1}, ${cell === 'cat' ? 'mole' : cell}`}
    >
      {cell === 'cat' && <MoleFace />}
      {cell === 'mark' && (
        <span className="text-[clamp(1.05rem,6vw,2.2rem)] font-black text-[#6b4b37]/65 drop-shadow-[0_1px_0_rgba(255,255,255,0.55)]">
          X
        </span>
      )}
      {isLocked && (
        <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#2f2a24] ring-2 ring-white/70" />
      )}
    </button>
  )
}

function MoleFace({ large = false, tiny = false }: { large?: boolean; tiny?: boolean }) {
  return (
    <span
      className={`relative block rounded-full bg-[#5a4636] shadow-[inset_0_-4px_0_rgba(0,0,0,0.18)] ${
        large ? 'mx-auto h-16 w-16' : tiny ? 'h-6 w-6' : 'h-[58%] w-[58%]'
      }`}
      aria-hidden="true"
    >
      <span className="absolute left-[22%] top-[30%] h-[9%] w-[9%] rounded-full bg-[#1f1814]" />
      <span className="absolute right-[22%] top-[30%] h-[9%] w-[9%] rounded-full bg-[#1f1814]" />
      <span className="absolute left-1/2 top-[46%] h-[26%] w-[34%] -translate-x-1/2 rounded-full bg-[#d7ad8d]" />
      <span className="absolute left-1/2 top-[52%] h-[10%] w-[14%] -translate-x-1/2 rounded-full bg-[#33251f]" />
      <span className="absolute left-[10%] top-[60%] h-[13%] w-[18%] rounded-full bg-[#7b604a]" />
      <span className="absolute right-[10%] top-[60%] h-[13%] w-[18%] rounded-full bg-[#7b604a]" />
    </span>
  )
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#9a6845]">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function PillButton({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean
  onClick: () => void
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`min-h-10 rounded-full px-4 text-sm font-black transition active:translate-y-1 ${
        active
          ? 'bg-[#5a3f2e] text-[#fff8ed] shadow-[inset_0_2px_0_rgba(255,255,255,0.18),0_5px_0_#33251f]'
          : 'bg-[#fff7ea] text-[#6f4f37] shadow-[inset_0_2px_0_rgba(255,255,255,0.75),0_5px_0_#d1ad83] hover:bg-white'
      }`}
    >
      {children}
    </button>
  )
}

function StageButton({
  active,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean
  onClick: () => void
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`h-10 w-10 rounded-full text-sm font-black transition active:translate-y-1 ${
        active
          ? 'bg-[#e98f5d] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.32),0_5px_0_#9f5a37]'
          : 'bg-[#fff7ea] text-[#6f4f37] shadow-[inset_0_2px_0_rgba(255,255,255,0.72),0_5px_0_#d1ad83] hover:bg-white'
      }`}
    >
      {children}
    </button>
  )
}

function ToolButton({
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
      className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-[18px] px-2 text-xs font-black transition active:translate-y-1 disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? 'bg-[#5a3f2e] text-[#fff8ed] shadow-[inset_0_3px_0_rgba(255,255,255,0.16),0_6px_0_#33251f]'
          : 'bg-[#fff7ea] text-[#6f4f37] shadow-[inset_0_3px_0_rgba(255,255,255,0.78),0_6px_0_#d1ad83] hover:bg-white'
      }`}
    >
      {children}
    </button>
  )
}

const actionButtonClass =
  'rounded-full bg-[#5a3f2e] px-4 py-3 text-sm font-black text-[#fff8ed] shadow-[inset_0_2px_0_rgba(255,255,255,0.18),0_5px_0_#33251f] transition active:translate-y-1'
