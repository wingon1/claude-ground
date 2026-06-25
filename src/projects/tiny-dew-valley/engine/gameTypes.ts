import type { MonsterId } from '../data/monsters'

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
  gravity: number
  additive: boolean
}

export interface Firefly {
  x: number
  y: number
  phase: number
  speed: number
}

export type SpeechSpeaker = 'player' | 'shop' | 'blacksmith'

export interface SpeechBubble {
  speaker: SpeechSpeaker
  text: string
  until: number
}

export type Period = 'morning' | 'afternoon' | 'golden' | 'night'

export type WorkKind = 'pickup' | 'harvest' | 'chop' | 'plant'

export interface MineMonster {
  uid: string
  id: MonsterId
  x: number
  y: number
  hp: number
  maxHp: number
  hitT: number
  attackT: number
  // Boss (mine_guardian) only — gooey ooze behaviour.
  castT?: number // attack telegraph timer (mouth swells, body puffs)
  fireT?: number // countdown until the queued spray launches
  trailT?: number // cadence accumulator for dropping slime trails
}

/** Fading liquid smear the ooze boss leaves behind / splatter decals. */
export interface SlimeTrail {
  x: number
  y: number
  life: number
  max: number
  r: number
  seed: number
}

/** A glob of dirty liquid hurled by the ooze boss. */
export interface SlimeBlob {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  r: number
  spin: number
  hit: boolean
}
