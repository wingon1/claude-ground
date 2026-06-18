// DOM overlay: title, level select, in-game HUD, win/fail popups. Portrait-first.

import { MAX_LEVEL, type Progress } from './GameState'

export interface UIHandlers {
  onPlay: (level: number) => void
  onSelectLevel: (level: number) => void
  onOpenLevels: () => void
  onMenu: () => void
  onRestart: () => void
  onNext: () => void
  onToggleSound: () => boolean
  onHint: () => void
  onUnlockAll: () => void
}

const STYLE = `
.be-root{position:absolute;inset:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;-webkit-user-select:none;user-select:none;pointer-events:none}
.be-layer{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none}
.be-layer.be-on{pointer-events:auto}
.be-panel{pointer-events:auto;background:linear-gradient(160deg,#1c2350,#0f1430);border:1px solid #3a4488;border-radius:22px;padding:26px 24px;box-shadow:0 18px 50px rgba(0,0,0,.5);max-width:88%;width:340px}
.be-title{font-size:34px;font-weight:800;letter-spacing:.5px;margin:0 0 6px;
  background:linear-gradient(90deg,#ff6b6b,#ffd23a,#42cf6b,#4f86ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.be-sub{opacity:.8;font-size:14px;margin:0 0 22px;line-height:1.4}
.be-btn{pointer-events:auto;cursor:pointer;border:none;border-radius:14px;padding:13px 18px;font-size:16px;font-weight:700;color:#fff;
  background:linear-gradient(160deg,#5566ff,#3344cc);box-shadow:0 6px 0 #2331a0;transition:transform .08s,box-shadow .08s;margin:6px 0;width:100%}
.be-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #2331a0}
.be-btn.be-green{background:linear-gradient(160deg,#3ed873,#27a857);box-shadow:0 6px 0 #1c7d40}
.be-btn.be-ghost{background:linear-gradient(160deg,#2a3160,#222a52);box-shadow:0 6px 0 #161c3c}
.be-btn.be-sm{width:auto;padding:9px 14px;font-size:14px;margin:0}
.be-hud{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;
  padding:10px 12px;gap:8px;pointer-events:none}
.be-hud .be-chip{pointer-events:auto;background:rgba(16,20,46,.82);border:1px solid #39427e;border-radius:12px;
  padding:7px 11px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;backdrop-filter:blur(4px)}
.be-icbtn{pointer-events:auto;cursor:pointer;width:38px;height:38px;border-radius:11px;border:1px solid #39427e;
  background:rgba(16,20,46,.82);color:#fff;font-size:17px;display:flex;align-items:center;justify-content:center}
.be-icbtn:active{transform:scale(.92)}
.be-row{display:flex;gap:8px;align-items:center}
.be-bottom{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:center;gap:10px;padding:14px;pointer-events:none}
.be-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;max-height:62vh;overflow-y:auto;padding:6px 2px;width:100%}
.be-lvl{pointer-events:auto;cursor:pointer;aspect-ratio:1;border-radius:13px;border:none;font-weight:800;font-size:15px;color:#fff;
  background:linear-gradient(160deg,#39437e,#2a3160);display:flex;align-items:center;justify-content:center;position:relative}
.be-lvl.be-done{background:linear-gradient(160deg,#3ed873,#27a857)}
.be-lvl.be-cur{background:linear-gradient(160deg,#5566ff,#3344cc);box-shadow:0 0 0 3px #aab4ff inset}
.be-lvl.be-lock{background:#1a1f3c;color:#566;cursor:default}
.be-badge{font-size:11px;opacity:.85;margin-top:2px}
.be-toast{position:absolute;top:92px;left:50%;transform:translateX(-50%);background:rgba(16,20,46,.9);
  border:1px solid #39427e;border-radius:12px;padding:8px 14px;font-size:13px;opacity:0;transition:opacity .25s;pointer-events:none;max-width:80%}
.be-toast.be-show{opacity:1}
.be-hidden{display:none !important}
.be-scroll{max-height:74vh;overflow-y:auto;width:100%}
`

export class UI {
  private root: HTMLDivElement
  private h: UIHandlers
  private soundOn = true

  private titleLayer!: HTMLDivElement
  private levelsLayer!: HTMLDivElement
  private levelsGrid!: HTMLDivElement
  private gameLayer!: HTMLDivElement
  private popupLayer!: HTMLDivElement
  private hudLevel!: HTMLSpanElement
  private hudRemaining!: HTMLSpanElement
  private hudZone!: HTMLSpanElement
  private soundBtn!: HTMLButtonElement
  private toast!: HTMLDivElement
  private toastTimer = 0
  private unlockTaps = 0 // hidden cheat: 7 taps on the last cell unlocks all

