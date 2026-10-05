import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTasks } from '../hooks/useTasks'
import TaskSheet, { type Scope } from '../components/TaskSheet'
import EventSheet from '../components/EventSheet'
import { useAuth } from './AuthContext'
import { linkNewUniTask } from '../lib/uni'
import { supabase } from '../lib/supabase'
import { addDaysStr, occurrencesBetween } from '../lib/recurrence'
import { notifyTasksChanged } from '../lib/events'
import type { GoogleEvent } from '../lib/google'
import type { ChecklistItem, Occurrence, Task, TaskDraft } from '../lib/types'

type Editor = { task: Task | null; occDate?: string | null; defaultDate: string | null; defaultStart?: string | null; defaultEnd?: string | null } | null

type TasksState = ReturnType<typeof useTasks> & {
  /** Open the task sheet. Pass a task to edit, or { date } (and optionally { start, end } as HH:MM) to create one on a given day. */
  openEditor: (arg?: Task | Occurrence | { date?: string | null; start?: string | null; end?: string | null }) => void
  /** Open the editor for a Google Calendar event (either person's). */
  openEvent: (ev: GoogleEvent) => void
}

const Ctx = createContext<TasksState | null>(null)

export function TasksProvider({ children }: { children: ReactNode }) {
  const t = useTasks()
  const { session, profile } = useAuth()
  const [editor, setEditor] = useState<Editor>(null)
  const [eventEditor, setEventEditor] = useState<GoogleEvent | null>(null)
  // the task sheet slides down before it disappears
  const [leaving, setLeaving] = useState(false)
  const closeTimer = useRef<number | undefined>(undefined)
  const openEvent = useCallback((ev: GoogleEvent) => setEventEditor(ev), [])

  const openEditor = useCallback((arg?: Task | Occurrence | { date?: string | null; start?: string | null; end?: string | null }) => {
    // opening a sheet while the last one is still sliding away: keep the new one
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = undefined
      setLeaving(false)
    }
    // a repeating day opens the real task (the whole series), not just that one day
    if (arg && 'id' in arg) setEditor({ task: (arg as Occurrence).series ?? arg, occDate: (arg as Occurrence).series ? arg.due_date : null, defaultDate: null })
    else setEditor({ task: null, defaultDate: arg?.date ?? null, defaultStart: (arg as { start?: string | null } | undefined)?.start ?? null, defaultEnd: (arg as { end?: string | null } | undefined)?.end ?? null })
  }, [])

  const { addTask, updateTask, deleteTask, toggleTask, occurrencesOn, batch } = t
  const closeEditor = useCallback(() => {
    if (closeTimer.current) return
    setLeaving(true)
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = undefined
      setEditor(null)
      setLeaving(false)
    }, 230)
  }, [])
  // is the task being edited done (for a repeating task: on the day you opened)? Always read live, so the button follows ticks made elsewhere.
  const liveEditing = editor?.task ? (editor.occDate ? occurrencesOn(editor.occDate).find((o) => o.id === editor.task!.id) : t.tasks.find((x) => x.id === editor.task!.id)) : undefined
  const handleChecklist = useCallback((id: string, items: ChecklistItem[]) => void updateTask(id, { checklist: items }), [updateTask])

  const handleSave = useCallback(
    async (draft: TaskDraft, id?: string, uni?: { itemId?: string | null; week: number | null }) => {
      if (id) await updateTask(id, draft)
      else if (draft.category === 'uni' && uni && profile?.household_id && session) {
        // a new Uni task joins the Uni list (attached to the assignment you picked, or as a new one in your week)
        await addTask(draft, (taskId) => linkNewUniTask(taskId, draft, { householdId: profile.household_id, userId: session.user.id, itemId: uni.itemId, week: uni.week }))
      } else {
        const err = await addTask(draft)
        if (err) return err // the sheet stays open and shows what went wrong
      }
      closeEditor()
      return null
    },
    [addTask, updateTask, closeEditor, profile, session],
  )
  // an existing task being edited: saved in place, the sheet stays open
  const handleAutosave = useCallback(
    async (draft: TaskDraft, id: string) => {
      await updateTask(id, draft)
    },
    [updateTask],
  )
  const handleDelete = useCallback(
    async (id: string) => {
      await deleteTask(id)
      closeEditor()
    },
    [deleteTask, closeEditor],
  )

  // a day of a repeating task: change only that day (it becomes its own task and the series skips it), or that day and all after it (the series is cut and a new one starts)
  const handleSeriesSave = useCallback(
    async (draft: TaskDraft, id: string, occ: string, scope: Scope, date: string): Promise<string | null> => {
      const s = t.tasks.find((x) => x.id === id)
      if (!s?.repeat) return (await updateTask(id, draft)) ?? null
      const rep = s.repeat
      const res = { err: null as string | null }
      if (scope === 'one') {
        const wasDone = occurrencesOn(occ).find((o) => o.id === id)?.completed ?? false
        await batch(async () => {
          res.err = await addTask({ ...draft, repeat: null, due_date: date || occ, completed: wasDone, completed_at: wasDone ? new Date().toISOString() : null })
          if (!res.err) res.err = await updateTask(id, { repeat: { ...rep, exceptDates: [...(rep.exceptDates ?? []), occ] } })
        })
        return res.err
      }
      if (occ <= (s.due_date ?? occ)) return (await updateTask(id, draft)) ?? null // it is the first day: that is the whole series
      await batch(async () => {
        const prev = addDaysStr(occ, -1)
        let rule = draft.repeat ?? rep
        if (rule.count && rep.count) rule = { ...rule, count: Math.max(1, rep.count - occurrencesBetween(s.due_date, rep, s.due_date ?? occ, prev).length) }
        res.err = await addTask({ ...draft, repeat: rule }, async (newId) => {
          // the ticks of the days from here on follow the new series
          await supabase.from('task_completions').update({ task_id: newId }).eq('task_id', id).gte('occ_date', occ)
        })
        if (!res.err) res.err = await updateTask(id, { repeat: { ...rep, until: prev, count: null } })
      })
      return res.err
    },
    [t.tasks, addTask, updateTask, batch, occurrencesOn],
  )
  const handleSeriesDelete = useCallback(
    async (id: string, occ: string, scope: Scope) => {
      const s = t.tasks.find((x) => x.id === id)
      if (!s?.repeat) await deleteTask(id)
      else if (scope === 'one') await updateTask(id, { repeat: { ...s.repeat, exceptDates: [...(s.repeat.exceptDates ?? []), occ] } })
      else if (occ <= (s.due_date ?? occ)) await deleteTask(id)
      else await updateTask(id, { repeat: { ...s.repeat, until: addDaysStr(occ, -1), count: null } })
      closeEditor()
    },
    [t.tasks, deleteTask, updateTask, closeEditor],
  )

  const value = useMemo(() => ({ ...t, openEditor, openEvent }), [t, openEditor, openEvent])

  return (
    <Ctx.Provider value={value}>
      {children}
      {editor && (
        <TaskSheet
          key={(editor.task?.id ?? 'new') + (editor.occDate ?? '')}
          task={editor.task}
          occDate={editor.occDate}
          onSeriesSave={handleSeriesSave}
          onSeriesDelete={handleSeriesDelete}
          defaultDate={editor.defaultDate}
          defaultStart={editor.defaultStart}
          defaultEnd={editor.defaultEnd}
          onSave={handleSave}
          onDelete={handleDelete}
          onChecklist={handleChecklist}
          onAutosave={handleAutosave}
          done={liveEditing?.completed ?? false}
          onToggleDone={liveEditing ? () => void toggleTask(liveEditing) : undefined}
          leaving={leaving}
          onClose={closeEditor}
        />
      )}
      {eventEditor && (
        <EventSheet
          event={eventEditor}
          onClose={() => setEventEditor(null)}
          onDone={() => {
            setEventEditor(null)
            notifyTasksChanged()
          }}
        />
      )}
    </Ctx.Provider>
  )
}

export function useTasksCtx(): TasksState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTasksCtx must be used inside TasksProvider')
  return v
}
