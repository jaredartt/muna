import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useTasks } from '../hooks/useTasks'
import TaskSheet from '../components/TaskSheet'
import type { Occurrence, Task, TaskDraft } from '../lib/types'

type Editor = { task: Task | null; defaultDate: string | null } | null

type TasksState = ReturnType<typeof useTasks> & {
  /** Open the task sheet. Pass a task to edit, or { date } to create one on a given day. */
  openEditor: (arg?: Task | Occurrence | { date?: string | null }) => void
}

const Ctx = createContext<TasksState | null>(null)

export function TasksProvider({ children }: { children: ReactNode }) {
  const t = useTasks()
  const [editor, setEditor] = useState<Editor>(null)

  const openEditor = useCallback((arg?: Task | Occurrence | { date?: string | null }) => {
    // a repeating day opens the real task (the whole series), not just that one day
    if (arg && 'id' in arg) setEditor({ task: (arg as Occurrence).series ?? arg, defaultDate: null })
    else setEditor({ task: null, defaultDate: arg?.date ?? null })
  }, [])

  const { addTask, updateTask, deleteTask } = t

  const handleSave = useCallback(
    async (draft: TaskDraft, id?: string) => {
      if (id) await updateTask(id, draft)
      else await addTask(draft)
      setEditor(null)
    },
    [addTask, updateTask],
  )
  const handleDelete = useCallback(
    async (id: string) => {
      await deleteTask(id)
      setEditor(null)
    },
    [deleteTask],
  )

  const value = useMemo(() => ({ ...t, openEditor }), [t, openEditor])

  return (
    <Ctx.Provider value={value}>
      {children}
      {editor && (
        <TaskSheet
          task={editor.task}
          defaultDate={editor.defaultDate}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditor(null)}
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
