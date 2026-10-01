import { useMemo, useState } from 'react'
import { IconChevronLeft, IconChevronRight, IconPlus } from '@tabler/icons-react'
import TaskRow from '../components/TaskRow'
import EventRow from '../components/EventRow'
import { useTasksCtx } from '../context/TasksContext'
import { useGoogleEvents } from '../hooks/useGoogleEvents'
import { eventDays, eventSortKey, type GoogleEvent } from '../lib/google'
import { WEEKDAYS_MON_FIRST, formatDateNice, monthGrid, parseDateStr, todayStr } from '../lib/dates'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../lib/router'
import type { Task } from '../lib/types'

export default function CalendarPage() {
  const { tasks, toggleTask, openEditor } = useTasksCtx()
  const { googleConnected } = useAuth()
  const today = todayStr()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [selected, setSelected] = useState(today)

  const cells = monthGrid(cursor.y, cursor.m)
  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  // Google events for everything visible in the month grid
  const rangeFrom = useMemo(() => new Date(cursor.y, cursor.m, 1), [cursor.y, cursor.m])
  const rangeTo = useMemo(() => new Date(cursor.y, cursor.m + 1, 1), [cursor.y, cursor.m])
  const google = useGoogleEvents(rangeFrom, rangeTo)

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.due_date) continue
      const arr = map.get(t.due_date) ?? []
      arr.push(t)
      map.set(t.due_date, arr)
    }
    return map
  }, [tasks])

  const eventsByDate = useMemo(() => {
    const map = new Map<string, GoogleEvent[]>()
    for (const ev of google.events) {
      for (const d of eventDays(ev)) {
        const arr = map.get(d) ?? []
        arr.push(ev)
        map.set(d, arr)
      }
    }
    return map
  }, [google.events])

  const dayTasks = (byDate.get(selected) ?? []).slice().sort((a, b) => (a.start_time ?? '99').localeCompare(b.start_time ?? '99'))
  const dayEvents = (eventsByDate.get(selected) ?? []).slice().sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)))

  function shift(delta: number) {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>Calendar</h1>
      </header>

      <section className="card calendar">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
            <IconChevronLeft size={22} />
          </button>
          <h3>{monthLabel}</h3>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
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
              <button
                key={c}
                className={'cal-day' + (c === selected ? ' selected' : '') + (c === today ? ' today' : '')}
                onClick={() => setSelected(c)}
                aria-label={parseDateStr(c).toDateString()}
              >
                <span className="cal-num">{parseDateStr(c).getDate()}</span>
                <span className="dots">
                  {(byDate.get(c) ?? []).slice(0, 3).map((t) => (
                    <i key={t.id} className={`dot c-${t.color}` + (t.completed ? ' faded' : '')} />
                  ))}
                  {(eventsByDate.get(c) ?? []).slice(0, Math.max(0, 3 - (byDate.get(c)?.length ?? 0))).map((e) => (
                    <i key={e.id} className="dot c-sky ring" />
                  ))}
                </span>
              </button>
            ),
          )}
        </div>
      </section>

      {google.apiDisabled && <p className="notice">Google Calendar is connected, but the Calendar API is not switched on in Google Cloud yet.</p>}
      {google.reconnect.length > 0 && (
        <button className="notice" onClick={() => navigate('/profile')}>
          Google Calendar needs to be reconnected. Tap here to open Profile.
        </button>
      )}

      <section>
        <div className="section-row">
          <h3 className="section-title">{formatDateNice(selected)}</h3>
          <button className="btn soft" onClick={() => openEditor({ date: selected })}>
            <IconPlus size={18} /> Add
          </button>
        </div>
        <div className="stack">
          {dayTasks.length === 0 && dayEvents.length === 0 && <p className="empty">Nothing planned. A free day!</p>}
          {dayEvents.filter((e) => e.all_day).map((e) => (
            <EventRow key={e.id + selected} event={e} />
          ))}
          {dayTasks.map((t) => (
            <TaskRow key={t.id} task={t} onToggle={toggleTask} onOpen={openEditor} />
          ))}
          {dayEvents.filter((e) => !e.all_day).map((e) => (
            <EventRow key={e.id + selected} event={e} />
          ))}
          {!googleConnected && dayTasks.length === 0 && (
            <button className="soft-link" onClick={() => navigate('/profile')}>
              Connect Google Calendar to see your events here
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
