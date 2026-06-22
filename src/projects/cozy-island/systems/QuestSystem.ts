import type { GameState, QuestDef } from '../types'
import { Quests } from '../content'
import { invAdd } from '../game/GameState'

export function questProgress(s: GameState, q: QuestDef): number {
  const o = q.objective
  switch (o.type) {
    case 'chop': return s.counters.treeChop
    case 'mine': return s.counters.rockMine + s.counters.oreMine
    case 'harvest': return s.counters.harvest
    case 'collectAnimal': return s.counters.animalCollect
    case 'sleep': return s.counters.sleeps
    case 'maxStamina': return s.maxStamina
    case 'gold': return s.gold
    case 'collectItem': return s.itemTotals[o.itemId || ''] || 0
    case 'sell': return s.counters.totalSalesGold
    case 'buyPlot': return s.counters.plotsBought
    case 'build': return s.buildings[o.buildingId || '']?.built ? 1 : 0
    case 'craft': return s.craftTotals[o.recipeId || ''] || 0
    case 'staminaEmpty': return s.counters.staminaEmptyCount
  }
}

export function isQuestActive(s: GameState, q: QuestDef): boolean {
  if (s.quests[q.id]?.done) return false
  if (q.requires && !s.quests[q.requires]?.done) return false
  return true
}

export function activeQuests(s: GameState): QuestDef[] {
  return Quests.filter((q) => isQuestActive(s, q))
}

/** Completes any newly-finished active quests, grants rewards. Returns completed defs. */
export function checkQuests(s: GameState): QuestDef[] {
  const completed: QuestDef[] = []
  let changed = true
  // loop so chained quests that complete instantly cascade
  while (changed) {
    changed = false
    for (const q of Quests) {
      if (!isQuestActive(s, q)) continue
      if (questProgress(s, q) >= q.objective.target) {
        s.quests[q.id] = { done: true, claimed: true }
        if (q.reward.gold) s.gold += q.reward.gold
        if (q.reward.gems) s.gems += q.reward.gems
        if (q.reward.items) for (const it of q.reward.items) invAdd(s, it.itemId, it.amount)
        completed.push(q)
        changed = true
      }
    }
  }
  return completed
}
