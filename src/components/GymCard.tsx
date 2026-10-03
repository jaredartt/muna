import { IconBarbell, IconCheck, IconPlus } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { useTasksCtx } from '../context/TasksContext'
import { TaskIcon } from '../lib/icons'
import { dayWord } from './HobbiesCard'
import { navigate } from '../lib/router'
import { todayStr } from '../lib/dates'
import { goalText } from '../lib/gymLogic'
import { upcomingSessions, useGymExercises, useGymSessions, useGymSplits } from '../lib/gym'

type Anim = { className: string; style: React.CSSProperties }

/** Home: which training day is next, when, and the goal of each exercise (one more rep than last time). */
export default function GymCard({ anim }: { anim: Anim }) {
  const { session } = useAuth()
  const { tasks } = useTasksCtx()
  const uid = session?.user.id ?? ''
  useGymSessions()
  const splits = useGymSplits().filter((s) => s.created_by === uid)
  const exercises = useGymExercises().filter((e) => e.created_by === uid)
  const today = todayStr()
  const next = upcomingSessions(uid, tasks, today)[0]
  const goals = next ? exercises.filter((e) => e.split_id === next.split.id).sort((a, b) => a.position - b.position) : []

  return (
    <section className={'card gym-home' + anim.className} style={anim.style}>
      <button className="card-head hobby-head" onClick={() => navigate('/gym')} aria-label="Open Gym">
        <h3>Gym</h3>
        <span className="plain-icon green">
          <IconBarbell size={24} />
        </span>
      </button>
      <div className="mini-list">
        {splits.length === 0 && <p className="muted small">Add your split (push, pull, legs…) and track every rep.</p>}
        {splits.length > 0 && !next && <p className="muted small">Nothing planned yet. Tap Gym to let Muna plan your week.</p>}
        {next && (
          <button className="gym-home-next" onClick={() => navigate('/gym')}>
            <span className="gym-ico big">
              <TaskIcon name={next.split.icon} size={26} />
            </span>
            <span className="gym-home-title">
              <strong>{next.split.name}</strong>
              <span className="muted small">
                {dayWord(next.session.day, today)}
                {next.task?.start_time ? ` · ${next.task.start_time.slice(0, 5)}` : ''}
              </span>
            </span>
            {goals.length > 0 && (
              <span className="gym-home-goals">
                <span className="muted small">Goal to beat</span>
                {goals.slice(0, 3).map((e) => (
                  <span key={e.id} className="gym-home-goal small">
                    {e.name} <b>{goalText(e)}</b>
                  </span>
                ))}
                {goals.length > 3 && <span className="muted small">+{goals.length - 3} more</span>}
              </span>
            )}
          </button>
        )}
      </div>
      <button className="add-pill" onClick={() => navigate('/gym')}>
        {splits.length ? (
          <>
            <IconCheck size={16} stroke={2.4} /> Open gym
          </>
        ) : (
          <>
            <IconPlus size={16} stroke={2.4} /> Set up gym
          </>
        )}
      </button>
    </section>
  )
}
