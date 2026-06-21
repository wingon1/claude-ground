import type { Tool } from './Board'
import { EraserIcon, HintIcon, UndoIcon, WandIcon } from './icons'

export const WAND_COST = 20

type Props = {
  tool: Tool
  onToggleEraser: () => void
  onUndo: () => void
  onHint: () => void
  onWand: () => void
  canUndo: boolean
  canWand: boolean
}

export default function Toolbar({ tool, onToggleEraser, onUndo, onHint, onWand, canUndo, canWand }: Props) {
  return (
    <div className="sk-toolbar">
      <button
        className={`sk-tool${tool === 'eraser' ? ' active' : ''}`}
        onClick={onToggleEraser}
        aria-label="지우개"
      >
        <EraserIcon size={22} />
        <span className="sk-tool-label">지우개</span>
      </button>
      <button className="sk-tool" onClick={onUndo} disabled={!canUndo} aria-label="되돌리기">
        <UndoIcon size={22} />
        <span className="sk-tool-label">되돌리기</span>
      </button>
      <button className="sk-tool" onClick={onHint} aria-label="힌트">
        <HintIcon size={22} />
        <span className="sk-tool-label">힌트</span>
      </button>
      <button className="sk-tool" onClick={onWand} disabled={!canWand} aria-label="요술봉">
        <span className="sk-tool-cost">{WAND_COST}</span>
        <WandIcon size={22} />
        <span className="sk-tool-label">요술봉</span>
      </button>
    </div>
  )
}
