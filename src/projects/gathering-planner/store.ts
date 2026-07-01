// Data layer for the Gathering Planner.
//
// One interface, two backends:
//   - Supabase: Postgres tables + Realtime "Postgres Changes" to sync votes and
//     venues across devices, and a Broadcast channel for high-frequency doodle
//     strokes (never written to disk).
//   - Local: localStorage state synced across tabs of the same browser via
//     BroadcastChannel, so the app is fully functional with no backend at all.
//
// Vote counts are small, so the strategy is simply "refetch everything on any
// change and recompute" — trivially correct and easy to reason about.

import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabase, hasSupabase } from './supabaseClient'

export type Venue = {
  id: string
  name: string
  created_by: string
  created_at: string
}
export type VenueVote = { venue_id: string; voter: string }
export type DateVote = { day: string; voter: string } // day = 'YYYY-MM-DD'

export type PlannerState = {
  venues: Venue[]
  venueVotes: VenueVote[]
  dateVotes: DateVote[]
}

export type Stroke = {
  x0: number
  y0: number
  x1: number
  y1: number
  color: string
  size: number
}

export type VoteMode = 'single' | 'multiple'

export const emptyState: PlannerState = { venues: [], venueVotes: [], dateVotes: [] }

export interface PlannerStore {
  readonly online: boolean
  load(): Promise<PlannerState>
  /** Subscribe to state changes (fires with fresh state). Returns unsubscribe. */
  subscribe(cb: (s: PlannerState) => void): () => void

  addVenue(name: string, nickname: string): Promise<void>
  toggleVenueVote(venueId: string, voter: string): Promise<void>
  toggleDateVote(day: string, voter: string, mode: VoteMode): Promise<void>

  /** Doodle board realtime. Returns unsubscribe. */
  connectDoodle(onStroke: (s: Stroke) => void, onClear: () => void): () => void
  sendStroke(s: Stroke): void
  sendClear(): void
}

// ---------------------------------------------------------------------------
// Supabase backend
// ---------------------------------------------------------------------------

const T_VENUES = 'gathering_venues'
const T_VENUE_VOTES = 'gathering_venue_votes'
const T_DATE_VOTES = 'gathering_date_votes'

function createSupabaseStore(): PlannerStore {
  const sb = getSupabase()!
  const listeners = new Set<(s: PlannerState) => void>()
  let subscribed = false

  async function fetchAll(): Promise<PlannerState> {
    const [venues, venueVotes, dateVotes] = await Promise.all([
      sb.from(T_VENUES).select('id,name,created_by,created_at').order('created_at'),
      sb.from(T_VENUE_VOTES).select('venue_id,voter'),
      sb.from(T_DATE_VOTES).select('day,voter'),
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
      dateVotes: (dateVotes.data ?? []).map((d) => ({ day: d.day, voter: d.voter })),
    }
  }

  async function reloadAndNotify() {
    const s = await fetchAll()
    listeners.forEach((cb) => cb(s))
  }

  function ensureRealtime() {
    if (subscribed) return
    subscribed = true
    sb.channel('gathering_planner_db')
      .on('postgres_changes', { event: '*', schema: 'public', table: T_VENUES }, reloadAndNotify)
      .on('postgres_changes', { event: '*', schema: 'public', table: T_VENUE_VOTES }, reloadAndNotify)
      .on('postgres_changes', { event: '*', schema: 'public', table: T_DATE_VOTES }, reloadAndNotify)
      .subscribe()
  }

  return {
    online: true,
    async load() {
      ensureRealtime()
      return fetchAll()
    },
    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async addVenue(name, nickname) {
      const { error } = await sb.from(T_VENUES).insert({ name, created_by: nickname })
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
        await sb.from(T_VENUE_VOTES).insert({ venue_id: venueId, voter })
      }
      await reloadAndNotify()
    },
    async toggleDateVote(day, voter, mode) {
      const existing = await sb
        .from(T_DATE_VOTES)
        .select('id')
        .eq('day', day)
        .eq('voter', voter)
        .maybeSingle()
      if (existing.data) {
        await sb.from(T_DATE_VOTES).delete().eq('day', day).eq('voter', voter)
      } else {
        if (mode === 'single') {
          // Single choice: this voter can hold only one date.
          await sb.from(T_DATE_VOTES).delete().eq('voter', voter)
        }
        await sb.from(T_DATE_VOTES).insert({ day, voter })
      }
      await reloadAndNotify()
    },
    connectDoodle(onStroke, onClear) {
      const ch = sb.channel('gathering_doodle', { config: { broadcast: { self: false } } })
      ch.on('broadcast', { event: 'stroke' }, ({ payload }) => onStroke(payload as Stroke))
        .on('broadcast', { event: 'clear' }, () => onClear())
        .subscribe()
      doodleChannel = ch
      return () => {
        sb.removeChannel(ch)
        doodleChannel = null
      }
    },
    sendStroke(s) {
      doodleChannel?.send({ type: 'broadcast', event: 'stroke', payload: s })
    },
    sendClear() {
      doodleChannel?.send({ type: 'broadcast', event: 'clear', payload: {} })
    },
  }
}

// Held outside the object so send* can reach the subscribed channel.
let doodleChannel: RealtimeChannel | null = null

// ---------------------------------------------------------------------------

let store: PlannerStore | null = null

/**
 * The Supabase-backed store. There is intentionally NO local fallback: this app
 * is Supabase-only, so when keys are absent this throws and the UI shows a
 * configuration error instead of silently running in a disconnected mode.
 */
export function getStore(): PlannerStore {
  if (!hasSupabase) {
    throw new Error(
      'Supabase 키가 설정되지 않았습니다. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 설정하세요.',
    )
  }
  if (!store) store = createSupabaseStore()
  return store
}
