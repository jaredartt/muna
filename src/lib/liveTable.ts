import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

/**
 * A home's table kept in memory, cached on the phone and live through realtime (same pattern as the products list).
 * Usage: const recipes = liveTable<Recipe>('recipes', 'muna.recipes.v1', sort); recipes.use() in a component; recipes.start(householdId) once.
 */
export function liveTable<T extends { id: string }>(table: string, cacheKey: string, sort: (a: T, b: T) => number) {
  let items: T[] = []
  let ready = false
  const subs = new Set<() => void>()
  const emit = () => {
    items = [...items]
    subs.forEach((f) => f())
  }
  const subscribe = (f: () => void) => {
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  }
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw) {
      items = JSON.parse(raw) as T[]
      ready = true
    }
  } catch {
    /* no cache, fine */
  }
  const writeCache = () => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(items))
    } catch {
      /* fine */
    }
  }
  const upsert = (row: T) => {
    items = [...items.filter((i) => i.id !== row.id), row].sort(sort)
    writeCache()
    emit()
  }
  const remove = (id: string) => {
    items = items.filter((i) => i.id !== id)
    writeCache()
    emit()
  }
  return {
    use: (): T[] => useSyncExternalStore(subscribe, () => items),
    all: (): T[] => items,
    isReady: () => ready,
    upsert,
    remove,
    /** Starts loading and live updates for this home. Returns a stop function. */
    start(householdId: string): () => void {
      let alive = true
      void (async () => {
        const { data } = await supabase.from(table).select('*').eq('household_id', householdId)
        if (!alive || !data) return
        items = (data as T[]).sort(sort)
        ready = true
        writeCache()
        emit()
      })()
      const channel = supabase
        .channel(`${table}-${householdId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` }, (p) => {
          if (p.eventType === 'DELETE') {
            const id = (p.old as { id?: string }).id
            if (id) remove(id)
          } else upsert(p.new as T)
        })
        .subscribe()
      return () => {
        alive = false
        void supabase.removeChannel(channel)
      }
    },
  }
}
