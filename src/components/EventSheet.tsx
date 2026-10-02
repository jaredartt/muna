import { useState } from 'react'
import { IconExternalLink, IconTrashFilled, IconX } from '@tabler/icons-react'
import { useAuth } from '../context/AuthContext'
import { addDays, pad, toDateStr } from '../lib/dates'
import IconPicker from './IconPicker'
import { TASK_COLORS, TASK_ICONS } from '../lib/icons'
import { eventStyleKey, saveEventStyle, useEventStyles } from '../lib/eventStyles'
import { deleteGoogleEvent, updateGoogleEvent, type EventScope, type GoogleEvent } from '../lib/google'

const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

type Props = { event: GoogleEvent; onDone: () => void; onClose: () => void }

// Edit or delete a Google Calendar event (yours or your partner's) without leaving Muna.
export default function EventSheet({ event, onDone, onClose }: Props) {
  const { session, members } = useAuth()
  const owner = members.find((m) => m.id === event.owner_id)
  const who = event.owner_id === session?.user.id ? 'your' : `${owner?.display_name || event.owner_name || 'your partner'}'s`

  const saved = useEventStyles()[eventStyleKey(event)]
  const [color, setColor] = useState<string | null>(saved?.color ?? null)
  const [icon, setIcon] = useState<string | null>(saved?.icon ?? null)
  const shownColor = color ?? owner?.avatar_color ?? 'sky'
  const looks = (color ?? '') !== (saved?.color ?? '') || (icon ?? '') !== (saved?.icon ?? '')

  const [title, setTitle] = useState(event.title === '(no title)' ? '' : event.title)
  const [notes, setNotes] = useState(event.notes ?? '')
  const [allDay, setAllDay] = useState(event.all_day)
  const [date, setDate] = useState(event.all_day ? event.start : toDateStr(new Date(event.start)))
  const [endDate, setEndDate] = useState(event.all_day ? addDays(event.end, -1) : toDateStr(new Date(new Date(event.end).getTime() - 1)))
  const [start, setStart] = useState(event.all_day ? '09:00' : hm(new Date(event.start)))
  const [end, setEnd] = useState(event.all_day ? '10:00' : hm(new Date(event.end)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [scope, setScope] = useState<EventScope>('all')
  const series = Boolean(event.recurring) && scope === 'all' // changing every repeat: the days stay as they are

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
    if (looks) {
      const e = await saveEventStyle(event, { icon, color })
      if (e) {
        setBusy(false)
        return setError(e)
      }
    }
    const r = await updateGoogleEvent(event, {
      scope: event.recurring ? scope : 'one',
      title: title.trim(),
      notes: notes !== (event.notes ?? '') ? notes : undefined,
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

  async function remove(delScope: EventScope) {
    if (busy) return
    setBusy(true)
    setError('')
    const r = await deleteGoogleEvent(event, delScope)
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
        <p className="muted small">This event is in {who} Google Calendar.</p>
        {event.recurring && (
          <div className="field">
            <span>This event repeats. Change…</span>
            <div className="segmented small-seg" role="radiogroup" aria-label="Which repeats">
              <button type="button" role="radio" aria-checked={scope === 'all'} className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>
                All repeats
              </button>
              <button type="button" role="radio" aria-checked={scope === 'one'} className={scope === 'one' ? 'active' : ''} onClick={() => setScope('one')}>
                Only this day
              </button>
            </div>
          </div>
        )}

        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="Event title" />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} placeholder="Anything to remember…" />
        </label>

        <label className="check-row">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          <span>All day</span>
        </label>

        <div className="row-2">
          <label className="field">
            <span>{allDay ? 'First day' : 'Date'}</span>
            <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} disabled={series} />
          </label>
          {allDay ? (
            <label className="field">
              <span>Last day</span>
              <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} disabled={series} />
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

        <div className="field">
          <span>Colour</span>
          <div className="swatches">
            {TASK_COLORS.map((c) => (
              <button type="button" key={c} className={`swatch c-${c}` + (shownColor === c ? ' selected' : '')} onClick={() => setColor(c)} aria-label={c} />
            ))}
          </div>
        </div>

        <div className="field">
          <span>Icon</span>
          <IconPicker value={icon ?? 'IconCalendarEventFilled'} onChange={setIcon} suggestions={Object.keys(TASK_ICONS)} colorClass={`c-${shownColor}`} />
          {(icon || color) && (
            <button type="button" className="btn soft" onClick={() => { setIcon(null); setColor(null) }}>
              Back to the default look
            </button>
          )}
        </div>

        {event.link && (
          <a className="soft-link" href={event.link} target="_blank" rel="noreferrer">
            <IconExternalLink size={16} /> Open in Google Calendar
          </a>
        )}
        {event.recurring && <p className="muted small">The icon and colour apply to all repeats.</p>}
        {series && <p className="muted small">The days follow the repeat, so only the title and time change. Pick “Only this day” to move a single day.</p>}
        {error && <p className="notice">{error}</p>}

        <div className="sheet-actions">
          {confirmDelete ? (
            event.recurring ? (
              <div className="delete-choice">
                <button className="btn danger" onClick={() => remove('one')} disabled={busy}>
                  <IconTrashFilled size={18} /> Only this day
                </button>
                <button className="btn danger" onClick={() => remove('all')} disabled={busy}>
                  <IconTrashFilled size={18} /> All repeats
                </button>
              </div>
            ) : (
              <button className="btn danger" onClick={() => remove('one')} disabled={busy}>
                <IconTrashFilled size={18} /> Really delete?
              </button>
            )
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
