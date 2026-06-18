// Boarding-zone state transitions (pure data; animation lives in Game).

import type { GameState, ZoneSlot } from './GameState'
import { remove } from './GridLogic'
import type { Vehicle } from './types'

// Move a vehicle off the grid into the first free boarding-zone slot.
// Caller must have already verified the slot is free and the exit is clear.
export function parkInZone(state: GameState, vehicle: Vehicle): number {
  const slotIndex = state.freeSlotIndex()
  if (slotIndex === -1) return -1
  remove(state.grid, vehicle)
  state.vehicles.delete(vehicle.id)
  vehicle.boarded = 0
  state.zone[slotIndex] = { vehicle, seq: state.zoneSeq++, arrived: false }
  return slotIndex
}

// Returns the next boarding action (front passenger -> matching zone vehicle),
// or null when the front passenger can't board anything right now.
export function nextBoarding(state: GameState): ZoneSlot | null {
  return state.matchForFront()
}

// Apply one boarding: consume the front passenger into the given slot.
// Returns true if the vehicle is now full and should depart.
export function applyBoarding(state: GameState, slot: ZoneSlot): boolean {
  state.queue.shift()
  slot.vehicle.boarded++
  return slot.vehicle.boarded >= slot.vehicle.capacity
}

export function departFromZone(state: GameState, slot: ZoneSlot): void {
  const i = state.zone.indexOf(slot)
  if (i !== -1) state.zone[i] = null
}
