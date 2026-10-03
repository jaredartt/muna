import { useEffect, useState, type CSSProperties } from 'react'
import { IconCalendarFilled } from '@tabler/icons-react'
import { IconCheck, IconPlus } from '@tabler/icons-react'
import Muna from '../components/Muna'
import { CaloriesCard, SleepCard, UniCard } from '../components/HomeRings'
import HobbiesCard from '../components/HobbiesCard'
import WeatherCard, { type Plan } from '../components/WeatherCard'
import { TaskIcon } from '../lib/icons'
import { eventStyleKey, isEventDone, toggleEventDone, useEventDone, useEventStyles } from '../lib/eventStyles'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { useGoogleEvents } from '../hooks/useGoogleEvents'
import { eventDays, eventSortKey, eventTimeLabel } from '../lib/google'
import { addDays, todayStr } from '../lib/dates'
import { navigate } from '../lib/router'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Morning'
  if (h < 18) return 'Afternoon'
  return 'Evening'
}

// The intro (cards fading in one after another) plays once per app start. Until the tasks and Google events have arrived the
// cards stay invisible, so nobody sees them jump in height while the data loads.
let introPlayed = false

export default function Home() {
  const { profile, googleReady } = useAuth()
  const eventStyles = useEventStyles()
  const eventDone = useEventDone()
  const { loading, toggleTask, openEditor, openEvent, occurrencesOn } = useTasksCtx()
  const today = todayStr()
  const [playing] = useState(() => !introPlayed) // decided once when the page opens, so the animation is never cut short
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 1200) // never wait forever on a slow network
    return () => clearTimeout(t)
  }, [])

  // Today's Google Calendar events sit next to the tasks
  const dayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())
  const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 8) // a week ahead: the weather card looks at outdoor plans
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
    style: { '--d': `${n * 110}ms` } as CSSProperties,
  })
  const r0 = reveal(0), r1 = reveal(1), r2 = reveal(2), r3 = reveal(3), r4 = reveal(4), r5 = reveal(5), r6 = reveal(6)

  const todays = occurrencesOn(today).sort((a, b) => Number(a.completed) - Number(b.completed) || (a.start_time ?? '99').localeCompare(b.start_time ?? '99'))
  const doneToday = todays.filter((t) => t.completed).length


  const name = profile?.display_name?.split(' ')[0] || 'friend'
  const remaining = todays.length - doneToday
  const message =
    todays.length === 0
      ? 'Nothing planned today. Tell me if you want to add something!'
      : remaining === 0
        ? 'Everything is done for today. Proud of you!'
        : `You have ${remaining === 1 ? 'a task' : 'some tasks'} today, you got this!`

  // Everything planned in the next 7 days (tasks and Google events), for the weather warnings
  const plans: Plan[] = []
  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i)
    for (const t of occurrencesOn(d)) if (!t.completed) plans.push({ title: t.title, date: d, text: `${t.title} ${t.notes ?? ''}` })
    for (const e of google.events) if (eventDays(e).includes(d)) plans.push({ title: e.title, date: d, text: `${e.title} ${e.notes ?? ''}` })
  }

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
          <SleepCard anim={r3} />
          <HobbiesCard anim={r4} />
        </div>
        <div className="col">
          <UniCard anim={r2} />
          <section className={'card wx-card wx-half' + r5.className} style={r5.style}>
            <WeatherCard plans={plans} />
          </section>
          <CaloriesCard anim={r6} />
        </div>
      </div>
    </div>
  )
}
