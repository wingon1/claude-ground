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
        aria-label="Eraser"
      >
        <EraserIcon size={22} />
        <span className="sk-tool-label">Eraser</span>
      </button>
      <button className="sk-tool" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
        <UndoIcon size={22} />
        <span className="sk-tool-label">Undo</span>
      </button>
      <button className="sk-tool" onClick={onHint} aria-label="Hint">
        <HintIcon size={22} />
        <span className="sk-tool-label">Hint</span>
      </button>
      <button className="sk-tool" onClick={onWand} disabled={!canWand} aria-label="Magic Wand">
        <span className="sk-tool-cost">{WAND_COST}</span>
        <WandIcon size={22} />
        <span className="sk-tool-label">Wand</span>
      </button>
    </div>
  )
}
