// All icons are inline SVG — zero external assets. They inherit `currentColor`.

type P = { size?: number; className?: string }

const base = (size = 24): { width: number; height: number; viewBox: string; fill: string; stroke: string; strokeWidth: number; strokeLinecap: 'round'; strokeLinejoin: 'round' } => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
})

export function BackIcon({ size, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function GearIcon({ size, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5l1.3 2.2 2.5-.5.4 2.5 2.2 1.3-1 2.3 1 2.3-2.2 1.3-.4 2.5-2.5-.5L12 21.5l-1.3-2.2-2.5.5-.4-2.5L5.6 16l1-2.3-1-2.3 2.2-1.3.4-2.5 2.5.5z" />
    </svg>
  )
}

export function EraserIcon({ size, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M4 15.5l6-6 5 5-4.5 4.5H7z" />
      <path d="M10 9.5l4-4a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3l-4 4" />
      <path d="M6 19.5h13" />
    </svg>
  )
}

export function UndoIcon({ size, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M4 8h9a5 5 0 1 1 0 10H8" />
      <path d="M4 8l4-4M4 8l4 4" />
    </svg>
  )
}

export function HintIcon({ size, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.3 1 2.5h6c0-1.2.4-1.9 1-2.5A6 6 0 0 0 12 3z" />
    </svg>
  )
}

export function WandIcon({ size, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M5 19l9-9" />
      <path d="M14 6l1.5 1.5" />
      <path d="M17 4l.5-1.5L19 2l-1.5-.5L17 0" transform="translate(0,3)" />
      <path d="M19 11l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
      <path d="M7 5l.5 1.3L8.8 6.8 7.5 7.3 7 8.6 6.5 7.3 5.2 6.8 6.5 6.3z" />
    </svg>
  )
}

export function CheckIcon({ size, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}

export function LockIcon({ size, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  )
}

export function CloseIcon({ size, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function SkipIcon({ size, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M5 5l8 7-8 7z" />
      <path d="M17 5v14" />
    </svg>
  )
}

export function SoundOnIcon({ size, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" />
      <path d="M15.5 9a4 4 0 0 1 0 6" />
      <path d="M18 6.5a8 8 0 0 1 0 11" />
    </svg>
  )
}

export function SoundOffIcon({ size, className }: P) {
  return (
    <svg {...base(size)} className={className} aria-hidden>
      <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" />
      <path d="M16 9.5l5 5M21 9.5l-5 5" />
    </svg>
  )
}

export function CoinIcon({ size = 18, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="#F2C14E" stroke="#C99A2E" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5.5" fill="none" stroke="#E0AE3C" strokeWidth="1.5" />
      <path d="M12 8.5v7M10 10.2h2.6a1.4 1.4 0 0 1 0 2.8H10h3" fill="none" stroke="#C99A2E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
