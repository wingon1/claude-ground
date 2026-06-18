// Main orchestrator: renderer, audio, UI, input, the action loop & screen flow.

import { Renderer } from './Renderer'
import { AudioEngine } from './Audio'
import { UI } from './UI'
import { Input } from './Input'
import { GameState, MAX_LEVEL, saveProgress } from './GameState'
import { generateLevel } from './LevelGenerator'
import { exitClear, clearAhead } from './GridLogic'
import { parkInZone, nextBoarding, applyBoarding, departFromZone } from './BoardingLogic'

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
      onRestart: () => this.startLevel(this.state.level),
      onNext: () => this.startLevel(Math.min(MAX_LEVEL, this.state.level + 1)),
      onToggleSound: () => this.toggleSound(),
      onHint: () => this.showHint(),
      onUnlockAll: () => this.unlockAll(),
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

  private refreshHud(): void {
    this.ui.updateHud(this.state.level, this.state.queue.length, this.state.zoneCount())
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
    const v = this.state.vehicles.get(id)
    if (!v) return
    this.audio.resume()
    this.renderer.clearHint()

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
