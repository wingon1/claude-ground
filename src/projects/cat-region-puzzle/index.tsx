import {
  useEffect,
  useId,
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
type MoleSkinId = 'classic' | 'sprout' | 'miner' | 'berry' | 'star' | 'hamster'

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

type MoleSkin = {
  id: MoleSkinId
  name: string
  price: number
  /** Base creature silhouette. Defaults to the mole when omitted. */
  kind?: 'mole' | 'hamster'
  head: string
  muzzle: string
  nose: string
  accessory: 'none' | 'sprout' | 'helmet' | 'berry' | 'star'
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
const COIN_STORAGE_KEY = 'moledoku.coins.v1'
const OWNED_SKINS_STORAGE_KEY = 'moledoku.ownedSkins.v1'
const EQUIPPED_SKIN_STORAGE_KEY = 'moledoku.equippedSkin.v1'
const CLEAR_REWARD_COINS = 10

const MOLE_SKINS: MoleSkin[] = [
  {
    id: 'classic',
    name: '기본 두더지',
    price: 0,
    head: '#c06f56',
    muzzle: '#e7c887',
    nose: '#45444f',
    accessory: 'none',
  },
  {
    id: 'sprout',
    name: '새싹 두더지',
    price: 50,
    head: '#b87958',
    muzzle: '#f0d08d',
    nose: '#3f4540',
    accessory: 'sprout',
  },
  {
    id: 'miner',
    name: '광부 두더지',
    price: 90,
    head: '#a7654f',
    muzzle: '#e6c27c',
    nose: '#38343d',
    accessory: 'helmet',
  },
  {
    id: 'berry',
    name: '딸기 두더지',
    price: 130,
    head: '#c86f75',
    muzzle: '#f3c997',
    nose: '#4a3a43',
    accessory: 'berry',
  },
  {
    id: 'star',
    name: '별잠옷 두더지',
    price: 180,
    head: '#8973b8',
    muzzle: '#f0d7a0',
    nose: '#3d3850',
    accessory: 'star',
  },
  {
    id: 'hamster',
    name: '햄스터',
    price: 150,
    kind: 'hamster',
    head: '#e3b06a',
    muzzle: '#fbe9d0',
    nose: '#cf7f86',
    accessory: 'none',
  },
]

const DEFAULT_SKIN_ID: MoleSkinId = 'classic'

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

function isMoleSkinId(value: unknown): value is MoleSkinId {
  return typeof value === 'string' && MOLE_SKINS.some((skin) => skin.id === value)
}

function getSkin(id: MoleSkinId): MoleSkin {
  return MOLE_SKINS.find((skin) => skin.id === id) ?? MOLE_SKINS[0]
}

function loadCoins(): number {
  if (typeof window === 'undefined') return 0

  try {
    const raw = window.localStorage.getItem(COIN_STORAGE_KEY)
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0
  } catch {
    return 0
  }
}

function saveCoins(coins: number) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(COIN_STORAGE_KEY, String(Math.max(0, Math.floor(coins))))
  } catch {
    // Coins are a bonus economy; gameplay still works when storage is blocked.
  }
}

function loadOwnedSkinIds(): Set<MoleSkinId> {
  if (typeof window === 'undefined') return new Set([DEFAULT_SKIN_ID])

  try {
    const raw = window.localStorage.getItem(OWNED_SKINS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    const owned = new Set<MoleSkinId>([DEFAULT_SKIN_ID])

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (isMoleSkinId(item)) owned.add(item)
      }
    }

    return owned
  } catch {
    return new Set([DEFAULT_SKIN_ID])
  }
}

function saveOwnedSkinIds(ids: Set<MoleSkinId>) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(OWNED_SKINS_STORAGE_KEY, JSON.stringify([...ids].sort()))
  } catch {
    // Cosmetic ownership is local-only; failing to persist should not block play.
  }
}

function loadEquippedSkinId(ownedSkinIds: Set<MoleSkinId>): MoleSkinId {
  if (typeof window === 'undefined') return DEFAULT_SKIN_ID

  try {
    const raw = window.localStorage.getItem(EQUIPPED_SKIN_STORAGE_KEY)
    return isMoleSkinId(raw) && ownedSkinIds.has(raw) ? raw : DEFAULT_SKIN_ID
  } catch {
    return DEFAULT_SKIN_ID
  }
}

