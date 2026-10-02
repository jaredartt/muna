import { useEffect, useState, type CSSProperties } from 'react'
import { IconCalendarFilled } from '@tabler/icons-react'
import { IconCheck, IconPlus } from '@tabler/icons-react'
import Muna from '../components/Muna'
import Ring from '../components/Ring'
import WeekChart from '../components/WeekChart'
import { TaskIcon } from '../lib/icons'
import { eventStyleKey, isEventDone, toggleEventDone, useEventDone, useEventStyles } from '../lib/eventStyles'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { useGoogleEvents } from '../hooks/useGoogleEvents'
import { eventDays, eventSortKey, eventTimeLabel } from '../lib/google'
import { toDateStr, todayStr } from '../lib/dates'
import { navigate } from '../lib/router'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Morning'
  if (h < 18) return 'Afternoon'
  return 'Evening'
}

/** Monday..Sunday date strings of the current week. */
function currentWeek(): string[] {
  const now = new Date()
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => toDateStr(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)))
}

// The intro (cards fading in one after another) plays once per app start. Until the tasks and Google events have arrived the
// cards stay invisible, so nobody sees them jump in height while the data loads.
let introPlayed = false

export default function Home() {
  const { profile, googleReady } = useAuth()
  const eventStyles = useEventStyles()
  const eventDone = useEventDone()
  const { tasks, loading, toggleTask, openEditor, openEvent, occurrencesOn } = useTasksCtx()
  const today = todayStr()
  const [playing] = useState(() => !introPlayed) // decided once when the page opens, so the animation is never cut short
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 2500) // never wait forever on a slow network
    return () => clearTimeout(t)
  }, [])

  // Today's Google Calendar events sit next to the tasks
  const dayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
  const dayEnd = new Date(dayStart.getTime() + 86400000)
  const google = useGoogleEvents(dayStart, dayEnd)
  const todaysEvents = google.events
    .filter((e) => eventDays(e).includes(today))
    .sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)))

  const ready = !playing || timedOut || (!loading && googleReady && google.loaded)
  useEffect(() => {
    if (ready) introPlayed = true
  }, [ready])
  const reveal = (n: number) => ({
    className: !playing ? '' : ready ? ' reveal in' : ' reveal pre',
    style: { '--d': `${n * 130}ms` } as CSSProperties,
  })
  const r0 = reveal(0), r1 = reveal(1), r2 = reveal(2), r3 = reveal(3), r4 = reveal(4)

  const todays = occurrencesOn(today).sort((a, b) => Number(a.completed) - Number(b.completed) || (a.start_time ?? '99').localeCompare(b.start_time ?? '99'))
  const doneToday = todays.filter((t) => t.completed).length
  const todayPct = todays.length ? Math.round((doneToday / todays.length) * 100) : 0

  const week = currentWeek()
  const weekCounts = week.map((d) => occurrencesOn(d).length)
  const weekTotal = weekCounts.reduce((a, b) => a + b, 0)

  const once = tasks.filter((t) => !t.repeat) // the 'All tasks' ring counts one-time tasks only
  const open = once.filter((t) => !t.completed)
  const overdue = open.filter((t) => t.due_date && t.due_date < today).length
  const allPct = once.length ? Math.round(((once.length - open.length) / once.length) * 100) : 0

  const name = profile?.display_name?.split(' ')[0] || 'friend'
  const remaining = todays.length - doneToday
  const message =
    todays.length === 0
      ? 'Nothing planned today. Tell me if you want to add something!'
      : remaining === 0
        ? 'Everything is done for today. Proud of you!'
        : `You have ${remaining === 1 ? 'a task' : 'some tasks'} today, you got this!`

  const shown = todays.slice(0, 4)
  const shownEvents = todaysEvents.slice(0, Math.max(0, 4 - shown.length))
  const hiddenCount = todays.length - shown.length + (todaysEvents.length - shownEvents.length)

  return (
    <div className="page home">
      <button className={"hero" + r0.className} style={r0.style} onClick={() => navigate('/chat')} aria-label="Chat with Muna">
        <Muna size={94} />
        <p className="hero-text">
          {greeting()}, {name}! {message}
        </p>
      </button>

      <div className="masonry">
        <div className="col">
          <section className={"card tasks-card" + r1.className} style={r1.style}>
            <div className="card-head">
              <h3>Today&rsquo;s tasks</h3>
              <button className="plain-icon purple" onClick={() => navigate('/calendar')} aria-label="Open calendar">
                <IconCalendarFilled size={24} />
              </button>
            </div>
            <div className="mini-list">
              {loading && <p className="muted small">Loading…</p>}
              {!loading && todays.length === 0 && todaysEvents.length === 0 && <p className="muted small">Nothing yet.</p>}
              {shown.map((t) => (
                <div key={t.id} className={'mini-task' + (t.completed ? ' done' : '')}>
                  <button className={`tile c-${t.color}`} onClick={() => toggleTask(t)} aria-label={t.completed ? 'Mark as not done' : 'Mark as done'}>
                    {t.completed ? <IconCheck size={18} stroke={2.6} /> : <TaskIcon name={t.icon} size={18} />}
                  </button>
                  <button className="mini-title" onClick={() => openEditor(t)}>
                    {t.title}
                  </button>
                </div>
              ))}
              {shownEvents.map((e) => {
                const st = eventStyles[eventStyleKey(e)]
                const isDone = isEventDone(eventDone, e)
                return (
                  <div key={e.id} className={'mini-task' + (isDone ? ' done' : '')}>
                    <button className={`tile c-${st?.color ?? 'sky'}`} onClick={() => void toggleEventDone(e)} aria-label={isDone ? 'Mark as not done' : 'Mark as done'}>
                      {isDone ? <IconCheck size={18} stroke={2.6} /> : <TaskIcon name={st?.icon || 'IconCalendarEventFilled'} size={18} />}
                    </button>
                    <button className="mini-title" onClick={() => openEvent(e)}>
                      {e.title}
                      <small className="muted"> {eventTimeLabel(e)}</small>
                    </button>
                  </div>
                )
              })}
              {hiddenCount > 0 && (
                <button className="more" onClick={() => navigate('/calendar')} aria-label="See all tasks">
                  &hellip;
                </button>
              )}
            </div>
            <button className="add-pill" onClick={() => openEditor({ date: today })}>
              <IconPlus size={16} stroke={2.4} /> Add task
            </button>
          </section>

          <section className={"card ring-card" + r3.className} style={r3.style}>
            <div className="card-head">
              <h3>Today</h3>
            </div>
            <Ring pct={todayPct} color="var(--yellow)" value={`${todayPct}%`} label="done" />
          </section>
        </div>

        <div className="col">
          <section className={"card week-card" + r2.className} style={r2.style}>
            <div className="card-head">
              <h3>This week</h3>
            </div>
            <WeekChart counts={weekCounts} />
            <div className="week-days" aria-hidden="true">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <span key={i} className={week[i] === today ? 'now' : ''}>
                  {d}
                </span>
              ))}
            </div>
            <p className="big-num">
              <strong style={{ color: 'var(--orange)' }}>{weekTotal}</strong> <span>tasks</span>
            </p>
          </section>

          <section className={"card ring-card" + r4.className} style={r4.style}>
            <div className="card-head">
              <h3>All tasks</h3>
            </div>
            <Ring pct={allPct} color="var(--blue)" value={`${allPct}%`} label={overdue ? `${overdue} overdue` : 'done'} />
          </section>
        </div>
      </div>
    </div>
  )
}
