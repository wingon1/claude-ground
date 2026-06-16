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
    id: 'cozy-cove',
    title: 'Opus 4.8 높음 모델',
    description: 'A hand-held 3D diorama you can orbit around — cottage, trees, mushrooms and a little stream.',
    emoji: '🍃',
    tags: ['react', 'three.js', '3d'],
    kind: 'react',
    load: () => import('./cozy-cove/CozyCove'),
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
