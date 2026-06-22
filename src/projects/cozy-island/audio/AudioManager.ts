import { Sound } from '../content'

type Scene = 'islandDay' | 'islandNight' | 'mine' | 'shop'

const SCALES: Record<string, number[]> = {
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
}

function semitone(root: number, steps: number): number {
  return root * Math.pow(2, steps / 12)
}

export class AudioManager {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private bgmGain!: GainNode
  private sfxGain!: GainNode
  private settings = { master: Sound.defaults.master, bgm: Sound.defaults.bgm, sfx: Sound.defaults.sfx, muted: Sound.defaults.muted }
  private bgmTimer: number | null = null
  private scene: Scene = 'islandDay'
  private step = 0
  private started = false

  init() {
    if (this.ctx) return
    type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext }
    const Ctor = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext
    if (!Ctor) return
    this.ctx = new Ctor()
    this.master = this.ctx.createGain()
    this.bgmGain = this.ctx.createGain()
    this.sfxGain = this.ctx.createGain()
    this.bgmGain.connect(this.master)
    this.sfxGain.connect(this.master)
    this.master.connect(this.ctx.destination)
    this.applyVolumes()
  }

  /** Must be called from a user gesture to unlock audio. */
  resume() {
    this.init()
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
    if (!this.started) {
      this.started = true
      this.startBgm()
    }
  }

  setSettings(s: { master: number; bgm: number; sfx: number; muted: boolean }) {
    this.settings = { ...s }
    this.applyVolumes()
  }

  private applyVolumes() {
    if (!this.ctx) return
    const m = this.settings.muted ? 0 : this.settings.master
    this.master.gain.value = m
    this.bgmGain.gain.value = this.settings.bgm
    this.sfxGain.gain.value = this.settings.sfx
  }

  setScene(scene: Scene) {
    if (this.scene === scene) return
    this.scene = scene
    this.step = 0
  }

  private startBgm() {
    if (!this.ctx) return
    const tick = () => {
      this.playBgmStep()
      const conf = Sound.bgm[this.scene]
      const interval = (60 / conf.tempo) * 1000 * 0.5
      this.bgmTimer = window.setTimeout(tick, interval)
    }
    tick()
  }

  private playBgmStep() {
    if (!this.ctx || this.settings.muted) { this.step++; return }
    const conf = Sound.bgm[this.scene]
    const scale = SCALES[conf.scale] || SCALES.majorPentatonic
    const note = conf.pattern[this.step % conf.pattern.length]
    const octave = Math.floor((note + 100) / scale.length) - Math.floor(100 / scale.length)
    const idx = ((note % scale.length) + scale.length) % scale.length
    const freq = semitone(conf.root, scale[idx] + octave * 12)
    const now = this.ctx.currentTime

    // pluck melody
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = 'triangle'
    o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, now)
    g.gain.linearRampToValueAtTime(0.22, now + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
    o.connect(g); g.connect(this.bgmGain)
    o.start(now); o.stop(now + 0.45)

    // soft pad on downbeats
    if (this.step % 4 === 0) {
      const po = this.ctx.createOscillator()
      const pg = this.ctx.createGain()
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'; lp.frequency.value = conf.filter
      po.type = 'sine'; po.frequency.value = conf.padFreq
      pg.gain.setValueAtTime(0.0001, now)
      pg.gain.linearRampToValueAtTime(0.12, now + 0.4)
      pg.gain.exponentialRampToValueAtTime(0.0001, now + 1.6)
      po.connect(lp); lp.connect(pg); pg.connect(this.bgmGain)
      po.start(now); po.stop(now + 1.7)
    }
    this.step++
  }

  sfx(name: string) {
    if (!this.ctx || this.settings.muted) return
    const def = Sound.sfx[name] as Record<string, unknown> | undefined
    if (!def) return
    const now = this.ctx.currentTime
    const type = def.type as string
    const vol = (def.vol as number) ?? 0.4

    if (type === 'arp') {
      const freqs = (def.freqs as number[]) || [(def.freq as number) || 440]
      const dur = (def.dur as number) || 0.2
      const each = dur / freqs.length
      freqs.forEach((f, i) => this.blip(def.wave as OscillatorType, f, each * 1.6, vol, now + i * each))
      return
    }
    if (type === 'sweep') {
      this.sweep(def.wave as OscillatorType, def.from as number, def.to as number, (def.dur as number) || 0.4, vol, now)
      return
    }
    if (type === 'noiseHit') {
      this.noise((def.freq as number) || 400, (def.dur as number) || 0.12, vol, now)
      return
    }
    if (type === 'metalHit') {
      this.sweep('triangle', (def.freq as number) || 200, ((def.freq as number) || 200) * 0.5, (def.dur as number) || 0.1, vol, now)
      return
    }
    // blip / pop / default
    this.blip((def.wave as OscillatorType) || 'sine', (def.freq as number) || 440, (def.dur as number) || 0.08, vol, now)
  }

  private blip(wave: OscillatorType, freq: number, dur: number, vol: number, when: number) {
    if (!this.ctx) return
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = wave || 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0.0001, when)
    g.gain.linearRampToValueAtTime(vol, when + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    o.connect(g); g.connect(this.sfxGain)
    o.start(when); o.stop(when + dur + 0.02)
  }

  private sweep(wave: OscillatorType, from: number, to: number, dur: number, vol: number, when: number) {
    if (!this.ctx) return
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = wave || 'sine'
    o.frequency.setValueAtTime(from, when)
    o.frequency.exponentialRampToValueAtTime(Math.max(40, to), when + dur)
    g.gain.setValueAtTime(0.0001, when)
    g.gain.linearRampToValueAtTime(vol, when + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    o.connect(g); g.connect(this.sfxGain)
    o.start(when); o.stop(when + dur + 0.02)
  }

  private noise(filterFreq: number, dur: number, vol: number, when: number) {
    if (!this.ctx) return
    const len = Math.floor(this.ctx.sampleRate * dur)
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = filterFreq
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(vol, when)
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
    src.connect(lp); lp.connect(g); g.connect(this.sfxGain)
    src.start(when); src.stop(when + dur)
  }

  dispose() {
    if (this.bgmTimer) window.clearTimeout(this.bgmTimer)
    this.bgmTimer = null
    if (this.ctx) void this.ctx.close()
    this.ctx = null
    this.started = false
  }
}
