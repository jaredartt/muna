import { createClient } from '@supabase/supabase-js'

// These two values are PUBLIC by design (they are safe to be in the browser).
// All real protection comes from Row Level Security inside Supabase.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://vlatdcjwxbflicomkbnr.supabase.co'
const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_BSH5dUxlVyjAOpKh7GIoZQ_OYk-fpxB'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
