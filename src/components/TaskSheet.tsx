import { useEffect, useMemo, useRef, useState } from 'react'
import { useSheetScrollGuard } from '../hooks/useSheetScrollGuard'
import { IconArrowBackUp, IconCheck, IconPlus, IconTrashFilled, IconX } from '@tabler/icons-react'
import IconPicker from './IconPicker'
import { useConfirm } from './Confirm'
import { useReorder } from '../hooks/useReorder'
import RepeatEditor from './RepeatEditor'
import { cleanRepeat, firstOccurrence, type Repeat } from '../lib/recurrence'
import { TASK_COLORS, TASK_ICONS } from '../lib/icons'
import { useAuth } from '../context/AuthContext'
import { buyProduct } from '../lib/meals'
import { assigneeColor, sortMembers } from '../lib/people'
import { findProductByText, matchesProduct, useProducts, type Product } from '../lib/products'
import { useHobbies } from '../lib/hobbies'
import { currentWeekOf, duration, itemState, useUniItems, useUniSettings } from '../lib/uni'
import { useTasksCtx } from '../context/TasksContext'
import { todayStr } from '../lib/dates'
import type { Category, ChecklistItem, Task, TaskDraft } from '../lib/types'

type Props = {
  task?: Task | null
  defaultDate?: string | null
  defaultStart?: string | null // HH:MM, for a new task made by long-pressing the calendar
  defaultEnd?: string | null
  onSave: (draft: TaskDraft, id?: string, uni?: { itemId?: string | null; week: number | null }) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onChecklist?: (id: string, items: ChecklistItem[]) => void // saves the to-do list at once (ticks should not wait for Save)
  onAutosave?: (draft: TaskDraft, id: string) => Promise<void> // saves an existing task while you edit it (the sheet stays open)
  done?: boolean // is this task ticked (for a repeating task: on the day you opened)
  onToggleDone?: () => void
  leaving?: boolean // the sheet is sliding away
  onClose: () => void
}

/** What a task is called in the sheet, and the look it gets until you pick your own icon and colour. */
const KINDS: Record<string, { noun: string; icon: string }> = {
  none: { noun: 'task', icon: 'checklist' },
  uni: { noun: 'uni task', icon: 'school' },
  goal: { noun: 'Goal', icon: 'star' },
  hobby: { noun: 'hobby task', icon: 'IconPaletteFilled' },
  pantry: { noun: 'pantry task', icon: 'shopping' },
}
const kindOf = (c: Category | null) => KINDS[c ?? 'none']

