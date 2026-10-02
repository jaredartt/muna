import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import type { SvgIconData } from './svgIcons'

// Icons uploaded by the people in the home (table custom_icons). Kept in memory, cached on the phone for a fast start,
// and updated live through Supabase realtime, so an icon Lidia uploads shows up for Jared within a moment.
export type CustomIcon = { id: string; name: string; tags: string; data: SvgIconData; created_at: string }

type Row = { id: string; name: string; tags: string; view_box: string; root: Record<string, string>; nodes: SvgIconData['nodes']; created_at: string }

const CACHE_KEY = 'muna.customIcons.v1'
let icons: CustomIcon[] = []
let ready = false
const subs = new Set<() => void>()

function emit() {
  icons = [...icons]
  subs.forEach((f) => f())
}
function subscribe(f: () => void) {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

const fromRow = (r: Row): CustomIcon => ({ id: r.id, name: r.name, tags: r.tags ?? '', created_at: r.created_at, data: { viewBox: r.view_box, root: r.root ?? {}, nodes: r.nodes } })

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (raw) {
      icons = JSON.parse(raw) as CustomIcon[]
      ready = true
    }
  } catch {
    /* no cache, fine */
  }
}
function writeCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(icons))
  } catch {
    /* storage full or blocked, fine */
  }
}
readCache()

export function useCustomIcons(): CustomIcon[] {
  return useSyncExternalStore(subscribe, () => icons)
}
export function customIconById(key: string): CustomIcon | undefined {
  return icons.find((i) => i.id === key)
}
export const customIconsReady = () => ready

/** Starts loading + live updates for this home. Returns a stop function. */
export function startCustomIconSync(householdId: string): () => void {
  let alive = true
  void (async () => {
    const { data } = await supabase.from('custom_icons').select('id, name, tags, view_box, root, nodes, created_at').eq('household_id', householdId).order('created_at', { ascending: true })
    if (!alive || !data) return
    icons = (data as Row[]).map(fromRow)
    ready = true
    writeCache()
    emit()
  })()
  const channel = supabase
    .channel('custom-icons-' + householdId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'custom_icons', filter: `household_id=eq.${householdId}` }, (p) => {
      const row = p.new as Row
      if (icons.some((i) => i.id === row.id)) return
      icons = [...icons, fromRow(row)]
      ready = true
      writeCache()
      emit()
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'custom_icons' }, (p) => {
      const id = (p.old as { id?: string }).id
      if (!id) return
      icons = icons.filter((i) => i.id !== id)
      writeCache()
      emit()
    })
    .subscribe()
  return () => {
    alive = false
    void supabase.removeChannel(channel)
  }
}

export async function addCustomIcon(householdId: string, name: string, tags: string, data: SvgIconData): Promise<string | null> {
  const { data: row, error } = await supabase
    .from('custom_icons')
    .insert({ household_id: householdId, name: name.slice(0, 60), tags: tags.slice(0, 200), view_box: data.viewBox, root: data.root, nodes: data.nodes })
    .select('id, name, tags, view_box, root, nodes, created_at')
    .single()
  if (error || !row) return 'Could not save that icon.'
  if (!icons.some((i) => i.id === (row as Row).id)) {
    icons = [...icons, fromRow(row as Row)]
    writeCache()
    emit()
  }
  return null
}

export async function deleteCustomIcon(id: string): Promise<boolean> {
  const { error } = await supabase.from('custom_icons').delete().eq('id', id)
  if (error) return false
  icons = icons.filter((i) => i.id !== id)
  writeCache()
  emit()
  return true
}
