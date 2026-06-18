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

export type Project = ReactProject | IframeProject

/**
 * Add new works here. The home screen renders this list automatically, and
 * nothing here runs until its card is clicked.
 */
export const projects: Project[] = [
  {
    id: 'car-jam',
    title: '🚗 Car Jam — Color Boarding Puzzle',
    description:
      'Tap colour-coded cars out of a jammed lot so the queue of matching passengers can board. 100 procedurally generated, always-solvable stages. Portrait, mobile-first.',
    emoji: '🚗',
    tags: ['react', 'three.js', '3d', 'puzzle'],
    kind: 'react',
    load: () => import('./car-jam'),
  },
  {
    id: 'cozy-cove',
    title: '3D - Opus 4.8 높음 cozy-cove',
    description: '오브젝트 2번 수정',
    emoji: '🍃',
    tags: ['react', 'three.js', '3d'],
    kind: 'react',
    load: () => import('./cozy-cove/CozyCove'),
  },
  {
    id: 'pixel-village',
    title: '2D - Opus 4.8 높음 pixel-village',
    description: '픽셀 퀄리티 테스트..... 1회 요청 다듬으면 사용할만할지도',
    emoji: '🏡',
    tags: ['react', 'canvas', 'pixel-art'],
    kind: 'react',
    load: () => import('./pixel-village'),
  },
  {
    id: 'bouncing-orbs',
    title: 'Bouncing Orbs',
    description: 'A tiny zero-dependency canvas toy: colorful orbs bouncing with gravity. Plain HTML + JS.',
    emoji: '🟣',
    tags: ['html', 'canvas'],
    kind: 'iframe',
    path: 'projects/bouncing-orbs/index.html',
  },
]

export function findProject(id: string | undefined): Project | undefined {
  return projects.find((p) => p.id === id)
}