  constructor(host: HTMLElement, handlers: UIHandlers) {
    this.h = handlers
    if (!document.getElementById('be-style')) {
      const st = document.createElement('style')
      st.id = 'be-style'
      st.textContent = STYLE
      document.head.appendChild(st)
    }
    this.root = document.createElement('div')
    this.root.className = 'be-root'
    host.appendChild(this.root)
    this.build()
  }

  private el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
    const e = document.createElement(tag)
    if (cls) e.className = cls
    if (text !== undefined) e.textContent = text
    return e
  }

  private build(): void {
    // Title
    this.titleLayer = this.el('div', 'be-layer be-on')
    const tp = this.el('div', 'be-panel')
    tp.appendChild(this.el('h1', 'be-title', 'Bus Escape'))
    tp.appendChild(this.el('p', 'be-sub', 'Traffic Jam — free the buses, match the colors, clear the queue. 100 puzzle levels.'))
    const playBtn = this.el('button', 'be-btn be-green', '▶  Play')
    playBtn.onclick = () => this.h.onPlay(0)
    const lvlBtn = this.el('button', 'be-btn be-ghost', '☰  Level Select')
    lvlBtn.onclick = () => this.h.onOpenLevels()
    tp.appendChild(playBtn)
    tp.appendChild(lvlBtn)
    this.titleLayer.appendChild(tp)
    this.root.appendChild(this.titleLayer)

    // Level select
    this.levelsLayer = this.el('div', 'be-layer')
    const lp = this.el('div', 'be-panel')
    lp.style.width = '92%'
    lp.style.maxWidth = '420px'
    const lpHead = this.el('div', 'be-row')
    lpHead.style.justifyContent = 'space-between'
    lpHead.style.marginBottom = '12px'
    lpHead.appendChild(this.el('h2', 'be-title', 'Levels'))
    const back = this.el('button', 'be-btn be-sm be-ghost', '✕')
    back.onclick = () => this.showTitle()
    lpHead.appendChild(back)
    lp.appendChild(lpHead)
    this.levelsGrid = this.el('div', 'be-grid')
    lp.appendChild(this.levelsGrid)
    this.levelsLayer.appendChild(lp)
    this.root.appendChild(this.levelsLayer)

    // Game HUD
    this.gameLayer = this.el('div', 'be-layer')
    this.gameLayer.style.justifyContent = 'flex-start'
    const hud = this.el('div', 'be-hud')
    const leftRow = this.el('div', 'be-row')
    const menuBtn = this.el('button', 'be-icbtn', '☰')
    menuBtn.onclick = () => this.h.onMenu()
    this.hudLevel = this.el('span')
    const lvlChip = this.el('div', 'be-chip')
    lvlChip.append('Lv ', this.hudLevel)
    this.hudLevel.textContent = '1'
    leftRow.append(menuBtn, lvlChip)
    const rightRow = this.el('div', 'be-row')
    this.hudRemaining = this.el('span')
    const remChip = this.el('div', 'be-chip')
    remChip.append('🧍 ', this.hudRemaining)
    this.hudZone = this.el('span')
    const zoneChip = this.el('div', 'be-chip')
    zoneChip.append('🅿️ ', this.hudZone)
    this.soundBtn = this.el('button', 'be-icbtn', '🔊')
    this.soundBtn.onclick = () => {
      this.soundOn = this.h.onToggleSound()
      this.soundBtn.textContent = this.soundOn ? '🔊' : '🔇'
    }
    rightRow.append(remChip, zoneChip, this.soundBtn)
    hud.append(leftRow, rightRow)
    this.gameLayer.appendChild(hud)

    this.toast = this.el('div', 'be-toast')
    this.gameLayer.appendChild(this.toast)

    const bottom = this.el('div', 'be-bottom')
    const restartBtn = this.el('button', 'be-btn be-sm be-ghost', '↻ Restart')
    restartBtn.onclick = () => this.h.onRestart()
    const hintBtn = this.el('button', 'be-btn be-sm', '💡 Hint')
    hintBtn.onclick = () => this.h.onHint()
    bottom.append(restartBtn, hintBtn)
    this.gameLayer.appendChild(bottom)
    this.root.appendChild(this.gameLayer)

    // Popups
    this.popupLayer = this.el('div', 'be-layer be-hidden')
    this.root.appendChild(this.popupLayer)
  }

  private hideAll(): void {
    for (const l of [this.titleLayer, this.levelsLayer, this.gameLayer]) {
      l.classList.remove('be-on')
      l.classList.add('be-hidden')
    }
    this.popupLayer.classList.add('be-hidden')
  }

  showTitle(): void {
    this.hideAll()
    this.titleLayer.classList.remove('be-hidden')
    this.titleLayer.classList.add('be-on')
  }

  showLevelSelect(p: Progress): void {
    this.hideAll()
    this.levelsLayer.classList.remove('be-hidden')
    this.levelsLayer.classList.add('be-on')
    this.levelsGrid.innerHTML = ''
    this.unlockTaps = 0
    for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
      const unlocked = lvl <= p.unlocked
      const done = p.completed[lvl]
      const b = this.el('button', 'be-lvl', String(lvl))
      if (!unlocked) {
        b.classList.add('be-lock')
        b.textContent = '🔒'
      } else if (done) {
        b.classList.add('be-done')
      } else if (lvl === p.unlocked) {
        b.classList.add('be-cur')
      }
      if (unlocked) {
        b.onclick = () => this.h.onSelectLevel(lvl)
      } else if (lvl === MAX_LEVEL) {
        // Hidden cheat: tap the last (locked) cell 7 times to unlock everything.
        b.style.pointerEvents = 'auto'
        b.style.cursor = 'pointer'
        b.onclick = () => {
          this.unlockTaps++
          b.animate([{ transform: 'scale(0.85)' }, { transform: 'scale(1)' }], { duration: 140, easing: 'ease-out' })
          if (this.unlockTaps >= 7) {
            this.unlockTaps = 0
            this.h.onUnlockAll()
          }
        }
      }
      this.levelsGrid.appendChild(b)
    }
  }

  showGame(): void {
    this.hideAll()
    // NOTE: the game layer stays pointer-events:none so taps reach the 3D
    // canvas underneath; only its buttons/chips opt back in via .be-btn etc.
    this.gameLayer.classList.remove('be-hidden')
    this.popupLayer.classList.add('be-hidden')
    this.popupLayer.classList.remove('be-on')
  }

  setSound(on: boolean): void {
    this.soundOn = on
    this.soundBtn.textContent = on ? '🔊' : '🔇'
  }

  updateHud(level: number, remaining: number, zoneCount: number): void {
    this.hudLevel.textContent = String(level)
    this.hudRemaining.textContent = String(remaining)
    this.hudZone.textContent = `${zoneCount}/4`
  }

  flashHud(): void {
    this.hudRemaining.parentElement?.animate(
      [{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
      { duration: 220, easing: 'ease-out' },
    )
  }

  showToast(text: string): void {
    this.toast.textContent = text
    this.toast.classList.add('be-show')
    window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('be-show'), 1400)
  }

  showWin(level: number, isLast: boolean, moves: number): void {
    this.popupLayer.innerHTML = ''
    this.popupLayer.classList.remove('be-hidden')
    this.popupLayer.classList.add('be-on')
    const p = this.el('div', 'be-panel')
    p.appendChild(this.el('h2', 'be-title', '🎉 Cleared!'))
    p.appendChild(this.el('p', 'be-sub', isLast ? `You finished all ${MAX_LEVEL} levels! Legend.` : `Level ${level} solved in ${moves} moves.`))
    if (!isLast) {
      const next = this.el('button', 'be-btn be-green', 'Next Level  ▶')
      next.onclick = () => this.h.onNext()
      p.appendChild(next)
    }
    const retry = this.el('button', 'be-btn be-ghost', '↻ Replay')
    retry.onclick = () => this.h.onRestart()
    const menu = this.el('button', 'be-btn be-ghost', '☰ Levels')
    menu.onclick = () => this.h.onOpenLevels()
    p.append(retry, menu)
    this.popupLayer.appendChild(p)
  }

  showFail(): void {
    this.popupLayer.innerHTML = ''
    this.popupLayer.classList.remove('be-hidden')
    this.popupLayer.classList.add('be-on')
    const p = this.el('div', 'be-panel')
    p.appendChild(this.el('h2', 'be-title', '🚫 Gridlock!'))
    p.appendChild(this.el('p', 'be-sub', 'The front passenger has no matching bus and the boarding zone is full.'))
    const retry = this.el('button', 'be-btn be-green', '↻ Try Again')
    retry.onclick = () => this.h.onRestart()
    const menu = this.el('button', 'be-btn be-ghost', '☰ Levels')
    menu.onclick = () => this.h.onOpenLevels()
    p.append(retry, menu)
    this.popupLayer.appendChild(p)
  }

  dispose(): void {
    this.root.remove()
  }
}
