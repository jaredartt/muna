import { supabase } from './supabase'

/** Saves a new order: row number i gets position i. `apply` updates the screen straight away (the caller's liveTable). */
export async function savePositions(table: 'uni_items' | 'hobbies' | 'gym_splits' | 'gym_exercises', ids: string[], apply: (id: string, position: number) => void): Promise<string | null> {
  ids.forEach((id, i) => apply(id, i))
  const res = await Promise.all(ids.map((id, i) => supabase.from(table).update({ position: i }).eq('id', id)))
  return res.find((r) => r.error)?.error?.message ?? null
}

/** The same list with the item `id` moved to index `to` (to counts in the list WITHOUT that item). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(next.length, to)), 0, x)
  return next
}
