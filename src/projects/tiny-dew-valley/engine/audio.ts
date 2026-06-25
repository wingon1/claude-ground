// All audio is synthesised at runtime via the Web Audio API. No asset files.

export type SfxName =
  | 'till'
  | 'water'
  | 'harvest'
  | 'chop'
  | 'crack'
  | 'eat'
  | 'coin'
  | 'rooster'
  | 'select'
  | 'reject'
  | 'plant'
  | 'sparkle'
  | 'battle'

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private musicGain: GainNode | null = null
  private bgmTimer: number | null = null
  muted = false
  musicOn = true
  private battleMode = false
  // Currently-scheduled BGM source nodes, so a mode switch can silence the old
  // loop instead of letting its already-queued notes ring out over the new one.
  private musicNodes: AudioScheduledSourceNode[] = []

  private ensure() {
    if (this.ctx) return
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.5
    this.master.connect(this.ctx.destination)
    this.musicGain = this.ctx.createGain()
    this.musicGain.gain.value = 0.32
    this.musicGain.connect(this.master)
  }

  resume() {
    this.ensure()
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setMuted(m: boolean) {
    this.muted = m
    this.ensure()
    if (this.master) this.master.gain.value = m ? 0 : 0.5
  }

  // ---- Karplus-Strong plucked string ----
  private pluck(freq: number, when: number, dur: number, gain: number) {
    if (!this.ctx || !this.musicGain) return
    const ctx = this.ctx
    const sr = ctx.sampleRate
    const n = Math.floor(sr * dur)
    const buf = ctx.createBuffer(1, n, sr)
    const data = buf.getChannelData(0)
    const p = Math.max(2, Math.floor(sr / freq))
    const noise = new Float32Array(p)
    for (let i = 0; i < p; i++) noise[i] = Math.random() * 2 - 1
    let idx = 0
    let prev = 0
    for (let i = 0; i < n; i++) {
      const cur = noise[idx]
      const out = (cur + prev) * 0.5 * 0.996
      noise[idx] = out
      prev = out
      data[i] = out
      idx = (idx + 1) % p
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.value = gain
    // gentle body filter
    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.value = 3200
    src.connect(filt)
    filt.connect(g)
    g.connect(this.musicGain)
    src.start(when)
    src.stop(when + dur)
    this.musicNodes.push(src)
  }

  // Noise hit routed through the music bus (tracked), for the battle percussion.
  private musicNoise(when: number, dur: number, freq: number, q: number, gain: number, type: BiquadFilterType) {
    if (!this.ctx || !this.musicGain) return
    const ctx = this.ctx
    const n = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filt = ctx.createBiquadFilter()
    filt.type = type
    filt.frequency.value = freq
    filt.Q.value = q
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(filt)
    filt.connect(g)
    g.connect(this.musicGain)
    src.start(when)
    src.stop(when + dur + 0.02)
    this.musicNodes.push(src)
  }

  // Cut every queued BGM note immediately (used on stop / mode switch).
  private stopMusicNodes() {
    for (const node of this.musicNodes) {
      try { node.stop() } catch { /* already stopped */ }
    }
    this.musicNodes = []
  }

  private scheduleBgm() {
    if (!this.ctx || !this.musicGain) return
    if (!this.musicOn) return
    // Track only this loop's notes; the previous loop's tail finishes on its own.
    this.musicNodes = []
    if (this.battleMode) { this.scheduleBattleBgm(); return }
    // A breezy 4-bar major loop in C, fingerpicked.
    const ctx = this.ctx
    const bpm = 92
    const beat = 60 / bpm
    const t0 = ctx.currentTime + 0.05
    // chord roots: C, Am, F, G (I vi IV V)
    const chords = [
      [261.63, 329.63, 392.0, 523.25],
      [220.0, 261.63, 329.63, 440.0],
      [174.61, 261.63, 349.23, 440.0],
      [196.0, 246.94, 392.0, 493.88],
    ]
    const pattern = [0, 2, 1, 3, 2, 3, 1, 2] // fingerpicking indices per 8th
    let t = t0
    for (let bar = 0; bar < 4; bar++) {
      const ch = chords[bar]
      for (let i = 0; i < 8; i++) {
        const note = ch[pattern[i] % ch.length]
        const g = i % 2 === 0 ? 0.5 : 0.34
        this.pluck(note, t, 0.9, g)
        if (i === 0) this.pluck(ch[0] / 2, t, 1.1, 0.4) // bass
        t += beat / 2
      }
    }
    const loopLen = beat * 4 * 4 * 1000
    this.bgmTimer = window.setTimeout(() => this.scheduleBgm(), loopLen - 60)
  }

  // A driving, tense battle loop in A minor — pulsing bass + urgent arpeggios.
  private scheduleBattleBgm() {
    if (!this.ctx || !this.musicGain || !this.master) return
    const ctx = this.ctx
    const bpm = 138
    const beat = 60 / bpm
    const t0 = ctx.currentTime + 0.05
    // i - VI - VII - i  (Am - F - G - Am), dark and propulsive.
    const chords = [
      [220.0, 261.63, 329.63, 440.0], // Am
      [174.61, 220.0, 349.23, 440.0], // F
      [196.0, 246.94, 392.0, 493.88], // G
      [220.0, 261.63, 329.63, 440.0], // Am
    ]
    const arp = [0, 2, 3, 2, 1, 2, 3, 1] // restless 8th-note arpeggio
    let t = t0
    for (let bar = 0; bar < 4; bar++) {
      const ch = chords[bar]
      const root = ch[0] / 2
      for (let i = 0; i < 8; i++) {
        // Throbbing eighth-note bass pulse drives the tension.
        this.pulseBass(t, root, beat * 0.5)
        const note = ch[arp[i] % ch.length]
        this.pluck(note, t, 0.42, i % 2 === 0 ? 0.34 : 0.24)
        // Backbeat percussion hit (tracked so it stops with the loop).
        if (i === 2 || i === 6) this.musicNoise(t, 0.1, 2600, 0.7, 0.18, 'highpass')
        if (i % 2 === 0) this.musicNoise(t, 0.06, 140, 1.0, 0.32, 'lowpass') // kick
        t += beat / 2
      }
    }
    const loopLen = beat * 4 * 4 * 1000
    this.bgmTimer = window.setTimeout(() => this.scheduleBgm(), loopLen - 60)
  }

  // Short sawtooth bass blip routed through the music bus for the battle pulse.
  private pulseBass(when: number, freq: number, dur: number) {
    if (!this.ctx || !this.musicGain) return
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    const filt = ctx.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.value = 600
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(0.5, when + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(filt)
    filt.connect(g)
    g.connect(this.musicGain)
    osc.start(when)
    osc.stop(when + dur + 0.02)
    this.musicNodes.push(osc)
  }

  // Switch between the peaceful and battle loops, restarting instantly.
  setBattle(on: boolean) {
    if (on === this.battleMode) return
    this.battleMode = on
    if (!this.musicOn) return
    this.ensure()
    this.stopMusicNodes() // silence the outgoing loop so the two don't overlap
    if (this.bgmTimer != null) {
      clearTimeout(this.bgmTimer)
      this.bgmTimer = null
    }
    this.scheduleBgm()
  }

  startMusic() {
    this.ensure()
    this.musicOn = true
    if (this.bgmTimer == null) this.scheduleBgm()
  }

  stopMusic() {
    this.musicOn = false
    if (this.bgmTimer != null) {
      clearTimeout(this.bgmTimer)
      this.bgmTimer = null
    }
    this.stopMusicNodes()
  }

  toggleMusic(): boolean {
    if (this.musicOn) this.stopMusic()
    else this.startMusic()
    return this.musicOn
  }

  private noiseBurst(when: number, dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass') {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const n = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, n, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filt = ctx.createBiquadFilter()
    filt.type = type
    filt.frequency.value = freq
    filt.Q.value = q
    const g = ctx.createGain()
    g.gain.value = gain
    src.connect(filt)
    filt.connect(g)
    g.connect(this.master)
    src.start(when)
  }

  private blip(when: number, f0: number, f1: number, dur: number, gain: number, type: OscillatorType = 'triangle') {
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(f0, when)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), when + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, when)
    g.gain.exponentialRampToValueAtTime(gain, when + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    osc.connect(g)
    g.connect(this.master)
    osc.start(when)
    osc.stop(when + dur + 0.02)
  }

  sfx(name: SfxName) {
    if (this.muted) return
    this.ensure()
    if (!this.ctx) return
    const t = this.ctx.currentTime
    switch (name) {
      case 'till':
        this.noiseBurst(t, 0.18, 900, 1.2, 0.5, 'bandpass')
        this.noiseBurst(t + 0.02, 0.12, 400, 1.5, 0.3, 'lowpass')
        break
      case 'water':
        this.blip(t, 700, 200, 0.1, 0.25)
        this.noiseBurst(t + 0.05, 0.25, 1800, 0.8, 0.3, 'highpass')
        break
      case 'plant':
        this.blip(t, 300, 520, 0.1, 0.3, 'sine')
        break
      case 'harvest':
        this.blip(t, 520, 880, 0.09, 0.4, 'square')
        this.blip(t + 0.06, 880, 1100, 0.08, 0.25)
        break
      case 'chop':
        this.noiseBurst(t, 0.09, 320, 2, 0.5, 'bandpass')
        this.blip(t, 180, 90, 0.08, 0.25, 'square')
        break
      case 'crack':
        this.noiseBurst(t, 0.18, 220, 1.2, 0.6, 'lowpass')
        this.blip(t, 140, 60, 0.18, 0.3, 'sawtooth')
        break
      case 'eat':
        this.blip(t, 220, 160, 0.08, 0.3, 'sine')
        this.blip(t + 0.1, 240, 180, 0.08, 0.3, 'sine')
        break
      case 'coin':
        this.blip(t, 1320, 1760, 0.05, 0.22, 'square')
        this.blip(t + 0.03, 1760, 2200, 0.04, 0.16, 'square')
        break
      case 'select':
        this.blip(t, 660, 880, 0.05, 0.18, 'triangle')
        break
      case 'reject':
        this.blip(t, 200, 140, 0.18, 0.3, 'sawtooth')
        break
      case 'sparkle':
        for (let i = 0; i < 5; i++) this.blip(t + i * 0.06, 880 + i * 220, 1320 + i * 220, 0.12, 0.16, 'sine')
        break
      case 'rooster':
        this.blip(t, 520, 760, 0.18, 0.3, 'sawtooth')
        this.blip(t + 0.2, 760, 600, 0.22, 0.3, 'sawtooth')
        this.blip(t + 0.45, 600, 900, 0.3, 0.28, 'sawtooth')
        break
      case 'battle': {
        // Boss-entrance sting: a low brass swell, a rising alarm, and a drum slam.
        this.noiseBurst(t, 0.22, 120, 0.9, 0.5, 'lowpass') // impact / drum
        this.blip(t, 110, 110, 0.5, 0.4, 'sawtooth') // ominous low drone
        this.blip(t, 165, 165, 0.5, 0.3, 'sawtooth')
        this.blip(t + 0.16, 330, 660, 0.28, 0.32, 'square') // rising alarm
        this.blip(t + 0.34, 440, 880, 0.3, 0.3, 'square')
        this.noiseBurst(t + 0.34, 0.16, 2400, 0.7, 0.22, 'highpass') // cymbal
        break
      }
    }
  }
}
