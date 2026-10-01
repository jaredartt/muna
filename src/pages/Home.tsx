import { IconCalendar, IconCheck, IconPlus } from '@tabler/icons-react'
import Muna from '../components/Muna'
import Ring from '../components/Ring'
import WeekChart from '../components/WeekChart'
import { TaskIcon } from '../lib/icons'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
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

export default function Home() {
  const { profile } = useAuth()
  const { tasks, loading, toggleTask, openEditor } = useTasksCtx()
  const today = todayStr()

  const todays = tasks.filter((t) => t.due_date === today).sort((a, b) => Number(a.completed) - Number(b.completed) || (a.start_time ?? '99').localeCompare(b.start_time ?? '99'))
  const doneToday = todays.filter((t) => t.completed).length
  const todayPct = todays.length ? Math.round((doneToday / todays.length) * 100) : 0

  const week = currentWeek()
  const weekCounts = week.map((d) => tasks.filter((t) => t.due_date === d).length)
  const weekTotal = weekCounts.reduce((a, b) => a + b, 0)

  const open = tasks.filter((t) => !t.completed)
  const overdue = open.filter((t) => t.due_date && t.due_date < today).length
  const allPct = tasks.length ? Math.round(((tasks.length - open.length) / tasks.length) * 100) : 0

  const name = profile?.display_name?.split(' ')[0] || 'friend'
  const remaining = todays.length - doneToday
  const message =
    todays.length === 0
      ? 'Nothing planned today. Tell me if you want to add something!'
      : remaining === 0
        ? 'Everything is done for today. Proud of you!'
        : `You have ${remaining === 1 ? 'a task' : 'some tasks'} today, you got this!`

  const shown = todays.slice(0, 4)

  return (
    <div className="page home">
      <button className="hero" onClick={() => navigate('/chat')} aria-label="Chat with Muna">
        <Muna size={94} />
        <p className="hero-text">
          {greeting()}, {name}! {message}
        </p>
      </button>

      <div className="masonry">
        <div className="col">
          <section className="card tasks-card">
            <div className="card-head">
              <h3>Today&rsquo;s tasks</h3>
              <button className="plain-icon purple" onClick={() => navigate('/calendar')} aria-label="Open calendar">
                <IconCalendar size={24} stroke={1.8} />
              </button>
            </div>
            <div className="mini-list">
              {loading && <p className="muted small">Loading…</p>}
              {!loading && todays.length === 0 && <p className="muted small">Nothing yet.</p>}
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
              {todays.length > shown.length && (
                <button className="more" onClick={() => navigate('/calendar')} aria-label="See all tasks">
                  &hellip;
                </button>
              )}
            </div>
            <button className="add-pill" onClick={() => openEditor({ date: today })}>
              <IconPlus size={16} stroke={2.4} /> Add task
            </button>
          </section>

          <section className="card ring-card">
            <div className="card-head">
              <h3>Today</h3>
            </div>
            <Ring pct={todayPct} color="var(--yellow)" value={`${todayPct}%`} label="done" />
          </section>
        </div>

        <div className="col">
          <section className="card week-card">
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

          <section className="card ring-card">
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
