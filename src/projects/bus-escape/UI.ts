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
  onEndless: () => void
}

const STYLE = `
.be-root{position:absolute;inset:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#eef1ff;-webkit-user-select:none;user-select:none;pointer-events:none}
.be-vignette{position:absolute;inset:0;pointer-events:none;z-index:0;
  background:radial-gradient(120% 90% at 50% 38%,rgba(0,0,0,0) 52%,rgba(4,6,18,.55) 100%)}
.be-layer{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none;z-index:2}
.be-layer.be-on{pointer-events:auto}
.be-panel{pointer-events:auto;position:relative;background:linear-gradient(165deg,rgba(40,48,98,.96),rgba(15,20,46,.97));
  border:1px solid rgba(140,156,255,.28);border-radius:26px;padding:30px 26px;
  box-shadow:0 24px 60px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12);max-width:88%;width:344px;backdrop-filter:blur(8px)}
.be-title{font-size:36px;font-weight:800;letter-spacing:.3px;margin:0 0 8px;line-height:1.05;
  background:linear-gradient(92deg,#ff7a7a,#ffd23a,#5be08a,#5b8cff,#ff7ec2);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 3px 10px rgba(90,120,255,.35))}
.be-sub{opacity:.78;font-size:14px;margin:0 0 22px;line-height:1.5}
.be-btn{pointer-events:auto;cursor:pointer;border:none;border-radius:16px;padding:14px 18px;font-size:16px;font-weight:800;color:#fff;letter-spacing:.2px;
  background:linear-gradient(170deg,#6b7bff,#3a49d4);box-shadow:0 6px 0 #2a37a8,0 10px 18px rgba(40,55,170,.4),inset 0 1px 0 rgba(255,255,255,.3);
  transition:transform .08s,box-shadow .08s,filter .1s;margin:7px 0;width:100%}
.be-btn:hover{filter:brightness(1.06)}
.be-btn:active{transform:translateY(4px);box-shadow:0 2px 0 #2a37a8,0 4px 10px rgba(40,55,170,.35),inset 0 1px 0 rgba(255,255,255,.3)}
.be-btn.be-green{background:linear-gradient(170deg,#54e487,#23a85a);box-shadow:0 6px 0 #1a8044,0 10px 18px rgba(35,168,90,.4),inset 0 1px 0 rgba(255,255,255,.35)}
.be-btn.be-green:active{box-shadow:0 2px 0 #1a8044,inset 0 1px 0 rgba(255,255,255,.35)}
.be-btn.be-ghost{background:linear-gradient(170deg,#333c6e,#252d56);box-shadow:0 6px 0 #161c3c,inset 0 1px 0 rgba(255,255,255,.12)}
.be-btn.be-ghost:active{box-shadow:0 2px 0 #161c3c,inset 0 1px 0 rgba(255,255,255,.12)}
.be-btn.be-sm{width:auto;padding:10px 15px;font-size:14px;margin:0}
.be-hud{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;
  padding:calc(8px + env(safe-area-inset-top,0px)) 12px 10px;gap:8px;pointer-events:none}
.be-hud .be-chip{pointer-events:auto;background:rgba(18,24,52,.72);border:1px solid rgba(120,138,230,.35);border-radius:14px;
  padding:8px 12px;font-size:13px;font-weight:800;display:flex;align-items:center;gap:6px;backdrop-filter:blur(8px);box-shadow:0 4px 14px rgba(0,0,0,.3)}
.be-icbtn{pointer-events:auto;cursor:pointer;width:40px;height:40px;border-radius:13px;border:1px solid rgba(120,138,230,.35);
  background:rgba(18,24,52,.72);color:#fff;font-size:18px;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);box-shadow:0 4px 14px rgba(0,0,0,.3);transition:transform .08s}
.be-icbtn:active{transform:scale(.9)}
.be-row{display:flex;gap:8px;align-items:center}
.be-bottom{position:absolute;bottom:0;left:0;right:0;display:flex;justify-content:center;gap:10px;padding:0 14px calc(14px + env(safe-area-inset-bottom,0px));pointer-events:none}
.be-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;max-height:62vh;overflow-y:auto;padding:6px 2px;width:100%}
.be-lvl{pointer-events:auto;cursor:pointer;aspect-ratio:1;border-radius:15px;border:1px solid rgba(255,255,255,.08);font-weight:800;font-size:15px;color:#fff;
  background:linear-gradient(165deg,#3c4684,#2a3160);display:flex;align-items:center;justify-content:center;position:relative;
  box-shadow:0 4px 10px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.14);transition:transform .08s}
.be-lvl:active{transform:scale(.94)}
.be-lvl.be-done{background:linear-gradient(165deg,#54e487,#23a85a)}
.be-lvl.be-cur{background:linear-gradient(165deg,#6b7bff,#3a49d4);box-shadow:0 0 0 3px rgba(170,180,255,.9) inset,0 4px 14px rgba(60,80,220,.5)}
.be-lvl.be-lock{background:#171c38;color:#4a5377;cursor:default;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
.be-badge{font-size:11px;opacity:.85;margin-top:2px}
.be-toast{position:absolute;top:96px;left:50%;transform:translateX(-50%);background:rgba(18,24,52,.92);
  border:1px solid rgba(120,138,230,.4);border-radius:14px;padding:9px 15px;font-size:13px;font-weight:700;opacity:0;transition:opacity .25s;pointer-events:none;max-width:80%;backdrop-filter:blur(8px);box-shadow:0 8px 22px rgba(0,0,0,.4)}
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
  private hudScore!: HTMLSpanElement
  private levelChip!: HTMLDivElement
  private scoreChip!: HTMLDivElement
  private remChip!: HTMLDivElement
  private bottomBar!: HTMLDivElement
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
    // Vignette overlay (cheap, frames the 3D scene; never intercepts taps).
    const vignette = document.createElement('div')
    vignette.className = 'be-vignette'
    this.root.appendChild(vignette)
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
    const endlessBtn = this.el('button', 'be-btn', '🚌  무한 버스')
    endlessBtn.onclick = () => this.h.onEndless()
    const lvlBtn = this.el('button', 'be-btn be-ghost', '☰  Level Select')
    lvlBtn.onclick = () => this.h.onOpenLevels()
    tp.appendChild(playBtn)
    tp.appendChild(endlessBtn)
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
    this.levelChip = this.el('div', 'be-chip')
    this.levelChip.append('Lv ', this.hudLevel)
    this.hudLevel.textContent = '1'
    this.hudScore = this.el('span')
    this.scoreChip = this.el('div', 'be-chip be-hidden')
    this.scoreChip.append('⭐ ', this.hudScore)
    this.hudScore.textContent = '0'
    leftRow.append(menuBtn, this.levelChip, this.scoreChip)
    const rightRow = this.el('div', 'be-row')
    this.hudRemaining = this.el('span')
    this.remChip = this.el('div', 'be-chip')
    this.remChip.append('🧍 ', this.hudRemaining)
    this.hudZone = this.el('span')
    const zoneChip = this.el('div', 'be-chip')
    zoneChip.append('🅿️ ', this.hudZone)
    this.soundBtn = this.el('button', 'be-icbtn', '🔊')
    this.soundBtn.onclick = () => {
      this.soundOn = this.h.onToggleSound()
      this.soundBtn.textContent = this.soundOn ? '🔊' : '🔇'
    }
    rightRow.append(this.remChip, zoneChip, this.soundBtn)
    hud.append(leftRow, rightRow)
    this.gameLayer.appendChild(hud)

    this.toast = this.el('div', 'be-toast')
    this.gameLayer.appendChild(this.toast)

    this.bottomBar = this.el('div', 'be-bottom')
    const restartBtn = this.el('button', 'be-btn be-sm be-ghost', '↻ Restart')
    restartBtn.onclick = () => this.h.onRestart()
    const hintBtn = this.el('button', 'be-btn be-sm', '💡 Hint')
    hintBtn.onclick = () => this.h.onHint()
    this.bottomBar.append(restartBtn, hintBtn)
    this.gameLayer.appendChild(this.bottomBar)
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

  showGame(endless = false): void {
    this.hideAll()
    // NOTE: the game layer stays pointer-events:none so taps reach the 3D
    // canvas underneath; only its buttons/chips opt back in via .be-btn etc.
    this.gameLayer.classList.remove('be-hidden')
    this.popupLayer.classList.add('be-hidden')
    this.popupLayer.classList.remove('be-on')
    // Endless: show score, hide level/remaining chips and the hint/restart bar.
    this.levelChip.classList.toggle('be-hidden', endless)
    this.scoreChip.classList.toggle('be-hidden', !endless)
    this.remChip.classList.toggle('be-hidden', endless)
    this.bottomBar.classList.toggle('be-hidden', endless)
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

  updateHudEndless(score: number, zoneCount: number): void {
    this.hudScore.textContent = String(score)
    this.hudZone.textContent = `${zoneCount}/4`
  }

  flashHud(): void {
    const chip = this.scoreChip.classList.contains('be-hidden') ? this.hudRemaining.parentElement : this.scoreChip
    chip?.animate(
      [{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
      { duration: 220, easing: 'ease-out' },
    )
  }

  showEndlessOver(score: number, best: number): void {
    this.popupLayer.innerHTML = ''
    this.popupLayer.classList.remove('be-hidden')
    this.popupLayer.classList.add('be-on')
    const p = this.el('div', 'be-panel')
    p.appendChild(this.el('h2', 'be-title', '게임 오버'))
    p.appendChild(this.el('p', 'be-sub', `점수 ${score}  ·  최고 ${best}`))
    const retry = this.el('button', 'be-btn be-green', '↻ 다시하기')
    retry.onclick = () => this.h.onRestart()
    const menu = this.el('button', 'be-btn be-ghost', '☰ 메뉴')
    menu.onclick = () => this.h.onMenu()
    p.append(retry, menu)
    this.popupLayer.appendChild(p)
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
