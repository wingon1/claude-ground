// Minimal typed pub/sub between engine and React UI.
export type GameEvent =
  | { t: 'state' } // generic state-changed (UI should re-read)
  | { t: 'popup'; text: string; x: number; y: number; color: string }
  | { t: 'toast'; text: string; kind?: 'info' | 'good' | 'bad' }
  | { t: 'quest'; questId: string; name: string }
  | { t: 'maxStaminaUp'; value: number }
  | { t: 'staminaEmpty' }
  | { t: 'sleepStart' }
  | { t: 'wake' }
  | { t: 'openPanel'; panel: string }
  | { t: 'sfx'; name: string }
  | { t: 'bgm'; scene: string }

type Handler = (e: GameEvent) => void

export class EventBus {
  private handlers: Handler[] = []
  on(h: Handler): () => void {
    this.handlers.push(h)
    return () => {
      this.handlers = this.handlers.filter((x) => x !== h)
    }
  }
  emit(e: GameEvent): void {
    for (const h of this.handlers) h(e)
  }
}
