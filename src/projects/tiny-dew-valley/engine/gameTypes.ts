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
}
