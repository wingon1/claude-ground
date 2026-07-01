// Data layer for the Gathering Planner (Supabase-only, room-scoped).
//
//   - Postgres tables + Realtime "Postgres Changes" sync votes/venues per room.
//   - A single Broadcast channel per room carries high-frequency doodle strokes
//     AND live cursors (never written to disk).
//   - The doodle is additionally snapshotted (PNG) into the room row every so
//     often, so someone who joins late sees the current picture.
//
// Vote counts are small, so the strategy is simply "refetch this room's rows on
// any change and recompute" — trivially correct and easy to reason about.

import type { RealtimeChannel } from '@supabase/supabase-js'
import { getDeviceId } from './identity'
import { getSupabase, hasSupabase } from './supabaseClient'

export type Venue = {
  id: string
  name: string
  created_by: string
  created_at: string
}
export type VenueVote = { venue_id: string; voter: string }
export type DateVote = { day: string; voter: string; name?: string } // day = 'YYYY-MM-DD'

export type PlannerState = {
  venues: Venue[]
  venueVotes: VenueVote[]
  dateVotes: DateVote[]
}

// Stroke coordinates are NORMALIZED (0..1) so drawings line up across screens
// of different sizes. `size` is a pixel thickness.
export type Stroke = {
  x0: number
  y0: number
  x1: number
  y1: number
  color: string
  size: number
  erase?: boolean // eraser strokes clear to transparent (canvas overlays the UI)
}

// Cursor position is normalized (0..1) over the viewport.
export type Cursor = { id: string; nick: string; color: string; x: number; y: number }

// A connected participant (Realtime Presence).
export type Presence = { id: string; nick: string; color: string }

export type DateMode = 'single' | 'range' | 'list'
export type VoteMode = 'single' | 'multiple'

export type Room = {
  id: string
  name: string
  dateMode: DateMode
  voteMode: VoteMode
  candidateDates: string[] // 'YYYY-MM-DD', sorted
  createdAt: string
}

export type CreateRoomInput = {
  name: string
  dateMode: DateMode
  voteMode: VoteMode
  candidateDates: string[]
}

export const emptyState: PlannerState = { venues: [], venueVotes: [], dateVotes: [] }

const T_ROOMS = 'gathering_rooms'
const T_VENUES = 'gathering_venues'
const T_VENUE_VOTES = 'gathering_venue_votes'
const T_DATE_VOTES = 'gathering_date_votes'

function requireSupabase() {
  if (!hasSupabase) {
    throw new Error(
      'Supabase 키가 설정되지 않았습니다. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 설정하세요.',
    )
  }
  return getSupabase()!
}

// --- Room CRUD (not tied to a single room store) ---------------------------

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // no ambiguous chars
function makeCode(len = 6): string {
  let s = ''
  for (let i = 0; i < len; i++)
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  return s
}

function mapRoom(r: Record<string, unknown>): Room {
  const raw = r.candidate_dates
  const dates = Array.isArray(raw) ? (raw as string[]) : []
  return {
    id: String(r.id),
    name: String(r.name),
    dateMode: r.date_mode as DateMode,
    voteMode: r.vote_mode as VoteMode,
    candidateDates: [...dates].sort(),
    createdAt: String(r.created_at),
  }
}

export async function createRoom(input: CreateRoomInput): Promise<Room> {
  const sb = requireSupabase()
  // Retry on the (unlikely) code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = makeCode()
    const { data, error } = await sb
      .from(T_ROOMS)
      .insert({
        id,
        name: input.name,
        date_mode: input.dateMode,
        vote_mode: input.voteMode,
        candidate_dates: input.candidateDates,
      })
      .select('id,name,date_mode,vote_mode,candidate_dates,created_at')
      .single()
    if (!error && data) return mapRoom(data)
    if (error && error.code !== '23505') throw error // 23505 = unique_violation
  }
  throw new Error('방 코드를 생성하지 못했습니다. 다시 시도해 주세요.')
}

export async function fetchRoom(code: string): Promise<Room | null> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from(T_ROOMS)
    .select('id,name,date_mode,vote_mode,candidate_dates,created_at')
    .eq('id', code)
    .maybeSingle()
  if (error) throw error
  return data ? mapRoom(data) : null
}

// --- Per-room store --------------------------------------------------------

