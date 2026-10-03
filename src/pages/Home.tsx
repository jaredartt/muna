import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { IconCalendarFilled } from '@tabler/icons-react'
import { IconCheck, IconPlus } from '@tabler/icons-react'
import Muna from '../components/Muna'
import { CaloriesCard, SleepCard, UniCard } from '../components/HomeRings'
import HobbiesCard from '../components/HobbiesCard'
import GymCard from '../components/GymCard'
import { useReorder } from '../hooks/useReorder'
import { normalizeLayout, readLocalLayout, writeLocalLayout, type BlockId } from '../lib/homeLayout'
import { supabase } from '../lib/supabase'
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
  const r0 = reveal(0), r1 = reveal(1), r2 = reveal(2), r3 = reveal(3), r4 = reveal(4), r5 = reveal(5), r6 = reveal(6), r7 = reveal(7)

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

  // blocks can be dragged (press and hold) to another place; the layout is saved on your profile
  const [layout, setLayout] = useState<BlockId[][]>(() => normalizeLayout(profile?.home_layout ?? readLocalLayout()))
  const savedKey = JSON.stringify(profile?.home_layout ?? null)
  useEffect(() => {
    if (profile?.home_layout) setLayout(normalizeLayout(profile.home_layout))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey])
  const rd = useReorder({
    columns: layout,
    onChange: (next) => {
      const l = normalizeLayout(next)
      setLayout(l)
      writeLocalLayout(l)
      if (profile) void supabase.from('profiles').update({ home_layout: l }).eq('id', profile.id)
    },
  })

  const blocks: Record<BlockId, ReactNode> = {
    tasks: (
            <section
              className={"card tasks-card" + r1.className}
              style={r1.style}
              onClick={(ev) => {
                // the empty parts of the block open the calendar; a task, the add button etc. keep doing their own thing
                if (!(ev.target as HTMLElement).closest('button')) navigate('/calendar')
              }}
            >
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
    ),
    sleep: <SleepCard anim={r3} />,
    hobbies: <HobbiesCard anim={r4} />,
    uni: <UniCard anim={r2} />,
    gym: <GymCard anim={r5} />,
    calories: <CaloriesCard anim={r6} />,
    weather: (
      <section
        className={'card wx-card wx-link ' + (layout[2].includes('weather') ? 'wx-wide' : 'wx-half') + r7.className}
        style={r7.style}
        onClick={() => navigate('/weather')}
        role="link"
        tabIndex={0}
        aria-label="Open the weather"
        onKeyDown={(e) => {
          if (e.key === 'Enter') navigate('/weather')
        }}
      >
        <WeatherCard plans={plans} />
      </section>
    ),
  }

  return (
    <div className="page home">
      <button className={"hero" + r0.className} style={r0.style} onClick={() => navigate('/chat')} aria-label="Chat with Muna">
        <Muna size={94} />
        <p className="hero-text">
          {greeting()}, {name}! {message}
        </p>
      </button>

      <div className={'masonry' + (rd.dragging ? ' dragging' : '')}>
        {layout.map((col, ci) => (
          <div key={ci} className="col" ref={rd.column(ci)}>
            {col.map((id) => (
              <div key={id} {...rd.item(id)}>
                {blocks[id]}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className={'col wide-zone' + (rd.dragging ? ' dragging' : '')} ref={rd.column(2)}>
        {layout[2].map((id) => (
          <div key={id} {...rd.item(id)}>
            {blocks[id]}
          </div>
        ))}
      </div>
    </div>
  )
}
