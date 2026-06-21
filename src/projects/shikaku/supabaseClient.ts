// Lazily create a Supabase client from build-time env vars. Returns null when
// keys are absent, so the app cleanly falls back to a local leaderboard.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let cached: SupabaseClient | null | undefined

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached
  cached = URL && ANON ? createClient(URL, ANON) : null
  return cached
}

export const hasSupabase = !!(URL && ANON)
