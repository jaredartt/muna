import { AppIcon } from '../lib/icons'
import { IconCheck } from '@tabler/icons-react'
import { eventStyleKey, isEventDone, toggleEventDone, useEventDone, useEventStyles } from '../lib/eventStyles'
import { eventTimeLabel, type GoogleEvent } from '../lib/google'
import { useAuth } from '../context/AuthContext'

// A Google Calendar event shown next to Muna tasks. Tap it to edit (works for both people's events).
export default function EventRow({ event, onOpen }: { event: GoogleEvent; onOpen?: (e: GoogleEvent) => void }) {
  const { session, members } = useAuth()
  const style = useEventStyles()[eventStyleKey(event)]
  const isDone = isEventDone(useEventDone(), event)
  const owner = members.find((m) => m.id === event.owner_id)
  const who = event.owner_id === session?.user.id ? 'You' : owner?.display_name || event.owner_name || 'Partner'
  return (
    <div className={'task-row event-row' + (isDone ? ' done' : '')}>
      <button className={`task-icon c-${style?.color ?? owner?.avatar_color ?? 'sky'}`} onClick={() => onOpen?.(event)} aria-label={`Edit ${event.title}`}>
        <AppIcon name={style?.icon || 'IconCalendarEventFilled'} size={20} />
      </button>
      <button className="task-main task-open" onClick={() => onOpen?.(event)} aria-label={`Edit ${event.title}`}>
        <span className="task-title">{event.title}</span>
        <span className="task-meta">
          {eventTimeLabel(event)} · {who} · Google Calendar
        </span>
      </button>
      <button
        className={'check' + (isDone ? ' checked' : '')}
        onClick={() => void toggleEventDone(event)}
        aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
        aria-pressed={isDone}
      >
        {isDone && <IconCheck size={16} stroke={3} />}
      </button>
    </div>
  )
}