export interface RoomStore {
  readonly room: Room
  load(): Promise<PlannerState>
  /** Subscribe to state changes (fires with fresh state). Returns unsubscribe. */
  subscribe(cb: (s: PlannerState) => void): () => void

  addVenue(name: string, nickname: string): Promise<void>
  toggleVenueVote(venueId: string, voter: string): Promise<void>
  toggleDateVote(day: string, voter: string, name: string): Promise<void>

  /** Doodle strokes/clear over the room broadcast channel. Returns unsubscribe. */
  connectDoodle(onStroke: (s: Stroke) => void, onClear: () => void): () => void
  sendStroke(s: Stroke): void
  sendClear(): void

  /** Live cursors over the room broadcast channel. Returns unsubscribe. */
  connectCursors(onCursor: (c: Cursor) => void, onLeave: (id: string) => void): () => void
  sendCursor(c: Cursor): void
  sendCursorLeave(id: string): void

  /** Presence: track myself and observe who is connected. Returns unsubscribe. */
  connectPresence(me: Presence, onChange: (users: Presence[]) => void): () => void

  /** Doodle snapshot persistence for late joiners. */
  loadSnapshot(): Promise<string | null>
  saveSnapshot(dataUrl: string): Promise<void>
}

const stores = new Map<string, RoomStore>()

export function getRoomStore(room: Room): RoomStore {
  const cached = stores.get(room.id)
  if (cached) return cached
  const store = createRoomStore(room)
  stores.set(room.id, store)
  return store
}

