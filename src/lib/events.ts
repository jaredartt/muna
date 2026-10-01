// Lets the chat tell the task list "something changed, please reload".
export const TASKS_CHANGED = 'muna:tasks-changed'
export function notifyTasksChanged() {
  window.dispatchEvent(new Event(TASKS_CHANGED))
}
