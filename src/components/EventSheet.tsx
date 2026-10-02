import { useState } from 'react'
import { IconExternalLink, IconTrashFilled, IconX } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { addDays, pad, toDateStr } from '../lib/dates'
import { deleteGoogleEvent, updateGoogleEvent, type GoogleEvent } from '../lib/google'

const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

type Props = { event: GoogleEvent; onDone: () => void; onClose: () => void }

// Edit or delete a Google Calendar event (yours or your partner's) without leaving Muna.
export default function EventSheet({ event, onDone, onClose }: Props) {
  const { session, members } = useAuth()
  const owner = members.find((m) => m.id === event.owner_id)
  const who = event.owner_id === session?.user.id ? 'your' : `${owner?.display_name || event.owner_name || 'your partner'}'s`

  const [title, setTitle] = useState(event.title === '(no title)' ? '' : event.title)
  const [allDay, setAllDay] = useState(event.all_day)
  const [date, setDate] = useState(event.all_day ? event.start : toDateStr(new Date(event.start)))
  const [endDate, setEndDate] = useState(event.all_day ? addDays(event.end, -1) : toDateStr(new Date(new Date(event.end).getTime() - 1)))
  const [start, setStart] = useState(event.all_day ? '09:00' : hm(new Date(event.start)))
  const [end, setEnd] = useState(event.all_day ? '10:00' : hm(new Date(event.end)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  function changeDate(v: string) {
    // keep the length of the event when the day moves
    if (v && date && endDate >= date) {
      const span = Math.round((Date.parse(endDate) - Date.parse(date)) / 86400000)
      setEndDate(addDays(v, span))
    }
    setDate(v)
  }

  async function save() {
    if (!title.trim() || !date || busy) return
    setBusy(true)
    setError('')
    const r = await updateGoogleEvent(event, {
      title: title.trim(),
      all_day: allDay,
      date,
      end_date: endDate < date ? date : endDate,
      start_time: start,
      end_time: end,
    })
    setBusy(false)
    if (!r.ok) return setError(r.message ?? 'Could not save.')
    onDone()
  }

  async function remove() {
    if (busy) return
    setBusy(true)
    setError('')
    const r = await deleteGoogleEvent(event)
    setBusy(false)
    if (!r.ok) return setError(r.message ?? 'Could not delete.')
    onDone()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Edit calendar event">
        <div className="sheet-head">
          <h2>Edit event</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={22} />
          </button>
        </div>
        <p className="muted small">This event is in {who} Google Calendar.{event.recurring ? ' It repeats, so changes here only affect this one day.' : ''}</p>

        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="Event title" />
        </label>

        <label className="check-row">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span>All day</span>
        </label>

        <div className="row-2">
          <label className="field">
            <span>{allDay ? 'First day' : 'Date'}</span>
            <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
          </label>
          {allDay ? (
            <label className="field">
              <span>Last day</span>
              <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          ) : (
            <span />
          )}
        </div>

        {!allDay && (
          <div className="row-2">
            <label className="field">
              <span>Starts</span>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="field">
              <span>Ends</span>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
        )}

        {event.link && (
          <a className="soft-link" href={event.link} target="_blank" rel="noreferrer">
            <IconExternalLink size={16} /> Open in Google Calendar
          </a>
        )}
        {error && <p className="notice">{error}</p>}

        <div className="sheet-actions">
          {confirmDelete ? (
            <button className="btn danger" onClick={remove} disabled={busy}>
              <IconTrashFilled size={18} /> Really delete?
            </button>
          ) : (
            <button className="btn danger" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <IconTrashFilled size={18} /> Delete
            </button>
          )}
          <button className="btn primary grow" onClick={save} disabled={!title.trim() || busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
