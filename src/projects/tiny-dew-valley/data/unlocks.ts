export const INITIAL_CROP_ID = 'wheat'
export const CHICKEN_UNLOCK_FLAG = 'unlock:animal:chicken'
export const DAIRY_UNLOCK_FLAG = 'unlock:dairy'
export const PIG_UNLOCK_FLAG = 'unlock:animal:pig'

export function cropUnlockFlag(cropId: string): string {
  return `unlock:crop:${cropId}`
}
