import { IconCheck, IconRepeat } from '@tabler/icons-react'
import { TaskIcon } from '../lib/icons'
import { formatDateNice, formatTime } from '../lib/dates'
import type { Occurrence, Task } from '../lib/types'

type Props = {
  task: Task | Occurrence
  onToggle: (t: Task) => void
  onOpen: (t: Task) => void
  showDate?: boolean
}

export default function TaskRow({ task, onToggle, onOpen, showDate }: Props) {
  const time = task.start_time ? formatTime(task.start_time) + (task.end_time ? '–' + formatTime(task.end_time) : '') : ''
  const repeating = Boolean((task as Occurrence).series)
  const meta = [showDate && task.due_date ? formatDateNice(task.due_date) : '', time].filter(Boolean).join(' · ')
  return (
    <div className={'task-row' + (task.completed ? ' done' : '')}>
      <button className={`task-icon c-${task.color}`} onClick={() => onOpen(task)} aria-label={`Edit ${task.title}`}>
        <TaskIcon name={task.icon} />
      </button>
      <button className="task-main" onClick={() => onOpen(task)}>
        <span className="task-title">{task.title}</span>
        {(meta || repeating) && (
          <span className="task-meta">
            {repeating && <IconRepeat size={13} className="repeat-ic" />}
            {meta}
          </span>
        )}
      </button>
      <button
        className={'check' + (task.completed ? ' checked' : '')}
        onClick={() => onToggle(task)}
        aria-label={task.completed ? 'Mark as not done' : 'Mark as done'}
        aria-pressed={task.completed}
      >
        {task.completed && <IconCheck size={16} stroke={3} />}
      </button>
    </div>
  )
}
