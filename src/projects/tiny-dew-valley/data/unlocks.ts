export const INITIAL_CROP_ID = 'wheat'
export const DAIRY_UNLOCK_FLAG = 'unlock:dairy'

export function cropUnlockFlag(cropId: string): string {
  return `unlock:crop:${cropId}`
}
