import { BackIcon, CoinIcon, GearIcon } from './icons'

type Props = {
  title: string
  coins: number
  onBack: () => void
  onSettings: () => void
}

export default function Header({ title, coins, onBack, onSettings }: Props) {
  return (
    <div className="sk-header">
      <button className="sk-iconbtn" onClick={onBack} aria-label="Back">
        <BackIcon size={22} />
      </button>
      <span className="sk-title">{title}</span>
      <span className="sk-coin">
        <CoinIcon size={18} />
        {coins}
      </span>
      <button className="sk-iconbtn" onClick={onSettings} aria-label="Settings & Store">
        <GearIcon size={22} />
      </button>
    </div>
  )
}
