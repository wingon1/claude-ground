import type { ComponentType } from 'react'

/**
 * One entry per work in the gallery.
 *
 * Two kinds are supported so you can drop in almost anything:
 *
 *  - kind: 'react'  → a React component living under src/projects/<id>/.
 *                     `load` is a dynamic import so the project's code is only
 *                     downloaded and run when the visitor opens it (lazy).
 *
 *  - kind: 'iframe' → any self-contained static page (plain HTML, p5.js, a
 *                     canvas game, …) placed under public/projects/<id>/.
 *                     `path` is relative to the site base. It is loaded in an
 *                     iframe only when opened, so it never runs on the home grid.
 *
 *  - kind: 'external' → a work hosted elsewhere (its code is not in this repo).
 *                     `url` is the full external address. It is embedded in an
 *                     iframe when opened, so it runs in the viewer rather than
 *                     navigating away (with an "open in new tab" fallback).
 */
export type BaseProject = {
  id: string
  title: string
  /** One-line summary shown on the card. */
  description: string
  /** A big emoji used as the card's cover art (no image asset needed). */
  emoji: string
  /** Optional small tags rendered as chips on the card. */
  tags?: string[]
  /** Omit or true to show the card in the gallery; false hides it. */
  enabled?: boolean
}

export type ReactProject = BaseProject & {
  kind: 'react'
  load: () => Promise<{ default: ComponentType }>
}

export type IframeProject = BaseProject & {
  kind: 'iframe'
  /** Path under the site base, e.g. 'projects/foo/index.html'. */
  path: string
}

export type ExternalProject = BaseProject & {
  kind: 'external'
  /** Full external URL, e.g. 'https://example.com'. */
  url: string
}

export type Project = ReactProject | IframeProject | ExternalProject

/**
 * Add new works here. The home screen renders this list automatically, and
 * nothing here runs until its card is clicked.
 */
export const projects: Project[] = [
  {
    id: 'mole-region-puzzle',
    title: 'Moledoku',
    description:
      'A mole-region logic puzzle with solver-verified levels: one mole per row, column, and color region, with no diagonal touching.',
    emoji: '🐭',
    tags: ['react', 'logic', 'puzzle', 'levels'],
    kind: 'react',
    load: () => import('./cat-region-puzzle'),
  },
  {
    id: 'bus-escape',
    title: '🚌 Bus Escape: Traffic Jam',
    description:
      'A polished 3D portrait puzzle: slide forward-only buses out of a jam into a 4-slot boarding zone, then board colour-matched passengers from the queue. 100 procedurally generated, solver-verified levels.',
    emoji: '🚌',
    tags: ['react', 'three.js', '3d', 'puzzle', 'mobile'],
    kind: 'react',
    load: () => import('./bus-escape'),
  },
  {
    id: 'car-jam',
    title: '🚗 Car Jam — 3D Parking Puzzle',
    description:
      'Swipe colourful low-poly cars out of a jammed lot. 100 procedurally generated, always-solvable stages. Portrait, mobile-first.',
    emoji: '🚗',
    tags: ['react', 'three.js', '3d', 'puzzle'],
    kind: 'react',
    load: () => import('./car-jam'),
  },
  {
    id: 'cozy-cove',
    title: '3D - Opus 4.8 높음 cozy-cove',
    description: '오브젝트 2번 수정',
    enabled: false,
    emoji: '🍃',
    tags: ['react', 'three.js', '3d'],
    kind: 'react',
    load: () => import('./cozy-cove/CozyCove'),
  },
  {
    id: 'pixel-village',
    title: '2D - Opus 4.8 높음 pixel-village',
    description: '픽셀 퀄리티 테스트..... 1회 요청 다듬으면 사용할만할지도',
    enabled: false,
    emoji: '🏡',
    tags: ['react', 'canvas', 'pixel-art'],
    kind: 'react',
    load: () => import('./pixel-village'),
  },
  {
    id: 'bouncing-orbs',
    title: 'Bouncing Orbs',
    description: 'A tiny zero-dependency canvas toy: colorful orbs bouncing with gravity. Plain HTML + JS.',
    enabled: false,
    emoji: '🟣',
    tags: ['html', 'canvas'],
    kind: 'iframe',
    path: 'projects/bouncing-orbs/index.html',
  },
  {
    id: 'toduji',
    title: '🎵 토두지 리듬게임',
    description: '리듬에 맞춰 즐기는 리듬게임.',
    emoji: '🎵',
    tags: ['external', 'game', 'rhythm'],
    kind: 'external',
    url: 'https://toduji.netlify.app',
  },
  {
    id: 'tori-vs-dujo',
    title: '⚔️ 토리 vs 두지',
    description: '2D 대전 액션 게임.',
    emoji: '⚔️',
    tags: ['external', 'game', '2d', 'fighting'],
    kind: 'external',
    url: 'https://tori-vs-dujo.netlify.app',
  },
  {
    id: 'todu-island',
    title: '🏝️ 토두 아일랜드',
    description: '3D 탐험 게임.',
    emoji: '🏝️',
    tags: ['external', 'game', '3d'],
    kind: 'external',
    url: 'https://wingon1.github.io/todu-island-game/',
  },
  {
    id: 'backrooms',
    title: '🚪 백룸 게임',
    description: '백룸 분위기의 외부 배포 게임.',
    emoji: '🚪',
    tags: ['external', 'game', 'horror'],
    kind: 'external',
    url: 'https://teal-madeleine-fa6760.netlify.app/',
  },
]

export function findProject(id: string | undefined): Project | undefined {
  return projects.find((p) => p.id === id)
}
