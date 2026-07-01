// Zero-friction identity: a stable per-device id (used as the vote key so votes
// can be toggled and de-duplicated) plus a display nickname, both in localStorage.

const DEVICE_KEY = 'gathering.deviceId.v1'
const NICK_KEY = 'gathering.nickname.v1'

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function getDeviceId(): string {
  if (typeof localStorage === 'undefined') return 'anon'
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id = uuid()
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

export function getNickname(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(NICK_KEY)
}

export function setNickname(name: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(NICK_KEY, name.trim().slice(0, 16))
}

/** A soft pastel colour derived from the device id, for cursor/stroke identity. */
export function colorForId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return `hsl(${h}, 70%, 62%)`
}
