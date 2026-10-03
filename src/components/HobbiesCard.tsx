import { IconCheck, IconPaletteFilled, IconPlus } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { TaskIcon } from '../lib/icons'
import { addDays, parseDateStr, todayStr } from '../lib/dates'
import { navigate } from '../lib/router'
import { useHobbies, useHobbySessions } from '../lib/hobbies'

type Anim = { className: string; style: React.CSSProperties }

export const dayWord = (date: string, today: string) => {
  if (date === today) return 'Today'
  if (date === addDays(today, 1)) return 'Tomorrow'
  return parseDateStr(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Home: the hobby times coming up (planned by Muna from your free time). */
export default function HobbiesCard({ anim }: { anim: Anim }) {
  const { session } = useAuth()
  const { tasks, toggleTask, openEditor } = useTasksCtx()
  const uid = session?.user.id ?? ''
  const hobbies = useHobbies().filter((h) => h.created_by === uid && h.active)
  const sessions = useHobbySessions()
  const today = todayStr()
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const upcoming = sessions
    .filter((s) => hobbies.some((h) => h.id === s.hobby_id) && s.task_id)
    .map((s) => ({ s, h: hobbies.find((h) => h.id === s.hobby_id)!, t: byId.get(s.task_id!) }))
    .filter((x) => x.t && !x.t.completed && (x.t.due_date ?? '') >= today)
    .sort((a, b) => (a.t!.due_date ?? '').localeCompare(b.t!.due_date ?? '') || (a.t!.start_time ?? '').localeCompare(b.t!.start_time ?? ''))
  const shown = upcoming.slice(0, 3)

  return (
    <section className={'card hobby-card' + anim.className} style={anim.style}>
      <button className="card-head hobby-head" onClick={() => navigate('/hobbies')} aria-label="Open Hobbies">
        <h3>Hobbies</h3>
        <span className="plain-icon coral">
          <IconPaletteFilled size={24} />
        </span>
      </button>
      <div className="mini-list">
        {hobbies.length === 0 && <p className="muted small">Add the things you love doing and Muna finds time for them each week.</p>}
        {hobbies.length > 0 && shown.length === 0 && <p className="muted small">Nothing planned yet. Muna plans next week every Saturday.</p>}
        {shown.map(({ s, h, t }) => (
          <div key={s.id} className="mini-task">
            <button className={`tile c-${h.color}`} onClick={() => void toggleTask(t!)} aria-label={`Mark ${h.name} as done`}>
              <TaskIcon name={h.icon} size={18} />
            </button>
            <button className="mini-title" onClick={() => openEditor(t!)}>
              {h.name}
              <small className="muted">
                {' '}
                {dayWord(t!.due_date ?? today, today)} {t!.start_time?.slice(0, 5)}
              </small>
            </button>
          </div>
        ))}
        {upcoming.length > shown.length && (
          <button className="more" onClick={() => navigate('/hobbies')} aria-label="See all hobby times">
            &hellip;
          </button>
        )}
      </div>
      <button className="add-pill" onClick={() => navigate('/hobbies')}>
        {hobbies.length ? (
          <>
            <IconCheck size={16} stroke={2.4} /> My hobbies
          </>
        ) : (
          <>
            <IconPlus size={16} stroke={2.4} /> Add a hobby
          </>
        )}
      </button>
    </section>
  )
}
