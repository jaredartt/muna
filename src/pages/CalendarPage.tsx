import { useEffect, useMemo, useState } from 'react'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import DayView from '../components/DayView'
import WeekView from '../components/WeekView'
import { useTasksCtx } from '../context/TasksContext'
import { useAuth } from '../context/AuthContext'
import { useGoogleEvents } from '../hooks/useGoogleEvents'
import { eventDays, updateGoogleEvent, type GoogleEvent } from '../lib/google'
import { eventStyleKey, isEventDone, toggleEventDone, useEventDone, useEventStyles } from '../lib/eventStyles'
import { fmtMin, hhmmss, toMin, type DayItem } from '../lib/dayItems'
import { notifyTasksChanged } from '../lib/events'
import { WEEKDAYS_MON_FIRST, addDays, formatDateNice, monthGrid, parseDateStr, todayStr, toDateStr } from '../lib/dates'
import { navigate } from '../lib/router'
import { useConfirm } from '../components/Confirm'
import type { Occurrence } from '../lib/types'

type Mode = 'day' | 'week' | 'month'
const MODES: { id: Mode; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
]
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

const mondayOf = (d: string) => addDays(d, -((parseDateStr(d).getDay() + 6) % 7))
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes()
const monthName = (d: string) => parseDateStr(d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

export default function CalendarPage() {
  const { toggleTask, updateTask, addTask, openEditor, openEvent, occurrencesOn, occurrenceMap } = useTasksCtx()
  const { googleConnected, members } = useAuth()
  const { choose } = useConfirm()
  const styles = useEventStyles()
  const doneSet = useEventDone()
  const today = todayStr()
  const [mode, setMode] = useState<Mode>('day')
  const [selected, setSelected] = useState(today)
  const [note, setNote] = useState('')
  const [moved, setMoved] = useState<Map<string, { allDay: boolean; start: number; end: number }>>(new Map())

  const weekStart = mondayOf(selected)
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const monthFirst = toDateStr(new Date(parseDateStr(selected).getFullYear(), parseDateStr(selected).getMonth(), 1))

  // Which Google events to fetch: the month while looking at the month, otherwise the visible week (plus a day each side).
  const rangeFrom = useMemo(() => (mode === 'month' ? parseDateStr(monthFirst) : parseDateStr(addDays(weekStart, -1))), [mode, monthFirst, weekStart])
  const rangeTo = useMemo(() => {
    if (mode === 'month') {
      const f = parseDateStr(monthFirst)
      return new Date(f.getFullYear(), f.getMonth() + 1, 1)
    }
    return parseDateStr(addDays(weekStart, 8))
  }, [mode, monthFirst, weekStart])
  const google = useGoogleEvents(rangeFrom, rangeTo)
  useEffect(() => setMoved(new Map()), [google.events]) // the real answer from Google replaces what we showed while saving

  const eventsByDate = useMemo(() => {
    const map = new Map<string, GoogleEvent[]>()
    for (const ev of google.events) {
      for (const d of eventDays(ev)) map.set(d, [...(map.get(d) ?? []), ev])
    }
    return map
  }, [google.events])

  const ownerColor = (id: string) => members.find((m) => m.id === id)?.avatar_color ?? 'sky'

  function itemsFor(date: string, tasks: Occurrence[]): DayItem[] {
    const out: DayItem[] = []
    for (const t of tasks) {
      const timed = Boolean(t.start_time)
      const s = timed ? toMin(t.start_time!) : 0
      let e = t.end_time ? toMin(t.end_time) : s + 60
      if (e <= s) e = Math.min(1440, s + 60)
      out.push({ key: 't:' + t.id, kind: 'task', title: t.title, color: t.color, icon: t.icon, done: t.completed, allDay: !timed, start: s, end: Math.min(1440, e), movable: true, open: () => openEditor(t), toggle: () => void toggleTask(t) })
    }
    for (const ev of eventsByDate.get(date) ?? []) {
      const st = styles[eventStyleKey(ev)]
      const single = eventDays(ev).length === 1
      let allDay = ev.all_day
      let s = 0
      let e = 60
      if (!ev.all_day) {
        const sd = new Date(ev.start)
        const ed = new Date(ev.end)
        s = toDateStr(sd) === date ? minutesOf(sd) : 0
        e = toDateStr(ed) === date ? minutesOf(ed) || 1440 : 1440
        if (e <= s) e = Math.min(1440, s + 60)
      }
      const key = 'e:' + ev.id
      const o = moved.get(key)
      if (o) {
        allDay = o.allDay
        s = o.start
        e = o.end
      }
      out.push({ key, kind: 'event', title: ev.title, color: st?.color ?? ownerColor(ev.owner_id), icon: st?.icon || 'IconCalendarEventFilled', done: isEventDone(doneSet, ev), allDay, start: s, end: e, movable: single, open: () => openEvent(ev), toggle: () => void toggleEventDone(ev) })
    }
    return out
  }

  const dayTasks = occurrencesOn(selected)
  const dayItems = useMemo(() => itemsFor(selected, dayTasks), [selected, dayTasks, eventsByDate, moved, styles, doneSet]) // eslint-disable-line react-hooks/exhaustive-deps

  const weekMap = useMemo(() => occurrenceMap(weekStart, addDays(weekStart, 6)), [occurrenceMap, weekStart])
  const itemsByDay = useMemo(() => {
    const m = new Map<string, DayItem[]>()
    for (const d of weekDays) m.set(d, itemsFor(d, weekMap.get(d) ?? []))
    return m
  }, [weekDays, weekMap, eventsByDate, moved, styles, doneSet]) // eslint-disable-line react-hooks/exhaustive-deps

  // Moving things by dragging in the day view
  async function onMove(item: DayItem, startMin: number | null, durMin?: number) {
    setNote('')
    const dur = durMin ?? (item.allDay ? 60 : Math.max(15, item.end - item.start))
    const end = startMin === null ? 0 : Math.min(startMin + dur, 1439)
    if (item.kind === 'task') {
      const t = dayTasks.find((x) => 't:' + x.id === item.key)
      const target = t?.series ?? t
      if (!target) return
      const times = startMin === null ? { start_time: null, end_time: null } : { start_time: hhmmss(startMin), end_time: hhmmss(end) }
      if (t?.series?.repeat) {
        // a repeating task: this day only, or the whole series?
        const answer = await choose({
          title: 'Repeated task',
          message: 'Do you want to move this specific repeated task or all of them?',
          buttons: [
            { label: 'Only this one', value: 'one', tone: 'primary' },
            { label: 'All of them', value: 'all', tone: 'primary' },
          ],
        })
        if (!answer) return
        if (answer === 'one') {
          const s = t.series
          // this day becomes its own one-off task at the new time, and the series skips the day
          const e1 = await addTask({
            title: s.title,
            notes: s.notes,
            due_date: selected,
            ...times,
            icon: s.icon,
            color: s.color,
            assigned_to: s.assigned_to,
            category: s.category ?? null,
            checklist: s.checklist,
            repeat: null,
            completed: t.completed,
            completed_at: t.completed ? new Date().toISOString() : null,
            sync_google: s.sync_google,
          })
          if (e1) return void setNote('Could not move that task. Try again.')
          const e2 = await updateTask(s.id, { repeat: { ...s.repeat!, exceptDates: [...(s.repeat!.exceptDates ?? []), selected] } })
          if (e2) setNote('Could not move that task. Try again.')
          return
        }
      }
      const err = await updateTask(target.id, times)
      if (err) setNote('Could not move that task. Try again.')
      return
    }
    const ev = (eventsByDate.get(selected) ?? []).find((x) => 'e:' + x.id === item.key)
    if (!ev) return
    setMoved((prev) => new Map(prev).set(item.key, startMin === null ? { allDay: true, start: 0, end: 60 } : { allDay: false, start: startMin, end: Math.min(1440, startMin + dur) }))
    const r = await updateGoogleEvent(ev, {
      scope: 'one', // moving a repeating event by hand changes only this day
      all_day: startMin === null,
      date: selected,
      end_date: selected,
      start_time: startMin === null ? '' : fmtMin(startMin),
      end_time: startMin === null ? '' : fmtMin(end),
    })
    if (!r.ok) {
      setMoved((prev) => {
        const n = new Map(prev)
        n.delete(item.key)
        return n
      })
      setNote(r.message ?? 'Could not move that event.')
    } else notifyTasksChanged()
  }

  // ---- navigation helpers ----
  const step = (dir: number) => setSelected(addDays(selected, mode === 'month' ? 0 : dir * 7))
  function shiftMonth(delta: number) {
    const d = parseDateStr(selected)
    setSelected(toDateStr(new Date(d.getFullYear(), d.getMonth() + delta, 1)))
  }
  const pickDay = (d: string) => {
    setSelected(d)
    setMode('day')
  }
  const cells = monthGrid(parseDateStr(selected).getFullYear(), parseDateStr(selected).getMonth())
  const monthMap = useMemo(() => {
    const f = parseDateStr(monthFirst)
    return occurrenceMap(monthFirst, toDateStr(new Date(f.getFullYear(), f.getMonth() + 1, 0)))
  }, [occurrenceMap, monthFirst])
  const dayLabel = `${formatDateNice(selected)}${selected === today || selected === addDays(today, 1) || selected === addDays(today, -1) ? ' · ' + parseDateStr(selected).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : ''}`

  return (
    <div className={'page cal-page mode-' + mode}>
      <header className="page-head">
        <h1>Calendar</h1>
        <div className="view-switch" role="radiogroup" aria-label="Calendar view">
          {MODES.map((m) => (
            <button key={m.id} role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'active' : ''} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </header>

      {mode !== 'month' && (
        <section className="week-strip">
          <div className="strip-head">
            <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous week">
              <IconChevronLeft size={22} />
            </button>
            <button className="strip-title" onClick={() => setSelected(today)} aria-label="Go to today">
              <span>{monthName(selected)}</span>
              {selected !== today && <small>Today</small>}
            </button>
            <button className="icon-btn" onClick={() => step(1)} aria-label="Next week">
              <IconChevronRight size={22} />
            </button>
          </div>
          {mode === 'day' && (
            <div className="strip-days">
              {weekDays.map((d, i) => {
                const n = (weekMap.get(d)?.length ?? 0) + (eventsByDate.get(d)?.length ?? 0)
                return (
                  <button key={d} className={'strip-day' + (d === selected ? ' selected' : '') + (d === today ? ' today' : '')} onClick={() => setSelected(d)} aria-label={parseDateStr(d).toDateString()}>
                    <span className="sd-letter">{LETTERS[i]}</span>
                    <span className="sd-num">{parseDateStr(d).getDate()}</span>
                    <i className={'sd-dot' + (n ? ' on' : '')} />
                  </button>
                )
              })}
            </div>
          )}
        </section>
      )}

      {google.apiDisabled && <p className="notice">Google Calendar is connected, but the Calendar API is not switched on in Google Cloud yet.</p>}
      {google.reconnect.length > 0 && (
        <button className="notice" onClick={() => navigate('/profile')}>
          Google Calendar needs to be reconnected. Tap here to open Profile.
        </button>
      )}
      {note && <p className="notice">{note}</p>}

      {mode === 'day' && <DayView key="day" label={dayLabel} isToday={selected === today} items={dayItems} onMove={onMove} onAdd={() => openEditor({ date: selected })} onCreate={(startMin, endMin) => openEditor(startMin == null ? { date: selected } : { date: selected, start: fmtMin(startMin), end: fmtMin(Math.min(1439, endMin)) })} />}
      {mode === 'week' && <WeekView key="week" days={weekDays} today={today} selected={selected} itemsByDay={itemsByDay} onPickDay={pickDay} />}

      {mode === 'month' && (
        <section className="card calendar">
          <div className="cal-head">
            <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <IconChevronLeft size={22} />
            </button>
            <h3>{monthName(selected)}</h3>
            <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
              <IconChevronRight size={22} />
            </button>
          </div>
          <div className="cal-grid cal-weekdays">
            {WEEKDAYS_MON_FIRST.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="cal-grid">
            {cells.map((c, i) =>
              c === null ? (
                <span key={i} />
              ) : (
                <button key={c} className={'cal-day' + (c === selected ? ' selected' : '') + (c === today ? ' today' : '')} onClick={() => pickDay(c)} aria-label={parseDateStr(c).toDateString()}>
                  <span className="cal-num">{parseDateStr(c).getDate()}</span>
                  <span className="dots">
                    {(monthMap.get(c) ?? []).slice(0, 3).map((t) => (
                      <i key={t.id} className={`dot c-${t.color}` + (t.completed ? ' faded' : '')} />
                    ))}
                    {(eventsByDate.get(c) ?? []).slice(0, Math.max(0, 3 - (monthMap.get(c)?.length ?? 0))).map((e) => (
                      <i key={e.id} className="dot c-sky ring" />
                    ))}
                  </span>
                </button>
              ),
            )}
          </div>
          {!googleConnected && (
            <button className="soft-link" onClick={() => navigate('/profile')}>
              Connect Google Calendar to see your events here
            </button>
          )}
          <p className="muted small">Tap a day to open it.</p>
        </section>
      )}
    </div>
  )
}
