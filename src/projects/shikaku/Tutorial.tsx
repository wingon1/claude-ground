// First-run tutorial. Shown once (cached via SaveState.tutorialSeen) and
// dismissed with a single button that doubles as the skip action.

type Props = {
  onClose: () => void
}

const STEPS = [
  { icon: '✏️', text: '드래그해서 사각형을 그려요' },
  { icon: '🔢', text: '사각형 안엔 숫자 하나! 칸 수 = 숫자가 되게 묶어요' },
  { icon: '👆', text: '색칠된 칸을 톡 누르면 지워져요' },
]

export default function Tutorial({ onClose }: Props) {
  return (
    <div className="sk-modal-back">
      <div className="sk-modal">
        <div className="sk-modal-head">
          <h2>어떻게 하나요?</h2>
        </div>

        {STEPS.map((s, i) => (
          <div className="sk-tut-step" key={i}>
            <span className="sk-tut-icon">{s.icon}</span>
            <span>{s.text}</span>
          </div>
        ))}

        <button className="sk-btn" style={{ width: '100%', marginTop: 14, padding: '13px 0' }} onClick={onClose}>
          시작할게요!
        </button>
      </div>
    </div>
  )
}
