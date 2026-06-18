// Web Audio API synthesized sound effects. No audio files.

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  muted: boolean

  constructor(muted: boolean) {
    this.muted = muted
  }

  // Must be (re)called from a user gesture to satisfy autoplay policies.
  resume(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.5
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMuted(m: boolean): void {
    this.muted = m
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    when = 0,
    gain = 0.3,
    freqEnd?: number,
  ): void {
    if (this.muted || !this.ctx || !this.master) return
    const t0 = this.ctx.currentTime + when
    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.02)
  }

  // High-pitched pop when a passenger boards.
  board(): void {
    this.tone(680 + Math.random() * 80, 0.12, 'triangle', 0, 0.22, 1040)
  }

  // Soft engine-ish tone when a vehicle drives out.
  drive(): void {
    this.tone(140, 0.32, 'sawtooth', 0, 0.16, 230)
    this.tone(220, 0.3, 'sine', 0, 0.08)
  }

  // Dissonant honk when blocked.
  honk(): void {
    this.tone(196, 0.22, 'square', 0, 0.2)
    this.tone(208, 0.22, 'square', 0, 0.18)
  }

  // Blocked (boarding zone full) — short double buzz.
  blocked(): void {
    this.tone(150, 0.1, 'square', 0, 0.18)
    this.tone(150, 0.1, 'square', 0.12, 0.18)
  }

  // Uplifting chime when a full vehicle departs.
  depart(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => this.tone(f, 0.28, 'triangle', i * 0.06, 0.2))
  }

  // Harsh fail tone on gridlock.
  gridlock(): void {
    this.tone(220, 0.5, 'sawtooth', 0, 0.25, 90)
    this.tone(233, 0.5, 'square', 0, 0.2, 95)
  }

  // Bright success melody on level clear.
  levelClear(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    notes.forEach((f, i) => this.tone(f, 0.3, 'triangle', i * 0.11, 0.22))
  }

  // Small UI blip.
  ui(): void {
    this.tone(440, 0.07, 'sine', 0, 0.14, 660)
  }

  dispose(): void {
    if (this.ctx) void this.ctx.close()
    this.ctx = null
    this.master = null
  }
}