export default function TaskSheet({ task, defaultDate, defaultStart, defaultEnd, onSave, onDelete, onChecklist, onAutosave, done, onToggleDone, leaving, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)
  useSheetScrollGuard(backdropRef)
  const { members, session, profile } = useAuth()
  const { confirm } = useConfirm()
  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [date, setDate] = useState(task ? task.due_date ?? '' : defaultDate ?? '')
  const [start, setStart] = useState(task?.start_time?.slice(0, 5) ?? (task ? '' : defaultStart ?? ''))
  const [end, setEnd] = useState(task?.end_time?.slice(0, 5) ?? (task ? '' : defaultEnd ?? ''))
  const [icon, setIcon] = useState(task?.icon ?? 'checklist')
  const [color, setColor] = useState(task?.color ?? 'mint')
  const [assignee, setAssignee] = useState(task?.assigned_to ?? '')
  const [repeat, setRepeat] = useState<Repeat | null>(task?.repeat ?? null)
  const [category, setCategory] = useState<Category | null>(task?.category ?? null)
  const [items, setItems] = useState<ChecklistItem[]>(task?.checklist ?? [])
  // choosing who it is for also sets the colour (Jared orange, Lidia purple, both green); you can still pick another colour afterwards
  function chooseAssignee(v: string) {
    setAssignee(v)
    setColor(assigneeColor(v, members, session?.user.id ?? ''))
  }
  // choosing what it is also sets its look (icon and colour) unless you already picked your own
  function chooseCategory(v: Category | null) {
    const was = kindOf(category)
    const now = kindOf(v)
    if (icon === was.icon) setIcon(now.icon)
    setCategory(v)
  }
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const products = useProducts()
  const hobbies = useHobbies()
  // while typing a line: only in a PANTRY task, your products that look like it ("pizza" -> "Pizza Margherita"), so a line can be linked to a product
  const suggestions = useMemo(() => {
    const t = newItem.trim()
    if (category !== 'pantry' || t.length < 2) return []
    const linked = new Set(items.map((i) => i.product_id))
    return products.filter((p) => !linked.has(p.id) && matchesProduct(p, t)).slice(0, 5)
  }, [newItem, products, items, category])
  // in a HOBBY task: the hobbies you already have
  const hobbySuggestions = useMemo(() => {
    const t = newItem.trim().toLowerCase()
    if (category !== 'hobby' || t.length < 1) return []
    const have = new Set(items.map((i) => i.text.toLowerCase()))
    return hobbies.filter((h) => h.created_by === session?.user.id && h.name.toLowerCase().includes(t) && !have.has(h.name.toLowerCase())).slice(0, 5)
  }, [newItem, hobbies, items, category, session])

  // a new UNI task: your open assignments of the week you are in, so it can be attached to one instead of becoming a copy
  const uniItems = useUniItems()
  const uniSetting = useUniSettings().find((x) => x.user_id === session?.user.id)
  const { tasks: allTasks } = useTasksCtx()
  const [uniItemId, setUniItemId] = useState<string | null>(null)
  const mine = useMemo(() => uniItems.filter((i) => i.created_by === session?.user.id), [uniItems, session])
  const uniWeek = useMemo(() => currentWeekOf(mine, allTasks, uniSetting, todayStr()), [mine, allTasks, uniSetting])
  const uniSuggestions = useMemo(() => {
    if (task || category !== 'uni' || uniWeek == null) return []
    const t = title.trim().toLowerCase()
    return mine
      .filter((i) => i.week === uniWeek && !itemState(i, allTasks, todayStr()).done && i.id !== uniItemId && (!t || i.title.toLowerCase().includes(t)))
      .slice(0, 5)
  }, [task, category, uniWeek, mine, allTasks, title, uniItemId])

  // Every change to the to-do list is saved straight away for an existing task. Ticking something to buy puts it in the pantry.
  function changeItems(next: ChecklistItem[]) {
    setItems(next)
    if (task) onChecklist?.(task.id, next)
  }
  // press and hold a line to move it (ticked lines too)
  const lines = useReorder({
    columns: [items.map((i) => i.id)],
    onChange: (cols) => {
      const byId = new Map(items.map((i) => [i.id, i]))
      changeItems(cols[0].map((id) => byId.get(id)!).filter(Boolean))
    },
  })
  function tick(i: number) {
    const it = items[i]
    const done = !it.done
    // a line you typed that is exactly the name (or nickname) of one of your products counts as that product
    const productId = it.product_id ?? (done && category === 'pantry' ? findProductByText(it.text)?.id : undefined)
    changeItems(items.map((x, j) => (j === i ? { ...x, done, ...(productId ? { product_id: productId } : {}) } : x)))
    if (task && productId && profile) void buyProduct(profile.household_id, productId, done ? 1 : -1)
  }
  // a line is linked to a product when you pick one from the suggestions, or when what you typed is exactly a product's name or nickname
  function lineFor(text: string, product?: Product | null): ChecklistItem {
    const p = product ?? (category === 'pantry' ? findProductByText(text) : null)
    return { id: crypto.randomUUID(), text: (p ? p.name : text).slice(0, 200), done: false, ...(p ? { product_id: p.id } : {}) }
  }
  function addItem(product?: Product) {
    const text = newItem.trim()
    if (!text && !product) return
    changeItems([...items, lineFor(text, product)])
    setNewItem('')
  }

  // everything on the sheet as a task. A repeating task starts on the first day it really happens (e.g. the first Tuesday if you picked Tuesdays).
  function makeDraft(withNewLine: boolean): TaskDraft {
    const rule = repeat && date ? cleanRepeat(repeat) : null
    return {
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
      checklist: withNewLine && newItem.trim() ? [...items, lineFor(newItem.trim())] : items,
      sync_google: true,
    }
  }

  // A NEW task is made with the button. An EXISTING task saves itself a moment after you stop changing something.
  async function save() {
    if (!title.trim() || saving) return
    setSaving(true)
    await onSave(makeDraft(true), task?.id, category === 'uni' ? { itemId: uniItemId, week: uniWeek } : undefined)
    setSaving(false)
  }

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'name'>('idle')
  const latest = useRef({ makeDraft, title })
  latest.current = { makeDraft, title }
  const dirty = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const firstRun = useRef(true)
  const taskId = task?.id

  async function autosave() {
    window.clearTimeout(timer.current)
    if (!taskId || !onAutosave || !dirty.current) return
    if (!latest.current.title.trim()) {
      setStatus('name') // a task needs a name: nothing is saved until it has one
      return
    }
    dirty.current = false
    setStatus('saving')
    await onAutosave(latest.current.makeDraft(false), taskId)
    setStatus(dirty.current ? 'saving' : 'saved')
  }
  const autosaveRef = useRef(autosave)
  autosaveRef.current = autosave

  // watch every field of the sheet (the to-do list saves itself separately, straight away)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (!taskId) return
    dirty.current = true
    setStatus('saving')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void autosaveRef.current(), 800)
  }, [taskId, title, notes, date, start, end, icon, color, assignee, repeat, category])

  // closing the sheet (or leaving) right after a change still saves it
  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      if (dirty.current) void autosaveRef.current()
    },
    [],
  )

  return (
    <div className={'sheet-backdrop sheet-anim' + (leaving ? ' leaving' : '')} ref={backdropRef} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`${task ? 'Edit' : 'New'} ${kindOf(category).noun}`}>
        <div className="sheet-head">
          <h2>{task ? 'Edit' : 'New'} {kindOf(category).noun}</h2>
          {task && status !== 'idle' && (
            <span className={'muted small autosave-state' + (status === 'name' ? ' warn' : '')} role="status" aria-live="polite">
              {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Give it a name to save'}
            </span>
          )}
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <IconX size={22} />
          </button>
        </div>

        {task && onToggleDone && (
          <button type="button" className={'btn ' + (done ? 'soft' : 'primary')} style={{ alignSelf: 'stretch' }} onClick={onToggleDone} aria-pressed={done}>
            {done ? (
              <>
                <IconArrowBackUp size={20} /> Mark as not done
              </>
            ) : (
              <>
                <IconCheck size={20} stroke={2.6} /> Mark as done
              </>
            )}
          </button>
        )}

        <label className="field">
          <span>What needs to be done?</span>
          <input
            autoFocus={!task}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              // typing something else than the picked assignment makes it a new one again
              const picked = uniItemId ? mine.find((i) => i.id === uniItemId) : null
              if (picked && picked.title !== e.target.value) setUniItemId(null)
            }}
            placeholder="e.g. Buy oat milk"
            maxLength={300}
          />
        </label>
        {!task && category === 'uni' && uniWeek != null && (
          <div className="cl-sug" role="listbox" aria-label={`Your assignments of week ${uniWeek}`}>
            {uniItemId ? (
              <span className="muted small">Attached to this assignment in your Uni list. Muna will not replan anything.</span>
            ) : (
              <span className="muted small">{uniSuggestions.length ? `Is it one of your assignments of week ${uniWeek}? Tap it.` : `It will be added to your Uni list, week ${uniWeek}.`}</span>
            )}
            {uniSuggestions.map((i) => (
              <button
                key={i.id}
                type="button"
                className="ml-row"
                role="option"
                aria-selected={false}
                onClick={() => {
                  setTitle(i.title)
                  setUniItemId(i.id)
                }}
              >
                <span className="ml-row-main">
                  <strong>{i.title}</strong>
                  <span className="muted small">Week {i.week} · {duration(i.minutes)}</span>
                </span>
                <IconPlus size={18} />
              </button>
            ))}
          </div>
        )}

        <div className="row-2">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Who</span>
            <select value={assignee} onChange={(e) => chooseAssignee(e.target.value)}>
              {sortMembers(members).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.display_name || (m.id === session?.user.id ? 'Me' : 'Partner')}
                </option>
              ))}
              <option value="">Both</option>
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
          <div className="segmented five" role="radiogroup" aria-label="Category">
            {([[null, 'Task'], ['uni', 'Uni'], ['goal', 'Goals'], ['hobby', 'Hobby'], ['pantry', 'Pantry']] as [Category | null, string][]).map(([v, label]) => (
              <button key={label} type="button" role="radio" aria-checked={category === v} className={category === v ? 'active' : ''} onClick={() => chooseCategory(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <RepeatEditor value={repeat} onChange={setRepeat} date={date} />

        <div className="field">
          <span>To-do list{items.length ? ` (${items.filter((i) => i.done).length}/${items.length})` : ''}</span>
          <div className="cl" ref={lines.column(0)}>
            {items.map((it, i) => (
              <div key={it.id} className={'cl-row' + (it.done ? ' done' : '')} {...lines.item(it.id)}>
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
              <button type="button" className="btn soft" onClick={() => addItem()} disabled={!newItem.trim()} aria-label="Add line">
                <IconPlus size={18} />
              </button>
            </div>
            {hobbySuggestions.length > 0 && (
              <div className="cl-sug" role="listbox" aria-label="Your hobbies">
                <span className="muted small">One of your hobbies? Tap it to add it.</span>
                {hobbySuggestions.map((h) => (
                  <button key={h.id} type="button" className="ml-row" role="option" aria-selected={false} onClick={() => changeItems([...items, { id: crypto.randomUUID(), text: h.name.slice(0, 200), done: false }])}>
                    <span className="ml-row-main">
                      <strong>{h.name}</strong>
                      <span className="muted small">{h.description || 'Your hobby'}</span>
                    </span>
                    <IconPlus size={18} />
                  </button>
                ))}
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="cl-sug" role="listbox" aria-label="Your products">
                <span className="muted small">Is it one of your products? Tap it, and it goes into the pantry when you tick it.</span>
                {suggestions.map((p) => (
                  <button key={p.id} type="button" className="ml-row" role="option" aria-selected={false} onClick={() => addItem(p)}>
                    <span className="ml-row-main">
                      <strong>{p.name}</strong>
                      <span className="muted small">{[p.nickname ? `“${p.nickname}”` : '', p.brand, p.pack_size].filter(Boolean).join(' · ') || 'Your product'}</span>
                    </span>
                    <IconPlus size={18} />
                  </button>
                ))}
              </div>
            )}
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
            <button
              className="btn danger"
              onClick={async () => {
                const ok = await confirm({
                  message: task.repeat ? <>Delete <strong>{task.title}</strong> and all its repeats?</> : <>Delete <strong>{task.title}</strong>?</>,
                  confirmLabel: task.repeat ? 'Delete all' : 'Delete',
                })
                if (ok) void onDelete(task.id)
              }}
            >
              <IconTrashFilled size={18} /> {task.repeat ? 'Delete all' : 'Delete'}
            </button>
          )}
          {!task && (
            <button className="btn primary grow" onClick={save} disabled={!title.trim() || saving}>
              {saving ? 'Adding…' : `Add ${kindOf(category).noun}`}
            </button>
          )}

        </div>
      </div>
    </div>
  )
}
