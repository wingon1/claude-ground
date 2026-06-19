// Main orchestrator: renderer, audio, UI, input, the action loop & screen flow.

import { Renderer } from './Renderer'
import { AudioEngine } from './Audio'
import { UI } from './UI'
import { Input } from './Input'
import { GameState, MAX_LEVEL, saveProgress } from './GameState'
import { generateLevel, findParkingPlacement } from './LevelGenerator'
import { exitClear, clearAhead, place } from './GridLogic'
import { parkInZone, nextBoarding, applyBoarding, departFromZone } from './BoardingLogic'
import type { Vehicle } from './types'

export class Game {
  private host: HTMLElement
  private renderer: Renderer
  private audio: AudioEngine
  private ui: UI
  private input: Input
  private state = new GameState()
  private raf = 0
  private resizeObs: ResizeObserver | null = null
  private hintTimer = 0
  private busy = new Set<number>() // cars mid-bump/blocked animation
  private drivingCount = 0 // cars currently driving into the zone
  private boardingRunning = false // single boarding pump guard

  constructor(host: HTMLElement) {
    this.host = host
    this.renderer = new Renderer(host)
    this.audio = new AudioEngine(!this.state.progress.sound)
    this.ui = new UI(host, {
      onPlay: () => this.startLevel(this.state.progress.unlocked),
      onSelectLevel: (lvl) => this.startLevel(lvl),
      onOpenLevels: () => this.ui.showLevelSelect(this.state.progress),
      onMenu: () => this.ui.showTitle(),
      onRestart: () => (this.state.mode === 'endless' ? this.startEndless() : this.startLevel(this.state.level)),
      onNext: () => this.startLevel(Math.min(MAX_LEVEL, this.state.level + 1)),
      onToggleSound: () => this.toggleSound(),
      onHint: () => this.showHint(),
      onUnlockAll: () => this.unlockAll(),
      onEndless: () => this.startEndless(),
    })
    this.input = new Input(this.renderer, (id) => this.handleTap(id))
    this.ui.setSound(this.state.progress.sound)
  }

  start(): void {
    this.ui.showTitle()
    this.loop()
    window.addEventListener('resize', this.onResize)
    if ('ResizeObserver' in window) {
      this.resizeObs = new ResizeObserver(() => this.renderer.resize())
      this.resizeObs.observe(this.host)
    }
  }