function saveEquippedSkinId(id: MoleSkinId) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(EQUIPPED_SKIN_STORAGE_KEY, id)
  } catch {
    // The default skin remains available if storage is blocked.
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
  const [coins, setCoins] = useState(() => loadCoins())
  const [ownedSkinIds, setOwnedSkinIds] = useState<Set<MoleSkinId>>(() => loadOwnedSkinIds())
  const [equippedSkinId, setEquippedSkinId] = useState<MoleSkinId>(() =>
    loadEquippedSkinId(loadOwnedSkinIds()),
  )
  const availableLevels = useMemo(
    () => levels.filter((item) => item.difficulty === activeDifficulty),
    [activeDifficulty],
  )
  const level = availableLevels[levelIndex] ?? availableLevels[0]
  const equippedSkin = getSkin(equippedSkinId)

  const startStage = (difficulty: Difficulty, index: number) => {
    setActiveDifficulty(difficulty)
    setLevelIndex(index)
    setStagePickerDifficulty(null)
    setIsPlaying(true)
  }

  const buySkin = (skinId: MoleSkinId) => {
    const skin = getSkin(skinId)
    if (ownedSkinIds.has(skinId) || coins < skin.price) return

    const nextOwnedSkinIds = new Set(ownedSkinIds)
    nextOwnedSkinIds.add(skinId)
    const nextCoins = coins - skin.price

    setOwnedSkinIds(nextOwnedSkinIds)
    saveOwnedSkinIds(nextOwnedSkinIds)
    setCoins(nextCoins)
    saveCoins(nextCoins)
    setEquippedSkinId(skinId)
    saveEquippedSkinId(skinId)
  }

  const equipSkin = (skinId: MoleSkinId) => {
    if (!ownedSkinIds.has(skinId)) return

    setEquippedSkinId(skinId)
    saveEquippedSkinId(skinId)
  }

  const markStageComplete = (difficulty: Difficulty, index: number): boolean => {
    const key = stageCompletionKey(difficulty, index)
    if (completedStageKeys.has(key)) return false

    const nextCompletedStageKeys = new Set(completedStageKeys)
    nextCompletedStageKeys.add(key)
    saveCompletedStageKeys(nextCompletedStageKeys)
    setCompletedStageKeys(nextCompletedStageKeys)

    const nextCoins = coins + CLEAR_REWARD_COINS
    setCoins(nextCoins)
    saveCoins(nextCoins)

    return true
  }

  if (!isPlaying) {
    return (
      <MainMenu
        stagePickerDifficulty={stagePickerDifficulty}
        completedStageKeys={completedStageKeys}
        coins={coins}
        ownedSkinIds={ownedSkinIds}
        equippedSkinId={equippedSkinId}
        openStagePicker={setStagePickerDifficulty}
        closeStagePicker={() => setStagePickerDifficulty(null)}
        startStage={startStage}
        buySkin={buySkin}
        equipSkin={equipSkin}
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
      equippedSkin={equippedSkin}
    />
  )
}

function MainMenu({
  stagePickerDifficulty,
  completedStageKeys,
  coins,
  ownedSkinIds,
  equippedSkinId,
  openStagePicker,
  closeStagePicker,
  startStage,
  buySkin,
  equipSkin,
}: {
  stagePickerDifficulty: Difficulty | null
  completedStageKeys: Set<string>
  coins: number
  ownedSkinIds: Set<MoleSkinId>
  equippedSkinId: MoleSkinId
  openStagePicker: (difficulty: Difficulty) => void
  closeStagePicker: () => void
  startStage: (difficulty: Difficulty, index: number) => void
  buySkin: (skinId: MoleSkinId) => void
  equipSkin: (skinId: MoleSkinId) => void
}) {
  const [isShopOpen, setIsShopOpen] = useState(false)
  const pickerLevels = stagePickerDifficulty
    ? levels.filter((item) => item.difficulty === stagePickerDifficulty)
    : []
  const equippedSkin = getSkin(equippedSkinId)

  return (
    <div className="min-h-full w-full overflow-auto bg-[#f8f3ef] text-[#87515b]">
      <MoleStyles />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[30rem] flex-col overflow-hidden">
        <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 py-10 text-center">
          <div className="absolute right-5 top-5 rounded-full bg-white px-3.5 py-1.5 text-xs font-black text-[#9a5963] shadow-[0_8px_18px_rgba(132,87,80,0.12)]">
            Coin {coins}
          </div>
          <div className="flex h-24 w-24 items-center justify-center rounded-[30px] bg-white shadow-[0_16px_34px_rgba(132,87,80,0.16)]">
            <MoleFace large seed={1} skin={equippedSkin} />
          </div>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.3em] text-[#c08a93]">
            Moledoku
          </p>
          <h1 className="mt-2 text-[2.35rem] font-black leading-none tracking-tight text-[#99545f]">
            두더지 스도쿠
          </h1>
          <p className="mt-4 max-w-[18rem] break-keep text-sm font-medium leading-relaxed text-[#ab7d83]">
            색상·가로줄·세로줄마다 두더지를 한 마리씩 숨겨봐요.
          </p>

          <div className="mt-8 grid w-full max-w-[18.5rem] gap-3">
            {DIFFICULTIES.map((difficulty, index) => (
              <button
                key={difficulty}
                type="button"
                onClick={() => openStagePicker(difficulty)}
                className="flex items-center justify-between rounded-[20px] bg-white px-7 py-4 text-left shadow-[0_10px_22px_rgba(132,87,80,0.12)] transition active:scale-[0.97]"
              >
                <span className="text-lg font-extrabold tracking-tight text-[#99545f]">
                  {difficulty}
                </span>
                <span className="text-xs font-semibold tracking-wide text-[#bd8d94]">
                  {['쉬움', '보통', '어려움'][index]}
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsShopOpen(true)}
              className="mt-1 rounded-[20px] bg-[#99545f] px-7 py-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(132,87,80,0.18)] transition active:scale-[0.97]"
            >
              상점
            </button>
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
        {isShopOpen && (
          <SkinShop
            coins={coins}
            ownedSkinIds={ownedSkinIds}
            equippedSkinId={equippedSkinId}
            onClose={() => setIsShopOpen(false)}
            onBuy={buySkin}
            onEquip={equipSkin}
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

function SkinShop({
  coins,
  ownedSkinIds,
  equippedSkinId,
  onClose,
  onBuy,
  onEquip,
}: {
  coins: number
  ownedSkinIds: Set<MoleSkinId>
  equippedSkinId: MoleSkinId
  onClose: () => void
  onBuy: (skinId: MoleSkinId) => void
  onEquip: (skinId: MoleSkinId) => void
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#3d2d22]/35 p-7 backdrop-blur-sm">
      <div className="max-h-[calc(100dvh-3rem)] w-full max-w-[24rem] overflow-y-auto rounded-[30px] bg-[#fff8f3] px-7 pb-9 pt-7 text-center shadow-[0_20px_42px_rgba(72,45,35,0.24)]">
        <div className="flex items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#c08a93]">Shop</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-[#99545f]">두더지 상점</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-white px-3 py-2 text-sm font-black text-[#9a5963] shadow-[0_5px_14px_rgba(132,87,80,0.1)]">
              Coin {coins}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="상점 닫기"
              className="flex h-10 w-10 items-center justify-center rounded-full border-0 bg-[#f1e5df] text-xl font-semibold leading-none text-[#a4707a] outline-none transition active:scale-90"
            >
              x
            </button>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3.5">
          {MOLE_SKINS.map((skin) => {
            const isOwned = ownedSkinIds.has(skin.id)
            const isEquipped = equippedSkinId === skin.id
            const canBuy = coins >= skin.price
            const actionText = isEquipped ? '장착중' : isOwned ? '장착' : canBuy ? '구매' : '부족'

            return (
              <div
                key={skin.id}
                className="rounded-[22px] bg-white p-4 shadow-[0_8px_18px_rgba(132,87,80,0.1)]"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#f7ede6]">
                  <MoleFace large seed={skin.price + 11} skin={skin} />
                </div>
                <h3 className="mt-3 break-keep text-sm font-black text-[#99545f]">{skin.name}</h3>
                <p className="mt-1 text-xs font-bold text-[#b7868c]">
                  {skin.price === 0 ? 'Free' : `Coin ${skin.price}`}
                </p>
                <button
                  type="button"
                  disabled={isEquipped || (!isOwned && !canBuy)}
                  onClick={() => {
                    if (isOwned) onEquip(skin.id)
                    else onBuy(skin.id)
                  }}
                  className={`mt-3 w-full rounded-[14px] px-3 py-2 text-sm font-black transition active:scale-95 disabled:active:scale-100 ${
                    isEquipped
                      ? 'bg-[#eadbd4] text-[#8f5360]'
                      : isOwned || canBuy
                        ? 'bg-[#99545f] text-white'
                        : 'bg-[#eee3dd] text-[#b99ca0]'
                  }`}
                >
                  {actionText}
                </button>
              </div>
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
  equippedSkin,
}: {
  level: Level
  levelIndex: number
  availableLevels: Level[]
  setLevelIndex: Dispatch<SetStateAction<number>>
  returnToMenu: () => void
  markStageComplete: (difficulty: Difficulty, index: number) => boolean
  equippedSkin: MoleSkin
}) {
  const [board, setBoard] = useState<Board>(() => createBoard(level))
  const [hearts, setHearts] = useState(3)
  const [mode, setMode] = useState<Mode>('cat')
  const [status, setStatus] = useState<Status>('playing')
  const [history, setHistory] = useState<Snapshot[]>([])
  const [hint, setHint] = useState<Coord | null>(null)
  const [mistake, setMistake] = useState<Coord | null>(null)
  const [clearReward, setClearReward] = useState<number | null>(null)
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
      const rewarded = markStageComplete(level.difficulty, levelIndex)
      setClearReward(rewarded ? CLEAR_REWARD_COINS : 0)
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
    setClearReward(null)
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
              <MoleFace tiny seed={2} skin={equippedSkin} />
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
                  skin={equippedSkin}
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
              <MoleFace tiny seed={3} skin={equippedSkin} />
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
              <MoleFace large seed={status === 'won' ? 4 : 7} skin={equippedSkin} />
            </div>
            <h2 className="mt-5 text-2xl font-black tracking-tight text-[#99545f]">
              {status === 'won' ? '찾았다!' : '앗, 막혔어요'}
            </h2>
            <p className="mt-2.5 text-sm font-medium leading-relaxed text-[#a87d81]">
              {status === 'won'
                ? '모든 두더지가 자기 색깔 굴을 찾았어요.'
                : '되돌리거나 다시 시작해봐요.'}
            </p>
            {status === 'won' && clearReward !== null && (
              <p className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-black text-[#c07a3f] shadow-[0_5px_14px_rgba(132,87,80,0.1)]">
                {clearReward > 0 ? `+${clearReward} Coin` : 'Reward already claimed'}
              </p>
            )}
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
  skin,
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
  skin: MoleSkin
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
      {cell === 'cat' && <MoleFace seed={row * 7 + col + 1} skin={skin} />}
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

// Shared arch-shaped head silhouette.
const HEAD_D = 'M6 50 A44 44 0 0 1 94 50 L94 86 Q94 96 84 96 L16 96 Q6 96 6 86 Z'

// A chubby five-point star: the matching-colour round-joined stroke softens the
// points so it reads as cute rather than spiky.
function starD(cx: number, cy: number, r: number): string {
  let d = ''
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rad = i % 2 ? r * 0.55 : r
    d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rad).toFixed(1)} ${(cy + Math.sin(a) * rad).toFixed(1)}`
  }
  return `${d}Z`
}

function RoundStar({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  return (
    <path d={starD(cx, cy, r)} fill={fill} stroke={fill} strokeWidth={r * 0.4} strokeLinejoin="round" />
  )
}

// A single cotyledon leaf (rounded base, pointed tip) with a midrib, drawn in
// local coords and positioned via the transform props.
const SPROUT_LEAF = 'M0 -15 Q9 -3 5.5 9 Q2.5 14.5 0 14.5 Q-2.5 14.5 -5.5 9 Q-9 -3 0 -15 Z'
const SPROUT_MIDRIB = 'M0 13 Q1.4 0 0 -12.5'

function SproutLeaf({ cx, cy, rot, scale }: { cx: number; cy: number; rot: number; scale: number }) {
  return (
    <g transform={`translate(${cx} ${cy}) rotate(${rot}) scale(${scale})`}>
      <path d={SPROUT_LEAF} fill="#5fb24f" stroke="#4a9a45" strokeWidth={1} strokeLinejoin="round" />
      <path d={SPROUT_LEAF} transform="translate(0 2) scale(0.6)" fill="#86d56f" />
      <path d={SPROUT_MIDRIB} fill="none" stroke="#4a9a45" strokeWidth={1.3} strokeLinecap="round" />
    </g>
  )
}

function MoleFace({
  large = false,
  tiny = false,
  seed = 0,
  skin = getSkin(DEFAULT_SKIN_ID),
}: {
  large?: boolean
  tiny?: boolean
  seed?: number
  skin?: MoleSkin
}) {
  // Desync instances a little so a board full of moles doesn't blink in unison.
  const blinkDelay = `${-((seed * 0.53) % 4.8).toFixed(2)}s`
  const toothDelay = `${-((seed * 0.37) % 1.9).toFixed(2)}s`
  const sizeClass = large ? 'mx-auto h-16 w-16' : tiny ? 'h-6 w-6' : 'h-[78%] w-[78%]'
  const gid = useId()

  // overflow visible lets tall hats and chubby cheeks spill past the viewBox.
  const svgProps = {
    viewBox: '0 0 100 100',
    overflow: 'visible',
    className: `block ${sizeClass}`,
    'aria-hidden': true,
  } as const

  // ── Hamster: its own chubby silhouette (round ears, bulging cheeks, buck teeth) ──
  if (skin.kind === 'hamster') {
    return (
      <svg {...svgProps}>
        {/* ears */}
        <circle cx="25" cy="17" r="12" fill={skin.head} />
        <circle cx="75" cy="17" r="12" fill={skin.head} />
        <circle cx="25" cy="18" r="6" fill="#f2b6bf" />
        <circle cx="75" cy="18" r="6" fill="#f2b6bf" />
        {/* head + cheeks (same colour, bulging past the sides for a chubby look) */}
        <circle cx="11" cy="72" r="19" fill={skin.head} />
        <circle cx="89" cy="72" r="19" fill={skin.head} />
        <path d={HEAD_D} fill={skin.head} />
        <circle cx="11" cy="72" r="19" fill={skin.head} />
        <circle cx="89" cy="72" r="19" fill={skin.head} />
        {/* eyes */}
        <g className="moledoku-eye" style={{ animationDelay: blinkDelay }}>
          <circle cx="34" cy="43" r="4.6" fill="#3a2f24" />
          <circle cx="35.5" cy="41.5" r="1.5" fill="#ffffff" />
        </g>
        <g className="moledoku-eye" style={{ animationDelay: blinkDelay }}>
          <circle cx="66" cy="43" r="4.6" fill="#3a2f24" />
          <circle cx="67.5" cy="41.5" r="1.5" fill="#ffffff" />
        </g>
        {/* whiskers */}
        <g stroke="#a07f55" strokeWidth="1.3" strokeLinecap="round" opacity="0.7">
          <line x1="34" y1="60" x2="14" y2="57" />
          <line x1="34" y1="64" x2="14" y2="66" />
          <line x1="66" y1="60" x2="86" y2="57" />
          <line x1="66" y1="64" x2="86" y2="66" />
        </g>
        {/* nose */}
        <path d="M46 53 Q50 50 54 53 Q52 58 50 58 Q48 58 46 53 Z" fill={skin.nose} />
        {/* front teeth (gentle nibble) */}
        <g className="moledoku-tooth" style={{ animationDelay: toothDelay }}>
          <rect x="47.2" y="58" width="2.8" height="8" rx="1.1" fill="#fffdf7" />
          <rect x="50" y="58" width="2.8" height="8" rx="1.1" fill="#fffdf7" />
        </g>
      </svg>
    )
  }

  // ── Mole-based skins ──
  const isStar = skin.accessory === 'star'
  const headClip = `mole-clip-${gid}`

  return (
    <svg {...svgProps}>
      {isStar && (
        <defs>
          <clipPath id={headClip}>
            {/* keep the head below the cap brim so it never pokes out the top */}
            <rect x="-12" y="33" width="124" height="80" />
          </clipPath>
        </defs>
      )}

      {/* head */}
      <path d={HEAD_D} fill={skin.head} clipPath={isStar ? `url(#${headClip})` : undefined} />

      {/* simple hats that sit on the head, behind the eyes */}
      {skin.accessory === 'helmet' && (
        <g>
          {/* brim */}
          <ellipse cx="50" cy="24" rx="27" ry="4.6" fill="#d8962a" />
          {/* dome */}
          <path d="M28 24 Q31 4 50 2 Q69 4 72 24 Z" fill="#f1b63d" />
          {/* crest */}
          <path d="M50 3 Q49 13 50 23" fill="none" stroke="#ffd066" strokeWidth={2.3} strokeLinecap="round" />
          <ellipse cx="41" cy="12" rx="3.6" ry="7" fill="#ffffff" opacity="0.18" transform="rotate(-18 41 12)" />
          {/* headlamp */}
          <circle cx="50" cy="13.5" r="4.7" fill="#3c3a44" />
          <circle cx="50" cy="13.5" r="2.9" fill="#fff4bd" />
          <circle cx="49" cy="12.6" r="1" fill="#ffffff" />
        </g>
      )}
      {skin.accessory === 'sprout' && (
        <g>
          <path d="M50 27 Q47 17 50 8" fill="none" stroke="#4a9a45" strokeWidth={3.4} strokeLinecap="round" />
          <SproutLeaf cx={43} cy={9} rot={-48} scale={1} />
          <SproutLeaf cx={58} cy={7} rot={44} scale={1.12} />
        </g>
      )}
      {skin.accessory === 'berry' && (
        <g>
          <circle cx="50" cy="20" r="10" fill="#ef5f72" />
          <path d="M45 12 L50 7 L55 12" fill="none" stroke="#6baa60" strokeWidth="3" />
        </g>
      )}

      {/* eyes (simple dots, blink together) */}
      <g className="moledoku-eye" style={{ animationDelay: blinkDelay }}>
        <circle cx="32" cy="40" r="4.4" fill="#3a322c" />
      </g>
      <g className="moledoku-eye" style={{ animationDelay: blinkDelay }}>
        <circle cx="68" cy="40" r="4.4" fill="#3a322c" />
      </g>

      {/* star skin: sleepy blush */}
      {isStar && (
        <>
          <ellipse cx="22" cy="52" rx="6" ry="4" fill="#e891ad" opacity="0.55" />
          <ellipse cx="78" cy="52" rx="6" ry="4" fill="#e891ad" opacity="0.55" />
        </>
      )}

      {/* muzzle */}
      <ellipse cx="37" cy="70" rx="16.5" ry="15.5" fill={skin.muzzle} />
      <ellipse cx="63" cy="70" rx="16.5" ry="15.5" fill={skin.muzzle} />

      {/* tooth tucked into the muzzle (gentle nibble) */}
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

      {/* nose */}
      <circle cx="50" cy="55" r="7.2" fill={skin.nose} />

      {/* star skin: cone nightcap on top (head is clipped so nothing pokes out) */}
      {isStar && (
        <>
          <path d="M5 34 Q26 9 49 3 Q52 1 55 3 Q74 9 95 34 Z" fill="#5b54a6" />
          <RoundStar cx={56} cy={5} r={5.5} fill="#ffd65a" />
          <path d="M3 34 Q50 30 97 34 L96 27 Q50 23 4 27 Z" fill="#d7caf2" />
          <RoundStar cx={47} cy={25} r={2.6} fill="#ffe27a" />
          <RoundStar cx={42} cy={17} r={2.3} fill="#ffe27a" />
          <RoundStar cx={57} cy={17} r={2.3} fill="#ffe27a" />
          <RoundStar cx={49} cy={10} r={2.2} fill="#ffe27a" />
        </>
      )}
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
