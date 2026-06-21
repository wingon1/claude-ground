// Leaderboard storage abstraction. A Supabase adapter is used when env keys are
// present; otherwise a localStorage adapter keeps everything working offline.
// New backends can be added by implementing LeaderboardAdapter.

import type { TierId } from './levels'
import { getSupabase, hasSupabase } from './supabaseClient'

export type ScoreEntry = {
  mode: string
  tier: TierId
  nickname: string
  score: number
  comboMax: number
  solvedCount: number
  durationSec: number
  deviceId: string
}

export type RankRow = ScoreEntry & { createdAt: string }

export type TopQuery = { mode: string; tier: TierId; limit: number }

export interface LeaderboardAdapter {
  /** True when this is a shared/online backend (vs device-local). */
  readonly online: boolean
  submit(entry: ScoreEntry): Promise<void>
  top(q: TopQuery): Promise<RankRow[]>
}

const TABLE = 'shikaku_scores'

const supabaseAdapter: LeaderboardAdapter = {
  online: true,
  async submit(e) {
    const sb = getSupabase()
    if (!sb) throw new Error('no supabase client')
    const { error } = await sb.from(TABLE).insert({
      mode: e.mode,
      tier: e.tier,
      nickname: e.nickname,
      score: e.score,
      combo_max: e.comboMax,
      solved_count: e.solvedCount,
      duration_sec: e.durationSec,
      device_id: e.deviceId,
    })
    if (error) throw error
  },
  async top(q) {
    const sb = getSupabase()
    if (!sb) throw new Error('no supabase client')
    const { data, error } = await sb
      .from(TABLE)
      .select('mode,tier,nickname,score,combo_max,solved_count,duration_sec,device_id,created_at')
      .eq('mode', q.mode)
      .eq('tier', q.tier)
      .order('score', { ascending: false })
      .limit(q.limit)
    if (error) throw error
    return (data ?? []).map((r) => ({
      mode: r.mode,
      tier: r.tier as TierId,
      nickname: r.nickname,
      score: r.score,
      comboMax: r.combo_max,
      solvedCount: r.solved_count,
      durationSec: r.duration_sec,
      deviceId: r.device_id ?? '',
      createdAt: r.created_at,
    }))
  },
}

const LOCAL_KEY = 'shikaku.leaderboard.v1'

function readLocal(): RankRow[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as RankRow[]
  } catch {
    return []
  }
}

const localAdapter: LeaderboardAdapter = {
  online: false,
  async submit(e) {
    if (typeof localStorage === 'undefined') return
    const rows = readLocal()
    rows.push({ ...e, createdAt: new Date().toISOString() })
    // Keep the file small: top 100 by score.
    rows.sort((a, b) => b.score - a.score)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 100)))
  },
  async top(q) {
    return readLocal()
      .filter((r) => r.mode === q.mode && r.tier === q.tier)
      .sort((a, b) => b.score - a.score)
      .slice(0, q.limit)
  },
}

/** Active adapter, chosen by whether Supabase keys were provided at build. */
export const leaderboard: LeaderboardAdapter = hasSupabase ? supabaseAdapter : localAdapter

// ---------------------------------------------------------------------------
// Pending-sync queue: when an online submit fails (bad network), the entry is
// queued here and flushed to Supabase later — on app load and when the ranking
// opens — so an offline-cached best is never permanently stuck offline.
// ---------------------------------------------------------------------------

const PENDING_KEY = 'shikaku.pending.v1'

function readPending(): ScoreEntry[] {
  if (typeof localStorage === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]') as ScoreEntry[]
  } catch {
    return []
  }
}
function writePending(rows: ScoreEntry[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(rows.slice(-50)))
  } catch {
    /* ignore */
  }
}
function enqueuePending(entry: ScoreEntry): void {
  writePending([...readPending(), entry])
}

/** Push any queued offline scores to the online board. Returns count synced. */
export async function flushPending(): Promise<number> {
  if (!hasSupabase) return 0
  const pending = readPending()
  if (pending.length === 0) return 0
  const remain: ScoreEntry[] = []
  let synced = 0
  for (const e of pending) {
    try {
      await supabaseAdapter.submit(e)
      synced++
    } catch {
      remain.push(e)
    }
  }
  writePending(remain)
  return synced
}

/**
 * Submit online; if the online write fails (network/RLS), keep the run locally
 * and queue it for automatic online sync later. Returns whether it landed online.
 */
export async function submitScore(entry: ScoreEntry): Promise<{ online: boolean }> {
  if (leaderboard.online) {
    // Opportunistically drain the backlog first.
    await flushPending().catch(() => {})
    try {
      await leaderboard.submit(entry)
      return { online: true }
    } catch {
      await localAdapter.submit(entry)
      enqueuePending(entry)
      return { online: false }
    }
  }
  await leaderboard.submit(entry)
  return { online: false }
}

/** Fetch top scores; on online failure, fall back to local rows. */
export async function topScores(q: TopQuery): Promise<{ rows: RankRow[]; online: boolean }> {
  if (leaderboard.online) {
    try {
      return { rows: await leaderboard.top(q), online: true }
    } catch {
      return { rows: await localAdapter.top(q), online: false }
    }
  }
  return { rows: await leaderboard.top(q), online: false }
}
