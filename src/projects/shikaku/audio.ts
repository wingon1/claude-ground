// Warm, wooden soundscape synthesized with the Web Audio API. No audio assets.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let enabled = true

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  // Browsers suspend the context until a user gesture; resume on demand.
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function setSoundEnabled(on: boolean) {
  enabled = on
}

export function isSoundEnabled() {
  return enabled
}

/** Call from a user gesture to unlock audio on mobile. */
export function primeAudio() {
  ensure()
}

type ToneOpts = {
  freq: number
  type?: OscillatorType
  start?: number
  dur?: number
  gain?: number
  attack?: number
  /** Detuned second oscillator for a richer, mallet-like body. */
  body?: boolean
}

function tone(opts: ToneOpts) {
  const ac = ensure()
  if (!ac || !master || !enabled) return
  const t0 = ac.currentTime + (opts.start ?? 0)
  const dur = opts.dur ?? 0.25
  const peak = opts.gain ?? 0.3
  const attack = opts.attack ?? 0.005

  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  g.connect(master)

  const osc = ac.createOscillator()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(opts.freq, t0)
  osc.connect(g)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)

  if (opts.body) {
    const osc2 = ac.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(opts.freq * 2.01, t0)
    const g2 = ac.createGain()
    g2.gain.setValueAtTime(0.0001, t0)
    g2.gain.exponentialRampToValueAtTime(peak * 0.4, t0 + attack)
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.7)
    osc2.connect(g2)
    g2.connect(master)
    osc2.start(t0)
    osc2.stop(t0 + dur)
  }
}

/** Soft wooden 'tock' while expanding a block. */
export function playTock() {
  const ac = ensure()
  if (!ac || !master || !enabled) return
  // Short noise burst through a band-pass for a dry wooden knock.
  const t0 = ac.currentTime
  const len = 0.06
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3)
  }
  const src = ac.createBufferSource()
  src.buffer = buffer
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 320
  bp.Q.value = 4
  const g = ac.createGain()
  g.gain.value = 0.35
  src.connect(bp)
  bp.connect(g)
  g.connect(master)
  src.start(t0)
  // A touch of pitched body underneath.
  tone({ freq: 180, type: 'sine', dur: 0.08, gain: 0.12 })
}

// Pentatonic marimba steps — climbing as more of the board is completed.
const MARIMBA = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5]

/** Marimba chord step-up when a block is correctly sized. `step` climbs 0..n. */
export function playStep(step: number) {
  const base = MARIMBA[Math.min(step, MARIMBA.length - 1)]
  tone({ freq: base, type: 'sine', dur: 0.45, gain: 0.3, body: true })
  tone({ freq: base * 1.5, type: 'sine', dur: 0.4, gain: 0.12, start: 0.012 })
}

/** Soft error thud for invalid drags. */
export function playError() {
  tone({ freq: 130, type: 'sine', dur: 0.18, gain: 0.22 })
  tone({ freq: 98, type: 'sine', dur: 0.22, gain: 0.18, start: 0.04 })
}

/** Gentle 4-note glockenspiel arpeggio on stage clear. */
export function playClear() {
  const notes = [659.25, 783.99, 987.77, 1318.51]
  notes.forEach((f, i) => {
    tone({ freq: f, type: 'sine', dur: 0.6, gain: 0.26, start: i * 0.12, body: true })
    tone({ freq: f * 2, type: 'sine', dur: 0.4, gain: 0.06, start: i * 0.12 })
  })
}

/** Light tick for UI taps (buy/equip/erase). */
export function playTap() {
  tone({ freq: 660, type: 'triangle', dur: 0.08, gain: 0.14 })
}

/** Coin reward shimmer. */
export function playCoins() {
  ;[880, 1108, 1318].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.25, gain: 0.14, start: i * 0.06 }))
}
