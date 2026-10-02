import { IconCalendarEventFilled } from '@tabler/icons-react'
import { eventTimeLabel, type GoogleEvent } from '../lib/google'
import { useAuth } from '../context/AuthContext'

// A Google Calendar event shown next to Muna tasks. Tap it to edit (works for both people's events).
export default function EventRow({ event, onOpen }: { event: GoogleEvent; onOpen?: (e: GoogleEvent) => void }) {
  const { session, members } = useAuth()
  const owner = members.find((m) => m.id === event.owner_id)
  const who = event.owner_id === session?.user.id ? 'You' : owner?.display_name || event.owner_name || 'Partner'
  return (
    <div className="task-row event-row">
      <span className={`task-icon c-${owner?.avatar_color ?? 'sky'}`}>
        <IconCalendarEventFilled size={20} />
      </span>
      <button className="task-main task-open" onClick={() => onOpen?.(event)} aria-label={`Edit ${event.title}`}>
        <span className="task-title">{event.title}</span>
        <span className="task-meta">
          {eventTimeLabel(event)} · {who} · Google Calendar
        </span>
      </button>
    </div>
  )
}
