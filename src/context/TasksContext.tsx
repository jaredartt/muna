import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTasks } from '../hooks/useTasks'
import TaskSheet from '../components/TaskSheet'
import EventSheet from '../components/EventSheet'
import { useAuth } from './AuthContext'
import { linkNewUniTask } from '../lib/uni'
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

  const { addTask, updateTask, deleteTask, toggleTask, occurrencesOn } = t
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
      } else await addTask(draft)
      closeEditor()
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

  const value = useMemo(() => ({ ...t, openEditor, openEvent }), [t, openEditor, openEvent])

  return (
    <Ctx.Provider value={value}>
      {children}
      {editor && (
        <TaskSheet
          key={(editor.task?.id ?? 'new') + (editor.occDate ?? '')}
          task={editor.task}
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