function createRoomStore(room: Room): RoomStore {
  const sb = requireSupabase()
  const roomId = room.id
  const listeners = new Set<(s: PlannerState) => void>()
  const strokeHandlers = new Set<(s: Stroke) => void>()
  const clearHandlers = new Set<() => void>()
  const cursorHandlers = new Set<(c: Cursor) => void>()
  const leaveHandlers = new Set<(id: string) => void>()
  const presenceHandlers = new Set<(users: Presence[]) => void>()

  let dbSubscribed = false
  let rt: RealtimeChannel | null = null
  let rtSubscribed = false
  let presenceMe: Presence | null = null

  function presenceUsers(ch: RealtimeChannel): Presence[] {
    const state = ch.presenceState() as Record<string, Array<Partial<Presence>>>
    const out: Presence[] = []
    const seen = new Set<string>()
    for (const metas of Object.values(state)) {
      for (const m of metas) {
        if (m.id && !seen.has(m.id)) {
          seen.add(m.id)
          out.push({ id: m.id, nick: m.nick ?? '익명', color: m.color ?? '#c9b8e8' })
        }
      }
    }
    return out
  }

  async function fetchAll(): Promise<PlannerState> {
    const [venues, venueVotes, dateVotes] = await Promise.all([
      sb
        .from(T_VENUES)
        .select('id,name,created_by,created_at')
        .eq('room_id', roomId)
        .order('created_at'),
      sb.from(T_VENUE_VOTES).select('venue_id,voter').eq('room_id', roomId),
      sb.from(T_DATE_VOTES).select('day,voter,voter_name').eq('room_id', roomId),
    ])
    return {
      venues: (venues.data ?? []).map((v) => ({
        id: String(v.id),
        name: v.name,
        created_by: v.created_by,
        created_at: v.created_at,
      })),
      venueVotes: (venueVotes.data ?? []).map((v) => ({
        venue_id: String(v.venue_id),
        voter: v.voter,
      })),
      dateVotes: (dateVotes.data ?? []).map((d) => ({
        day: d.day,
        voter: d.voter,
        name: d.voter_name ?? undefined,
      })),
    }
  }

  async function reloadAndNotify() {
    const s = await fetchAll()
    listeners.forEach((cb) => cb(s))
  }

  function ensureDbRealtime() {
    if (dbSubscribed) return
    dbSubscribed = true
    const filter = `room_id=eq.${roomId}`
    sb.channel(`gathering_db:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: T_VENUES, filter }, reloadAndNotify)
      .on('postgres_changes', { event: '*', schema: 'public', table: T_VENUE_VOTES, filter }, reloadAndNotify)
      .on('postgres_changes', { event: '*', schema: 'public', table: T_DATE_VOTES, filter }, reloadAndNotify)
      .subscribe()
  }

  // One channel per room shared by doodle strokes, cursors, and presence.
  function ensureRt(): RealtimeChannel {
    if (rt) return rt
    const ch = sb.channel(`gathering_rt:${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: getDeviceId() } },
    })
    ch.on('broadcast', { event: 'stroke' }, ({ payload }) =>
      strokeHandlers.forEach((h) => h(payload as Stroke)),
    )
      .on('broadcast', { event: 'clear' }, () => clearHandlers.forEach((h) => h()))
      .on('broadcast', { event: 'cursor' }, ({ payload }) =>
        cursorHandlers.forEach((h) => h(payload as Cursor)),
      )
      .on('broadcast', { event: 'leave' }, ({ payload }) =>
        leaveHandlers.forEach((h) => h((payload as { id: string }).id)),
      )
      .on('presence', { event: 'sync' }, () => {
        const users = presenceUsers(ch)
        presenceHandlers.forEach((h) => h(users))
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          rtSubscribed = true
          if (presenceMe) ch.track(presenceMe)
        }
      })
    rt = ch
    return ch
  }

  return {
    room,
    async load() {
      ensureDbRealtime()
      return fetchAll()
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async addVenue(name, nickname) {
      const { error } = await sb
        .from(T_VENUES)
        .insert({ room_id: roomId, name, created_by: nickname })
      if (error) throw error
      await reloadAndNotify()
    },
    async toggleVenueVote(venueId, voter) {
      const existing = await sb
        .from(T_VENUE_VOTES)
        .select('id')
        .eq('venue_id', venueId)
        .eq('voter', voter)
        .maybeSingle()
      if (existing.data) {
        await sb.from(T_VENUE_VOTES).delete().eq('venue_id', venueId).eq('voter', voter)
      } else {
        await sb.from(T_VENUE_VOTES).insert({ room_id: roomId, venue_id: venueId, voter })
      }
      await reloadAndNotify()
    },
    async toggleDateVote(day, voter, name) {
      const existing = await sb
        .from(T_DATE_VOTES)
        .select('id')
        .eq('room_id', roomId)
        .eq('day', day)
        .eq('voter', voter)
        .maybeSingle()
      if (existing.data) {
        await sb.from(T_DATE_VOTES).delete().eq('room_id', roomId).eq('day', day).eq('voter', voter)
      } else {
        if (room.voteMode === 'single') {
          // Single choice: this voter can hold only one date in this room.
          await sb.from(T_DATE_VOTES).delete().eq('room_id', roomId).eq('voter', voter)
        }
        await sb.from(T_DATE_VOTES).insert({ room_id: roomId, day, voter, voter_name: name })
      }
      await reloadAndNotify()
    },

    connectDoodle(onStroke, onClear) {
      ensureRt()
      strokeHandlers.add(onStroke)
      clearHandlers.add(onClear)
      return () => {
        strokeHandlers.delete(onStroke)
        clearHandlers.delete(onClear)
      }
    },
    sendStroke(s) {
      ensureRt().send({ type: 'broadcast', event: 'stroke', payload: s })
    },
    sendClear() {
      ensureRt().send({ type: 'broadcast', event: 'clear', payload: {} })
    },

    connectCursors(onCursor, onLeave) {
      ensureRt()
      cursorHandlers.add(onCursor)
      leaveHandlers.add(onLeave)
      return () => {
        cursorHandlers.delete(onCursor)
        leaveHandlers.delete(onLeave)
      }
    },
    sendCursor(c) {
      ensureRt().send({ type: 'broadcast', event: 'cursor', payload: c })
    },
    sendCursorLeave(id) {
      ensureRt().send({ type: 'broadcast', event: 'leave', payload: { id } })
    },

    connectPresence(me, onChange) {
      presenceMe = me
      presenceHandlers.add(onChange)
      const ch = ensureRt()
      if (rtSubscribed) {
        ch.track(me)
        onChange(presenceUsers(ch))
      }
      return () => {
        presenceHandlers.delete(onChange)
        ch.untrack()
      }
    },

    async loadSnapshot() {
      const { data } = await sb.from(T_ROOMS).select('doodle_snapshot').eq('id', roomId).maybeSingle()
      return (data?.doodle_snapshot as string | null) ?? null
    },
    async saveSnapshot(dataUrl) {
      await sb.from(T_ROOMS).update({ doodle_snapshot: dataUrl }).eq('id', roomId)
    },
  }
}

export { hasSupabase }
