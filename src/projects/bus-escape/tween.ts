// Tiny promise-based tween manager driven by the render loop (dt in ms).

export type Easing = (t: number) => number

export const linear: Easing = (t) => t
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3)
export const easeInOutCubic: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
export const easeOutBack: Easing = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
export const easeOutQuad: Easing = (t) => 1 - (1 - t) * (1 - t)

interface ActiveTween {
  elapsed: number
  duration: number
  update: (k: number) => void
  resolve: () => void
  easing: Easing
}

export class TweenManager {
  private tweens: ActiveTween[] = []

  get active(): boolean {
    return this.tweens.length > 0
  }

  add(duration: number, update: (k: number) => void, easing: Easing = easeOutCubic): Promise<void> {
    if (duration <= 0) {
      update(1)
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      this.tweens.push({ elapsed: 0, duration, update, resolve, easing })
    })
  }

  wait(ms: number): Promise<void> {
    return this.add(ms, () => {}, linear)
  }

  step(dt: number): void {
    if (this.tweens.length === 0) return
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i]
      tw.elapsed += dt
      let k = tw.elapsed / tw.duration
      if (k > 1) k = 1
      tw.update(tw.easing(k))
      if (k >= 1) {
        this.tweens.splice(i, 1)
        tw.resolve()
      }
    }
  }

  clear(): void {
    const pending = this.tweens
    this.tweens = []
    for (const t of pending) t.resolve()
  }
}
