/* ===========================================================================
 * Audio.ts — Web Audio API synthesis. Zero sample files: every sound is
 * generated from oscillators / filtered noise at play time.
 *
 *   • drive()  — engine rev that pitches up as a car accelerates off the board
 *   • honk()   — comical two-sine "boink" when a car is blocked
 *   • clear()  — ascending major arpeggio with a metallic chime for a win
 *   • tick()   — tiny click when a car settles into a new cell
 *
 * The AudioContext is created lazily and resumed on the first user gesture,
 * which is required by mobile browser autoplay policies.
 * ========================================================================= */

export class Audio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  muted = false

  /** Create / resume the context. Must be called from within a user gesture. */
  resume() {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.7
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  toggleMute() {
    this.muted = !this.muted
    if (this.master)
      this.master.gain.value = this.muted ? 0 : 0.7
    return this.muted
  }

  private get t() {
    return this.ctx!.currentTime
  }

  /** Engine drive-away: a saw through a sweeping low-pass, pitch ramping up. */
  drive(strength = 1) {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const t0 = this.t
    const dur = 0.7

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(70, t0)
    osc.frequency.exponentialRampToValueAtTime(70 + 240 * strength, t0 + dur)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(380, t0)
    filter.frequency.exponentialRampToValueAtTime(2600, t0 + dur)
    filter.Q.value = 6

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.06)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    osc.connect(filter).connect(gain).connect(this.master!)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  /** Blocked "boink": two slightly detuned sines dropping in pitch. */
  honk() {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const t0 = this.t
    const dur = 0.22
    ;[330, 337].forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f, t0)
      osc.frequency.exponentialRampToValueAtTime(f * 0.72, t0 + dur)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
      osc.detune.value = i === 0 ? -6 : 6
      osc.connect(gain).connect(this.master!)
      osc.start(t0)
      osc.stop(t0 + dur + 0.02)
    })
  }

  /** Soft tick when a car snaps into a cell. */
  tick() {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const t0 = this.t
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(520, t0)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.12, t0)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08)
    osc.connect(gain).connect(this.master!)
    osc.start(t0)
    osc.stop(t0 + 0.1)
  }

  /** Level-clear: ascending major arpeggio with a bright metallic chime tail. */
  clear() {
    if (!this.ctx || this.muted) return
    const ctx = this.ctx
    const t0 = this.t
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5] // C5 E5 G5 C6 E6
    notes.forEach((f, i) => {
      const t = t0 + i * 0.09
      const osc = ctx.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = f
      // a detuned partial for the metallic shimmer
      const osc2 = ctx.createOscillator()
      osc2.type = 'sine'
      osc2.frequency.value = f * 2.01
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.012)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      const g2 = ctx.createGain()
      g2.gain.value = 0.18
      osc.connect(gain).connect(this.master!)
      osc2.connect(g2).connect(gain)
      osc.start(t)
      osc2.start(t)
      osc.stop(t + 0.65)
      osc2.stop(t + 0.65)
    })
  }

  dispose() {
    if (this.ctx) void this.ctx.close()
    this.ctx = null
  }
}
