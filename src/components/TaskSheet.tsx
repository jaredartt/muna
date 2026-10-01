import { useState } from 'react'
import { IconTrashFilled } from '@tabler/icons-react'
import { IconX } from '@tabler/icons-react'
import IconPicker from './IconPicker'
import { TASK_COLORS, TASK_ICONS } from '../lib/icons'
import { useAuth } from '../context/AuthContext'
import type { Task, TaskDraft } from '../lib/types'

type Props = {
  task?: Task | null
  defaultDate?: string | null
  onSave: (draft: TaskDraft, id?: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onClose: () => void
}

export default function TaskSheet({ task, defaultDate, onSave, onDelete, onClose }: Props) {
  const { members, session, googleConnected } = useAuth()
  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [date, setDate] = useState(task ? task.due_date ?? '' : defaultDate ?? '')
  const [start, setStart] = useState(task?.start_time?.slice(0, 5) ?? '')
  const [end, setEnd] = useState(task?.end_time?.slice(0, 5) ?? '')
  const [icon, setIcon] = useState(task?.icon ?? 'checklist')
  const [color, setColor] = useState(task?.color ?? 'mint')
  const [assignee, setAssignee] = useState(task?.assigned_to ?? '')
  const [syncGoogle, setSyncGoogle] = useState(task?.sync_google ?? true)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!title.trim() || saving) return
    setSaving(true)
    await onSave(
      {
        title: title.trim(),
        notes: notes.trim(),
        due_date: date || null,
        start_time: start || null,
        end_time: start && end ? end : null,
        icon,
        color,
        assigned_to: assignee || null,
        sync_google: syncGoogle,
      },
      task?.id,
    )
    setSaving(false)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={task ? 'Edit task' : 'New task'}>
        <div className="sheet-head">
          <h2>{task ? 'Edit task' : 'New task'}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={22} />
          </button>
        </div>

        <label className="field">
          <span>What needs to be done?</span>
          <input autoFocus={!task} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Buy oat milk" maxLength={300} />
        </label>

        <div className="row-2">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Who</span>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="">Anyone</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === session?.user.id ? 'Me' : m.display_name || 'Partner'}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="row-2">
          <label className="field">
            <span>Starts</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field">
            <span>Ends</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={!start} />
          </label>
        </div>

        {googleConnected && (
          <label className="check-row">
            <input type="checkbox" checked={syncGoogle} onChange={(e) => setSyncGoogle(e.target.checked)} disabled={!date} />
            <span>Add to Google Calendar{!date ? ' (pick a date first)' : ''}</span>
          </label>
        )}

        <label className="field">
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything to remember…" />
        </label>

        <div className="field">
          <span>Colour</span>
          <div className="swatches">
            {TASK_COLORS.map((c) => (
              <button key={c} className={`swatch c-${c}` + (color === c ? ' selected' : '')} onClick={() => setColor(c)} aria-label={c} />
            ))}
          </div>
        </div>

        <div className="field">
          <span>Icon</span>
          <IconPicker value={icon} onChange={setIcon} suggestions={Object.keys(TASK_ICONS)} colorClass={`c-${color}`} />
        </div>

        <div className="sheet-actions">
          {task && onDelete && (
            <button className="btn danger" onClick={() => onDelete(task.id)}>
              <IconTrashFilled size={18} /> Delete
            </button>
          )}
          <button className="btn primary grow" onClick={save} disabled={!title.trim() || saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
