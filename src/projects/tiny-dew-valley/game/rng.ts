export function randInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}
export function chance(p: number): boolean {
  return Math.random() < p
}
export function pickWeighted<T extends { weight: number }>(arr: T[]): T {
  let total = 0
  for (const a of arr) total += a.weight
  let r = Math.random() * total
  for (const a of arr) {
    r -= a.weight
    if (r <= 0) return a
  }
  return arr[arr.length - 1]
}
export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}
