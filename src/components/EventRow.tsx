import { IconCalendarEventFilled } from '@tabler/icons-react'
import { eventTimeLabel, type GoogleEvent } from '../lib/google'
import { useAuth } from '../context/AuthContext'

// A read-only Google Calendar event shown next to Muna tasks.
export default function EventRow({ event }: { event: GoogleEvent }) {
  const { session, members } = useAuth()
  const owner = members.find((m) => m.id === event.owner_id)
  const who = event.owner_id === session?.user.id ? 'You' : owner?.display_name || event.owner_name || 'Partner'
  return (
    <div className="task-row event-row">
      <span className={`task-icon c-${owner?.avatar_color ?? 'sky'}`}>
        <IconCalendarEventFilled size={20} />
      </span>
      <div className="task-main">
        <span className="task-title">{event.title}</span>
        <span className="task-meta">
          {eventTimeLabel(event)} · {who} · Google Calendar
        </span>
      </div>
    </div>
  )
}
