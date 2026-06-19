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
  isSolutionCell,
  type Board,
  type CellState,
  type Coord,
  type Level,
} from './gameLogic'
import { levelPackSummary, levels } from './levels'

type Mode = 'cat' | 'mark'
type Status = 'playing' | 'won' | 'lost'

type Snapshot = {
  board: Board
  hearts: number
  status: Status
}

const REGION_COLORS = [
  '#ffd6a5',
  '#fdffb6',
  '#caffbf',
  '#9bf6ff',
  '#bdb2ff',
  '#ffc6ff',
]

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

function difficultyLabel(level: Level): string {
  if (level.difficulty === 'normal') return 'Normal'
  if (level.difficulty === 'hard') return 'Hard'
  return 'Ultra'
}

function nextPlayableLevel(currentIndex: number): number {
  return (currentIndex + 1) % levels.length
}

export default function CatRegionPuzzle() {
  const [levelIndex, setLevelIndex] = useState(0)
  const level = levels[levelIndex]

  return (
    <GameSession
      key={level.id}
      level={level}
      levelIndex={levelIndex}
      setLevelIndex={setLevelIndex}
    />
  )
}

function GameSession({
  level,
  levelIndex,
  setLevelIndex,
}: {
  level: Level
  levelIndex: number
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

    if (!isSolutionCell(level, row, col)) {
      loseHeart(row, col, 'That mole does not fit the final logic.')
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
    setLevelIndex((index) => nextPlayableLevel(index))
  }

  return (
    <div className="h-full w-full overflow-auto bg-[#f6f0e4] text-[#2f2a24]">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 pb-4 pt-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-[#9d5f3d]">
              Mole Region Puzzle
            </div>
            <h1 className="mt-1 text-3xl font-black leading-tight text-[#2f2a24] sm:text-4xl">
              Moledoku
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold sm:min-w-72">
            <Stat label="Level" value={`${level.id}/${levels.length}`} />
            <Stat label="Size" value={`${level.size}x${level.size}`} />
            <Stat label="Mode" value={difficultyLabel(level)} />
          </div>
        </header>

        <main className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <section className="flex flex-col items-center gap-4">
            <div className="flex w-full max-w-[42rem] items-center justify-between gap-3">
              <div className="flex items-center gap-2 rounded-full bg-white/75 px-3 py-2 shadow-sm ring-1 ring-[#5f5144]/10">
                {Array.from({ length: 3 }, (_, index) => (
                  <span
                    key={index}
                    className={`h-3.5 w-3.5 rounded-full ${
                      index < hearts ? 'bg-[#e15b55]' : 'bg-[#d8cfc2]'
                    }`}
                  />
                ))}
                <span className="ml-1 text-xs font-black uppercase tracking-wider text-[#7b6b5b]">
                  Hearts
                </span>
              </div>
              <div className="text-sm font-black text-[#6f5f50]">
                {catsPlaced}/{level.size} moles
              </div>
            </div>

            <div
              className="grid w-full max-w-[min(92vw,38rem)] touch-manipulation rounded-[8px] bg-[#5f5144] p-1 shadow-2xl shadow-[#6d5638]/20"
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

            <p className="min-h-6 max-w-[42rem] text-center text-sm font-semibold text-[#6f5f50]">
              {notice}
            </p>

            <div className="grid w-full max-w-[42rem] grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setMode('cat')}
                className={toolClass(mode === 'cat')}
                aria-pressed={mode === 'cat'}
              >
                Mole
              </button>
              <button
                type="button"
                onClick={() => setMode('mark')}
                className={toolClass(mode === 'mark')}
                aria-pressed={mode === 'mark'}
              >
                X Mark
              </button>
              <button type="button" onClick={undo} disabled={history.length === 0} className={buttonClass}>
                Undo
              </button>
              <button type="button" onClick={restart} className={buttonClass}>
                Restart
              </button>
            </div>
          </section>

          <aside className="flex flex-col gap-3">
            <Panel>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#7a5136]">
                  Tools
                </h2>
                <span className="rounded-full bg-[#e8d6bf] px-2.5 py-1 text-xs font-black text-[#6c4a33]">
                  Verified
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={showHint} className={buttonClass}>
                  Hint
                </button>
                <button type="button" onClick={nextLevel} className={buttonClass}>
                  Next
                </button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-[#6f5f50]">
                <span>{levelPackSummary.normal} normal</span>
                <span>{levelPackSummary.hard} hard</span>
                <span>{levelPackSummary.ultra} ultra</span>
                <span>{levelPackSummary.uniqueSolutions ? 'unique' : 'check'}</span>
                <span>{levelPackSummary.noLocks ? 'no locks' : 'locks'}</span>
              </div>
            </Panel>

            <Panel>
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#7a5136]">
                Levels
              </h2>
              <div className="mt-4 grid max-h-56 grid-cols-5 gap-1.5 overflow-auto pr-1">
                {levels.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => goToLevel(index)}
                    className={`h-9 rounded-[6px] text-sm font-black transition ${
                      index === levelIndex
                        ? 'bg-[#2f2a24] text-white'
                        : 'bg-[#efe2d0] text-[#5c4c3e] hover:bg-[#e5d1b7]'
                    }`}
                    aria-label={`Open level ${item.id}`}
                  >
                    {item.id}
                  </button>
                ))}
              </div>
            </Panel>
          </aside>
        </main>
      </div>

      {status !== 'playing' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#2f2a24]/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[8px] bg-[#fff8ed] p-6 text-center shadow-2xl">
            <MoleFace large />
            <h2 className="mt-4 text-2xl font-black text-[#2f2a24]">
              {status === 'won' ? 'Level cleared' : 'No hearts left'}
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#756454]">
              {status === 'won'
                ? 'Every row, column, and color region has exactly one mole.'
                : 'Restart the board or undo a recent mistake.'}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={restart} className={buttonClass}>
                Replay
              </button>
              <button type="button" onClick={nextLevel} className={buttonClass}>
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
  const hasDifferentRegion = (nextRow: number, nextCol: number) =>
    nextRow < 0 ||
    nextRow >= level.size ||
    nextCol < 0 ||
    nextCol >= level.size ||
    level.regions[nextRow][nextCol] !== regionId

  const style: CSSProperties = {
    background: REGION_COLORS[regionId % REGION_COLORS.length],
    borderTop: hasDifferentRegion(row - 1, col)
      ? '3px solid rgba(70, 52, 39, 0.72)'
      : '1px solid rgba(70, 52, 39, 0.20)',
    borderRight: hasDifferentRegion(row, col + 1)
      ? '3px solid rgba(70, 52, 39, 0.72)'
      : '1px solid rgba(70, 52, 39, 0.20)',
    borderBottom: hasDifferentRegion(row + 1, col)
      ? '3px solid rgba(70, 52, 39, 0.72)'
      : '1px solid rgba(70, 52, 39, 0.20)',
    borderLeft: hasDifferentRegion(row, col - 1)
      ? '3px solid rgba(70, 52, 39, 0.72)'
      : '1px solid rgba(70, 52, 39, 0.20)',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden transition active:scale-[0.98] ${
        isHint ? 'z-10 shadow-[inset_0_0_0_5px_rgba(20,117,96,0.55)]' : ''
      } ${isMistake ? 'animate-pulse shadow-[inset_0_0_0_5px_rgba(208,48,48,0.72)]' : ''}`}
      style={style}
      aria-label={`Row ${row + 1}, column ${col + 1}, ${cell}`}
    >
      {cell === 'cat' && <MoleFace />}
      {cell === 'mark' && <span className="text-[clamp(1.2rem,7vw,2.4rem)] font-black text-[#786b62]/70">X</span>}
      {isLocked && (
        <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-[#2f2a24] ring-2 ring-white/70" />
      )}
    </button>
  )
}

function MoleFace({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`relative block rounded-full bg-[#5a4636] shadow-[inset_0_-4px_0_rgba(0,0,0,0.18)] ${
        large ? 'mx-auto h-16 w-16' : 'h-[52%] w-[52%]'
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-white/70 px-3 py-2 shadow-sm ring-1 ring-[#5f5144]/10">
      <div className="text-[10px] uppercase tracking-wider text-[#8b7968]">{label}</div>
      <div className="mt-0.5 text-sm font-black text-[#2f2a24]">{value}</div>
    </div>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-[8px] bg-white/70 p-4 shadow-sm ring-1 ring-[#5f5144]/10">
      {children}
    </section>
  )
}

const buttonClass =
  'rounded-[8px] bg-[#2f2a24] px-3 py-2.5 text-sm font-black text-white transition hover:bg-[#46382f] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#c7b9aa] disabled:text-[#76685a]'

function toolClass(active: boolean): string {
  return active
    ? 'rounded-[8px] bg-[#9d5f3d] px-3 py-2.5 text-sm font-black text-white transition active:scale-[0.98]'
    : 'rounded-[8px] bg-white/75 px-3 py-2.5 text-sm font-black text-[#5c4c3e] ring-1 ring-[#5f5144]/10 transition hover:bg-[#fff8ed] active:scale-[0.98]'
}
