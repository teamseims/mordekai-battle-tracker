import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// null when env vars are not set (e.g. in tests or local-only mode).
// The app falls back to localStorage in that case.
export const supabase = url && key ? createClient(url, key) : null
