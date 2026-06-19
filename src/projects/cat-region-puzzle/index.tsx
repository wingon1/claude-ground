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

  if (!isPlaying) {
    return (
      <MainMenu
        stagePickerDifficulty={stagePickerDifficulty}
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
    />
  )
}

function MainMenu({
  stagePickerDifficulty,
  openStagePicker,
  closeStagePicker,
  startStage,
}: {
  stagePickerDifficulty: Difficulty | null
  openStagePicker: (difficulty: Difficulty) => void
  closeStagePicker: () => void
  startStage: (difficulty: Difficulty, index: number) => void
}) {
  const pickerLevels = stagePickerDifficulty
    ? levels.filter((item) => item.difficulty === stagePickerDifficulty)
    : []

  return (
    <div className="min-h-full w-full overflow-auto bg-[#f7f7f7] px-3 py-5 text-[#87515b]">
      <div className="relative mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[28rem] flex-col overflow-hidden rounded-[2.25rem] border border-[#eadfd8] bg-[#f8f3ef] shadow-[0_16px_40px_rgba(96,68,52,0.16)]">
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-[0_10px_26px_rgba(132,87,80,0.12)]">
            <MoleFace large />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-[#b27782]">
            Burrow Puzzle
          </p>
          <h1 className="mt-2 text-5xl font-black text-[#99545f]">Moledoku</h1>
          <p className="mt-3 max-w-xs text-sm font-black leading-relaxed text-[#a06b72]">
            색상마다 한 마리씩, 행과 열마다 한 마리씩 두더지를 찾아요.
          </p>

          <div className="mt-9 grid w-full max-w-[19rem] gap-3">
            {DIFFICULTIES.map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                onClick={() => openStagePicker(difficulty)}
                className="rounded-[18px] bg-white px-5 py-4 text-xl font-black text-[#99545f] shadow-[0_7px_18px_rgba(132,87,80,0.12)] transition active:scale-95"
              >
                {difficulty}
              </button>
            ))}
          </div>
        </main>

        <footer className="relative mt-auto h-28 overflow-hidden bg-[#8edaf4]">
          <div className="absolute -top-9 left-1/2 h-20 w-[120%] -translate-x-1/2 rounded-[50%] bg-[#f8f3ef]" />
          <div className="absolute inset-x-0 bottom-5 text-center text-3xl font-black text-white drop-shadow-[0_3px_0_#45aad1]">
            난이도 선택
          </div>
        </footer>

        {stagePickerDifficulty && (
          <StagePicker
            difficulty={stagePickerDifficulty}
            levels={pickerLevels}
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
  onClose,
  onStart,
}: {
  difficulty: Difficulty
  levels: Level[]
  onClose: () => void
  onStart: (index: number) => void
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#3d2d22]/30 p-5 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-[1.75rem] bg-[#fff8f3] p-5 text-center shadow-[0_18px_38px_rgba(72,45,35,0.2)]">
        <div className="flex items-center justify-between">
          <span className="w-9" />
          <h2 className="text-2xl font-black text-[#99545f]">{difficulty}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="스테이지 선택 닫기"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1e5df] text-lg font-black text-[#99545f]"
          >
            X
          </button>
        </div>
        <p className="mt-2 text-sm font-black text-[#a06b72]">스테이지를 선택해요</p>
        <div className="mt-5 grid grid-cols-5 gap-2">
          {pickerLevels.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onStart(index)}
              className="h-12 rounded-[12px] bg-white text-sm font-black text-[#99545f] shadow-[0_5px_14px_rgba(132,87,80,0.12)] transition active:scale-95"
            >
              {index + 1}
            </button>
          ))}
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
}: {
  level: Level
  levelIndex: number
  availableLevels: Level[]
  setLevelIndex: Dispatch<SetStateAction<number>>
  returnToMenu: () => void
}) {
  const [board, setBoard] = useState<Board>(() => createBoard(level))
  const [hearts, setHearts] = useState(3)
  const [mode, setMode] = useState<Mode>('cat')
  const [status, setStatus] = useState<Status>('playing')
  const [history, setHistory] = useState<Snapshot[]>([])
  const [hint, setHint] = useState<Coord | null>(null)
  const [mistake, setMistake] = useState<Coord | null>(null)
  const [notice, setNotice] = useState('색상, 열, 행마다 두더지 1마리')

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
    setNotice(next[row][col] === 'mark' ? '여긴 아니라고 표시했어요.' : '표시를 지웠어요.')
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
    <div className="min-h-full w-full overflow-auto bg-[#f7f7f7] px-3 py-5 text-[#87515b]">
      <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[28rem] flex-col overflow-hidden rounded-[2.25rem] border border-[#eadfd8] bg-[#f8f3ef] shadow-[0_16px_40px_rgba(96,68,52,0.16)]">
        <header className="px-5 pt-8">
          <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center">
            <RoundIconButton ariaLabel="메인으로 돌아가기" onClick={returnToMenu}>
              &lt;
            </RoundIconButton>
            <h1 className="text-center text-2xl font-black text-[#99545f]">
              레벨 {levelIndex + 1}
            </h1>
            <RoundIconButton ariaLabel="다시 시작" onClick={restart}>
              S
            </RoundIconButton>
          </div>

          <div className="mt-3 flex items-center justify-center gap-3">
            <StatusPill>
              <MoleFace tiny />
              <span className="text-[#1fb26d]">
                {catsPlaced}/{level.size}
              </span>
            </StatusPill>
            <StatusPill>
              {Array.from({ length: 3 }, (_, index) => (
                <span
                  key={index}
                  className={index < hearts ? 'text-[#f0444d]' : 'text-[#d8ccc7]'}
                >
                  ♥
                </span>
              ))}
            </StatusPill>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-1.5">
            <RuleChip active>색상마다 두더지 1마리</RuleChip>
            <RuleChip>열과 행마다 두더지 1마리</RuleChip>
            <RuleChip>대각선은 허용</RuleChip>
          </div>
        </header>

        <main className="relative z-10 flex flex-1 flex-col items-center px-5 pb-4 pt-8">
          <div
            className="grid w-full max-w-[19.5rem] touch-manipulation gap-1.5 rounded-[14px] bg-white p-1.5 shadow-[0_8px_20px_rgba(125,85,78,0.14)]"
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

          <p className="mt-4 min-h-5 text-center text-xs font-black text-[#a06970]">{notice}</p>

          <div className="mt-4 grid w-full max-w-[19.5rem] grid-cols-5 gap-2">
            <ModeButton active={mode === 'cat'} onClick={() => setMode('cat')} ariaLabel="두더지 놓기">
              <MoleFace tiny />
            </ModeButton>
            <ModeButton active={mode === 'mark'} onClick={() => setMode('mark')} ariaLabel="X 표시">
              X
            </ModeButton>
            <ModeButton onClick={undo} disabled={history.length === 0} ariaLabel="되돌리기">
              U
            </ModeButton>
            <ModeButton onClick={showHint} ariaLabel="힌트">
              ?
            </ModeButton>
            <ModeButton onClick={nextLevel} ariaLabel="다음 스테이지">
              &gt;
            </ModeButton>
          </div>
        </main>

        <footer className="relative mt-auto h-28 overflow-hidden bg-[#8edaf4]">
          <div className="absolute -top-9 left-1/2 h-20 w-[120%] -translate-x-1/2 rounded-[50%] bg-[#f8f3ef]" />
          <div className="absolute left-1/2 top-2 h-11 w-16 -translate-x-1/2">
            <div className="absolute bottom-0 left-1/2 h-9 w-11 -translate-x-1/2 rounded-t-full bg-[#64c3e7]" />
            <div className="absolute left-4 top-0 h-5 w-5 rotate-[-18deg] rounded-[5px] bg-[#64c3e7]" />
            <div className="absolute right-4 top-0 h-5 w-5 rotate-[18deg] rounded-[5px] bg-[#64c3e7]" />
          </div>
          <div className="absolute inset-x-0 bottom-5 text-center text-3xl font-black text-white drop-shadow-[0_3px_0_#45aad1]">
            두더지를 찾아라
          </div>
          <div className="absolute left-8 top-12 text-[#70c9e9]">✿</div>
          <div className="absolute right-12 top-10 text-[#70c9e9]">✿</div>
        </footer>
      </div>

      {status !== 'playing' && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#3d2d22]/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] bg-[#fff8f3] p-6 text-center shadow-[0_18px_38px_rgba(72,45,35,0.2)]">
            <MoleFace large />
            <h2 className="mt-4 text-2xl font-black text-[#99545f]">
              {status === 'won' ? '찾았다!' : '앗, 막혔어요'}
            </h2>
            <p className="mt-2 text-sm font-bold text-[#9a6b6f]">
              {status === 'won'
                ? '모든 두더지가 자기 색상 굴을 찾았어요.'
                : '되돌리거나 다시 시작해봐요.'}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
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
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={`relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-[6px] transition active:scale-95 ${
        isHint || isMistake ? 'z-10' : ''
      } ${isMistake ? 'animate-pulse' : ''}`}
      style={style}
      aria-label={`Row ${row + 1}, column ${col + 1}, ${cell === 'cat' ? 'mole' : cell}`}
    >
      {cell === 'cat' && <MoleFace />}
      {cell === 'mark' && (
        <span
          className="text-[clamp(1rem,6vw,2rem)] font-black"
          style={{ color: color.text }}
        >
          X
        </span>
      )}
      {isLocked && (
        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#99545f] ring-2 ring-white" />
      )}
    </button>
  )
}

function MoleFace({ large = false, tiny = false }: { large?: boolean; tiny?: boolean }) {
  return (
    <span
      className={`relative block rounded-full bg-[#4e3a31] shadow-[inset_0_-3px_0_rgba(0,0,0,0.18)] ${
        large ? 'mx-auto h-16 w-16' : tiny ? 'h-6 w-6' : 'h-[72%] w-[72%]'
      }`}
      aria-hidden="true"
    >
      <span className="absolute left-[23%] top-[29%] h-[11%] w-[11%] rounded-full bg-white" />
      <span className="absolute right-[23%] top-[29%] h-[11%] w-[11%] rounded-full bg-white" />
      <span className="absolute left-[26%] top-[31%] h-[6%] w-[6%] rounded-full bg-[#18110f]" />
      <span className="absolute right-[26%] top-[31%] h-[6%] w-[6%] rounded-full bg-[#18110f]" />
      <span className="absolute left-1/2 top-[47%] h-[26%] w-[35%] -translate-x-1/2 rounded-full bg-[#d5a889]" />
      <span className="absolute left-1/2 top-[53%] h-[10%] w-[14%] -translate-x-1/2 rounded-full bg-[#2f201c]" />
    </span>
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
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl font-black text-[#99545f] shadow-[0_6px_16px_rgba(132,87,80,0.13)] transition active:scale-95"
    >
      {children}
    </button>
  )
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-1.5 rounded-full bg-white px-3 text-lg font-black shadow-[0_5px_14px_rgba(132,87,80,0.1)]">
      {children}
    </div>
  )
}

function RuleChip({ active = false, children }: { active?: boolean; children: ReactNode }) {
  return (
    <div
      className={`flex min-h-12 items-center justify-center rounded-[5px] bg-white px-1.5 text-center text-[0.69rem] font-black leading-tight text-[#99545f] shadow-[0_4px_12px_rgba(132,87,80,0.08)] ${
        active ? 'ring-2 ring-[#99545f]' : ''
      }`}
    >
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
      className={`flex h-11 items-center justify-center rounded-full text-sm font-black shadow-[0_5px_14px_rgba(132,87,80,0.1)] transition active:scale-95 disabled:opacity-40 ${
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
      className="rounded-full bg-[#99545f] px-4 py-3 text-sm font-black text-white shadow-[0_5px_14px_rgba(132,87,80,0.18)] transition active:scale-95"
    >
      {children}
    </button>
  )
}
