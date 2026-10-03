import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useTasks } from '../hooks/useTasks'
import TaskSheet from '../components/TaskSheet'
import EventSheet from '../components/EventSheet'
import { notifyTasksChanged } from '../lib/events'
import type { GoogleEvent } from '../lib/google'
import type { ChecklistItem, Occurrence, Task, TaskDraft } from '../lib/types'

type Editor = { task: Task | null; defaultDate: string | null } | null

type TasksState = ReturnType<typeof useTasks> & {
  /** Open the task sheet. Pass a task to edit, or { date } to create one on a given day. */
  openEditor: (arg?: Task | Occurrence | { date?: string | null }) => void
  /** Open the editor for a Google Calendar event (either person's). */
  openEvent: (ev: GoogleEvent) => void
}

const Ctx = createContext<TasksState | null>(null)

export function TasksProvider({ children }: { children: ReactNode }) {
  const t = useTasks()
  const [editor, setEditor] = useState<Editor>(null)
  const [eventEditor, setEventEditor] = useState<GoogleEvent | null>(null)
  const openEvent = useCallback((ev: GoogleEvent) => setEventEditor(ev), [])

  const openEditor = useCallback((arg?: Task | Occurrence | { date?: string | null }) => {
    // a repeating day opens the real task (the whole series), not just that one day
    if (arg && 'id' in arg) setEditor({ task: (arg as Occurrence).series ?? arg, defaultDate: null })
    else setEditor({ task: null, defaultDate: arg?.date ?? null })
  }, [])

  const { addTask, updateTask, deleteTask } = t
  const handleChecklist = useCallback((id: string, items: ChecklistItem[]) => void updateTask(id, { checklist: items }), [updateTask])

  const handleSave = useCallback(
    async (draft: TaskDraft, id?: string) => {
      if (id) await updateTask(id, draft)
      else await addTask(draft)
      setEditor(null)
    },
    [addTask, updateTask],
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
      setEditor(null)
    },
    [deleteTask],
  )

  const value = useMemo(() => ({ ...t, openEditor, openEvent }), [t, openEditor, openEvent])

  return (
    <Ctx.Provider value={value}>
      {children}
      {editor && (
        <TaskSheet
          task={editor.task}
          defaultDate={editor.defaultDate}
          onSave={handleSave}
          onDelete={handleDelete}
          onChecklist={handleChecklist}
          onAutosave={handleAutosave}
          onClose={() => setEditor(null)}
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
