import { useRef, useState } from 'react'
import { useSheetScrollGuard } from '../hooks/useSheetScrollGuard'
import { IconCheck, IconPlus, IconTrashFilled, IconX } from '@tabler/icons-react'
import IconPicker from './IconPicker'
import RepeatEditor from './RepeatEditor'
import { cleanRepeat, firstOccurrence, type Repeat } from '../lib/recurrence'
import { TASK_COLORS, TASK_ICONS } from '../lib/icons'
import { useAuth } from '../context/AuthContext'
import { buyProduct } from '../lib/meals'
import type { Category, ChecklistItem, Task, TaskDraft } from '../lib/types'

type Props = {
  task?: Task | null
  defaultDate?: string | null
  onSave: (draft: TaskDraft, id?: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onChecklist?: (id: string, items: ChecklistItem[]) => void // saves the to-do list at once (ticks should not wait for Save)
  onClose: () => void
}

export default function TaskSheet({ task, defaultDate, onSave, onDelete, onChecklist, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)
  useSheetScrollGuard(backdropRef)
  const { members, session, profile } = useAuth()
  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [date, setDate] = useState(task ? task.due_date ?? '' : defaultDate ?? '')
  const [start, setStart] = useState(task?.start_time?.slice(0, 5) ?? '')
  const [end, setEnd] = useState(task?.end_time?.slice(0, 5) ?? '')
  const [icon, setIcon] = useState(task?.icon ?? 'checklist')
  const [color, setColor] = useState(task?.color ?? 'mint')
  const [assignee, setAssignee] = useState(task?.assigned_to ?? '')
  const [repeat, setRepeat] = useState<Repeat | null>(task?.repeat ?? null)
  const [category, setCategory] = useState<Category | null>(task?.category ?? null)
  const [items, setItems] = useState<ChecklistItem[]>(task?.checklist ?? [])
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)

  // Every change to the to-do list is saved straight away for an existing task. Ticking something to buy puts it in the pantry.
  function changeItems(next: ChecklistItem[]) {
    setItems(next)
    if (task) onChecklist?.(task.id, next)
  }
  function tick(i: number) {
    const it = items[i]
    const done = !it.done
    changeItems(items.map((x, j) => (j === i ? { ...x, done } : x)))
    if (task && it.product_id && profile) void buyProduct(profile.household_id, it.product_id, done ? 1 : -1)
  }
  function addItem() {
    const text = newItem.trim()
    if (!text) return
    changeItems([...items, { id: crypto.randomUUID(), text: text.slice(0, 200), done: false }])
    setNewItem('')
  }

  async function save() {
    if (!title.trim() || saving) return
    setSaving(true)
    // A repeating task starts on the first day it really happens (e.g. the first Tuesday if you picked Tuesdays).
    const rule = repeat && date ? cleanRepeat(repeat) : null
    await onSave(
      {
        title: title.trim(),
        notes: notes.trim(),
        due_date: rule && date ? firstOccurrence(date, rule) : date || null,
        repeat: rule,
        start_time: start || null,
        end_time: start && end ? end : null,
        icon,
        color,
        assigned_to: assignee || null,
        category,
        checklist: newItem.trim() ? [...items, { id: crypto.randomUUID(), text: newItem.trim().slice(0, 200), done: false }] : items,
        sync_google: true,
      },
      task?.id,
    )
    setSaving(false)
  }

  return (
    <div className="sheet-backdrop" ref={backdropRef} onClick={onClose}>
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

        <div className="field">
          <span>Counts for</span>
          <div className="segmented" role="radiogroup" aria-label="Category">
            {([[null, 'Nothing'], ['uni', 'Uni'], ['goal', 'Goals']] as [Category | null, string][]).map(([v, label]) => (
              <button key={label} type="button" role="radio" aria-checked={category === v} className={category === v ? 'active' : ''} onClick={() => setCategory(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <RepeatEditor value={repeat} onChange={setRepeat} date={date} />

        <div className="field">
          <span>To-do list{items.length ? ` (${items.filter((i) => i.done).length}/${items.length})` : ''}</span>
          <div className="cl">
            {items.map((it, i) => (
              <div key={it.id} className={'cl-row' + (it.done ? ' done' : '')}>
                <button type="button" className={'check' + (it.done ? ' checked' : '')} onClick={() => tick(i)} aria-label={it.done ? 'Mark as not done' : 'Mark as done'} aria-pressed={it.done}>
                  {it.done && <IconCheck size={16} stroke={3} />}
                </button>
                <span className="cl-text">{it.text}</span>
                <button type="button" className="icon-btn" onClick={() => changeItems(items.filter((_, j) => j !== i))} aria-label={`Remove ${it.text}`}>
                  <IconX size={16} />
                </button>
              </div>
            ))}
            <div className="cl-add">
              <input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addItem()
                  }
                }}
                placeholder="Add a line…"
                maxLength={200}
              />
              <button type="button" className="btn soft" onClick={addItem} disabled={!newItem.trim()} aria-label="Add line">
                <IconPlus size={18} />
              </button>
            </div>
          </div>
        </div>

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
              <IconTrashFilled size={18} /> {task.repeat ? 'Delete all' : 'Delete'}
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
