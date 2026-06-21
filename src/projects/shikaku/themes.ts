// Theme Store — each theme is a set of CSS-variable values applied to the game
// root, so equipping a theme instantly restyles the entire app.

export type ThemeId = 'cream' | 'matcha' | 'midnight' | 'terracotta' | 'mono'

export type Theme = {
  id: ThemeId
  name: string
  cost: number
  /** Tiny swatches for the store card preview. */
  swatch: string[]
  /** CSS custom properties applied to the root element. */
  vars: Record<string, string>
  /**
   * When true, filled blocks use SVG patterns (referenced as url(#shikaku-pat-N))
   * instead of flat colours — used by the e-ink Monochrome theme.
   */
  patterns?: boolean
}

// Block fill variables are --block-0 .. --block-4. For pattern themes the board
// substitutes url(#shikaku-pat-N) fills instead.

export const THEMES: Record<ThemeId, Theme> = {
  cream: {
    id: 'cream',
    name: '포근한 크림',
    cost: 0,
    swatch: ['#EC6B6B', '#EFE07D', '#A68A72', '#88B09A'],
    vars: {
      '--bg': '#F7F5F0',
      '--surface': '#FFFFFF',
      '--text': '#332E2B',
      '--text-soft': '#8C857F',
      '--cell': '#FFFFFF',
      '--cell-line': '#ECE8E1',
      '--shadow': 'rgba(0,0,0,0.04)',
      '--shadow-strong': 'rgba(0,0,0,0.10)',
      '--accent': '#EC6B6B',
      '--on-accent': '#FFFFFF',
      '--block-0': '#EC6B6B',
      '--block-1': '#EFE07D',
      '--block-2': '#A68A72',
      '--block-3': '#88B09A',
      '--block-4': '#D79BC4',
      '--block-text': '#3A322E',
    },
  },
  matcha: {
    id: 'matcha',
    name: '말차 정원',
    cost: 200,
    swatch: ['#7FB069', '#C3D7A4', '#A3B18A', '#E9C46A'],
    vars: {
      '--bg': '#EAEFE9',
      '--surface': '#F6F9F4',
      '--text': '#243325',
      '--text-soft': '#6E7E6B',
      '--cell': '#FBFDF9',
      '--cell-line': '#DBE4D6',
      '--shadow': 'rgba(40,70,40,0.05)',
      '--shadow-strong': 'rgba(40,70,40,0.12)',
      '--accent': '#7FB069',
      '--on-accent': '#FFFFFF',
      '--block-0': '#7FB069',
      '--block-1': '#C3D7A4',
      '--block-2': '#A3B18A',
      '--block-3': '#E9C46A',
      '--block-4': '#9BC1BC',
      '--block-text': '#22321F',
    },
  },
  midnight: {
    id: 'midnight',
    name: '한밤의 베리',
    cost: 400,
    swatch: ['#FF6FB5', '#5CE1E6', '#B388FF', '#FFD56B'],
    vars: {
      '--bg': '#1A1B2F',
      '--surface': '#24264180',
      '--text': '#E6E3FF',
      '--text-soft': '#9A98C7',
      '--cell': '#23253E',
      '--cell-line': '#34375A',
      '--shadow': 'rgba(0,0,0,0.30)',
      '--shadow-strong': 'rgba(0,0,0,0.50)',
      '--accent': '#FF6FB5',
      '--on-accent': '#1A1B2F',
      '--block-0': '#FF6FB5',
      '--block-1': '#5CE1E6',
      '--block-2': '#B388FF',
      '--block-3': '#FFD56B',
      '--block-4': '#7CF59B',
      '--block-text': '#1A1B2F',
    },
  },
  terracotta: {
    id: 'terracotta',
    name: '테라코타 노을',
    cost: 600,
    swatch: ['#D7793D', '#C97B84', '#E0A458', '#A86B4C'],
    vars: {
      '--bg': '#F2E7DC',
      '--surface': '#FBF4EC',
      '--text': '#4A352A',
      '--text-soft': '#9C8273',
      '--cell': '#FCF6EF',
      '--cell-line': '#E6D6C6',
      '--shadow': 'rgba(90,50,20,0.05)',
      '--shadow-strong': 'rgba(90,50,20,0.14)',
      '--accent': '#D7793D',
      '--on-accent': '#FFFFFF',
      '--block-0': '#D7793D',
      '--block-1': '#C97B84',
      '--block-2': '#E0A458',
      '--block-3': '#A86B4C',
      '--block-4': '#8FA37E',
      '--block-text': '#3D2A1F',
    },
  },
  mono: {
    id: 'mono',
    name: '모노크롬 1984',
    cost: 1000,
    patterns: true,
    swatch: ['#FAFAFA', '#000000', '#FAFAFA', '#000000'],
    vars: {
      '--bg': '#FAFAFA',
      '--surface': '#FFFFFF',
      '--text': '#0A0A0A',
      '--text-soft': '#666666',
      '--cell': '#FFFFFF',
      '--cell-line': '#0A0A0A',
      '--shadow': 'rgba(0,0,0,0.06)',
      '--shadow-strong': 'rgba(0,0,0,0.20)',
      '--accent': '#0A0A0A',
      '--on-accent': '#FAFAFA',
      // Flat fallbacks (unused while patterns render, but keep vars defined).
      '--block-0': '#FFFFFF',
      '--block-1': '#FFFFFF',
      '--block-2': '#FFFFFF',
      '--block-3': '#FFFFFF',
      '--block-4': '#FFFFFF',
      '--block-text': '#0A0A0A',
    },
  },
}

export const THEME_ORDER: ThemeId[] = ['cream', 'matcha', 'midnight', 'terracotta', 'mono']

export const DEFAULT_THEME: ThemeId = 'cream'

// Five distinct SVG fill patterns (as data-URI background images) used by the
// Monochrome e-ink theme in place of flat block colours. Each tiles cleanly.
const svg = (inner: string) =>
  `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12'>${inner}</svg>")`

export const MONO_PATTERNS: string[] = [
  svg(`<path d='M0 12 L12 0 M-3 3 L3 -3 M9 15 L15 9' stroke='%230A0A0A' stroke-width='1.5'/>`),
  svg(`<circle cx='3' cy='3' r='1.8' fill='%230A0A0A'/><circle cx='9' cy='9' r='1.8' fill='%230A0A0A'/>`),
  svg(`<path d='M0 12 L12 0 M0 0 L12 12 M-3 3 L3 -3 M9 15 L15 9 M-3 9 L3 15 M9 -3 L15 3' stroke='%230A0A0A' stroke-width='1.1'/>`),
  svg(`<path d='M3 0 V12 M9 0 V12' stroke='%230A0A0A' stroke-width='1.8'/>`),
  svg(`<path d='M0 6 H12 M6 0 V12' stroke='%230A0A0A' stroke-width='1.3'/>`),
]
