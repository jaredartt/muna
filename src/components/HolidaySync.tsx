import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { notifyTasksChanged } from '../lib/events'
import { holidaysOf } from '../lib/holidays'
import { todayStr } from '../lib/dates'

const KEY = 'muna.holidayTasks.v1'
const NOTE = 'Public holiday in Frankfurt (Hesse). Shops are closed. (Added by Muna)'

const readDone = (): number[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as number[]
  } catch {
    return []
  }
}
const writeDone = (years: number[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(years))
  } catch {
    /* fine */
  }
}

/**
 * From the 1st of December Muna adds next year's public holidays of Frankfurt (Hesse) as all-day tasks, so they show in the calendar.
 * (If the app was not opened in December, it is done as soon as the new year has started.) Renders nothing.
 * The holidays themselves are worked out in src/lib/holidays.ts; Muna in the chat and the shopping suggestions use the same list.
 */
export default function HolidaySync() {
  const { profile, session } = useAuth()
  const householdId = profile?.household_id
  const userId = session?.user.id

  useEffect(() => {
    if (!householdId || !userId) return
    // both phones may run this: wait a random moment and look at the real list right before adding
    const t = window.setTimeout(async () => {
      const today = todayStr()
      const year = Number(today.slice(0, 4))
      const years = [...(year >= 2027 ? [year] : []), ...(today >= `${year}-12-01` ? [year + 1] : [])]
      const done = readDone()
      for (const y of years) {
        if (done.includes(y)) continue
        const { data: have, error } = await supabase
          .from('tasks')
          .select('id')
          .eq('household_id', householdId)
          .gte('due_date', `${y}-01-01`)
          .lte('due_date', `${y}-12-31`)
          .like('notes', 'Public holiday in Frankfurt%')
          .limit(1)
        if (error) return // no connection: try again next time
        if (!have?.length) {
          const rows = [...holidaysOf(y)].sort().map(([date, name]) => ({
            household_id: householdId,
            created_by: userId,
            title: name,
            notes: NOTE,
            due_date: date,
            icon: 'star',
            color: 'butter',
            sync_google: false,
          }))
          const { error: e } = await supabase.from('tasks').insert(rows)
          if (e) return
          notifyTasksChanged()
        }
        done.push(y)
        writeDone(done)
      }
    }, 7000 + Math.random() * 4000)
    return () => window.clearTimeout(t)
  }, [householdId, userId])

  return null
}
