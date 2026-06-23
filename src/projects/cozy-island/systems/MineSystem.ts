import { MineLevels } from '../content'
import type { GameState, MineDropDef, MineLevelDef, Vec, WorldNode } from '../types'
import { meetsCondition } from '../game/GameState'

function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr]
  const rnd = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

function weightedDrop(drops: MineDropDef[]): MineDropDef {
  let total = 0
  for (const d of drops) total += d.weight
  let r = Math.random() * total
  for (const d of drops) {
    r -= d.weight
    if (r <= 0) return d
  }
  return drops[drops.length - 1]
}

export class MineSystem {
  floorConfig(floor: number): MineLevelDef {
    return MineLevels.floors.find((f) => f.floor === floor) || MineLevels.floors[0]
  }

  maxFloor(): number {
    return Math.max(...MineLevels.floors.map((f) => f.floor))
  }

  resetRun(state: GameState) {
    state.mineCurrentFloor = 1
    state.mineMinedNodes = {}
  }

  buildFloor(state: GameState, anchors: Vec[]): WorldNode[] {
    const floor = state.mineCurrentFloor
    const conf = this.floorConfig(floor)
    const mined = new Set(state.mineMinedNodes[String(floor)] || [])
    const seed = 92821 + floor * 997 + state.counters.sleeps * 389
    const anchorIndexes = shuffle(anchors.map((_, i) => i), seed).slice(0, Math.min(conf.nodeCount, anchors.length))

    return anchorIndexes
      .filter((anchorIndex) => !mined.has(anchorIndex))
      .map((anchorIndex) => ({
        id: floor * 1000 + anchorIndex + 1,
        type: 'mine_ore',
        pos: { ...anchors[anchorIndex] },
        hp: conf.nodeHp,
        alive: true,
        respawnAt: 0,
        shakeUntil: 0,
      }))
  }

  staminaCost(floor: number): number {
    return this.floorConfig(floor).staminaCost
  }

  mineNode(state: GameState, node: WorldNode): MineDropDef {
    const floor = state.mineCurrentFloor
    const anchorIndex = (node.id % 1000) - 1
    const key = String(floor)
    const mined = state.mineMinedNodes[key] || []
    if (!mined.includes(anchorIndex)) state.mineMinedNodes[key] = [...mined, anchorIndex]
    state.mineDeepestFloor = Math.max(state.mineDeepestFloor, floor)
    return weightedDrop(this.floorConfig(floor).drops)
  }

  descendInfo(state: GameState): { can: boolean; reason?: string } {
    const current = this.floorConfig(state.mineCurrentFloor)
    const next = MineLevels.floors.find((f) => f.floor === state.mineCurrentFloor + 1)
    if (!next) return { can: false, reason: '가장 깊은 층이에요' }
    if (!meetsCondition(state, next.unlockCondition)) return { can: false, reason: '아직 길이 열리지 않았어요' }

    const required = current.descendRequirement?.minedNodes || 0
    const mined = state.mineMinedNodes[String(current.floor)]?.length || 0
    if (mined < required) return { can: false, reason: `${required - mined}개 더 캐야 해요` }

    return { can: true }
  }

  descend(state: GameState): boolean {
    if (!this.descendInfo(state).can) return false
    state.mineCurrentFloor += 1
    return true
  }
}
