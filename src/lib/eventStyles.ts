import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import type { GoogleEvent } from './google'

// The icon and colour you picked for Google Calendar events (table event_styles). Same idea as customIcons.ts:
// kept in memory, cached on the phone, and updated live through Supabase realtime so Lidia sees your choice at once.
export type EventStyle = { icon: string | null; color: string | null }
type Row = { event_key: string; icon: string | null; color: string | null }

const CACHE_KEY = 'muna.eventStyles.v1'
let styles: Record<string, EventStyle> = {}
let householdIdNow: string | null = null
let done = new Set<string>() // "<event key>|<day>"
const subs = new Set<() => void>()

function emit() {
  styles = { ...styles }
  done = new Set(done)
  subs.forEach((f) => f())
}
function subscribe(f: () => void) {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
function writeCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(styles))
  } catch {
    /* fine */
  }
}
try {
  const raw = localStorage.getItem(CACHE_KEY)
  if (raw) styles = JSON.parse(raw) as Record<string, EventStyle>
} catch {
  /* no cache, fine */
}

/** One key per event. A repeating event shares one key for all its days (Google names a day "<series id>_<date>"). */
export function eventStyleKey(ev: Pick<GoogleEvent, 'owner_id' | 'event_id' | 'recurring'>): string {
  const id = ev.recurring ? ev.event_id.replace(/_\d{8}(T\d{6}Z?)?$/, '') : ev.event_id
  return `${ev.owner_id}:${id}`
}

export function useEventStyles(): Record<string, EventStyle> {
  return useSyncExternalStore(subscribe, () => styles)
}

/** The day an event's tick belongs to (the day it starts). */
export const eventDay = (ev: GoogleEvent) => (ev.all_day ? ev.start : ev.start.slice(0, 10))
const doneKey = (ev: GoogleEvent) => `${eventStyleKey(ev)}|${eventDay(ev)}`
export function useEventDone(): Set<string> {
  return useSyncExternalStore(subscribe, () => done)
}
export const isEventDone = (set: Set<string>, ev: GoogleEvent) => set.has(doneKey(ev))

export async function toggleEventDone(ev: GoogleEvent): Promise<void> {
  if (!householdIdNow) return
  const key = doneKey(ev)
  const base = { household_id: householdIdNow, event_key: eventStyleKey(ev), day: eventDay(ev) }
  if (done.has(key)) {
    done.delete(key)
    emit()
    const { error } = await supabase.from('event_done').delete().match(base)
    if (error) {
      done.add(key)
      emit()
    }
  } else {
    done.add(key)
    emit()
    const { error } = await supabase.from('event_done').upsert(base)
    if (error) {
      done.delete(key)
      emit()
    }
  }
}

export function startEventStyleSync(householdId: string): () => void {
  householdIdNow = householdId
  let alive = true
  void (async () => {
    const { data } = await supabase.from('event_styles').select('event_key, icon, color').eq('household_id', householdId)
    if (!alive || !data) return
    const next: Record<string, EventStyle> = {}
    for (const r of data as Row[]) next[r.event_key] = { icon: r.icon, color: r.color }
    styles = next
    writeCache()
    emit()
  })()
  void (async () => {
    const { data } = await supabase.from('event_done').select('event_key, day').eq('household_id', householdId)
    if (!alive || !data) return
    done = new Set((data as { event_key: string; day: string }[]).map((r) => `${r.event_key}|${r.day}`))
    emit()
  })()
  const apply = (p: { new: unknown }) => {
    const r = p.new as Row
    if (!r?.event_key) return
    styles[r.event_key] = { icon: r.icon, color: r.color }
    writeCache()
    emit()
  }
  const channel = supabase
    .channel('event-styles-' + householdId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_styles', filter: `household_id=eq.${householdId}` }, apply)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'event_styles', filter: `household_id=eq.${householdId}` }, apply)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'event_styles' }, (p) => {
      const key = (p.old as { event_key?: string }).event_key
      if (!key) return
      delete styles[key]
      writeCache()
      emit()
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'event_done', filter: `household_id=eq.${householdId}` }, (p) => {
      const r = p.new as { event_key?: string; day?: string }
      if (r.event_key && r.day) {
        done.add(`${r.event_key}|${r.day}`)
        emit()
      }
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'event_done' }, (p) => {
      const r = p.old as { event_key?: string; day?: string }
      if (r.event_key && r.day) {
        done.delete(`${r.event_key}|${r.day}`)
        emit()
      }
    })
    .subscribe()
  return () => {
    alive = false
    void supabase.removeChannel(channel)
  }
}

/** Save the icon and colour for an event. Picking nothing for both puts it back to the default. */
export async function saveEventStyle(ev: GoogleEvent, style: EventStyle): Promise<string | null> {
  if (!householdIdNow) return 'Not ready yet. Try again in a moment.'
  const key = eventStyleKey(ev)
  if (!style.icon && !style.color) {
    const { error } = await supabase.from('event_styles').delete().eq('household_id', householdIdNow).eq('event_key', key)
    if (error) return 'Could not save the look.'
    delete styles[key]
  } else {
    const { error } = await supabase
      .from('event_styles')
      .upsert({ household_id: householdIdNow, event_key: key, icon: style.icon, color: style.color, updated_at: new Date().toISOString() })
    if (error) return 'Could not save the look.'
    styles[key] = style
  }
  writeCache()
  emit()
  return null
}
