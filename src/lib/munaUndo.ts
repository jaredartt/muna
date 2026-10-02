import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// The one last change Muna made for this person (table muna_undo, one row per person). It is kept in the database, not on the phone, so it is
// still there after the app is closed. The steps to put things back are stored there too and run by the muna-chat function ("undo": true).
export type LastChange = { summary: string; request: string; created_at: string }

/** "just now", "5 min ago", "2 h ago", or the date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function useLastChange(userId: string | undefined): { change: LastChange | null; refresh: () => Promise<void> } {
  const [change, setChange] = useState<LastChange | null>(null)
  const refresh = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase.from('muna_undo').select('summary, request, created_at').eq('user_id', userId).maybeSingle()
    if (!error) setChange((data as LastChange | null) ?? null) // offline: keep showing what we had
  }, [userId])
  useEffect(() => {
    void refresh()
    const onShow = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onShow)
    window.addEventListener('focus', onShow)
    return () => {
      document.removeEventListener('visibilitychange', onShow)
      window.removeEventListener('focus', onShow)
    }
  }, [refresh])
  return { change, refresh }
}