  private onResize = (): void => this.renderer.resize()

  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop)
    this.renderer.update()
  }

  private startLevel(level: number): void {
    this.audio.resume()
    const lvl = generateLevel(level)
    this.state.loadLevel(lvl)
    this.busy.clear()
    this.drivingCount = 0
    this.boardingRunning = false
    this.renderer.buildLevel(this.state)
    this.ui.showGame()
    this.refreshHud()
  }

  private startEndless(): void {
    this.audio.resume()
    this.state.startEndless()
    this.busy.clear()
    this.drivingCount = 0
    this.boardingRunning = false
    this.renderer.buildEndless(this.state)
    this.ui.showGame(true)
    this.refreshHud()
  }

  private refreshHud(): void {
    if (this.state.mode === 'endless') {
      this.ui.updateHudEndless(this.state.score, this.state.zoneCount())
    } else {
      this.ui.updateHud(this.state.level, this.state.queue.length, this.state.zoneCount())
    }
  }

  private toggleSound(): boolean {
    const on = this.audio.muted // currently muted -> turning sound on
    this.audio.setMuted(!on)
    this.audio.resume()
    this.state.progress.sound = on
    saveProgress(this.state.progress)
    return on
  }

  private unlockAll(): void {
    this.audio.resume()
    this.audio.levelClear()
    this.state.progress.unlocked = MAX_LEVEL
    saveProgress(this.state.progress)
    this.ui.showLevelSelect(this.state.progress)
  }

  private showHint(): void {
    if (this.state.status !== 'playing') return
    this.audio.ui()
    let target: number | null = null
    for (const id of this.state.solutionOrder) {
      const v = this.state.vehicles.get(id)
      if (v && exitClear(this.state.grid, v)) {
        target = id
        break
      }
    }
    if (target === null) {
      this.ui.showToast('Free up a boarding slot first!')
      return
    }
    if (this.state.freeSlotIndex() === -1) {
      this.ui.showToast('Boarding zone is full — wait for a bus to depart.')
      return
    }
    this.renderer.pulseVehicle(target)
    window.clearTimeout(this.hintTimer)
    this.hintTimer = window.setTimeout(() => this.renderer.clearHint(), 2200)
  }

  // Tapping is non-blocking: a car is parked synchronously (freeing its grid
  // cell immediately) and drives to its slot while OTHER cars can still be
  // tapped. Boarding runs as a single background "pump" so it never blocks play.
  private handleTap(id: number): void {
    if (this.state.status !== 'playing') return
    if (this.busy.has(id)) return
    this.audio.resume()
    this.renderer.clearHint()

    // Endless: tapping an incoming (holding) car parks it into the lot.
    if (this.state.mode === 'endless') {
      const incoming = this.state.holding.find((h) => h.id === id)
      if (incoming) {
        this.parkIncoming(incoming)
        return
      }
    }

    const v = this.state.vehicles.get(id)
    if (!v) return

    // Forward-only, strict clearance check.
    if (!exitClear(this.state.grid, v)) {
      this.audio.honk()
      this.busy.add(id)
      void this.renderer.animateBump(id, clearAhead(this.state.grid, v)).then(() => this.busy.delete(id))
      return
    }
    // Boarding zone capacity check.
    if (this.state.freeSlotIndex() === -1) {
      this.audio.blocked()
      this.busy.add(id)
      void this.renderer.animateBlocked(id).then(() => this.busy.delete(id))
      this.ui.showToast('Boarding zone full!')
      return
    }
    // Park synchronously so the grid cell frees right away for fast play.
    this.state.moves++
    const slot = parkInZone(this.state, v)
    this.audio.drive()
    this.drivingCount++
    this.refreshHud()
    void this.driveThenBoard(id, slot)
  }

  // Endless: park an incoming car into a legal spot (clear entrance path).
  private parkIncoming(v: Vehicle): void {
    const placement = findParkingPlacement(this.state.grid, v.length, Math.random)
    if (!placement) {
      this.audio.blocked()
      this.busy.add(v.id)
      void this.renderer.animateBlocked(v.id).then(() => this.busy.delete(v.id))
      this.ui.showToast('주차할 공간이 없어요!')
      return
    }
    v.orientation = placement.orientation
    v.facing = placement.facing
    v.row = placement.row
    v.col = placement.col
    place(this.state.grid, v)
    this.state.vehicles.set(v.id, v)
    this.state.holding = this.state.holding.filter((h) => h.id !== v.id)
    this.audio.drive()
    this.busy.add(v.id)
    void this.renderer.animateParkIn(v.id).then(() => this.busy.delete(v.id))
    // refill the holding lane and keep passengers topped up
    this.state.addIncoming()
    this.renderer.syncHolding(this.state.holding)
    this.state.refillQueue()
    this.refreshHud()
    this.checkEnd()
  }

  private async driveThenBoard(id: number, slotIndex: number): Promise<void> {
    await this.renderer.animateDriveToZone(id, slotIndex)
    const slot = this.state.zone[slotIndex]
    if (slot && slot.vehicle.id === id) slot.arrived = true
    this.drivingCount--
    await this.pumpBoarding()
  }

  // Single background boarding processor. Re-evaluates state each pass so cars
  // that arrive mid-cascade are picked up; never runs twice concurrently.
  private async pumpBoarding(): Promise<void> {
    if (this.boardingRunning) return
    this.boardingRunning = true
    try {
      if (this.state.mode === 'endless') this.state.refillQueue()
      while (true) {
        const steps: number[] = []
        const departures: number[] = []
        let guard = 0
        while (++guard < 100000) {
          const slot = nextBoarding(this.state)
          if (!slot) break
          const vid = slot.vehicle.id
          const full = applyBoarding(this.state, slot)
          steps.push(vid)
          if (full) {
            departFromZone(this.state, slot)
            departures.push(vid)
          }
        }
        if (steps.length === 0) break

        if (this.state.mode === 'endless') {
          this.state.score += steps.length // +1 per boarded passenger
          this.state.refillQueue()
        }
        let pops = 0
        await this.renderer.animateBoardBurst(steps, this.state.queue, () => {
          if (pops++ % 2 === 0) this.audio.board()
        })
        this.ui.flashHud()
        this.refreshHud()

        if (departures.length > 0) {
          this.audio.depart()
          await Promise.all(departures.map((d) => this.renderer.animateDepart(d, 0)))
          this.refreshHud()
        }
      }
    } finally {
      this.boardingRunning = false
    }
    this.checkEnd()
  }

  private checkEnd(): void {
    if (this.state.mode === 'endless') {
      if (this.drivingCount === 0 && this.busy.size === 0 && !this.boardingRunning && this.endlessStuck()) {
        this.failEndless()
      }
      return
    }
    if (this.state.isWin()) {
      this.win()
      return
    }
    // Only declare gridlock once everything has settled (no cars driving in and
    // no boarding in progress), so an arriving matching bus isn't missed.
    if (this.drivingCount === 0 && !this.boardingRunning && this.state.isGridlock()) {
      this.fail()
    }
  }

  // Endless game-over: no legal move left (can't park, can't send to a slot,
  // and no passenger can board now).
  private endlessStuck(): boolean {
    if (this.state.matchForFront()) return false
    for (const h of this.state.holding) {
      if (findParkingPlacement(this.state.grid, h.length, Math.random)) return false
    }
    if (this.state.freeSlotIndex() !== -1) {
      for (const v of this.state.vehicles.values()) {
        if (exitClear(this.state.grid, v)) return false
      }
    }
    return true
  }

  private failEndless(): void {
    this.state.status = 'fail'
    this.audio.gridlock()
    this.renderer.screenShake(0.5, 0.5)
    const p = this.state.progress
    if (this.state.score > p.bestEndless) {
      p.bestEndless = this.state.score
      saveProgress(p)
    }
    setTimeout(() => this.ui.showEndlessOver(this.state.score, p.bestEndless), 550)
  }

  private win(): void {
    this.state.status = 'win'
    this.audio.levelClear()
    const lvl = this.state.level
    const p = this.state.progress
    p.completed[lvl] = true
    p.unlocked = Math.min(MAX_LEVEL, Math.max(p.unlocked, lvl + 1))
    const prevBest = p.bestMoves[lvl]
    if (prevBest === undefined || this.state.moves < prevBest) p.bestMoves[lvl] = this.state.moves
    saveProgress(p)
    setTimeout(() => this.ui.showWin(lvl, lvl >= MAX_LEVEL, this.state.moves), 500)
  }

  private fail(): void {
    this.state.status = 'fail'
    this.audio.gridlock()
    this.renderer.screenShake(0.5, 0.5)
    setTimeout(() => this.ui.showFail(), 550)
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('resize', this.onResize)
    window.clearTimeout(this.hintTimer)
    this.resizeObs?.disconnect()
    this.input.dispose()
    this.ui.dispose()
    this.renderer.dispose()
    this.audio.dispose()
  }
}
